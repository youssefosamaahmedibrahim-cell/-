--[[
	====================================================================
	Abilities.lua — منفّذ المهارات على الكلينت (Z / X / C / V)
	====================================================================
	بيعمل 3 حاجات مع بعض:
	  1) يشغّل الأنيميشن المناسب
	  2) يشغّل الـ VFX في اللحظة المناسبة (عن طريق أحداث الأنيميشن)
	  3) يبعت للسيرفر يطلب الضرر + ينسخ التأثير للباقين

	الكول داون: محلي فوري (تجربة سلسة) + تأكيد من السيرفر.
]]

local Abilities = {}
Abilities.__index = Abilities

local Config = require(script.Parent.Config)
local AnimationData = require(script.Parent.AnimationData)
local VFX = require(script.Parent.VFX)
local Remotes = require(script.Parent.Remotes)

local Debris = game:GetService("Debris")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local C = Config.VFX
local V3, CF = Vector3.new, CFrame.new

---------------------------------------------------------------------
function Abilities.new(ctx)
	local self = setmetatable({}, Abilities)
	self.Rig = ctx.Rig
	self.Animator = ctx.Animator
	self.UI = ctx.UI
	self.Cooldowns = {}
	self.Active = {}
	self.Busy = false
	self.LastCast = 0
	self.AwakenUntil = 0
	self.RoarReadyAt = 0
	self._dustT = 0
	self._moving = false

	self.Animator.OnEvent = function(track, event)
		self:_onEvent(track, event)
	end
	return self
end

---------------------------------------------------------------------
-- الكول داون
---------------------------------------------------------------------
function Abilities:SetCooldown(key, duration)
	self.Cooldowns[key] = (duration or 0)
	if self.UI then self.UI:SetCooldown(key, duration or 0) end
end

function Abilities:Remaining(key)
	return self.Cooldowns[key] or 0
end

function Abilities:IsReady(key)
	if self.Busy then return false end
	return (self.Cooldowns[key] or 0) <= 0
end

function Abilities:Update(dt)
	for key, t in pairs(self.Cooldowns) do
		if t > 0 then
			self.Cooldowns[key] = math.max(0, t - dt)
		end
	end

	-- غبار تحت الرجلين وقت المشي/الجري
	local rig = self.Rig
	if rig and rig.Humanoid and rig.Root then
		local moving = rig.Humanoid.MoveDirection.Magnitude > 0.15
		self._moving = moving
		if moving and not self._flying then
			self._dustT = self._dustT - dt
			if self._dustT <= 0 then
				self._dustT = 0.22
				VFX.FootDust(rig.Root.Position - V3(0, rig.Scale * 11, 0) + rig.Root.CFrame.LookVector * 4,
					rig.Scale)
			end
		end
	end
end

function Abilities:SetFlying(state) self._flying = state end
function Abilities:IsAwakened() return os.clock() < self.AwakenUntil end

---------------------------------------------------------------------
-- تنفيذ مهارة
---------------------------------------------------------------------
function Abilities:Cast(key)
	local ab = Config.Abilities[key]
	if not ab or not self.Rig then return false end
	if not self:IsReady(key) then
		if self.UI then self.UI:Denied(key) end
		return false
	end

	local now = os.clock()
	if now - self.LastCast < Config.Net.GlobalCastDelay then return false end
	self.LastCast = now

	self.CurrentKey = key
	self:SetCooldown(key, ab.Cooldown)
	self.Busy = true

	-- الأنيميشن (الأحداث جوه هي اللي هتشغّل الـ VFX)
	self.Animator:Play(AnimationData.ForAbility[key], { Fade = 0.12, Speed = 1 })

	-- اطلب من السيرفر (الضرر + النسخ للباقين)
	local ev = Remotes.Get("Cast")
	if ev then ev:FireServer(key, self.Rig.Root.CFrame) end

	if self.UI then self.UI:Trigger(key) end

	task.delay(ab.Windup + ab.Duration + 0.3, function()
		self.Busy = false
	end)
	return true
end

-- زئير (E)
function Abilities:Roar()
	if os.clock() < self.RoarReadyAt then return false end
	if self.Busy then return false end
	self.RoarReadyAt = os.clock() + Config.Extras.RoarCooldown
	self.Busy = true
	self.Animator:Play("Roar", { Fade = 0.12 })
	task.delay(1.4, function() self.Busy = false end)
	return true
end

---------------------------------------------------------------------
-- أحداث الأنيميشن → الـ VFX
---------------------------------------------------------------------
function Abilities:_onEvent(track, event)
	local rig = self.Rig
	if not rig or not rig.Root then return end

	---------------------------------------------------------------
	-- Z : نَفَس النار
	---------------------------------------------------------------
	if track == "FireBreath" then
		local ab = Config.Abilities.Z
		if event == "Cast" then
			self.Active.Breath = VFX.FireBreath(rig, {
				Duration = ab.Duration, Range = ab.Range, Radius = ab.Radius,
			})
			VFX.Flash(C.FireColorA, 0.4, 0.18)
		elseif event == "End" or event == "Ended" then
			if self.Active.Breath then
				self.Active.Breath:Stop()
				self.Active.Breath = nil
			end
		end

	---------------------------------------------------------------
	-- X : مَخَالِب العاصفة
	---------------------------------------------------------------
	elseif track == "ClawBarrage" then
		local ab = Config.Abilities.X
		if event == "Dash" then
			self.Active.Trail = VFX.DashTrail(rig, ab.Duration, C.SlashColor)
			self:_dash(ab.DashDistance, ab.Duration)
			VFX.Shake(0.5, 0.4)
		elseif event:sub(1, 5) == "Slash" then
			local i = tonumber(event:sub(6)) or 1
			local cf = rig.Root.CFrame * CF(0, -1, -5 - i * 1.5)
			VFX.Slash(cf, ab.Radius * 1.7, C.SlashColor, { Shake = 0.45 })
			VFX.HitSpark((cf * CF(0, 0, -6)).Position, C.SlashColor)
		elseif event == "End" or event == "Ended" then
			if self.Active.Trail then self.Active.Trail:Stop(); self.Active.Trail = nil end
		end

	---------------------------------------------------------------
	-- C : مطر النيازك
	---------------------------------------------------------------
	elseif track == "MeteorCast" then
		local ab = Config.Abilities.C
		if event == "Roar" then
			VFX.RoarWave(rig.Root.CFrame * CF(0, 2, -3), { MaxRadius = 46, Shake = 0.7 })
			VFX.Flash(C.FireColorA, 0.6, 0.25)
			VFX.Aura(rig, 1.6, C.FireColorB)
		elseif event == "Summon" then
			-- النيازك الحقيقية بتيجي من السيرفر (عشان الكل يشوف نفس الأماكن)
			VFX.Burst(rig.Root.CFrame * CF(0, 10, 0), {
				Colors = { C.FireColorA, C.FireColorB }, Size0 = 4, Size1 = 0,
				Life0 = 0.5, Life1 = 1.2, Speed0 = 30, Speed1 = 80, Spread = 180, Count = 40,
			})
		elseif event == "Slam" then
			VFX.Explosion(rig.Root.Position - V3(0, rig.Scale * 10, 0), ab.Radius,
				{ Main = C.FireColorB, Core = C.FireColorA }, { Shake = 1.0 })
		elseif event == "End" or event == "Ended" then
			-- لا شيء
		end

	---------------------------------------------------------------
	-- V : عاصفة الرعد
	---------------------------------------------------------------
	elseif track == "ThunderCast" then
		local ab = Config.Abilities.V
		if event == "Roar" then
			VFX.RoarWave(rig.Root.CFrame * CF(0, 3, -3), { MaxRadius = 55, Shake = 0.9, Color = C.ThunderColor })
			VFX.Flash(C.ThunderColor, 0.8, 0.35)
		elseif event == "Awaken" then
			local dur = ab.Awakening.Duration
			self.AwakenUntil = os.clock() + dur
			self.Active.Aura = VFX.Aura(rig, dur, C.Glow)
			if rig.Humanoid then
				rig.Humanoid.WalkSpeed = Config.Dragon.WalkSpeed * ab.Awakening.SpeedMultiplier
			end
			task.delay(dur, function()
				if rig.Humanoid then rig.Humanoid.WalkSpeed = Config.Dragon.WalkSpeed end
				if self.Active.Aura then self.Active.Aura:Stop(); self.Active.Aura = nil end
			end)
		elseif event == "Bolts" then
			VFX.DarkenSky(ab.Duration + 1.5)
		elseif event == "End" or event == "Ended" then
			-- لا شيء
		end

	---------------------------------------------------------------
	-- زئير عادي
	---------------------------------------------------------------
	elseif track == "Roar" then
		if event == "Roar" then
			VFX.RoarWave(rig.Root.CFrame * CF(0, 2, -3), { MaxRadius = 34, Shake = 0.5 })
		end

	---------------------------------------------------------------
	-- تحوّل
	---------------------------------------------------------------
	elseif track == "Transform" then
		if event == "Charge" then
			VFX.Burst(rig.Root.CFrame, {
				Colors = { C.FireColorA, C.FireColorB }, Size0 = 3, Size1 = 0,
				Life0 = 0.4, Life1 = 1, Speed0 = -20, Speed1 = -60, Spread = 180, Count = 50,
			})
		elseif event == "Burst" then
			VFX.TransformPillar(rig.Root.Position, C.FireColorA, true)
		end
	end
end

---------------------------------------------------------------------
-- اندفاع (X)
---------------------------------------------------------------------
function Abilities:_dash(distance, duration)
	local root = self.Rig.Root
	if not root then return end
	local look = root.CFrame.LookVector
	local dir = V3(look.X, 0, look.Z)
	if dir.Magnitude < 0.05 then dir = V3(0, 0, -1) end
	dir = dir.Unit

	local speed = distance / math.max(0.3, duration * 0.85)
	local bv = Instance.new("BodyVelocity")
	bv.MaxForce = V3(1, 1, 1) * 400000
	bv.Velocity = dir * speed
	bv.Parent = root
	Debris:AddItem(bv, duration)

	-- شوية طردفيزياء: قفل الدوران ناحية الاتجاه
	local bg = Instance.new("BodyGyro")
	bg.MaxTorque = V3(0, 60000, 0)
	bg.CFrame = CFrame.lookAt(root.Position, root.Position + dir)
	bg.Parent = root
	Debris:AddItem(bg, duration * 0.7)
end

---------------------------------------------------------------------
-- استجابة لأوامر السيرفر (نسخ التأثيرات)
---------------------------------------------------------------------
function Abilities.InitRemoteListener()
	local ev = Remotes.Get("VFX")
	if not ev then return end
	ev.OnClientEvent:Connect(function(key, cf, data)
		VFX.Remote(key, cf, data or {})
	end)
end

return Abilities

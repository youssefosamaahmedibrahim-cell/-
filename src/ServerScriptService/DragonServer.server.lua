--[[
	====================================================================
	DragonServer.server.lua — عقل النظام على السيرفر
	====================================================================
	• إنشاء الـ Remotes
	• الكول داون الحقيقي (موثوق، مش من الكلينت)
	• حساب الضرر لكل مهارة (Z شعاع / X ضربات / C نيازك / V صواعق)
	• نسخ التأثيرات لكل اللاعبين
]]

local RS = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local DragonFolder = RS:WaitForChild("Dragon")
local Config = require(DragonFolder:WaitForChild("Config"))
local Remotes = require(DragonFolder:WaitForChild("Remotes"))
local DragonState = require(DragonFolder:WaitForChild("DragonState"))
local Combat = require(script.Parent:WaitForChild("DragonCombat"))
local Morph = require(script.Parent:WaitForChild("DragonMorph"))

local V3, CF = Vector3.new, CFrame.new

Remotes.Init()
Combat.Start()

---------------------------------------------------------------------
-- أدوات
---------------------------------------------------------------------
local lastCast = {}

local function cdTable(player)
	local t = DragonState.Cooldowns[player]
	if not t then
		t = {}
		DragonState.Cooldowns[player] = t
	end
	return t
end

local function resyncCooldowns(player)
	local ev = Remotes.Get("Cooldown")
	local t = cdTable(player)
	if not ev then return end
	for _, key in ipairs(Config.AbilityOrder) do
		ev:FireClient(player, key, t[key] or 0)
	end
end

-- مكان الأرض تحت نقطة معينة
local function groundAt(x, z, fallbackY, exclude)
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = exclude or {}
	local origin = V3(x, (fallbackY or 0) + 80, z)
	local res = workspace:Raycast(origin, V3(0, -500, 0), params)
	return res and res.Position.Y or (fallbackY or 0)
end

-- نقاط عشوائية داخل دائرة (مع تجنب التكدس)
local function scatter(center, count, radius, exclude)
	local pts = {}
	for i = 1, count do
		local ang = (i / count) * math.pi * 2 + math.random() * 0.7
		local dist = math.sqrt(math.random()) * radius
		local x = center.X + math.cos(ang) * dist
		local z = center.Z + math.sin(ang) * dist
		local y = groundAt(x, z, center.Y, exclude)
		pts[i] = V3(x, y, z)
	end
	return pts
end

local function multiplier(player, base)
	local m = DragonState.DamageMultiplier(player) * (base or 1)
	if math.random() < 0.12 then return m * 1.5, true end   -- ضربة حرجة
	return m, false
end

---------------------------------------------------------------------
-- Z : نَفَس النار
---------------------------------------------------------------------
local function castFireBreath(player, rig, origin)
	local ab = Config.Abilities.Z
	local vfx = Remotes.Get("VFX")
	task.wait(ab.Windup)
	if vfx then vfx:FireAllClients("Z", rig.Root.CFrame, {}) end

	local perTick = Config.DamagePerTick(ab)
	for i = 1, ab.Ticks do
		if not rig.Mouth or not rig.Mouth.Parent then break end
		local mouthPos = rig.Mouth.Position
		local dir = rig.Head and rig.Head.CFrame.LookVector or rig.Root.CFrame.LookVector
		local targets = Combat.InCone(mouthPos, dir, ab.Range, ab.Radius, { rig.Model }, 5)
		local mult, crit = multiplier(player)
		Combat.Damage(targets, player, perTick * mult, {
			Knockback = ab.Knockback, Source = mouthPos,
			Burn = ab.Burn, Crit = crit,
		})
		task.wait(ab.Duration / ab.Ticks)
	end
end

---------------------------------------------------------------------
-- X : مَخَالِب العاصفة
---------------------------------------------------------------------
local function castClawBarrage(player, rig, origin)
	local ab = Config.Abilities.X
	local vfx = Remotes.Get("VFX")
	if vfx then vfx:FireAllClients("X", rig.Root.CFrame, {}) end

	task.wait(ab.Windup)
	local per = Config.DamagePerTick(ab)
	for i = 1, ab.SlashCount do
		local root = rig.Root
		if not root or not root.Parent then break end
		local dir = root.CFrame.LookVector
		local center = root.Position + dir * 6
		local targets = Combat.InBox(
			CFrame.lookAt(center, center + dir), V3(ab.Radius * 2, ab.Radius * 2.4, ab.Radius * 2),
			{ rig.Model })
		local mult, crit = multiplier(player)
		Combat.Damage(targets, player, per * mult, {
			Knockback = ab.Knockback, Source = root.Position,
			Burn = ab.Burn, Crit = crit,
		})
		task.wait(ab.Duration / ab.SlashCount)
	end
end

---------------------------------------------------------------------
-- C : مطر النيازك
---------------------------------------------------------------------
local function castMeteorRain(player, rig, origin)
	local ab = Config.Abilities.C
	local center = origin.Position
	local points = scatter(center, ab.MeteorCount, ab.CastRadius, { rig.Model })

	local vfx = Remotes.Get("VFX")
	if vfx then vfx:FireAllClients("C", CF(center), { Positions = points, Radius = ab.Radius }) end

	-- أول نيزك بينزل بعد التحذير + زمن السقوط (مطابق للـ VFX على الكلينت)
	local step = ab.Duration / math.max(1, #points)
	local travel = 1.45     -- تحذير (0.62) + سقوط (~0.8)
	for i, pos in ipairs(points) do
		task.delay((i - 1) * step + travel, function()
			local targets = Combat.InSphere(pos + V3(0, 2, 0), ab.Radius, { rig.Model })
			local mult, crit = multiplier(player)
			Combat.Damage(targets, player, ab.Damage.Total * mult, {
				Knockback = ab.Knockback, Source = pos,
				Burn = ab.Burn, Crit = crit,
			})
		end)
	end
end

---------------------------------------------------------------------
-- V : عاصفة الرعد
---------------------------------------------------------------------
local function castThunderStorm(player, rig, origin)
	local ab = Config.Abilities.V
	local center = origin.Position
	local points = scatter(center, ab.BoltCount, ab.CastRadius, { rig.Model })

	local vfx = Remotes.Get("VFX")
	if vfx then vfx:FireAllClients("V", CF(center), { Positions = points, Radius = ab.Radius }) end

	-- الاستيقاظ (بعد الزئير)
	task.delay(ab.Windup + 0.3, function()
		DragonState.Awaken[player] = os.clock() + (ab.Awakening and ab.Awakening.Duration or 10)
	end)

	local step = ab.Duration / math.max(1, #points)
	for i, pos in ipairs(points) do
		task.delay(ab.Windup + (i - 1) * step + 0.25, function()
			local targets = Combat.InSphere(pos + V3(0, 3, 0), ab.Radius, { rig.Model })
			local mult, crit = multiplier(player)
			Combat.Damage(targets, player, ab.Damage.Total * mult, {
				Knockback = ab.Knockback, Source = pos,
				Stun = ab.Stun, Burn = ab.Burn, Crit = crit,
			})
		end)
	end
end

local CastHandlers = {
	Z = castFireBreath,
	X = castClawBarrage,
	C = castMeteorRain,
	V = castThunderStorm,
}

---------------------------------------------------------------------
-- استقبال طلب المهارة
---------------------------------------------------------------------
local function onCast(player, key, originCF)
	local ab = Config.Abilities[key]
	if not ab then return end
	local rig = DragonState.Rigs[player]
	if not rig or not rig.Root or not rig.Root.Parent then return end
	if typeof(originCF) ~= "CFrame" then return end

	-- منع السبام
	local now = os.clock()
	if (lastCast[player] or 0) + Config.Net.GlobalCastDelay > now then return end
	lastCast[player] = now

	-- المسافة (ضد الغش)
	if (originCF.Position - rig.Root.Position).Magnitude > Config.Net.MaxCastDistance then return end

	-- الكول داون الحقيقي
	local cd = cdTable(player)
	if (cd[key] or 0) > Config.Net.CooldownGrace then
		resyncCooldowns(player)
		return
	end
	cd[key] = ab.Cooldown

	-- تأكيد للكلينت
	local cdEv = Remotes.Get("Cooldown")
	if cdEv then cdEv:FireClient(player, key, ab.Cooldown) end

	-- نفّذ
	local handler = CastHandlers[key]
	if handler then
		task.spawn(function()
			local ok, err = pcall(handler, player, rig, originCF)
			if not ok then warn("[DragonServer] خطأ في مهارة " .. key .. ": " .. tostring(err)) end
		end)
	end
end

---------------------------------------------------------------------
-- الكول داون (تحديث)
---------------------------------------------------------------------
RunService.Heartbeat:Connect(function(dt)
	for player, t in pairs(DragonState.Cooldowns) do
		for key, v in pairs(t) do
			if v > 0 then
				t[key] = math.max(0, v - dt)
			end
		end
	end
end)

---------------------------------------------------------------------
-- الربط
---------------------------------------------------------------------
local castEv = Remotes.Get("Cast")
if castEv then
	castEv.OnServerEvent:Connect(onCast)
end

local morphEv = Remotes.Get("Morph")
if morphEv then
	morphEv.OnServerEvent:Connect(function(player, want)
		if want == nil then
			Morph.Toggle(player)
		elseif want == true then
			Morph.ToDragon(player)
		else
			Morph.ToHuman(player)
		end
	end)
end

Players.PlayerRemoving:Connect(function(player)
	lastCast[player] = nil
end)

print("[DragonServer] جاهز — الإصدار " .. Config.Version)

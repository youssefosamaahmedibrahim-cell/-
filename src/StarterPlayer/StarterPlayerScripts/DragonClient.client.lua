--[[
	====================================================================
	DragonClient.client.lua — تحكم اللاعب (كلينت)
	====================================================================
	الأزرار:
		Z  نَفَس النّار
		X  مَخَالِب العاصفة
		C  مطر النيازك
		V  عاصفة الرعد
		E  زئير
		F  طيران / هبوط
		G  تحوّل (إنسان ⇄ تنين)
		Shift  جري سريع
		Space / Ctrl  طلوع / نزول وقت الطيران
]]

local RS = game:GetService("ReplicatedStorage")
local UIS = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local player = Players.LocalPlayer

local DragonFolder = RS:WaitForChild("Dragon")
local Config = require(DragonFolder:WaitForChild("Config"))
local RigBuilder = require(DragonFolder:WaitForChild("RigBuilder"))
local AnimationData = require(DragonFolder:WaitForChild("AnimationData"))
local Animator = require(DragonFolder:WaitForChild("Animator"))
local VFX = require(DragonFolder:WaitForChild("VFX"))
local Abilities = require(DragonFolder:WaitForChild("Abilities"))
local UI = require(DragonFolder:WaitForChild("UI"))
local Remotes = require(DragonFolder:WaitForChild("Remotes"))

local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles

---------------------------------------------------------------------
-- الحالة
---------------------------------------------------------------------
local ui = UI.new(player):AutoUpdate()
local rig, animator, abilities = nil, nil, nil
local flying = false
local sprinting = false
local flight = { Velocity = nil, Gyro = nil, BaseY = 0 }
local keysDown = {}

-- تعريفات مسبقة (عشان دوال الإدخال تشوفها)
local applySpeed, toggleFlight, startFlight, stopFlight

ui:SetVisible(false)

---------------------------------------------------------------------
-- إدخال الكيبورد
---------------------------------------------------------------------
UIS.InputBegan:Connect(function(input, processed)
	if processed then return end
	keysDown[input.KeyCode] = true
	if not rig then return end

	if input.KeyCode == Config.Abilities.Z.KeyCode then abilities:Cast("Z")
	elseif input.KeyCode == Config.Abilities.X.KeyCode then abilities:Cast("X")
	elseif input.KeyCode == Config.Abilities.C.KeyCode then abilities:Cast("C")
	elseif input.KeyCode == Config.Abilities.V.KeyCode then abilities:Cast("V")
	elseif Config.Extras.RoarKey and input.KeyCode == Config.Extras.RoarKey then abilities:Roar()
	elseif Config.Extras.EnableFlight and input.KeyCode == Enum.KeyCode.F then toggleFlight()
	elseif Config.Extras.EnableMorphToggle and input.KeyCode == Enum.KeyCode.G then
		local ev = Remotes.Get("Morph")
		if ev then ev:FireServer(nil) end
	elseif Config.Extras.EnableSprint and input.KeyCode == Enum.KeyCode.LeftShift then
		sprinting = true
		applySpeed()
	end
end)

UIS.InputEnded:Connect(function(input)
	keysDown[input.KeyCode] = nil
	if input.KeyCode == Enum.KeyCode.LeftShift then
		sprinting = false
		applySpeed()
	end
end)

---------------------------------------------------------------------
-- السرعة
---------------------------------------------------------------------
applySpeed = function()
	if not rig or not rig.Humanoid then return end
	if flying then return end
	local base = Config.Dragon.WalkSpeed
	if sprinting then base = Config.Dragon.SprintSpeed end
	if abilities and abilities:IsAwakened() then
		base = base * (Config.Abilities.V.Awakening.SpeedMultiplier or 1)
	end
	rig.Humanoid.WalkSpeed = base
end

---------------------------------------------------------------------
-- الطيران
---------------------------------------------------------------------
local function moveInputVector()
	local f = (keysDown[Enum.KeyCode.W] and 1 or 0) - (keysDown[Enum.KeyCode.S] and 1 or 0)
	local r = (keysDown[Enum.KeyCode.D] and 1 or 0) - (keysDown[Enum.KeyCode.A] and 1 or 0)
	local up = (keysDown[Enum.KeyCode.Space] and 1 or 0) - (keysDown[Enum.KeyCode.LeftControl] and 1 or 0)
	return Vector2.new(r, -f), up
end

toggleFlight = function()
	if not rig or not rig.Root then return end
	if flying then stopFlight() else startFlight() end
end

startFlight = function()
	if flying then return end
	flying = true
	if abilities then abilities:SetFlying(true) end
	local root = rig.Root
	flight.BaseY = root.Position.Y

	rig.Humanoid.PlatformStand = true
	animator:Play("Takeoff", { Fade = 0.2 })
	task.delay(0.85, function()
		if flying then animator:Play("Fly", { Fade = 0.35 }) end
	end)

	local bv = Instance.new("BodyVelocity")
	bv.MaxForce = V3(1, 1, 1) * 900000
	bv.Velocity = V3(0, 0, 0)
	bv.Parent = root

	local bg = Instance.new("BodyGyro")
	bg.MaxTorque = V3(0, 900000, 0)
	bg.P = 9000
	bg.D = 500
	bg.CFrame = root.CFrame
	bg.Parent = root

	flight.Velocity = bv
	flight.Gyro = bg

	VFX.Shake(0.35, 0.4)
	VFX.Burst(root.CFrame, {
		Colors = { Config.VFX.FireColorA, Config.VFX.FireColorB }, Size0 = 4, Size1 = 12,
		Life0 = 0.4, Life1 = 1.1, Speed0 = 20, Speed1 = 55, Spread = 70, Count = 40,
	})
end

stopFlight = function()
	if not flying then return end
	flying = false
	if abilities then abilities:SetFlying(false) end
	if flight.Velocity then flight.Velocity:Destroy(); flight.Velocity = nil end
	if flight.Gyro then flight.Gyro:Destroy(); flight.Gyro = nil end
	if rig and rig.Humanoid then
		rig.Humanoid.PlatformStand = false
		rig.Root.AssemblyLinearVelocity = V3(0, 0, 0)
	end
	animator:Play("Land", { Fade = 0.25 })
	task.delay(0.75, function()
		if not flying and animator then animator:Play("Idle", { Fade = 0.4 }) end
	end)
	VFX.Shake(0.5, 0.4)
	applySpeed()
end

---------------------------------------------------------------------
-- حلقة التحديث: الحركة + الطيران + حالة الأنيميشن
---------------------------------------------------------------------
local dustT = 0

RunService.RenderStepped:Connect(function(dt)
	if not rig or not rig.Root or not rig.Root.Parent then return end
	if abilities then abilities:Update(dt) end

	---------------------------------------------------------------
	-- الطيران
	---------------------------------------------------------------
	if flying and flight.Velocity then
		local mv, up = moveInputVector()
		local cam = workspace.CurrentCamera
		local dir = V3(0, 0, 0)
		if mv.Magnitude > 0.05 and cam then
			dir = cam.CFrame.RightVector * mv.X + cam.CFrame.LookVector * (-mv.Y)
			if dir.Magnitude > 0.01 then dir = dir.Unit end
		end
		local speed = sprinting and Config.Dragon.SprintFlySpeed or Config.Dragon.FlySpeed
		if abilities and abilities:IsAwakened() then
			speed = speed * (Config.Abilities.V.Awakening.SpeedMultiplier or 1)
		end

		local y = 0
		local rootY = rig.Root.Position.Y
		if up > 0 and rootY < flight.BaseY + Config.Dragon.FlyMaxHeight then
			y = speed * 0.75
		elseif up < 0 and rootY > 3 then
			y = -speed * 0.7
		elseif rootY < flight.BaseY + 12 then
			y = speed * 0.12          -- يفضل طاير لوحده شوية
		end
		flight.Velocity.Velocity = dir * speed + V3(0, y, 0)

		-- اتجاه الجسم ناحية الحركة
		if dir.Magnitude > 0.05 then
			flight.Gyro.CFrame = CFrame.lookAt(rig.Root.Position, rig.Root.Position + dir)
		end

		-- أثر ريح
		dustT = dustT - dt
		if dustT <= 0 and dir.Magnitude > 0.1 then
			dustT = 0.12
			VFX.Burst(rig.Root.CFrame * CF(0, -2, 4), {
				Colors = { Color3.fromRGB(255, 220, 190), Config.VFX.FireColorB },
				Size0 = 1.5, Size1 = 4, Life0 = 0.2, Life1 = 0.6,
				Speed0 = 10, Speed1 = 30, Spread = 40, Count = 5,
			})
		end
		return
	end

	---------------------------------------------------------------
	-- على الأرض: حالة الأنيميشن
	---------------------------------------------------------------
	local hum = rig.Humanoid
	if not hum then return end
	local speed = V3(hum.MoveDirection.X, 0, hum.MoveDirection.Z).Magnitude

	-- المهارات بتاخد الأولوية (الأنيميشن نفسه بيوقفها)
	if abilities and abilities.Busy then return end

	if speed > 0.6 then
		local want = (sprinting or hum.WalkSpeed > Config.Dragon.WalkSpeed + 4) and "Run" or "Walk"
		if not animator:IsPlaying(want) then
			animator:Stop("Idle"); animator:Stop("Walk"); animator:Stop("Run")
			animator:Play(want, { Fade = 0.22 })
		end
	else
		if not animator:IsPlaying("Idle") then
			animator:Stop("Walk"); animator:Stop("Run")
			animator:Play("Idle", { Fade = 0.35 })
		end
	end
end)

---------------------------------------------------------------------
-- إعداد التنين بعد التحوّل
---------------------------------------------------------------------
local function setupDragon(model)
	if not model then return end
	rig = RigBuilder.Wrap(model)
	animator = Animator.new(rig)
	animator:LoadClips(AnimationData.Build(rig.Scale))
	animator:Play("Idle", { Fade = 0.3 })
	animator:Play("Transform", { Fade = 0.05 })
	animator:AutoUpdate()

	abilities = Abilities.new({ Rig = rig, Animator = animator, UI = ui })

	-- أزرار الموبايل
	for key, btn in pairs(ui.Buttons) do
		btn.MouseButton1Click:Connect(function()
			if abilities then abilities:Cast(key) end
		end)
	end

	-- الكاميرا
	player.CameraMinZoomDistance = 18
	player.CameraMaxZoomDistance = 120
	if rig.Humanoid then
		rig.Humanoid.CameraOffset = V3(0, 4, 0)
		rig.Humanoid.WalkSpeed = Config.Dragon.WalkSpeed
		rig.Humanoid.JumpPower = Config.Dragon.JumpPower
	end

	ui:SetVisible(true)
	VFX.Flash(Config.VFX.FireColorA, 0.8, 0.3)
end

local function clearDragon()
	if animator then animator:Destroy() end
	rig, animator, abilities = nil, nil, nil
	flying = false
	flight.Velocity, flight.Gyro = nil, nil
	ui:SetVisible(false)
end

---------------------------------------------------------------------
-- الشبكة
---------------------------------------------------------------------
local morphedEv = Remotes.Get("Morphed")
if morphedEv then
	morphedEv.OnClientEvent:Connect(function(state, model)
		if state == "Dragon" then
			clearDragon()
			task.wait(0.05)
			setupDragon(model or player.Character)
		else
			clearDragon()
			player.CameraMinZoomDistance = 0.5
			player.CameraMaxZoomDistance = 400
		end
	end)
end

local cdEv = Remotes.Get("Cooldown")
if cdEv then
	cdEv.OnClientEvent:Connect(function(key, duration)
		ui:SetCooldown(key, duration or 0)
	end)
end

local dmgEv = Remotes.Get("Damage")
if dmgEv then
	dmgEv.OnClientEvent:Connect(function(pos, amount, crit)
		VFX.DamageNumber(pos, amount, crit)
	end)
end

local hitEv = Remotes.Get("Hit")
if hitEv then
	hitEv.OnClientEvent:Connect(function(kind, character, duration)
		if kind == "Burn" then
			VFX.BurnTarget(character, duration or 3)
		elseif kind == "Stun" then
			VFX.StunStars(character, duration or 1)
		end
	end)
end

Abilities.InitRemoteListener()

---------------------------------------------------------------------
-- لو اللاعب داخل وهو تنين بالفعل (ريسباون/ريجوين)
---------------------------------------------------------------------
task.spawn(function()
	local morphed = Remotes.Get("Morphed")
	task.wait(2)
	local char = player.Character
	if char and char:GetAttribute("IsDragon") then
		setupDragon(char)
	end
end)

print("[DragonClient] جاهز — Z X C V جرّبهم 🔥")

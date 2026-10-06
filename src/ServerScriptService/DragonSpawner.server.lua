--[[
	====================================================================
	DragonSpawner.server.lua — الساحة + تحويل اللاعبين + دمى التجربة
	====================================================================
	• يبني ساحة قتال (أرضية + أعمدة + إضاءة سينمائية)
	• يحول اللاعب لتنين أول ما يدخل (لو AutoMorphOnSpawn = true)
	• يولّد دمى تجربة تتجدد أوتوماتيك
]]

local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")

local DragonFolder = RS:WaitForChild("Dragon")
local Config = require(DragonFolder:WaitForChild("Config"))
local Remotes = require(DragonFolder:WaitForChild("Remotes"))
local DragonState = require(DragonFolder:WaitForChild("DragonState"))
local Morph = require(script.Parent:WaitForChild("DragonMorph"))

local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles

Remotes.Init()

---------------------------------------------------------------------
-- ١) الإضاءة السينمائية
---------------------------------------------------------------------
local function setupLighting()
	Lighting:SetAttribute("OriginalBrightness", Lighting.Brightness)

	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		local at = Instance.new("Atmosphere")
		at.Density = 0.32
		at.Offset = 0.22
		at.Color = Color3.fromRGB(198, 140, 96)
		at.Decay = Color3.fromRGB(120, 82, 60)
		at.Glare = 0.3
		at.Haze = 1.1
		at.Parent = Lighting
	end

	if not Lighting:FindFirstChildOfClass("BloomEffect") then
		local bloom = Instance.new("BloomEffect")
		bloom.Intensity = 1.15
		bloom.Size = 26
		bloom.Threshold = 0.82
		bloom.Parent = Lighting
	end

	if not Lighting:FindFirstChildOfClass("SunRaysEffect") then
		local sun = Instance.new("SunRaysEffect")
		sun.Intensity = 0.22
		sun.Spread = 0.5
		sun.Parent = Lighting
	end

	if not Lighting:FindFirstChildOfClass("ColorCorrectionEffect") then
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Saturation = 0.12
		cc.Contrast = 0.1
		cc.TintColor = Color3.fromRGB(255, 238, 224)
		cc.Parent = Lighting
	end

	Lighting.ClockTime = 17.6
	Lighting.GeographicLatitude = 12
	Lighting.FogEnd = 900
	Lighting.FogColor = Color3.fromRGB(96, 58, 44)
	Lighting.EnvironmentDiffuseScale = 0.7
	Lighting.EnvironmentSpecularScale = 0.8
end

---------------------------------------------------------------------
-- ٢) الساحة
---------------------------------------------------------------------
local ARENA = 260

local function buildArena()
	local arena = Instance.new("Folder")
	arena.Name = "DragonArena"
	arena.Parent = workspace

	-- أرضية
	local floor = Instance.new("Part")
	floor.Name = "ArenaFloor"
	floor.Size = V3(ARENA * 2, 8, ARENA * 2)
	floor.CFrame = CF(0, -4, 0)
	floor.Material = Enum.Material.Slate
	floor.Color = Color3.fromRGB(54, 40, 36)
	floor.Anchored = true
	floor.TopSurface = Enum.SurfaceType.Smooth
	floor.Parent = arena

	-- دوائر مركزية (نيون)
	for i = 1, 3 do
		local ring = Instance.new("Part")
		ring.Name = "Ring" .. i
		ring.Size = V3(30 + i * 26, 0.3, 30 + i * 26)
		ring.CFrame = CF(0, 0.15, 0)
		ring.Shape = Enum.PartType.Cylinder
		ring.Material = Enum.Material.Neon
		ring.Color = Color3.fromRGB(255, 120 - i * 20, 30)
		ring.Transparency = 0.75
		ring.Anchored = true
		ring.Parent = arena
	end

	-- أعمدة حجرية حوالين الساحة
	for i = 1, 14 do
		local ang = (i / 14) * math.pi * 2
		local dist = ARENA * 0.62
		local h = 40 + math.random() * 60
		local p = Instance.new("Part")
		p.Name = "Pillar" .. i
		p.Size = V3(14, h, 14)
		p.CFrame = CF(math.cos(ang) * dist, h / 2, math.sin(ang) * dist) * ANG(0, math.rad(math.random(0, 360)), 0)
		p.Material = Enum.Material.Marble
		p.Color = Color3.fromRGB(64, 48, 44)
		p.Anchored = true
		p.Parent = arena

		-- قمة متوهجة
		local cap = Instance.new("Part")
		cap.Size = V3(16, 2, 16)
		cap.CFrame = p.CFrame * CF(0, h / 2 + 1.2, 0)
		cap.Material = Enum.Material.Neon
		cap.Color = Color3.fromRGB(255, 110, 30)
		cap.Transparency = 0.35
		cap.Anchored = true
		cap.Parent = arena

		local light = Instance.new("PointLight")
		light.Color = Color3.fromRGB(255, 130, 40)
		light.Range = 70
		light.Brightness = 2
		light.Parent = cap
	end

	-- منصة وسطية للزعماء
	local pad = Instance.new("Part")
	pad.Name = "CenterPad"
	pad.Size = V3(70, 2, 70)
	pad.CFrame = CF(0, 1, 0)
	pad.Material = Enum.Material.Metal
	pad.Color = Color3.fromRGB(70, 52, 44)
	pad.Anchored = true
	pad.Parent = arena

	return arena
end

---------------------------------------------------------------------
-- ٣) دمى التجربة
---------------------------------------------------------------------
local function makeDummy(pos, name)
	local m = Instance.new("Model")
	m.Name = name or "TrainingDummy"

	local hum = Instance.new("Humanoid")
	hum.MaxHealth = 4000
	hum.Health = 4000
	hum.WalkSpeed = 0
	hum.Parent = m

	local function part(pname, size, color, material)
		local p = Instance.new("Part")
		p.Name = pname
		p.Size = size
		p.Color = color
		p.Material = material or Enum.Material.SmoothPlastic
		p.CanCollide = true
		p.Anchored = false
		p.Massless = (pname ~= "HumanoidRootPart")
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.Parent = m
		return p
	end

	local skin = Color3.fromRGB(196, 156, 118)
	local cloth = Color3.fromRGB(90, 40, 40)

	local root = part("HumanoidRootPart", V3(2, 2, 1), skin); root.Transparency = 1; root.CanCollide = false
	local torso = part("Torso", V3(2, 2, 1), cloth)
	local head = part("Head", V3(1.25, 1, 1), skin)
	local la = part("Left Arm", V3(1, 2, 1), skin)
	local ra = part("Right Arm", V3(1, 2, 1), skin)
	local ll = part("Left Leg", V3(1, 2, 1), cloth)
	local rl = part("Right Leg", V3(1, 2, 1), cloth)

	-- ترتيب
	local base = CF(pos)
	root.CFrame = base
	torso.CFrame = base
	head.CFrame = base * CF(0, 1.5, 0)
	la.CFrame = base * CF(-1.5, 0, 0)
	ra.CFrame = base * CF(1.5, 0, 0)
	ll.CFrame = base * CF(-0.5, -2, 0)
	rl.CFrame = base * CF(0.5, -2, 0)

	local function motor(p0, p1, c0offset)
		local mt = Instance.new("Motor6D")
		mt.Part0 = p0
		mt.Part1 = p1
		mt.C0 = CF(c0offset)
		mt.Parent = p0
	end
	motor(root, torso, V3(0, 0, 0))
	motor(torso, head, V3(0, 1.5, 0))
	motor(torso, la, V3(-1.5, 0.5, 0))
	motor(torso, ra, V3(1.5, 0.5, 0))
	motor(torso, ll, V3(-0.5, -1.5, 0))
	motor(torso, rl, V3(0.5, -1.5, 0))

	-- اسم فوق الدمية
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 160, 0, 44)
	bb.StudsOffset = V3(0, 3.4, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = head
	bb.Parent = head
	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.new(1, 0, 1, 0)
	lbl.BackgroundTransparency = 1
	lbl.Text = m.Name
	lbl.TextScaled = true
	lbl.Font = Enum.Font.GothamBold
	lbl.TextColor3 = Color3.fromRGB(255, 200, 140)
	lbl.TextStrokeTransparency = 0.3
	lbl.Parent = bb

	m.PrimaryPart = root
	m.Parent = workspace
	return m, hum
end

local function spawnDummies(count)
	local dummies = Instance.new("Folder")
	dummies.Name = "TrainingDummies"
	dummies.Parent = workspace

	for i = 1, count do
		local ang = (i / count) * math.pi * 2
		local dist = 42
		local pos = V3(math.cos(ang) * dist, 6, math.sin(ang) * dist)
		local m, hum = makeDummy(pos, "هدف تجربة " .. i)
		m.Parent = dummies
		hum.Died:Connect(function()
			task.wait(4)
			local newPos = V3(math.cos(math.random() * math.pi * 2) * 42, 6, math.sin(math.random() * math.pi * 2) * 42)
			local nm, nh = makeDummy(newPos, m.Name)
			nm.Parent = dummies
			nh.Died:Connect(function() nm:Destroy() end)
		end)
	end
end

---------------------------------------------------------------------
-- ٤) اللاعبون
---------------------------------------------------------------------
local function onPlayerAdded(player)
	local function onCharacter(char)
		char:WaitForChild("HumanoidRootPart", 10)
		task.wait(1.2)
		if not Config.Extras.AutoMorphOnSpawn then return end
		-- لو فيه تنين قديم (مات/اتمسح) نظّفه الأول
		local old = DragonState.Rigs[player]
		if old then
			DragonState.Rigs[player] = nil
			if old.Model and old.Model.Parent then old.Model:Destroy() end
		end
		Morph.ToDragon(player)
	end

	if player.Character then task.spawn(onCharacter, player.Character) end
	player.CharacterAdded:Connect(onCharacter)
end

---------------------------------------------------------------------
-- التشغيل
---------------------------------------------------------------------
setupLighting()
if Config.Extras.BuildArena then buildArena() end
if Config.Extras.SpawnTestDummies then spawnDummies(6) end

for _, p in ipairs(Players:GetPlayers()) do task.spawn(onPlayerAdded, p) end
Players.PlayerAdded:Connect(onPlayerAdded)

print("[DragonSpawner] الساحة جاهزة — التنين بانتظارك 🐉")

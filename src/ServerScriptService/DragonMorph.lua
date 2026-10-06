--[[
	====================================================================
	DragonMorph.lua — تحويل اللاعب ⇄ تنين (سيرفر)
	====================================================================
	player.Character = نموذج التنين  →  أدوات التحكم الافتراضية بتشتغل عليه
	والشخصية الأصلية بتتخبّي تحت الخريطة لحد ما يرجع إنسان.
]]

local Morph = {}

local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local DragonFolder = RS:WaitForChild("Dragon")
local Config = require(DragonFolder:WaitForChild("Config"))
local RigBuilder = require(DragonFolder:WaitForChild("RigBuilder"))
local Remotes = require(DragonFolder:WaitForChild("Remotes"))
local DragonState = require(DragonFolder:WaitForChild("DragonState"))

local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles

---------------------------------------------------------------------
-- إخفاء / إظهار الشخصية الأصلية
---------------------------------------------------------------------
function Morph.HideHuman(character)
	if not character then return end
	local root = character:FindFirstChild("HumanoidRootPart")
	if root then
		root.Anchored = true
		root.CanCollide = false
	end
	local hum = character:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.PlatformStand = true
		hum.WalkSpeed = 0
		hum.JumpPower = 0
	end
	pcall(function() character:PivotTo(CF(0, -900, 0)) end)
end

function Morph.ShowHuman(character, cf)
	if not character then return end
	local root = character:FindFirstChild("HumanoidRootPart")
	if root then
		root.Anchored = false
		root.CanCollide = false
		root.AssemblyLinearVelocity = V3(0, 0, 0)
	end
	local hum = character:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.PlatformStand = false
		hum.WalkSpeed = 16
		hum.JumpPower = 50
		hum.Health = hum.MaxHealth
	end
	pcall(function() character:PivotTo(cf or CF(0, 12, 0)) end)
end

---------------------------------------------------------------------
-- بناء تنين (من غير تحويل)
---------------------------------------------------------------------
function Morph.Build(player, cf)
	if not cf then
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		local base = root and root.CFrame or CF(0, 15, 0)
		cf = CF(base.X, base.Y + 4, base.Z) * ANG(0, math.atan2(-base.LookVector.X, -base.LookVector.Z), 0)
	end
	local rig = RigBuilder.Build({ CFrame = cf, Scale = Config.Dragon.Scale })
	rig.Model.Parent = workspace
	return rig
end

---------------------------------------------------------------------
-- تحويل لتنين
---------------------------------------------------------------------
function Morph.ToDragon(player, silent)
	if DragonState.IsMorphed(player) then return false end
	local char = player.Character
	if not char or not char:FindFirstChild("HumanoidRootPart") then return false end

	local baseCF = char:GetPivot()
	DragonState.HumanForms[player] = char

	local rig = Morph.Build(player, nil)
	DragonState.Rigs[player] = rig

	-- ملكية الشبكة (عشان الطيران يبقى سلس)
	pcall(function()
		rig.Root:SetNetworkOwner(player)
		for _, part in ipairs(rig.Model:GetDescendants()) do
			if part:IsA("BasePart") and part ~= rig.Root then part:SetNetworkOwner(player) end
		end
	end)

	Morph.HideHuman(char)
	player.Character = rig.Model

	-- تأثير التحوّل للكل
	if not silent then
		local vfx = Remotes.Get("VFX")
		if vfx then vfx:FireAllClients("Transform", rig.Root.CFrame, { Up = true }) end
	end
	local ev = Remotes.Get("Morphed")
	if ev then ev:FireClient(player, "Dragon", rig.Model) end

	-- لو التنين مات .. رجّع إنسان
	local hum = rig.Humanoid
	if hum then
		hum.Died:Connect(function()
			task.wait(3)
			if DragonState.Rigs[player] == rig then
				Morph.ToHuman(player)
			end
		end)
	end

	return true
end

---------------------------------------------------------------------
-- رجوع إنسان
---------------------------------------------------------------------
function Morph.ToHuman(player, silent)
	local rig = DragonState.Rigs[player]
	if not rig then return false end

	local cf = rig.Root.CFrame
	local char = DragonState.HumanForms[player]

	DragonState.Rigs[player] = nil
	DragonState.HumanForms[player] = nil

	if not silent then
		local vfx = Remotes.Get("VFX")
		if vfx then vfx:FireAllClients("Transform", cf, { Up = false }) end
	end

	if char and char.Parent then
		Morph.ShowHuman(char, CF(cf.X, cf.Y + 8, cf.Z))
		-- لو اللاعب عمل ريسباون لوحده بpersonality جديدة .. متستبدلهاش
		if player.Character == rig.Model or player.Character == nil then
			player.Character = char
		end
	else
		-- مفيش شخصية أصلية: خليه يعمل ريسباون
		player:LoadCharacter()
	end

	task.delay(0.2, function()
		if rig and rig.Model then rig.Model:Destroy() end
	end)

	local ev = Remotes.Get("Morphed")
	if ev then ev:FireClient(player, "Human", nil) end
	return true
end

function Morph.Toggle(player)
	if DragonState.IsMorphed(player) then
		return Morph.ToHuman(player)
	else
		return Morph.ToDragon(player)
	end
end

---------------------------------------------------------------------
-- تنظيف عند الخروج
---------------------------------------------------------------------
Players.PlayerRemoving:Connect(function(player)
	local rig = DragonState.Rigs[player]
	if rig then rig.Model:Destroy() end
	DragonState.Cleanup(player)
end)

return Morph

--[[
	====================================================================
	UI.lua — شريط المهارات Z X C V مع كول داون (مبني بالكود)
	====================================================================
	مفيش أي ملف واجهة .. كله Instance.new()
]]

local UI = {}
UI.__index = UI

local Config = require(script.Parent.Config)
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local U = Config.UI

---------------------------------------------------------------------
function UI.new(player, parent)
	local self = setmetatable({}, UI)
	self.Player = player
	self.Slots = {}
	self.Cooldowns = {}
	self.Visible = true

	local gui = Instance.new("ScreenGui")
	gui.Name = "DragonAbilityBar"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.DisplayOrder = 50
	gui.Parent = parent or player:WaitForChild("PlayerGui")
	self.Gui = gui

	-----------------------------------------------------------------
	-- الحاوية
	-----------------------------------------------------------------
	local totalW = (#Config.AbilityOrder * U.SlotSize) + ((#Config.AbilityOrder - 1) * U.SlotGap)
	local holder = Instance.new("Frame")
	holder.Name = "Holder"
	holder.Size = UDim2.new(0, totalW, 0, U.SlotSize + 30)
	holder.Position = U.BarPosition
	holder.AnchorPoint = Vector2.new(0.5, 0.5)
	holder.BackgroundTransparency = 1
	holder.Parent = gui
	self.Holder = holder

	-----------------------------------------------------------------
	-- بناء خانة لكل زر
	-----------------------------------------------------------------
	for i, key in ipairs(Config.AbilityOrder) do
		local ab = Config.Abilities[key]
		local x = (i - 1) * (U.SlotSize + U.SlotGap)

		local slot = Instance.new("Frame")
		slot.Name = "Slot_" .. key
		slot.Size = UDim2.new(0, U.SlotSize, 0, U.SlotSize)
		slot.Position = UDim2.new(0, x, 0, 0)
		slot.BackgroundColor3 = Color3.fromRGB(14, 12, 16)
		slot.BackgroundTransparency = 0.25
		slot.BorderSizePixel = 0
		slot.Parent = holder

		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 14)
		corner.Parent = slot

		local stroke = Instance.new("UIStroke")
		stroke.Color = U.ReadyColor
		stroke.Thickness = 2
		stroke.Transparency = 0.25
		stroke.Parent = slot

		local grad = Instance.new("UIGradient")
		grad.Color = ColorSequence.new(
			Color3.fromRGB(58, 26, 20),
			Color3.fromRGB(18, 14, 18)
		)
		grad.Rotation = 90
		grad.Parent = slot

		-- أيقونة (إيموجي)
		local icon = Instance.new("TextLabel")
		icon.Name = "Icon"
		icon.Size = UDim2.new(1, 0, 0.62, 0)
		icon.Position = UDim2.new(0, 0, 0.02, 0)
		icon.BackgroundTransparency = 1
		icon.Text = ab.Icon or "✦"
		icon.TextScaled = true
		icon.Font = Enum.Font.GothamBold
		icon.TextColor3 = Color3.fromRGB(255, 245, 230)
		icon.Parent = slot

		-- حرف الزر
		local keyLabel = Instance.new("TextLabel")
		keyLabel.Name = "Key"
		keyLabel.Size = UDim2.new(0, 26, 0, 24)
		keyLabel.Position = UDim2.new(0, 4, 1, -26)
		keyLabel.BackgroundTransparency = 1
		keyLabel.Text = key
		keyLabel.TextScaled = true
		keyLabel.Font = Enum.Font.GothamBlack
		keyLabel.TextColor3 = U.ReadyColor
		keyLabel.Parent = slot

		-- اسم المهارة
		local name = Instance.new("TextLabel")
		name.Name = "Name"
		name.Size = UDim2.new(0, U.SlotSize + 20, 0, 20)
		name.Position = UDim2.new(0.5, 0, 1, 4)
		name.AnchorPoint = Vector2.new(0.5, 0)
		name.BackgroundTransparency = 1
		name.Text = ab.Name or ""
		name.TextScaled = true
		name.Font = Enum.Font.GothamBold
		name.TextColor3 = Color3.fromRGB(255, 214, 170)
		name.Parent = slot

		-- طبقة الكول داون (بتصغر من تحت)
		local cd = Instance.new("Frame")
		cd.Name = "Cooldown"
		cd.Size = UDim2.new(1, 0, 0, 0)
		cd.Position = UDim2.new(0, 0, 1, 0)
		cd.AnchorPoint = Vector2.new(0, 1)
		cd.BackgroundColor3 = U.CooldownColor
		cd.BackgroundTransparency = 0.35
		cd.BorderSizePixel = 0
		cd.ZIndex = 3
		cd.Parent = slot
		local cdCorner = Instance.new("UICorner")
		cdCorner.CornerRadius = UDim.new(0, 14)
		cdCorner.Parent = cd

		-- رقم العدّاد
		local cdText = Instance.new("TextLabel")
		cdText.Name = "Time"
		cdText.Size = UDim2.new(1, 0, 1, 0)
		cdText.BackgroundTransparency = 1
		cdText.Text = ""
		cdText.TextScaled = true
		cdText.Font = Enum.Font.GothamBlack
		cdText.TextColor3 = Color3.fromRGB(255, 255, 255)
		cdText.TextStrokeTransparency = 0.4
		cdText.ZIndex = 4
		cdText.Parent = slot

		-- وميض وقت التنفيذ
		local flash = Instance.new("Frame")
		flash.Name = "Flash"
		flash.Size = UDim2.new(1, 0, 1, 0)
		flash.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
		flash.BackgroundTransparency = 1
		flash.BorderSizePixel = 0
		flash.ZIndex = 6
		flash.Parent = slot
		local fCorner = Instance.new("UICorner")
		fCorner.CornerRadius = UDim.new(0, 14)
		fCorner.Parent = flash

		self.Slots[key] = {
			Frame = slot, Stroke = stroke, Icon = icon, CD = cd,
			Time = cdText, Flash = flash, Name = name,
		}
		self.Cooldowns[key] = 0
	end

	-----------------------------------------------------------------
	-- أزرار الموبايل
	-----------------------------------------------------------------
	self.Buttons = {}
	if U.MobileButtons and UserInputService.TouchEnabled then
		local pad = Instance.new("Frame")
		pad.Name = "MobilePad"
		pad.Size = UDim2.new(0, 250, 0, 250)
		pad.Position = UDim2.new(1, -20, 1, -20)
		pad.AnchorPoint = Vector2.new(1, 1)
		pad.BackgroundTransparency = 1
		pad.Parent = gui

		local ang = { math.rad(200), math.rad(250), math.rad(290), math.rad(340) }
		for i, key in ipairs(Config.AbilityOrder) do
			local btn = Instance.new("TextButton")
			btn.Name = "Btn_" .. key
			btn.Size = UDim2.new(0, 78, 0, 78)
			btn.Position = UDim2.new(0.5, math.cos(ang[i]) * 85 - 39, 0.5, math.sin(ang[i]) * 85 - 39)
			btn.BackgroundColor3 = Color3.fromRGB(30, 16, 12)
			btn.BackgroundTransparency = 0.25
			btn.Text = Config.Abilities[key].Icon .. "\n" .. key
			btn.TextColor3 = Color3.fromRGB(255, 220, 180)
			btn.TextScaled = true
			btn.Font = Enum.Font.GothamBold
			btn.Parent = pad
			local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, 39); c.Parent = btn
			local s = Instance.new("UIStroke"); s.Color = U.ReadyColor; s.Thickness = 2; s.Parent = btn
			self.Buttons[key] = btn
		end
	end

	return self
end

---------------------------------------------------------------------
-- الكول داون
---------------------------------------------------------------------
function UI:SetCooldown(key, duration)
	self.Cooldowns[key] = math.max(self.Cooldowns[key] or 0, duration or 0)
	local slot = self.Slots[key]
	if slot then
		slot.CD.Size = UDim2.new(1, 0, 1, 0)
		slot.Stroke.Color = Color3.fromRGB(120, 120, 130)
		slot.Stroke.Transparency = 0.6
	end
end

function UI:Trigger(key)
	local slot = self.Slots[key]
	if not slot then return end
	slot.Flash.BackgroundTransparency = 0.2
	TweenService:Create(slot.Flash, TweenInfo.new(0.35), { BackgroundTransparency = 1 }):Play()
	local icon = slot.Icon
	TweenService:Create(icon, TweenInfo.new(0.12), { Size = UDim2.new(1, 0, 0.78, 0) }):Play()
	task.delay(0.12, function()
		TweenService:Create(icon, TweenInfo.new(0.3, Enum.EasingStyle.Elastic),
			{ Size = UDim2.new(1, 0, 0.62, 0) }):Play()
	end)
end

function UI:Denied(key)
	local slot = self.Slots[key]
	if not slot then return end
	slot.Flash.BackgroundColor3 = Color3.fromRGB(255, 60, 60)
	slot.Flash.BackgroundTransparency = 0.35
	TweenService:Create(slot.Flash, TweenInfo.new(0.3), { BackgroundTransparency = 1 }):Play()
	task.delay(0.35, function() slot.Flash.BackgroundColor3 = Color3.fromRGB(255, 255, 255) end)
end

function UI:Update(dt)
	for key, t in pairs(self.Cooldowns) do
		if t > 0 then
			local nt = math.max(0, t - dt)
			self.Cooldowns[key] = nt
			local slot = self.Slots[key]
			if slot then
				local total = (Config.Abilities[key] and Config.Abilities[key].Cooldown) or 1
				local f = nt / total
				slot.CD.Size = UDim2.new(1, 0, f, 0)
				slot.Time.Text = (nt >= 1) and string.format("%.0f", nt) or string.format("%.1f", nt)
				if nt <= 0 then
					slot.Time.Text = ""
					slot.Stroke.Color = U.ReadyColor
					slot.Stroke.Transparency = 0.25
					-- وميض الاستعداد
					TweenService:Create(slot.Stroke, TweenInfo.new(0.35), { Thickness = 4 }):Play()
					task.delay(0.35, function()
						TweenService:Create(slot.Stroke, TweenInfo.new(0.35), { Thickness = 2 }):Play()
					end)
				end
			end
		end
	end
end

function UI:AutoUpdate()
	self._conn = RunService.RenderStepped:Connect(function(dt) self:Update(dt) end)
	return self
end

function UI:SetVisible(state)
	self.Visible = state
	self.Gui.Enabled = state
end

function UI:Destroy()
	if self._conn then self._conn:Disconnect() end
	if self.Gui then self.Gui:Destroy() end
end

return UI

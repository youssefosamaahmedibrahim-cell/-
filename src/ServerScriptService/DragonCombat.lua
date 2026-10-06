--[[
	====================================================================
	DragonCombat.lua — نظام الضرر (سيرفر فقط)
	====================================================================
	• كشف الأهداف داخل صندوق / كرة
	• ضرر + طرد (Knockback) + حرق (Burn) + صعق (Stun)
	• أرقام ضرر للاعب صاحب المهارة
]]

local Combat = {}

local RS = game:GetService("ReplicatedStorage")
local DragonFolder = RS:WaitForChild("Dragon")
local Config = require(DragonFolder:WaitForChild("Config"))
local Remotes = require(DragonFolder:WaitForChild("Remotes"))
local DragonState = require(DragonFolder:WaitForChild("DragonState"))

local RunService = game:GetService("RunService")

local V3 = Vector3.new

---------------------------------------------------------------------
-- أدوات
---------------------------------------------------------------------
local function newParams(exclude)
	local p = OverlapParams.new()
	p.FilterType = Enum.RaycastFilterType.Exclude
	p.FilterDescendantsInstances = exclude or {}
	p.MaxParts = 250
	return p
end

local function modelsFrom(parts, excludeModel, out)
	out = out or {}
	for _, part in ipairs(parts) do
		local model = part:FindFirstAncestorOfClass("Model")
		if model and model ~= excludeModel then
			local hum = model:FindFirstChildOfClass("Humanoid")
			if hum and hum.Health > 0 then
				out[model] = hum
			end
		end
	end
	return out
end

---------------------------------------------------------------------
-- كشف الأهداف
---------------------------------------------------------------------
function Combat.InBox(cf, size, exclude)
	local parts = workspace:GetPartBoundsInBox(cf, size, newParams(exclude))
	return modelsFrom(parts, exclude and exclude[1])
end

function Combat.InSphere(center, radius, exclude)
	local parts = workspace:GetPartBoundsInRadius(center, radius, newParams(exclude))
	return modelsFrom(parts, exclude and exclude[1])
end

-- شعاع مخروطي: صناديق متتالية على طول الشعاع (أدق من صندوق واحد)
function Combat.InCone(origin, dir, range, radius, exclude, steps)
	steps = steps or 4
	local out = {}
	for i = 1, steps do
		local f = i / steps
		local center = origin + dir * (range * (f - 0.5 / steps))
		local size = V3(radius * 2 * f, radius * 2 * f, range / steps)
		local cf = CFrame.lookAt(center, center + dir)
		for model, hum in pairs(Combat.InBox(cf, size, exclude)) do
			out[model] = hum
		end
	end
	return out
end

---------------------------------------------------------------------
-- الحالة: حرق / صعق
---------------------------------------------------------------------
function Combat.Burn(character, dps, duration, attacker)
	if not character or dps <= 0 or duration <= 0 then return end
	local existing = DragonState.Burning[character]
	if existing then
		existing.Until = math.max(existing.Until, os.clock() + duration)
		existing.DPS = math.max(existing.DPS, dps)
		existing.Attacker = attacker or existing.Attacker
		return
	end
	DragonState.Burning[character] = {
		Until = os.clock() + duration,
		DPS = dps,
		Attacker = attacker,
		Tick = 0,
	}
	local hit = Remotes.Get("Hit")
	if hit then
		hit:FireAllClients("Burn", character, duration)
	end
end

function Combat.Stun(character, duration)
	if not character or duration <= 0 then return end
	local hum = character:FindFirstChildOfClass("Humanoid")
	if not hum then return end
	local token = (DragonState.StunToken[character] or 0) + 1
	DragonState.StunToken[character] = token
	local ws, jp = hum.WalkSpeed, hum.JumpPower
	hum.WalkSpeed = 0
	hum.JumpPower = 0
	hum.AutoRotate = false
	local hit = Remotes.Get("Hit")
	if hit then hit:FireAllClients("Stun", character, duration) end
	task.delay(duration, function()
		if DragonState.StunToken[character] ~= token then return end
		if hum and hum.Parent then
			hum.WalkSpeed = ws
			hum.JumpPower = jp
			hum.AutoRotate = true
		end
	end)
end

---------------------------------------------------------------------
-- تطبيق الضرر
---------------------------------------------------------------------
--[[
	targets : جدول Model -> Humanoid
	attacker: Player
	amount  : رقم
	opts    : { Knockback = 0, Source = Vector3, Burn = {DPS, Duration},
	            Stun = 0, Crit = false, Multiplier = 1 }
]]
function Combat.Damage(targets, attacker, amount, opts)
	opts = opts or {}
	amount = amount * (opts.Multiplier or 1)
	local source = opts.Source
	local dmgEvent = Remotes.Get("Damage")

	for model, hum in pairs(targets) do
		if hum and hum.Health > 0 then
			hum:TakeDamage(amount)

			-- طرد
			if opts.Knockback and opts.Knockback > 0 then
				local root = model:FindFirstChild("HumanoidRootPart")
				if root then
					local dir
					if source then
						dir = (root.Position - source)
						if dir.Magnitude < 0.01 then dir = V3(math.random() - 0.5, 0, math.random() - 0.5) end
						dir = dir.Unit
					else
						dir = V3(0, 1, 0)
					end
					local power = opts.Knockback
					root.AssemblyLinearVelocity = V3(dir.X * power, math.max(6, power * 0.45), dir.Z * power)
				end
			end

			-- حرق
			if opts.Burn and opts.Burn.DPS and opts.Burn.DPS > 0 then
				Combat.Burn(model, opts.Burn.DPS, opts.Burn.Duration or 3, attacker)
			end

			-- صعق
			if opts.Stun and opts.Stun > 0 then
				Combat.Stun(model, opts.Stun)
			end

			-- رقم الضرر لصاحب المهارة
			if dmgEvent and attacker and attacker.Parent then
				local pos = (model:FindFirstChild("HumanoidRootPart") or model:FindFirstChild("Head"))
				if pos then
					dmgEvent:FireClient(attacker, pos.Position, amount, opts.Crit or false)
				end
			end
		end
	end
end

---------------------------------------------------------------------
-- حلقة الحرق
---------------------------------------------------------------------
local started = false
function Combat.Start()
	if started then return end
	started = true
	RunService.Heartbeat:Connect(function(dt)
		local now = os.clock()
		for character, data in pairs(DragonState.Burning) do
			if now >= data.Until then
				DragonState.Burning[character] = nil
			else
				data.Tick = (data.Tick or 0) + dt
				if data.Tick >= 0.5 then
					local dmg = data.DPS * data.Tick
					data.Tick = 0
					local hum = character:FindFirstChildOfClass("Humanoid")
					if hum and hum.Health > 0 then
						hum:TakeDamage(dmg)
						if data.Attacker and data.Attacker.Parent then
							local ev = Remotes.Get("Damage")
							local pos = character:FindFirstChild("HumanoidRootPart") or character:FindFirstChild("Head")
							if ev and pos then
								ev:FireClient(data.Attacker, pos.Position + V3(math.random(-2, 2), 2, math.random(-2, 2)), dmg, false)
							end
						end
					end
				end
			end
		end
	end)
end

return Combat

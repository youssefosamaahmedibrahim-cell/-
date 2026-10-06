--[[
	====================================================================
	VFX.lua — مكتبة التأثيرات البصرية (نار، نيازك، صواعق، زئير، هالات)
	====================================================================
	كل الفانكشنز دي بتشتغل على الكلينت (السيرفر بيبعت نداء بالـ Remote
	وكل لاعب بيولّد التأثير عنده .. أخف وأسرع).

	مفيش أي أصول خارجية (صور/ميش) — كله من جزيئات وقطع نيون.
]]

local VFX = {}

local Config = require(script.Parent.Config)
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")

local C = Config.VFX
local Q = math.clamp(C.Quality or 3, 1, 4)
local PM = C.ParticleMultiplier[Q] or 1

local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local rad = math.rad

---------------------------------------------------------------------
-- أدوات أساسية
---------------------------------------------------------------------
local folder
local function getFolder()
	if folder and folder.Parent then return folder end
	folder = Instance.new("Folder")
	folder.Name = "DragonVFX"
	folder.Parent = workspace
	return folder
end

local function n(n2) return math.max(1, math.floor((n2 or 1) * PM)) end

local function temp(obj, life)
	Debris:AddItem(obj, life or 3)
	return obj
end

-- قطعة سريعة
local function quickPart(size, cf, color, material, transparency)
	local p = Instance.new("Part")
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.Neon
	p.Transparency = transparency or 0
	p.Anchored = true
	p.CanCollide = false
	p.CastShadow = false
	p.Parent = getFolder()
	return p
end

-- لحام قطعة على أب (تتحرك معاه)
local function weldTo(parent, part)
	local w = Instance.new("Weld")
	w.Part0 = parent
	w.Part1 = part
	w.C0 = parent.CFrame:ToObjectSpace(part.CFrame)
	w.C1 = CFrame.new()
	w.Parent = parent
	return w
end

---------------------------------------------------------------------
-- مُصدِر جزيئات
---------------------------------------------------------------------
--[[
	cfg = {
		Rate = 0, Count = 0,               -- Count للانفجار مرة واحدة
		Colors = {Color3, Color3, ...},
		Size0 = 1, Size1 = 0,
		Life0 = 0.4, Life1 = 0.9,
		Speed0 = 5, Speed1 = 20,
		Trans0 = 0, Trans1 = 1,
		Spread = 12, Accel = Vector3.new(0,0,0), Drag = 0,
		LightEmission = 1, ShapeInOut = false, Radius = 2,
		Direction = Enum.NormalId.Front, RotSpeed = 180,
		Squash = false,
	}
]]
function VFX.Emitter(parent, cfg)
	cfg = cfg or {}
	local e = Instance.new("ParticleEmitter")
	e.LightEmission = cfg.LightEmission or 1
	e.LightInfluence = cfg.LightInfluence or 0
	e.Texture = cfg.Texture or ""
	e.Color = ColorSequence.new(cfg.Colors or { Color3.new(1, 1, 1) })
	e.Size = NumberSequence.new(cfg.Size0 or 1, cfg.Size1 or 0)
	e.Transparency = NumberSequence.new(cfg.Trans0 or 0, cfg.Trans1 or 1)
	e.Lifetime = NumberRange.new(cfg.Life0 or 0.3, cfg.Life1 or 0.8)
	e.Speed = NumberRange.new(cfg.Speed0 or 5, cfg.Speed1 or 15)
	e.Rate = n(cfg.Rate or 0)
	e.RotSpeed = NumberRange.new(-(cfg.RotSpeed or 180), cfg.RotSpeed or 180)
	e.SpreadAngle = Vector2.new(cfg.Spread or 12, cfg.Spread or 12)
	e.Acceleration = cfg.Accel or V3(0, 0, 0)
	e.Drag = cfg.Drag or 0
	e.Shape = cfg.Shape or Enum.ParticleEmitterShape.Box
	e.EmissionDirection = cfg.Direction or Enum.NormalId.Front
	e.VelocityInheritance = cfg.VelocityInheritance or 0
	e.ZOffset = cfg.ZOffset or 0
	e.LockedToPart = cfg.LockedToPart ~= false
	e.Parent = parent
	if cfg.Count and cfg.Count > 0 then
		e:Emit(n(cfg.Count))
	end
	return e
end

-- انفجار جزيئات لمرة واحدة في مكان معين
function VFX.Burst(cf, cfg)
	local holder = Instance.new("Part")
	holder.Size = V3(0.2, 0.2, 0.2)
	holder.CFrame = cf
	holder.Anchored = true
	holder.CanCollide = false
	holder.Transparency = 1
	holder.Name = "Burst"
	holder.Parent = getFolder()

	local att = Instance.new("Attachment")
	att.Parent = holder
	VFX.Emitter(att, cfg)

	local life = (cfg.Life1 or 0.8) + (cfg.Count and 0.4 or 0.1)
	temp(holder, life + 0.3)
	return holder
end

---------------------------------------------------------------------
-- كاميرا: اهتزاز + فلاش + تغيير الجو
---------------------------------------------------------------------
local shake = { amp = 0, time = 0, dur = 0 }
local shakeConn

local function ensureShake()
	if shakeConn then return end
	shakeConn = RunService.RenderStepped:Connect(function(dt)
		if shake.time <= 0 then return end
		shake.time = math.max(0, shake.time - dt)
		local k = shake.time / math.max(shake.dur, 0.001)
		local a = shake.amp * k * k
		local cam = workspace.CurrentCamera
		if cam then
			cam.CFrame = cam.CFrame * CF(
				(math.random() - 0.5) * a * 2,
				(math.random() - 0.5) * a * 2,
				0) * ANG(0, 0, (math.random() - 0.5) * a * 0.02)
		end
	end)
end

function VFX.Shake(amp, duration)
	if not C.EnableCameraShake then return end
	ensureShake()
	shake.amp = math.max(shake.amp, amp or 0.4)
	shake.dur = math.max(shake.dur, duration or 0.5)
	shake.time = math.max(shake.time, duration or 0.5)
end

local ccEffect
function VFX.Flash(color, duration, intensity)
	if not C.EnableScreenFlash then return end
	if not ccEffect then
		ccEffect = Instance.new("ColorCorrectionEffect")
		ccEffect.Parent = Lighting
	end
	local hold = (duration or 0.25) * 0.25
	local ti = TweenInfo.new(hold, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(ccEffect, ti, {
		TintColor = color or Color3.new(1, 0.85, 0.6),
		Brightness = intensity or 0.35,
		Saturation = 0.25,
	}):Play()
	task.delay(hold, function()
		TweenService:Create(ccEffect, TweenInfo.new((duration or 0.25) * 0.75), {
			TintColor = Color3.new(1, 1, 1), Brightness = 0, Saturation = 0,
		}):Play()
	end)
end

-- تعتيم الجو وقت الألتميت
local skyTweens = {}
function VFX.DarkenSky(duration)
	if not C.EnableLighting then return end
	local ti = TweenInfo.new(0.6, Enum.EasingStyle.Sine)
	for _, t in ipairs(skyTweens) do pcall(function() t:Cancel() end) end
	skyTweens = {
		TweenService:Create(Lighting, ti, {
			Brightness = 0.6, Ambient = Color3.fromRGB(40, 30, 45),
			OutdoorAmbient = Color3.fromRGB(48, 34, 50),
			ColorShift_Top = Color3.fromRGB(70, 40, 30),
		}),
	}
	for _, t in ipairs(skyTweens) do t:Play() end
	task.delay(duration or 4, function()
		for _, t in ipairs({
			TweenService:Create(Lighting, TweenInfo.new(1.2), {
				Brightness = Lighting:GetAttribute("OriginalBrightness") or 2,
				Ambient = Color3.fromRGB(0, 0, 0),
				OutdoorAmbient = Color3.fromRGB(128, 128, 128),
				ColorShift_Top = Color3.fromRGB(0, 0, 0),
			}),
		}) do t:Play() end
	end)
end

---------------------------------------------------------------------
-- تأثيرات أساسية قابلة لإعادة الاستخدام
---------------------------------------------------------------------

-- حلقة صدمة (موجة ضغط) بتكبر وتختفي
function VFX.Shockwave(pos, maxRadius, color, thickness, duration)
	duration = duration or 0.55
	local p = quickPart(V3(0.4, thickness or 0.7, 0.4), CF(pos), color or Color3.new(1, 1, 1),
		Enum.Material.Neon, 0.35)
	p.Shape = Enum.PartType.Cylinder
	p.Orientation = V3(0, 0, 0)
	TweenService:Create(p, TweenInfo.new(duration, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
		Size = V3(maxRadius * 2, thickness or 0.7, maxRadius * 2),
		Transparency = 1,
		CFrame = CF(pos - V3(0, (thickness or 0.7) * 0.4, 0)),
	}):Play()

	-- حلقة تانية أسرع وأفتح
	local p2 = quickPart(V3(0.4, (thickness or 0.7) * 0.5, 0.4), CF(pos), Color3.new(1, 1, 1),
		Enum.Material.Neon, 0.6)
	p2.Shape = Enum.PartType.Cylinder
	TweenService:Create(p2, TweenInfo.new(duration * 0.7, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
		Size = V3(maxRadius * 2.6, (thickness or 0.7) * 0.5, maxRadius * 2.6),
		Transparency = 1,
		CFrame = CF(pos - V3(0, 0.2, 0)),
	}):Play()
	temp(p, duration + 0.1); temp(p2, duration + 0.1)
	return p
end

-- انفجار ناري متكامل
function VFX.Explosion(pos, size, palette, opts)
	opts = opts or {}
	palette = palette or {}
	local main = palette.Main or C.FireColorB
	local core = palette.Core or C.FireColorA
	local smoke = palette.Smoke or C.SmokeColor
	size = size or 12

	-- كرة التمدد
	local ball = quickPart(V3(1, 1, 1), CF(pos), main, Enum.Material.Neon, 0.15)
	ball.Shape = Enum.PartType.Ball
	TweenService:Create(ball, TweenInfo.new(0.42, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
		Size = V3(size * 2, size * 2, size * 2), Transparency = 1,
	}):Play()
	temp(ball, 0.6)

	-- وميض داخلي
	local flash = quickPart(V3(size * 0.7, size * 0.7, size * 0.7), CF(pos), core, Enum.Material.Neon, 0)
	flash.Shape = Enum.PartType.Ball
	TweenService:Create(flash, TweenInfo.new(0.16, Enum.EasingStyle.Quad), {
		Size = V3(size * 3, size * 3, size * 3), Transparency = 1,
	}):Play()
	temp(flash, 0.3)

	-- حلقة صدمة + ضوء
	VFX.Shockwave(pos + V3(0, 0.4, 0), size * 1.5, core, 1.2, 0.5)
	local light = Instance.new("PointLight")
	light.Color = main
	light.Range = size * 9
	light.Brightness = 14
	light.Parent = ball
	TweenService:Create(light, TweenInfo.new(0.45), { Brightness = 0 }):Play()

	-- جزيئات: نار + دخان + شرر
	VFX.Burst(CF(pos), {
		Colors = { core, main, C.FireColorC }, Size0 = size * 0.45, Size1 = size * 0.9,
		Life0 = 0.25, Life1 = 0.7, Speed0 = size * 1.2, Speed1 = size * 3.4,
		Spread = 180, Count = 46, Accel = V3(0, 14, 0), Drag = 3,
	})
	VFX.Burst(CF(pos), {
		Colors = { smoke, Color3.fromRGB(70, 60, 58) }, Size0 = size * 0.5, Size1 = size * 1.5,
		Life0 = 0.8, Life1 = 1.8, Speed0 = 2, Speed1 = size * 0.9, Spread = 180,
		Count = 30, LightEmission = 0, Trans0 = 0.35, Trans1 = 1, Accel = V3(0, 8, 0),
	})
	VFX.Burst(CF(pos), {
		Colors = { core, Color3.new(1, 1, 1) }, Size0 = 0.5, Size1 = 0,
		Life0 = 0.3, Life1 = 0.9, Speed0 = size * 3, Speed1 = size * 7,
		Spread = 180, Count = 40, Accel = V3(0, -30, 0), Drag = 1.2,
	})

	-- شظايا
	local debrisCount = math.floor(n(14))
	for i = 1, debrisCount do
		local d = quickPart(V3(math.random(4, 10) * 0.1 * size / 4, math.random(4, 10) * 0.1 * size / 4,
			math.random(4, 12) * 0.1 * size / 4), CF(pos), Color3.fromRGB(40, 26, 22), Enum.Material.Slate, 0)
		local dir = V3(math.random() - 0.5, math.random() * 0.9 + 0.25, math.random() - 0.5).Unit
		local speed = size * (1.6 + math.random() * 1.8)
		d.Velocity = dir * speed
		d.RotVelocity = V3(math.random(-12, 12), math.random(-12, 12), math.random(-12, 12))
		d.Anchored = false
		d.CanCollide = false
		TweenService:Create(d, TweenInfo.new(0.9), { Transparency = 1 }):Play()
		temp(d, 1.4)
	end

	-- حفرة/أثر حرق على الأرض
	local scorch = quickPart(V3(size * 2.4, 0.12, size * 2.4), CF(pos + V3(0, 0.09, 0)),
		Color3.fromRGB(14, 10, 10), Enum.Material.Slate, 0.35)
	scorch.Shape = Enum.PartType.Cylinder
	TweenService:Create(scorch, TweenInfo.new(6), { Transparency = 1 }):Play()
	temp(scorch, 6.4)

	VFX.Shake(opts.Shake or 0.5, 0.45)
	if opts.Flash ~= false then VFX.Flash(core, 0.3, 0.22) end
end

-- ضربة مخالب (قوس)
function VFX.Slash(cf, size, color, opts)
	opts = opts or {}
	size = size or 14
	color = color or C.SlashColor
	local arcs = 3
	for a = 1, arcs do
		local seg = 14
		local radius = size * (0.75 + a * 0.12)
		for i = 1, seg do
			local t0 = (i - 1) / seg
			local t1 = i / seg
			local ang0 = math.rad(-65 + t0 * 130)
			local ang1 = math.rad(-65 + t1 * 130)
			local p0 = V3(math.sin(ang0) * radius, math.cos(ang0) * radius * 0.35 - radius * 0.1, 0)
			local p1 = V3(math.sin(ang1) * radius, math.cos(ang1) * radius * 0.35 - radius * 0.1, 0)
			local mid = (p0 + p1) * 0.5
			local len = (p1 - p0).Magnitude * 1.35
			local piece = quickPart(V3(len, size * 0.14 * (1.2 - t0 * 0.5), 1.2),
				cf * CF(mid) * ANG(0, 0, math.atan2((p1 - p0).Y, (p1 - p0).X)),
				color, Enum.Material.Neon, 0.1 + t0 * 0.25)
			task.delay(a * 0.03, function()
				TweenService:Create(piece, TweenInfo.new(0.26, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
					Transparency = 1,
					Size = V3(len * 1.5, size * 0.02, 1.2),
					CFrame = piece.CFrame * CF(0, size * 0.25, 0),
				}):Play()
			end)
			temp(piece, 0.6)
		end
	end

	VFX.Burst(cf * CF(0, 0, -1), {
		Colors = { Color3.new(1, 1, 1), color, C.FireColorC }, Size0 = 1.1, Size1 = 0,
		Life0 = 0.2, Life1 = 0.6, Speed0 = 18, Speed1 = 46, Spread = 55,
		Count = 34, Accel = V3(0, -26, 0), Drag = 2,
	})
	VFX.Shake(opts.Shake or 0.35, 0.3)
end

---------------------------------------------------------------------
-- ١) نَفَس النار  (Z)
---------------------------------------------------------------------
--[[
	rig  : الريج بتاع التنين (من RigBuilder) — الشعاع بيتلزق في بؤه
	opts : { Duration = 1.7, Range = 60, Radius = 8 }
]]
function VFX.FireBreath(rig, opts)
	opts = opts or {}
	local duration = opts.Duration or 1.7
	local range = opts.Range or 60
	local radius = opts.Radius or 8
	local mouth = rig.Mouth or rig.Head
	if not mouth then return nil end

	local scale = rig.Scale or 1
	local holder = Instance.new("Folder")
	holder.Name = "FireBreath"
	holder.Parent = getFolder()

	-----------------------------------------------------------------
	-- حلقات النار (مخروط) ملزوقة في بؤ التنين
	-----------------------------------------------------------------
	local rings = {}
	local RINGS = math.floor(12 * (0.7 + PM * 0.3))
	for i = 1, RINGS do
		local f = i / RINGS
		local dist = f * range
		local r = (0.9 + f * radius * 0.55) * scale
		local ring = quickPart(V3(r * 2, r * 0.55, r * 2), mouth.CFrame * CF(0, 0, -dist),
			f < 0.35 and C.FireColorA or (f < 0.7 and C.FireColorB or C.FireColorC),
			Enum.Material.Neon, 0.05 + f * 0.55)
		ring.Shape = Enum.PartType.Cylinder
		ring.CFrame = mouth.CFrame * CF(0, 0, -dist) * ANG(rad(90), 0, 0)
		ring.Parent = holder
		weldTo(mouth, ring)          -- يتبع راس التنين أوتوماتيك
		rings[i] = { Part = ring, F = f, R = r, Dist = dist }

		-- قلب أبيض متوهج
		if i <= 4 then
			local core = quickPart(V3(r * 1.1, r * 0.3, r * 1.1), ring.CFrame,
				Color3.new(1, 1, 1), Enum.Material.Neon, 0.1 + f * 0.2)
			core.Shape = Enum.PartType.Cylinder
			core.Parent = holder
			weldTo(mouth, core)
			table.insert(rings, { Part = core, F = f, R = r * 0.6, Dist = dist, Core = true })
		end
	end

	-----------------------------------------------------------------
	-- جزيئات من الفم
	-----------------------------------------------------------------
	local att = rig.Attachments and rig.Attachments.Breath
	if not att then
		att = Instance.new("Attachment")
		att.Parent = mouth
	end

	local fireE = VFX.Emitter(att, {
		Colors = { C.FireColorA, C.FireColorB, C.FireColorC },
		Size0 = 2.4 * scale, Size1 = 7 * scale, Life0 = 0.35, Life1 = 0.85,
		Speed0 = 60, Speed1 = 130, Spread = 9, Rate = 220,
		Accel = V3(0, 12, 0), Drag = 0.6, Direction = Enum.NormalId.Front,
	})
	local emberE = VFX.Emitter(att, {
		Colors = { C.FireColorA, Color3.new(1, 0.6, 0.2) },
		Size0 = 0.5, Size1 = 0.9, Life0 = 0.7, Life1 = 1.6,
		Speed0 = 30, Speed1 = 90, Spread = 26, Rate = 70,
		Accel = V3(0, 22, 0), Drag = 1.2, Direction = Enum.NormalId.Front,
	})
	local smokeE = VFX.Emitter(att, {
		Colors = { C.SmokeColor, Color3.fromRGB(70, 62, 60) },
		Size0 = 3 * scale, Size1 = 11 * scale, Life0 = 1.0, Life1 = 2.2,
		Speed0 = 20, Speed1 = 46, Spread = 18, Rate = 46, LightEmission = 0,
		Trans0 = 0.5, Trans1 = 1, Accel = V3(0, 16, 0), Drag = 1.5,
		Direction = Enum.NormalId.Front,
	})

	-- ضوء في البؤ
	local light = Instance.new("PointLight")
	light.Color = C.FireColorB
	light.Range = 40 * scale
	light.Brightness = 8
	light.Parent = mouth

	-----------------------------------------------------------------
	-- أثر الحرق على الأرض
	-----------------------------------------------------------------
	local scorch = quickPart(V3(radius * 2, 0.12, radius * 2), mouth.CFrame, Color3.fromRGB(18, 10, 8),
		Enum.Material.Slate, 1)
	scorch.Shape = Enum.PartType.Cylinder
	scorch.Parent = holder
	local groundFire
	local groundAtt = Instance.new("Attachment")
	groundAtt.Parent = scorch

	-----------------------------------------------------------------
	-- الحلقة: تحديث كل فريم
	-----------------------------------------------------------------
	local params = RaycastParams.new()
	local exclude = { holder }
	if rig.Model then table.insert(exclude, rig.Model) end
	params.FilterDescendantsInstances = exclude
	params.FilterType = Enum.RaycastFilterType.Exclude

	local startTime = os.clock()
	local conn
	local alive = true

	conn = RunService.Heartbeat:Connect(function(dt)
		if not alive then return end
		if not mouth or not mouth.Parent then alive = false return end

		local t = os.clock() - startTime
		if t > duration then
			alive = false
			return
		end

		-- وميض الحلقات
		for _, ring in ipairs(rings) do
			local flick = 0.82 + math.sin(t * 34 + ring.F * 22) * 0.16 + math.random() * 0.1
			local p = ring.Part
			if ring.Core then
				p.Transparency = math.clamp(0.05 + ring.F * 0.4 + (1 - flick) * 0.2, 0, 1)
			else
				p.Transparency = math.clamp((0.02 + ring.F * 0.62) / flick, 0, 1)
			end
			local s = ring.R * 2 * flick
			p.Size = V3(s, s * 0.5, s)
			p.CFrame = mouth.CFrame * CF(0, 0, -ring.Dist) * ANG(rad(90 + math.sin(t * 12 + ring.F * 9) * 8), 0, 0)
		end

		-- ضوء متذبذب
		light.Brightness = 6 + math.random() * 6

		-- أثر الأرض
		local origin = mouth.Position
		local dir = mouth.CFrame.LookVector
		local hit = workspace:Raycast(origin, dir * range, params)
		if hit then
			scorch.Transparency = 0.45
			scorch.CFrame = CF(hit.Position + V3(0, 0.08, 0))
			scorch.Size = V3(radius * 1.8, 0.12, radius * 1.8)
			if not groundFire then
				groundFire = VFX.Emitter(groundAtt, {
					Colors = { C.FireColorA, C.FireColorB, C.FireColorC },
					Size0 = 2.5 * scale, Size1 = 6 * scale, Life0 = 0.4, Life1 = 1.1,
					Speed0 = 8, Speed1 = 26, Spread = 70, Rate = 90,
					Accel = V3(0, 30, 0), Drag = 1,
				})
			end
		else
			scorch.Transparency = 1
		end

		-- كرات نار متطايرة مع الشعاع
		if math.random() < 0.55 then
			local bolt = quickPart(V3(1.6 * scale, 1.6 * scale, 1.6 * scale), mouth.CFrame, C.FireColorA,
				Enum.Material.Neon, 0.15)
			bolt.Shape = Enum.PartType.Ball
			bolt.Parent = holder
			local speed = 90 + math.random() * 60
			local life = range / speed
			local born = os.clock()
			local spin = V3(math.random(-6, 6), math.random(-6, 6), math.random(-6, 6))
			local bconn
			bconn = RunService.Heartbeat:Connect(function(dt2)
				if not bolt.Parent then bconn:Disconnect() return end
				local age = os.clock() - born
				if age > life then bconn:Disconnect(); bolt:Destroy() return end
				bolt.CFrame = mouth.CFrame * CF(0, 0, -speed * age) + V3(0, math.sin(age * 9) * 1.2, 0)
				bolt.Size = V3(1, 1, 1) * (1.6 + age * 2.2) * scale
				bolt.Transparency = math.min(1, age / life * 0.9)
				bolt.Orientation = bolt.Orientation + spin
			end)
			temp(bolt, life + 0.5)
		end
	end)

	-- تنظيف
	local obj = {}
	function obj.Stop()
		alive = false
		if conn then conn:Disconnect() end
		task.delay(1.6, function()
			fireE.Enabled = false; emberE.Enabled = false; smokeE.Enabled = false
			if groundFire then groundFire.Enabled = false end
			task.wait(2.2)
			if light then light:Destroy() end
			if holder then holder:Destroy() end
		end)
	end

	task.delay(duration, function()
		if alive then obj.Stop() end
	end)

	VFX.Shake(0.35, duration)
	return obj
end

---------------------------------------------------------------------
-- ٢) نيزك  (C)
---------------------------------------------------------------------
function VFX.Meteor(targetPos, opts)
	opts = opts or {}
	local startHeight = opts.Height or 160
	local radius = opts.Radius or 13
	local travelTime = opts.TravelTime or (0.75 + math.random() * 0.5)
	local startPos = V3(targetPos.X + (math.random() - 0.5) * 6, targetPos.Y + startHeight,
		targetPos.Z + (math.random() - 0.5) * 6)
	local dir = (V3(targetPos.X, targetPos.Y + 1, targetPos.Z) - startPos)

	local rock = quickPart(V3(6, 6, 6), CF(startPos), Color3.fromRGB(48, 30, 26), Enum.Material.Slate, 0)
	rock.Shape = Enum.PartType.Ball
	rock.Anchored = false
	rock.CanCollide = false
	rock.Parent = getFolder()

	-- نواة ملتهبة
	local core = quickPart(V3(4.6, 4.6, 4.6), CF(startPos), C.FireColorA, Enum.Material.Neon, 0.2)
	core.Shape = Enum.PartType.Ball
	core.Parent = rock
	weldTo(rock, core)

	-- ذيل
	local a0 = Instance.new("Attachment"); a0.Parent = rock
	local a1 = Instance.new("Attachment"); a1.Parent = rock; a1.Position = V3(0, 4, 0)
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Color = ColorSequence.new(C.FireColorA, C.FireColorC)
	trail.Lifetime = 0.6
	trail.MinLength = 0
	trail.FaceCamera = true
	trail.Transparency = NumberSequence.new(0, 1)
	trail.Parent = rock

	-- جزيئات الذيل
	local ta = Instance.new("Attachment"); ta.Parent = rock
	VFX.Emitter(ta, {
		Colors = { C.FireColorA, C.FireColorB, C.FireColorC }, Size0 = 5, Size1 = 1,
		Life0 = 0.2, Life1 = 0.6, Speed0 = 2, Speed1 = 14, Spread = 40, Rate = 160,
		Accel = V3(0, 10, 0), VelocityInheritance = 0.6,
	})
	VFX.Emitter(ta, {
		Colors = { C.SmokeColor }, Size0 = 6, Size1 = 16, Life0 = 0.6, Life1 = 1.4,
		Speed0 = 2, Speed1 = 10, Spread = 60, Rate = 60, LightEmission = 0,
		Trans0 = 0.5, Trans1 = 1,
	})

	-- ضوء
	local light = Instance.new("PointLight")
	light.Color = C.FireColorB
	light.Range = 60
	light.Brightness = 12
	light.Parent = rock

	-- حركة السقوط
	rock.CFrame = CF(startPos, startPos + dir)
	rock.Velocity = dir.Unit * (dir.Magnitude / travelTime)
	rock.RotVelocity = V3(math.random(-8, 8), math.random(-8, 8), math.random(-8, 8))

	-- تأثير دخول الغلاف الجوي
	task.spawn(function()
		task.wait(travelTime * 0.55)
		VFX.Burst(CF(rock.Position), {
			Colors = { C.FireColorA, Color3.new(1, 1, 1) }, Size0 = 6, Size1 = 0,
			Life0 = 0.3, Life1 = 0.8, Speed0 = 40, Speed1 = 120, Spread = 180, Count = 40,
		})
	end)

	-- الاصطدام
	task.delay(travelTime, function()
		local pos = rock.Position
		rock:Destroy()
		VFX.Explosion(V3(pos.X, (opts.GroundY or targetPos.Y) + 1, pos.Z), radius * 0.9, {
			Main = C.FireColorB, Core = C.FireColorA, Smoke = C.SmokeColor,
		}, { Shake = opts.Shake or 0.9 })
		-- حريق مستمر مكان الاصطدام
		local scorchFire = quickPart(V3(0.2, 0.2, 0.2), CF(pos.X, (opts.GroundY or targetPos.Y) + 1, pos.Z),
			C.FireColorB, Enum.Material.Neon, 1)
		local sa = Instance.new("Attachment"); sa.Parent = scorchFire
		VFX.Emitter(sa, {
			Colors = { C.FireColorA, C.FireColorB, C.FireColorC }, Size0 = 4, Size1 = 9,
			Life0 = 0.5, Life1 = 1.4, Speed0 = 6, Speed1 = 22, Spread = 70, Rate = 70,
			Accel = V3(0, 26, 0),
		})
		VFX.Emitter(sa, {
			Colors = { C.SmokeColor }, Size0 = 6, Size1 = 18, Life0 = 1, Life1 = 2.4,
			Speed0 = 3, Speed1 = 12, Spread = 70, Rate = 30, LightEmission = 0,
			Trans0 = 0.5, Trans1 = 1,
		})
		temp(scorchFire, 6)
	end)
end

-- مطر نيازك
function VFX.MeteorRain(center, count, radius, duration, onEach)
	count = count or 10
	duration = duration or 3
	for i = 1, count do
		task.delay((i - 1) * (duration / count) + math.random() * 0.25, function()
			local ang = math.random() * math.pi * 2
			local dist = math.random() * radius
			local pos = V3(center.X + math.cos(ang) * dist, center.Y, center.Z + math.sin(ang) * dist)
			-- حلقة تحذير قبل السقوط
			local warn = quickPart(V3(radius * 0.55, 0.14, radius * 0.55), CF(pos + V3(0, 0.1, 0)),
				C.FireColorB, Enum.Material.Neon, 0.6)
			warn.Shape = Enum.PartType.Cylinder
			warn.Anchored = true
			temp(warn, 0.62)
			TweenService:Create(warn, TweenInfo.new(0.6), { Transparency = 1 }):Play()

			task.delay(0.6, function()
				VFX.Meteor(pos, { Radius = radius * 0.6, Height = 190, GroundY = center.Y })
				if onEach then onEach(pos) end
			end)
		end)
	end
end

---------------------------------------------------------------------
-- ٣) صاعقة رعد  (V)
---------------------------------------------------------------------
function VFX.LightningBolt(fromPos, toPos, opts)
	opts = opts or {}
	local segs = opts.Segments or 12
	local jitter = opts.Jitter or 5
	local thickness = opts.Thickness or 1.1
	local life = opts.Life or 0.32

	local dir = (toPos - fromPos)
	local dist = dir.Magnitude
	local up = V3(0, 0, 1):Cross(dir.Unit)
	if up.Magnitude < 0.01 then up = V3(1, 0, 0) end
	up = up.Unit
	local side = dir.Unit:Cross(up).Unit

	local points = {}
	for i = 0, segs do
		local f = i / segs
		local base = fromPos + dir * f
		local j = (i == 0 or i == segs) and 0 or jitter
		points[i + 1] = base + up * ((math.random() - 0.5) * j) + side * ((math.random() - 0.5) * j)
	end

	local boltFolder = Instance.new("Folder")
	boltFolder.Name = "Bolt"
	boltFolder.Parent = getFolder()

	for i = 1, #points - 1 do
		local a, b = points[i], points[i + 1]
		local mid = (a + b) * 0.5
		local len = (b - a).Magnitude * 1.12
		local cf = CF(mid, b)

		-- القلب الأبيض
		local core = quickPart(V3(thickness, thickness, len), cf, C.ThunderColorCore, Enum.Material.Neon, 0)
		core.Parent = boltFolder
		-- الهالة الزرقا
		local glow = quickPart(V3(thickness * 3.2, thickness * 3.2, len), cf, C.ThunderColor,
			Enum.Material.Neon, 0.75)
		glow.Parent = boltFolder
	end

	-- ضوء
	local light = Instance.new("PointLight")
	light.Color = C.ThunderColor
	light.Range = 120
	light.Brightness = 26
	light.Parent = quickPart(V3(0.2, 0.2, 0.2), CF(toPos), C.ThunderColorCore, Enum.Material.Neon, 1)

	-- وميض واختفاء
	for _, p in ipairs(boltFolder:GetChildren()) do
		task.delay(0.05, function()
			TweenService:Create(p, TweenInfo.new(life * 0.5, Enum.EasingStyle.Quad), {
				Transparency = 1, Size = V3(p.Size.X * 0.3, p.Size.Y * 0.3, p.Size.Z),
			}):Play()
		end)
	end
	TweenService:Create(light, TweenInfo.new(life), { Brightness = 0 }):Play()
	task.delay(0.03, function()
		for _, p in ipairs(boltFolder:GetChildren()) do
			TweenService:Create(p, TweenInfo.new(0.05), { Transparency = 0.2 }):Play()
		end
	end)
	temp(boltFolder, life + 0.4)
	temp(light.Parent, life + 0.4)

	-- تأثير الاصطدام
	VFX.Shockwave(toPos + V3(0, 0.3, 0), opts.ImpactRadius or 16, C.ThunderColor, 0.9, 0.5)
	VFX.Burst(CF(toPos), {
		Colors = { Color3.new(1, 1, 1), C.ThunderColor, C.ThunderColorCore },
		Size0 = 2, Size1 = 0, Life0 = 0.3, Life1 = 0.9, Speed0 = 30, Speed1 = 90,
		Spread = 90, Count = 46, Accel = V3(0, -20, 0), Drag = 1.5,
	})
	VFX.Burst(CF(toPos), {
		Colors = { Color3.fromRGB(60, 60, 70), C.SmokeColor }, Size0 = 4, Size1 = 12,
		Life0 = 0.7, Life1 = 1.6, Speed0 = 4, Speed1 = 18, Spread = 80, Count = 16,
		LightEmission = 0, Trans0 = 0.5, Trans1 = 1, Accel = V3(0, 12, 0),
	})
	VFX.Shake(opts.Shake or 0.5, 0.35)
end

-- عاصفة صواعق
function VFX.ThunderStorm(center, count, radius, duration, groundY)
	count = count or 14
	duration = duration or 3
	groundY = groundY or center.Y
	VFX.DarkenSky(duration + 2.5)
	for i = 1, count do
		task.delay((i - 1) * (duration / count) + math.random() * 0.2, function()
			local ang = math.random() * math.pi * 2
			local dist = math.random() * radius
			local target = V3(center.X + math.cos(ang) * dist, groundY, center.Z + math.sin(ang) * dist)
			local from = V3(target.X + (math.random() - 0.5) * 20, groundY + 170 + math.random() * 60,
				target.Z + (math.random() - 0.5) * 20)
			-- وميض سماوي
			local skyFlash = quickPart(V3(1, 1, 1), CF(from), Color3.new(1, 1, 1), Enum.Material.Neon, 1)
			skyFlash.Shape = Enum.PartType.Ball
			skyFlash.Size = V3(60, 60, 60)
			TweenService:Create(skyFlash, TweenInfo.new(0.25), { Transparency = 1 }):Play()
			temp(skyFlash, 0.4)

			VFX.LightningBolt(from, target, { Jitter = 7, Thickness = 1.2, ImpactRadius = radius * 0.28 })
			if i % 3 == 0 then VFX.Flash(C.ThunderColor, 0.35, 0.3) end
		end)
	end
end

---------------------------------------------------------------------
-- ٤) زئير / موجة صوتية
---------------------------------------------------------------------
function VFX.RoarWave(cf, opts)
	opts = opts or {}
	local color = opts.Color or C.EnergyColor
	local maxR = opts.MaxRadius or 34

	-- 3 حلقات متتالية
	for i = 1, 3 do
		task.delay(i * 0.09, function()
			local ring = quickPart(V3(1, 1.4, 1), cf * CF(0, 0, -2), color, Enum.Material.Neon, 0.35)
			ring.Shape = Enum.PartType.Cylinder
			ring.Anchored = true
			TweenService:Create(ring, TweenInfo.new(0.85, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
				Size = V3(maxR * 2, 1.4, maxR * 2), Transparency = 1,
				CFrame = cf * CF(0, 0, -maxR * 0.7),
			}):Play()
			temp(ring, 1.1)
		end)
	end

	-- غبار الأرض
	VFX.Burst(cf * CF(0, -3, 0), {
		Colors = { Color3.fromRGB(120, 104, 92), Color3.fromRGB(70, 60, 55) },
		Size0 = 3, Size1 = 12, Life0 = 0.6, Life1 = 1.5, Speed0 = 18, Speed1 = 46,
		Spread = 40, Count = 40, LightEmission = 0, Trans0 = 0.4, Trans1 = 1,
		Accel = V3(0, 6, 0), Drag = 2,
	})

	-- ريح/طاقة
	VFX.Burst(cf * CF(0, 1, -3), {
		Colors = { Color3.new(1, 1, 1), color, C.FireColorC }, Size0 = 2.5, Size1 = 0.4,
		Life0 = 0.3, Life1 = 0.8, Speed0 = 40, Speed1 = 110, Spread = 22,
		Count = 50, Drag = 1.4,
	})

	VFX.Shake(opts.Shake or 0.6, 0.6)
end

---------------------------------------------------------------------
-- ٥) هالة الاستيقاظ (Aura) — للـ V
---------------------------------------------------------------------
function VFX.Aura(rig, duration, color)
	color = color or C.Glow
	local holder = Instance.new("Folder")
	holder.Name = "Aura"
	holder.Parent = getFolder()

	local scale = rig.Scale or 1

	-- جزيئات دوّارة حوالين الجسم
	for _, key in ipairs({ "Core", "WingL", "WingR", "Tail", "Aura" }) do
		local att = rig.Attachments and rig.Attachments[key]
		if att then
			VFX.Emitter(att, {
				Colors = { C.FireColorA, color, C.FireColorC }, Size0 = 2.2 * scale, Size1 = 0.2,
				Life0 = 0.4, Life1 = 1.0, Speed0 = 6, Speed1 = 18, Spread = 180, Rate = 90,
				Accel = V3(0, 20, 0), Drag = 1.5,
			})
		end
	end

	-- هالة خارجية
	if rig.Highlight then
		rig.Highlight.FillTransparency = 0.75
		rig.Highlight.OutlineTransparency = 0
		TweenService:Create(rig.Highlight, TweenInfo.new(0.4), {
			FillTransparency = 0.86, OutlineTransparency = 0.25,
		}):Play()
	end

	-- عمود طاقة أول ما تتشغّل
	local pillar = quickPart(V3(14 * scale, 90 * scale, 14 * scale),
		CF(rig.Root.Position) , C.FireColorA, Enum.Material.Neon, 0.7)
	pillar.Shape = Enum.PartType.Cylinder
	pillar.Anchored = true
	temp(pillar, 1.4)
	TweenService:Create(pillar, TweenInfo.new(1.2, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
		Transparency = 1, Size = V3(30 * scale, 90 * scale, 30 * scale),
	}):Play()
	VFX.RoarWave(CF(rig.Root.Position) * (rig.Root.CFrame - rig.Root.CFrame.Position), { MaxRadius = 40 })

	return {
		Stop = function()
			task.delay(duration or 8, function()
				if rig.Highlight then
					TweenService:Create(rig.Highlight, TweenInfo.new(0.8), {
						FillTransparency = 1, OutlineTransparency = 1,
					}):Play()
				end
				holder:Destroy()
			end)
		end,
	}
end

---------------------------------------------------------------------
-- ٦) أثر الاندفاع (X) + تريلات
---------------------------------------------------------------------
function VFX.DashTrail(rig, duration, color)
	color = color or C.SlashColor
	local holder = Instance.new("Folder")
	holder.Name = "DashTrail"
	holder.Parent = getFolder()

	-- تريلات على أطراف الأجنحة
	local trails = {}
	for _, key in ipairs({ "WingL", "WingR", "Tail" }) do
		local att = rig.Attachments and rig.Attachments[key]
		if att then
			local t = Instance.new("Trail")
			t.Attachment0 = att
			local a2 = Instance.new("Attachment")
			a2.Parent = att.Parent
			t.Attachment1 = a2
			t.Color = ColorSequence.new(Color3.new(1, 1, 1), color)
			t.Lifetime = 0.35
			t.FaceCamera = true
			t.Transparency = NumberSequence.new(0, 1)
			t.Parent = holder
			table.insert(trails, t)
		end
	end

	-- أشباح (Afterimages)
	local alive = true
	task.spawn(function()
		local t0 = os.clock()
		while alive and (os.clock() - t0) < (duration or 0.9) do
			local ghost = quickPart(V3(0.2, 0.2, 0.2), rig.Root.CFrame, color, Enum.Material.Neon, 0.65)
			ghost.Shape = Enum.PartType.Ball
			ghost.Size = V3(9, 9, 16) * (rig.Scale or 1)
			ghost.Parent = holder
			TweenService:Create(ghost, TweenInfo.new(0.35), {
				Transparency = 1, Size = ghost.Size * 1.6,
			}):Play()
			temp(ghost, 0.5)
			VFX.Burst(rig.Root.CFrame * CF(0, -3, 0), {
				Colors = { color, C.FireColorA, C.FireColorC }, Size0 = 2, Size1 = 0,
				Life0 = 0.2, Life1 = 0.6, Speed0 = 12, Speed1 = 34, Spread = 90, Count = 10,
			})
			task.wait(0.045)
		end
	end)

	return {
		Stop = function()
			alive = false
			task.delay(0.6, function() holder:Destroy() end)
		end,
	}
end

---------------------------------------------------------------------
-- ٧) تأثيرات صغيرة: إصابة، غبار، حرق، أرقام الضرر
---------------------------------------------------------------------
function VFX.HitSpark(pos, color)
	color = color or C.FireColorA
	VFX.Burst(CF(pos), {
		Colors = { Color3.new(1, 1, 1), color, C.FireColorC }, Size0 = 1.4, Size1 = 0,
		Life0 = 0.15, Life1 = 0.5, Speed0 = 14, Speed1 = 38, Spread = 180, Count = 18,
		Accel = V3(0, -18, 0), Drag = 2,
	})
end

function VFX.FootDust(pos, scale)
	scale = scale or 1
	VFX.Burst(CF(pos), {
		Colors = { Color3.fromRGB(140, 124, 108), Color3.fromRGB(90, 80, 72) },
		Size0 = 1.6 * scale, Size1 = 5 * scale, Life0 = 0.3, Life1 = 0.8,
		Speed0 = 3, Speed1 = 10, Spread = 60, Count = 8, LightEmission = 0,
		Trans0 = 0.55, Trans1 = 1, Accel = V3(0, 4, 0), Drag = 3,
	})
end

-- ولّع في الهدف (حالة الحرق)
function VFX.BurnTarget(character, duration)
	local part = character:FindFirstChild("HumanoidRootPart") or character:FindFirstChild("Torso")
		or character:FindFirstChild("UpperTorso")
	if not part then return end
	local att = Instance.new("Attachment")
	att.Parent = part
	local e1 = VFX.Emitter(att, {
		Colors = { C.FireColorA, C.FireColorB, C.FireColorC }, Size0 = 1.6, Size1 = 3.4,
		Life0 = 0.3, Life1 = 0.8, Speed0 = 2, Speed1 = 7, Spread = 180, Rate = 60,
		Accel = V3(0, 12, 0),
	})
	local e2 = VFX.Emitter(att, {
		Colors = { C.SmokeColor }, Size0 = 1.8, Size1 = 5, Life0 = 0.6, Life1 = 1.4,
		Speed0 = 1, Speed1 = 4, Spread = 180, Rate = 18, LightEmission = 0,
		Trans0 = 0.5, Trans1 = 1, Accel = V3(0, 8, 0),
	})
	task.delay(duration or 4, function()
		e1.Enabled = false; e2.Enabled = false
		task.wait(1.6)
		att:Destroy()
	end)
end

-- نجوم الدوخة (Stun)
function VFX.StunStars(character, duration)
	local head = character:FindFirstChild("Head")
	if not head then return end
	local att = Instance.new("Attachment")
	att.Parent = head
	att.Position = V3(0, 1.4, 0)
	VFX.Emitter(att, {
		Colors = { Color3.new(1, 1, 1), Color3.fromRGB(255, 230, 120) }, Size0 = 0.7, Size1 = 0,
		Life0 = 0.4, Life1 = 0.8, Speed0 = 1.5, Speed1 = 3, Spread = 180, Rate = 22,
		Accel = V3(0, 2, 0),
	})
	task.delay(duration or 1, function() att:Destroy() end)
end

-- أرقام الضرر الطايرة
local dmgGui
function VFX.DamageNumber(pos, amount, crit)
	if not Config.UI.ShowDamageNumbers then return end
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 120, 0, 60)
	bb.StudsOffset = V3(math.random(-20, 20) / 10, 2, math.random(-10, 10) / 10)
	bb.Adornee = nil
	bb.AlwaysOnTop = true
	bb.MaxDistance = 120

	local holderPart = quickPart(V3(0.2, 0.2, 0.2), CF(pos), Color3.new(1, 1, 1), Enum.Material.Neon, 1)
	holderPart.Anchored = true
	bb.Adornee = holderPart
	bb.Parent = holderPart
	holderPart.Parent = getFolder()

	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 1, 0)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.Text = tostring(math.floor(amount + 0.5))
	label.TextColor3 = crit and Color3.fromRGB(255, 90, 40) or Color3.fromRGB(255, 216, 120)
	label.TextStrokeTransparency = 0.2
	label.TextStrokeColor3 = Color3.fromRGB(40, 10, 0)
	label.Parent = bb

	TweenService:Create(holderPart, TweenInfo.new(1.0, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		CFrame = CF(pos + V3(0, 7, 0)),
	}):Play()
	TweenService:Create(label, TweenInfo.new(1.0), { TextTransparency = 1 }):Play()
	temp(holderPart, 1.2)
end

-- عمود تحوّل (التنين ⇄ إنسان)
function VFX.TransformPillar(pos, color, up)
	color = color or C.FireColorA
	local pillar = quickPart(V3(16, 120, 16), CF(pos), color, Enum.Material.Neon, 0.65)
	pillar.Shape = Enum.PartType.Cylinder
	temp(pillar, 1.6)
	if up then
		TweenService:Create(pillar, TweenInfo.new(1.1, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
			Transparency = 1, Size = V3(46, 120, 46),
		}):Play()
	else
		TweenService:Create(pillar, TweenInfo.new(0.7, Enum.EasingStyle.Quart), {
			Transparency = 1, Size = V3(2, 120, 2),
		}):Play()
	end

	for i = 1, 3 do
		task.delay(i * 0.08, function()
			VFX.Shockwave(pos + V3(0, 0.4, 0), 26 + i * 8, color, 1.4, 0.7)
		end)
	end
	VFX.Burst(CF(pos), {
		Colors = { Color3.new(1, 1, 1), color, C.FireColorC }, Size0 = 3, Size1 = 0.5,
		Life0 = 0.5, Life1 = 1.4, Speed0 = 20, Speed1 = 70, Spread = 40, Count = 70,
		Accel = V3(0, 40, 0), Drag = 1,
	})
	VFX.Flash(color, 0.6, 0.35)
	VFX.Shake(0.7, 0.7)
end

---------------------------------------------------------------------
-- تشغيل تأثير جاهز للمهارات (للنسخ عن بعد — Remote)
---------------------------------------------------------------------
function VFX.Remote(abilityKey, originCF, extra)
	extra = extra or {}
	local ab = Config.Abilities[abilityKey]
	if not ab then return end

	if abilityKey == "Transform" then
		VFX.TransformPillar(originCF.Position, C.FireColorA, extra.Up ~= false)
		return

	elseif abilityKey == "Z" then
		-- شعاع نار ثابت من نفس المكان
		local fakeRig = {
			Mouth = quickPart(V3(0.2, 0.2, 0.2), originCF, C.FireColorA, Enum.Material.Neon, 1),
			Model = nil, Scale = 1,
			Attachments = {},
		}
		local att = Instance.new("Attachment")
		att.Parent = fakeRig.Mouth
		fakeRig.Attachments.Breath = att
		fakeRig.Root = fakeRig.Mouth
		local obj = VFX.FireBreath(fakeRig, { Duration = ab.Duration, Range = ab.Range, Radius = ab.Radius })
		task.delay(ab.Duration + 3, function() fakeRig.Mouth:Destroy() end)
		return obj

	elseif abilityKey == "X" then
		local step = (ab.DashDistance or 30) / ab.SlashCount
		for i = 1, ab.SlashCount do
			task.delay(i * (ab.Duration / ab.SlashCount), function()
				VFX.Slash(originCF * CF(0, 0, -i * step), ab.Radius * 1.5, C.SlashColor)
			end)
		end

	elseif abilityKey == "C" then
		-- السيرفر بيبعت أماكن النيازك عشان الكل يشوف نفس الحاجة
		if data.Positions and #data.Positions > 0 then
			local step = ab.Duration / #data.Positions
			for i, pos in ipairs(data.Positions) do
				task.delay((i - 1) * step, function()
					local warn = quickPart(V3(ab.Radius * 1.1, 0.14, ab.Radius * 1.1),
						CF(pos + V3(0, 0.1, 0)), C.FireColorB, Enum.Material.Neon, 0.6)
					warn.Shape = Enum.PartType.Cylinder
					temp(warn, 0.7)
					TweenService:Create(warn, TweenInfo.new(0.65), { Transparency = 1 }):Play()
					task.delay(0.62, function()
						VFX.Meteor(pos, { Radius = ab.Radius, Height = 190, GroundY = originCF.Y, Shake = 0.8 })
					end)
				end)
			end
		else
			VFX.MeteorRain(originCF.Position, ab.MeteorCount, ab.CastRadius, ab.Duration)
		end

	elseif abilityKey == "V" then
		if data.Positions and #data.Positions > 0 then
			local step = ab.Duration / #data.Positions
			for i, pos in ipairs(data.Positions) do
				task.delay((i - 1) * step, function()
					local from = pos + V3((math.random() - 0.5) * 18, 175 + math.random() * 60,
						(math.random() - 0.5) * 18)
					VFX.LightningBolt(from, pos, {
						Jitter = 7, Thickness = 1.2, ImpactRadius = ab.Radius * 1.7, Shake = 0.45,
					})
					if i % 3 == 0 then VFX.Flash(C.ThunderColor, 0.35, 0.28) end
				end)
			end
			VFX.DarkenSky(ab.Duration + 2)
		else
			VFX.ThunderStorm(originCF.Position, ab.BoltCount, ab.CastRadius, ab.Duration,
				originCF.Position.Y)
		end
	end
end

return VFX

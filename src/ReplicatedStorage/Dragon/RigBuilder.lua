--[[
	====================================================================
	RigBuilder.lua — بناء التنين + الـ Rig (Motor6D)
	====================================================================
	بيبني تنين كامل من قطع (Parts) مع هيكل عظام Motor6D جاهز للتحريك
	بدون أي أصول خارجية (ميش/صور) .. وبرضه يدعم تركيب ميش جاهز:
		Config.Dragon.MeshOverride = { ["Head"] = "rbxassetid://123456" }

	الاتجاه: التنين بيبصّ ناحية -Z (نفس نظام شخصيات روبلوكس)
]]

local RigBuilder = {}
local Config = require(script.Parent.Config)

local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local rad = math.rad

---------------------------------------------------------------------
-- أدوات
---------------------------------------------------------------------
local function newPart(name, size, cf, color, material, shape)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Config.Dragon.Material
	if shape then p.Shape = shape end
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Anchored = false
	p.CanCollide = false
	p.Massless = true          -- كل القطع خفيفة ماعدا الروت (زي R15)
	return p
end

local function applyMeshOverride(p)
	local id = Config.Dragon.MeshOverride and Config.Dragon.MeshOverride[p.Name]
	if id and Config.Dragon.UseProceduralBody == false then
		local m = Instance.new("SpecialMesh")
		m.MeshType = Enum.MeshType.FileMesh
		m.MeshId = id
		m.TextureId = Config.Dragon.MeshOverride[p.Name .. "_Texture"] or ""
		m.Scale = Vector3.one * (Config.Dragon.Scale or 1)
		m.Parent = p
		return m
	end
	return nil
end

---------------------------------------------------------------------
-- البناء
---------------------------------------------------------------------
--[[
	opts = {
		CFrame   = CFrame.new(...),   -- مكان الظهور
		Scale    = number (اختياري),
		Name     = string (اختياري),
	}
]]
--[[
	RigBuilder.Wrap(model)
	بيعيد تجميع جدول الريج من موديل جاهز (مهم للكلينت اللي مابناش التنين بنفسه)
]]
function RigBuilder.Wrap(model)
	local rig = {
		Model = model, Parts = {}, Motors = {}, Base = {}, Attachments = {},
		Scale = model:GetAttribute("Scale") or 1,
	}
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("Motor6D") then
			local name = (d.Name:gsub("_Motor$", ""))
			rig.Motors[name] = d
			rig.Base[name] = d.C0
		elseif d:IsA("Attachment") then
			rig.Attachments[d.Name] = d
		elseif d:IsA("BasePart") then
			if (not rig.Parts[d.Name]) or d.Name == "HumanoidRootPart" then
				rig.Parts[d.Name] = d
			end
		end
	end
	rig.Root = model:FindFirstChild("HumanoidRootPart") or rig.Parts.HumanoidRootPart
	rig.Head = rig.Parts.Head
	rig.Jaw = rig.Parts.Jaw
	rig.Mouth = rig.Parts.MouthPoint
	rig.Torso = rig.Parts.Torso
	rig.TailTip = rig.Parts.Tail5 or rig.Parts.Tail4
	rig.Humanoid = model:FindFirstChildOfClass("Humanoid")
	rig.Highlight = model:FindFirstChild("AuraHighlight")

	-- أسماء موحّدة للـ Attachments
	local A = rig.Attachments
	rig.Attachments.Breath = A.BreathOrigin or rig.Mouth
	rig.Attachments.Roar = A.RoarOrigin or rig.Head
	rig.Attachments.Aura = A.AuraOrigin or rig.Torso
	rig.Attachments.Core = A.CoreOrigin or rig.Torso
	rig.Attachments.WingL = A.WingLOrigin
	rig.Attachments.WingR = A.WingROrigin
	rig.Attachments.Tail = A.TailOrigin
	rig.Attachments.Body = A.BodyOrigin or rig.Root
	if rig.Attachments.Breath and not rig.Attachments.Breath:IsA("Attachment") then
		-- لو مفيش attachment: اعمل واحد على نقطة البؤ
		local att = Instance.new("Attachment")
		att.Name = "BreathOrigin"
		att.Parent = rig.Mouth or rig.Head
		rig.Attachments.Breath = att
	end

	function rig.ResetPose()
		for name, m in pairs(rig.Motors) do m.C0 = rig.Base[name] end
	end
	function rig.Destroy() model:Destroy() end
	function rig.GetMotor(name) return rig.Motors[name] end

	return rig
end

function RigBuilder.Build(opts)
	opts = opts or {}
	local S = opts.Scale or Config.Dragon.Scale or 1
	local CO = Config.Dragon.Colors
	local origin = (opts.CFrame or CFrame.new(0, 12 * S, 0))

	---------------------------------------------------------------
	local model = Instance.new("Model")
	model.Name = opts.Name or ("Dragon_" .. Config.Dragon.NameEn:gsub("%s", ""))
	model:SetAttribute("Scale", S)
	model:SetAttribute("IsDragon", true)

	local Rig = {
		Model = model,
		Parts = {},          -- name -> Part
		Motors = {},         -- jointName -> Motor6D
		Base = {},           -- jointName -> CFrame الأساسي
		Welds = {},
		Scale = S,
	}

	-- نقط محلية (مضروبة في المقياس)
	local function V(x, y, z) return (origin * CF(x * S, y * S, z * S)).Position end
	local function P(x, y, z) return origin * CF(x * S, y * S, z * S) end

	-- ربط عظمة متحركة بـ Motor6D
	local function attach(parent, part, jointName)
		part.Parent = model
		local m = Instance.new("Motor6D")
		m.Name = jointName .. "_Motor"
		m.Part0 = parent
		m.Part1 = part
		m.C0 = parent.CFrame:ToObjectSpace(part.CFrame)
		m.C1 = CFrame.new()
		m.Parent = parent
		Rig.Motors[jointName] = m
		Rig.Base[jointName] = m.C0
		Rig.Parts[part.Name] = part
		applyMeshOverride(part)
		return part
	end

	-- لحام قطعة زينة (مش متحركة) بـ Weld صلب
	local function weld(parent, part)
		part.Parent = model
		local w = Instance.new("Weld")
		w.Part0 = parent
		w.Part1 = part
		w.C0 = parent.CFrame:ToObjectSpace(part.CFrame)
		w.C1 = CFrame.new()
		w.Parent = parent
		Rig.Welds[part.Name] = w
		return part
	end

	-- عظمة: من نقطة (from) في اتجاه (dir) بطول (length)
	-- rightHint (اختياري): يثبّت محور X المحلي (مهم للأرجل الرأسية عشان
	-- الدوران عن X يبقى سوينج قدام/ورا مش مائل)
	local function bone(parent, partName, jointName, from, dir, length, w, h, color, material, rightHint)
		local u = dir.Unit
		local L = length * S
		local center = from + u * (L * 0.5)
		local size = V3(w * S, h * S, L)

		local cf
		if rightHint then
			local z = -u                                   -- +Z = ضهر العظمة
			local x = rightHint - z * rightHint:Dot(z)
			if x.Magnitude < 1e-4 then x = V3(1, 0, 0) - z * z.X end
			x = x.Unit
			local y = z:Cross(x)
			cf = CFrame.fromMatrix(center, x, y, z)
		else
			cf = CFrame.lookAt(center, center + u)
		end

		local p = newPart(partName, size, cf, color or CO.Body, material)
		if taper then
			-- شكل إسفيني للأطراف (مخالب/ذيول)
			p.Shape = Enum.PartType.Wedge
		end
		attach(parent, p, jointName)
		return p, from + u * L
	end

	---------------------------------------------------------------
	-- ١) الروت ( HumanoidRootPart ) — الجزء الفيزيائي الوحيد
	---------------------------------------------------------------
	local root = newPart("HumanoidRootPart", V3(2 * S, 2 * S, 2 * S), origin, CO.BodyDark)
	root.Transparency = 1
	root.CanCollide = false
	root.Massless = false
	root.Parent = model
	Rig.Root = root
	Rig.Parts.HumanoidRootPart = root
	model.PrimaryPart = root

	---------------------------------------------------------------
	-- ٢) الجسم
	---------------------------------------------------------------
	local torso = newPart("Torso", V3(6.2 * S, 5.6 * S, 11 * S), P(0, 0, 2), CO.Body)
	torso.CanCollide = true
	torso.Massless = true
	attach(root, torso, "Body")
	Rig.Torso = torso

	-- صدر عضلي
	local chest = newPart("Chest", V3(7 * S, 6.4 * S, 6.5 * S), P(0, 0.7, -3.6), CO.Body)
	chest.CanCollide = true
	weld(torso, chest)

	-- بطن / صفائح ذهبية
	local belly = newPart("Belly", V3(5.4 * S, 1.6 * S, 9.4 * S), P(0, -2.4, 1.6), CO.Belly)
	belly.Material = Enum.Material.Metal
	weld(torso, belly)

	local chestPlate = newPart("ChestPlate", V3(5.8 * S, 1.8 * S, 5.2 * S), P(0, -2.6, -3.6), CO.Belly)
	chestPlate.Material = Enum.Material.Metal
	weld(torso, chestPlate)

	---------------------------------------------------------------
	-- ٣) الرقبة + الرأس
	---------------------------------------------------------------
	local neckFrom = V(0, 2.0, -6.2)
	local dNeck0 = V3(0, 0.42, -1)
	local neck0 = bone(torso, "Neck0", "Neck0", neckFrom, dNeck0, 4.0, 3.0, 3.0, CO.Body)
	local n0End = neckFrom + dNeck0.Unit * (4.0 * S)

	local dNeck1 = V3(0, 0.28, -1)
	local neck1 = bone(neck0, "Neck1", "Neck1", n0End, dNeck1, 3.8, 2.6, 2.6, CO.Body)
	local n1End = n0End + dNeck1.Unit * (3.8 * S)

	local dHead = V3(0, 0.16, -1)
	local head = bone(neck1, "Head", "Head", n1End, dHead, 5.2, 3.4, 3.2, CO.Body)
	Rig.Head = head

	-- خطم / فك علوي
	local snout = newPart("Snout", V3(2.4 * S, 2.0 * S, 3.4 * S), P(0, 4.0, -14.2), CO.Body)
	weld(head, snout)

	-- فك سفلي (متحرك)
	local jaw = newPart("Jaw", V3(2.5 * S, 1.2 * S, 4.6 * S), P(0, 2.85, -13.4), CO.BodyDark)
	attach(head, jaw, "Jaw")
	Rig.Jaw = jaw

	-- أسنان
	for i = -1, 1, 2 do
		for k = 1, 3 do
			local t = newPart("ToothTop", V3(0.42 * S, 1.0 * S, 0.42 * S),
				P(i * 0.85, 2.95, -12.4 - k * 1.1), CO.Claw)
			t.Shape = Enum.PartType.Wedge
			t.CFrame = t.CFrame * ANG(rad(180), 0, 0)
			t.Material = Enum.Material.Metal
			weld(head, t)

			local b = newPart("ToothBot", V3(0.42 * S, 1.0 * S, 0.42 * S),
				P(i * 0.8, 3.55, -12.4 - k * 1.1), CO.Claw)
			b.Shape = Enum.PartType.Wedge
			b.Material = Enum.Material.Metal
			weld(jaw, b)
		end
	end

	-- عيون متوهجة
	for i = -1, 1, 2 do
		local eye = newPart("Eye", V3(0.85 * S, 0.85 * S, 0.6 * S), P(i * 1.35, 5.15, -12.3), CO.Eye)
		eye.Material = Enum.Material.Neon
		eye.Shape = Enum.PartType.Ball
		weld(head, eye)

		local light = Instance.new("PointLight")
		light.Color = CO.Eye
		light.Range = 9 * S
		light.Brightness = 2.2
		light.Parent = eye

		-- حاجب غضبان
		local brow = newPart("Brow", V3(1.3 * S, 0.5 * S, 1.6 * S), P(i * 1.35, 5.75, -12.4), CO.Spike)
		brow.CFrame = brow.CFrame * ANG(rad(-18), 0, rad(i * 14))
		weld(head, brow)
	end

	-- قرون كبيرة
	for i = -1, 1, 2 do
		local horn = newPart("Horn", V3(0.8 * S, 4.6 * S, 0.8 * S), P(i * 1.3, 6.2, -10.2), CO.Horn)
		horn.Shape = Enum.PartType.Cylinder
		horn.Material = Enum.Material.Marble
		horn.CFrame = P(i * 1.3, 6.2, -10.2) * ANG(0, 0, rad(i * 26)) * ANG(rad(-38), 0, 0)
		weld(head, horn)

		local tip = newPart("HornTip", V3(0.55 * S, 1.8 * S, 0.55 * S), (horn.CFrame * CF(0, 2.6 * S, 0)), CO.Horn)
		tip.Shape = Enum.PartType.Cylinder
		tip.Material = Enum.Material.Marble
		tip.CFrame = horn.CFrame * CF(0, 2.9 * S, 0) * ANG(rad(-22), 0, 0)
		weld(horn, tip)

		-- قرن صغير تحت
		local sh = newPart("HornSmall", V3(0.5 * S, 2.4 * S, 0.5 * S), P(i * 1.7, 5.0, -9.4), CO.Horn)
		sh.Shape = Enum.PartType.Cylinder
		sh.Material = Enum.Material.Marble
		sh.CFrame = P(i * 1.7, 5.0, -9.4) * ANG(0, 0, rad(i * 42)) * ANG(rad(25), 0, 0)
		weld(head, sh)
	end

	-- قرن الأنف + شوكات الخد
	local nose = newPart("NoseHorn", V3(0.6 * S, 1.6 * S, 1.2 * S), P(0, 5.2, -14.6), CO.Horn)
	nose.Shape = Enum.PartType.Wedge
	nose.CFrame = nose.CFrame * ANG(rad(-28), 0, 0)
	nose.Material = Enum.Material.Marble
	weld(head, nose)

	-- نقطة خروج النار من الفم (مهمة جداً للـ VFX)
	local mouth = newPart("MouthPoint", V3(0.2 * S, 0.2 * S, 0.2 * S), P(0, 3.5, -14.6), CO.Eye)
	mouth.Transparency = 1
	mouth.Material = Enum.Material.Neon
	weld(head, mouth)
	Rig.Mouth = mouth

	---------------------------------------------------------------
	-- ٤) الأشواك على الظهر
	---------------------------------------------------------------
	for i = 0, 8 do
		local z = -5 + i * 1.75
		local h = 2.6 - math.abs(i - 3) * 0.16
		local sp = newPart("BackSpike", V3(1.3 * S, h * S, 1.9 * S), P(0, 3.4 + h * 0.28, z), CO.Spike)
		sp.Shape = Enum.PartType.Wedge
		sp.CFrame = sp.CFrame * ANG(rad(14), 0, 0)
		sp.Material = Enum.Material.Slate
		weld(torso, sp)
	end

	---------------------------------------------------------------
	-- ٥) الذيل (سلسلة 6 عظام + زعنفة)
	---------------------------------------------------------------
	local tailParent = torso
	local tailFrom = V(0, -0.2, 7.4)
	local tailDirs = {
		V3(0, 0.04, 1), V3(0, 0.06, 1), V3(0, 0.10, 1),
		V3(0, 0.14, 1), V3(0, 0.18, 1), V3(0, 0.22, 1),
	}
	local tailLens = { 4.2, 4.0, 3.8, 3.4, 3.0, 2.6 }
	local tailWid = { 3.6, 3.0, 2.5, 2.0, 1.5, 1.0 }
	local tailEnd = tailFrom
	for i = 1, 6 do
		local nm = "Tail" .. (i - 1)
		local p, e = bone(tailParent, nm, nm, tailEnd, tailDirs[i], tailLens[i], tailWid[i], tailWid[i],
			(i % 2 == 0) and CO.BodyDark or CO.Body)
		tailEnd = e
		tailParent = p

		-- شوكة فوق كل فقرة
		local sp = newPart("TailSpike", V3(0.9 * S, 1.5 * S, 1.4 * S),
			p.CFrame * CF(0, tailWid[i] * 0.55 * S, 0), CO.Spike)
		sp.Shape = Enum.PartType.Wedge
		sp.CFrame = sp.CFrame * ANG(rad(12), 0, 0)
		sp.Material = Enum.Material.Slate
		weld(p, sp)
	end
	Rig.TailTip = tailParent

	-- زعنفة آخر الذيل
	local fin = newPart("TailFin", V3(0.5 * S, 4.4 * S, 3.4 * S), tailEnd, CO.Membrane)
	fin.Shape = Enum.PartType.Wedge
	fin.Material = Enum.Material.Fabric
	fin.Transparency = 0.08
	fin.Color = CO.Membrane
	weld(tailParent, fin)

	---------------------------------------------------------------
	-- ٦) الأجنحة (يمين + شمال)
	---------------------------------------------------------------
	local function buildWing(side)  -- side = 1 يمين (+X)  /  -1 شمال
		local sx = side
		local tag = (side > 0) and "R" or "L"

		-- كتف الجناح
		local shoulderPos = V(sx * 3.4, 2.6, -1.8)
		local wroot = newPart("Wing" .. tag .. "_Shoulder", V3(2.2 * S, 2.0 * S, 3.4 * S), P(sx * 3.6, 2.6, -1.8), CO.Body)
		attach(torso, wroot, "Wing" .. tag .. "_Shoulder")

		-- عظمة العضد
		local d1 = V3(sx * 0.88, 0.30, 0.36)
		local wupper, elbow = bone(wroot, "Wing" .. tag .. "_Upper", "Wing" .. tag .. "_Upper",
			shoulderPos, d1, 7.5, 1.5, 1.2, CO.Body)

		-- الساعد
		local d2 = V3(sx * 0.93, 0.10, -0.35)
		local wfore, wrist = bone(wupper, "Wing" .. tag .. "_Fore", "Wing" .. tag .. "_Fore",
			elbow, d2, 9.0, 1.2, 1.0, CO.Body)

		-- ثلاث أصابع (البراثن اللي بيشدوا الغشاء)
		local fan = { -0.62, -0.14, 0.34 }
		local lens = { 9.5, 10.5, 8.5 }
		local fingerParts = {}
		for i = 1, 3 do
			local yaw = fan[i]
			local dir = V3(sx * math.cos(yaw), -0.02, math.sin(yaw) * sx * 0.9)
			local nm = "Wing" .. tag .. "_F" .. i
			local p, _ = bone(wfore, nm, nm, wrist, dir, lens[i], 0.7, 0.7, CO.Body)
			fingerParts[i] = p
		end

		-----------------------------------------------------------
		-- الغشاء (Panels) — ألواح رقيقة تتحرك مع العظام
		-----------------------------------------------------------
		local backDir = (origin * CF(0, 0, 1)).Position - origin.Position   -- اتجاه ضهر التنين

		local function panel(parent, from, dir, span, back, thickness, color, ttrans)
			local u = dir.Unit
			local L = span * S
			local perp = Vector3.new(0, 1, 0):Cross(u)
			if perp.Magnitude < 1e-4 then perp = Vector3.new(1, 0, 0) end
			perp = perp.Unit
			if perp:Dot(backDir) < 0 then perp = -perp end
			local center = from + u * (L * 0.5) + perp * (back * S)
			local p = newPart("Membrane" .. tag, V3(back * 2 * S, thickness * S, L),
				CFrame.lookAt(center, center + u), color or CO.Membrane, Enum.Material.Fabric)
			p.Transparency = ttrans or 0.1
			return weld(parent, p)
		end

		-- لوح بين الجسم والكوع
		panel(wupper, shoulderPos, d1, 7.0, 3.2, 0.28, CO.Membrane, 0.06)
		-- لوح بين الكوع والرسغ
		panel(wfore, elbow, d2, 8.4, 3.6, 0.26, CO.Membrane, 0.06)
		-- ألواح بين الأصابع
		for i = 1, 3 do
			local yaw = fan[i]
			local dir = V3(sx * math.cos(yaw), -0.02, math.sin(yaw) * sx * 0.9)
			panel(fingerParts[i], wrist, dir, lens[i] * 0.95, 2.6 + i * 0.5, 0.22, CO.Membrane, 0.08)
		end

		-- عروق متوهجة في الغشاء (نيون)
		for i = 1, 3 do
			local yaw = fan[i]
			local dir = V3(sx * math.cos(yaw), -0.02, math.sin(yaw) * sx * 0.9)
			local u = dir.Unit
			local center = wrist + u * (lens[i] * 0.5 * S) + V3(0, 0.16 * S, 0)
			local vein = newPart("Vein" .. tag .. i, V3(0.35 * S, 0.16 * S, lens[i] * 0.9 * S),
				CFrame.lookAt(center, center + u), CO.MembraneGlow, Enum.Material.Neon)
			vein.Transparency = 0.25
			weld(fingerParts[i], vein)
		end

		-- مخلب طرف الجناح
		local claw = newPart("WingClaw" .. tag, V3(0.6 * S, 1.8 * S, 1.6 * S),
			fingerParts[2].CFrame * CF(0, -0.2 * S, -lens[2] * 0.45 * S), CO.Claw)
		claw.Shape = Enum.PartType.Wedge
		claw.Material = Enum.Material.Metal
		weld(fingerParts[2], claw)

		Rig.Parts["WingTip" .. tag] = fingerParts[2]
	end

	buildWing(1)
	buildWing(-1)

	---------------------------------------------------------------
	-- ٧) الأرجل (4)
	---------------------------------------------------------------
	local function buildLeg(tag, hipX, hipZ, thighLen, shinLen, scale)
		local hipPos = V(hipX, -1.4, hipZ)   -- V بتحول الإحداثيات المحلية لإحداثيات العالم
		local hip = newPart("Leg" .. tag .. "_Hip", V3(2.2 * S * scale, 2.2 * S * scale, 2.6 * S * scale),
			P(hipX, -1.4, hipZ), CO.Body)
		attach(torso, hip, "Leg" .. tag .. "_Hip")

		-- فخذ
		local dThigh = V3(hipX > 0 and 0.12 or -0.12, -1, 0.10)
		local thigh, knee = bone(hip, "Leg" .. tag .. "_Thigh", "Leg" .. tag .. "_Thigh",
			hipPos, dThigh, thighLen, 2.0 * scale, 2.4 * scale, CO.Body, nil, V3(1, 0, 0))

		-- ساق
		local dShin = V3(hipX > 0 and -0.06 or 0.06, -1, -0.14)
		local shin, ankle = bone(thigh, "Leg" .. tag .. "_Shin", "Leg" .. tag .. "_Shin",
			knee, dShin, shinLen, 1.7 * scale, 2.0 * scale, CO.Body, nil, V3(1, 0, 0))

		-- قدم
		local foot = newPart("Leg" .. tag .. "_Foot", V3(2.4 * S * scale, 1.0 * S * scale, 3.6 * S * scale),
			CF(ankle.X, ankle.Y - 0.4 * S, ankle.Z - 0.5 * S), CO.BodyDark)
		attach(shin, foot, "Leg" .. tag .. "_Foot")

		-- مخالب
		for i = -1, 1 do
			local cl = newPart("Leg" .. tag .. "_Claw", V3(0.55 * S * scale, 0.8 * S * scale, 1.5 * S * scale),
				foot.CFrame * CF(i * 0.75 * S * scale, -0.1 * S, -2.0 * S * scale), CO.Claw)
			cl.Shape = Enum.PartType.Wedge
			cl.Material = Enum.Material.Metal
			cl.CFrame = cl.CFrame * ANG(rad(-90), 0, 0)
			weld(foot, cl)
		end

		-- شوكة الكوع
		local sp = newPart("Leg" .. tag .. "_Spike", V3(0.8 * S * scale, 1.6 * S * scale, 1.4 * S * scale),
			CF(knee.X, knee.Y, knee.Z) * CF(0, 0, -1.2 * S * scale), CO.Spike)
		sp.Shape = Enum.PartType.Wedge
		sp.CFrame = sp.CFrame * ANG(rad(-90), 0, 0)
		sp.Material = Enum.Material.Slate
		weld(shin, sp)
	end

	-- أمامية
	buildLeg("FL", 2.9, -3.4, 5.0, 4.6, 0.92)
	buildLeg("FR", -2.9, -3.4, 5.0, 4.6, 0.92)
	-- خلفية (أكبر وأقوى)
	buildLeg("BL", 3.2, 4.8, 4.8, 4.5, 1.15)
	buildLeg("BR", -3.2, 4.8, 4.8, 4.5, 1.15)

	---------------------------------------------------------------
	-- ٨) الهيومانويد + اللمسات الأخيرة
	---------------------------------------------------------------
	local hum = Instance.new("Humanoid")
	hum.Name = "DragonHumanoid"
	hum.Health = Config.Dragon.Health
	hum.MaxHealth = Config.Dragon.Health
	hum.WalkSpeed = Config.Dragon.WalkSpeed
	hum.JumpPower = Config.Dragon.JumpPower
	hum.HipHeight = 11.5 * S
	hum.AutoRotate = true
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.Parent = model
	Rig.Humanoid = hum

	-- توهج (بيستخدم في وضعية الاستيقاظ)
	local hl = Instance.new("Highlight")
	hl.Name = "AuraHighlight"
	hl.FillColor = CO.Glow
	hl.FillTransparency = 1
	hl.OutlineColor = CO.Eye
	hl.OutlineTransparency = 1
	hl.Parent = model
	Rig.Highlight = hl

	---------------------------------------------------------------
	-- Attachments للـ VFX (بيتحركوا مع العظام أوتوماتيك)
	---------------------------------------------------------------
	local function att(parent, name, offset)
		local a = Instance.new("Attachment")
		a.Name = name
		if offset then a.Position = offset end
		a.Parent = parent
		return a
	end
	Rig.Attachments = {
		Breath = att(Rig.Mouth, "BreathOrigin"),
		Roar = att(Rig.Head, "RoarOrigin", V3(0, 0, -1.5 * S)),
		Aura = att(Rig.Torso, "AuraOrigin"),
		Core = att(Rig.Torso, "CoreOrigin", V3(0, 1.6 * S, -2.0 * S)),
		WingL = att(Rig.Parts.WingTipL, "WingLOrigin"),
		WingR = att(Rig.Parts.WingTipR, "WingROrigin"),
		Tail = att(Rig.TailTip, "TailOrigin"),
		Body = att(Rig.Root, "BodyOrigin"),
	}

	---------------------------------------------------------------
	-- دوال مساعدة على الـ Rig
	---------------------------------------------------------------
	function Rig.GetMotor(name) return Rig.Motors[name] end

	function Rig.ResetPose()
		for name, m in pairs(Rig.Motors) do
			m.C0 = Rig.Base[name]
		end
	end

	function Rig.SetPrimary(cf)
		model:SetPrimaryPartCFrame(cf)
	end

	function Rig.Destroy()
		model:Destroy()
	end

	return Rig
end

return RigBuilder

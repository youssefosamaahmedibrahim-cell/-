--[[
	====================================================================
	AnimationData.lua — كل الحركات (Clips) مكتوبة بالكود
	====================================================================
	كل Clip = { Length, Loop, Priority, Ease, Keys = { {t, Pose} }, Events }
	الوضعية (Pose) = جدول: اسم المفصل -> CFrame إزاحة عن الوضع الأساسي

	الحركات:
	  Idle, Walk, Run, Fly, Glide            (حلقات متكررة)
	  FireBreath, ClawBarrage, MeteorCast,
	  ThunderCast, Roar, Hit, Transform,
	  Takeoff, Land                          (حركات مرة واحدة)
]]

local AnimationData = {}
local Config = require(script.Parent.Config)

local CF, ANG = CFrame.new, CFrame.Angles
local rad, sin, cos, pi = math.rad, math.sin, math.cos, math.pi

---------------------------------------------------------------------
-- أدوات بناء الوضعيات
---------------------------------------------------------------------
-- R: زوايا بالدرجات (rx, ry, rz) + إزاحة مكان (px, py, pz)
local function R(rx, ry, rz, px, py, pz)
	return CF(px or 0, py or 0, pz or 0) * ANG(rad(rx or 0), rad(ry or 0), rad(rz or 0))
end

-- دمج أكتر من وضعية في جدول واحد
local function M(...)
	local out = {}
	for i = 1, select("#", ...) do
		local t = select(i, ...)
		if t then for k, v in pairs(t) do out[k] = v end end
	end
	return out
end

-- الأجنحة: بيولّد اليمين والشمال أوتوماتيك (مرآة صحيحة)
-- الترتيب في البيانات: [رفة/فرد (rx), مسح (ry), ميل (rz)]
-- ملحوظة: عظمة الجناح ممتدة على -Z فـ rx هو اللي بيرفع ويوطّي (الرفة)
local function W(spec)
	local out = {}
	for _, side in ipairs({ "L", "R" }) do
		local s = (side == "R") and 1 or -1
		for joint, v in pairs(spec) do
			out["Wing" .. side .. "_" .. joint] = R(v[1], s * (v[2] or 0), s * (v[3] or 0))
		end
	end
	return out
end

-- الأرجل: spec = { {"FL","Thigh", rx, ry, rz}, ... }
local function L(spec)
	local out = {}
	for _, e in ipairs(spec) do
		local tag, part, rx, ry, rz = e[1], e[2], e[3] or 0, e[4] or 0, e[5] or 0
		local s = (tag == "FL" or tag == "BL") and 1 or -1
		out["Leg" .. tag .. "_" .. part] = R(rx, s * ry, s * rz)
	end
	return out
end

-- الذيل: موجة بتنتشر من الأول للآخر
local function T(ampYaw, ampPitch, phase)
	local out = {}
	for i = 0, 5 do
		local f = 0.3 + (i / 5) * 0.7
		out["Tail" .. i] = R(ampPitch * f * sin(phase - i * 0.45), ampYaw * f * sin(phase - i * 0.55), 0)
	end
	return out
end

-- كل الأرجل الأربعة من منظومة مشية واحدة
local function gait(u, amp, phaseA)
	local p = u * pi * 2
	local sA = sin(p + phaseA)
	local sB = sin(p + phaseA + pi)
	local liftA = math.max(0, sA) ^ 2
	local liftB = math.max(0, sB) ^ 2
	return M(
		L({
			{ "FL", "Thigh", sA * amp, 0, 2 }, { "FL", "Shin", -4 - liftA * amp * 1.5, 0, 0 },
			{ "FL", "Foot", 6 + liftA * amp * 0.8, 0, 0 },
			{ "BR", "Thigh", sA * amp, 0, 2 }, { "BR", "Shin", -4 - liftA * amp * 1.5, 0, 0 },
			{ "BR", "Foot", 6 + liftA * amp * 0.8, 0, 0 },
			{ "FR", "Thigh", sB * amp, 0, 2 }, { "FR", "Shin", -4 - liftB * amp * 1.5, 0, 0 },
			{ "FR", "Foot", 6 + liftB * amp * 0.8, 0, 0 },
			{ "BL", "Thigh", sB * amp, 0, 2 }, { "BL", "Shin", -4 - liftB * amp * 1.5, 0, 0 },
			{ "BL", "Foot", 6 + liftB * amp * 0.8, 0, 0 },
		}),
		{ Body = R(0, 0, 0, 0, -(liftA + liftB) * 0.45, 0) }
	)
end

-- أرجل مطوية وقت الطيران
local function tuck(u, amount)
	local w = sin(u * pi * 2) * 3
	return L({
		{ "FL", "Thigh", -26 + w, 0, 4 }, { "FL", "Shin", 58 - w, 0, 0 }, { "FL", "Foot", 26, 0, 0 },
		{ "FR", "Thigh", -26 + w, 0, 4 }, { "FR", "Shin", 58 - w, 0, 0 }, { "FR", "Foot", 26, 0, 0 },
		{ "BL", "Thigh", -22 - w, 0, 5 }, { "BL", "Shin", 62 + w, 0, 0 }, { "BL", "Foot", 24, 0, 0 },
		{ "BR", "Thigh", -22 - w, 0, 5 }, { "BR", "Shin", 62 + w, 0, 0 }, { "BR", "Foot", 24, 0, 0 },
	})
end

---------------------------------------------------------------------
-- مولّد كليب من دالة (عيّنات) — للحلقات السلسة
---------------------------------------------------------------------
local function fromSampler(name, cfg, fn)
	local keys = {}
	local n = cfg.Samples or 14
	for i = 0, n do
		local u = i / n
		keys[#keys + 1] = { t = u * cfg.Length, Pose = fn(u) }
	end
	return {
		Name = name, Loop = true, Length = cfg.Length,
		Priority = cfg.Priority or 1, Ease = "Linear",
		FadeIn = cfg.FadeIn or 0.3, FadeOut = cfg.FadeOut or 0.3,
		Keys = keys,
	}
end

---------------------------------------------------------------------
-- بناء كل الحركات (بمقياس التنين)
---------------------------------------------------------------------
function AnimationData.Build(scale)
	scale = scale or Config.Dragon.Scale or 1

	-----------------------------------------------------------------
	-- ١) الوقوف (Idle) — تنفس + التفاتة ذيل + رفة جناح خفيفة
	-----------------------------------------------------------------
	local function idlePose(b, ph)
		return M(
			{ Body = R(1.2 + b * 1.4, 0, 0, 0, -0.3 + b * 0.55, 0) },
			{ Neck0 = R(-5 - b * 3.5), Neck1 = R(-3 - b * 2), Head = R(4 + b * 3), Jaw = R(6 + b * 7) },
			W({
				Shoulder = {-4, -6 - b * 2, 0},
				Upper    = {-18 + b * 5, -34 - b * 3, 0},
				Fore     = {-13 + b * 4, -46 - b * 4, 0},
				F1       = {-6, -20, 0}, F2 = {-5, -14, 0}, F3 = {-4, -10, 0},
			}),
			L({
				{ "FL", "Thigh", 3, 0, 2 }, { "FL", "Shin", -6, 0, 0 }, { "FL", "Foot", 5, 0, 0 },
				{ "FR", "Thigh", 3, 0, 2 }, { "FR", "Shin", -6, 0, 0 }, { "FR", "Foot", 5, 0, 0 },
				{ "BL", "Thigh", -2, 0, 3 }, { "BL", "Shin", -8, 0, 0 }, { "BL", "Foot", 6, 0, 0 },
				{ "BR", "Thigh", -2, 0, 3 }, { "BR", "Shin", -8, 0, 0 }, { "BR", "Foot", 6, 0, 0 },
			}),
			T(7, 3, ph)
		)
	end

	local Idle = {
		Name = "Idle", Loop = true, Length = 3.4, Priority = 0, Ease = "Smooth",
		FadeIn = 0.4, FadeOut = 0.4,
		Keys = {
			{ t = 0.0, Pose = idlePose(0, 0) },
			{ t = 1.7, Pose = idlePose(1, pi * 0.9) },
			{ t = 3.4, Pose = idlePose(0, pi * 2) },
		},
	}

	-----------------------------------------------------------------
	-- ٢) المشي (Walk) — مشية قطرية
	-----------------------------------------------------------------
	local Walk = fromSampler("Walk", { Length = 1.15, Priority = 1, Samples = 16, FadeIn = 0.3 }, function(u)
		local p = u * pi * 2
		return M(
			gait(u, 15, 0),
			{ Body = R(-2, sin(p) * 2, 0, 0, sin(p * 2) * 0.35, 0) },
			{ Neck0 = R(-4 + sin(p) * 3), Neck1 = R(-2 + sin(p) * 2), Head = R(3 - sin(p) * 2), Jaw = R(7) },
			W({
				Shoulder = {-4, -6, 0},
				Upper    = {-20 - sin(p) * 7, -32 + sin(p) * 5, 0},
				Fore     = {-14 - sin(p) * 5, -44 + sin(p) * 6, 0},
				F1       = {-6, -18, 0}, F2 = {-5, -13, 0}, F3 = {-4, -9, 0},
			}),
			T(11, 4, p * 0.5 + 0.6)
		)
	end)

	-----------------------------------------------------------------
	-- ٣) الجري (Run)
	-----------------------------------------------------------------
	local Run = fromSampler("Run", { Length = 0.62, Priority = 1, Samples = 14, FadeIn = 0.22 }, function(u)
		local p = u * pi * 2
		return M(
			gait(u, 27, 0),
			{ Body = R(-9, sin(p) * 3, 0, 0, sin(p * 2) * 0.8, 0) },
			{ Neck0 = R(-12 + sin(p) * 5), Neck1 = R(-6 + sin(p) * 3), Head = R(8 - sin(p) * 3), Jaw = R(12) },
			W({
				Shoulder = {-6, -10, 0},
				Upper    = {-26 - sin(p) * 12, -26 + sin(p) * 10, 0},
				Fore     = {-20 - sin(p) * 8, -38 + sin(p) * 12, 0},
				F1       = {-8, -16, 0}, F2 = {-6, -12, 0}, F3 = {-5, -8, 0},
			}),
			T(16, 7, p * 0.5 + 1.1)
		)
	end)

	-----------------------------------------------------------------
	-- ٤) الطيران (Fly) — الرفة الأسطورية
	-----------------------------------------------------------------
	local Fly = fromSampler("Fly", { Length = 1.45, Priority = 1, Samples = 18, FadeIn = 0.35 }, function(u)
		local p = u * pi * 2
		-- نزول سريع وطلوع أبطأ (موجة مشوهة)
		local flap = sin(p + 0.42 * sin(p))
		local flap2 = sin(p - 0.55 + 0.3 * sin(p))
		local flap3 = sin(p - 1.05)
		return M(
			tuck(u, 1),
			{ Body = R(-4 + flap * 3, 0, 0, 0, -flap * 1.7, 0) },
			{ Neck0 = R(2 + flap * 2), Neck1 = R(1 + flap * 1.5), Head = R(-1), Jaw = R(8) },
			W({
				Shoulder = {0, -4 - flap * 4, 0},
				Upper    = {10 + flap * 50, -10 - flap * 12, 0},
				Fore     = {4 + flap2 * 40, -6 - flap2 * 8, 0},
				F1       = {flap3 * 16, 0, 0}, F2 = {flap3 * 13, 0, 0}, F3 = {flap3 * 10, 0, 0},
			}),
			T(6, 6, p * 0.5 + 0.4)
		)
	end)

	-----------------------------------------------------------------
	-- ٥) الانزلاق (Glide)
	-----------------------------------------------------------------
	local Glide = fromSampler("Glide", { Length = 6.0, Priority = 1, Samples = 16, FadeIn = 0.6 }, function(u)
		local p = u * pi * 2
		return M(
			tuck(u * 0.4, 1),
			{ Body = R(-2 + sin(p) * 2, sin(p * 0.5) * 3, 0, 0, sin(p * 0.5) * 0.9, 0) },
			{ Neck0 = R(3 + sin(p) * 2), Neck1 = R(2), Head = R(-1), Jaw = R(6) },
			W({
				Shoulder = {0, -2, 0},
				Upper    = {6 + sin(p) * 8, -3 + sin(p) * 5, 0},
				Fore     = {-2 + sin(p - 0.4) * 6, -2 + sin(p - 0.4) * 4, 0},
				F1       = {4, -8, 0}, F2 = {3, -4, 0}, F3 = {2, 0, 0},
			}),
			T(5, 3, p * 0.5)
		)
	end)

	-----------------------------------------------------------------
	-- ٦) نَفَس النار (FireBreath) — Z
	-----------------------------------------------------------------
	local FireBreath = {
		Name = "FireBreath", Loop = false, Length = 2.0, Priority = 3, Ease = "Smooth",
		FadeIn = 0.12, FadeOut = 0.25,
		Events = { { t = 0.30, Name = "Cast" }, { t = 1.80, Name = "End" } },
		Keys = {
			{ t = 0.0, Pose = M(
				{ Body = R(-7, 0, 0, 0, -0.5, 0.4) },
				{ Neck0 = R(-9), Neck1 = R(-7), Head = R(7), Jaw = R(5) },
				W({ Shoulder = {-6, -8, 0}, Upper = {-12, -26, 0}, Fore = {-10, -40, 0},
					F1 = {-6, -18, 0}, F2 = {-5, -12, 0}, F3 = {-4, -8, 0} }),
				L({ { "BL", "Thigh", -8, 0, 3 }, { "BR", "Thigh", -8, 0, 3 } }),
				T(4, 8, 0.4)
			)},
			{ t = 0.30, Pose = M(
				{ Body = R(-11, 0, 0, 0, -0.7, 0.8) },
				{ Neck0 = R(-16), Neck1 = R(-13), Head = R(13), Jaw = R(46) },
				W({ Shoulder = {-10, -14, 0}, Upper = {8, -20, 0}, Fore = {-6, -26, 0},
					F1 = {6, -12, 0}, F2 = {5, -8, 0}, F3 = {4, -6, 0} }),
				L({ { "BL", "Thigh", -12, 0, 4 }, { "BR", "Thigh", -12, 0, 4 } }),
				T(3, 12, 0.8)
			)},
			{ t = 1.55, Pose = M(
				{ Body = R(-4, 0, 0, 0, -0.4, 0.2) },
				{ Neck0 = R(-3), Neck1 = R(-2), Head = R(2), Jaw = R(50) },
				W({ Shoulder = {-8, -12, 0}, Upper = {14, -18, 0}, Fore = {-2, -22, 0},
					F1 = {8, -10, 0}, F2 = {6, -6, 0}, F3 = {5, -4, 0} }),
				L({ { "BL", "Thigh", -9, 0, 3 }, { "BR", "Thigh", -9, 0, 3 } }),
				T(4, 6, 1.6)
			)},
			{ t = 2.0, Pose = M(
				{ Body = R(-5, 0, 0, 0, -0.3, 0) },
				{ Neck0 = R(-7), Neck1 = R(-4), Head = R(5), Jaw = R(12) },
				W({ Shoulder = {-5, -8, 0}, Upper = {-10, -28, 0}, Fore = {-10, -42, 0},
					F1 = {-6, -18, 0}, F2 = {-5, -12, 0}, F3 = {-4, -8, 0} }),
				T(5, 4, 2.2)
			)},
		},
	}

	-----------------------------------------------------------------
	-- ٧) مَخَالِب العاصفة (ClawBarrage) — X
	-----------------------------------------------------------------
	local function clawPose(u, swing, side)
		local s = side or 1
		local base = M(
			{ Body = R(-10 + swing * 12, -swing * 8 * s, 0, 0, -0.6 + swing * 0.4, 0) },
			{ Neck0 = R(-6 + swing * 6), Neck1 = R(-4 + swing * 4), Head = R(6 - swing * 3), Jaw = R(26 + swing * 10) },
			W({ Shoulder = {-8, -14, 0}, Upper = {-6 - swing * 12, -24 + swing * 10, 0},
				Fore = {-16, -34, 0}, F1 = {-8, -14, 0}, F2 = {-6, -10, 0}, F3 = {-5, -7, 0} }),
			T(10, 6, u * 4)
		)
		if s > 0 then
			return M(base, L({
				{ "FL", "Thigh", 30 - swing * 58, 0, 6 }, { "FL", "Shin", -46 + swing * 34, 0, 0 },
				{ "FL", "Foot", 20, 0, 0 },
				{ "FR", "Thigh", -14, 0, 4 }, { "FR", "Shin", -20, 0, 0 }, { "FR", "Foot", 12, 0, 0 },
			}))
		else
			return M(base, L({
				{ "FR", "Thigh", 30 - swing * 58, 0, 6 }, { "FR", "Shin", -46 + swing * 34, 0, 0 },
				{ "FR", "Foot", 20, 0, 0 },
				{ "FL", "Thigh", -14, 0, 4 }, { "FL", "Shin", -20, 0, 0 }, { "FL", "Foot", 12, 0, 0 },
			}))
		end
	end

	local ClawBarrage = {
		Name = "ClawBarrage", Loop = false, Length = 1.25, Priority = 3, Ease = "Out",
		FadeIn = 0.08, FadeOut = 0.2,
		Events = {
			{ t = 0.06, Name = "Dash" },
			{ t = 0.24, Name = "Slash1" }, { t = 0.46, Name = "Slash2" },
			{ t = 0.68, Name = "Slash3" }, { t = 0.90, Name = "Slash4" },
			{ t = 1.10, Name = "End" },
		},
		Keys = {
			{ t = 0.00, Pose = clawPose(0, 0, 1) },
			{ t = 0.24, Pose = clawPose(1, 1, 1) },
			{ t = 0.46, Pose = clawPose(2, 1, -1) },
			{ t = 0.68, Pose = clawPose(3, 1, 1) },
			{ t = 0.90, Pose = clawPose(4, 1, -1) },
			{ t = 1.25, Pose = clawPose(5, 0, 1) },
		},
	}

	-----------------------------------------------------------------
	-- ٨) مطر النيازك (MeteorCast) — C
	-----------------------------------------------------------------
	local MeteorCast = {
		Name = "MeteorCast", Loop = false, Length = 2.60, Priority = 3, Ease = "Smooth",
		FadeIn = 0.14, FadeOut = 0.35,
		Events = {
			{ t = 0.55, Name = "Roar" }, { t = 0.85, Name = "Summon" },
			{ t = 2.10, Name = "Slam" }, { t = 2.50, Name = "End" },
		},
		Keys = {
			{ t = 0.00, Pose = M(
				{ Body = R(-16, 0, 0, 0, -1.6, 0) },
				{ Neck0 = R(-14), Neck1 = R(-10), Head = R(10), Jaw = R(10) },
				W({ Shoulder = {-10, -6, 0}, Upper = {-26, -30, 0}, Fore = {-20, -44, 0},
					F1 = {-10, -20, 0}, F2 = {-8, -14, 0}, F3 = {-6, -10, 0} }),
				L({ { "FL", "Thigh", 10, 0, 3 }, { "FR", "Thigh", 10, 0, 3 },
					{ "BL", "Thigh", -10, 0, 4 }, { "BR", "Thigh", -10, 0, 4 },
					{ "BL", "Shin", -26, 0, 0 }, { "BR", "Shin", -26, 0, 0 } }),
				T(6, 14, 0.2)
			)},
			{ t = 0.55, Pose = M(
				{ Body = R(6, 0, 0, 0, 2.4, -0.6) },
				{ Neck0 = R(16), Neck1 = R(10), Head = R(-8), Jaw = R(58) },
				W({ Shoulder = {6, -10, 0}, Upper = {46, -6, 0}, Fore = {24, -14, 0},
					F1 = {18, 0, 0}, F2 = {14, 0, 0}, F3 = {10, 0, 0} }),
				tuck(0.25, 1),
				T(4, 18, 0.9)
			)},
			{ t = 1.40, Pose = M(
				{ Body = R(10, 0, 0, 0, 3.0, -0.8) },
				{ Neck0 = R(20), Neck1 = R(12), Head = R(-10), Jaw = R(62) },
				W({ Shoulder = {4, -8, 0}, Upper = {34, -4, 0}, Fore = {16, -10, 0},
					F1 = {12, 0, 0}, F2 = {10, 0, 0}, F3 = {8, 0, 0} }),
				tuck(0.5, 1),
				T(5, 16, 1.4)
			)},
			{ t = 2.10, Pose = M(
				{ Body = R(-6, 0, 0, 0, 1.4, -0.3) },
				{ Neck0 = R(4), Neck1 = R(2), Head = R(-2), Jaw = R(40) },
				W({ Shoulder = {-10, -12, 0}, Upper = {-34, -18, 0}, Fore = {-30, -30, 0},
					F1 = {-12, -14, 0}, F2 = {-10, -10, 0}, F3 = {-8, -7, 0} }),
				tuck(0.75, 1),
				T(6, 10, 2.0)
			)},
			{ t = 2.60, Pose = M(
				{ Body = R(-8, 0, 0, 0, -1.2, 0) },
				{ Neck0 = R(-8), Neck1 = R(-5), Head = R(6), Jaw = R(14) },
				W({ Shoulder = {-6, -8, 0}, Upper = {-18, -28, 0}, Fore = {-14, -42, 0},
					F1 = {-7, -18, 0}, F2 = {-6, -13, 0}, F3 = {-5, -9, 0} }),
				L({ { "BL", "Thigh", -6, 0, 3 }, { "BR", "Thigh", -6, 0, 3 } }),
				T(6, 6, 2.6)
			)},
		},
	}

	-----------------------------------------------------------------
	-- ٩) عاصفة الرعد (ThunderCast) — V
	-----------------------------------------------------------------
	local ThunderCast = {
		Name = "ThunderCast", Loop = false, Length = 3.10, Priority = 3, Ease = "Smooth",
		FadeIn = 0.14, FadeOut = 0.4,
		Events = {
			{ t = 0.70, Name = "Roar" }, { t = 0.95, Name = "Awaken" },
			{ t = 1.30, Name = "Bolts" }, { t = 2.60, Name = "End" },
		},
		Keys = {
			{ t = 0.00, Pose = M(
				{ Body = R(-18, 0, 0, 0, -1.8, 0) },
				{ Neck0 = R(-16), Neck1 = R(-11), Head = R(12), Jaw = R(8) },
				W({ Shoulder = {-12, -4, 0}, Upper = {-30, -28, 0}, Fore = {-24, -42, 0},
					F1 = {-12, -22, 0}, F2 = {-10, -16, 0}, F3 = {-8, -11, 0} }),
				L({ { "FL", "Thigh", 14, 0, 4 }, { "FR", "Thigh", 14, 0, 4 },
					{ "BL", "Thigh", -14, 0, 5 }, { "BR", "Thigh", -14, 0, 5 },
					{ "BL", "Shin", -30, 0, 0 }, { "BR", "Shin", -30, 0, 0 } }),
				T(5, 16, 0.1)
			)},
			{ t = 0.70, Pose = M(   -- صعود + فرد الأجنحة + زئير
				{ Body = R(14, 0, 0, 0, 3.2, -0.8) },
				{ Neck0 = R(22), Neck1 = R(14), Head = R(-12), Jaw = R(64) },
				W({ Shoulder = {8, -12, 0}, Upper = {58, -2, 0}, Fore = {34, -8, 0},
					F1 = {24, 0, 0}, F2 = {20, 0, 0}, F3 = {15, 0, 0} }),
				tuck(0.2, 1),
				T(4, 22, 0.8)
			)},
			{ t = 1.60, Pose = M(  -- تحليق مع رفّة بطيئة
				{ Body = R(10, 0, 0, 0, 2.6, -0.6) },
				{ Neck0 = R(16), Neck1 = R(10), Head = R(-8), Jaw = R(56) },
				W({ Shoulder = {6, -10, 0}, Upper = {40, -6, 0}, Fore = {20, -12, 0},
					F1 = {16, 0, 0}, F2 = {13, 0, 0}, F3 = {10, 0, 0} }),
				tuck(0.5, 1),
				T(6, 18, 1.3)
			)},
			{ t = 2.60, Pose = M(
				{ Body = R(-4, 0, 0, 0, 0.6, -0.2) },
				{ Neck0 = R(6), Neck1 = R(4), Head = R(-2), Jaw = R(34) },
				W({ Shoulder = {-6, -12, 0}, Upper = {-20, -20, 0}, Fore = {-20, -32, 0},
					F1 = {-10, -16, 0}, F2 = {-8, -12, 0}, F3 = {-6, -8, 0} }),
				tuck(0.8, 1),
				T(6, 12, 2.2)
			)},
			{ t = 3.10, Pose = M(
				{ Body = R(-6, 0, 0, 0, -0.8, 0) },
				{ Neck0 = R(-7), Neck1 = R(-4), Head = R(6), Jaw = R(12) },
				W({ Shoulder = {-6, -8, 0}, Upper = {-18, -28, 0}, Fore = {-14, -42, 0},
					F1 = {-7, -18, 0}, F2 = {-6, -13, 0}, F3 = {-5, -9, 0} }),
				L({ { "BL", "Thigh", -6, 0, 3 }, { "BR", "Thigh", -6, 0, 3 } }),
				T(6, 6, 2.8)
			)},
		},
	}

	-----------------------------------------------------------------
	-- ١٠) زئير (Roar) — E
	-----------------------------------------------------------------
	local Roar = {
		Name = "Roar", Loop = false, Length = 1.4, Priority = 3, Ease = "Smooth",
		FadeIn = 0.12, FadeOut = 0.3,
		Events = { { t = 0.35, Name = "Roar" }, { t = 1.3, Name = "End" } },
		Keys = {
			{ t = 0.0, Pose = M(
				{ Body = R(-8, 0, 0, 0, -0.6, 0) },
				{ Neck0 = R(-10), Neck1 = R(-7), Head = R(8), Jaw = R(8) },
				W({ Shoulder = {-6, -8, 0}, Upper = {-14, -28, 0}, Fore = {-12, -40, 0},
					F1 = {-6, -16, 0}, F2 = {-5, -12, 0}, F3 = {-4, -8, 0} }),
				T(5, 6, 0.3)
			)},
			{ t = 0.35, Pose = M(
				{ Body = R(9, 0, 0, 0, 1.5, -0.4) },
				{ Neck0 = R(18), Neck1 = R(12), Head = R(-10), Jaw = R(62) },
				W({ Shoulder = {6, -12, 0}, Upper = {44, -8, 0}, Fore = {22, -16, 0},
					F1 = {16, -2, 0}, F2 = {13, -1, 0}, F3 = {10, 0, 0} }),
				T(5, 14, 0.9)
			)},
			{ t = 1.0, Pose = M(
				{ Body = R(5, 0, 0, 0, 0.9, -0.2) },
				{ Neck0 = R(10), Neck1 = R(6), Head = R(-4), Jaw = R(52) },
				W({ Shoulder = {2, -10, 0}, Upper = {24, -14, 0}, Fore = {8, -22, 0},
					F1 = {10, -6, 0}, F2 = {8, -4, 0}, F3 = {6, -3, 0} }),
				T(6, 10, 1.5)
			)},
			{ t = 1.4, Pose = M(
				{ Body = R(-4, 0, 0, 0, -0.3, 0) },
				{ Neck0 = R(-6), Neck1 = R(-3), Head = R(5), Jaw = R(10) },
				W({ Shoulder = {-5, -8, 0}, Upper = {-12, -28, 0}, Fore = {-11, -40, 0},
					F1 = {-6, -17, 0}, F2 = {-5, -12, 0}, F3 = {-4, -8, 0} }),
				T(6, 5, 2.0)
			)},
		},
	}

	-----------------------------------------------------------------
	-- ١١) إصابة (Hit) + تحوّل (Transform) + إقلاع/هبوط
	-----------------------------------------------------------------
	local Hit = {
		Name = "Hit", Loop = false, Length = 0.40, Priority = 4, Ease = "Out",
		FadeIn = 0.05, FadeOut = 0.2,
		Keys = {
			{ t = 0.0, Pose = M(
				{ Body = R(14, 0, 0, 0, 0.6, 1.2) },
				{ Neck0 = R(12), Neck1 = R(8), Head = R(-8), Jaw = R(30) },
				W({ Shoulder = {-14, -6, 0}, Upper = {-34, -24, 0}, Fore = {-26, -36, 0},
					F1 = {-12, -18, 0}, F2 = {-10, -13, 0}, F3 = {-8, -9, 0} }),
				T(8, 12, 0.4)
			)},
			{ t = 0.40, Pose = idlePose(0, 1.2) },
		},
	}

	local Transform = {
		Name = "Transform", Loop = false, Length = 2.2, Priority = 5, Ease = "Smooth",
		FadeIn = 0.05, FadeOut = 0.4,
		Events = { { t = 0.35, Name = "Charge" }, { t = 1.0, Name = "Burst" }, { t = 2.1, Name = "End" } },
		Keys = {
			{ t = 0.0, Pose = M(   -- انكماش
				{ Body = R(-24, 0, 0, 0, -2.4, 0) },
				{ Neck0 = R(-22), Neck1 = R(-16), Head = R(18), Jaw = R(4) },
				W({ Shoulder = {-16, 0, 0}, Upper = {-46, -40, 0}, Fore = {-36, -56, 0},
					F1 = {-18, -28, 0}, F2 = {-15, -22, 0}, F3 = {-12, -16, 0} }),
				L({ { "FL", "Thigh", 22, 0, 4 }, { "FR", "Thigh", 22, 0, 4 },
					{ "BL", "Thigh", 22, 0, 5 }, { "BR", "Thigh", 22, 0, 5 },
					{ "FL", "Shin", -46, 0, 0 }, { "FR", "Shin", -46, 0, 0 },
					{ "BL", "Shin", -50, 0, 0 }, { "BR", "Shin", -50, 0, 0 } }),
				T(4, 24, 0.2)
			)},
			{ t = 0.9, Pose = M(   -- تجمّع الطاقة
				{ Body = R(-30, 0, 0, 0, -2.8, 0) },
				{ Neck0 = R(-28), Neck1 = R(-20), Head = R(22), Jaw = R(6) },
				W({ Shoulder = {-20, 4, 0}, Upper = {-56, -46, 0}, Fore = {-44, -64, 0},
					F1 = {-22, -34, 0}, F2 = {-18, -27, 0}, F3 = {-14, -20, 0} }),
				T(3, 30, 0.6)
			)},
			{ t = 1.35, Pose = M(  -- انفجار: فرد كامل
				{ Body = R(16, 0, 0, 0, 3.6, -1.0) },
				{ Neck0 = R(24), Neck1 = R(16), Head = R(-14), Jaw = R(70) },
				W({ Shoulder = {10, -14, 0}, Upper = {66, 0, 0}, Fore = {42, -6, 0},
					F1 = {30, 0, 0}, F2 = {26, 0, 0}, F3 = {20, 0, 0} }),
				tuck(0.3, 1),
				T(5, 26, 1.1)
			)},
			{ t = 2.2, Pose = idlePose(1, 0.4) },
		},
	}

	local Takeoff = {
		Name = "Takeoff", Loop = false, Length = 0.85, Priority = 2, Ease = "Out",
		FadeIn = 0.12, FadeOut = 0.3,
		Events = { { t = 0.10, Name = "Push" }, { t = 0.8, Name = "End" } },
		Keys = {
			{ t = 0.0, Pose = M(
				{ Body = R(-14, 0, 0, 0, -1.8, 0) },
				W({ Shoulder = {-10, -6, 0}, Upper = {-28, -30, 0}, Fore = {-22, -44, 0},
					F1 = {-10, -20, 0}, F2 = {-8, -15, 0}, F3 = {-7, -10, 0} }),
				L({ { "BL", "Thigh", 18, 0, 4 }, { "BR", "Thigh", 18, 0, 4 },
					{ "BL", "Shin", -40, 0, 0 }, { "BR", "Shin", -40, 0, 0 } }),
				T(5, 12, 0.2)
			)},
			{ t = 0.35, Pose = M(
				{ Body = R(-18, 0, 0, 0, 1.2, -0.8) },
				W({ Shoulder = {4, -8, 0}, Upper = {44, -12, 0}, Fore = {26, -20, 0},
					F1 = {18, -4, 0}, F2 = {15, -3, 0}, F3 = {11, -2, 0} }),
				tuck(0.2, 1), T(6, 10, 0.7)
			)},
			{ t = 0.85, Pose = M(
				{ Body = R(-6, 0, 0, 0, 0.6, -0.3) },
				W({ Shoulder = {0, -6, 0}, Upper = {18, -10, 0}, Fore = {6, -8, 0},
					F1 = {8, 0, 0}, F2 = {6, 0, 0}, F3 = {5, 0, 0} }),
				tuck(0.6, 1), T(6, 6, 1.1)
			)},
		},
	}

	local Land = {
		Name = "Land", Loop = false, Length = 0.7, Priority = 2, Ease = "Out",
		FadeIn = 0.1, FadeOut = 0.3,
		Events = { { t = 0.10, Name = "Impact" }, { t = 0.65, Name = "End" } },
		Keys = {
			{ t = 0.0, Pose = M(
				{ Body = R(-6, 0, 0, 0, 0.4, -0.2) },
				W({ Shoulder = {6, -8, 0}, Upper = {30, -12, 0}, Fore = {14, -16, 0},
					F1 = {12, -4, 0}, F2 = {10, -3, 0}, F3 = {8, -2, 0} }),
				tuck(0.5, 1), T(6, 6, 0.5)
			)},
			{ t = 0.2, Pose = M(
				{ Body = R(-18, 0, 0, 0, -2.2, 0) },
				W({ Shoulder = {-12, -6, 0}, Upper = {-30, -28, 0}, Fore = {-24, -40, 0},
					F1 = {-12, -20, 0}, F2 = {-10, -15, 0}, F3 = {-8, -10, 0} }),
				L({ { "FL", "Thigh", 20, 0, 4 }, { "FR", "Thigh", 20, 0, 4 },
					{ "FL", "Shin", -42, 0, 0 }, { "FR", "Shin", -42, 0, 0 },
					{ "BL", "Thigh", -16, 0, 5 }, { "BR", "Thigh", -16, 0, 5 },
					{ "BL", "Shin", -34, 0, 0 }, { "BR", "Shin", -34, 0, 0 } }),
				T(6, 16, 0.9)
			)},
			{ t = 0.7, Pose = idlePose(0, 2.0) },
		},
	}

	-----------------------------------------------------------------
	local clips = {
		Idle = Idle, Walk = Walk, Run = Run, Fly = Fly, Glide = Glide,
		FireBreath = FireBreath, ClawBarrage = ClawBarrage,
		MeteorCast = MeteorCast, ThunderCast = ThunderCast,
		Roar = Roar, Hit = Hit, Transform = Transform,
		Takeoff = Takeoff, Land = Land,
	}

	-- تكبير إزاحات المكان حسب مقياس التنين (الزوايا ثابتة)
	if scale ~= 1 then
		for _, clip in pairs(clips) do
			for _, key in ipairs(clip.Keys) do
				for joint, cf in pairs(key.Pose) do
					key.Pose[joint] = cf - cf.Position + cf.Position * scale
				end
			end
		end
	end

	return clips
end

-- أسماء الحركات للاستخدام الخارجي
AnimationData.Names = {
	Idle = "Idle", Walk = "Walk", Run = "Run", Fly = "Fly", Glide = "Glide",
	FireBreath = "FireBreath", ClawBarrage = "ClawBarrage",
	MeteorCast = "MeteorCast", ThunderCast = "ThunderCast",
	Roar = "Roar", Hit = "Hit", Transform = "Transform",
	Takeoff = "Takeoff", Land = "Land",
}

-- الحركة المناسبة لكل مهارة
AnimationData.ForAbility = {
	Z = "FireBreath", X = "ClawBarrage", C = "MeteorCast", V = "ThunderCast",
}

return AnimationData

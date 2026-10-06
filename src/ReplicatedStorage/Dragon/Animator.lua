--[[
	====================================================================
	Animator.lua — محرك أنيميشن إجرائي (بدون ملفات .anim)
	====================================================================
	بيحرّك عظام Motor6D مباشرة عن طريق C0، ويدعم:
	  • مزج (Blending) بين أكتر من حركة في نفس الوقت
	  • Fade in / Fade out
      • Loop و One-shot
      • أحداث زمنية (Events) لتشغيل الـ VFX في لحظة معينة
	  • سرعة متغيرة وPriority

	الاستخدام:
		local anim = Animator.new(rig)
		anim:LoadClips(AnimationData.Clips)
		anim:Play("Idle")
		RunService.Heartbeat:Connect(function(dt) anim:Update(dt) end)
]]

local Animator = {}
Animator.__index = Animator

local RunService = game:GetService("RunService")
local CF, ANG = CFrame.new, CFrame.Angles
local IDENTITY = CFrame.new()

---------------------------------------------------------------------
-- أدوات
---------------------------------------------------------------------
local function smoothstep(t) return t * t * (3 - 2 * t) end
local function easeInOut(t) return t < 0.5 and (2 * t * t) or (1 - ((-2 * t + 2) ^ 2) / 2) end
local function easeOut(t) return 1 - (1 - t) ^ 3 end

local EASE = {
	Linear = function(t) return t end,
	Smooth = smoothstep,
	InOut = easeInOut,
	Out = easeOut,
}

-- دمج إطارين (وضعية: jointName -> CFrame offset)
local function lerpPose(a, b, t)
	local out = {}
	for k, cf in pairs(a) do
		local o = b[k]
		out[k] = o and cf:Lerp(o, t) or cf
	end
	for k, cf in pairs(b) do
		if not out[k] then out[k] = cf end
	end
	return out
end

---------------------------------------------------------------------
-- الإنشاء
---------------------------------------------------------------------
function Animator.new(rig)
	local self = setmetatable({}, Animator)
	self.Rig = rig
	self.Clips = {}
	self.Tracks = {}
	self.OnEvent = nil          -- function(trackName, eventName, track)
	self._sorted = {}
	self._dirty = true
	self.TimeScale = 1
	return self
end

function Animator:LoadClips(clips)
	for name, clip in pairs(clips) do
		clip.Name = clip.Name or name
		clip.Length = clip.Length or 1
		clip.Priority = clip.Priority or 1
		clip.Loop = (clip.Loop ~= false)
		clip.Ease = clip.Ease or "Smooth"
		table.sort(clip.Keys, function(a, b) return a.t < b.t end)
		self.Clips[name] = clip
	end
	return self
end

function Animator:Load(name, clip) return self:LoadClips({ [name] = clip }) end

---------------------------------------------------------------------
-- التشغيل
---------------------------------------------------------------------
function Animator:Play(name, opts)
	opts = opts or {}
	local clip = self.Clips[name]
	if not clip then warn("[Animator] مفيش حركة اسمها:", name) return nil end

	-- لو نفس الحركة شغالة بالفعل نعيد تشغيلها من الأول (اختياري)
	local track = self.Tracks[name]
	if not track then
		track = {
			Name = name, Clip = clip, Time = 0,
			Weight = 0, TargetWeight = 1,
			FadeIn = opts.Fade or clip.FadeIn or 0.25,
			FadeOut = clip.FadeOut or 0.3,
			Speed = opts.Speed or clip.Speed or 1,
			Priority = opts.Priority or clip.Priority,
			Playing = true,
			Fired = {},
		}
		self.Tracks[name] = track
		self._dirty = true
	else
		track.TargetWeight = 1
		track.Playing = true
		track.Speed = opts.Speed or clip.Speed or 1
		track.FadeIn = opts.Fade or clip.FadeIn or 0.25
		track.Fired = {}
		if opts.Restart ~= false then track.Time = 0 end
	end
	return track
end

function Animator:Stop(name, fade)
	local track = self.Tracks[name]
	if not track then return end
	track.Playing = false
	track.TargetWeight = 0
	track.FadeOut = fade or track.FadeOut
end

function Animator:StopAll(fade)
	for name in pairs(self.Tracks) do self:Stop(name, fade) end
end

-- يوقف كل الحركات الأقل من الـ Priority ده (مثلاً وقّت المهارة توقف المشي)
function Animator:StopBelow(priority, fade)
	for name, tr in pairs(self.Tracks) do
		if (tr.Priority or 1) < priority then self:Stop(name, fade) end
	end
end

function Animator:IsPlaying(name)
	local t = self.Tracks[name]
	return t and t.Playing or false
end

function Animator:GetTrack(name) return self.Tracks[name] end

---------------------------------------------------------------------
-- أخذ عيّنة من الكليب في زمن معين
---------------------------------------------------------------------
function Animator:Sample(clip, time)
	local keys = clip.Keys
	if #keys == 0 then return {} end
	if #keys == 1 then return keys[1].Pose end

	local len = clip.Length
	local t = clip.Loop and (time % len) or math.clamp(time, 0, len)

	-- البحث عن الإطارين الحاليين
	local k1, k2 = keys[1], keys[#keys]
	for i = 1, #keys - 1 do
		if t >= keys[i].t and t <= keys[i + 1].t then
			k1, k2 = keys[i], keys[i + 1]
			break
		end
	end

	local span = (k2.t - k1.t)
	local alpha = span > 1e-5 and ((t - k1.t) / span) or 0
	local ease = EASE[clip.Ease] or smoothstep
	alpha = ease(math.clamp(alpha, 0, 1))

	return lerpPose(k1.Pose, k2.Pose, alpha)
end

---------------------------------------------------------------------
-- التحديث (ناديه كل فريم)
---------------------------------------------------------------------
function Animator:Update(dt)
	local rig = self.Rig
	if not rig or not rig.Motors then return end

	if self._dirty then
		self._sorted = {}
		for _, tr in pairs(self.Tracks) do table.insert(self._sorted, tr) end
		table.sort(self._sorted, function(a, b) return (a.Priority or 1) < (b.Priority or 1) end)
		self._dirty = false
	end

	local poseAcc = {}     -- jointName -> CFrame
	local weightAcc = {}   -- jointName -> number
	local dead = nil

	for i = 1, #self._sorted do
		local tr = self._sorted[i]
		local clip = tr.Clip

		-- تحديث الوزن
		local rate = (tr.TargetWeight > tr.Weight) and tr.FadeIn or tr.FadeOut
		rate = math.max(rate, 0.0001)
		local step = dt / rate
		if tr.TargetWeight > tr.Weight then
			tr.Weight = math.min(tr.TargetWeight, tr.Weight + step)
		else
			tr.Weight = math.max(tr.TargetWeight, tr.Weight - step)
		end

		-- تقديم الزمن
		if tr.Playing then
			tr.Time = tr.Time + dt * tr.Speed * self.TimeScale
			if not clip.Loop and tr.Time >= clip.Length then
				tr.Time = clip.Length
				tr.Playing = false
				tr.TargetWeight = 0
				if self.OnEvent then self.OnEvent(tr.Name, "Ended", tr) end
			end
		end

		-- أحداث زمنية
		if clip.Events and tr.Playing then
			for _, ev in ipairs(clip.Events) do
				if not tr.Fired[ev.Name] and tr.Time >= ev.t then
					tr.Fired[ev.Name] = true
					if self.OnEvent then self.OnEvent(tr.Name, ev.Name, tr) end
				end
			end
		end

		-- حساب الوضعية ودمجها
		if tr.Weight > 0.001 then
			local pose = self:Sample(clip, tr.Time)
			for joint, offset in pairs(pose) do
				if rig.Motors[joint] then
					local acc = poseAcc[joint]
					local w = weightAcc[joint] or 0
					local total = w + tr.Weight
					if acc then
						poseAcc[joint] = acc:Lerp(offset, tr.Weight / total)
					else
						poseAcc[joint] = IDENTITY:Lerp(offset, tr.Weight / total)
					end
					weightAcc[joint] = total
				end
			end
		end

		-- تنظيف التراكات الميتة
		if (not tr.Playing) and tr.Weight <= 0.001 then
			dead = dead or {}
			table.insert(dead, tr.Name)
		end
	end

	if dead then
		for _, n in ipairs(dead) do self.Tracks[n] = nil end
		self._dirty = true
	end

	-- تطبيق على المحركات
	for joint, offset in pairs(poseAcc) do
		local m = rig.Motors[joint]
		local base = rig.Base[joint]
		if m and base then
			m.C0 = base * offset
		end
	end

	-- رجوع المفاصل اللي مفيش تراك شغال عليها لوضعها الأساسي
	for joint, m in pairs(rig.Motors) do
		if not poseAcc[joint] and rig.Base[joint] then
			m.C0 = rig.Base[joint]
		end
	end
end

---------------------------------------------------------------------
-- ربط تلقائي بـ Heartbeat (اختياري)
---------------------------------------------------------------------
function Animator:AutoUpdate()
	self._conn = RunService.Heartbeat:Connect(function(dt) self:Update(dt) end)
	return self
end

function Animator:Destroy()
	if self._conn then self._conn:Disconnect() end
	self.Tracks = {}
end

-- أداة لبناء وضعية: A("Neck0", rx, ry, rz, px, py, pz) بالدرجات
function Animator.A(name, rx, ry, rz, px, py, pz)
	return name, CFrame.new(px or 0, py or 0, pz or 0)
		* CFrame.Angles(math.rad(rx or 0), math.rad(ry or 0), math.rad(rz or 0))
end

-- أداة لتحويل جدول {A(...), A(...), ...} لوضعية
function Animator.Pose(...)
	local t = {}
	local args = { ... }
	for i = 1, #args do
		local name, cf = Animator.A(unpack(args[i]))
		t[name] = cf
	end
	return t
end

return Animator

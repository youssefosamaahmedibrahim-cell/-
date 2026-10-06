--[[
	====================================================================
	Config.lua — كل إعدادات التنين في مكان واحد
	Infernal Dragon System  •  by Arena Agent
	====================================================================
	عدّل الأرقام هنا فقط .. باقي الملفات بتقرا من هنا.
	الملف ده ModuleScript مشترك بين السيرفر والكلينت.
]]

local Config = {}

Config.Version = "1.0.0"

---------------------------------------------------------------------
-- ١) إعدادات جسم التنين (الحجم، السرعة، الألوان)
---------------------------------------------------------------------
Config.Dragon = {
	Name = "التنين الجحيمي",
	NameEn = "Infernal Dragon",

	Scale = 1.0,            -- كبّر/صغّر التنين كله من هنا
	Health = 7500,
	WalkSpeed = 28,
	SprintSpeed = 52,
	FlySpeed = 105,
	SprintFlySpeed = 165,
	JumpPower = 90,

	-- أقصى ارتفاع للطيران فوق نقطة الإقلاع
	FlyMaxHeight = 220,

	Material = Enum.Material.SmoothPlastic,

	Colors = {
		Body       = Color3.fromRGB(30, 10, 14),   -- أسود بركاني
		BodyDark   = Color3.fromRGB(16, 6, 9),     -- الظل
		Belly      = Color3.fromRGB(198, 150, 74), -- صفائح ذهبية
		Membrane   = Color3.fromRGB(122, 20, 26),  -- غشاء الجناح
		MembraneGlow = Color3.fromRGB(255, 92, 20),
		Horn       = Color3.fromRGB(232, 206, 150),-- قرون عاجية
		Claw       = Color3.fromRGB(240, 236, 224),-- مخالب
		Spike      = Color3.fromRGB(66, 16, 20),   -- الأشواك
		Eye        = Color3.fromRGB(255, 146, 30), -- عيون متوهجة
		Glow       = Color3.fromRGB(255, 96, 20),  -- لون الجمر/الطاقة
	},

	-- لو عندك ميش جاهز (MeshPart) حط الـ IDs هنا وسيب البناء الإجرائي
	-- مثال: ["Head"] = "rbxassetid://123456789"
	MeshOverride = {},
	UseProceduralBody = true,
}

---------------------------------------------------------------------
-- ٢) المهارات — Z / X / C / V
---------------------------------------------------------------------
-- Damage.Ticks = عدد مرات حساب الضرر (توزيع الضرر على زمن المهارة)
Config.Abilities = {
	---------------------------------------------------------------
	Z = {
		Key = "Z",
		KeyCode = Enum.KeyCode.Z,
		Name = "نَفَسُ النّار",
		NameEn = "Inferno Breath",
		Icon = "🔥",
		Type = "Beam",                 -- شعاع مستمر
		Cooldown = 9,                  -- ثانية
		Windup = 0.30,                 -- زمن التحضير قبل الشعاع
		Duration = 1.70,               -- مدة الشعاع
		Animation = "FireBreath",
		Range = 62,
		Radius = 8.5,                  -- نصف قطر الشعاع
		Damage = { Total = 165, Ticks = 10 },
		Knockback = 26,
		Burn = { DPS = 14, Duration = 4.5 },
		Shake = { Amp = 0.45, Duration = 1.7 },
		Sound = 0,                     -- حط rbxassetid لو عندك صوت
	},

	---------------------------------------------------------------
	X = {
		Key = "X",
		KeyCode = Enum.KeyCode.X,
		Name = "مَخَالِبُ العَاصِفَة",
		NameEn = "Storm Claws",
		Icon = "⚔️",
		Type = "Barrage",              -- اندفاع + ضربات
		Cooldown = 12,
		Windup = 0.18,
		Duration = 1.10,
		Animation = "ClawBarrage",
		SlashCount = 5,                -- عدد الضربات
		DashDistance = 34,             -- مسافة الاندفاع
		Radius = 10,
		Damage = { Total = 240, Ticks = 5 },  -- لكل ضربة Total/Ticks
		Knockback = 34,
		Burn = { DPS = 0, Duration = 0 },
		Shake = { Amp = 0.6, Duration = 0.9 },
		Sound = 0,
	},

	---------------------------------------------------------------
	C = {
		Key = "C",
		KeyCode = Enum.KeyCode.C,
		Name = "مَطَرُ النّيَازِك",
		NameEn = "Meteor Rain",
		Icon = "☄️",
		Type = "Rain",                 -- نيازك من السماء
		Cooldown = 22,
		Windup = 0.55,
		Duration = 3.20,
		Animation = "MeteorCast",
		MeteorCount = 12,
		CastRadius = 34,               -- منطقة السقوط
		Radius = 13,                   -- نصف قطر ضرر النيزك
		Damage = { Total = 95, Ticks = 1 },   -- لكل نيزك
		Knockback = 62,
		Burn = { DPS = 18, Duration = 5 },
		Shake = { Amp = 1.1, Duration = 3.2 },
		Sound = 0,
	},

	---------------------------------------------------------------
	V = {
		Key = "V",
		KeyCode = Enum.KeyCode.V,
		Name = "عَاصِفَةُ الرَّعْد",
		NameEn = "Thunder Storm",
		Icon = "⚡",
		Type = "Storm",                -- صواعق + وضعية الاستيقاظ
		Cooldown = 42,
		Windup = 0.70,
		Duration = 3.00,
		Animation = "ThunderCast",
		BoltCount = 16,
		CastRadius = 40,
		Radius = 9,
		Damage = { Total = 70, Ticks = 1 },  -- لكل صاعقة
		Knockback = 40,
		Stun = 0.85,
		Burn = { DPS = 0, Duration = 0 },
		Shake = { Amp = 1.4, Duration = 3.0 },
		Awakening = { Duration = 12, DamageMultiplier = 1.35, SpeedMultiplier = 1.25 },
		Sound = 0,
	},
}

-- ترتيب الأزرار في شريط المهارات
Config.AbilityOrder = { "Z", "X", "C", "V" }

---------------------------------------------------------------------
-- ٣) حركات إضافية (مش مطلوبة بس تزوّد المتعة)
---------------------------------------------------------------------
Config.Extras = {
	EnableFlight = true,       -- F = طيران
	EnableMorphToggle = true,  -- G = تحوّل إنسان ⇄ تنين
	EnableSprint = true,       -- Shift = جري سريع
	AutoMorphOnSpawn = true,   -- يتحول لتنين أول ما يدخل
	RoarKey = Enum.KeyCode.E,  -- زئير (بدون ضرر، بس VFX)
	RoarCooldown = 6,
	SpawnTestDummies = true,   -- دمى تجربة في الساحة
	BuildArena = true,         -- يبني ساحة تجربة
}

---------------------------------------------------------------------
-- ٤) إعدادات الـ VFX (قوة التأثيرات)
---------------------------------------------------------------------
Config.VFX = {
	Quality = 3,               -- 1 ضعيف .. 2 متوسط .. 3 فخم .. 4 إلهي
	MaxParticles = 1200,       -- حد أقصى للجزيئات (للأداء)
	EnableCameraShake = true,
	EnableScreenFlash = true,
	EnableAfterimages = true,
	EnableLighting = true,     -- تعديل الإضاءة وقت المهارات الكبيرة
	ParticleMultiplier = { 0.4, 0.7, 1.0, 1.45 },  -- حسب الـ Quality
	-- ألوان التأثيرات
	FireColorA = Color3.fromRGB(255, 236, 170),
	FireColorB = Color3.fromRGB(255, 122, 20),
	FireColorC = Color3.fromRGB(150, 24, 8),
	SmokeColor = Color3.fromRGB(38, 34, 34),
	ThunderColor = Color3.fromRGB(150, 210, 255),
	ThunderColorCore = Color3.fromRGB(255, 255, 255),
	SlashColor = Color3.fromRGB(255, 70, 30),
	EnergyColor = Color3.fromRGB(255, 140, 30),
}

---------------------------------------------------------------------
-- ٥) إعدادات واجهة اللاعب (شريط الكول داون)
---------------------------------------------------------------------
Config.UI = {
	ShowAbilityBar = true,
	SlotSize = 78,
	SlotGap = 14,
	ReadyColor = Color3.fromRGB(255, 148, 40),
	CooldownColor = Color3.fromRGB(18, 18, 22),
	ShowDamageNumbers = true,
	ShowKeyHints = true,
	MobileButtons = true,      -- أزرار للموبايل
	BarPosition = UDim2.new(0.5, 0, 1, -105),
}

---------------------------------------------------------------------
-- ٦) الشبكة / الأمان
---------------------------------------------------------------------
Config.Net = {
	RemoteName = "DragonRemotes",
	-- زمن سماح بسيط ضد اللاج (ثواني)
	CooldownGrace = 0.25,
	-- أقصى مسافة مسموح يبعت منها اللاعب مكان المهارة
	MaxCastDistance = 260,
	-- منع السبام: أقل وقت بين نداءين لأي مهارة
	GlobalCastDelay = 0.15,
	DamageNumberRemote = true,
}

---------------------------------------------------------------------
-- دوال مساعدة مشتركة
---------------------------------------------------------------------
function Config.ParticleRate(base)
	local q = math.clamp(Config.VFX.Quality or 3, 1, 4)
	return math.max(1, math.floor(base * (Config.VFX.ParticleMultiplier[q] or 1)))
end

function Config.DamagePerTick(ability)
	local d = ability.Damage
	if not d then return 0 end
	local ticks = math.max(1, d.Ticks or 1)
	return (d.Total or 0) / ticks
end

function Config.GetAbility(key)
	return Config.Abilities[key]
end

return Config

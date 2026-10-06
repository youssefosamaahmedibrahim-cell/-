# 🐉 التنين الجحيمي — Infernal Dragon System

نظام تنين كامل لـ Roblox: **موديل + ريج (Motor6D) + أنيميشن إجرائي + VFX فخم + مهارات Z X C V مع كول داون** —
كله مكتوب بالكود (Luau) من غير أي أصول خارجية (لا ميش ولا صور ولا أصوات)، يعني هتنسخ الملفات وتشغّل على طول.

> نسخة متصفح ثلاثية الأبعاد جوه مجلد `web/` عشان تشوف التنين بيتحرك ويولّع نار في المتصفح قبل ما تحطه في اللعبة.

---

## 🔥 المهارات

| الزر | الاسم | النوع | الكول داون | الضرر الكلي | ملاحظات |
|:---:|:---|:---|:---:|:---:|:---|
| **Z** | نَفَسُ النّار | شعاع مستمر | 9ث | 165 (10 نبضات) | حرق 14/ث لمدة 4.5ث + طرد |
| **X** | مَخَالِب العاصفة | اندفاع + 5 ضربات | 12ث | 240 (5×48) | اندفاع 34 studs + طرد قوي |
| **C** | مطر النيازك | 12 نيزك من السماء | 22ث | 95 لكل نيزك | مساحة قطرها 34 + حرق 18/ث |
| **V** | عاصفة الرعد | 16 صاعقة + استيقاظ | 42ث | 70 لكل صاعقة | صعق 0.85ث + ضرر ×1.35 لمدة 12ث |
| **E** | زئير | موجة صوتية | 6ث | — | بس VFX واهتزاز كاميرا |

أزرار إضافية: **F** طيران/هبوط · **G** تحوّل إنسان ⇄ تنين · **Shift** جري · **Space/Ctrl** طلوع ونزول في الطيران.

كل الأرقام دي في ملف واحد: **`src/ReplicatedStorage/Dragon/Config.lua`**.

---

## 📦 تركيب المشروع

```
src/
├── ReplicatedStorage/Dragon/     ← modules مشتركة (سيرفر + كلينت)
│   ├── Config.lua                ← كل الإعدادات (عدّل من هنا بس)
│   ├── RigBuilder.lua            ← بناء جسم التنين + عظام Motor6D
│   ├── AnimationData.lua         ← الحركات (Idle/Walk/Run/Fly/Glide + المهارات)
│   ├── Animator.lua              ← محرك أنيميشن إجرائي بيدعم مزج وFade
│   ├── VFX.lua                   ← مكتبة التأثيرات (نار/نيازك/صواعق/هالات)
│   ├── Abilities.lua             ← منفّذ المهارات على الكلينت
│   ├── UI.lua                    ← شريط المهارات بالكول داون (مبني بالكود)
│   ├── Remotes.lua               ← RemoteEvents
│   └── DragonState.lua           ← حالة مشتركة
├── ServerScriptService/
│   ├── DragonServer.server.lua   ← الكول داون الحقيقي + الضرر + النسخ
│   ├── DragonSpawner.server.lua  ← الساحة + دمى التجربة + التحوّل التلقائي
│   ├── DragonCombat.lua          ← كشف الأهداف + ضرر/طرد/حرق/صعق
│   └── DragonMorph.lua           ← تحويل اللاعب ⇄ تنين
└── StarterPlayer/StarterPlayerScripts/
    └── DragonClient.client.lua   ← الإدخال + الطيران + حالة الأنيميشن
web/                              ← معاينة three.js في المتصفح
default.project.json              ← مشروع Rojo
```

---

## 🚀 طريقة التشغيل

### الطريقة ١ — Rojo (الأسهل)
```bash
rojo serve            # من جوه مجلد المشروع
```
وبعدين افتح Roblox Studio ←插件 Rojo ← Connect.

### الطريقة ٢ — بدون Rojo (نسخ يدوي)
انقل المحتوى بإيدك جوه Studio:

1. `src/ReplicatedStorage/Dragon/*` → **ReplicatedStorage/Dragon** (ModuleScripts)
2. `src/ServerScriptService/*.server.lua` → **ServerScriptService** (Scripts)
3. `src/ServerScriptService/DragonCombat.lua` و `DragonMorph.lua` → **ServerScriptService** (ModuleScripts)
4. `src/StarterPlayer/StarterPlayerScripts/DragonClient.client.lua` → **StarterPlayerScripts** (LocalScript)

> الكل بيعمل `WaitForChild("Dragon")` فلازم الموديولز كلها تكون في فولدر اسمه **Dragon** في ReplicatedStorage.

أول ما تشغّل: اللاعب بيتحوّل تنين أوتوماتيك، تتولّد ساحة و6 دمى تجربة،
وجاهز: **Z X C V**.

---

## 🎨 تحط ميش تنين بتاعك

الريج الإجرائي جاهز، بس لو عندك ميش محترم:

```lua
-- في Config.lua
Config.Dragon.UseProceduralBody = false
Config.Dragon.MeshOverride = {
    Head  = "rbxassetid://123456789",
    Torso = "rbxassetid://123456789",
    -- ... بنفس أسماء القطع
}
```

أسماء القطع اللي يقدر يستبدلها:
`Torso, Chest, Belly, ChestPlate, Neck0, Neck1, Head, Snout, Jaw, Eye, Horn, HornTip,
HornSmall, NoseHorn, BackSpike, Tail0..Tail5, TailFin,
WingL/R_Shoulder, WingL/R_Upper, WingL/R_Fore, WingL/R_F1..F3, MembraneL/R, WingClawL/R,
LegFL/FR/BL/BR_Hip, _Thigh, _Shin, _Foot, _Claw, _Spike`

أسماء المفاصل (للأنيميشن) موجودة في `AnimationData.lua` — زي `Neck0`, `Tail3`, `WingR_Upper`, `LegFL_Thigh`.

> **مهم:** الموديل لازم يبقى موجه ناحية **-Z** (زي شخصيات روبلوكس).

---

## 🎬 الأنيميشن

محرك إجرائي (من غير ملفات `.anim`) بيدعم:
* مزج أكتر من حركة في نفس الوقت (مثلًا: المشي + حركة مهارة فوقه)
* Fade in/out و Priority
* **أحداث زمنية** — مثلًا حدث `Cast` في ثانية 0.30 من حركة نَفَس النار هو اللي بيولّع الشعاع
* حلقات (Idle / Walk / Run / Fly / Glide) وحركات مرة واحدة (المهارات / الزئير / التحوّل)

```lua
local anim = Animator.new(rig)
anim:LoadClips(AnimationData.Build(scale))
anim:Play("Idle")
anim.OnEvent = function(track, event)
    if track == "FireBreath" and event == "Cast" then --[[ ولّع النار ]] end
end
anim:AutoUpdate()
```

---

## 💥 الـ VFX

مكتبة `VFX.lua` فيها:
`FireBreath` (شعاع ملزوق في بؤ التنين + حلقات نار + أثر حرق على الأرض) ·
`Meteor / MeteorRain` (صخرة ملتهبة بذيل + حلقة تحذير + انفجار وحفرة) ·
`LightningBolt / ThunderStorm` (صاعقة متعرجة + وميض سماوي + موجة صدمة) ·
`Slash` (أقوس مخالب) · `RoarWave` (حلقات صوتية + غبار) · `Aura` (هالة الاستيقاظ) ·
`Explosion` · `Shockwave` · `DashTrail` · `BurnTarget` · `StunStars` ·
`CameraShake` · `Flash` · `DarkenSky` · `DamageNumber`

الجودة من `Config.VFX.Quality` (1 → 4).

---

## 🌐 المعاينة في المتصفح (web/)

```bash
cd web
python3 -m http.server 8080
# افتح http://localhost:8080
```

* WASD حركة · F طيران · Z X C V مهارات · ماوس لفّ الكاميرا · عجلة زوم
* الكول داون والـ VFX والضرر شغالين على 6 دمى تجربة
* (three.js مضمّن جوه `web/vendor` — مش محتاج إنترنت)

---

## ⚙️ أهم إعدادات `Config.lua`

```lua
Config.Dragon.Scale = 1.0          -- حجم التنين
Config.Dragon.WalkSpeed = 28
Config.Dragon.FlySpeed = 105
Config.Abilities.Z.Cooldown = 9    -- كول داون Z
Config.Abilities.C.MeteorCount = 12
Config.VFX.Quality = 3             -- 1..4
Config.Extras.AutoMorphOnSpawn = true
Config.Extras.SpawnTestDummies = true
```

الأصوات: حط `rbxassetid` بتاعك في `Config.Abilities.Z.Sound` وهكذا (افتراضي 0 = بدون صوت).

---

## ✅ الأمان

الكول داون الحقيقي على **السيرفر** — الكلينت بيبدأ كول داون تقديري وبعدين السيرفر بيأكده أو يصحّحه.
برضه فيه: حد أقصى للمسافة، منع السبام، وفحص إن اللاعب متحوّل تنين فعلًا.

---

## 📝 ملاحظات

* التنين = `player.Character` (الشخصية الأصلية بتتخبّى تحت الخريطة وترجع لما تدوس G)
* الطيران بيستخدم ملكية الشبكة (Network Ownership) عشان يبقى سلس
* لو حبيت كل لاعب يبقى عنده تنين مختلف: عدّل `Config.Dragon.Colors` قبل البناء

صنع بحب 🔥 — عدّل واستخدمه زي ما تحب.

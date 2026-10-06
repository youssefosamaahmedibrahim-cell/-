--[[
	====================================================================
	DragonState.lua — حالة مشتركة (السيرفر بيكتب، الكل يقرا)
	====================================================================
	بيخزّن: ريج كل لاعب، شخصيته الأصلية، الكول داونات، حالات الحرق/الصعق
]]

local Config = require(script.Parent.Config)

local DragonState = {}

DragonState.Rigs = {}        -- [Player] = Rig
DragonState.HumanForms = {}  -- [Player] = Model (الشخصية الأصلية وقت التحوّل)
DragonState.Cooldowns = {}   -- [Player][key] = ثواني متبقية
DragonState.Awaken = {}      -- [Player] = os.clock() وقت انتهاء الاستيقاظ
DragonState.Burning = {}     -- [Model] = { Until, DPS, Attacker, Tick }
DragonState.StunToken = {}   -- [Model] = number
DragonState.Flying = {}      -- [Player] = bool

function DragonState.RigOf(player) return DragonState.Rigs[player] end
function DragonState.IsMorphed(player) return DragonState.Rigs[player] ~= nil end

function DragonState.CooldownLeft(player, key)
	local t = DragonState.Cooldowns[player]
	return t and t[key] or 0
end

function DragonState.IsAwakened(player)
	local untilT = DragonState.Awaken[player]
	return untilT and os.clock() < untilT or false
end

function DragonState.DamageMultiplier(player)
	if DragonState.IsAwakened(player) then
		return (Config.Abilities.V.Awakening and Config.Abilities.V.Awakening.DamageMultiplier) or 1.35
	end
	return 1
end

function DragonState.Cleanup(player)
	DragonState.Rigs[player] = nil
	DragonState.HumanForms[player] = nil
	DragonState.Cooldowns[player] = nil
	DragonState.Awaken[player] = nil
	DragonState.Flying[player] = nil
end

return DragonState

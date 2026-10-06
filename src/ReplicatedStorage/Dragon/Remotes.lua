--[[
	====================================================================
	Remotes.lua — إنشاء واستخدام RemoteEvents
	====================================================================
	السيرفر هو اللي بينشئها (Remotes.Init()) والكل بيستناها (Remotes.Get())

	الأحداث:
	  Cast      كلينت -> سيرفر : طلب مهارة
	  VFX       سيرفر -> الكل  : شغّل تأثير بصري (تكرار للباقين)
	  Cooldown  سيرفر -> كلينت : تأكيد الكول داون
	  Damage    سيرفر -> كلينت : رقم الضرر الطاير
	  Morph     كلينت -> سيرفر : تحوّل تنين/إنسان
]]

local Remotes = {}

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(script.Parent.Config)

Remotes.Names = { "Cast", "VFX", "Cooldown", "Damage", "Morph", "Morphed", "Hit" }

local folder

function Remotes.Init()
	if folder then return folder end
	folder = ReplicatedStorage:FindFirstChild(Config.Net.RemoteName)
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = Config.Net.RemoteName
		folder.Parent = ReplicatedStorage
	end
	for _, name in ipairs(Remotes.Names) do
		if not folder:FindFirstChild(name) then
			local ev = Instance.new("RemoteEvent")
			ev.Name = name
			ev.Parent = folder
		end
	end
	return folder
end

function Remotes.Folder()
	folder = ReplicatedStorage:FindFirstChild(Config.Net.RemoteName)
	return folder
end

function Remotes.Get(name, timeout)
	local f = Remotes.Folder()
	if not f then f = ReplicatedStorage:WaitForChild(Config.Net.RemoteName, timeout or 30) end
	if not f then return nil end
	local ev = f:FindFirstChild(name)
	if not ev then ev = f:WaitForChild(name, timeout or 30) end
	return ev
end

-- بعت لكل اللاعبين ما عدا لاعب معين
function Remotes.FireAllExcept(name, exceptPlayer, ...)
	local ev = Remotes.Get(name)
	if not ev then return end
	for _, plr in ipairs(game:GetService("Players"):GetPlayers()) do
		if plr ~= exceptPlayer then
			ev:FireClient(plr, ...)
		end
	end
end

-- بعت للكل (بما فيهم صاحب المهارة)
function Remotes.FireAll(name, ...)
	local ev = Remotes.Get(name)
	if not ev then return end
	ev:FireAllClients(...)
end

return Remotes

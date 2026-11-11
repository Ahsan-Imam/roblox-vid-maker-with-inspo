-- Single-character gestures. Wave/Point/Laughing/Happy use Roblox's real
-- default emotes when available; everything else (and the fallback) is a
-- procedural joint tween, so no animation asset id is guessed anywhere.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local AnimationController = require(ReplicatedStorage.Animations.AnimationController)

local GestureLibrary = {}

local REAL_EMOTE_NAMES = {
	Wave = "wave",
	Point = "point",
	Laughing = "laugh",
	Happy = "cheer",
}

local JOINT_PATHS = {
	R15 = {
		Neck = "Head.Neck",
		RightShoulder = "RightUpperArm.RightShoulder",
		LeftShoulder = "LeftUpperArm.LeftShoulder",
	},
	R6 = {
		Neck = "Torso.Neck",
		RightShoulder = "Torso.Right Shoulder",
		LeftShoulder = "Torso.Left Shoulder",
	},
}

-- model -> list of { tween, motor, original } for procedural gestures in flight
local activeSwings = {}

local function rigTypeOf(model)
	return model:FindFirstChild("UpperTorso") and "R15" or "R6"
end

-- Returns the instance and property holding a joint's rest offset: C0 on a
-- classic Motor6D, or the parent-side attachment's CFrame on the newer
-- AnimationConstraint rigs (where C0 does not exist).
local function getJointOffset(model, jointKey)
	local path = JOINT_PATHS[rigTypeOf(model)][jointKey]
	local partName, jointName = path:match("^(.-)%.(.+)$")
	local part = model:FindFirstChild(partName)
	local joint = part and part:FindFirstChild(jointName)
	if not joint then
		return nil
	end
	if joint:IsA("Motor6D") then
		return joint, "C0"
	end
	return joint.Attachment0, "CFrame"
end

-- Swings a joint to an offset and back `repeatCount` times (-1 = forever).
local function swing(model, jointKey, angle, duration, repeatCount)
	local holder, property = getJointOffset(model, jointKey)
	if not holder then
		return
	end
	local original = holder[property]
	local target = original * CFrame.Angles(angle.X or 0, angle.Y or 0, angle.Z or 0)
	local repeats = repeatCount == -1 and -1 or (repeatCount or 1) - 1
	local tween = TweenService:Create(
		holder,
		TweenInfo.new(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, repeats, true),
		{ [property] = target }
	)
	tween.Completed:Connect(function()
		holder[property] = original
	end)
	activeSwings[model] = activeSwings[model] or {}
	table.insert(activeSwings[model], { tween = tween, holder = holder, property = property, original = original })
	tween:Play()
end

local GESTURES = {
	Wave = function(model, n) swing(model, "RightShoulder", { Z = math.rad(150) }, 0.35, n or 4) end,
	Point = function(model) swing(model, "RightShoulder", { X = math.rad(90) }, 0.5, 1) end,
	Happy = function(model)
		swing(model, "LeftShoulder", { Z = math.rad(-140) }, 0.3, 3)
		swing(model, "RightShoulder", { Z = math.rad(140) }, 0.3, 3)
	end,
	Sad = function(model)
		swing(model, "Neck", { X = math.rad(-25) }, 0.8, 1)
	end,
	Angry = function(model)
		swing(model, "Neck", { Z = math.rad(10) }, 0.15, 6)
	end,
	Surprised = function(model)
		swing(model, "Neck", { X = math.rad(12) }, 0.2, 1)
		swing(model, "LeftShoulder", { Z = math.rad(-70) }, 0.25, 1)
		swing(model, "RightShoulder", { Z = math.rad(70) }, 0.25, 1)
	end,
	Confused = function(model)
		swing(model, "Neck", { Z = math.rad(18) }, 0.45, 2)
	end,
	Laughing = function(model) swing(model, "Neck", { X = math.rad(15) }, 0.2, 5) end,
	Crying = function(model)
		swing(model, "Neck", { X = math.rad(-30) }, 0.6, 1)
	end,
	Shocked = function(model)
		swing(model, "Neck", { X = math.rad(15) }, 0.4, 1)
		swing(model, "LeftShoulder", { Z = math.rad(-110) }, 0.4, 1)
		swing(model, "RightShoulder", { Z = math.rad(110) }, 0.4, 1)
	end,
	Talking = function(model) swing(model, "Neck", { X = math.rad(6) }, 0.18, 8) end,
	Listening = function(model) swing(model, "Neck", { X = math.rad(-8) }, 0.8, 2) end,
	TurnAround = function(model)
		local root = model:FindFirstChild("HumanoidRootPart")
		if root then
			TweenService:Create(
				root,
				TweenInfo.new(0.6, Enum.EasingStyle.Sine),
				{ CFrame = root.CFrame * CFrame.Angles(0, math.rad(180), 0) }
			):Play()
		end
	end,
}

function GestureLibrary.stop(model)
	AnimationController.stopEmote(model)
	for _, entry in ipairs(activeSwings[model] or {}) do
		entry.tween:Cancel()
		entry.holder[entry.property] = entry.original
	end
	activeSwings[model] = nil
end

-- options.loop keeps the gesture going until GestureLibrary.stop(model).
function GestureLibrary.play(model, gestureName, options)
	local fn = GESTURES[gestureName]
	assert(fn, "Unknown gesture: " .. tostring(gestureName))
	local loop = options and options.loop == true
	GestureLibrary.stop(model)

	local realEmoteName = REAL_EMOTE_NAMES[gestureName]
	if realEmoteName and AnimationController.playEmote(model, realEmoteName, loop) then
		return
	end
	fn(model, loop and -1 or nil)
end

return GestureLibrary

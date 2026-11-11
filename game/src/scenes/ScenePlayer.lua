-- Plays a timed storyboard (see production/storyboards/*.json): spawns the
-- cast, then runs each beat's actions at beat.start + action.t.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Workspace = game:GetService("Workspace")

local CharacterFactory = require(ReplicatedStorage.Characters.CharacterFactory)
local CharacterPresets = require(ReplicatedStorage.Characters.CharacterPresets)
local AnimationController = require(ReplicatedStorage.Animations.AnimationController)
local GestureLibrary = require(ReplicatedStorage.Animations.GestureLibrary)
local CameraDirector = require(ReplicatedStorage.Camera.CameraDirector)

local STAND_Y = 3.6

local ScenePlayer = {}

local function onGround(xz)
	return Vector3.new(xz[1], STAND_Y, xz[2])
end

local function vector3(xyz)
	return Vector3.new(xyz[1], xyz[2], xyz[3])
end

local function place(model, at, facing)
	local position = onGround(at)
	model:PivotTo(CFrame.lookAt(position, onGround(facing)))
end

function ScenePlayer.spawnCast(storyboard)
	local cast = {}
	for _, entry in ipairs(storyboard.characters) do
		local preset = assert(CharacterPresets[entry.preset], "Unknown character preset: " .. tostring(entry.preset))
		local model = CharacterFactory.create(preset)
		model.Name = entry.name
		model.Parent = Workspace
		place(model, entry.at, entry.facing)
		cast[entry.name] = model
	end
	return cast
end

function ScenePlayer.attachAnimations(cast)
	for _, model in pairs(cast) do
		AnimationController.attachLocomotion(model)
	end
end

-- A wrapped present: the only prop so far. Add a prop table when a second one is needed.
local function spawnGift(position)
	local function block(size, color)
		local part = Instance.new("Part")
		part.Anchored = true
		part.Size = size
		part.Color = color
		part.Material = Enum.Material.SmoothPlastic
		part.Position = Vector3.new(position.X, 1.3, position.Z)
		part.Parent = Workspace
	end
	block(Vector3.new(2.2, 2.2, 2.2), Color3.fromRGB(220, 40, 60))
	block(Vector3.new(2.3, 2.3, 0.5), Color3.fromRGB(255, 215, 70))
	block(Vector3.new(0.5, 2.3, 2.3), Color3.fromRGB(255, 215, 70))
end

local function runAction(action, cast, environment)
	local model = action.who and assert(cast[action.who], "Unknown character: " .. tostring(action.who))
	local kind = action["do"]
	if kind == "gesture" then
		GestureLibrary.play(model, action.name, { loop = action.loop })
	elseif kind == "stopGesture" then
		GestureLibrary.stop(model)
	elseif kind == "walk" then
		AnimationController.walkTo(model, onGround(action.to), action.speed)
	elseif kind == "face" then
		local root = model.HumanoidRootPart
		local target = onGround(action.target)
		root.CFrame = CFrame.lookAt(root.Position, Vector3.new(target.X, root.Position.Y, target.Z))
	elseif kind == "teleport" then
		place(model, action.to, action.facing)
	elseif kind == "hide" then
		model.Parent = ServerStorage
	elseif kind == "prop" then
		spawnGift(onGround(action.at))
	elseif kind == "lighting" then
		environment.setLighting(action.preset)
	elseif kind == "camera" then
		CameraDirector.cut({
			pos = vector3(action.pos),
			look = action.look and vector3(action.look),
			target = action.target,
			fov = action.fov,
			toFov = action.toFov,
			tween = action.tween,
		})
	else
		error("Unknown action: " .. tostring(kind))
	end
end

-- Yields until the storyboard has finished.
function ScenePlayer.play(storyboard, cast, environment)
	for _, beat in ipairs(storyboard.beats) do
		for index, action in ipairs(beat.actions or {}) do
			task.delay(beat.start + (action.t or 0), function()
				local ok, err = pcall(runAction, action, cast, environment)
				if not ok then
					warn(string.format("[ScenePlayer] beat %s action %d failed: %s", beat.id, index, tostring(err)))
				end
			end)
		end
	end
	Workspace:SetAttribute("SceneState", "playing")
	print("[ScenePlayer] Playing " .. storyboard.title .. " (" .. storyboard.total .. "s)")
	task.wait(storyboard.total)
	Workspace:SetAttribute("SceneState", "done")
	print("[ScenePlayer] Done")
end

return ScenePlayer

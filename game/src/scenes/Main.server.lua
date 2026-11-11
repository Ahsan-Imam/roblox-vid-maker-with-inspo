-- Entry point: builds the set, spawns the cast and plays Storyboard.json
-- (written by production/scripts/build-timeline.mjs) once a player has joined.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local ScenePlayer = require(script.Parent.ScenePlayer)
local storyboard = require(script.Parent.Storyboard)
local environment = require(ReplicatedStorage.Environments[storyboard.environment])

-- The tester's own avatar must exist (Play mode) but must never be on camera.
local function hideCharacter(character)
	local root = character:WaitForChild("HumanoidRootPart")
	local humanoid = character:WaitForChild("Humanoid")
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	task.wait(0.5) -- let accessories finish loading before hiding them
	root.Anchored = true
	character:PivotTo(CFrame.new(0, 400, 400))
	for _, item in ipairs(character:GetDescendants()) do
		if item:IsA("BasePart") or item:IsA("Decal") then
			item.Transparency = 1
		end
	end
end

local function onPlayer(player)
	player.CharacterAdded:Connect(hideCharacter)
	if player.Character then
		task.spawn(hideCharacter, player.Character)
	end
end
Players.PlayerAdded:Connect(onPlayer)
for _, player in ipairs(Players:GetPlayers()) do
	onPlayer(player)
end

for _, item in ipairs(Workspace:GetDescendants()) do
	if item:IsA("SpawnLocation") then
		item.Transparency = 1
		item.CanCollide = false
		for _, decal in ipairs(item:GetChildren()) do
			if decal:IsA("Decal") then
				decal.Transparency = 1
			end
		end
	end
end

-- Anything else placed in the Workspace would wander into shot. Stored for
-- this play session only; the saved place is untouched.
for _, item in ipairs(Workspace:GetChildren()) do
	if item:IsA("Model") and not Players:GetPlayerFromCharacter(item) then
		item.Parent = game:GetService("ServerStorage")
	end
end

environment.build(Workspace)
local cast = ScenePlayer.spawnCast(storyboard)

while #Players:GetPlayers() == 0 do
	task.wait(0.1)
end
task.wait(3) -- client finishes loading; cast settles on the ground
ScenePlayer.attachAnimations(cast)
ScenePlayer.play(storyboard, cast, environment)

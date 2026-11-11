local Players = game:GetService("Players")

local DEFAULT_SKIN = Color3.fromRGB(255, 204, 153)
local DEFAULT_SHIRT = Color3.fromRGB(255, 255, 255)
local DEFAULT_PANTS = Color3.fromRGB(80, 80, 80)

local CharacterFactory = {}

-- config: { name: string, rig: "R15"|"R6", skinColor, shirtColor, pantsColor, hairColor: Color3? }
-- Builds a classic blocky Roblox avatar via the official HumanoidDescription API
-- (no catalog asset ids, so appearance is 100% reproducible across machines).
function CharacterFactory.create(config)
	assert(type(config) == "table", "CharacterFactory.create expects a config table")
	assert(type(config.name) == "string" and #config.name > 0, "config.name is required")

	local rigType = (config.rig == "R6") and Enum.HumanoidRigType.R6 or Enum.HumanoidRigType.R15

	local shirtColor = config.shirtColor or DEFAULT_SHIRT
	local pantsColor = config.pantsColor or DEFAULT_PANTS
	local skinColor = config.skinColor or DEFAULT_SKIN

	local description = Instance.new("HumanoidDescription")
	description.HeadColor = skinColor
	description.TorsoColor = shirtColor
	description.LeftArmColor = shirtColor
	description.RightArmColor = shirtColor
	description.LeftLegColor = pantsColor
	description.RightLegColor = pantsColor

	local model = Players:CreateHumanoidModelFromDescription(description, rigType)
	model.Name = config.name

	local humanoid = model:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.DisplayName = config.name
		-- Floating name tags break the cinematic look; captions name the speaker.
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	end

	if config.hairColor then
		CharacterFactory._addHairBlock(model, config.hairColor)
	end

	return model
end

-- Classic-blocky hair: a colored block welded to the head, not a catalog accessory,
-- so it needs no asset id verification and renders identically everywhere.
function CharacterFactory._addHairBlock(model, hairColor)
	local head = model:FindFirstChild("Head")
	if not head then
		return
	end

	local hair = Instance.new("Part")
	hair.Name = "HairBlock"
	hair.Size = Vector3.new(head.Size.X * 0.9, head.Size.Y * 0.5, head.Size.Z * 0.9)
	hair.Color = hairColor
	hair.Material = Enum.Material.SmoothPlastic
	hair.CanCollide = false
	hair.CFrame = head.CFrame * CFrame.new(0, head.Size.Y * 0.55, 0)
	hair.Parent = model

	local weld = Instance.new("WeldConstraint")
	weld.Part0 = head
	weld.Part1 = hair
	weld.Parent = hair
end

return CharacterFactory

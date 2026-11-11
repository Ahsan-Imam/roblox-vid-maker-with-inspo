-- A residential street running along the Z axis: road, sidewalks, houses and
-- street lamps, with night and morning lighting presets.
local Lighting = game:GetService("Lighting")

local Street = {}

local lampLights = {}

local function part(parent, size, position, color, material)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.Position = position
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local HOUSE_COLORS = {
	Color3.fromRGB(196, 164, 132),
	Color3.fromRGB(150, 170, 190),
	Color3.fromRGB(200, 190, 160),
	Color3.fromRGB(170, 140, 140),
}

local function house(parent, x, z, index)
	local side = x > 0 and -1 or 1 -- which way the front faces (toward the road)
	local body = part(parent, Vector3.new(14, 10, 14), Vector3.new(x, 5.5, z), HOUSE_COLORS[index % #HOUSE_COLORS + 1], Enum.Material.Brick)
	part(parent, Vector3.new(16, 1.5, 16), Vector3.new(x, 11.25, z), Color3.fromRGB(80, 50, 45), Enum.Material.Slate)
	local frontX = x + side * 7.05
	part(parent, Vector3.new(0.2, 6, 3), Vector3.new(frontX, 3.5, z), Color3.fromRGB(90, 60, 40), Enum.Material.Wood)
	for _, dz in ipairs({ -4.5, 4.5 }) do
		part(parent, Vector3.new(0.2, 3, 3), Vector3.new(frontX, 6.5, z + dz), Color3.fromRGB(150, 120, 60), Enum.Material.Neon)
	end
	return body
end

local function lamp(parent, x, z)
	local side = x > 0 and -1 or 1
	part(parent, Vector3.new(0.5, 11, 0.5), Vector3.new(x, 6, z), Color3.fromRGB(40, 40, 45), Enum.Material.Metal)
	part(parent, Vector3.new(3, 0.4, 0.5), Vector3.new(x + side * 1.5, 11.3, z), Color3.fromRGB(40, 40, 45), Enum.Material.Metal)
	local bulb = part(parent, Vector3.new(1.2, 0.5, 1.2), Vector3.new(x + side * 2.6, 11, z), Color3.fromRGB(255, 235, 180), Enum.Material.Neon)
	local light = Instance.new("PointLight")
	light.Range = 30
	light.Brightness = 0.9
	light.Color = Color3.fromRGB(255, 225, 170)
	light.Parent = bulb
	table.insert(lampLights, light)
end

function Street.build(parent)
	local model = Instance.new("Model")
	model.Name = "Street"

	part(model, Vector3.new(300, 1, 300), Vector3.new(0, -0.4, -30), Color3.fromRGB(70, 120, 60), Enum.Material.Grass)
	part(model, Vector3.new(18, 1, 220), Vector3.new(0, -0.3, -30), Color3.fromRGB(50, 50, 55), Enum.Material.Asphalt)
	for _, x in ipairs({ -12, 12 }) do
		part(model, Vector3.new(6, 1, 220), Vector3.new(x, -0.1, -30), Color3.fromRGB(160, 160, 165), Enum.Material.Concrete)
	end
	for z = -130, 70, 10 do
		part(model, Vector3.new(0.5, 0.05, 4), Vector3.new(0, 0.22, z), Color3.fromRGB(230, 200, 60))
	end

	local index = 0
	for z = -120, 60, 22 do
		for _, x in ipairs({ -26, 26 }) do
			index += 1
			house(model, x, z, index)
		end
	end
	for z = -126, 70, 28 do
		lamp(model, -10.5, z)
		lamp(model, 10.5, z)
	end

	model.Parent = parent
	return model
end

function Street.setLighting(preset)
	local night = preset == "night"
	Lighting.ClockTime = night and 0 or 8.5
	Lighting.Brightness = night and 0.5 or 2.5
	Lighting.Ambient = night and Color3.fromRGB(125, 130, 170) or Color3.fromRGB(130, 130, 130)
	Lighting.OutdoorAmbient = night and Color3.fromRGB(105, 110, 150) or Color3.fromRGB(140, 140, 140)
	Lighting.ExposureCompensation = night and 0 or 0
	-- The template place ships bloom/blur effects that wash out a night scene.
	for _, effect in ipairs(Lighting:GetChildren()) do
		if effect:IsA("PostEffect") then
			effect.Enabled = false
		end
	end
	Lighting.FogColor = night and Color3.fromRGB(10, 12, 25) or Color3.fromRGB(190, 210, 230)
	Lighting.FogEnd = night and 260 or 1200
	for _, light in ipairs(lampLights) do
		light.Enabled = night
	end
end

return Street

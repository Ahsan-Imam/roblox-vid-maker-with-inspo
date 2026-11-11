-- Server-side camera direction. A shot is published as Workspace attributes;
-- game/src/client/CameraRig.client.lua applies it on the recording client.
local Workspace = game:GetService("Workspace")

local CameraDirector = {}

local sequence = 0

-- shot: { pos = Vector3, look = Vector3?, target = string? (model name to track),
--         fov = number?, toFov = number?, tween = seconds? }
function CameraDirector.cut(shot)
	assert(shot.pos and (shot.look or shot.target), "camera shot needs pos and look or target")
	sequence += 1
	Workspace:SetAttribute("CamPos", shot.pos)
	Workspace:SetAttribute("CamLook", shot.look or Vector3.zero)
	Workspace:SetAttribute("CamTarget", shot.target or "")
	Workspace:SetAttribute("CamFov", shot.fov or 50)
	Workspace:SetAttribute("CamToFov", shot.toFov or shot.fov or 50)
	Workspace:SetAttribute("CamTween", shot.tween or 0)
	Workspace:SetAttribute("CamSeq", sequence)
end

return CameraDirector

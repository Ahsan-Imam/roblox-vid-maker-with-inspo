-- Recording client: applies the shot published by CameraDirector every frame,
-- hides Roblox UI, and shows a white slate whenever the scene is not playing.
-- The slate is what the render step looks for to find the scene's first frame.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local slateGui = Instance.new("ScreenGui")
slateGui.Name = "Slate"
slateGui.IgnoreGuiInset = true
slateGui.DisplayOrder = 1000
slateGui.ResetOnSpawn = false
local slate = Instance.new("Frame")
slate.Size = UDim2.fromScale(1, 1)
slate.BackgroundColor3 = Color3.new(1, 1, 1)
slate.BorderSizePixel = 0
slate.Parent = slateGui
slateGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

task.spawn(function()
	-- SetCoreGuiEnabled can fail until CoreGui has registered; retry briefly.
	for _ = 1, 20 do
		local hidCore = pcall(StarterGui.SetCoreGuiEnabled, StarterGui, Enum.CoreGuiType.All, false)
		local hidTopbar = pcall(StarterGui.SetCore, StarterGui, "TopbarEnabled", false)
		if hidCore and hidTopbar then
			break
		end
		task.wait(0.25)
	end
end)
UserInputService.MouseIconEnabled = false

local shotStartedAt = 0
Workspace:GetAttributeChangedSignal("CamSeq"):Connect(function()
	shotStartedAt = os.clock()
end)

RunService:BindToRenderStep("CameraRig", Enum.RenderPriority.Camera.Value + 1, function()
	local playing = Workspace:GetAttribute("SceneState") == "playing"
	slateGui.Enabled = not playing
	local pos = Workspace:GetAttribute("CamPos")
	if not (playing and pos) then
		return
	end

	local lookAt = Workspace:GetAttribute("CamLook")
	local targetName = Workspace:GetAttribute("CamTarget")
	if targetName and targetName ~= "" then
		local model = Workspace:FindFirstChild(targetName)
		local root = model and model:FindFirstChild("HumanoidRootPart")
		if root then
			lookAt = root.Position + Vector3.new(0, 1.2, 0)
		end
	end

	local fov = Workspace:GetAttribute("CamFov") or 50
	local tween = Workspace:GetAttribute("CamTween") or 0
	if tween > 0 then
		local alpha = math.clamp((os.clock() - shotStartedAt) / tween, 0, 1)
		fov += ((Workspace:GetAttribute("CamToFov") or fov) - fov) * alpha
	end

	-- Fetched every frame: Roblox replaces CurrentCamera on respawn.
	local camera = Workspace.CurrentCamera
	camera.CameraType = Enum.CameraType.Scriptable
	-- The camera is rolled 90 degrees so Studio's wide viewport records a tall
	-- 9:16 picture at near-native resolution; the render step rotates it back.
	-- Storyboard fov is the final video's vertical fov, so convert it to the
	-- fov across the video's width, which is what the rolled camera's
	-- FieldOfView measures.
	camera.FieldOfView = math.deg(2 * math.atan(math.tan(math.rad(fov) / 2) * 9 / 16))
	camera.CFrame = CFrame.lookAt(pos, lookAt) * CFrame.Angles(0, 0, math.rad(90))
end)

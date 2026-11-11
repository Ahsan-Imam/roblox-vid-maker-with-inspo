-- Plays Roblox's own default animations on NPCs. The animation ids are read
-- from a live "Animate" script (the NPC's own, else a player's), whose
-- children ("idle", "walk", "wave", "point", ...) each hold Animation objects,
-- so no asset id is ever typed by hand here. Tracks are played from the
-- server because the Animate LocalScript itself never runs inside an NPC.
local Players = game:GetService("Players")

local AnimationController = {}

local emoteTracks = {}

local function findAnimateScript(model)
	local own = model:FindFirstChild("Animate")
	if own then
		return own
	end
	for _, player in ipairs(Players:GetPlayers()) do
		local animate = player.Character and player.Character:FindFirstChild("Animate")
		if animate then
			return animate
		end
	end
	return nil
end

function AnimationController.findAnimationId(model, name)
	local animate = findAnimateScript(model)
	local holder = animate and animate:FindFirstChild(name)
	local animation = holder and holder:FindFirstChildWhichIsA("Animation")
	return animation and animation.AnimationId
end

local function loadTrack(model, name)
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	local animationId = humanoid and AnimationController.findAnimationId(model, name)
	if not animationId then
		return nil
	end
	local animator = humanoid:FindFirstChildOfClass("Animator")
	if not animator then
		animator = Instance.new("Animator")
		animator.Parent = humanoid
	end
	local animation = Instance.new("Animation")
	animation.AnimationId = animationId
	return animator:LoadAnimation(animation)
end

-- Idle when still, walk cycle when moving. Returns false if no ids were found.
function AnimationController.attachLocomotion(model)
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	local idle = loadTrack(model, "idle")
	local walk = loadTrack(model, "walk") or loadTrack(model, "run")
	if not (humanoid and idle and walk) then
		warn("[AnimationController] No idle/walk animations found for " .. model.Name)
		return false
	end
	idle.Priority = Enum.AnimationPriority.Idle
	idle.Looped = true
	walk.Priority = Enum.AnimationPriority.Movement
	walk.Looped = true
	idle:Play()
	humanoid.Running:Connect(function(speed)
		if speed > 0.5 then
			if not walk.IsPlaying then
				walk:Play(0.15)
			end
			walk:AdjustSpeed(math.clamp(speed / 12, 0.5, 1.6))
		elseif walk.IsPlaying then
			walk:Stop(0.15)
		end
	end)
	return true
end

function AnimationController.walkTo(model, position, walkSpeed)
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return
	end
	humanoid.WalkSpeed = walkSpeed or 16
	humanoid:MoveTo(position)
end

-- Plays a default emote ("wave", "point", "laugh", "cheer"). False = not available.
function AnimationController.playEmote(model, emoteName, looped)
	local track = loadTrack(model, emoteName)
	if not track then
		return false
	end
	AnimationController.stopEmote(model)
	track.Priority = Enum.AnimationPriority.Action
	track.Looped = looped == true
	track:Play(0.2)
	emoteTracks[model] = track
	return true
end

function AnimationController.stopEmote(model)
	local track = emoteTracks[model]
	if track then
		track:Stop(0.3)
		emoteTracks[model] = nil
	end
end

return AnimationController

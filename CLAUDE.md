# roblox_video — Automated Roblox AI Video Generator

Prompt-to-MP4 pipeline: natural-language story → Roblox Studio scene (characters,
animation, camera) → OBS recording → Remotion/FFmpeg edit → final vertical MP4.

## Status
The pipeline works end to end with no manual steps: storyboard JSON → voices and
timing → Studio scene → OBS take → captioned 1080×1920 MP4. First reel:
`output/final/in-my-town.mp4`. Use the `/create-video` skill
(`.claude/skills/create-video/SKILL.md`) for the workflow.

How it fits together:
- `production/storyboards/<title>.json` is the source. `npm run timeline -- <file>`
  speaks each line (macOS `say`), times the beats and writes
  `game/src/scenes/Storyboard.json`, which the scene, captions and audio all read.
- `npm run push` loads `game/src` into Studio through Studio's own MCP server
  (`production/scripts/studio-mcp.mjs` talks to the `StudioMCP` binary directly;
  the Rojo plugin is not needed and was found not to be syncing).
- `npm run record` raises Studio, starts OBS, presses Play, waits, stops both.
- `npm run render` finds the scene start from a white slate the client shows,
  crops Studio's viewport (`production/capture.json`), and outputs the final file.
- The in-game camera is rolled 90° on purpose so the wide viewport records a
  tall frame at near-native resolution; the render rotates it back.

Not built yet: ElevenLabs voices, music and sound effects, Remotion (captions are
ffmpeg drawtext), environments other than `Street`, facial expressions, two-body
interactions (hug, handshake, fight). Credentials go in `.env` (never commit).

## Stack
- Roblox Studio + Luau — characters, environments, animation, camera (R15 Block default, R6 supported)
- Rojo — syncs `game/src` into Studio
- OBS Studio (WebSocket) — recording
- Remotion (React, JavaScript not TypeScript) — subtitles, captions, transitions, final composition
- FFmpeg — audio/video processing
- ElevenLabs API (optional) — voice generation; local audio files are the fallback
- Output target: MP4, 1080×1920, 30fps, 9:16, saved to `output/final/`

## Environment
- Roblox Studio, Rojo 7.7.1, OBS 33.0.1 (bundles obs-websocket — no separate plugin needed) all installed.
- Rojo Studio plugin installed to `~/Documents/Roblox/Plugins/RojoManagedPlugin.rbxm`.
- `ffmpeg-full` (keg-only, `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`) is used for rendering: the standard `ffmpeg` formula has no drawtext.
- Studio's MCP server must be enabled in Studio's Assistant settings. It attaches to a new client after a short delay; `studio-mcp.mjs` waits for it.
- Current Roblox R15 rigs use `AnimationConstraint` joints, not `Motor6D` (no `C0`); procedural gestures tween the joint's `Attachment0.CFrame` instead.
- OBS records the whole display (2560×1664). Never have `.env` or other secrets on screen during a take.
- Roblox Studio has no headless/CLI render mode on macOS. Recording means driving the real Studio GUI window and capturing it with OBS — this is the most fragile part of the pipeline; design for graceful retry/failure here, not around it.
- OBS WebSocket must be enabled manually (Tools > WebSocket Server Settings) and OBS needs macOS Screen Recording permission granted by the user — both require a human in the GUI.

## Directory layout
```
.claude/skills/create-video/   Claude Code skill: natural-language prompt -> video
game/src/
  characters/                  avatar rig + customization code
  animations/                  reusable movement/expression/interaction animations
  environments/                modular scene templates
  camera/                      cinematic camera system
  scenes/                      per-story scene assembly
production/
  scripts/                     automation scripts (recording, orchestration)
  storyboards/                 generated storyboard JSON per story
  voices/                      voice config/identity mappings
  timelines/                   scene/dialogue timing data
editor/remotion/               Remotion video composition (React, JS)
assets/                        characters/maps/sounds/music — reusable, not regenerated per video
output/recordings/             raw OBS captures (intermediate)
output/final/                  finished MP4s
prompts/                       original and per-video story prompts
```

## Agent boundaries (strict — see original spec in prompts/ for full rationale)
The main agent plans, assigns, integrates and verifies. If subagents are used, each
has a hard file-ownership boundary and may not cross into another's scope:

| Agent | Owns | Must not touch |
|---|---|---|
| Roblox Agent | `game/**` (Luau, characters, animations, environments, camera) | `editor/**`, audio/voice logic |
| Video Agent | `editor/**` (Remotion, React composition, subtitles, rendering) | `game/**` |
| Audio Agent | voice generation, audio processing, sound effects (`production/voices/**`, `assets/sounds/`, `assets/music/`) | `game/**`, `editor/**` character/env logic |
| Testing Agent | validation, testing, reporting | independent architecture rewrites |

Shared config changes (root `package.json`, `CLAUDE.md`, this file's structure) require
main-agent approval, not a subagent's own initiative.

## Hard rules
- Never install dependencies, delete files/assets, overwrite existing assets, or run
  destructive commands without explicit user approval.
- Never hardcode or print API keys/tokens/credentials (ElevenLabs, OBS WebSocket password, etc.) — use env vars, never commit them.
- Never publish a Roblox experience or upload/publish a finished video automatically.
- Verify before claiming done: confirm the final MP4 exists, is readable, and matches the expected resolution/duration/fps — don't assert success without checking.
- Don't expand scope (new stages, new tech) without flagging it first.

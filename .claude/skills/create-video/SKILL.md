---
name: create-video
description: Turn a natural-language story prompt into a vertical 1080x1920 Roblox character animation video (storyboard, voices, Studio recording, captions, final MP4).
---

# create-video

Produce one reel from the user's prompt using the existing pipeline. Do not
rebuild the pipeline; write a storyboard and run the scripts.

## Before starting
- Roblox Studio must be open on a place, in Edit mode, with the MCP server
  enabled in its Assistant settings. OBS must be open with a Display Capture
  source and its WebSocket password in `.env`.
- No file showing secrets (`.env`) may be visible on screen: OBS records the
  whole display.

## Steps
1. **Write the storyboard** to `production/storyboards/<title>.json`, using
   `production/storyboards/in-my-town.json` as the format reference.
   - Hook in the first 3 seconds, a clear turn, and an ending. 30 to 45 seconds.
   - Each beat has either a `speaker` + `text` (duration comes from the voice
     audio) or a `duration` for silent action.
   - Actions: `camera`, `walk`, `face`, `teleport`, `gesture` (optional
     `loop`), `stopGesture`, `hide`, `lighting`. `t` delays an action within
     its beat.
   - Positions are `[x, z]` on the street (it runs along Z); camera `pos` and
     `look` are `[x, y, z]`. `fov` is the final video's vertical field of view:
     about 56 for a talking shot, 20 to 30 for a distant subject.
   - Keep subjects centred: the frame is tall and narrow.
   - New characters go in `game/src/characters/CharacterPresets.lua`; each
     speaker needs a voice in the storyboard's `voices` map (`say -v '?'`).
2. `npm run timeline -- production/storyboards/<title>.json` to speak the lines and time the beats.
3. `npm run push` to load the code and storyboard into Studio.
4. `npm run record` to capture the take. Fix anything it lists under "Studio reported problems".
5. `npm run render` to produce `output/final/<title>.mp4`. It fails if the file is not 1080x1920 at 30fps with the storyboard's duration.
6. **Look at the result**: extract a frame per beat with ffmpeg and view them.
   Check framing, lighting and that captions match the action. Adjust the
   storyboard and repeat from step 2 if a shot is wrong.

## Limits to tell the user about
- Voices are macOS `say` voices; ElevenLabs is not wired in yet.
- No music or sound effects yet (`assets/music`, `assets/sounds` are empty).
- One environment exists: `Street` (night and morning lighting).
- Faces do not change expression; emotion is body language only.
- Never upload or publish the video; hand the user the file path.

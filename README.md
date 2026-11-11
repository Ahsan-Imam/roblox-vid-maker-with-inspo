# Roblox video maker

Turns a story into a vertical (1080×1920, 30fps) Roblox reel: storyboard → voices and timing → Roblox Studio scene → OBS recording → captioned MP4.

## What you need (macOS)
- Roblox Studio, with its MCP server enabled in the Assistant settings
- OBS Studio with its WebSocket server enabled, plus Screen Recording permission
- `ffmpeg-full` (`brew install ffmpeg-full`) and Node 24
- Optional: an ElevenLabs API key for natural voices. Without it, macOS `say` voices work.

Copy `.env.example` to `.env` and fill it in. Never commit `.env`.

## Make a video
1. Write `production/storyboards/<title>.json` (see `in-my-town.json` for the format).
2. `npm run timeline -- production/storyboards/<title>.json` speaks the lines and times the beats.
3. `npm run push` loads the scene into Studio.
4. `npm run record` records one take with OBS (Studio must be open in Edit mode, with nothing secret on screen).
5. `npm run render` writes `output/final/<title>.mp4`.

Voices are set per speaker in the storyboard: a macOS voice name (`"Daniel"`) or an ElevenLabs one (`"el:Brian"`; Adam and other library voices need a paid plan).

## Layout
- `game/src/` Luau for characters, animations, camera and the `Street` environment
- `production/` storyboards, voices and the automation scripts
- `tools/video-downloader/` a small local page for saving YouTube/Instagram videos as inspiration (`pip3 install yt-dlp`, then `python3 app.py`)
- `output/` recordings and finished videos (not committed)

## Not built yet
Music and sound effects, other environments, facial expressions, and two-character interactions such as hugs.

Only download videos you have the right to use. Videos are never uploaded or published automatically.

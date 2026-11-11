// Turns a storyboard into a timed one: speaks each line with the macOS `say`
// voice for its speaker, measures the audio, and lays beats end to end.
// The result is written into game/src/scenes so Rojo syncs it into Studio,
// which makes one file the timing source for the scene, captions and audio.
// Usage: node build-timeline.mjs production/storyboards/<name>.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const storyboardPath = process.argv[2];
if (!storyboardPath) {
	console.error("Usage: node build-timeline.mjs <storyboard.json>");
	process.exit(1);
}

// A voice of "el:<name>" uses that ElevenLabs voice (looked up by name on the account).
// Adam, Josh and Rachel are library voices now (paid plans only); the rest work on the free plan.
const PREMADE = {
	adam: "pNInz6obpgDQGcFmaJgB", josh: "TxGEqnHWrfWFTfGW9XjX", rachel: "21m00Tcm4TlvDq8ikWAM",
	brian: "nPczCjzI2devNBz1zQrb", charlie: "IKne3meq5aSn9XLyUdCD", sarah: "EXAVITQu4vr4xnSDxMaL",
};
let elevenVoices;
async function elevenLabsSpeech(name, text) {
	try {
		process.loadEnvFile(path.join(root, ".env"));
	} catch {
		// no .env: fall through to the missing-key error below
	}
	const key = process.env.ELEVENLABS_API_KEY;
	if (!key) throw new Error("ELEVENLABS_API_KEY is not set in .env");
	const call = async (url, options) => {
		const response = await fetch(url, { ...options, headers: { "xi-api-key": key, "Content-Type": "application/json" } });
		if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 200)}`);
		return response;
	};
	let voiceId = PREMADE[name.toLowerCase()];
	if (!voiceId) {
		// Other names need a key with the voices_read permission.
		elevenVoices ??= (await (await call("https://api.elevenlabs.io/v1/voices")).json()).voices;
		const voice = elevenVoices.find((v) => v.name.toLowerCase().startsWith(name.toLowerCase()));
		if (!voice) throw new Error(`ElevenLabs voice "${name}" not found. Available: ${elevenVoices.map((v) => v.name).join(", ")}`);
		voiceId = voice.voice_id;
	}
	const response = await call(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
		method: "POST",
		body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
	});
	return Buffer.from(await response.arrayBuffer());
}

const LINE_PADDING = 0.35;
const storyboard = JSON.parse(readFileSync(storyboardPath, "utf8"));
const voiceDir = path.join(root, "production", "voices", storyboard.title);
mkdirSync(voiceDir, { recursive: true });

let clock = 0;
for (const beat of storyboard.beats) {
	if (beat.speaker) {
		const voice = storyboard.voices[beat.speaker];
		if (!voice) throw new Error(`No voice configured for speaker "${beat.speaker}" (beat ${beat.id})`);
		const eleven = voice.startsWith("el:");
		const audioPath = path.join(voiceDir, `${beat.id}.${eleven ? "mp3" : "aiff"}`);
		if (eleven) writeFileSync(audioPath, await elevenLabsSpeech(voice.slice(3), beat.text));
		else execFileSync("say", ["-v", voice, "-o", audioPath, beat.text]);
		const seconds = Number(
			execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath], { encoding: "utf8" }),
		);
		beat.audio = path.relative(root, audioPath);
		beat.duration = Math.max(seconds + LINE_PADDING, beat.duration || 0);
	}
	if (!(beat.duration > 0)) throw new Error(`Beat ${beat.id} has no line and no duration`);
	beat.duration = Number(beat.duration.toFixed(2));
	beat.start = Number(clock.toFixed(2));
	clock += beat.duration;
}
storyboard.total = Number(clock.toFixed(2));

const outPath = path.join(root, "game", "src", "scenes", "Storyboard.json");
writeFileSync(outPath, JSON.stringify(storyboard, null, 2) + "\n");
console.log(`Timeline: ${storyboard.beats.length} beats, ${storyboard.total}s -> ${path.relative(root, outPath)}`);

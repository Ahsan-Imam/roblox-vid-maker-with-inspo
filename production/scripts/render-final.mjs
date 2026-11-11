// Turns a raw take into the final reel: finds the scene start from the white
// slate, cuts out Studio's viewport, rotates the sideways capture upright,
// scales to 1080x1920@30, burns captions and mixes the voice lines.
// shortcut: plain ffmpeg, move to Remotion when transitions/animated captions are needed.
// Usage: node render-final.mjs [recording]   (defaults to output/recordings/<title>.mov)
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Homebrew's standard ffmpeg has no drawtext; ffmpeg-full (keg-only) does.
const FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg";
const FONT = "/System/Library/Fonts/Supplemental/Impact.ttf";
const SPEAKER_COLORS = { Alex: "0x8ecbff", Ryan: "0xff9d8e" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const storyboard = JSON.parse(readFileSync(path.join(root, "game", "src", "scenes", "Storyboard.json"), "utf8"));
const { viewport } = JSON.parse(readFileSync(path.join(root, "production", "capture.json"), "utf8"));
const recording = process.argv[2] || path.join(root, "output", "recordings", `${storyboard.title}.mov`);
const output = path.join(root, "output", "final", `${storyboard.title}.mp4`);
mkdirSync(path.dirname(output), { recursive: true });

const viewportCrop = `crop=${viewport.w}:${viewport.h}:${viewport.x}:${viewport.y}`;

// The client shows a pure white slate until the scene starts and again when it
// ends; inverted, those are the "black" stretches blackdetect reports.
function findSceneStart() {
	const probe = spawnSync(FFMPEG, ["-i", recording, "-vf", `${viewportCrop},negate,blackdetect=d=0.3:pix_th=0.10:pic_th=0.95`, "-an", "-f", "null", "-"], {
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	const slates = [...probe.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({ start: Number(m[1]), end: Number(m[2]) }));
	if (slates.length === 0) throw new Error("No white slate found in the recording: was Studio on screen, and is production/capture.json's viewport right?");
	const sceneStart = slates[0].end;
	const sceneEnd = slates[1]?.start;
	if (sceneEnd === undefined || Math.abs(sceneEnd - sceneStart - storyboard.total) > 0.5) {
		console.warn(`Warning: expected a ${storyboard.total}s scene, slates suggest ${sceneEnd === undefined ? "no end slate" : (sceneEnd - sceneStart).toFixed(2) + "s"}`);
	}
	return sceneStart;
}

function wrap(text, width) {
	const lines = [""];
	for (const word of text.split(" ")) {
		const current = lines[lines.length - 1];
		if (current && (current + " " + word).length > width) lines.push(word);
		else lines[lines.length - 1] = current ? current + " " + word : word;
	}
	return lines.join("\n");
}

const sceneStart = findSceneStart();
console.log(`Scene starts at ${sceneStart.toFixed(2)}s in the recording`);

const tempDir = mkdtempSync(path.join(os.tmpdir(), "reel-"));
const tallWidth = Math.round((viewport.h * 16) / 9 / 2) * 2; // stretch of the sideways frame that becomes the video's height
const videoFilters = [
	viewportCrop,
	`crop=${tallWidth}:${viewport.h}:${Math.round((viewport.w - tallWidth) / 2)}:0`,
	"transpose=2",
	"scale=1080:1920:flags=lanczos",
	"fps=30",
];
const voiced = [];
storyboard.beats.forEach((beat, index) => {
	if (beat.audio) voiced.push(beat);
	if (!beat.text) return;
	const textFile = path.join(tempDir, `caption-${index}.txt`);
	writeFileSync(textFile, wrap(beat.text, beat.big ? 12 : 22));
	const style = beat.big
		? "fontsize=190:fontcolor=0xffe14d:y=(h-text_h)/2"
		: `fontsize=74:fontcolor=${SPEAKER_COLORS[beat.speaker] || "white"}:y=h*0.70-text_h/2`;
	videoFilters.push(
		`drawtext=fontfile=${FONT}:textfile=${textFile}:${style}:x=(w-text_w)/2:line_spacing=10:borderw=6:bordercolor=black:` +
			`enable='between(t,${beat.start},${(beat.start + beat.duration - 0.05).toFixed(2)})'`,
	);
});

const audioChains = voiced.map((beat, index) => `[${index + 1}:a]adelay=${Math.round(beat.start * 1000)}:all=1[v${index}]`);
const mix = `${voiced.map((_, index) => `[v${index}]`).join("")}amix=inputs=${voiced.length}:normalize=0,loudnorm=I=-16:TP=-1.5,apad[aout]`;
const filterComplex = [`[0:v]${videoFilters.join(",")}[vout]`, ...audioChains, mix].join(";");

const args = ["-y", "-loglevel", "error", "-ss", String(sceneStart), "-i", recording];
for (const beat of voiced) args.push("-i", path.join(root, beat.audio));
args.push("-filter_complex", filterComplex, "-map", "[vout]", "-map", "[aout]", "-t", String(storyboard.total));
args.push("-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", output);
execFileSync(FFMPEG, args, { stdio: "inherit" });

// Never report success without checking the file that was actually written.
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "csv=p=0", output], { encoding: "utf8" });
const [dimensions, duration] = probe.trim().split("\n");
if (dimensions !== "1080,1920,30/1" || Math.abs(Number(duration) - storyboard.total) > 0.2) {
	throw new Error(`Rendered file does not match spec: ${dimensions}, ${duration}s (wanted 1080,1920,30/1, ${storyboard.total}s)`);
}
console.log(`Rendered ${path.relative(root, output)}: 1080x1920 @30fps, ${Number(duration).toFixed(2)}s`);

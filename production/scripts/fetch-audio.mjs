// Saves the audio of a YouTube/Instagram link into assets/music (or assets/sounds)
// using the Homebrew yt-dlp, with the same host allowlist as the standalone downloader.
// Usage: node fetch-audio.mjs <url> [music|sounds]
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [url, kind = "music"] = process.argv.slice(2);
const HOSTS = ["youtube.com", "youtu.be", "instagram.com"];
const host = (URL.canParse(url ?? "") && new URL(url).hostname.toLowerCase()) || "";
if (!HOSTS.some((h) => host === h || host.endsWith("." + h))) {
	console.error("Usage: node fetch-audio.mjs <youtube/instagram url> [music|sounds]");
	process.exit(1);
}
if (!["music", "sounds"].includes(kind)) {
	console.error('Second argument must be "music" or "sounds".');
	process.exit(1);
}
const outDir = path.join(root, "assets", kind);
execFileSync(
	"yt-dlp",
	["--no-playlist", "-f", "bestaudio/best", "-x", "--audio-format", "mp3", "-o", path.join(outDir, "%(title)s.%(ext)s"), url],
	{ stdio: "inherit" },
);
console.log("Saved in", path.relative(root, outDir));

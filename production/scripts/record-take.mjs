// Records one take of the current storyboard with no manual steps: brings
// Studio to the front, starts OBS, presses Play through Studio's MCP server,
// waits for the scene to finish, then stops both and files the recording.
// Usage: node record-take.mjs   (run push-to-studio.mjs first; Studio in Edit mode)
import { readFileSync, renameSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withStudio } from "./studio-mcp.mjs";
import { openObs, sendRequest } from "./obs-recorder.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const storyboard = JSON.parse(readFileSync(path.join(root, "game", "src", "scenes", "Storyboard.json"), "utf8"));
const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const LOAD_ALLOWANCE = 12; // Play-mode startup plus the scene's own 3s settle

const obs = await openObs();
let outputPath;
await withStudio(async (studio) => {
	// `open -a` does not raise Studio over the editor on current macOS; AppleScript does.
	const previousApp = execFileSync("osascript", ["-e", 'tell application "System Events" to get name of first process whose frontmost is true'], { encoding: "utf8" }).trim();
	const frontApp = () => execFileSync("osascript", ["-e", 'tell application "System Events" to get name of first process whose frontmost is true'], { encoding: "utf8" }).trim();
	for (let attempt = 0; attempt < 5 && frontApp() !== "RobloxStudio"; attempt++) {
		execFileSync("osascript", ["-e", 'tell application "RobloxStudio" to activate']);
		await sleep(1.5);
	}
	// OBS records the whole display, so a take with another app in front is useless.
	if (frontApp() !== "RobloxStudio") throw new Error(`Roblox Studio could not be brought to the front (${frontApp()} is). Nothing was recorded.`);
	await sendRequest(obs, "StartRecord");
	try {
		console.log(await studio("start_stop_play", { is_start: true }));
		await sleep(storyboard.total + LOAD_ALLOWANCE);
	} finally {
		outputPath = (await sendRequest(obs, "StopRecord")).outputPath;
		console.log(await studio("start_stop_play", { is_start: false }));
		if (previousApp && previousApp !== "RobloxStudio") {
			try {
				execFileSync("osascript", ["-e", `tell application "System Events" to set frontmost of process "${previousApp}" to true`], { stdio: "ignore" });
			} catch {
				// Handing focus back is a convenience; it needs Accessibility permission.
			}
		}
	}
	const log = await studio("get_console_output");
	const problems = log.split("\n").filter((line) => /\[ScenePlayer\].*failed|\[AnimationController\]|Error|error:/.test(line));
	if (!log.includes("[ScenePlayer] Done")) problems.unshift("Scene did not report completion within the recording window.");
	if (problems.length) console.log("Studio reported problems:\n" + problems.join("\n"));
});
obs.close();

await sleep(1); // let OBS finish writing the file
const recordingsDir = path.join(root, "output", "recordings");
mkdirSync(recordingsDir, { recursive: true });
const finalPath = path.join(recordingsDir, `${storyboard.title}${path.extname(outputPath)}`);
renameSync(outputPath, finalPath);
console.log("Recording:", path.relative(root, finalPath));

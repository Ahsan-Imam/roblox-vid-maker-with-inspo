// Minimal OBS WebSocket v5 client (start/stop recording only) using Node's
// built-in WebSocket + crypto, so no npm dependency is needed for this.
// Usage: node obs-recorder.mjs <start|stop>
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnv(envPath) {
	const text = readFileSync(envPath, "utf8");
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (!(key in process.env)) process.env[key] = value;
	}
}

function sha256Base64(input) {
	return createHash("sha256").update(input).digest("base64");
}

function buildAuthResponse(password, challenge, salt) {
	const secret = sha256Base64(password + salt);
	return sha256Base64(secret + challenge);
}

export async function connectObs({ host, port, password }) {
	const ws = new WebSocket(`ws://${host}:${port}`);

	// Listener must be attached synchronously here (not after an `await open`),
	// since OBS sends Hello immediately on connect and a message with no
	// listener attached yet is dropped, not queued.
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("Timed out waiting for OBS Identified response (op:2)")), 8000);

		function onMessage(event) {
			const msg = JSON.parse(event.data);
			if (msg.op === 0) {
				// Hello
				if (!msg.d || typeof msg.d.rpcVersion !== "number") {
					clearTimeout(timeout);
					reject(new Error("Unexpected Hello payload from OBS (no rpcVersion)"));
					return;
				}
				const identify = { op: 1, d: { rpcVersion: msg.d.rpcVersion, eventSubscriptions: 0 } };
				if (msg.d.authentication) {
					identify.d.authentication = buildAuthResponse(password, msg.d.authentication.challenge, msg.d.authentication.salt);
				}
				ws.send(JSON.stringify(identify));
			} else if (msg.op === 2) {
				clearTimeout(timeout);
				ws.removeEventListener("message", onMessage);
				resolve();
			}
		}
		ws.addEventListener("message", onMessage);
		ws.addEventListener("error", (err) => {
			clearTimeout(timeout);
			reject(new Error(`OBS WebSocket error: ${err.message || err}`));
		});
	});

	return ws;
}

let requestCounter = 0;
export function sendRequest(ws, requestType, requestData = {}) {
	const requestId = String(++requestCounter);
	const payload = { op: 6, d: { requestType, requestId, requestData } };

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`Timed out waiting for response to ${requestType}`)), 8000);

		function onMessage(event) {
			const msg = JSON.parse(event.data);
			if (msg.op === 7 && msg.d.requestId === requestId) {
				clearTimeout(timeout);
				ws.removeEventListener("message", onMessage);
				if (msg.d.requestStatus.result) {
					resolve(msg.d.responseData);
				} else {
					reject(new Error(`${requestType} failed: ${msg.d.requestStatus.comment}`));
				}
			}
		}
		ws.addEventListener("message", onMessage);
		ws.send(JSON.stringify(payload));
	});
}

async function main() {
	const command = process.argv[2];
	if (command !== "start" && command !== "stop" && command !== "setup") {
		console.error("Usage: node obs-recorder.mjs <start|stop|setup <width> <height>>");
		process.exitCode = 1;
		return;
	}
	const ws = await openObs();

	if (command === "start") {
		await sendRequest(ws, "StartRecord");
		console.log("Recording started.");
	} else if (command === "stop") {
		const result = await sendRequest(ws, "StopRecord");
		console.log("Recording stopped. Saved to:", result.outputPath);
	} else {
		// Record at the display's native size at 30fps, with every source scaled
		// to fit, so the whole screen is captured instead of its top-left corner.
		const width = Number(process.argv[3]);
		const height = Number(process.argv[4]);
		if (!(width > 0 && height > 0)) throw new Error("setup needs <width> <height>");
		await sendRequest(ws, "SetVideoSettings", {
			baseWidth: width,
			baseHeight: height,
			outputWidth: width,
			outputHeight: height,
			fpsNumerator: 30,
			fpsDenominator: 1,
		});
		const { currentProgramSceneName: sceneName } = await sendRequest(ws, "GetCurrentProgramScene");
		const { sceneItems } = await sendRequest(ws, "GetSceneItemList", { sceneName });
		for (const item of sceneItems) {
			await sendRequest(ws, "SetSceneItemTransform", {
				sceneName,
				sceneItemId: item.sceneItemId,
				sceneItemTransform: {
					positionX: 0,
					positionY: 0,
					alignment: 5,
					boundsType: "OBS_BOUNDS_SCALE_INNER",
					boundsAlignment: 0,
					boundsWidth: width,
					boundsHeight: height,
				},
			});
			console.log(`Fitted source "${item.sourceName}" (${item.inputKind}) to ${width}x${height}`);
		}
	}

	ws.close();
}

export async function openObs() {
	const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
	loadEnv(path.join(projectRoot, ".env"));

	const host = process.env.OBS_WEBSOCKET_HOST || "localhost";
	const port = process.env.OBS_WEBSOCKET_PORT || "4455";
	const password = process.env.OBS_WEBSOCKET_PASSWORD;
	if (!password) {
		throw new Error("OBS_WEBSOCKET_PASSWORD not set in .env");
	}

	return connectObs({ host, port, password });
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err.message);
		process.exitCode = 1;
	});
}

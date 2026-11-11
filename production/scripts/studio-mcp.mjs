// Drives Roblox Studio through its bundled MCP server over stdio.
// Studio attaches to a freshly started server after a short delay, so a
// session waits for it to appear and then fills in studio_id on every call.
// Usage: node studio-mcp.mjs <tool> '<json args>' [imageOutPath]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const BIN = "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP";

export async function withStudio(work) {
	const proc = spawn(BIN, [], { stdio: ["pipe", "pipe", "ignore"] });
	const pending = new Map();
	let nextId = 1;
	let buffer = "";
	proc.stdout.on("data", (chunk) => {
		buffer += chunk;
		let newline;
		while ((newline = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (!line) continue;
			const msg = JSON.parse(line);
			const waiter = pending.get(msg.id);
			if (!waiter) continue;
			pending.delete(msg.id);
			if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
			else waiter.resolve(msg.result);
		}
	});
	const send = (msg) => proc.stdin.write(JSON.stringify(msg) + "\n");
	const request = (method, params, timeoutMs = 120000) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			const timer = setTimeout(() => reject(new Error(`Studio MCP timed out on ${method}`)), timeoutMs);
			pending.set(id, {
				resolve: (value) => (clearTimeout(timer), resolve(value)),
				reject: (err) => (clearTimeout(timer), reject(err)),
			});
			send({ jsonrpc: "2.0", id, method, params });
		});

	async function rawTool(name, args, imageOutPath) {
		const result = await request("tools/call", { name, arguments: args });
		const texts = [];
		for (const item of result.content || []) {
			if (item.type === "text") texts.push(item.text);
			else if (item.type === "image" && imageOutPath) {
				writeFileSync(imageOutPath, Buffer.from(item.data, "base64"));
				texts.push(`[image saved to ${imageOutPath}]`);
			}
		}
		if (result.isError) throw new Error(texts.join("\n"));
		return texts.join("\n");
	}

	try {
		await request("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "roblox-ai-video", version: "0.0.1" },
		});
		send({ jsonrpc: "2.0", method: "notifications/initialized" });

		let studioId;
		for (let attempt = 0; attempt < 40 && !studioId; attempt++) {
			const { studios } = JSON.parse(await rawTool("list_roblox_studios", {}));
			studioId = studios[0]?.id;
			if (!studioId) await new Promise((r) => setTimeout(r, 500));
		}
		if (!studioId) {
			throw new Error("Roblox Studio did not attach. Open a place and enable the MCP server in Studio's Assistant settings.");
		}
		return await work((name, args = {}, imageOutPath) => rawTool(name, { studio_id: studioId, ...args }, imageOutPath));
	} finally {
		proc.kill();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const [, , tool, argsJson, imageOutPath] = process.argv;
	try {
		console.log(await withStudio((call) => call(tool, argsJson ? JSON.parse(argsJson) : {}, imageOutPath)));
	} catch (err) {
		console.error("ERROR:", err.message);
		process.exitCode = 1;
	}
}

// Pushes game/src into the open Studio place following game/default.project.json,
// for when the Rojo plugin isn't connected (connecting needs a click in Studio).
// shortcut: flat folders of .lua/.json files only, switch back to `rojo serve`
// if the project grows nested folders or non-script instances.
// Usage: node push-to-studio.mjs   (Studio must be in Edit mode)
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withStudio } from "./studio-mcp.mjs";

const gameDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "game");
const project = JSON.parse(readFileSync(path.join(gameDir, "default.project.json"), "utf8"));

function readScripts(dir) {
	return readdirSync(path.join(gameDir, dir), { withFileTypes: true }).map((entry) => {
		if (!entry.isFile()) throw new Error(`Nested folders are not supported yet: ${dir}/${entry.name}`);
		const text = readFileSync(path.join(gameDir, dir, entry.name), "utf8");
		const match = entry.name.match(/^(.+?)(\.server\.lua|\.client\.lua|\.lua|\.json)$/);
		if (!match) throw new Error(`Unsupported file type: ${dir}/${entry.name}`);
		const [, name, ext] = match;
		if (ext === ".json") {
			JSON.parse(text);
			const source = `return game:GetService("HttpService"):JSONDecode([==[${text}]==])`;
			return { name, className: "ModuleScript", source };
		}
		const className = ext === ".server.lua" ? "Script" : ext === ".client.lua" ? "LocalScript" : "ModuleScript";
		return { name, className, source: text };
	});
}

// Each target: the service path to walk, an optional folder to (re)create there, and its scripts.
const targets = [];
function walk(node, servicePath) {
	for (const [key, child] of Object.entries(node)) {
		if (key.startsWith("$")) continue;
		if (child.$className) {
			const here = [...servicePath, key];
			if (child.$path) targets.push({ path: here, folder: null, scripts: readScripts(child.$path) });
			walk(child, here);
		} else if (child.$path) {
			targets.push({ path: servicePath, folder: key, scripts: readScripts(child.$path) });
		}
	}
}
walk(project.tree, []);

const payload = JSON.stringify(targets);
if (payload.includes("]=====]")) throw new Error("Source contains the long-string terminator used for transport");

const code = `
local targets = game:GetService("HttpService"):JSONDecode([=====[${payload}]=====])
local count = 0
for _, target in ipairs(targets) do
	local parent = game:GetService(target.path[1])
	for i = 2, #target.path do
		parent = parent:FindFirstChild(target.path[i]) or error("Missing " .. target.path[i])
	end
	local container = parent
	if target.folder then
		local old = parent:FindFirstChild(target.folder)
		if old then old:Destroy() end
		container = Instance.new("Folder")
		container.Name = target.folder
	else
		for _, child in ipairs(parent:GetChildren()) do
			if child:GetAttribute("PushedFromDisk") then child:Destroy() end
		end
	end
	for _, script in ipairs(target.scripts) do
		local instance = Instance.new(script.className)
		instance.Name = script.name
		instance.Source = script.source
		instance:SetAttribute("PushedFromDisk", true)
		instance.Parent = container
		count += 1
	end
	if target.folder then container.Parent = parent end
end
return "Pushed " .. count .. " scripts"
`;

console.log(await withStudio((call) => call("execute_luau", { datamodel_type: "Edit", code })));

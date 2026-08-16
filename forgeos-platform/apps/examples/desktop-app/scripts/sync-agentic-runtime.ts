import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dir, "../../../../..");
const runtimeRoot = path.resolve(
	import.meta.dir,
	"../src-tauri/resources/forgeos-runtime",
);

const assets = [
	{
		source: path.join(
			repositoryRoot,
			".forgeos",
			"plugins",
			"agentica-harness.ts",
		),
		destination: path.join(
			runtimeRoot,
			"plugins",
			"forgeos-agentic-harness.ts",
		),
	},
	{
		source: path.join(
			repositoryRoot,
			".forgeos",
			"skills",
			"agentica-harness",
			"SKILL.md",
		),
		destination: path.join(
			runtimeRoot,
			"skills",
			"forgeos-agentic-harness",
			"SKILL.md",
		),
	},
];

for (const asset of assets) {
	mkdirSync(path.dirname(asset.destination), { recursive: true });
	copyFileSync(asset.source, asset.destination);
}

console.log("Bundled the ForgeOS agentic backend plugin and skill.");

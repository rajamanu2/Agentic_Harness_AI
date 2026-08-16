import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const packageRoot = join(import.meta.dir, "..");
const importCheck = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	AgentAskQuestion,
	AgentApprovalCard,
	AgentAurora,
	AgentHeroHeading,
	AgentPromptQueue,
	AgentQuickActions,
	SearchCombobox,
	SessionStatus,
} from "@forgeos/ui";
import { Conversation, Message } from "@forgeos/ui/components/agent-chat";
import { ToolFileDiff } from "@forgeos/ui/components/agent-chat/tool-diff";
import { buildToolSummary } from "@forgeos/ui/components/agent-chat/tool-summary";

for (const specifier of [
	"@forgeos/ui/components.css",
	"@forgeos/ui/components/markdown.css",
	"@forgeos/ui/theme/palette.css",
	"@forgeos/ui/theme/scoped-tokens.css",
]) {
	if (!existsSync(fileURLToPath(import.meta.resolve(specifier)))) {
		throw new Error("packed CSS export does not exist: " + specifier);
	}
}

const css = import.meta.resolve("@forgeos/ui/components/agent-chat.css");
const tokens = import.meta.resolve("@forgeos/ui/theme/tokens.css");
const summary = buildToolSummary({
	toolName: "read_files",
	input: { files: [{ path: "src/app.tsx", start_line: 10, end_line: 80 }] },
});
if (summary.label !== "Read file app.tsx (10–80)" || summary.kind !== "read") {
	throw new Error("tool-summary subpath returned an unexpected summary");
}
if (typeof ToolFileDiff !== "function") {
	throw new Error("tool-diff subpath did not export ToolFileDiff");
}
if (
	!AgentApprovalCard ||
	!AgentAskQuestion ||
	!AgentAurora ||
	!AgentHeroHeading ||
	!AgentPromptQueue ||
	!SearchCombobox ||
	!AgentQuickActions ||
	!SessionStatus ||
	!Conversation ||
	!Message ||
	!css ||
	!tokens
) {
	process.exit(1);
}
`;

async function run(command: string[], cwd: string): Promise<void> {
	const child = Bun.spawn(command, {
		cwd,
		stderr: "inherit",
		stdout: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) {
		throw new Error(`${command.join(" ")} exited with ${exitCode}`);
	}
}

function createConsumer(root: string): void {
	mkdirSync(root, { recursive: true });
	writeFileSync(
		join(root, "package.json"),
		`${JSON.stringify({ name: "forgeos-ui-smoke", private: true, type: "module" }, null, 2)}\n`,
	);
}

async function compileTailwind(
	root: string,
	name: string,
	inputLines: string[],
	runner: string[],
): Promise<string> {
	const input = join(root, `${name}.css`);
	const output = join(root, `${name}-output.css`);
	writeFileSync(input, [...inputLines, ""].join("\n"));
	await run([...runner, "-i", input, "-o", output, "--minify"], root);
	return readFileSync(output, "utf8");
}

function expectCandidate(css: string, candidate: string): void {
	const selector = `.${candidate.replaceAll(":", "\\:").replaceAll("/", "\\/")}`;
	if (!css.includes(selector)) {
		throw new Error(`packed Tailwind source did not emit ${candidate}`);
	}
}

function expectFragment(css: string, fragment: string, contract: string): void {
	if (!css.includes(fragment)) {
		throw new Error(`${contract} did not emit ${fragment}`);
	}
}

async function verifyTailwindContract(
	root: string,
	runner: string[],
): Promise<void> {
	const css = await compileTailwind(
		root,
		"tailwind",
		[
			'@import "tailwindcss";',
			'@import "@forgeos/ui/theme/scoped-tokens.css";',
			'@import "@forgeos/ui/components.css";',
			"@theme inline {",
			"\t--color-background: var(--host-background);",
			"\t--radius-lg: var(--host-radius-lg);",
			"\t--text-sm--letter-spacing: var(--host-letter-spacing);",
			"}",
			'@source inline("bg-background rounded-lg text-sm");',
		],
		runner,
	);
	for (const candidate of [
		"bg-forgeos-ui-background/95",
		"border-forgeos-ui-border/60",
		"text-forgeos-ui-muted-foreground",
		"bg-forgeos-ui-primary/10",
		"max-h-56",
		"leading-none",
		"max-h-44",
		"not-last:border-b",
		"focus-visible:outline-3",
		"min-h-8",
		"resize-none",
	]) {
		expectCandidate(css, candidate);
	}
	for (const fragment of [
		"background-color:var(--host-background)",
		"border-radius:var(--host-radius-lg)",
		"letter-spacing:var(--host-letter-spacing)",
	]) {
		expectFragment(css, fragment, "host Tailwind namespace");
	}

	const noPreflightCss = await compileTailwind(
		root,
		"tailwind-no-preflight",
		[
			"@layer theme, base, components, utilities;",
			'@import "tailwindcss/theme.css" layer(theme);',
			'@import "@forgeos/ui/theme/scoped-tokens.css";',
			'@import "@forgeos/ui/components.css";',
			'@import "tailwindcss/utilities.css" layer(utilities);',
		],
		runner,
	);
	for (const fragment of [
		"box-sizing:border-box",
		"border-style:solid",
		"font-family:inherit",
		"margin:.5rem 0 0",
		"padding-block:0",
	]) {
		expectFragment(noPreflightCss, fragment, "no-Preflight Tailwind contract");
	}
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "forgeos-ui-package-"));

try {
	let archive = process.argv[2] ? resolve(process.argv[2]) : undefined;
	if (!archive) {
		const packDirectory = join(temporaryRoot, "pack");
		mkdirSync(packDirectory, { recursive: true });
		await run(
			[
				process.execPath,
				"pm",
				"pack",
				"--ignore-scripts",
				"--destination",
				packDirectory,
			],
			packageRoot,
		);
		const archiveName = readdirSync(packDirectory).find((name) =>
			name.endsWith(".tgz"),
		);
		if (!archiveName) throw new Error("bun pm pack did not create an archive");
		archive = join(packDirectory, archiveName);
	}

	const bunConsumer = join(temporaryRoot, "bun-consumer");
	createConsumer(bunConsumer);
	await run(
		[
			process.execPath,
			"add",
			"--ignore-scripts",
			archive,
			"react@19.2.4",
			"react-dom@19.2.4",
			"@pierre/diffs@1.3.2",
			"tailwindcss@4.2.0",
			"@tailwindcss/cli@4.2.0",
		],
		bunConsumer,
	);
	await run([process.execPath, "-e", importCheck], bunConsumer);
	await verifyTailwindContract(bunConsumer, [
		process.execPath,
		"x",
		"tailwindcss",
	]);

	const npmConsumer = join(temporaryRoot, "npm-consumer");
	createConsumer(npmConsumer);
	await run(
		[
			"npm",
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			archive,
			"react@18.3.1",
			"react-dom@18.3.1",
			"@pierre/diffs@1.3.2",
			"tailwindcss@4.2.0",
			"@tailwindcss/cli@4.2.0",
		],
		npmConsumer,
	);
	await run(["node", "--input-type=module", "-e", importCheck], npmConsumer);
	await verifyTailwindContract(npmConsumer, [
		"npx",
		"--no-install",
		"tailwindcss",
	]);
	console.log(
		`Verified packed ${basename(archive)} with Bun/React 19 and npm/Node/React 18, including Tailwind contracts`,
	);
} finally {
	rmSync(temporaryRoot, { force: true, recursive: true });
}

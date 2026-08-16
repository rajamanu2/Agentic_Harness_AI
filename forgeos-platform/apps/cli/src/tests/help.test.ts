import { test } from "@microsoft/tui-test";
import { FORGEOS_BIN } from "./helpers/constants.js";
import { forgeosEnv } from "./helpers/env.js";
import { expectVisible } from "./helpers/terminal.js";

const HELP_TERMINAL = { columns: 120, rows: 50 };

// ===========================================================================
// forgeos --help  (root help)
// ===========================================================================
test.describe("forgeos --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows Usage line and lists all subcommands", async ({ terminal }) => {
		await expectVisible(terminal, [
			"Usage:",
			"history|h",
			"auth [options]",
			"version",
			"update [options]",
			"hub ",
		]);
	});

	test("shows all root-level option flags", async ({ terminal }) => {
		await expectVisible(terminal, [
			"--plan",
			"--timeout",
			"--model",
			"--verbose",
			"--cwd",
			"--config",
			"--thinking",
			"--retries",
			"--json",
			"--acp",
			"--update",
		]);
	});
});

// ===========================================================================
// forgeos -h  (short help flag)
// ===========================================================================
test.describe("forgeos -h", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["-h"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows Usage line with short flag", async ({ terminal }) => {
		await expectVisible(terminal, "Usage:");
	});
});

// ===========================================================================
// forgeos history --help
// ===========================================================================
test.describe("forgeos history --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["history", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows history usage and all flags", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--limit", "--page", "--config"]);
	});
});

// ===========================================================================
// forgeos h --help  (history alias)
// ===========================================================================
test.describe("forgeos h --help (history alias)", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["h", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows history usage and flags via alias", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--limit"]);
	});
});

// ===========================================================================
// forgeos config --help
// ===========================================================================
test.describe("forgeos config --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["config", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows config usage and --config flag", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--config"]);
	});
});

// ===========================================================================
// forgeos auth --help
// ===========================================================================
test.describe("forgeos auth --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["auth", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows auth usage and all flags", async ({ terminal }) => {
		await expectVisible(terminal, [
			"Usage:",
			"--provider",
			"--apikey",
			"--modelid",
			"--baseurl",
			"--config",
		]);
	});
});

// ===========================================================================
// forgeos version --help
// ===========================================================================
test.describe("forgeos version --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["version", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows version command usage", async ({ terminal }) => {
		await expectVisible(terminal, "Usage:");
	});
});

// ===========================================================================
// forgeos update --help
// ===========================================================================
test.describe("forgeos update --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["update", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows update usage and --verbose flag", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--verbose"]);
	});
});

// ===========================================================================
// forgeos doctor --help
// ===========================================================================
test.describe("forgeos doctor --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["doctor", "--help"] },
		env: forgeosEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows doctor usage and lists fix and log subcommands", async ({
		terminal,
	}) => {
		await expectVisible(terminal, ["Usage:", "fix", "log"]);
	});
});

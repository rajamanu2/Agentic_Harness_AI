import { test } from "@microsoft/tui-test";
import { FORGEOS_BIN } from "./helpers/constants.js";
import { forgeosEnv } from "./helpers/env.js";
import { expectVisible } from "./helpers/terminal.js";

// ---------------------------------------------------------------------------
// forgeos --version  (root flag)
// ---------------------------------------------------------------------------
test.describe("forgeos --version", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["--version"] },
		env: forgeosEnv("claude-sonnet-4.6"),
	});

	test("prints the version string", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

// ---------------------------------------------------------------------------
// forgeos -V  (short flag)
// ---------------------------------------------------------------------------
test.describe("forgeos -V", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["-V"] },
		env: forgeosEnv("claude-sonnet-4.6"),
	});

	test("prints the version string with short flag", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

// ---------------------------------------------------------------------------
// forgeos version  (subcommand)
// ---------------------------------------------------------------------------
test.describe("forgeos version subcommand", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["version"] },
		env: forgeosEnv("claude-sonnet-4.6"),
	});

	test("prints 'ForgeOS CLI version:' message", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

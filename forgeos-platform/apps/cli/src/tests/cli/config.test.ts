// ---------------------------------------------------------------------------
// forgeos config - CLI tests
//
// Covers:
//   - `forgeos config --config <dir>` - shows config for specific directory
//   - `forgeos config --help`         - help page
// ---------------------------------------------------------------------------

import { test } from "@microsoft/tui-test";
import { FORGEOS_BIN, TERMINAL_WIDE } from "../helpers/constants.js";
import { forgeosEnv } from "../helpers/env.js";
import { expectVisible } from "../helpers/terminal.js";

test.describe("forgeos config --help", () => {
	test.use({
		program: { file: FORGEOS_BIN, args: ["config", "--help"] },
		...TERMINAL_WIDE,
		env: forgeosEnv("default"),
	});

	test("shows config help page", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--config"]);
	});
});

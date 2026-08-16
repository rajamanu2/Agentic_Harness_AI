// ---------------------------------------------------------------------------
// Environment helpers for test setup.
//
// Usage:
//   test.use({ env: forgeosEnv("default") });
//   test.use({ env: forgeosEnv("claude-sonnet-4.6") });
//   test.use({ env: forgeosEnv("/absolute/path/to/config") });
// ---------------------------------------------------------------------------

import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEST_SUITE_ROOT = new URL("../", import.meta.url).pathname;

let envCounter = 0;

function createIsolatedForgeOSDir(sourceDir: string): string {
	const tempRoot = mkdtempSync(path.join(os.tmpdir(), "forgeos-tui-test-"));
	const targetDir = path.join(tempRoot, "forgeos");
	cpSync(sourceDir, targetDir, {
		recursive: true,
		errorOnExist: false,
		force: true,
	});
	mkdirSync(path.join(targetDir, "home"), { recursive: true });
	return targetDir;
}

function nextHubPort(): string {
	envCounter += 1;
	const basePort = 30_000 + (process.pid % 10_000);
	return String(basePort + (envCounter % 10_000));
}

/**
 * Build the process environment for a forgeos test.
 *
 * @param configDir - Named config under `configs/`, or an absolute path.
 * @param extra     - Additional env vars to merge in (override defaults).
 */
export function forgeosEnv(
	configDir: string,
	extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
	const forgeosPath = path.isAbsolute(configDir)
		? configDir
		: path.join(TEST_SUITE_ROOT, "configs", configDir);
	const isolatedForgeOSPath = createIsolatedForgeOSDir(forgeosPath);
	const dataDir = path.join(isolatedForgeOSPath, "data");

	// Determine effective VCR mode: extra overrides > parent env > default "playback"
	const effectiveVcrMode =
		extra.FORGEOS_VCR ?? process.env.FORGEOS_VCR ?? "playback";

	// During recording, authenticated configs read real OAuth credentials from
	// ~/.forgeos/data/settings/providers.json while keeping all other settings
	// (model, provider, global state) from the mock config directory.
	const isRecording = effectiveVcrMode === "record";
	const isAuthenticated = configDir !== "unauthenticated";
	const realProvidersFile =
		isRecording && isAuthenticated
			? path.join(os.homedir(), ".forgeos", "data", "settings", "providers.json")
			: undefined;

	// Remove CI so terminal renderers treat the spawned process as interactive.
	// Remove VITEST so the spawned CLI binary doesn't skip initVcr().
	// cli/src/index.ts guards `initVcr` behind `process.env.VITEST !== "true"`,
	// so if the parent vitest process's VITEST=true leaks into the child, VCR
	// recording/playback is silently skipped.
	const { CI: _ci, VITEST: _vitest, ...cleanEnv } = process.env;
	if (!isAuthenticated) {
		delete cleanEnv.FORGEOS_API_KEY;
	}

	// Only enable VCR when a cassette path is provided (via extra or parent env),
	// otherwise tests without cassettes would trigger a spurious
	// "[VCR] No FORGEOS_VCR_CASSETTE" warning on every run.
	const hasCassette = !!(
		extra.FORGEOS_VCR_CASSETTE ?? process.env.FORGEOS_VCR_CASSETTE
	);
	const vcrDefaults = hasCassette
		? { FORGEOS_VCR: "playback", FORGEOS_VCR_FILTER: "" }
		: {};

	// the order of these env vars matter; later ones override earlier ones
	return {
		...vcrDefaults,
		...cleanEnv,
		...(realProvidersFile
			? { FORGEOS_PROVIDER_SETTINGS_PATH: realProvidersFile }
			: {}),
		FORGEOS_TELEMETRY_DISABLED: "1",
		HOME: path.join(isolatedForgeOSPath, "home"),
		FORGEOS_DIR: isolatedForgeOSPath,
		FORGEOS_DATA_DIR: dataDir,
		FORGEOS_DB_DATA_DIR: path.join(dataDir, "db"),
		FORGEOS_GLOBAL_SETTINGS_PATH: path.join(
			dataDir,
			"settings",
			"global-settings.json",
		),
		FORGEOS_HOOKS_LOG_PATH: path.join(dataDir, "logs", "hooks.jsonl"),
		FORGEOS_HUB_DISCOVERY_PATH: path.join(
			dataDir,
			"locks",
			"hub",
			"discovery.json",
		),
		FORGEOS_HUB_PORT: nextHubPort(),
		FORGEOS_MCP_SETTINGS_PATH: path.join(
			dataDir,
			"settings",
			"forgeos_mcp_settings.json",
		),
		...(realProvidersFile
			? {}
			: {
					FORGEOS_PROVIDER_SETTINGS_PATH: path.join(
						dataDir,
						"settings",
						"providers.json",
					),
				}),
		FORGEOS_SESSION_DATA_DIR: path.join(dataDir, "sessions"),
		FORGEOS_TEAM_DATA_DIR: path.join(dataDir, "teams"),
		FORGEOS_DISABLE_FORGEOS_PASS_NOTICE: "1",
		NO_UPDATE_NOTIFIER: "1",
		FORGEOS_NO_AUTO_UPDATE: "1",
		...extra,
	};
}

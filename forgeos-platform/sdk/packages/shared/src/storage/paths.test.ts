import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	AGENT_CONFIG_DIRECTORY_NAME,
	FORGEOS_CHAT_WORKSPACE_DIRECTORY_NAME,
	FORGEOS_CONNECTOR_SETTINGS_FILE_NAME,
	FORGEOS_MCP_SETTINGS_FILE_NAME,
	FORGEOS_WORKSPACES_DIRECTORY_NAME,
	getPluginDisplayName,
	HOOKS_CONFIG_DIRECTORY_NAME,
	isChatWorkspacePath,
	RULES_CONFIG_DIRECTORY_NAME,
	resolveAgentsConfigDirPath,
	resolveChatWorkspacePath,
	resolveForgeOSDataDir,
	resolveConnectorDataDir,
	resolveConnectorSettingsPath,
	resolveDbDataDir,
	resolveGlobalAgentsRulesPath,
	resolveGlobalSettingsPath,
	resolveHooksConfigSearchPaths,
	resolveMcpSettingsPath,
	resolveProviderSettingsPath,
	resolveRulesConfigSearchPaths,
	resolveSessionDataDir,
	resolveTeamDataDir,
	resolveWorkflowsConfigSearchPaths,
} from "./paths";

type EnvSnapshot = {
	FORGEOS_DIR: string | undefined;
	FORGEOS_DATA_DIR: string | undefined;
	FORGEOS_CONNECTOR_DATA_DIR: string | undefined;
	FORGEOS_CONNECTOR_SETTINGS_PATH: string | undefined;
	FORGEOS_DB_DATA_DIR: string | undefined;
	FORGEOS_GLOBAL_SETTINGS_PATH: string | undefined;
	FORGEOS_MCP_SETTINGS_PATH: string | undefined;
	FORGEOS_PROVIDER_SETTINGS_PATH: string | undefined;
	FORGEOS_SESSION_DATA_DIR: string | undefined;
	FORGEOS_TEAM_DATA_DIR: string | undefined;
};

function captureEnv(): EnvSnapshot {
	return {
		FORGEOS_DIR: process.env.FORGEOS_DIR,
		FORGEOS_DATA_DIR: process.env.FORGEOS_DATA_DIR,
		FORGEOS_CONNECTOR_DATA_DIR: process.env.FORGEOS_CONNECTOR_DATA_DIR,
		FORGEOS_CONNECTOR_SETTINGS_PATH: process.env.FORGEOS_CONNECTOR_SETTINGS_PATH,
		FORGEOS_DB_DATA_DIR: process.env.FORGEOS_DB_DATA_DIR,
		FORGEOS_GLOBAL_SETTINGS_PATH: process.env.FORGEOS_GLOBAL_SETTINGS_PATH,
		FORGEOS_MCP_SETTINGS_PATH: process.env.FORGEOS_MCP_SETTINGS_PATH,
		FORGEOS_PROVIDER_SETTINGS_PATH: process.env.FORGEOS_PROVIDER_SETTINGS_PATH,
		FORGEOS_SESSION_DATA_DIR: process.env.FORGEOS_SESSION_DATA_DIR,
		FORGEOS_TEAM_DATA_DIR: process.env.FORGEOS_TEAM_DATA_DIR,
	};
}

function restoreEnv(snapshot: EnvSnapshot): void {
	process.env.FORGEOS_DATA_DIR = snapshot.FORGEOS_DATA_DIR;
	process.env.FORGEOS_CONNECTOR_DATA_DIR = snapshot.FORGEOS_CONNECTOR_DATA_DIR;
	process.env.FORGEOS_CONNECTOR_SETTINGS_PATH =
		snapshot.FORGEOS_CONNECTOR_SETTINGS_PATH;
	process.env.FORGEOS_DIR = snapshot.FORGEOS_DIR;
	process.env.FORGEOS_DB_DATA_DIR = snapshot.FORGEOS_DB_DATA_DIR;
	process.env.FORGEOS_GLOBAL_SETTINGS_PATH = snapshot.FORGEOS_GLOBAL_SETTINGS_PATH;
	process.env.FORGEOS_MCP_SETTINGS_PATH = snapshot.FORGEOS_MCP_SETTINGS_PATH;
	process.env.FORGEOS_PROVIDER_SETTINGS_PATH =
		snapshot.FORGEOS_PROVIDER_SETTINGS_PATH;
	process.env.FORGEOS_SESSION_DATA_DIR = snapshot.FORGEOS_SESSION_DATA_DIR;
	process.env.FORGEOS_TEAM_DATA_DIR = snapshot.FORGEOS_TEAM_DATA_DIR;
}

describe("storage path resolution", () => {
	let snapshot: EnvSnapshot = captureEnv();

	afterEach(() => {
		restoreEnv(snapshot);
	});

	it("uses FORGEOS_DATA_DIR as-is when set", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveForgeOSDataDir()).toBe("/tmp/forgeos-data");
	});

	it("falls back to FORGEOS_DATA_DIR/sessions for session storage", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_SESSION_DATA_DIR;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveSessionDataDir()).toBe(join("/tmp/forgeos-data", "sessions"));
	});

	it("falls back to FORGEOS_DATA_DIR/teams for team storage", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_TEAM_DATA_DIR;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveTeamDataDir()).toBe(join("/tmp/forgeos-data", "teams"));
	});

	it("falls back to FORGEOS_DATA_DIR/connectors for connector storage", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_CONNECTOR_DATA_DIR;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveConnectorDataDir()).toBe(
			join("/tmp/forgeos-data", "connectors"),
		);
	});

	it("falls back to FORGEOS_DATA_DIR/connectors/settings.json for connector settings", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_CONNECTOR_DATA_DIR;
		delete process.env.FORGEOS_CONNECTOR_SETTINGS_PATH;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveConnectorSettingsPath()).toBe(
			join("/tmp/forgeos-data", "connectors", FORGEOS_CONNECTOR_SETTINGS_FILE_NAME),
		);
	});

	it("uses FORGEOS_CONNECTOR_SETTINGS_PATH as-is when set", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_CONNECTOR_SETTINGS_PATH =
			"/tmp/forgeos-connectors/custom-settings.json";

		expect(resolveConnectorSettingsPath()).toBe(
			"/tmp/forgeos-connectors/custom-settings.json",
		);
	});

	it("falls back to FORGEOS_DATA_DIR/db for sqlite storage", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_DB_DATA_DIR;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveDbDataDir()).toBe(join("/tmp/forgeos-data", "db"));
	});

	it("falls back to FORGEOS_DATA_DIR/settings/providers.json for provider settings", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_PROVIDER_SETTINGS_PATH;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveProviderSettingsPath()).toBe(
			join("/tmp/forgeos-data", "settings", "providers.json"),
		);
	});

	it("falls back to FORGEOS_DATA_DIR/settings/global-settings.json for global settings", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_GLOBAL_SETTINGS_PATH;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveGlobalSettingsPath()).toBe(
			join("/tmp/forgeos-data", "settings", "global-settings.json"),
		);
	});

	it("falls back to FORGEOS_DATA_DIR/settings/forgeos_mcp_settings.json for MCP settings", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_MCP_SETTINGS_PATH;
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveMcpSettingsPath()).toBe(
			join("/tmp/forgeos-data", "settings", FORGEOS_MCP_SETTINGS_FILE_NAME),
		);
	});

	it("falls back to ~/.forgeos/.agents for agent configs", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_DIR = "/tmp/home/.forgeos";

		expect(resolveAgentsConfigDirPath()).toBe(
			join("/tmp/home", ".forgeos", AGENT_CONFIG_DIRECTORY_NAME),
		);
	});

	it("resolves global hooks from ~/.forgeos", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_DIR = "/tmp/home/.forgeos";
		process.env.FORGEOS_DATA_DIR = "/tmp/home/.forgeos/data";

		expect(resolveHooksConfigSearchPaths()).toEqual(
			expect.arrayContaining([
				join("/tmp/home", ".forgeos", HOOKS_CONFIG_DIRECTORY_NAME),
			]),
		);
		expect(resolveHooksConfigSearchPaths()).not.toContain(
			join("/tmp/home", ".forgeos", "data", HOOKS_CONFIG_DIRECTORY_NAME),
		);
	});

	it("resolves global rules from ~/.forgeos", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_DIR = "/tmp/home/.forgeos";
		process.env.FORGEOS_DATA_DIR = "/tmp/home/.forgeos/data";

		expect(resolveRulesConfigSearchPaths()).toEqual(
			expect.arrayContaining([
				resolveGlobalAgentsRulesPath(),
				join("/tmp/home", ".forgeos", RULES_CONFIG_DIRECTORY_NAME),
			]),
		);
		expect(resolveRulesConfigSearchPaths()).not.toContain(
			join("/tmp/home", ".forgeos", "data", RULES_CONFIG_DIRECTORY_NAME),
		);
	});

	it("resolves legacy and new workflow paths, with .forgeos paths later for duplicate-name precedence", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_DIR = "/tmp/home/.forgeos";
		const workspacePath = "/repo/demo";

		const paths = resolveWorkflowsConfigSearchPaths(workspacePath);

		expect(paths).toEqual([
			join(workspacePath, ".forgeosrules", "workflows"),
			expect.stringContaining(join("Documents", "ForgeOS", "Workflows")),
			join("/tmp/home", ".forgeos", "workflows"),
			join(workspacePath, ".forgeos", "workflows"),
		]);
	});
});

describe("chat workspace paths", () => {
	let snapshot: EnvSnapshot = captureEnv();

	afterEach(() => {
		restoreEnv(snapshot);
	});

	it("exports the canonical path segments", () => {
		expect(FORGEOS_WORKSPACES_DIRECTORY_NAME).toBe("workspaces");
		expect(FORGEOS_CHAT_WORKSPACE_DIRECTORY_NAME).toBe("chat");
	});

	it("resolves the shared chat workspace under the forgeos data dir", () => {
		snapshot = captureEnv();
		delete process.env.FORGEOS_DATA_DIR;
		process.env.FORGEOS_DIR = "/tmp/home/.forgeos";

		expect(resolveChatWorkspacePath()).toBe(
			join("/tmp/home/.forgeos", "data", "workspaces", "chat"),
		);
	});

	it("honors the FORGEOS_DATA_DIR override", () => {
		snapshot = captureEnv();
		process.env.FORGEOS_DATA_DIR = "/tmp/forgeos-data";

		expect(resolveChatWorkspacePath()).toBe(
			join("/tmp/forgeos-data", "workspaces", "chat"),
		);
	});

	it.each([
		"/home/user/.forgeos/data/workspaces/chat",
		"//home//user//.forgeos//data//workspaces//chat//",
		"C:\\Users\\dev\\.forgeos\\data\\workspaces\\chat\\",
		"\\\\server\\share\\.forgeos\\data\\workspaces\\chat",
	])("recognizes chat workspace root %s", (path) => {
		expect(isChatWorkspacePath(path)).toBe(true);
	});

	it.each([
		".forgeos/data/workspaces/chat",
		"/tmp/chat",
		"/tmp/forgeos/sessions/session-a1b2c3-temp/project",
		"/home/user/forgeos/data/workspaces/chat",
		"/home/user/.forgeos/workspaces/chat",
		"/home/user/.forgeos/data/other/chat",
		"/home/user/.forgeos/data/workspaces/Chat",
		"/home/user/.forgeos/data/workspaces/chat/my-app",
		"/home/user/.forgeos/data/workspaces",
	])("rejects non-chat workspace path %s", (path) => {
		expect(isChatWorkspacePath(path)).toBe(false);
	});
});

describe("getPluginDisplayName", () => {
	const tempRoots: string[] = [];

	function createTempRoot(): string {
		const root = mkdtempSync(join(tmpdir(), "forgeos-plugin-name-"));
		tempRoots.push(root);
		return root;
	}

	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("uses the package name for package-backed installed plugin entries", () => {
		const root = createTempRoot();
		const packageDir = join(
			root,
			"_installed",
			"local",
			"agents-squad-057fda0dd505",
			"package",
		);
		mkdirSync(packageDir, { recursive: true });
		writeFileSync(
			join(packageDir, "package.json"),
			JSON.stringify({ name: "forgeos-agents-squad-plugin" }),
		);
		const entryPath = join(packageDir, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe(
			"forgeos-agents-squad-plugin",
		);
	});

	it("finds the package name in an ancestor directory within the search root", () => {
		const root = createTempRoot();
		const packageDir = join(root, "my-plugin");
		const srcDir = join(packageDir, "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(
			join(packageDir, "package.json"),
			JSON.stringify({ name: "my-plugin" }),
		);
		const entryPath = join(srcDir, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("my-plugin");
	});

	it("falls back to the file basename when package.json has no usable name", () => {
		const root = createTempRoot();
		const packageDir = join(root, "unnamed", "package");
		mkdirSync(packageDir, { recursive: true });
		writeFileSync(join(packageDir, "package.json"), JSON.stringify({}));
		const entryPath = join(packageDir, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("index");
	});

	it("falls back to the file basename for bare plugin modules", () => {
		const root = createTempRoot();
		const entryPath = join(root, "x-poster.js");
		writeFileSync(entryPath, "module.exports = {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("x-poster");
	});

	it("does not read package.json files above the search root", () => {
		const outer = createTempRoot();
		writeFileSync(
			join(outer, "package.json"),
			JSON.stringify({ name: "outer-package" }),
		);
		const root = join(outer, "plugins");
		mkdirSync(root, { recursive: true });
		const entryPath = join(root, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("index");
	});
});

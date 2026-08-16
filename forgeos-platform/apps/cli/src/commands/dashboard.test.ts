import { mkdirSync, mkdtempSync } from "node:fs";
import { arch, platform, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runDashboardCommand, waitForProcessShutdown } from "./dashboard";

const ENV_KEYS = [
	"WORKSPACE_ROOT",
	"FORGEOS_DIR",
	"FORGEOS_SANDBOX",
	"FORGEOS_SANDBOX_DATA_DIR",
	"FORGEOS_DATA_DIR",
	"FORGEOS_DB_DATA_DIR",
	"FORGEOS_SESSION_DATA_DIR",
	"FORGEOS_TEAM_DATA_DIR",
	"FORGEOS_PROVIDER_SETTINGS_PATH",
	"FORGEOS_HOOKS_LOG_PATH",
	"HOST",
	"FORGEOS_HUB_DASHBOARD_PORT",
	"PUBLIC_URL",
	"ROOM_SECRET",
	"FORGEOS_HUB_WEBVIEW_DIST_DIR",
	"FORGEOS_WRAPPER_PATH",
] as const;

const originalEnv = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
	for (const key of ENV_KEYS) {
		const value = originalEnv[key];
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
});

describe("runDashboardCommand", () => {
	it("starts the dashboard server, opens the invite URL, and waits for shutdown", async () => {
		const output: string[] = [];
		const errors: string[] = [];
		const opened: string[] = [];
		const stop = vi.fn();
		let observedEnv:
			| {
					workspaceRoot: string | undefined;
					forgeosDir: string | undefined;
					forgeosDataDir: string | undefined;
					providerSettingsPath: string | undefined;
					host: string | undefined;
					port: string | undefined;
					publicUrl: string | undefined;
					roomSecret: string | undefined;
					webviewDistDir: string | undefined;
			  }
			| undefined;
		const webviewDistDir = mkdtempSync(join(tmpdir(), "forgeos-webview-dist-"));
		mkdirSync(webviewDistDir, { recursive: true });
		process.env.FORGEOS_HUB_WEBVIEW_DIST_DIR = webviewDistDir;

		const exitCode = await runDashboardCommand({
			configDir: "/tmp/forgeos-config",
			cwd: "sdk",
			dataDir: ".forgeos-dashboard-data",
			host: "127.0.0.1",
			port: "9090",
			publicUrl: "http://127.0.0.1:9090",
			roomSecret: "secret",
			io: {
				writeln: (text) => output.push(text ?? ""),
				writeErr: (text) => errors.push(text),
			},
			startServer: async () => {
				observedEnv = {
					workspaceRoot: process.env.WORKSPACE_ROOT,
					forgeosDir: process.env.FORGEOS_DIR,
					forgeosDataDir: process.env.FORGEOS_DATA_DIR,
					providerSettingsPath: process.env.FORGEOS_PROVIDER_SETTINGS_PATH,
					host: process.env.HOST,
					port: process.env.FORGEOS_HUB_DASHBOARD_PORT,
					publicUrl: process.env.PUBLIC_URL,
					roomSecret: process.env.ROOM_SECRET,
					webviewDistDir: process.env.FORGEOS_HUB_WEBVIEW_DIST_DIR,
				};
				return {
					listenUrl: "http://127.0.0.1:9090/",
					publicUrl: "http://127.0.0.1:9090",
					inviteUrl: "http://127.0.0.1:9090/?roomSecret=secret",
					hubUrl: "ws://127.0.0.1:25463/hub",
					stop,
				};
			},
			openUrl: async (url) => {
				opened.push(url);
			},
			waitForShutdown: async (server) => {
				await server.stop();
			},
		});

		expect(exitCode).toBe(0);
		expect(observedEnv).toEqual({
			workspaceRoot: resolve("sdk"),
			forgeosDir: "/tmp/forgeos-config",
			forgeosDataDir: resolve("sdk", ".forgeos-dashboard-data"),
			providerSettingsPath: join(
				resolve("sdk", ".forgeos-dashboard-data"),
				"settings",
				"providers.json",
			),
			host: "127.0.0.1",
			port: "9090",
			publicUrl: "http://127.0.0.1:9090",
			roomSecret: "secret",
			webviewDistDir,
		});
		expect(opened).toEqual(["http://127.0.0.1:9090/?roomSecret=secret"]);
		expect(stop).toHaveBeenCalledTimes(1);
		expect(output.join("\n")).toContain("ForgeOS dashboard listening at");
		expect(output.join("\n")).toContain("ws://127.0.0.1:25463/hub");
		expect(errors).toEqual([]);
		expect(process.env.WORKSPACE_ROOT).toBe(originalEnv.WORKSPACE_ROOT);
		expect(process.env.FORGEOS_HUB_WEBVIEW_DIST_DIR).toBe(webviewDistDir);
	});

	it("honors --no-open behavior", async () => {
		const openUrl = vi.fn();

		const exitCode = await runDashboardCommand({
			openBrowser: false,
			io: {
				writeln: () => {},
				writeErr: () => {},
			},
			startServer: async () => ({
				listenUrl: "http://127.0.0.1:8787/",
				publicUrl: "http://127.0.0.1:8787",
				inviteUrl: "http://127.0.0.1:8787",
				stop: vi.fn(),
			}),
			openUrl,
			waitForShutdown: async () => {},
		});

		expect(exitCode).toBe(0);
		expect(openUrl).not.toHaveBeenCalled();
	});

	it("finds webview assets from the published wrapper package layout", async () => {
		const root = mkdtempSync(join(tmpdir(), "forgeos-wrapper-layout-"));
		const wrapperPath = join(root, "node_modules", "forgeos", "bin", "forgeos");
		const platformName = platform() === "win32" ? "windows" : platform();
		const webviewDistDir = join(
			root,
			"node_modules",
			"forgeos",
			"node_modules",
			"@forgeos",
			`cli-${platformName}-${arch()}`,
			"forgeos-hub",
			"webview",
		);
		mkdirSync(join(wrapperPath, ".."), { recursive: true });
		mkdirSync(webviewDistDir, { recursive: true });
		process.env.FORGEOS_WRAPPER_PATH = wrapperPath;
		delete process.env.FORGEOS_HUB_WEBVIEW_DIST_DIR;
		let observedWebviewDistDir: string | undefined;

		const exitCode = await runDashboardCommand({
			openBrowser: false,
			io: {
				writeln: () => {},
				writeErr: () => {},
			},
			startServer: async () => {
				observedWebviewDistDir = process.env.FORGEOS_HUB_WEBVIEW_DIST_DIR;
				return {
					listenUrl: "http://127.0.0.1:8787/",
					publicUrl: "http://127.0.0.1:8787",
					inviteUrl: "http://127.0.0.1:8787",
					stop: vi.fn(),
				};
			},
			waitForShutdown: async () => {},
		});

		expect(exitCode).toBe(0);
		expect(observedWebviewDistDir).toBe(webviewDistDir);
	});

	it("settles shutdown when server stop rejects", async () => {
		const shutdown = waitForProcessShutdown({
			listenUrl: "http://127.0.0.1:8787/",
			publicUrl: "http://127.0.0.1:8787",
			inviteUrl: "http://127.0.0.1:8787",
			stop: vi.fn(async () => {
				throw new Error("stop failed");
			}),
		});

		process.emit("SIGINT", "SIGINT");

		await expect(shutdown).rejects.toThrow("stop failed");
	});
});

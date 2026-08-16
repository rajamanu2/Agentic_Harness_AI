import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	FORGEOS_ENVIRONMENT_ENV,
	FORGEOS_ENVIRONMENT_OVERRIDE_ENV,
	FORGEOS_ENVIRONMENTS,
	DEFAULT_FORGEOS_ENVIRONMENT,
	getForgeOSEnvironmentConfig,
	resolveForgeOSEnvironment,
} from "./forgeos-environment";

const ENV_KEYS = [
	FORGEOS_ENVIRONMENT_ENV,
	FORGEOS_ENVIRONMENT_OVERRIDE_ENV,
	"FORGEOS_API_BASE_URL",
] as const;

const originalEnvValues = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
});

afterEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		const value = originalEnvValues[key];
		if (typeof value === "string") {
			process.env[key] = value;
		} else {
			delete process.env[key];
		}
	}
});

describe("resolveForgeOSEnvironment", () => {
	it("defaults to production when no env var is set", () => {
		expect(resolveForgeOSEnvironment()).toBe(DEFAULT_FORGEOS_ENVIRONMENT);
	});

	it("reads FORGEOS_ENVIRONMENT from process.env", () => {
		process.env[FORGEOS_ENVIRONMENT_ENV] = "staging";
		expect(resolveForgeOSEnvironment()).toBe("staging");

		process.env[FORGEOS_ENVIRONMENT_ENV] = "local";
		expect(resolveForgeOSEnvironment()).toBe("local");
	});

	it("prefers FORGEOS_ENVIRONMENT_OVERRIDE over FORGEOS_ENVIRONMENT", () => {
		process.env[FORGEOS_ENVIRONMENT_OVERRIDE_ENV] = "local";
		process.env[FORGEOS_ENVIRONMENT_ENV] = "staging";

		expect(resolveForgeOSEnvironment()).toBe("local");
	});

	it("normalizes case and surrounding whitespace", () => {
		process.env[FORGEOS_ENVIRONMENT_ENV] = "  STAGING  ";

		expect(resolveForgeOSEnvironment()).toBe("staging");
	});

	it("ignores unknown values and falls through to the next source", () => {
		process.env[FORGEOS_ENVIRONMENT_OVERRIDE_ENV] = "qa";
		process.env[FORGEOS_ENVIRONMENT_ENV] = "staging";
		expect(resolveForgeOSEnvironment()).toBe("staging");

		delete process.env[FORGEOS_ENVIRONMENT_OVERRIDE_ENV];
		process.env[FORGEOS_ENVIRONMENT_ENV] = "qa";
		expect(resolveForgeOSEnvironment()).toBe(DEFAULT_FORGEOS_ENVIRONMENT);
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(resolveForgeOSEnvironment()).toBe(DEFAULT_FORGEOS_ENVIRONMENT);
	});
});

describe("getForgeOSEnvironmentConfig", () => {
	it("returns the config for an explicit environment", () => {
		expect(getForgeOSEnvironmentConfig("staging")).toBe(
			FORGEOS_ENVIRONMENTS.staging,
		);
		expect(getForgeOSEnvironmentConfig("local")).toBe(FORGEOS_ENVIRONMENTS.local);
		expect(getForgeOSEnvironmentConfig("production")).toBe(
			FORGEOS_ENVIRONMENTS.production,
		);
	});

	it("falls back to production by default", () => {
		expect(getForgeOSEnvironmentConfig()).toBe(FORGEOS_ENVIRONMENTS.production);
	});

	it("uses the resolved process.env environment when no explicit environment is provided", () => {
		process.env[FORGEOS_ENVIRONMENT_ENV] = "staging";

		expect(getForgeOSEnvironmentConfig()).toBe(FORGEOS_ENVIRONMENTS.staging);
	});

	it("applies FORGEOS_API_BASE_URL without mutating the catalog config", () => {
		process.env.FORGEOS_API_BASE_URL = "http://127.0.0.1:3000";

		expect(getForgeOSEnvironmentConfig("local")).toEqual({
			...FORGEOS_ENVIRONMENTS.local,
			apiBaseUrl: "http://127.0.0.1:3000",
			mcpBaseUrl: "http://127.0.0.1:3000/v1/mcp",
		});
		expect(FORGEOS_ENVIRONMENTS.local.apiBaseUrl).toBe("http://localhost:7777");
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(getForgeOSEnvironmentConfig()).toBe(FORGEOS_ENVIRONMENTS.production);
	});
});

describe("FORGEOS_ENVIRONMENTS catalog", () => {
	it("exposes an environment field that matches its key", () => {
		for (const [key, config] of Object.entries(FORGEOS_ENVIRONMENTS)) {
			expect(config.environment).toBe(key);
		}
	});

	it("populates appBaseUrl, apiBaseUrl, and mcpBaseUrl for every environment", () => {
		for (const config of Object.values(FORGEOS_ENVIRONMENTS)) {
			expect(config.appBaseUrl).toMatch(/^https?:\/\//);
			expect(config.apiBaseUrl).toMatch(/^https?:\/\//);
			expect(config.mcpBaseUrl).toMatch(/^https?:\/\//);
		}
	});
});

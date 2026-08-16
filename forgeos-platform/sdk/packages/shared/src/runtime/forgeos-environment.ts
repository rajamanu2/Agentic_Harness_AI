export const FORGEOS_ENVIRONMENT_ENV = "FORGEOS_ENVIRONMENT";
export const FORGEOS_ENVIRONMENT_OVERRIDE_ENV = "FORGEOS_ENVIRONMENT_OVERRIDE";

export type ForgeOSEnvironment = "production" | "staging" | "local";

export interface ForgeOSEnvironmentConfig {
	readonly environment: ForgeOSEnvironment;
	readonly appBaseUrl: string;
	readonly apiBaseUrl: string;
	readonly mcpBaseUrl: string;
	readonly workOsClientId: string;
}

export const FORGEOS_ENVIRONMENTS: Readonly<
	Record<ForgeOSEnvironment, ForgeOSEnvironmentConfig>
> = {
	production: {
		environment: "production",
		appBaseUrl: "https://app.forgeos.bot",
		apiBaseUrl: "https://api.forgeos.bot",
		mcpBaseUrl: "https://api.forgeos.bot/v1/mcp",
		workOsClientId: "client_01K3A541FN8TA3EPPHTD2325AR",
	},
	staging: {
		environment: "staging",
		appBaseUrl: "https://staging-app.forgeos.bot",
		apiBaseUrl: "https://core-api.staging.int.forgeos.bot",
		mcpBaseUrl: "https://core-api.staging.int.forgeos.bot/v1/mcp",
		workOsClientId: "client_01K3A5415VF6QBQBG3XYCW91G6",
	},
	local: {
		environment: "local",
		appBaseUrl: "http://localhost:3000",
		apiBaseUrl: "http://localhost:7777",
		mcpBaseUrl: "http://localhost:7777/v1/mcp",
		workOsClientId: "client_01K6XQAY7JK6T5HXVSZW2S5VYK",
	},
};

export const DEFAULT_FORGEOS_ENVIRONMENT: ForgeOSEnvironment = "production";

export interface ResolveForgeOSEnvironmentOptions {
	env?: Partial<NodeJS.ProcessEnv>;
}

function normalizeForgeOSEnvironment(
	value: string | undefined,
): ForgeOSEnvironment | undefined {
	const normalized = value?.trim().toLowerCase();
	if (
		normalized === "production" ||
		normalized === "staging" ||
		normalized === "local"
	) {
		return normalized;
	}
	return undefined;
}

function readProcessEnv(): NodeJS.ProcessEnv {
	// `process` may be absent in browser-style runtimes (this module ships
	// from the browser entry of `@forgeos/shared`). Treat its absence as "no
	// env vars set" so callers always get a deterministic default.
	if (typeof process === "undefined" || !process?.env) {
		return {};
	}
	return process.env;
}

export function resolveForgeOSEnvironment(): ForgeOSEnvironment {
	const env = readProcessEnv();
	return (
		normalizeForgeOSEnvironment(env[FORGEOS_ENVIRONMENT_OVERRIDE_ENV]) ??
		normalizeForgeOSEnvironment(env[FORGEOS_ENVIRONMENT_ENV]) ??
		DEFAULT_FORGEOS_ENVIRONMENT
	);
}

function getEnvConfig(env?: ForgeOSEnvironment) {
	if (typeof env === "string") {
		return FORGEOS_ENVIRONMENTS[env];
	}
	return FORGEOS_ENVIRONMENTS[resolveForgeOSEnvironment()];
}

function applyConfigOverrides(
	config: ForgeOSEnvironmentConfig,
	env: NodeJS.ProcessEnv,
): ForgeOSEnvironmentConfig {
	if (env.FORGEOS_API_BASE_URL) {
		config = {
			...config,
			apiBaseUrl: env.FORGEOS_API_BASE_URL,
			mcpBaseUrl: `${env.FORGEOS_API_BASE_URL}/v1/mcp`,
		};
	}

	return config;
}

export function getForgeOSEnvironmentConfig(
	env?: ForgeOSEnvironment,
): ForgeOSEnvironmentConfig {
	const config = getEnvConfig(env);

	return applyConfigOverrides(config, readProcessEnv());
}

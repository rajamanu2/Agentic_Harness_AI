import {
	type ForgeOSAccountBalance,
	type ForgeOSAccountOrganization,
	type ForgeOSAccountOrganizationBalance,
	ForgeOSAccountService,
	type ForgeOSAccountUser,
	type ForgeOSSubscriptionPlan,
	formatProviderOAuthApiKey,
	getPersistedProviderApiKey,
	getProviderOAuthCredentialsFromSettings,
	getValidForgeOSCredentials,
	type ProviderSettings,
	ProviderSettingsManager,
	saveLocalProviderOAuthCredentials,
	type UserCurrentPlan,
} from "@forgeos/core";
import { getForgeOSEnvironmentConfig } from "@forgeos/shared";
import { formatCreditBalance, normalizeCreditBalance } from "../utils/output";
import { identifyTelemetryAccount } from "../utils/telemetry";
import type { Config } from "../utils/types";

export const FORGEOS_CREDITS_DASHBOARD_URL =
	"https://app.forgeos.bot/dashboard/account?tab=credits";

type ForgeOSAccountConfig = Pick<Config, "apiKey" | "logger" | "providerId">;

const FORGEOS_PASS_PROVIDER_ID = "forgeos-pass";

export interface ForgeOSAccountSnapshot {
	user: ForgeOSAccountUser;
	balance: ForgeOSAccountBalance;
	organizationBalance: ForgeOSAccountOrganizationBalance | null;
	organizations: ForgeOSAccountOrganization[];
	activeOrganization: ForgeOSAccountOrganization | null;
	displayedBalance: number;
}

export function formatForgeOSCredits(value: number): string {
	return formatCreditBalance(normalizeCreditBalance(value));
}

// FIXME: These message checks are temporary until structured error types are
// passed through to the CLI instead of plain error strings.
export function isForgeOSAccountAuthErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized === "no forgeos account auth token found" ||
		normalized.includes("requires re-authentication")
	);
}

export function isForgeOSAccountCreditsErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	// The ForgeOS API's 402 response carries `code: "insufficient_credits"` and
	// the message "Not enough credits available". Depending on how much of the
	// payload survives error extraction, the CLI may see the raw JSON blob or
	// just the human-readable message, so match both. The
	// "insufficient balance" pair is an older backend phrasing kept for safety.
	return (
		normalized.includes("insufficient_credits") ||
		normalized.includes("not enough credits") ||
		(normalized.includes("insufficient balance") &&
			normalized.includes("forgeos credits balance"))
	);
}

function resolveAccountApiBaseUrl(input: {
	forgeosApiBaseUrl?: string;
	forgeosProviderSettings?: ProviderSettings;
}): string {
	const settingsBaseUrl = input.forgeosProviderSettings?.baseUrl?.trim();
	if (settingsBaseUrl) {
		return settingsBaseUrl;
	}
	const configuredBaseUrl = input.forgeosApiBaseUrl?.trim();
	if (configuredBaseUrl) {
		return configuredBaseUrl;
	}
	return getForgeOSEnvironmentConfig().apiBaseUrl;
}

function resolveForgeOSAccountAuthToken(input: {
	config: ForgeOSAccountConfig;
	forgeosProviderSettings?: ProviderSettings;
}): string | undefined {
	const configApiKey =
		input.config.providerId === "forgeos" ? input.config.apiKey.trim() : "";
	return (
		getPersistedProviderApiKey("forgeos", input.forgeosProviderSettings) ||
		configApiKey ||
		undefined
	);
}

async function resolveValidForgeOSAccountAuthToken(input: {
	config: ForgeOSAccountConfig;
	forgeosProviderSettings?: ProviderSettings;
	manager: ProviderSettingsManager;
	apiBaseUrl: string;
}): Promise<string | undefined> {
	const settings = input.forgeosProviderSettings;
	const credentials = settings
		? getProviderOAuthCredentialsFromSettings("forgeos", settings)
		: null;
	if (settings && credentials) {
		const nextCredentials = await getValidForgeOSCredentials(credentials, {
			apiBaseUrl: input.apiBaseUrl,
		});
		if (!nextCredentials) {
			throw new Error(
				"ForgeOS account requires re-authentication. Run forgeos auth forgeos.",
			);
		}
		const nextAccessToken = formatProviderOAuthApiKey("forgeos", nextCredentials);
		if (nextCredentials !== credentials) {
			saveLocalProviderOAuthCredentials(
				input.manager,
				"forgeos",
				settings,
				nextCredentials,
				{ setLastUsed: false },
			);
		}
		return nextAccessToken;
	}
	return resolveForgeOSAccountAuthToken({
		config: input.config,
		forgeosProviderSettings: settings,
	});
}

export async function createForgeOSAccountService(input: {
	config: ForgeOSAccountConfig;
	forgeosApiBaseUrl?: string;
	forgeosProviderSettings?: ProviderSettings;
	providerSettingsManager?: ProviderSettingsManager;
}): Promise<ForgeOSAccountService | undefined> {
	const manager =
		input.providerSettingsManager ?? new ProviderSettingsManager();
	const settings =
		manager.getProviderSettings("forgeos") ?? input.forgeosProviderSettings;
	const apiBaseUrl = resolveAccountApiBaseUrl({
		forgeosApiBaseUrl: input.forgeosApiBaseUrl,
		forgeosProviderSettings: settings,
	});
	const authToken = await resolveValidForgeOSAccountAuthToken({
		config: input.config,
		forgeosProviderSettings: settings,
		manager,
		apiBaseUrl,
	});
	if (!authToken) {
		return undefined;
	}
	return new ForgeOSAccountService({
		apiBaseUrl,
		getAuthToken: async () => authToken,
	});
}

/**
 * Persist the active organization so headless runs and the hub daemon can
 * attach it to telemetry identity. Personal account clears stale org fields.
 */
function persistForgeOSOrganizationContext(
	activeOrganization: ForgeOSAccountOrganization | null,
	userId: string,
): void {
	try {
		const manager = new ProviderSettingsManager();
		const persisted = manager.getProviderSettings("forgeos");
		if (!persisted) {
			return;
		}
		manager.saveProviderSettings(
			{
				...persisted,
				auth: {
					...persisted.auth,
					accountId: persisted.auth?.accountId ?? userId,
					organizationId: activeOrganization?.organizationId,
					organizationName: activeOrganization?.name,
					memberId: activeOrganization?.memberId,
				},
			},
			{ setLastUsed: false },
		);
	} catch {
		// Best-effort only.
	}
}

export async function loadForgeOSAccountSnapshot(input: {
	config: ForgeOSAccountConfig;
	forgeosApiBaseUrl?: string;
	forgeosProviderSettings?: ProviderSettings;
}): Promise<ForgeOSAccountSnapshot> {
	const service = await createForgeOSAccountService(input);
	if (!service) {
		throw new Error("No ForgeOS account auth token found");
	}

	const user = await service.fetchMe();
	const organizations = user.organizations ?? [];
	const activeOrganization =
		organizations.find((organization) => organization.active) ?? null;
	const [balance, organizationBalance] = await Promise.all([
		service.fetchBalance(user.id),
		activeOrganization
			? service.fetchOrganizationBalance(activeOrganization.organizationId)
			: Promise.resolve(null),
	]);
	const displayedBalance = activeOrganization
		? (organizationBalance?.balance ?? balance.balance)
		: balance.balance;
	const accountContext = {
		id: user.id,
		email: user.email,
		provider: "forgeos",
		organizationId: activeOrganization?.organizationId,
		organizationName: activeOrganization?.name,
		memberId: activeOrganization?.memberId,
	};
	identifyTelemetryAccount(accountContext, input.config.logger);
	persistForgeOSOrganizationContext(activeOrganization, user.id);

	return {
		user,
		balance,
		organizationBalance,
		organizations,
		activeOrganization,
		displayedBalance,
	};
}

export async function switchForgeOSAccount(input: {
	config: ForgeOSAccountConfig;
	organizationId?: string | null;
	forgeosApiBaseUrl?: string;
	forgeosProviderSettings?: ProviderSettings;
}): Promise<void> {
	const service = await createForgeOSAccountService(input);
	if (!service) {
		throw new Error("No ForgeOS account auth token found");
	}
	await service.switchAccount(input.organizationId);
}

export async function loadIndividualSubscriptionPlans(input: {
	config: ForgeOSAccountConfig;
	forgeosApiBaseUrl?: string;
	forgeosProviderSettings?: ProviderSettings;
}): Promise<ForgeOSSubscriptionPlan[]> {
	const service = await createForgeOSAccountService(input);
	if (!service) {
		throw new Error("No ForgeOS account auth token found");
	}
	return service.fetchAvailableSubscriptionPlans({ type: "individual" });
}

export async function loadCurrentUserPlan(input: {
	config: ForgeOSAccountConfig;
	forgeosApiBaseUrl?: string;
	forgeosProviderSettings?: ProviderSettings;
}): Promise<UserCurrentPlan | undefined> {
	const service = await createForgeOSAccountService(input);
	if (!service) {
		throw new Error("No ForgeOS account auth token found");
	}
	return service.fetchCurrentUserPlan();
}

export async function loadCurrentUserPlanFromProviderSettings(input: {
	providerSettingsManager: ProviderSettingsManager;
	forgeosApiBaseUrl?: string;
}): Promise<UserCurrentPlan | undefined> {
	const service = await createForgeOSAccountService({
		config: { apiKey: "", logger: undefined, providerId: "forgeos" },
		forgeosApiBaseUrl: input.forgeosApiBaseUrl,
		providerSettingsManager: input.providerSettingsManager,
	});
	if (!service) {
		throw new Error("No ForgeOS account auth token found");
	}
	return service.fetchCurrentUserPlan();
}

export async function loadIndividualSubscriptionPlansFromProviderSettings(input: {
	providerSettingsManager: ProviderSettingsManager;
	forgeosApiBaseUrl?: string;
}): Promise<ForgeOSSubscriptionPlan[]> {
	const service = await createForgeOSAccountService({
		config: { apiKey: "", logger: undefined, providerId: "forgeos" },
		forgeosApiBaseUrl: input.forgeosApiBaseUrl,
		providerSettingsManager: input.providerSettingsManager,
	});
	if (!service) {
		throw new Error("No ForgeOS account auth token found");
	}
	return service.fetchAvailableSubscriptionPlans({ type: "individual" });
}

async function onChangeToForgeOSPass(config: ForgeOSAccountConfig) {
	try {
		await switchForgeOSAccount({
			config: config,
			organizationId: null,
		});
	} catch (error) {
		config.logger?.debug("Failed to switch ForgeOSPass to personal account", {
			error,
		});
	}
}

export async function onProviderChange(input: {
	config: ForgeOSAccountConfig;
	providerId: string;
}): Promise<void> {
	if (input.providerId === FORGEOS_PASS_PROVIDER_ID) {
		return onChangeToForgeOSPass(input.config);
	}

	return;
}

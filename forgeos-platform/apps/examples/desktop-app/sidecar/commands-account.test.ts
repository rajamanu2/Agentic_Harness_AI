import { beforeEach, describe, expect, it, vi } from "vitest";
import { isForgeOSAccountNotAuthenticatedResult } from "../webview/lib/forgeos-account-state";
import type { SidecarContext } from "./types";

const forgeosAccountServiceCtorMock = vi.hoisted(() => vi.fn());
const executeForgeOSAccountActionMock = vi.hoisted(() => vi.fn());
const getProviderSettingsMock = vi.hoisted(() => vi.fn());
const resolveProviderApiKeyMock = vi.hoisted(() => vi.fn());

vi.mock("@forgeos/core", async () => {
	const actual =
		await vi.importActual<typeof import("@forgeos/core")>("@forgeos/core");
	return {
		...actual,
		ForgeOSAccountService: class {
			constructor(options: unknown) {
				forgeosAccountServiceCtorMock(options);
			}
		},
		executeForgeOSAccountAction: executeForgeOSAccountActionMock,
		ProviderSettingsManager: class {
			getProviderSettings = getProviderSettingsMock;
		},
		RuntimeOAuthTokenManager: class {
			resolveProviderApiKey = resolveProviderApiKeyMock;
		},
	};
});

function createContext() {
	const capture = vi.fn();
	const ctx = {
		telemetry: { capture },
		logger: { debug: vi.fn(), log: vi.fn(), error: vi.fn() },
	} as unknown as SidecarContext;
	return { ctx, capture };
}

const FETCH_ME_ARGS = {
	action: "forgeosAccount",
	operation: "fetchMe",
} as const;

async function runForgeOSAccountCommand(ctx: SidecarContext) {
	const { handleCommand } = await import("./commands");
	return handleCommand(ctx, "forgeos_account", { ...FETCH_ME_ARGS });
}

beforeEach(() => {
	forgeosAccountServiceCtorMock.mockReset();
	executeForgeOSAccountActionMock.mockReset();
	getProviderSettingsMock.mockReset();
	resolveProviderApiKeyMock.mockReset();
});

describe("forgeos_account command auth states", () => {
	it("returns a typed not-authenticated result when signed out, without telemetry or a thrown error", async () => {
		const { ctx, capture } = createContext();
		resolveProviderApiKeyMock.mockResolvedValue(null);
		getProviderSettingsMock.mockReturnValue(undefined);

		const result = await runForgeOSAccountCommand(ctx);

		expect(result).toEqual({
			signedIn: false,
			code: "ACCOUNT_NOT_AUTHENTICATED",
		});
		expect(isForgeOSAccountNotAuthenticatedResult(result)).toBe(true);
		expect(executeForgeOSAccountActionMock).not.toHaveBeenCalled();
		expect(forgeosAccountServiceCtorMock).not.toHaveBeenCalled();
		expect(capture).not.toHaveBeenCalled();
	});

	it("runs the account action unchanged when a fresh token resolves", async () => {
		const { ctx, capture } = createContext();
		resolveProviderApiKeyMock.mockResolvedValue({
			apiKey: "fresh-token",
			refreshed: true,
		});
		getProviderSettingsMock.mockReturnValue(undefined);
		const user = { id: "user-1", email: "beatrix@forgeos.bot" };
		executeForgeOSAccountActionMock.mockResolvedValue(user);

		const result = await runForgeOSAccountCommand(ctx);

		expect(result).toBe(user);
		expect(executeForgeOSAccountActionMock).toHaveBeenCalledWith(
			expect.objectContaining(FETCH_ME_ARGS),
			expect.anything(),
		);
		const serviceOptions = forgeosAccountServiceCtorMock.mock.calls[0][0] as {
			getAuthToken: () => Promise<string | undefined>;
		};
		await expect(serviceOptions.getAuthToken()).resolves.toBe("fresh-token");
		expect(capture).not.toHaveBeenCalled();
	});

	it("falls back to the persisted token silently when the refresh fails", async () => {
		const { ctx, capture } = createContext();
		resolveProviderApiKeyMock.mockRejectedValue(
			new Error("Token refresh failed: 500"),
		);
		getProviderSettingsMock.mockReturnValue({
			auth: { accessToken: "persisted-token" },
		});
		executeForgeOSAccountActionMock.mockResolvedValue({ id: "user-1" });

		await runForgeOSAccountCommand(ctx);

		const serviceOptions = forgeosAccountServiceCtorMock.mock.calls[0][0] as {
			getAuthToken: () => Promise<string | undefined>;
		};
		await expect(serviceOptions.getAuthToken()).resolves.toBe(
			"persisted-token",
		);
		expect(capture).not.toHaveBeenCalled();
	});

	it("reports one auth refresh soft-failure event when the refresh fails and no fallback token exists", async () => {
		const { ctx, capture } = createContext();
		const refreshError = new Error(
			'OAuth credentials for provider "forgeos" are no longer valid. Re-run authentication for this provider.',
		);
		refreshError.name = "OAuthReauthRequiredError";
		resolveProviderApiKeyMock.mockRejectedValue(refreshError);
		getProviderSettingsMock.mockReturnValue(undefined);

		const result = await runForgeOSAccountCommand(ctx);

		expect(isForgeOSAccountNotAuthenticatedResult(result)).toBe(true);
		expect(executeForgeOSAccountActionMock).not.toHaveBeenCalled();
		expect(capture).toHaveBeenCalledTimes(1);
		expect(capture).toHaveBeenCalledWith({
			event: "user.auth_refresh_soft_failure",
			properties: expect.objectContaining({
				provider: "forgeos",
				errorName: "OAuthReauthRequiredError",
				errorCode: "desktop_refresh_failed_no_fallback_token",
			}),
		});
	});
});

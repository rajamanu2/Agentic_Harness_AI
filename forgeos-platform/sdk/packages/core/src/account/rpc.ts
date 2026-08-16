import type {
	ForgeOSAccountActionRequest,
	ProviderActionRequest,
} from "@forgeos/shared";
import type {
	ForgeOSAccountBalance,
	ForgeOSAccountOrganization,
	ForgeOSAccountOrganizationBalance,
	ForgeOSAccountOrganizationUsageTransaction,
	ForgeOSAccountPaymentTransaction,
	ForgeOSAccountUsageTransaction,
	ForgeOSAccountUser,
	FeaturebaseTokenResponse,
} from "./types";

export interface ForgeOSAccountOperations {
	fetchMe(): Promise<ForgeOSAccountUser>;
	fetchBalance(userId?: string): Promise<ForgeOSAccountBalance>;
	fetchUsageTransactions(
		userId?: string,
	): Promise<ForgeOSAccountUsageTransaction[]>;
	fetchPaymentTransactions(
		userId?: string,
	): Promise<ForgeOSAccountPaymentTransaction[]>;
	fetchUserOrganizations(): Promise<ForgeOSAccountOrganization[]>;
	fetchOrganizationBalance(
		organizationId: string,
	): Promise<ForgeOSAccountOrganizationBalance>;
	fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<ForgeOSAccountOrganizationUsageTransaction[]>;
	switchAccount(organizationId?: string | null): Promise<void>;
	fetchFeaturebaseToken?(): Promise<FeaturebaseTokenResponse | undefined>;
}

export function isForgeOSAccountActionRequest(
	request: ProviderActionRequest,
): request is ForgeOSAccountActionRequest {
	return request.action === "forgeosAccount";
}

export async function executeForgeOSAccountAction(
	request: ForgeOSAccountActionRequest,
	service: ForgeOSAccountOperations,
): Promise<unknown> {
	switch (request.operation) {
		case "fetchMe":
			return service.fetchMe();
		case "fetchBalance":
			return service.fetchBalance(request.userId);
		case "fetchUsageTransactions":
			return service.fetchUsageTransactions(request.userId);
		case "fetchPaymentTransactions":
			return service.fetchPaymentTransactions(request.userId);
		case "fetchUserOrganizations":
			return service.fetchUserOrganizations();
		case "fetchOrganizationBalance":
			return service.fetchOrganizationBalance(request.organizationId);
		case "fetchOrganizationUsageTransactions":
			return service.fetchOrganizationUsageTransactions({
				organizationId: request.organizationId,
				memberId: request.memberId,
			});
		case "switchAccount":
			await service.switchAccount(request.organizationId);
			return { updated: true };
		case "fetchFeaturebaseToken":
			return service.fetchFeaturebaseToken?.();
		default: {
			const exhaustive: never = request;
			throw new Error(
				`Unsupported ForgeOS account operation: ${String(exhaustive)}`,
			);
		}
	}
}

export interface ProviderActionExecutor {
	runProviderAction(request: ProviderActionRequest): Promise<{
		result: unknown;
	}>;
}

export class RpcForgeOSAccountService implements ForgeOSAccountOperations {
	private readonly executor: ProviderActionExecutor;

	constructor(executor: ProviderActionExecutor) {
		this.executor = executor;
	}

	public async fetchMe(): Promise<ForgeOSAccountUser> {
		return this.request<ForgeOSAccountUser>({
			action: "forgeosAccount",
			operation: "fetchMe",
		});
	}

	public async fetchBalance(userId?: string): Promise<ForgeOSAccountBalance> {
		return this.request<ForgeOSAccountBalance>({
			action: "forgeosAccount",
			operation: "fetchBalance",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUsageTransactions(
		userId?: string,
	): Promise<ForgeOSAccountUsageTransaction[]> {
		return this.request<ForgeOSAccountUsageTransaction[]>({
			action: "forgeosAccount",
			operation: "fetchUsageTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchPaymentTransactions(
		userId?: string,
	): Promise<ForgeOSAccountPaymentTransaction[]> {
		return this.request<ForgeOSAccountPaymentTransaction[]>({
			action: "forgeosAccount",
			operation: "fetchPaymentTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUserOrganizations(): Promise<ForgeOSAccountOrganization[]> {
		return this.request<ForgeOSAccountOrganization[]>({
			action: "forgeosAccount",
			operation: "fetchUserOrganizations",
		});
	}

	public async fetchOrganizationBalance(
		organizationId: string,
	): Promise<ForgeOSAccountOrganizationBalance> {
		const orgId = organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<ForgeOSAccountOrganizationBalance>({
			action: "forgeosAccount",
			operation: "fetchOrganizationBalance",
			organizationId: orgId,
		});
	}

	public async fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<ForgeOSAccountOrganizationUsageTransaction[]> {
		const orgId = input.organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<ForgeOSAccountOrganizationUsageTransaction[]>({
			action: "forgeosAccount",
			operation: "fetchOrganizationUsageTransactions",
			organizationId: orgId,
			...(input.memberId?.trim() ? { memberId: input.memberId.trim() } : {}),
		});
	}

	public async switchAccount(organizationId?: string | null): Promise<void> {
		await this.request<{ updated: boolean }>({
			action: "forgeosAccount",
			operation: "switchAccount",
			organizationId: organizationId?.trim() || null,
		});
	}

	public async fetchFeaturebaseToken(): Promise<
		FeaturebaseTokenResponse | undefined
	> {
		return this.request<FeaturebaseTokenResponse | undefined>({
			action: "forgeosAccount",
			operation: "fetchFeaturebaseToken",
		});
	}

	private async request<T>(request: ForgeOSAccountActionRequest): Promise<T> {
		const response = await this.executor.runProviderAction(request);
		return response.result as T;
	}
}

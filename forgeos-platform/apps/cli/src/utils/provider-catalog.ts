import {
	listLocalProviders as internalListLocalProviders,
	type ProviderSettingsManager,
} from "@forgeos/core";

export async function listLocalProviders(
	manager: ProviderSettingsManager,
): ReturnType<typeof internalListLocalProviders> {
	return await internalListLocalProviders(manager, {
		isForgeOSPassEnabled: true,
	});
}

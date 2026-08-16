import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { EmptyRequest } from "@/shared/proto/forgeos/common"
import { Logger } from "@/shared/services/Logger"

// Canonical header names for extra client/host context
const ForgeOSHeaders = {
	PLATFORM: "X-PLATFORM",
	PLATFORM_VERSION: "X-PLATFORM-VERSION",
	CLIENT_VERSION: "X-CLIENT-VERSION",
	CLIENT_TYPE: "X-CLIENT-TYPE",
	CORE_VERSION: "X-CORE-VERSION",
	IS_MULTIROOT: "X-IS-MULTIROOT",
} as const

export function buildExternalBasicHeaders(): Record<string, string> {
	return {
		"User-Agent": `ForgeOS/${ExtensionRegistryInfo.version}`,
	}
}

export async function buildBasicForgeOSHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = buildExternalBasicHeaders()
	try {
		const host = await HostProvider.env.getHostVersion(EmptyRequest.create({}))
		headers[ForgeOSHeaders.PLATFORM] = host.platform || "unknown"
		headers[ForgeOSHeaders.PLATFORM_VERSION] = host.version || "unknown"
		headers[ForgeOSHeaders.CLIENT_TYPE] = host.forgeosType || "unknown"
		headers[ForgeOSHeaders.CLIENT_VERSION] = host.forgeosVersion || "unknown"
	} catch (error) {
		Logger.log("Failed to get IDE/platform info via HostBridge EnvService.getHostVersion", error)
		headers[ForgeOSHeaders.PLATFORM] = "unknown"
		headers[ForgeOSHeaders.PLATFORM_VERSION] = "unknown"
		headers[ForgeOSHeaders.CLIENT_TYPE] = "unknown"
		headers[ForgeOSHeaders.CLIENT_VERSION] = "unknown"
	}
	headers[ForgeOSHeaders.CORE_VERSION] = ExtensionRegistryInfo.version

	return headers
}

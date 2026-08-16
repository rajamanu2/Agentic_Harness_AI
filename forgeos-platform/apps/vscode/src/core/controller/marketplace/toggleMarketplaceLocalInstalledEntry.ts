import type {
	MarketplaceLocalInstalledEntries,
	ToggleMarketplaceLocalInstalledEntryRequest,
} from "@shared/proto/forgeos/marketplace"
import type { Controller } from "../index"
import { toggleLocalMarketplaceInstalledEntry } from "./marketplace-helpers"

export async function toggleMarketplaceLocalInstalledEntry(
	controller: Controller,
	request: ToggleMarketplaceLocalInstalledEntryRequest,
): Promise<MarketplaceLocalInstalledEntries> {
	return toggleLocalMarketplaceInstalledEntry(controller, request)
}

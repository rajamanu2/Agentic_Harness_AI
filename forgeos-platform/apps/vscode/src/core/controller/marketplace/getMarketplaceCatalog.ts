import type { EmptyRequest } from "@shared/proto/forgeos/common"
import type { MarketplaceCatalog } from "@shared/proto/forgeos/marketplace"
import type { Controller } from "../index"
import { fetchMarketplaceCatalog } from "./marketplace-helpers"

export async function getMarketplaceCatalog(_controller: Controller, _request: EmptyRequest): Promise<MarketplaceCatalog> {
	return fetchMarketplaceCatalog()
}

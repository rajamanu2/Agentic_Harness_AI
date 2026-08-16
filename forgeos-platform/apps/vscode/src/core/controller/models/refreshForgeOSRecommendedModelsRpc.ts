import { EmptyRequest } from "@shared/proto/forgeos/common"
import { ForgeOSRecommendedModel, ForgeOSRecommendedModelsResponse } from "@shared/proto/forgeos/models"
import type { Controller } from "../index"
import { refreshForgeOSRecommendedModels } from "./refreshForgeOSRecommendedModels"

export async function refreshForgeOSRecommendedModelsRpc(
	_controller: Controller,
	_request: EmptyRequest,
): Promise<ForgeOSRecommendedModelsResponse> {
	const models = await refreshForgeOSRecommendedModels()
	return ForgeOSRecommendedModelsResponse.create({
		recommended: models.recommended.map((model) =>
			ForgeOSRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
		free: models.free.map((model) =>
			ForgeOSRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
		forgeosPass: (models.forgeosPass ?? []).map((model) =>
			ForgeOSRecommendedModel.create({
				id: model.id,
				name: model.name,
				description: model.description,
				tags: model.tags,
			}),
		),
	})
}

import { CheckpointRestoreRequest } from "@shared/proto/forgeos/checkpoints"
import { Empty } from "@shared/proto/forgeos/common"
import { ForgeOSCheckpointRestore } from "../../../shared/WebviewMessage"
import { Controller } from ".."

export async function checkpointRestore(controller: Controller, request: CheckpointRestoreRequest): Promise<Empty> {
	const sdkRestoreCheckpoint = (
		controller as Controller & {
			restoreCheckpoint?: (input: { checkpointRunCount: number; restoreType: ForgeOSCheckpointRestore }) => Promise<void>
		}
	).restoreCheckpoint
	if (sdkRestoreCheckpoint) {
		if (request.number) {
			await sdkRestoreCheckpoint.call(controller, {
				checkpointRunCount: Number(request.number),
				restoreType: request.restoreType as ForgeOSCheckpointRestore,
			})
		}
		return Empty.create({})
	}

	return Empty.create({})
}

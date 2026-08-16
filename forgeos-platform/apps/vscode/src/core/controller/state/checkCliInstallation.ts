import { Boolean } from "@shared/proto/forgeos/common"
import { isForgeOSCliInstalled } from "@/utils/cli-detector"
import { Controller } from ".."

/**
 * Check if the ForgeOS CLI is installed
 * @param controller The controller instance
 * @returns Boolean indicating if CLI is installed
 */
export async function checkCliInstallation(_controller: Controller): Promise<Boolean> {
	try {
		const isInstalled = await isForgeOSCliInstalled()
		return Boolean.create({ value: isInstalled })
	} catch {
		return Boolean.create({ value: false })
	}
}

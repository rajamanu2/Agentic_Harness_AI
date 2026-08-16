import { synchronizeRuleToggles } from "@core/context/instructions/user-instructions/rule-helpers"
import { ensureRulesDirectoryExists, GlobalFileNames } from "@core/storage/disk"
import { ForgeOSRulesToggles } from "@shared/forgeos-rules"
import path from "path"
import { Controller } from "@/core/controller"

export async function refreshForgeOSRulesToggles(
	controller: Controller,
	workingDirectory: string,
): Promise<{
	globalToggles: ForgeOSRulesToggles
	localToggles: ForgeOSRulesToggles
}> {
	// Global toggles
	const globalForgeOSRulesToggles = controller.stateManager.getGlobalSettingsKey("globalForgeOSRulesToggles")
	const globalForgeOSRulesFilePath = await ensureRulesDirectoryExists()
	const updatedGlobalToggles = await synchronizeRuleToggles(globalForgeOSRulesFilePath, globalForgeOSRulesToggles)
	controller.stateManager.setGlobalState("globalForgeOSRulesToggles", updatedGlobalToggles)

	// Local toggles
	const localForgeOSRulesToggles = controller.stateManager.getWorkspaceStateKey("localForgeOSRulesToggles")
	const localForgeOSRulesFilePath = path.resolve(workingDirectory, GlobalFileNames.forgeosRules)
	const updatedLocalToggles = await synchronizeRuleToggles(localForgeOSRulesFilePath, localForgeOSRulesToggles, "", [
		[".forgeosrules", "workflows"],
		[".forgeosrules", "hooks"],
		[".forgeosrules", "skills"],
	])
	controller.stateManager.setWorkspaceState("localForgeOSRulesToggles", updatedLocalToggles)

	return {
		globalToggles: updatedGlobalToggles,
		localToggles: updatedLocalToggles,
	}
}

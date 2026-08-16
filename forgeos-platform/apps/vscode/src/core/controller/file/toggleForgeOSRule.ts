import { getWorkspaceBasename } from "@core/workspace"
import type { ToggleForgeOSRuleRequest } from "@shared/proto/forgeos/file"
import { RuleScope, ToggleForgeOSRules } from "@shared/proto/forgeos/file"
import { telemetryService } from "@/services/telemetry"
import { Logger } from "@/shared/services/Logger"
import type { Controller } from "../index"

/**
 * Toggles a ForgeOS rule (enable or disable)
 * @param controller The controller instance
 * @param request The toggle request
 * @returns The updated ForgeOS rule toggles
 */
export async function toggleForgeOSRule(controller: Controller, request: ToggleForgeOSRuleRequest): Promise<ToggleForgeOSRules> {
	const { scope, rulePath, enabled } = request

	if (!rulePath || typeof enabled !== "boolean" || scope === undefined) {
		Logger.error("toggleForgeOSRule: Missing or invalid parameters", {
			rulePath,
			scope,
			enabled: typeof enabled === "boolean" ? enabled : `Invalid: ${typeof enabled}`,
		})
		throw new Error("Missing or invalid parameters for toggleForgeOSRule")
	}

	// Handle the three different scopes
	switch (scope) {
		case RuleScope.GLOBAL: {
			const toggles = controller.stateManager.getGlobalSettingsKey("globalForgeOSRulesToggles")
			toggles[rulePath] = enabled
			controller.stateManager.setGlobalState("globalForgeOSRulesToggles", toggles)
			break
		}
		case RuleScope.LOCAL: {
			const toggles = controller.stateManager.getWorkspaceStateKey("localForgeOSRulesToggles")
			toggles[rulePath] = enabled
			controller.stateManager.setWorkspaceState("localForgeOSRulesToggles", toggles)
			break
		}
		case RuleScope.REMOTE: {
			const toggles = controller.stateManager.getGlobalStateKey("remoteRulesToggles")
			toggles[rulePath] = enabled
			controller.stateManager.setGlobalState("remoteRulesToggles", toggles)
			break
		}
		default:
			throw new Error(`Invalid scope: ${scope}`)
	}

	// Track rule toggle telemetry with current task context
	if (controller.task?.ulid) {
		// Extract just the filename for privacy (no full paths)
		const ruleFileName = getWorkspaceBasename(rulePath, "Controller.toggleForgeOSRule")
		const isGlobal = scope === RuleScope.GLOBAL
		telemetryService.captureForgeOSRuleToggled(controller.task.ulid, ruleFileName, enabled, isGlobal)
	}

	// Get the current state to return in the response
	const globalToggles = controller.stateManager.getGlobalSettingsKey("globalForgeOSRulesToggles")
	const localToggles = controller.stateManager.getWorkspaceStateKey("localForgeOSRulesToggles")
	const remoteToggles = controller.stateManager.getGlobalStateKey("remoteRulesToggles")

	return ToggleForgeOSRules.create({
		globalForgeOSRulesToggles: { toggles: globalToggles },
		localForgeOSRulesToggles: { toggles: localToggles },
		remoteRulesToggles: { toggles: remoteToggles },
	})
}

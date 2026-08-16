import {
	type BuiltinToolAvailabilityContext,
	getCoreBuiltinToolCatalog,
	resolveDisabledToolNames,
	resolveModelToolSettings,
	type ToolCatalogEntry,
} from "@forgeos/core";

export type { ToolCatalogEntry } from "@forgeos/core";

export function getToolCatalog(
	availabilityContext?: BuiltinToolAvailabilityContext,
): ToolCatalogEntry[] {
	const modelToolSettings = resolveModelToolSettings();
	return getCoreBuiltinToolCatalog({
		disabledToolIds: resolveDisabledToolNames(),
		enabledModelToolIds: new Set(
			Object.entries(modelToolSettings)
				.filter(([, setting]) => setting?.enabled === true)
				.map(([name]) => name),
		),
		...availabilityContext,
	});
}

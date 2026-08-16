export interface FocusChainSettings {
	// Enable/disable the focus chain feature
	enabled: boolean
	// Interval (in messages) to remind ForgeOS about focus chain
	remindForgeOSInterval: number
}

export const DEFAULT_FOCUS_CHAIN_SETTINGS: FocusChainSettings = {
	enabled: true,
	remindForgeOSInterval: 6,
}

export function isForgeOSManagedProvider(provider: string | undefined) {
	return provider === "forgeos" || provider === "forgeos-pass"
}

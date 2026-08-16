/**
 * List of email domains that are considered trusted testers for ForgeOS.
 */
const FORGEOS_TRUSTED_TESTER_DOMAINS = ["fibilabs.tech"]

/**
 * Checks if the given email belongs to a ForgeOS bot user.
 * E.g. Emails ending with @forgeos.bot
 */
function isForgeOSBotUser(email: string): boolean {
	return email.endsWith("@forgeos.bot")
}

export function isForgeOSInternalTester(email: string): boolean {
	return isForgeOSBotUser(email) || FORGEOS_TRUSTED_TESTER_DOMAINS.some((d) => email.endsWith(`@${d}`))
}

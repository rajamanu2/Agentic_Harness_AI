import { StringRequest } from "@shared/proto/forgeos/common"
import { UiServiceClient } from "@/services/grpc-client"

// ForgeOSPass subscription signup page in the dashboard (requires auth).
const FORGEOS_PASS_SUBSCRIBE_PATH = "/onboarding/individual-plan"
const FORGEOS_PASS_USAGE_PATH = "/dashboard/subscription"
export const DEFAULT_APP_BASE_URL = "https://app.forgeos.bot"

// Module-level so the pending intent survives OnboardingView unmounting: handleAuthCallback
// completes the welcome view (unmounting onboarding) before it pushes the auth-status update
// that sets forgeosUser, so this must outlive the component to fire the redirect.
let pendingForgeOSPassSubscribe = false

export function setPendingForgeOSPassSubscribe(pending: boolean): void {
	pendingForgeOSPassSubscribe = pending
}

// Opens the ForgeOSPass subscription page once a pending signup is authenticated (guarded so it fires once).
export function openForgeOSPassSubscriptionIfPending(appBaseUrl: string | undefined): void {
	if (!pendingForgeOSPassSubscribe) {
		return
	}
	pendingForgeOSPassSubscribe = false
	const baseUrl = appBaseUrl || DEFAULT_APP_BASE_URL
	UiServiceClient.openUrl(StringRequest.create({ value: `${baseUrl}${FORGEOS_PASS_SUBSCRIBE_PATH}` })).catch((err) =>
		console.error("Failed to open ForgeOSPass subscription page:", err),
	)
}

export function buildForgeOSPassSubscriptionPageUrl(appBaseUrl: string | undefined): string {
	return new URL(FORGEOS_PASS_USAGE_PATH, appBaseUrl || DEFAULT_APP_BASE_URL).toString()
}

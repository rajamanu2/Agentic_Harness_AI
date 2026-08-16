// Shared between the sidecar (which produces this result) and the webview
// (which consumes it), like the desktop transport types.

/**
 * Typed result the `forgeos_account` sidecar command returns when no ForgeOS
 * account credentials exist. Being signed out is an expected state, so it
 * travels as a structured response instead of a thrown error: it must not be
 * reported to error telemetry or rendered as a raw error string.
 */
export const FORGEOS_ACCOUNT_NOT_AUTHENTICATED_CODE =
	"ACCOUNT_NOT_AUTHENTICATED" as const;

export type ForgeOSAccountNotAuthenticatedResult = {
	signedIn: false;
	code: typeof FORGEOS_ACCOUNT_NOT_AUTHENTICATED_CODE;
};

export const FORGEOS_ACCOUNT_NOT_AUTHENTICATED_RESULT: ForgeOSAccountNotAuthenticatedResult =
	{
		signedIn: false,
		code: FORGEOS_ACCOUNT_NOT_AUTHENTICATED_CODE,
	};

export function isForgeOSAccountNotAuthenticatedResult(
	value: unknown,
): value is ForgeOSAccountNotAuthenticatedResult {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as ForgeOSAccountNotAuthenticatedResult).code ===
			FORGEOS_ACCOUNT_NOT_AUTHENTICATED_CODE &&
		(value as ForgeOSAccountNotAuthenticatedResult).signedIn === false
	);
}

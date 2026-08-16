import type { ForgeOSMessage } from "@shared/ExtensionMessage"
import { memo } from "react"
import { ForgeOSAuthStatus } from "@/components/account/ForgeOSAuthStatus"
import ForgeOSFreeModelLimitError from "@/components/chat/ForgeOSFreeModelLimitError"
import ForgeOSFreePromotionEndedError from "@/components/chat/ForgeOSFreePromotionEndedError"
import ForgeOSPassLimitError from "@/components/chat/ForgeOSPassLimitError"
import CreditLimitError from "@/components/chat/CreditLimitError"
import EntitlementError from "@/components/chat/EntitlementError"
import OrgForgeOSPassRestrictionError from "@/components/chat/OrgForgeOSPassRestrictionError"
import SpendLimitError from "@/components/chat/SpendLimitError"
import { Button } from "@/components/ui/button"
import { useForgeOSAuth, useForgeOSSignIn } from "@/context/ForgeOSAuthContext"
import { ForgeOSError, ForgeOSErrorType } from "../../../../src/services/error/ForgeOSError"

const _errorColor = "var(--vscode-errorForeground)"

interface ErrorRowProps {
	message: ForgeOSMessage
	errorType: "error" | "mistake_limit_reached" | "diff_error" | "forgeosignore_error"
	apiRequestFailedMessage?: string
	apiReqStreamingFailedMessage?: string
}

const ErrorRow = memo(({ message, errorType, apiRequestFailedMessage, apiReqStreamingFailedMessage }: ErrorRowProps) => {
	const { forgeosUser } = useForgeOSAuth()
	const rawApiError = apiRequestFailedMessage || apiReqStreamingFailedMessage

	const { isLoginLoading, authStatusMessage, handleSignIn } = useForgeOSSignIn()

	const renderErrorContent = () => {
		switch (errorType) {
			case "error":
			case "mistake_limit_reached":
				// Handle API request errors with special error parsing
				if (rawApiError) {
					// FIXME: ForgeOSError parsing should not be applied to non-ForgeOS providers, but it seems we're using forgeosErrorMessage below in the default error display
					const forgeosError = ForgeOSError.parse(rawApiError)
					const errorMessage = forgeosError?._error?.message || forgeosError?.message || rawApiError
					const requestId = forgeosError?._error?.request_id
					const providerId = forgeosError?.providerId || forgeosError?._error?.providerId
					// Deliberately narrower than the shared isForgeOSManagedProvider (which
					// also matches forgeos-pass): only usage-billing errors get the credit
					// and login prompts below.
					const isForgeOSUsageBillingProvider = providerId === "forgeos"
					const errorCode = forgeosError?._error?.code

					if (forgeosError?.isErrorType(ForgeOSErrorType.Balance)) {
						const errorDetails = forgeosError._error?.details
						if (isForgeOSUsageBillingProvider || errorDetails?.buy_credits_url) {
							return (
								<CreditLimitError
									buyCreditsUrl={errorDetails?.buy_credits_url}
									currentBalance={errorDetails?.current_balance}
									message={errorDetails?.message}
									totalPromotions={errorDetails?.total_promotions}
									totalSpent={errorDetails?.total_spent}
								/>
							)
						}
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.SpendLimit)) {
						const d = forgeosError._error?.details
						return (
							<SpendLimitError
								budgetPeriod={d?.budget_period}
								limitUsd={d?.limit_usd}
								message={d?.message || errorMessage}
								resetsAt={d?.resets_at}
								spentUsd={d?.spent_usd}
							/>
						)
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.Entitlement)) {
						const detailMessage = forgeosError?._error?.details?.message || errorMessage
						return <EntitlementError message={detailMessage} />
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.OrgForgeOSPassRestriction)) {
						return <OrgForgeOSPassRestrictionError />
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.ForgeOSPassLimit)) {
						const detailMessage = forgeosError?._error?.details?.message || errorMessage
						return <ForgeOSPassLimitError message={detailMessage} />
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.ForgeOSFreeModelLimit)) {
						const detailMessage = forgeosError?._error?.details?.message || errorMessage
						return <ForgeOSFreeModelLimitError message={detailMessage} />
					}

					// A retired free model answers model-not-found once its promotion
					// ends — dedicated copy plus a route into the model picker,
					// since retrying the deleted model can never succeed.
					if (forgeosError?.isErrorType(ForgeOSErrorType.ForgeOSFreePromotionEnded)) {
						return <ForgeOSFreePromotionEndedError />
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.RateLimit)) {
						return (
							<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</p>
						)
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.QuotaExceeded)) {
						const detailMessage = forgeosError?._error?.details?.message || errorMessage
						return <p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">{detailMessage}</p>
					}

					if (forgeosError?.isErrorType(ForgeOSErrorType.Auth) && isForgeOSUsageBillingProvider) {
						return !forgeosUser ? (
							// User is using ForgeOS provider and is not logged in
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-center rounded border border-neutral-500/30 bg-vscode-editor-background p-6 text-center text-vscode-foreground">
									Whoops looks like you're logged out – click below to sign in
								</div>
								<Button className="w-full" disabled={isLoginLoading} onClick={handleSignIn}>
									Sign in to ForgeOS
									{isLoginLoading && (
										<span className="ml-1 animate-spin">
											<span className="codicon codicon-refresh" />
										</span>
									)}
								</Button>
								<ForgeOSAuthStatus message={authStatusMessage} />
							</div>
						) : (
							// Don't show sign in button after the user has logged in, just ask them to retry
							<div className="mt-4">
								<span className="text-description">(Click "Retry" below)</span>
							</div>
						)
					}

					return (
						<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere flex flex-col gap-3">
							{/* Display the well-formatted error extracted from the ForgeOSError instance */}

							<header>
								{providerId && <span className="uppercase">[{providerId}] </span>}
								{errorCode && <span>{errorCode}</span>}
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</header>

							{/* Windows Powershell Issue */}
							{errorMessage?.toLowerCase()?.includes("powershell") && (
								<div>
									It seems like you're having Windows PowerShell issues, please see this{" "}
									<a
										className="underline text-inherit"
										href="https://github.com/forgeos/forgeos/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22">
										troubleshooting guide
									</a>
									.
								</div>
							)}

							{/* Display raw API error if different from parsed error message */}
							{errorMessage !== rawApiError && <div>{rawApiError}</div>}
						</p>
					)
				}

				// Regular error message
				return <p className="m-0 mt-0 whitespace-pre-wrap text-error wrap-anywhere">{message.text}</p>

			case "diff_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>The model used search patterns that don't match anything in the file. Retrying...</div>
					</div>
				)

			case "forgeosignore_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>
							ForgeOS tried to access <code>{message.text}</code> which is blocked by the <code>.forgeosignore</code>
							file.
						</div>
					</div>
				)

			default:
				return null
		}
	}

	// For diff_error and forgeosignore_error, we don't show the header separately
	if (errorType === "diff_error" || errorType === "forgeosignore_error") {
		return renderErrorContent()
	}

	// For other error types, show header + content
	return renderErrorContent()
})

export default ErrorRow

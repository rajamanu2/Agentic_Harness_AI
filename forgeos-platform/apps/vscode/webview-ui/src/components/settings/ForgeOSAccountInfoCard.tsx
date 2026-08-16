import { StringRequest } from "@shared/proto/forgeos/common"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { ForgeOSAuthStatus } from "@/components/account/ForgeOSAuthStatus"
import { useForgeOSAuth, useForgeOSSignIn } from "@/context/ForgeOSAuthContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"

export const ForgeOSAccountInfoCard = ({ usageLink }: { usageLink?: string }) => {
	const { forgeosUser } = useForgeOSAuth()
	const { navigateToAccount } = useExtensionState()
	const { isLoginLoading, authStatusMessage, handleSignIn } = useForgeOSSignIn()
	const [didStartLogin, setDidStartLogin] = useState(false)

	const user = forgeosUser || undefined

	const handleLogin = () => {
		setDidStartLogin(true)
		handleSignIn()
	}

	useEffect(() => {
		if (didStartLogin && user) {
			navigateToAccount()
		}
	}, [didStartLogin, navigateToAccount, user])

	const handleShowAccount = () => {
		if (!usageLink) {
			return navigateToAccount()
		}

		UiServiceClient.openUrl(StringRequest.create({ value: usageLink })).catch((err) => {
			console.error("Failed to open usage link:", err)
		})
	}

	return (
		<div className="max-w-[600px]">
			{user ? (
				<VSCodeButton appearance="secondary" onClick={handleShowAccount}>
					View Billing & Usage
				</VSCodeButton>
			) : (
				<div className="flex flex-col gap-3">
					<VSCodeButton className="mt-0" disabled={isLoginLoading} onClick={handleLogin}>
						Sign Up with ForgeOS
						{isLoginLoading && (
							<span className="ml-1 animate-spin">
								<span className="codicon codicon-refresh" />
							</span>
						)}
					</VSCodeButton>
					<ForgeOSAuthStatus message={authStatusMessage} />
				</div>
			)}
		</div>
	)
}

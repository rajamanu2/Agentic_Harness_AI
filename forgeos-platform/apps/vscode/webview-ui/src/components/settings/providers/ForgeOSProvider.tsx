import { Mode } from "@shared/storage/types"
import { ForgeOSAccountInfoCard } from "../ForgeOSAccountInfoCard"
import ForgeOSModelPicker from "../ForgeOSModelPicker"

/**
 * Props for the ForgeOSProvider component
 */
interface ForgeOSProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

/**
 * The ForgeOS provider configuration component
 */
export const ForgeOSProvider = ({ showModelOptions, isPopup, currentMode, initialModelTab }: ForgeOSProviderProps) => {
	return (
		<div>
			{/* ForgeOS Account Info Card */}
			<div style={{ marginBottom: 14, marginTop: 4 }}>
				<ForgeOSAccountInfoCard />
			</div>

			{showModelOptions && (
				<ForgeOSModelPicker
					currentMode={currentMode}
					initialTab={initialModelTab}
					isPopup={isPopup}
					showProviderRouting={true}
				/>
			)}
		</div>
	)
}

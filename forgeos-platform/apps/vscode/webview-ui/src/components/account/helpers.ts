import type { UsageTransaction as ForgeOSAccountUsageTransaction } from "@shared/ForgeOSAccount"
import type { UsageTransaction as ProtoUsageTransaction, UserOrganization } from "@shared/proto/forgeos/account"

export const getMainRole = (roles?: string[]) => {
	if (!roles) {
		return undefined
	}

	if (roles.includes("owner")) {
		return "Owner"
	}
	if (roles.includes("admin")) {
		return "Admin"
	}

	return "Member"
}

export const getForgeOSUris = (base: string, type: "dashboard" | "credits", route?: "account" | "organization") => {
	const dashboard = new URL("dashboard", base)

	if (type === "dashboard") {
		return dashboard
	}

	const credits = new URL("/" + (route ?? "account"), dashboard)
	credits.searchParams.set("tab", "credits")
	credits.searchParams.set("redirect", "true")
	return credits
}

/**
 * Converts a protobuf UsageTransaction to a ForgeOSAccount UsageTransaction
 * by adding the missing id and metadata fields
 */
function convertProtoUsageTransaction(protoTransaction: ProtoUsageTransaction): ForgeOSAccountUsageTransaction {
	return {
		...protoTransaction,
		id: protoTransaction.generationId, // Use generationId as the id
		metadata: {
			additionalProp1: "",
			additionalProp2: "",
			additionalProp3: "",
		},
	}
}

/**
 * Converts an array of protobuf UsageTransactions to ForgeOSAccount UsageTransactions
 */
export function convertProtoUsageTransactions(protoTransactions: ProtoUsageTransaction[]): ForgeOSAccountUsageTransaction[] {
	return protoTransactions.map(convertProtoUsageTransaction)
}

export const isAdminOrOwner = (activeOrg: UserOrganization): boolean => {
	return activeOrg.roles.findIndex((role) => role === "admin" || role === "owner") > -1
}

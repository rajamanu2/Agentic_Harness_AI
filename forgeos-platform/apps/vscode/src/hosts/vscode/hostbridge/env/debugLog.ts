import { Empty, StringRequest } from "@shared/proto/forgeos/common"
import * as vscode from "vscode"

const FORGEOS_OUTPUT_CHANNEL = vscode.window.createOutputChannel("ForgeOS")

// Appends a log message to all ForgeOS output channels.
export async function debugLog(request: StringRequest): Promise<Empty> {
	FORGEOS_OUTPUT_CHANNEL.appendLine(request.value)
	return Empty.create({})
}

// Register the ForgeOS output channel within the VSCode extension context.
export function registerForgeOSOutputChannel(context: vscode.ExtensionContext): vscode.OutputChannel {
	context.subscriptions.push(FORGEOS_OUTPUT_CHANNEL)
	return FORGEOS_OUTPUT_CHANNEL
}

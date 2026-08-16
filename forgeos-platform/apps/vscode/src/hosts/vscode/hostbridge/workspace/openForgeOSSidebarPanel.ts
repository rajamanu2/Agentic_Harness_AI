import * as vscode from "vscode"
import { ExtensionRegistryInfo } from "@/registry"
import { OpenForgeOSSidebarPanelRequest, OpenForgeOSSidebarPanelResponse } from "@/shared/proto/index.host"

export async function openForgeOSSidebarPanel(_: OpenForgeOSSidebarPanelRequest): Promise<OpenForgeOSSidebarPanelResponse> {
	await vscode.commands.executeCommand(`${ExtensionRegistryInfo.views.Sidebar}.focus`)
	return {}
}

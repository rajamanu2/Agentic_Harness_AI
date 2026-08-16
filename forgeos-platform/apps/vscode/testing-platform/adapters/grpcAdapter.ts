import { AccountServiceClient } from "@forgeos-grpc/account"
import { BrowserServiceClient } from "@forgeos-grpc/browser"
import { CheckpointsServiceClient } from "@forgeos-grpc/checkpoints"
import { CommandsServiceClient } from "@forgeos-grpc/commands"
import { FileServiceClient } from "@forgeos-grpc/file"
import { McpServiceClient } from "@forgeos-grpc/mcp"
import { ModelsServiceClient } from "@forgeos-grpc/models"
import { SlashServiceClient } from "@forgeos-grpc/slash"
import { StateServiceClient } from "@forgeos-grpc/state"
import { TaskServiceClient } from "@forgeos-grpc/task"
import { UiServiceClient } from "@forgeos-grpc/ui"
import { WebServiceClient } from "@forgeos-grpc/web"
import { credentials } from "@grpc/grpc-js"
import { promisify } from "util"

const serviceRegistry = {
	"forgeos.AccountService": AccountServiceClient,
	"forgeos.BrowserService": BrowserServiceClient,
	"forgeos.CheckpointsService": CheckpointsServiceClient,
	"forgeos.CommandsService": CommandsServiceClient,
	"forgeos.FileService": FileServiceClient,
	"forgeos.McpService": McpServiceClient,
	"forgeos.ModelsService": ModelsServiceClient,
	"forgeos.SlashService": SlashServiceClient,
	"forgeos.StateService": StateServiceClient,
	"forgeos.TaskService": TaskServiceClient,
	"forgeos.UiService": UiServiceClient,
	"forgeos.WebService": WebServiceClient,
} as const

export type ServiceClients = {
	-readonly [K in keyof typeof serviceRegistry]: InstanceType<(typeof serviceRegistry)[K]>
}

export class GrpcAdapter {
	private clients: Partial<ServiceClients> = {}

	constructor(address: string) {
		for (const [name, Client] of Object.entries(serviceRegistry)) {
			this.clients[name as keyof ServiceClients] = new (Client as any)(address, credentials.createInsecure())
		}
	}

	async call(service: keyof ServiceClients, method: string, request: any): Promise<any> {
		const client = this.clients[service]
		if (!client) {
			throw new Error(`No gRPC client registered for service: ${String(service)}`)
		}

		const fn = (client as any)[method]
		if (typeof fn !== "function") {
			throw new Error(`Method ${method} not found on service ${String(service)}`)
		}

		try {
			const fnAsync = promisify(fn).bind(client)
			const response = await fnAsync(request.message)
			return response?.toObject ? response.toObject() : response
		} catch (error) {
			console.error(`[GrpcAdapter] ${service}.${method} failed:`, error)
			throw error
		}
	}

	close(): void {
		for (const client of Object.values(this.clients)) {
			if (client && typeof (client as any).close === "function") {
				;(client as any).close()
			}
		}
	}
}

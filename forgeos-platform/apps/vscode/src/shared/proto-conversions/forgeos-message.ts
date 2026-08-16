import { ForgeOSAsk as AppForgeOSAsk, ForgeOSMessage as AppForgeOSMessage, ForgeOSSay as AppForgeOSSay } from "@shared/ExtensionMessage"
import { ForgeOSAsk, ForgeOSMessageType, ForgeOSSay, ForgeOSMessage as ProtoForgeOSMessage } from "@shared/proto/forgeos/ui"

// Helper function to convert ForgeOSAsk string to enum
function convertForgeOSAskToProtoEnum(ask: AppForgeOSAsk | undefined): ForgeOSAsk | undefined {
	if (!ask) {
		return undefined
	}

	const mapping: Record<AppForgeOSAsk, ForgeOSAsk> = {
		followup: ForgeOSAsk.FOLLOWUP,
		plan_mode_respond: ForgeOSAsk.PLAN_MODE_RESPOND,
		act_mode_respond: ForgeOSAsk.ACT_MODE_RESPOND,
		command: ForgeOSAsk.COMMAND,
		command_output: ForgeOSAsk.COMMAND_OUTPUT,
		completion_result: ForgeOSAsk.COMPLETION_RESULT,
		tool: ForgeOSAsk.TOOL,
		api_req_failed: ForgeOSAsk.API_REQ_FAILED,
		resume_task: ForgeOSAsk.RESUME_TASK,
		resume_completed_task: ForgeOSAsk.RESUME_COMPLETED_TASK,
		mistake_limit_reached: ForgeOSAsk.MISTAKE_LIMIT_REACHED,
		browser_action_launch: ForgeOSAsk.BROWSER_ACTION_LAUNCH,
		use_mcp_server: ForgeOSAsk.USE_MCP_SERVER,
		new_task: ForgeOSAsk.NEW_TASK,
		condense: ForgeOSAsk.CONDENSE,
		summarize_task: ForgeOSAsk.SUMMARIZE_TASK,
		report_bug: ForgeOSAsk.REPORT_BUG,
		use_subagents: ForgeOSAsk.USE_SUBAGENTS,
	}

	const result = mapping[ask]
	if (result === undefined) {
	}
	return result
}

// Helper function to convert ForgeOSAsk enum to string
function convertProtoEnumToForgeOSAsk(ask: ForgeOSAsk): AppForgeOSAsk | undefined {
	if (ask === ForgeOSAsk.UNRECOGNIZED) {
		return undefined
	}

	const mapping: Record<Exclude<ForgeOSAsk, ForgeOSAsk.UNRECOGNIZED>, AppForgeOSAsk> = {
		[ForgeOSAsk.FOLLOWUP]: "followup",
		[ForgeOSAsk.PLAN_MODE_RESPOND]: "plan_mode_respond",
		[ForgeOSAsk.ACT_MODE_RESPOND]: "act_mode_respond",
		[ForgeOSAsk.COMMAND]: "command",
		[ForgeOSAsk.COMMAND_OUTPUT]: "command_output",
		[ForgeOSAsk.COMPLETION_RESULT]: "completion_result",
		[ForgeOSAsk.TOOL]: "tool",
		[ForgeOSAsk.API_REQ_FAILED]: "api_req_failed",
		[ForgeOSAsk.RESUME_TASK]: "resume_task",
		[ForgeOSAsk.RESUME_COMPLETED_TASK]: "resume_completed_task",
		[ForgeOSAsk.MISTAKE_LIMIT_REACHED]: "mistake_limit_reached",
		[ForgeOSAsk.BROWSER_ACTION_LAUNCH]: "browser_action_launch",
		[ForgeOSAsk.USE_MCP_SERVER]: "use_mcp_server",
		[ForgeOSAsk.NEW_TASK]: "new_task",
		[ForgeOSAsk.CONDENSE]: "condense",
		[ForgeOSAsk.SUMMARIZE_TASK]: "summarize_task",
		[ForgeOSAsk.REPORT_BUG]: "report_bug",
		[ForgeOSAsk.USE_SUBAGENTS]: "use_subagents",
	}

	return mapping[ask]
}

// Helper function to convert ForgeOSSay string to enum
function convertForgeOSSayToProtoEnum(say: AppForgeOSSay | undefined): ForgeOSSay | undefined {
	if (!say) {
		return undefined
	}

	const mapping: Record<AppForgeOSSay, ForgeOSSay> = {
		task: ForgeOSSay.TASK,
		error: ForgeOSSay.ERROR,
		api_req_started: ForgeOSSay.API_REQ_STARTED,
		api_req_finished: ForgeOSSay.API_REQ_FINISHED,
		text: ForgeOSSay.TEXT,
		reasoning: ForgeOSSay.REASONING,
		completion_result: ForgeOSSay.COMPLETION_RESULT_SAY,
		plan_completion_result: ForgeOSSay.PLAN_COMPLETION_RESULT,
		user_feedback: ForgeOSSay.USER_FEEDBACK,
		user_feedback_diff: ForgeOSSay.USER_FEEDBACK_DIFF,
		command: ForgeOSSay.COMMAND_SAY,
		command_output: ForgeOSSay.COMMAND_OUTPUT_SAY,
		tool: ForgeOSSay.TOOL_SAY,
		shell_integration_warning: ForgeOSSay.SHELL_INTEGRATION_WARNING,
		shell_integration_warning_with_suggestion: ForgeOSSay.SHELL_INTEGRATION_WARNING,
		browser_action_launch: ForgeOSSay.BROWSER_ACTION_LAUNCH_SAY,
		browser_action: ForgeOSSay.BROWSER_ACTION,
		browser_action_result: ForgeOSSay.BROWSER_ACTION_RESULT,
		mcp_server_request_started: ForgeOSSay.MCP_SERVER_REQUEST_STARTED,
		mcp_server_response: ForgeOSSay.MCP_SERVER_RESPONSE,
		mcp_notification: ForgeOSSay.MCP_NOTIFICATION,
		use_mcp_server: ForgeOSSay.USE_MCP_SERVER_SAY,
		diff_error: ForgeOSSay.DIFF_ERROR,
		deleted_api_reqs: ForgeOSSay.DELETED_API_REQS,
		forgeosignore_error: ForgeOSSay.FORGEOSIGNORE_ERROR,
		command_permission_denied: ForgeOSSay.COMMAND_PERMISSION_DENIED,
		checkpoint_created: ForgeOSSay.CHECKPOINT_CREATED,
		load_mcp_documentation: ForgeOSSay.LOAD_MCP_DOCUMENTATION,
		info: ForgeOSSay.INFO,
		task_progress: ForgeOSSay.TASK_PROGRESS,
		hook_status: ForgeOSSay.HOOK_STATUS,
		hook_output_stream: ForgeOSSay.HOOK_OUTPUT_STREAM,
		conditional_rules_applied: ForgeOSSay.CONDITIONAL_RULES_APPLIED,
		subagent: ForgeOSSay.SUBAGENT_STATUS,
		use_subagents: ForgeOSSay.USE_SUBAGENTS_SAY,
		subagent_usage: ForgeOSSay.SUBAGENT_USAGE,
		compaction: ForgeOSSay.COMPACTION,
	}

	const result = mapping[say]

	return result
}

// Helper function to convert ForgeOSSay enum to string
function convertProtoEnumToForgeOSSay(say: ForgeOSSay): AppForgeOSSay | undefined {
	if (say === ForgeOSSay.UNRECOGNIZED) {
		return undefined
	}

	const mapping: Record<Exclude<ForgeOSSay, ForgeOSSay.UNRECOGNIZED>, AppForgeOSSay> = {
		[ForgeOSSay.TASK]: "task",
		[ForgeOSSay.ERROR]: "error",
		[ForgeOSSay.API_REQ_STARTED]: "api_req_started",
		[ForgeOSSay.API_REQ_FINISHED]: "api_req_finished",
		[ForgeOSSay.TEXT]: "text",
		[ForgeOSSay.REASONING]: "reasoning",
		[ForgeOSSay.COMPLETION_RESULT_SAY]: "completion_result",
		[ForgeOSSay.PLAN_COMPLETION_RESULT]: "plan_completion_result",
		[ForgeOSSay.USER_FEEDBACK]: "user_feedback",
		[ForgeOSSay.USER_FEEDBACK_DIFF]: "user_feedback_diff",
		[ForgeOSSay.COMMAND_SAY]: "command",
		[ForgeOSSay.COMMAND_OUTPUT_SAY]: "command_output",
		[ForgeOSSay.TOOL_SAY]: "tool",
		[ForgeOSSay.SHELL_INTEGRATION_WARNING]: "shell_integration_warning",
		[ForgeOSSay.BROWSER_ACTION_LAUNCH_SAY]: "browser_action_launch",
		[ForgeOSSay.BROWSER_ACTION]: "browser_action",
		[ForgeOSSay.BROWSER_ACTION_RESULT]: "browser_action_result",
		[ForgeOSSay.MCP_SERVER_REQUEST_STARTED]: "mcp_server_request_started",
		[ForgeOSSay.MCP_SERVER_RESPONSE]: "mcp_server_response",
		[ForgeOSSay.MCP_NOTIFICATION]: "mcp_notification",
		[ForgeOSSay.USE_MCP_SERVER_SAY]: "use_mcp_server",
		[ForgeOSSay.DIFF_ERROR]: "diff_error",
		[ForgeOSSay.DELETED_API_REQS]: "deleted_api_reqs",
		[ForgeOSSay.FORGEOSIGNORE_ERROR]: "forgeosignore_error",
		[ForgeOSSay.COMMAND_PERMISSION_DENIED]: "command_permission_denied",
		[ForgeOSSay.CHECKPOINT_CREATED]: "checkpoint_created",
		[ForgeOSSay.LOAD_MCP_DOCUMENTATION]: "load_mcp_documentation",
		[ForgeOSSay.INFO]: "info",
		[ForgeOSSay.TASK_PROGRESS]: "task_progress",
		[ForgeOSSay.HOOK_STATUS]: "hook_status",
		[ForgeOSSay.HOOK_OUTPUT_STREAM]: "hook_output_stream",
		[ForgeOSSay.CONDITIONAL_RULES_APPLIED]: "conditional_rules_applied",
		[ForgeOSSay.SUBAGENT_STATUS]: "subagent",
		[ForgeOSSay.USE_SUBAGENTS_SAY]: "use_subagents",
		[ForgeOSSay.SUBAGENT_USAGE]: "subagent_usage",
		[ForgeOSSay.COMPACTION]: "compaction",
	}

	return mapping[say]
}

/**
 * Convert application ForgeOSMessage to proto ForgeOSMessage
 */
export function convertForgeOSMessageToProto(message: AppForgeOSMessage): ProtoForgeOSMessage {
	// For sending messages, we need to provide values for required proto fields
	const askEnum = message.ask ? convertForgeOSAskToProtoEnum(message.ask) : undefined
	const sayEnum = message.say ? convertForgeOSSayToProtoEnum(message.say) : undefined

	// Determine appropriate enum values based on message type
	let finalAskEnum: ForgeOSAsk = ForgeOSAsk.FOLLOWUP // Proto default
	let finalSayEnum: ForgeOSSay = ForgeOSSay.TEXT // Proto default

	if (message.type === "ask") {
		finalAskEnum = askEnum ?? ForgeOSAsk.FOLLOWUP // Use FOLLOWUP as default for ask messages
	} else if (message.type === "say") {
		finalSayEnum = sayEnum ?? ForgeOSSay.TEXT // Use TEXT as default for say messages
	}

	const protoMessage: ProtoForgeOSMessage = {
		ts: message.ts,
		type: message.type === "ask" ? ForgeOSMessageType.ASK : ForgeOSMessageType.SAY,
		ask: finalAskEnum,
		say: finalSayEnum,
		text: message.text ?? "",
		reasoning: message.reasoning ?? "",
		images: message.images ?? [],
		files: message.files ?? [],
		partial: message.partial ?? false,
		// Convergent-replica fields (default 0 = unstamped, e.g. classic/legacy path).
		seq: message.seq ?? 0,
		epoch: message.epoch ?? 0,
		lastCheckpointHash: message.lastCheckpointHash ?? "",
		isCheckpointCheckedOut: message.isCheckpointCheckedOut ?? false,
		isOperationOutsideWorkspace: message.isOperationOutsideWorkspace ?? false,
		conversationHistoryIndex: message.conversationHistoryIndex ?? 0,
		conversationHistoryDeletedRange: message.conversationHistoryDeletedRange
			? {
					startIndex: message.conversationHistoryDeletedRange[0],
					endIndex: message.conversationHistoryDeletedRange[1],
				}
			: undefined,
		// Additional optional fields for specific ask/say types
		sayTool: undefined,
		sayBrowserAction: undefined,
		browserActionResult: undefined,
		askUseMcpServer: undefined,
		planModeResponse: undefined,
		askQuestion: undefined,
		askNewTask: undefined,
		apiReqInfo: undefined,
		modelInfo: message.modelInfo ?? undefined,
	}

	return protoMessage
}

/**
 * Convert proto ForgeOSMessage to application ForgeOSMessage
 */
export function convertProtoToForgeOSMessage(protoMessage: ProtoForgeOSMessage): AppForgeOSMessage {
	const message: AppForgeOSMessage = {
		ts: protoMessage.ts,
		type: protoMessage.type === ForgeOSMessageType.ASK ? "ask" : "say",
	}

	// Convert ask enum to string
	if (protoMessage.type === ForgeOSMessageType.ASK) {
		const ask = convertProtoEnumToForgeOSAsk(protoMessage.ask)
		if (ask !== undefined) {
			message.ask = ask
		}
	}

	// Convert say enum to string
	if (protoMessage.type === ForgeOSMessageType.SAY) {
		const say = convertProtoEnumToForgeOSSay(protoMessage.say)
		if (say !== undefined) {
			message.say = say
		}
	}

	// Convert other fields - preserve empty strings as they may be intentional
	if (protoMessage.text !== "") {
		message.text = protoMessage.text
	}
	if (protoMessage.reasoning !== "") {
		message.reasoning = protoMessage.reasoning
	}
	if (protoMessage.images.length > 0) {
		message.images = protoMessage.images
	}
	if (protoMessage.files.length > 0) {
		message.files = protoMessage.files
	}
	if (protoMessage.partial) {
		message.partial = protoMessage.partial
	}
	if (protoMessage.lastCheckpointHash !== "") {
		message.lastCheckpointHash = protoMessage.lastCheckpointHash
	}
	if (protoMessage.isCheckpointCheckedOut) {
		message.isCheckpointCheckedOut = protoMessage.isCheckpointCheckedOut
	}
	if (protoMessage.isOperationOutsideWorkspace) {
		message.isOperationOutsideWorkspace = protoMessage.isOperationOutsideWorkspace
	}
	if (protoMessage.conversationHistoryIndex !== 0) {
		message.conversationHistoryIndex = protoMessage.conversationHistoryIndex
	}

	// Convert conversationHistoryDeletedRange from object to tuple
	if (protoMessage.conversationHistoryDeletedRange) {
		message.conversationHistoryDeletedRange = [
			protoMessage.conversationHistoryDeletedRange.startIndex,
			protoMessage.conversationHistoryDeletedRange.endIndex,
		]
	}

	// Convergent-replica fields. 0 means unstamped (classic/legacy path) — leave undefined so
	// the webview reducer treats such messages as always-applicable rather than epoch 0.
	if (protoMessage.seq && protoMessage.seq !== 0) {
		message.seq = protoMessage.seq
	}
	if (protoMessage.epoch && protoMessage.epoch !== 0) {
		message.epoch = protoMessage.epoch
	}

	return message
}

import type { ForgeOSCore } from "@forgeos/core";
import type { MessageWithMetadata } from "@forgeos/shared";

export async function loadInteractiveResumeMessages(
	sessionManager: ForgeOSCore,
	resumeSessionId?: string,
): Promise<MessageWithMetadata[] | undefined> {
	const target = resumeSessionId?.trim();
	if (!target) {
		return undefined;
	}
	return await sessionManager.readMessages(target);
}

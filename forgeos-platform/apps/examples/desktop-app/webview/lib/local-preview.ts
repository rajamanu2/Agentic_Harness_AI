import type { ChatMessage } from "./chat-schema";

const URL_CANDIDATE = /https?:\/\/[^\s<>'"`]+/gi;
const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeLocalPreviewUrl(candidate: string): string | null {
	const trimmed = candidate.replace(/[),.;\]}]+$/g, "");
	try {
		const url = new URL(trimmed);
		if (!LOCAL_PREVIEW_HOSTS.has(url.hostname)) return null;
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.toString();
	} catch {
		return null;
	}
}

export function findLatestLocalPreviewUrl(messages: ChatMessage[]): string | null {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const candidates = messages[index]?.content.match(URL_CANDIDATE) ?? [];
		for (let urlIndex = candidates.length - 1; urlIndex >= 0; urlIndex -= 1) {
			const normalized = normalizeLocalPreviewUrl(candidates[urlIndex] ?? "");
			if (normalized) return normalized;
		}
	}
	return null;
}

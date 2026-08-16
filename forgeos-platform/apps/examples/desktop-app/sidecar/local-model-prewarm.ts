const OLLAMA_URL = "http://127.0.0.1:11434";

export const FORGEOS_QUALITY_LOCAL_MODEL = "qwen2.5-coder:7b";

type OllamaTags = {
	models?: Array<{ name?: string }>;
};

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

/**
 * Load the quality-first local model while the desktop UI is starting and keep
 * it resident. This removes Ollama's large cold-load penalty from later agent
 * turns without replacing the model with a lower-quality small model.
 */
export async function prewarmQualityLocalModel(
	fetchImpl: FetchLike = fetch,
): Promise<boolean> {
	try {
		const tagsResponse = await fetchImpl(`${OLLAMA_URL}/api/tags`);
		if (!tagsResponse.ok) return false;
		const tags = (await tagsResponse.json()) as OllamaTags;
		if (!tags.models?.some((model) => model.name === FORGEOS_QUALITY_LOCAL_MODEL)) {
			return false;
		}

		const warmResponse = await fetchImpl(`${OLLAMA_URL}/api/generate`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				model: FORGEOS_QUALITY_LOCAL_MODEL,
				prompt: "",
				stream: false,
				keep_alive: -1,
			}),
		});
		return warmResponse.ok;
	} catch {
		return false;
	}
}

import { describe, expect, it, vi } from "vitest";
import {
	FORGEOS_QUALITY_LOCAL_MODEL,
	prewarmQualityLocalModel,
} from "./local-model-prewarm";

describe("prewarmQualityLocalModel", () => {
	it("loads the quality model and keeps it resident", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ models: [{ name: FORGEOS_QUALITY_LOCAL_MODEL }] }),
				),
			)
			.mockResolvedValueOnce(new Response("{}"));

		await expect(prewarmQualityLocalModel(fetchMock)).resolves.toBe(true);
		expect(fetchMock).toHaveBeenLastCalledWith(
			"http://127.0.0.1:11434/api/generate",
			expect.objectContaining({
				body: expect.stringContaining('"keep_alive":-1'),
			}),
		);
	});

	it("does nothing when the quality model is not installed", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ models: [{ name: "another-model" }] })),
		);

		await expect(prewarmQualityLocalModel(fetchMock)).resolves.toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

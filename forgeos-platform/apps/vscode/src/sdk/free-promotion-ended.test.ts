import { describe, expect, it } from "vitest"
import { ForgeOSError, ForgeOSErrorType } from "../services/error/ForgeOSError"
import { reshapeErrorForWebview } from "./message-translator"

// Once a free promotion ends the forgeos-free/ model is removed from the catalog
// and the backend answers "model not found". These tests pin the host-side
// detection that turns that answer into the webview's promotion-ended card.
describe("reshapeErrorForWebview - free promotion ended", () => {
	it("stamps the promotion-ended code when a forgeos-free model answers model-not-found", () => {
		const payload = reshapeErrorForWebview({ message: "Error 404: Model not found" }, "forgeos", "forgeos-free/glm-5")

		const parsed = JSON.parse(payload)
		expect(parsed.code).toBe("forgeos_free_promotion_ended")
		expect(parsed.modelId).toBe("forgeos-free/glm-5")
		expect(parsed.providerId).toBe("forgeos")
		expect(parsed.details?.code).toBe("forgeos_free_promotion_ended")
	})

	it("keeps the selected provider id, so forgeos-pass selections stay attributed", () => {
		const payload = reshapeErrorForWebview({ message: "Model not found" }, "forgeos-pass", "forgeos-free/glm-5")

		expect(JSON.parse(payload).providerId).toBe("forgeos-pass")
	})

	it("round-trips into the webview's ForgeOSFreePromotionEnded classification", () => {
		const payload = reshapeErrorForWebview({ message: "Error 404: Model not found" }, "forgeos", "forgeos-free/glm-5")

		const forgeosError = ForgeOSError.parse(payload)
		expect(forgeosError && ForgeOSError.getErrorType(forgeosError)).toBe(ForgeOSErrorType.ForgeOSFreePromotionEnded)
	})

	it("leaves model-not-found for a paid model on the generic guidance path", () => {
		const payload = reshapeErrorForWebview({ message: "Model not found" }, "forgeos", "deepseek/deepseek-v4-flash")

		expect(payload).toBe(
			"Model not found This model may be retired or unavailable on your account. Switch to a different model in API Configuration settings, then retry.",
		)
	})

	it("leaves model-not-found on the generic guidance path when the model id is unknown", () => {
		const payload = reshapeErrorForWebview({ message: "Model not found" }, "forgeos")

		expect(payload).toContain("This model may be retired or unavailable")
	})

	it("does not touch unrelated errors from a forgeos-free model", () => {
		expect(reshapeErrorForWebview({ message: "socket hang up" }, "forgeos", "forgeos-free/glm-5")).toBe("socket hang up")
	})
})

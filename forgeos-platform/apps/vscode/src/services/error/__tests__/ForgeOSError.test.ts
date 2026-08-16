import { describe, it } from "bun:test"
import "should"
import { ForgeOSError, ForgeOSErrorType } from "../ForgeOSError"

describe("ForgeOSError", () => {
	describe("getErrorType", () => {
		it("should return QuotaExceeded when code is INFERENCE_CAP_ERROR", () => {
			const err = new ForgeOSError({ message: "Inference cap reached", code: "INFERENCE_CAP_ERROR" })
			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.QuotaExceeded)
		})

		it("should return Entitlement for the SDK ForgeOSPass subscription message", () => {
			const err = new ForgeOSError(
				"No access to ForgeOSPass subscription models yet. Subscribe to ForgeOSPass, the low cost open weights model coding plan:",
			)

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.Entitlement)
		})

		it("should return Entitlement for the SDK ForgeOSPass subscription message with a different app URL", () => {
			const err = new ForgeOSError(
				"No access to ForgeOSPass subscription models yet. Subscribe to ForgeOSPass, the low cost open weights model coding plan:",
			)

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.Entitlement)
		})

		it("should return Entitlement for the raw required-plan message", () => {
			const err = new ForgeOSError("403 Error 403: the user is not subscribed to required model plan")

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.Entitlement)
		})

		it("should classify the SDK org individual subscription message separately", () => {
			const err = new ForgeOSError(
				"Organization accounts cannot use ForgeOSPass subscriptions. Go to /account -> change account to switch to your personal account for ForgeOSPass",
			)

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.OrgForgeOSPassRestriction)
		})

		it("should classify the raw organization individual subscription message separately", () => {
			const err = new ForgeOSError("403 Error 403: organization accounts cannot use individual model inference subscriptions")

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.OrgForgeOSPassRestriction)
		})

		it("should classify ForgeOSPass period limit messages separately", () => {
			const err = new ForgeOSError(
				"You have reached your weekly ForgeOSpass limit. The limit resets in 7d, please try again later.",
			)

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.ForgeOSPassLimit)
		})

		it("should classify nested ForgeOSPass period limit messages separately", () => {
			const err = new ForgeOSError({
				message: "403 Error 403",
				error: {
					message: "You have reached your monthly ForgeOSPass limit. The limit resets in 12h, please try again later.",
				},
			})

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.ForgeOSPassLimit)
		})

		it("should classify daily ForgeOS free model limits separately", () => {
			const err = new ForgeOSError(
				"Error: Error 429: Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m",
			)

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.ForgeOSFreeModelLimit)
		})

		it("should classify the host-stamped promotion-ended code as ForgeOSFreePromotionEnded", () => {
			// reshapeErrorForWebview stamps this code when the active model is a
			// retired forgeos-free/ id (see message-translator).
			const err = new ForgeOSError({
				message: "Model not found",
				code: "forgeos_free_promotion_ended",
			})

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.ForgeOSFreePromotionEnded)
		})

		it("should classify model-not-found for a forgeos-free model as ForgeOSFreePromotionEnded", () => {
			const err = new ForgeOSError({ message: "Error 404: Model not found" }, "forgeos-free/glm-5")

			ForgeOSError.getErrorType(err)!.should.equal(ForgeOSErrorType.ForgeOSFreePromotionEnded)
		})

		it("should prefer ForgeOSFreePromotionEnded over Auth for a 404 with a forgeos-free model", () => {
			// A 404 falls inside the generic 401-428 auth-status range; the
			// promotion-ended classification must win.
			const err = new ForgeOSError({ message: "Error 404: Model not found", status: 404 }, "forgeos-free/glm-5")

			const result = ForgeOSError.getErrorType(err)
			result!.should.equal(ForgeOSErrorType.ForgeOSFreePromotionEnded)
		})

		it("should keep model-not-found for a non-free model on the generic path", () => {
			const err = new ForgeOSError({ message: "Error 404: Model not found", status: 404 }, "deepseek/deepseek-v4-flash")

			const result = ForgeOSError.getErrorType(err)
			;(result !== ForgeOSErrorType.ForgeOSFreePromotionEnded).should.be.true()
		})

		it("should not classify unrelated forgeos-free errors as ForgeOSFreePromotionEnded", () => {
			const err = new ForgeOSError({ message: "Network error: socket hang up" }, "forgeos-free/glm-5")

			const result = ForgeOSError.getErrorType(err)
			;(result !== ForgeOSErrorType.ForgeOSFreePromotionEnded).should.be.true()
		})
	})
})

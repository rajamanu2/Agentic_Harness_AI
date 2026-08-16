import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EntitlementError from "./EntitlementError"

const mockAuth: { forgeosUser: { appBaseUrl?: string } | null } = {
	forgeosUser: null,
}

vi.mock("@/context/ForgeOSAuthContext", () => ({
	useForgeOSAuth: () => mockAuth,
}))

const askResponseMock = vi.fn()
vi.mock("@/services/grpc-client", () => ({
	TaskServiceClient: {
		askResponse: (...args: unknown[]) => askResponseMock(...args),
	},
}))

const getSubscribeHref = () => screen.getByRole("link", { name: /get forgeospass/i }).getAttribute("href")
const querySubscribeLink = () => screen.queryByRole("link", { name: /get forgeospass/i })

describe("EntitlementError", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockAuth.forgeosUser = null
	})

	it("shows friendly copy with the backend detail as muted support text", () => {
		render(<EntitlementError message="Error 403: the user is not subscribed to required model plan" />)
		expect(screen.getByText("This model requires a ForgeOSPass subscription.")).toBeInTheDocument()
		expect(screen.getByText("Error 403: the user is not subscribed to required model plan")).toBeInTheDocument()
	})

	it("omits the subscribe link when no usable app base URL is available", () => {
		render(<EntitlementError />)
		expect(querySubscribeLink()).toBeNull()

		mockAuth.forgeosUser = {}
		render(<EntitlementError />)
		expect(querySubscribeLink()).toBeNull()

		mockAuth.forgeosUser = { appBaseUrl: "not a valid url" }
		render(<EntitlementError />)
		expect(querySubscribeLink()).toBeNull()
	})

	it("builds the subscribe link from the authenticated user's app base URL", () => {
		mockAuth.forgeosUser = { appBaseUrl: "https://staging-app.forgeos.bot" }
		const { unmount } = render(<EntitlementError />)
		expect(getSubscribeHref()).toBe("https://staging-app.forgeos.bot/dashboard/subscription?personal=true")
		unmount()

		mockAuth.forgeosUser = {
			appBaseUrl: "https://proxy.enterprise.com/forgeos/app",
		}
		render(<EntitlementError />)
		expect(getSubscribeHref()).toBe("https://proxy.enterprise.com/forgeos/app/dashboard/subscription?personal=true")
	})

	it("sends a yesButtonClicked askResponse when Retry Request is clicked", () => {
		render(<EntitlementError />)
		// VSCodeButton has no ARIA role in jsdom; click by label text instead.
		fireEvent.click(screen.getByText("Retry Request"))
		expect(askResponseMock).toHaveBeenCalledTimes(1)
		expect(askResponseMock.mock.calls[0][0]).toMatchObject({
			responseType: "yesButtonClicked",
		})
	})
})

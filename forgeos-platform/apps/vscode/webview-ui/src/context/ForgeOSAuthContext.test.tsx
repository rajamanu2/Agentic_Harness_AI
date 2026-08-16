import type { AuthState, UserOrganizationsResponse } from "@shared/proto/forgeos/account"
import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ForgeOSAuthProvider, useForgeOSAuth } from "./ForgeOSAuthContext"

type AuthStatusCallbacks = {
	onResponse: (response: AuthState) => void
}

const grpcMocks = vi.hoisted(() => ({
	getUserOrganizations: vi.fn(),
	subscribeToAuthStatusUpdate: vi.fn(),
	authStatusCallbacks: undefined as AuthStatusCallbacks | undefined,
}))

vi.mock("@/services/grpc-client", () => ({
	AccountServiceClient: {
		getUserOrganizations: grpcMocks.getUserOrganizations,
		subscribeToAuthStatusUpdate: grpcMocks.subscribeToAuthStatusUpdate,
	},
}))

function createDeferred<T>() {
	let resolve: (value: T) => void = () => {}
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

function AuthStateProbe() {
	const { forgeosUser, organizations } = useForgeOSAuth()
	return (
		<>
			<div data-testid="user-state">{forgeosUser?.uid ?? "signed-out"}</div>
			<div data-testid="organizations-state">
				{organizations?.map((organization) => organization.organizationId).join(",") ?? "none"}
			</div>
		</>
	)
}

describe("ForgeOSAuthProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		grpcMocks.authStatusCallbacks = undefined
		grpcMocks.subscribeToAuthStatusUpdate.mockImplementation((_request, callbacks: AuthStatusCallbacks) => {
			grpcMocks.authStatusCallbacks = callbacks
			return vi.fn()
		})
	})

	it("does not restore organizations when an in-flight request resolves after sign-out", async () => {
		const organizationsRequest = createDeferred<UserOrganizationsResponse>()
		grpcMocks.getUserOrganizations.mockReturnValue(organizationsRequest.promise)

		render(
			<ForgeOSAuthProvider>
				<AuthStateProbe />
			</ForgeOSAuthProvider>,
		)

		act(() => {
			grpcMocks.authStatusCallbacks?.onResponse({ user: { uid: "user-1" } })
		})
		expect(grpcMocks.getUserOrganizations).toHaveBeenCalledTimes(1)

		act(() => {
			grpcMocks.authStatusCallbacks?.onResponse({})
		})

		await act(async () => {
			organizationsRequest.resolve({
				organizations: [
					{ organizationId: "stale-org", active: true, memberId: "member-1", name: "Stale Org", roles: [] },
				],
			})
			await organizationsRequest.promise
		})

		expect(screen.getByTestId("user-state")).toHaveTextContent("signed-out")
		expect(screen.getByTestId("organizations-state")).toHaveTextContent("none")
	})
})

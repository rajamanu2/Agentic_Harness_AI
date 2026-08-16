import { describe, expect, it } from "vitest"
import { isForgeOSManagedProvider } from "@/shared/utils/forgeos"
import { resolveWorkspaceManagerPaths, resolveWorkspaceRootPath } from "./workspace-root"

describe("isForgeOSManagedProvider", () => {
	it("treats both ForgeOS account providers as ForgeOS providers", () => {
		expect(isForgeOSManagedProvider("forgeos")).toBe(true)
		expect(isForgeOSManagedProvider("forgeos-pass")).toBe(true)
		expect(isForgeOSManagedProvider("anthropic")).toBe(false)
		expect(isForgeOSManagedProvider(undefined)).toBe(false)
	})
})

describe("resolveWorkspaceRootPath", () => {
	it("uses the first non-empty workspace path when available", () => {
		expect(resolveWorkspaceRootPath(["", "/workspace"], "/Users/tester/Desktop")).toBe("/workspace")
	})

	it("falls back to Desktop when no workspace folder is open", () => {
		expect(resolveWorkspaceRootPath([], "/Users/tester/Desktop")).toBe("/Users/tester/Desktop")
	})
})

describe("resolveWorkspaceManagerPaths", () => {
	it("returns the host's workspace folder paths, dropping blank entries", () => {
		expect(resolveWorkspaceManagerPaths(["/workspace", "  ", "/other"], "/Users/tester/Desktop")).toEqual([
			"/workspace",
			"/other",
		])
	})

	it("falls back to a single root when no workspace folder is open", () => {
		// Legacy-parity: an empty VS Code window must still yield a usable root
		// so @-mention file search doesn't fail with workspace_unavailable.
		expect(resolveWorkspaceManagerPaths([], "/Users/tester/Desktop")).toEqual(["/Users/tester/Desktop"])
		expect(resolveWorkspaceManagerPaths(undefined, "/Users/tester/Desktop")).toEqual(["/Users/tester/Desktop"])
		expect(resolveWorkspaceManagerPaths(["", "   "], "/Users/tester/Desktop")).toEqual(["/Users/tester/Desktop"])
	})

	it("prefers real workspace folders over the fallback", () => {
		expect(resolveWorkspaceManagerPaths(["/workspace"], "/Users/tester/Desktop")).toEqual(["/workspace"])
	})

	it("returns no roots when the fallback is also unavailable", () => {
		expect(resolveWorkspaceManagerPaths([], undefined)).toEqual([])
		expect(resolveWorkspaceManagerPaths([], "  ")).toEqual([])
	})
})

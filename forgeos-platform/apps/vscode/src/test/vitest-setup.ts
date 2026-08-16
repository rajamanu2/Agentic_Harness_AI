// Under vitest, `@forgeos/core` is aliased to src/test/forgeos-core-vitest-stub.ts
// (see vitest.config.ts), which holds models.json state in memory and exposes
// the stub-only `resetModelsFileState` — hence the cast below.
import * as ForgeOSCore from "@forgeos/core"
import { resetRegistry } from "@forgeos/llms"
import { beforeEach } from "vitest"

const { resetModelsFileState } = ForgeOSCore as typeof ForgeOSCore & { resetModelsFileState(): void }

beforeEach(() => {
	resetModelsFileState()
	// The stub's syncStoredProviderRegistration mutates the real shared
	// @forgeos/llms registry; reset it so registrations never leak across tests.
	resetRegistry()
})

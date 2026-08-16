import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	getForgeOSCliMigrationNotice,
	markForgeOSCliMigrationNoticeShown,
	resolveCliNoticeStatePath,
	shouldSuppressForgeOSCliMigrationNoticeForActiveProvider,
} from "./notice";

const tempDirs: string[] = [];

function createTempDataDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "forgeos-cli-notice-"));
	tempDirs.push(dir);
	return dir;
}

describe("migration notice", () => {
	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns the notice for a fresh data dir", () => {
		const dataDir = createTempDataDir();

		expect(getForgeOSCliMigrationNotice(dataDir)?.title).toBe("Try ForgeOSPass");
	});

	it("shows when only the old Kanban notice was marked as shown", () => {
		const dataDir = createTempDataDir();
		const noticePath = resolveCliNoticeStatePath(dataDir);
		mkdirSync(dirname(noticePath), { recursive: true, mode: 0o700 });
		writeFileSync(
			noticePath,
			`${JSON.stringify(
				{ shown: { "forgeos-cli-tui-default": true } },
				null,
				2,
			)}\n`,
			"utf8",
		);

		expect(getForgeOSCliMigrationNotice(dataDir)?.id).toBe(
			"forgeos-cli-forgeos-pass-intro",
		);
	});

	it("does not show after the notice is marked as shown", () => {
		const dataDir = createTempDataDir();

		markForgeOSCliMigrationNoticeShown(dataDir);

		expect(getForgeOSCliMigrationNotice(dataDir)).toBeUndefined();
	});

	it("shows after the notice is marked as shown when forced", () => {
		const dataDir = createTempDataDir();

		markForgeOSCliMigrationNoticeShown(dataDir);

		expect(
			getForgeOSCliMigrationNotice(dataDir, {
				FORGEOS_FORCE_FORGEOS_PASS_NOTICE: "1",
			}),
		).toBeDefined();
	});

	it("does not show when disabled through the environment", () => {
		const dataDir = createTempDataDir();

		expect(
			getForgeOSCliMigrationNotice(dataDir, {
				FORGEOS_DISABLE_FORGEOS_PASS_NOTICE: "1",
			}),
		).toBeUndefined();
	});

	it("does not show when ForgeOSPass is already the active provider", () => {
		const dataDir = createTempDataDir();

		expect(
			getForgeOSCliMigrationNotice(
				dataDir,
				{},
				{ activeProviderId: "forgeos-pass" },
			),
		).toBeUndefined();
	});

	it("suppresses the active ForgeOSPass provider even when the provider id has surrounding whitespace", () => {
		expect(
			shouldSuppressForgeOSCliMigrationNoticeForActiveProvider(" forgeos-pass "),
		).toBe(true);
	});

	it("does not suppress the active ForgeOSPass provider when forced", () => {
		expect(
			shouldSuppressForgeOSCliMigrationNoticeForActiveProvider("forgeos-pass", {
				FORGEOS_FORCE_FORGEOS_PASS_NOTICE: "1",
			}),
		).toBe(false);
	});

	it("shows for the active ForgeOSPass provider when forced", () => {
		const dataDir = createTempDataDir();

		expect(
			getForgeOSCliMigrationNotice(
				dataDir,
				{ FORGEOS_FORCE_FORGEOS_PASS_NOTICE: "1" },
				{ activeProviderId: "forgeos-pass" },
			),
		).toBeDefined();
	});

	it("shows when forced even if disabled through the environment", () => {
		const dataDir = createTempDataDir();

		expect(
			getForgeOSCliMigrationNotice(dataDir, {
				FORGEOS_DISABLE_FORGEOS_PASS_NOTICE: "1",
				FORGEOS_FORCE_FORGEOS_PASS_NOTICE: "1",
			}),
		).toBeDefined();
	});

	it("marks the notice as shown", () => {
		const dataDir = createTempDataDir();

		markForgeOSCliMigrationNoticeShown(dataDir);

		const rawState = readFileSync(resolveCliNoticeStatePath(dataDir), "utf8");
		expect(rawState).toContain("forgeos-cli-forgeos-pass-intro");
		expect(getForgeOSCliMigrationNotice(dataDir)).toBeUndefined();
	});
});

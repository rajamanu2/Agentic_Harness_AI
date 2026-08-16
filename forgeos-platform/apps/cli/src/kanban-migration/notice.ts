import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveForgeOSDataDir } from "@forgeos/shared/storage";

const NOTICE_ID = "forgeos-cli-forgeos-pass-intro";
const FORCE_NOTICE_ENV = "FORGEOS_FORCE_FORGEOS_PASS_NOTICE";
const DISABLE_NOTICE_ENV = "FORGEOS_DISABLE_FORGEOS_PASS_NOTICE";

export interface CliMigrationNotice {
	id: string;
	title: string;
}

export interface CliMigrationNoticeOptions {
	activeProviderId?: string;
}

interface CliNoticeState {
	shown: Record<string, boolean>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonRecord(filePath: string): Record<string, unknown> | undefined {
	if (!existsSync(filePath)) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function readNoticeState(filePath: string): CliNoticeState {
	const parsed = readJsonRecord(filePath);
	const shown: Record<string, boolean> = {};
	if (!parsed) {
		return { shown };
	}
	const rawShown = parsed.shown;
	if (!isRecord(rawShown)) {
		return { shown };
	}
	for (const [key, value] of Object.entries(rawShown)) {
		if (typeof value === "boolean") {
			shown[key] = value;
		}
	}
	return { shown };
}

function isForceNoticeEnabled(env: NodeJS.ProcessEnv): boolean {
	return env[FORCE_NOTICE_ENV]?.trim() === "1";
}

export function shouldSuppressForgeOSCliMigrationNoticeForActiveProvider(
	activeProviderId: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	return (
		activeProviderId?.trim() === "forgeos-pass" && !isForceNoticeEnabled(env)
	);
}

export function resolveCliNoticeStatePath(
	dataDir = resolveForgeOSDataDir(),
): string {
	return join(dataDir, "settings", "cli-notices.json");
}

export function getForgeOSCliMigrationNotice(
	dataDir = resolveForgeOSDataDir(),
	env: NodeJS.ProcessEnv = process.env,
	options: CliMigrationNoticeOptions = {},
): CliMigrationNotice | undefined {
	const noticePath = resolveCliNoticeStatePath(dataDir);
	const noticeState = readNoticeState(noticePath);
	const forceNotice = isForceNoticeEnabled(env);
	const disableNotice = env[DISABLE_NOTICE_ENV]?.trim() === "1";
	if (disableNotice && !forceNotice) {
		return undefined;
	}
	if (
		shouldSuppressForgeOSCliMigrationNoticeForActiveProvider(
			options.activeProviderId,
			env,
		)
	) {
		return undefined;
	}
	if (noticeState.shown[NOTICE_ID] && !forceNotice) {
		return undefined;
	}
	return {
		id: NOTICE_ID,
		title: "Try ForgeOSPass",
	};
}

export function markForgeOSCliMigrationNoticeShown(
	dataDir = resolveForgeOSDataDir(),
): void {
	const noticePath = resolveCliNoticeStatePath(dataDir);
	const noticeState = readNoticeState(noticePath);
	const nextState: CliNoticeState = {
		shown: {
			...noticeState.shown,
			[NOTICE_ID]: true,
		},
	};
	mkdirSync(dirname(noticePath), { recursive: true, mode: 0o700 });
	writeFileSync(noticePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
}

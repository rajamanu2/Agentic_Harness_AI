import os from "os"
import * as path from "path"

const SKILL_DIRECTORY_NAMES = {
	forgeosruleSkillsDir: ".forgeosrules/skills",
	forgeosSkillsDir: ".forgeos/skills",
	claudeSkillsDir: ".claude/skills",
	agentsSkillsDir: ".agents/skills",
} as const

export type SkillsScanDirectory = {
	path: string
	source: "project" | "global"
}

function getForgeOSHomePath(): string {
	return path.join(os.homedir(), ".forgeos")
}

function getForgeOSSkillsDirectoryPath(): string {
	return path.join(getForgeOSHomePath(), "skills")
}

function getAgentSkillsDirectoryPath(): string {
	return path.join(os.homedir(), ".agents", "skills")
}

/**
 * Returns the list of skills directories to scan without creating them.
 * Order is project directories first, then global directories.
 */
export function getSkillsDirectoriesForScan(cwd: string): SkillsScanDirectory[] {
	return [
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.forgeosruleSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.forgeosSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.claudeSkillsDir), source: "project" },
		{ path: path.join(cwd, SKILL_DIRECTORY_NAMES.agentsSkillsDir), source: "project" },
		{ path: getForgeOSSkillsDirectoryPath(), source: "global" },
		{ path: getAgentSkillsDirectoryPath(), source: "global" },
	]
}

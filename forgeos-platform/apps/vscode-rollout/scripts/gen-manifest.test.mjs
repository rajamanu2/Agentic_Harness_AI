import { describe, expect, it } from "bun:test";
import { generateManifest } from "./gen-manifest.mjs";

const shared = {
	name: "claude-dev",
	publisher: "saoudrizwan",
	main: "./dist/extension.js",
	engines: { vscode: "^1.84.0" },
	displayName: "ForgeOS",
};

function pkg(overrides) {
	return {
		...shared,
		activationEvents: ["onStartupFinished"],
		contributes: {
			viewsContainers: {
				activitybar: [{ id: "c", title: "ForgeOS", icon: "assets/icon.svg" }],
			},
			views: { c: [{ type: "webview", id: "claude-dev.SidebarProvider" }] },
			commands: [],
			keybindings: [],
			menus: {},
			icons: {},
			...overrides.contributes,
		},
		...Object.fromEntries(
			Object.entries(overrides).filter(([k]) => k !== "contributes"),
		),
	};
}

describe("generateManifest", () => {
	it("unions commands, menus, keybindings and activation events", () => {
		const next = pkg({
			contributes: {
				commands: [
					{ command: "forgeos.a", title: "A" },
					{ command: "forgeos.shared", title: "S" },
				],
				menus: { "view/title": [{ command: "forgeos.a", when: "x" }] },
			},
		});
		const legacy = pkg({
			activationEvents: ["onStartupFinished", "workspaceContains:evals.env"],
			contributes: {
				commands: [
					{ command: "forgeos.b", title: "B" },
					{ command: "forgeos.shared", title: "S" },
				],
				menus: {
					"view/title": [{ command: "forgeos.b", when: "y" }],
					"comments/commentThread/title": [{ command: "forgeos.b" }],
				},
				keybindings: [{ command: "forgeos.b", key: "ctrl+k" }],
			},
		});
		const manifest = generateManifest(next, legacy, "4.1.0");
		expect(manifest.version).toBe("4.1.0");
		expect(manifest.main).toBe("./extension.js");
		expect(manifest.contributes.commands.map((c) => c.command).sort()).toEqual([
			"forgeos.a",
			"forgeos.b",
			"forgeos.shared",
		]);
		expect(manifest.contributes.menus["view/title"]).toHaveLength(2);
		expect(
			manifest.contributes.menus["comments/commentThread/title"],
		).toHaveLength(1);
		expect(manifest.contributes.keybindings).toHaveLength(1);
		expect(manifest.activationEvents).toContain("workspaceContains:evals.env");
	});

	it("gates cohort-exclusive menu entries and keybindings on the context key", () => {
		const next = pkg({
			contributes: {
				commands: [
					{ command: "forgeos.a", title: "A" },
					{ command: "forgeos.shared", title: "S" },
				],
				menus: {
					"view/title": [
						{ command: "forgeos.a", when: "x" },
						{ command: "forgeos.shared", when: "v" },
					],
				},
			},
		});
		const legacy = pkg({
			contributes: {
				commands: [
					{ command: "forgeos.b", title: "B" },
					{ command: "forgeos.shared", title: "S" },
				],
				menus: {
					"view/title": [
						{ command: "forgeos.b", when: "y" },
						{ command: "forgeos.shared", when: "v" },
					],
				},
				keybindings: [{ command: "forgeos.b", key: "ctrl+k", when: "focus" }],
			},
		});
		const manifest = generateManifest(next, legacy, "4.1.0");
		const viewTitle = manifest.contributes.menus["view/title"];
		expect(viewTitle.find((e) => e.command === "forgeos.a").when).toBe(
			"(x) && forgeos.sdkBundle",
		);
		expect(viewTitle.find((e) => e.command === "forgeos.b").when).toBe(
			"(y) && !forgeos.sdkBundle",
		);
		expect(viewTitle.find((e) => e.command === "forgeos.shared").when).toBe("v");
		expect(manifest.contributes.keybindings[0].when).toBe(
			"(focus) && !forgeos.sdkBundle",
		);
	});

	it("hides cohort-exclusive commands from the other cohort's palette", () => {
		const next = pkg({
			contributes: {
				commands: [
					{ command: "forgeos.nextOnly", title: "N" },
					{ command: "forgeos.shared", title: "S" },
				],
			},
		});
		const legacy = pkg({
			contributes: {
				commands: [
					{ command: "forgeos.legacyOnly", title: "L" },
					{ command: "forgeos.shared", title: "S" },
				],
			},
		});
		const palette = generateManifest(next, legacy, "4.1.0").contributes.menus
			.commandPalette;
		expect(palette).toContainEqual({
			command: "forgeos.nextOnly",
			when: "forgeos.sdkBundle",
		});
		expect(palette).toContainEqual({
			command: "forgeos.legacyOnly",
			when: "!forgeos.sdkBundle",
		});
		expect(palette.find((e) => e.command === "forgeos.shared")).toBeUndefined();
	});

	it("leaves commands alone when a bundle already declares a palette entry for them", () => {
		const next = pkg({
			contributes: { commands: [{ command: "forgeos.shared", title: "S" }] },
		});
		const legacy = pkg({
			contributes: {
				commands: [
					{ command: "forgeos.hidden", title: "H" },
					{ command: "forgeos.shared", title: "S" },
				],
				menus: { commandPalette: [{ command: "forgeos.hidden", when: "false" }] },
			},
		});
		const palette = generateManifest(next, legacy, "4.1.0").contributes.menus
			.commandPalette;
		expect(palette.filter((e) => e.command === "forgeos.hidden")).toEqual([
			{ command: "forgeos.hidden", when: "(false) && !forgeos.sdkBundle" },
		]);
	});

	it("dedupes structurally identical menu entries", () => {
		const entry = { command: "forgeos.a", when: "view == forgeos" };
		const next = pkg({
			contributes: {
				commands: [{ command: "forgeos.a", title: "A" }],
				menus: { "view/title": [entry] },
			},
		});
		const legacy = pkg({
			contributes: {
				commands: [{ command: "forgeos.a", title: "A" }],
				menus: { "view/title": [{ ...entry }] },
			},
		});
		expect(
			generateManifest(next, legacy, "1.0.0").contributes.menus["view/title"],
		).toHaveLength(1);
	});

	it("rejects diverged views/viewsContainers", () => {
		const next = pkg({});
		const legacy = pkg({
			contributes: { views: { c: [{ type: "webview", id: "other" }] } },
		});
		expect(() => generateManifest(next, legacy, "1.0.0")).toThrow(/views/);
	});

	it("rejects structurally diverged walkthroughs", () => {
		const walkthrough = (stepId, media) => ({
			contributes: {
				walkthroughs: [
					{
						id: "ForgeOSWalkthrough",
						title: "Meet ForgeOS",
						steps: [{ id: stepId, title: "Start here", media }],
					},
				],
			},
		});
		expect(() =>
			generateManifest(
				pkg(walkthrough("welcome", { markdown: "walkthrough/step1.md" })),
				pkg(walkthrough("hello", { markdown: "walkthrough/step1.md" })),
				"1.0.0",
			),
		).toThrow(/walkthroughs diverged structurally/);
		expect(() =>
			generateManifest(
				pkg(walkthrough("welcome", { markdown: "walkthrough/step1.md" })),
				pkg(walkthrough("welcome", { markdown: "walkthrough/other.md" })),
				"1.0.0",
			),
		).toThrow(/walkthroughs diverged structurally/);
	});

	it("tolerates copy-only walkthrough divergence, shipping next's text", () => {
		const walkthrough = (description) => ({
			contributes: {
				walkthroughs: [
					{
						id: "ForgeOSWalkthrough",
						title: "Meet ForgeOS",
						steps: [
							{
								id: "welcome",
								title: "Start here",
								description,
								media: { markdown: "walkthrough/step1.md" },
							},
						],
					},
				],
			},
		});
		const manifest = generateManifest(
			pkg(walkthrough("Connect via MCP.")),
			pkg(walkthrough("Discover the MCP Marketplace.")),
			"1.0.0",
		);
		expect(manifest.contributes.walkthroughs[0].steps[0].description).toBe(
			"Connect via MCP.",
		);
	});

	it("rejects diverged configuration", () => {
		const next = pkg({
			contributes: {
				configuration: {
					title: "ForgeOS",
					properties: {
						"forgeos.enabled": { type: "boolean", default: false },
					},
				},
			},
		});
		const legacy = pkg({
			contributes: {
				configuration: {
					title: "ForgeOS",
					properties: {
						"forgeos.enabled": { type: "boolean", default: 0 },
					},
				},
			},
		});
		expect(() => generateManifest(next, legacy, "1.0.0")).toThrow(
			/contributes\.configuration diverged/,
		);
	});

	it("injects the loader-owned bundleOverride setting into the union", () => {
		const manifest = generateManifest(pkg({}), pkg({}), "4.1.0");
		const prop =
			manifest.contributes.configuration.properties[
				"forgeos.rollout.bundleOverride"
			];
		expect(prop).toBeDefined();
		expect(prop.enum).toEqual(["auto", "next", "legacy"]);
		expect(prop.default).toBe("auto");
		expect(prop.scope).toBe("application");
	});

	it("rejects bundles that declare the loader-owned setting themselves", () => {
		const withClash = {
			contributes: {
				configuration: {
					title: "ForgeOS",
					properties: { "forgeos.rollout.bundleOverride": { type: "string" } },
				},
			},
		};
		expect(() =>
			generateManifest(pkg(withClash), pkg(withClash), "4.1.0"),
		).toThrow(/loader-owned setting/);
	});

	it("derives gates and the injected setting from the nightly identity", () => {
		const nightly = (overrides) => ({
			...pkg(overrides),
			name: "forgeos-nightly",
			displayName: "ForgeOS (Nightly)",
		});
		const next = nightly({
			contributes: {
				commands: [{ command: "forgeos-nightly.nextOnly", title: "N" }],
				menus: {
					"view/title": [{ command: "forgeos-nightly.nextOnly", when: "x" }],
				},
			},
		});
		const legacy = nightly({
			contributes: {
				commands: [{ command: "forgeos-nightly.legacyOnly", title: "L" }],
				keybindings: [{ command: "forgeos-nightly.legacyOnly", key: "ctrl+k" }],
			},
		});
		const manifest = generateManifest(next, legacy, "4.0.1752600000");
		expect(manifest.name).toBe("forgeos-nightly");
		expect(manifest.contributes.menus["view/title"][0].when).toBe(
			"(x) && forgeos-nightly.sdkBundle",
		);
		expect(manifest.contributes.keybindings[0].when).toBe(
			"!forgeos-nightly.sdkBundle",
		);
		expect(manifest.contributes.menus.commandPalette).toContainEqual({
			command: "forgeos-nightly.legacyOnly",
			when: "!forgeos-nightly.sdkBundle",
		});
		const properties = manifest.contributes.configuration.properties;
		expect(properties["forgeos-nightly.rollout.bundleOverride"]).toBeDefined();
		expect(properties["forgeos.rollout.bundleOverride"]).toBeUndefined();
	});

	it("unions diverged engines to the newer requirement (either direction)", () => {
		const olderLegacy = { ...pkg({}), engines: { vscode: "^1.74.0" } };
		expect(generateManifest(pkg({}), olderLegacy, "1.0.0").engines).toEqual({
			vscode: "^1.84.0",
		});
		const newerLegacy = { ...pkg({}), engines: { vscode: "^1.101.0" } };
		expect(generateManifest(pkg({}), newerLegacy, "1.0.0").engines).toEqual({
			vscode: "^1.101.0",
		});
	});

	it("rejects diverged engines it cannot compare", () => {
		const legacy = { ...pkg({}), engines: { vscode: ">=1.84.0 <2.0.0" } };
		expect(() => generateManifest(pkg({}), legacy, "1.0.0")).toThrow(
			/uncomparable/,
		);
	});

	it("rejects conflicting icon definitions", () => {
		const next = pkg({
			contributes: {
				icons: {
					"forgeos-logo": {
						description: "d",
						default: { fontPath: "a.woff", fontCharacter: "\\E900" },
					},
				},
			},
		});
		const legacy = pkg({
			contributes: {
				icons: {
					"forgeos-logo": {
						description: "d",
						default: { fontPath: "b.woff", fontCharacter: "\\E900" },
					},
				},
			},
		});
		expect(() => generateManifest(next, legacy, "1.0.0")).toThrow(/icons/);
	});
});

import { describe, expect, it } from "bun:test";
import { nightlifyPackageJson } from "./nightlify.mjs";

const fixture = {
	name: "claude-dev",
	displayName: "ForgeOS",
	publisher: "saoudrizwan",
	version: "4.0.0",
	main: "./dist/extension.js",
	contributes: {
		viewsContainers: {
			activitybar: [
				{
					id: "claude-dev-ActivityBar",
					title: "ForgeOS",
					icon: "assets/icon.svg",
				},
			],
		},
		views: {
			"claude-dev-ActivityBar": [
				{ type: "webview", id: "claude-dev.SidebarProvider" },
			],
		},
		commands: [{ command: "forgeos.plusButtonClicked", title: "New Task" }],
		keybindings: [{ command: "forgeos.addToChat", key: "ctrl+'" }],
		menus: {
			"view/title": [
				{
					command: "forgeos.plusButtonClicked",
					when: "view == claude-dev.SidebarProvider",
				},
				// Mid-string references are NOT rewritten — a known limitation
				// shared with the standalone nightly's publish-nightly.mjs.
				{ command: "forgeos.addToChat", when: "config.forgeos.enableExtras" },
			],
		},
		configuration: {
			title: "ForgeOS",
			properties: { "forgeos.enableExtras": { type: "boolean" } },
		},
	},
};

describe("nightlifyPackageJson", () => {
	const pkg = JSON.parse(
		nightlifyPackageJson(JSON.stringify(fixture, null, "\t"), "4.0.1752600000"),
	);

	it("sets the nightly identity and the supplied version", () => {
		expect(pkg.name).toBe("forgeos-nightly");
		expect(pkg.displayName).toBe("ForgeOS (Nightly)");
		expect(pkg.version).toBe("4.0.1752600000");
		expect(pkg.publisher).toBe("saoudrizwan");
	});

	it("rewrites claude-dev IDs and the forgeos.* namespace", () => {
		expect(pkg.contributes.viewsContainers.activitybar[0].id).toBe(
			"forgeos-nightly-ActivityBar",
		);
		expect(pkg.contributes.viewsContainers.activitybar[0].title).toBe(
			"ForgeOS (Nightly)",
		);
		expect(Object.keys(pkg.contributes.views)).toEqual([
			"forgeos-nightly-ActivityBar",
		]);
		expect(pkg.contributes.views["forgeos-nightly-ActivityBar"][0].id).toBe(
			"forgeos-nightly.SidebarProvider",
		);
		expect(pkg.contributes.commands[0].command).toBe(
			"forgeos-nightly.plusButtonClicked",
		);
		expect(pkg.contributes.keybindings[0].command).toBe(
			"forgeos-nightly.addToChat",
		);
		expect(Object.keys(pkg.contributes.configuration.properties)).toEqual([
			"forgeos-nightly.enableExtras",
		]);
	});

	it("rewrites when-clauses that start with a rewritten ID, but not mid-string references", () => {
		const [gated, midString] = pkg.contributes.menus["view/title"];
		expect(gated.when).toBe("view == forgeos-nightly.SidebarProvider");
		// Documented limitation: `config.forgeos.` does not match the `"forgeos.`
		// pattern, so it survives unrewritten (matches publish-nightly.mjs).
		expect(midString.when).toBe("config.forgeos.enableExtras");
	});

	it("requires a version", () => {
		expect(() => nightlifyPackageJson("{}", undefined)).toThrow(/version/);
	});
});

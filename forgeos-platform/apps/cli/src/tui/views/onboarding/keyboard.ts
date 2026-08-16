import type { ProviderConfigFieldKey } from "@forgeos/core";
import { useKeyboard } from "@opentui/react";
import type { Dispatch, SetStateAction } from "react";
import type { ForgeOSModelPickerEntry } from "../../components/model-selector/forgeos-model-picker";
import type { SearchableListState } from "../../components/searchable-list";
import {
	isOnboardingOAuthProviderId,
	type OnboardingOAuthProviderId,
} from "./auth";
import { FIELD_ORDER } from "./fields";
import {
	type ForgeOSPassSubscriptionOption,
	type ForgeOSPassSubscriptionStatus,
	type MenuOption,
	type OnboardingStep,
	THINKING_LEVELS,
	type ThinkingLevel,
} from "./model";

export function useOnboardingKeyboard(input: {
	step: OnboardingStep;
	onExit: () => void;
	oauthProvider: string;
	activeProviderId: string;
	menuOptions: MenuOption[];
	menuSelected: number;
	providerList: SearchableListState;
	modelList: SearchableListState;
	forgeosEntries: ForgeOSModelPickerEntry[];
	forgeosModelSelected: number;
	forgeosPassSubscriptionStatus: ForgeOSPassSubscriptionStatus;
	forgeosPassSubscriptionOptions: ForgeOSPassSubscriptionOption[];
	forgeosPassSubscriptionSelected: number;
	thinkingSelected: number;
	setStep: (step: OnboardingStep) => void;
	setMenuSelected: Dispatch<SetStateAction<number>>;
	resetByoFields: () => void;
	byoFields: Partial<Record<ProviderConfigFieldKey, unknown>>;
	byoFocusedField: ProviderConfigFieldKey;
	setByoFocusedField: Dispatch<SetStateAction<ProviderConfigFieldKey>>;
	setDeviceUserCode: (value: string) => void;
	setDeviceVerifyUrl: (value: string) => void;
	setDeviceError: (value: string) => void;
	setDeviceStatus: (value: string) => void;
	setForgeOSModelSelected: Dispatch<SetStateAction<number>>;
	setForgeOSPassSubscriptionSelected: Dispatch<SetStateAction<number>>;
	setThinkingSelected: Dispatch<SetStateAction<number>>;
	continueFromForgeOSPassSubscription: () => void;
	refreshForgeOSPassSubscriptionStatus: () => void;
	openForgeOSPassSubscriptionPage: () => void;
	abortOAuth: () => void;
	abortDeviceCode: () => void;
	resetAuth: () => void;
	refreshCodexCliStatus: () => void;
	startOAuthFlow: (providerId: OnboardingOAuthProviderId) => void;
	startDeviceCodeFlow: (providerId: OnboardingOAuthProviderId) => void;
	selectProvider: (providerId: string) => void;
	loadModelsForProvider: (providerId: string) => void;
	saveForgeOSModelSelection: (modelId: string, modelName: string) => void;
	saveCodexCliConfig: () => void;
	saveByoConfig: () => void;
	saveModelSelection: () => void;
	saveThinkingLevel: (level: ThinkingLevel) => void;
}) {
	useKeyboard((key) => {
		if (input.step === "done") return;

		if (key.ctrl && key.name === "c") {
			input.onExit();
			return;
		}

		if (key.name === "escape") {
			if (input.step === "oauth_pending") {
				input.abortOAuth();
				input.resetAuth();
				input.setStep("menu");
				input.setMenuSelected(0);
				return;
			}
			if (input.step === "device_code") {
				input.abortDeviceCode();
				input.setDeviceUserCode("");
				input.setDeviceVerifyUrl("");
				input.setDeviceError("");
				input.setDeviceStatus("");
				input.setStep("menu");
				input.setMenuSelected(0);
				return;
			}
			if (input.step === "byo_apikey") {
				input.resetByoFields();
				input.setStep("byo_provider");
				return;
			}
			if (input.step === "byo_provider") {
				input.setStep("menu");
				input.setMenuSelected(0);
				return;
			}
			if (input.step === "codex_cli_setup") {
				input.setStep("byo_provider");
				return;
			}
			if (input.step === "forgeos_pass_subscription") {
				input.setStep("menu");
				input.setMenuSelected(0);
				return;
			}
			if (input.step === "forgeos_model") {
				input.setStep("menu");
				input.setMenuSelected(0);
				return;
			}
			if (input.step === "model_picker") {
				if (input.activeProviderId === "forgeos") {
					input.setForgeOSModelSelected(0);
					input.setStep("forgeos_model");
				} else {
					input.setStep("menu");
					input.setMenuSelected(0);
				}
				return;
			}
			if (input.step === "custom_model_id") {
				input.setStep("model_picker");
				return;
			}
			if (input.step === "thinking_level") {
				if (input.activeProviderId === "forgeos") {
					input.setForgeOSModelSelected(0);
					input.setStep("forgeos_model");
				} else {
					input.setStep("model_picker");
					input.loadModelsForProvider(input.activeProviderId);
				}
			}
			return;
		}

		if (input.step === "oauth_pending") {
			if (key.name === "d" && input.oauthProvider === "forgeos") {
				input.abortOAuth();
				input.resetAuth();
				input.startDeviceCodeFlow("forgeos");
			}
			return;
		}

		if (input.step === "device_code") return;

		if (input.step === "forgeos_pass_subscription") {
			const total = input.forgeosPassSubscriptionOptions.length;
			if (total === 0) return;
			if (key.name === "up" || (key.ctrl && key.name === "p")) {
				input.setForgeOSPassSubscriptionSelected((s) =>
					s <= 0 ? total - 1 : s - 1,
				);
				return;
			}
			if (key.name === "down" || (key.ctrl && key.name === "n")) {
				input.setForgeOSPassSubscriptionSelected((s) =>
					s >= total - 1 ? 0 : s + 1,
				);
				return;
			}
			if (key.name === "return" || key.name === "enter") {
				const option =
					input.forgeosPassSubscriptionOptions[
						Math.min(input.forgeosPassSubscriptionSelected, total - 1)
					];
				if (!option) return;
				if (option.value === "subscribe") {
					input.openForgeOSPassSubscriptionPage();
				} else if (option.value === "refresh") {
					if (input.forgeosPassSubscriptionStatus !== "loading") {
						input.refreshForgeOSPassSubscriptionStatus();
					}
				} else if (option.value === "skip") {
					input.continueFromForgeOSPassSubscription();
				} else if (option.value === "back") {
					input.setStep("menu");
					input.setMenuSelected(0);
				}
			}
			return;
		}

		if (input.step === "menu") {
			if (key.name === "up") {
				input.setMenuSelected((s) =>
					s <= 0 ? input.menuOptions.length - 1 : s - 1,
				);
				return;
			}
			if (key.name === "down") {
				input.setMenuSelected((s) =>
					s >= input.menuOptions.length - 1 ? 0 : s + 1,
				);
				return;
			}
			if (key.name === "return") {
				const option = input.menuOptions[input.menuSelected];
				if (!option) return;
				if (isOnboardingOAuthProviderId(option.value)) {
					input.startOAuthFlow(option.value);
				} else {
					input.setStep("byo_provider");
				}
			}
			return;
		}

		if (input.step === "byo_provider") {
			if (key.name === "up" || (key.ctrl && key.name === "p")) {
				input.providerList.moveUp();
				return;
			}
			if (key.name === "down" || (key.ctrl && key.name === "n")) {
				input.providerList.moveDown();
				return;
			}
			if (key.name === "return") {
				const item = input.providerList.selectedItem;
				if (item) input.selectProvider(item.key);
			}
			return;
		}

		if (input.step === "codex_cli_setup") {
			if (key.name === "r") {
				input.refreshCodexCliStatus();
				return;
			}
			if (key.name === "return") {
				input.saveCodexCliConfig();
			}
			return;
		}

		if (input.step === "byo_apikey") {
			if (key.name === "tab") {
				const visible = FIELD_ORDER.filter(
					(k) => input.byoFields[k] !== undefined,
				);
				if (visible.length > 1) {
					const idx = visible.indexOf(input.byoFocusedField);
					const nextIdx = key.shift
						? (idx - 1 + visible.length) % visible.length
						: (idx + 1) % visible.length;
					const next = visible[nextIdx];
					if (next) input.setByoFocusedField(next as ProviderConfigFieldKey);
				}
			}
			return;
		}

		if (input.step === "forgeos_model") {
			const total = input.forgeosEntries.length;
			if (total === 0) return;
			if (key.name === "up" || (key.ctrl && key.name === "p")) {
				input.setForgeOSModelSelected((s) => (s <= 0 ? total - 1 : s - 1));
				return;
			}
			if (key.name === "down" || (key.ctrl && key.name === "n")) {
				input.setForgeOSModelSelected((s) => (s >= total - 1 ? 0 : s + 1));
				return;
			}
			if (key.name === "return") {
				const entry = input.forgeosEntries[input.forgeosModelSelected];
				if (!entry) return;
				if (entry.kind === "model") {
					input.saveForgeOSModelSelection(entry.model.id, entry.model.name);
				} else {
					input.setStep("model_picker");
					input.loadModelsForProvider(input.activeProviderId);
				}
			}
			return;
		}

		if (input.step === "model_picker") {
			if (key.name === "up" || (key.ctrl && key.name === "p")) {
				input.modelList.moveUp();
				return;
			}
			if (key.name === "down" || (key.ctrl && key.name === "n")) {
				input.modelList.moveDown();
				return;
			}
			if (key.name === "return") {
				input.saveModelSelection();
			}
			return;
		}

		if (input.step === "thinking_level") {
			if (key.name === "up" || (key.ctrl && key.name === "p")) {
				input.setThinkingSelected((s) =>
					s <= 0 ? THINKING_LEVELS.length - 1 : s - 1,
				);
				return;
			}
			if (key.name === "down" || (key.ctrl && key.name === "n")) {
				input.setThinkingSelected((s) =>
					s >= THINKING_LEVELS.length - 1 ? 0 : s + 1,
				);
				return;
			}
			if (key.name === "return") {
				const level = THINKING_LEVELS[input.thinkingSelected];
				if (level) input.saveThinkingLevel(level.value);
			}
		}
	});
}

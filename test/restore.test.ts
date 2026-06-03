import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api, Model, ThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ADVISOR_TOOL_NAME } from "../advisor/messages.js";
import { getAdvisorEffort, getAdvisorModel, setAdvisorEffort, setAdvisorModel } from "../advisor/state.js";

interface TestConfig {
	modelKey?: unknown;
	effort?: unknown;
	disabledForModels?: unknown;
}

const restoreMocks = vi.hoisted(() => {
	const state: { config: TestConfig } = { config: {} };
	return {
		state,
		loadAdvisorConfig: vi.fn(() => state.config),
		validateDisabledForModels: vi.fn((value: unknown) => (Array.isArray(value) ? value : [])),
	};
});

vi.mock("../advisor/config.js", () => ({
	isAdvisorEffortSupported: (model: Model<Api>, effort: ThinkingLevel) => {
		if (!model.reasoning) return false;
		const mapped = model.thinkingLevelMap?.[effort];
		if (mapped === null) return false;
		if (effort === "xhigh") return mapped !== undefined;
		return true;
	},
	loadAdvisorConfig: restoreMocks.loadAdvisorConfig,
	parseModelKey: (key: unknown) => {
		if (typeof key !== "string") return undefined;
		const idx = key.indexOf(":");
		if (idx < 1 || idx === key.length - 1) return undefined;
		return { provider: key.slice(0, idx), modelId: key.slice(idx + 1) };
	},
	validateAdvisorEffort: (value: unknown) =>
		["minimal", "low", "medium", "high", "xhigh"].includes(value as string) ? (value as ThinkingLevel) : undefined,
	validateDisabledForModels: restoreMocks.validateDisabledForModels,
}));

import { restoreAdvisorState } from "../advisor/restore.js";

function model(overrides: Partial<Model<Api>> = {}): Model<Api> {
	return {
		id: "gpt-5.5",
		name: "GPT-5.5",
		api: "openai-responses",
		provider: "openai-codex",
		baseUrl: "https://example.invalid",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
		thinkingLevelMap: { xhigh: "xhigh" },
		...overrides,
	};
}

function makePi(activeTools: string[] = []) {
	return {
		getActiveTools: vi.fn(() => activeTools),
		setActiveTools: vi.fn(async (next: string[]) => {
			activeTools.splice(0, activeTools.length, ...next);
		}),
		getThinkingLevel: vi.fn(() => "medium"),
	} as unknown as ExtensionAPI;
}

function makeContext(foundModel: Model<Api> | undefined): ExtensionContext {
	return {
		hasUI: true,
		ui: { notify: vi.fn() },
		modelRegistry: { find: vi.fn(() => foundModel) },
	} as unknown as ExtensionContext;
}

describe("advisor restore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setAdvisorModel(undefined);
		setAdvisorEffort(undefined);
		restoreMocks.state.config = {};
	});

	it("restores persisted model, supported effort, and active tool", async () => {
		const selected = model();
		restoreMocks.state.config = { modelKey: "openai-codex:gpt-5.5", effort: "xhigh", disabledForModels: [] };
		const pi = makePi([]);

		await restoreAdvisorState(makeContext(selected), pi);

		expect(getAdvisorModel()).toBe(selected);
		expect(getAdvisorEffort()).toBe("xhigh");
		expect(pi.setActiveTools).toHaveBeenCalledWith([ADVISOR_TOOL_NAME]);
	});

	it("ignores malformed modelKey without throwing", async () => {
		restoreMocks.state.config = { modelKey: {}, effort: "high" };
		const pi = makePi([ADVISOR_TOOL_NAME]);

		await expect(restoreAdvisorState(makeContext(model()), pi)).resolves.toBeUndefined();

		expect(getAdvisorModel()).toBeUndefined();
		expect(pi.setActiveTools).toHaveBeenCalledWith([]);
	});

	it("does not restore unsupported effort for non-reasoning models", async () => {
		const selected = model({ reasoning: false, thinkingLevelMap: { high: "high" } });
		restoreMocks.state.config = { modelKey: "openai-codex:gpt-5.5", effort: "high" };

		await restoreAdvisorState(makeContext(selected), makePi([]));

		expect(getAdvisorModel()).toBe(selected);
		expect(getAdvisorEffort()).toBeUndefined();
	});
});

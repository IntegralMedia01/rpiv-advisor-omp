import { describe, expect, it } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { isAdvisorEffortSupported, parseModelKey, validateAdvisorEffort } from "../advisor/config.js";
import { validateGuidanceFields } from "../advisor/config-io.js";

function model(overrides: Partial<Model<Api>> = {}): Model<Api> {
	return {
		id: "model",
		name: "Model",
		api: "openai-responses",
		provider: "test",
		baseUrl: "https://example.invalid",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
		...overrides,
	};
}

describe("advisor config validation", () => {
	it("rejects malformed model keys without throwing", () => {
		expect(parseModelKey({})).toBeUndefined();
		expect(parseModelKey("missing-separator")).toBeUndefined();
		expect(parseModelKey("provider:")).toBeUndefined();
		expect(parseModelKey(":model")).toBeUndefined();
		expect(parseModelKey("provider:model")).toEqual({ provider: "provider", modelId: "model" });
	});

	it("validates persisted effort values", () => {
		expect(validateAdvisorEffort("nonsense")).toBeUndefined();
		expect(validateAdvisorEffort(undefined)).toBeUndefined();
		expect(validateAdvisorEffort("high")).toBe("high");
	});

	it("matches Pi effort support semantics", () => {
		expect(isAdvisorEffortSupported(model({ reasoning: false, thinkingLevelMap: { high: "high" } }), "high")).toBe(false);
		expect(isAdvisorEffortSupported(model({ thinkingLevelMap: {} }), "high")).toBe(true);
		expect(isAdvisorEffortSupported(model({ thinkingLevelMap: { high: null } }), "high")).toBe(false);
		expect(isAdvisorEffortSupported(model({ thinkingLevelMap: {} }), "xhigh")).toBe(false);
		expect(isAdvisorEffortSupported(model({ thinkingLevelMap: { xhigh: "xhigh" } }), "xhigh")).toBe(true);
	});

	it("maps legacy auto trigger policy values to required", () => {
		const guidance = validateGuidanceFields({
			triggerPolicy: {
				stuck: "auto",
				highRisk: "required",
				maxPerTurn: 2,
			},
		});

		expect(guidance.triggerPolicy).toMatchObject({ stuck: "required", highRisk: "required", maxPerTurn: 2 });
	});
});

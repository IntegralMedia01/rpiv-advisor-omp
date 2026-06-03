import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api, Message, Model, Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ERR_ADVISOR_COOLDOWN_DETAIL, ERR_EMPTY_RESPONSE_DETAIL } from "../advisor/messages.js";
import { setAdvisorEffort, setAdvisorModel } from "../advisor/state.js";

const runtimeMocks = vi.hoisted(() => ({
	completeSimple: vi.fn(),
	buildSessionContext: vi.fn(),
	convertToLlm: vi.fn((messages: Message[]) => messages),
}));

vi.mock("@earendil-works/pi-ai", () => ({
	completeSimple: runtimeMocks.completeSimple,
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
	buildSessionContext: runtimeMocks.buildSessionContext,
	convertToLlm: runtimeMocks.convertToLlm,
}));

import { executeAdvisor } from "../advisor/execute.js";

const usage: Usage = {
	input: 1,
	output: 1,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 2,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function model(): Model<Api> {
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
	};
}

function userMessage(text: string, timestamp = 1): Message {
	return { role: "user", content: [{ type: "text", text }], timestamp };
}

function advisorCallMessage(timestamp = 2): Message {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id: "call-1", name: "advisor", arguments: {} }],
		api: "openai-responses",
		provider: "openai-codex",
		model: "gpt-5.5",
		usage,
		stopReason: "toolUse",
		timestamp,
	};
}

function advisorResultMessage(timestamp = 3): Message {
	return {
		role: "toolResult",
		toolCallId: "call-1",
		toolName: "advisor",
		content: [{ type: "text", text: "prior advice" }],
		timestamp,
	};
}

function makeContext(sessionId: string, leafIds: string[]): ExtensionContext {
	let leafIndex = 0;
	return {
		modelRegistry: {
			getApiKeyAndHeaders: vi.fn(async () => ({ ok: true, apiKey: "test-key", headers: {} })),
		},
		sessionManager: {
			getEntries: vi.fn(() => []),
			getLeafId: vi.fn(() => leafIds[Math.min(leafIndex++, leafIds.length - 1)]),
			getSessionId: vi.fn(() => sessionId),
			getSessionFile: vi.fn(() => `/tmp/${sessionId}.jsonl`),
		},
	} as unknown as ExtensionContext;
}

function makePi(): ExtensionAPI {
	return { getAllTools: vi.fn(() => []) } as unknown as ExtensionAPI;
}

describe("executeAdvisor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setAdvisorModel(model());
		setAdvisorEffort("xhigh");
		runtimeMocks.convertToLlm.mockImplementation((messages: Message[]) => messages);
	});

	it("blocks an immediate advisor-on-advisor repeat for the same underlying state", async () => {
		runtimeMocks.buildSessionContext
			.mockReturnValueOnce({ messages: [userMessage("diagnose this", 1)] })
			.mockReturnValueOnce({ messages: [userMessage("diagnose this", 1), advisorCallMessage(2), advisorResultMessage(3)] });
		runtimeMocks.completeSimple.mockResolvedValue({
			content: [{ type: "text", text: "first advice" }],
			usage,
			stopReason: "stop",
		});

		const ctx = makeContext("repeat-session", ["leaf-before", "leaf-after"]);
		const first = await executeAdvisor(ctx, makePi(), undefined, undefined);
		const second = await executeAdvisor(ctx, makePi(), undefined, undefined);

		expect(first.details?.errorMessage).toBeUndefined();
		expect(second.details?.errorMessage).toBe(ERR_ADVISOR_COOLDOWN_DETAIL);
		expect(runtimeMocks.completeSimple).toHaveBeenCalledTimes(1);
	});

	it("preserves the empty response error envelope", async () => {
		runtimeMocks.buildSessionContext.mockReturnValue({ messages: [userMessage("empty case", 4)] });
		runtimeMocks.completeSimple.mockResolvedValue({ content: [], usage, stopReason: "stop" });

		const result = await executeAdvisor(makeContext("empty-response-session", ["leaf-empty"]), makePi(), undefined, undefined);

		expect(result.details?.errorMessage).toBe(ERR_EMPTY_RESPONSE_DETAIL);
		expect(result.details?.usage).toBe(usage);
		expect(result.details?.stopReason).toBe("stop");
	});
});

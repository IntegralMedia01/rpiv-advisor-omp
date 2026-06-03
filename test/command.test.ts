import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { NO_ADVISOR_VALUE } from "../advisor/messages.js";

const commandMocks = vi.hoisted(() => ({
	showAdvisorPicker: vi.fn(),
	showEffortPicker: vi.fn(),
	saveAdvisorConfig: vi.fn(),
	setAdvisorModel: vi.fn(),
	setAdvisorEffort: vi.fn(),
	getAdvisorModel: vi.fn(),
	getAdvisorEffort: vi.fn(),
	reconcileAdvisorTool: vi.fn(),
	isExecutorBlocked: vi.fn(),
}));

vi.mock("../advisor-ui.js", () => ({
	showAdvisorPicker: commandMocks.showAdvisorPicker,
	showEffortPicker: commandMocks.showEffortPicker,
}));

vi.mock("../advisor/config.js", () => ({
	isAdvisorEffortSupported: vi.fn(() => true),
	modelKey: (model: { provider: string; id: string }) => `${model.provider}:${model.id}`,
	saveAdvisorConfig: commandMocks.saveAdvisorConfig,
}));

vi.mock("../advisor/handlers.js", () => ({
	reconcileAdvisorTool: commandMocks.reconcileAdvisorTool,
}));

vi.mock("../advisor/policy.js", () => ({
	isExecutorBlocked: commandMocks.isExecutorBlocked,
}));

vi.mock("../advisor/state.js", () => ({
	getAdvisorEffort: commandMocks.getAdvisorEffort,
	getAdvisorModel: commandMocks.getAdvisorModel,
	setAdvisorEffort: commandMocks.setAdvisorEffort,
	setAdvisorModel: commandMocks.setAdvisorModel,
}));

import { registerAdvisorCommand } from "../advisor/command.js";

interface RegisteredCommand {
	handler: (args: string, ctx: ExtensionContext) => Promise<void> | void;
}

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

function makePi(activeTools: string[]) {
	const commands = new Map<string, RegisteredCommand>();
	return {
		registerCommand: vi.fn((name: string, command: RegisteredCommand) => commands.set(name, command)),
		getActiveTools: vi.fn(() => activeTools),
		setActiveTools: vi.fn(async (next: string[]) => {
			activeTools.splice(0, activeTools.length, ...next);
		}),
		getThinkingLevel: vi.fn(() => "medium"),
		_commands: commands,
	} as unknown as ExtensionAPI & { _commands: Map<string, RegisteredCommand> };
}

function makeContext(): ExtensionContext {
	return {
		hasUI: true,
		ui: { notify: vi.fn() },
		modelRegistry: { getAvailable: vi.fn(() => [model()]) },
	} as unknown as ExtensionContext;
}

describe("advisor command", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		commandMocks.saveAdvisorConfig.mockReturnValue(true);
		commandMocks.getAdvisorModel.mockReturnValue(model());
		commandMocks.getAdvisorEffort.mockReturnValue(undefined);
		commandMocks.isExecutorBlocked.mockReturnValue(false);
	});

	it("disables advisor and removes only the advisor tool", async () => {
		const pi = makePi(["advisor", "read"]);
		const ctx = makeContext();
		commandMocks.showAdvisorPicker.mockResolvedValue(NO_ADVISOR_VALUE);

		registerAdvisorCommand(pi);
		await pi._commands.get("advisor")?.handler("", ctx);

		expect(commandMocks.saveAdvisorConfig).toHaveBeenCalledWith(undefined, undefined);
		expect(commandMocks.setAdvisorModel).toHaveBeenCalledWith(undefined);
		expect(commandMocks.setAdvisorEffort).toHaveBeenCalledWith(undefined);
		expect(pi.setActiveTools).toHaveBeenCalledWith(["read"]);
	});
});

/**
 * register — the advisor tool registration: zero-param schema, curated
 * description / promptSnippet / promptGuidelines, and an execute that delegates
 * to executeAdvisor. The guidance overrides are read from persisted config.
 */

import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type GuidanceFields, validateGuidanceFields } from "./config-io.js";
import { loadAdvisorConfig } from "./config.js";
import { executeAdvisor } from "./execute.js";
import { ADVISOR_TOOL_NAME, TOOL_LABEL } from "./messages.js";
import { buildTriggerGuidelines } from "./trigger-policy.js";

const AdvisorParams = Type.Object({});

const ADVISOR_DESCRIPTION =
	"Escalate to a stronger reviewer model for guidance. When you need " +
	"stronger judgment — a complex decision, an ambiguous failure, a problem " +
	"you're circling without progress — escalate to the advisor model for " +
	"guidance, then resume. Takes NO parameters — when you call advisor(), " +
	"your entire conversation history is automatically forwarded. The advisor " +
	"sees the task, every tool call you've made, every result you've seen.";

export const DEFAULT_PROMPT_SNIPPET =
	"Escalate to a stronger reviewer model at phase boundaries: planning, stuck states, high-risk choices, and pre-completion";

const BASE_PROMPT_GUIDELINES: string[] = [
	"Manual control remains available: call `advisor` with no parameters whenever the user explicitly asks for a second opinion or challenge review.",
	"Before calling `advisor`, gather enough evidence for a useful review. Orientation (finding files, fetching sources, reading the error) is not substantive work; committing to a plan, writing, editing, mutating state, or declaring done is.",
	"Make durable progress before pre-completion advice: save the plan, write the file, preserve the result, or commit/push when that is the requested deliverable. If the advisor call is interrupted, durable work must still exist.",
	"Give the advisor's advice serious weight. If a step fails empirically, or primary-source evidence contradicts a claim, adapt; a passing narrow check is not evidence the advice was irrelevant.",
];

export const DEFAULT_PROMPT_GUIDELINES = [...BASE_PROMPT_GUIDELINES, ...buildTriggerGuidelines(undefined)];

function promptGuidelines(guidance: GuidanceFields): string[] {
	const builtIn = guidance.triggerPolicy
		? [...BASE_PROMPT_GUIDELINES, ...buildTriggerGuidelines(guidance.triggerPolicy)]
		: DEFAULT_PROMPT_GUIDELINES;
	return guidance.promptGuidelines ? [...builtIn, ...guidance.promptGuidelines] : builtIn;
}

export function registerAdvisorTool(pi: ExtensionAPI): void {
	const guidance = validateGuidanceFields(loadAdvisorConfig().guidance);
	pi.registerTool({
		name: ADVISOR_TOOL_NAME,
		label: TOOL_LABEL,
		description: ADVISOR_DESCRIPTION,
		promptSnippet: guidance.promptSnippet ?? DEFAULT_PROMPT_SNIPPET,
		promptGuidelines: promptGuidelines(guidance),
		parameters: AdvisorParams,

		async execute(_toolCallId, _params, signal, onUpdate, ctx) {
			return executeAdvisor(ctx, pi, signal, onUpdate);
		},
	});
}

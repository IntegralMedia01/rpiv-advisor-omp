import type { TriggerPolicyAction, TriggerPolicyFields, TriggerPolicyKey } from "./config-io.js";

const DEFAULT_TRIGGER_POLICY = {
	mode: "phase-gated",
	planning: "remind",
	beforeFirstEdit: "remind",
	stuck: "required",
	preDone: "remind",
	highRisk: "required",
	maxPerTurn: 1,
	maxPerPhase: 1,
} as const satisfies Required<TriggerPolicyFields>;

const TRIGGER_LABELS: Record<TriggerPolicyKey, string> = {
	planning: "planning gate",
	beforeFirstEdit: "before-first-edit gate",
	stuck: "stuck gate",
	preDone: "pre-completion gate",
	highRisk: "high-risk gate",
};

function action(policy: TriggerPolicyFields | undefined, key: TriggerPolicyKey): TriggerPolicyAction {
	return policy?.[key] ?? DEFAULT_TRIGGER_POLICY[key];
}

function maxPerPhase(policy: TriggerPolicyFields | undefined): number {
	return policy?.maxPerPhase ?? DEFAULT_TRIGGER_POLICY.maxPerPhase;
}

function maxPerTurn(policy: TriggerPolicyFields | undefined): number {
	return policy?.maxPerTurn ?? DEFAULT_TRIGGER_POLICY.maxPerTurn;
}

function triggerLine(policy: TriggerPolicyFields | undefined, key: TriggerPolicyKey, detail: string): string {
	const configured = action(policy, key);
	if (configured === "off") return `${TRIGGER_LABELS[key]} is disabled by advisor trigger policy.`;
	const prefix =
		configured === "required"
			? "Treat `advisor` as required when threshold is met (model-invoked guidance, not a runtime hook)"
			: "Consider `advisor` when threshold is met";
	return `${prefix} at the ${TRIGGER_LABELS[key]}: ${detail}`;
}

export function buildTriggerGuidelines(policy: TriggerPolicyFields | undefined): string[] {
	if (policy?.mode === "manual") {
		return [
			"Advisor is manual in this session: call `advisor` only when the user asks for it, when you are blocked, or when a high-risk decision needs a stronger reviewer.",
			"Never call `advisor` to decide whether to call `advisor`, and do not call it repeatedly for the same question. After advice, perform at least one concrete research, implementation, or verification step before any second advisor call.",
		];
	}

	const turnLimit = maxPerTurn(policy);
	const phaseLimit = maxPerPhase(policy);
	return [
		"Advisor is phase-gated, not a before/after-every-action hook. Do not call it around routine reads, obvious next steps, every edit/bash command, every fresh tool result, or every response.",
		triggerLine(
			policy,
			"planning",
			"after enough context has been gathered to frame the approach, before committing to a plan or architecture for ambiguous, multi-file, high-risk, or irreversible work. Skip this for trivial reactive tasks.",
		),
		triggerLine(
			policy,
			"beforeFirstEdit",
			"before the first write/edit/destructive command on multi-file, architectural, external-API, data, security, plugin-loading, model-routing, or high-stakes work. Skip when the next step is mechanically dictated by fresh tool output.",
		),
		triggerLine(
			policy,
			"stuck",
			"after two non-converging attempts, contradictory tool outputs, an API/runtime behavior mismatch, unclear root cause after repeated failure, or a strategy change with downstream consequences.",
		),
		triggerLine(
			policy,
			"preDone",
			"after durable output and focused verification exist, before declaring substantive high-impact work complete. Skip this for short answers, pure reads, and tasks with no durable artifact.",
		),
		triggerLine(
			policy,
			"highRisk",
			"before auth/security, persistent data, public API, deployment, destructive git/filesystem operations, OMP core/plugin loading, provider auth, model routing, or irreversible external-system decisions.",
		),
		`Respect cooldowns of ${turnLimit} advisor call per turn and ${phaseLimit} per phase: do not re-call advisor for the same session state, phase, or question unless new empirical evidence contradicts a specific advisor claim or the user asks for another pass.`,
		"Never call advisor to ask whether to call advisor. Never call it directly in response to advisor output; do at least one concrete research, implementation, or verification step first.",
		"The advisor side-call already receives the current branch context and cannot call tools. Do not spawn a fork_agent or subagent merely to consult the advisor.",
	];
}

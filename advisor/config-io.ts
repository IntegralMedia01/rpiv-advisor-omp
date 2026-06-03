import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type TriggerPolicyAction = "off" | "remind" | "required";

export interface TriggerPolicyFields {
	mode?: "manual" | "phase-gated";
	planning?: TriggerPolicyAction;
	beforeFirstEdit?: TriggerPolicyAction;
	stuck?: TriggerPolicyAction;
	preDone?: TriggerPolicyAction;
	highRisk?: TriggerPolicyAction;
	maxPerTurn?: number;
	maxPerPhase?: number;
}

export type TriggerPolicyKey = Exclude<keyof TriggerPolicyFields, "mode" | "maxPerPhase" | "maxPerTurn">;
export interface GuidanceFields {
	promptSnippet?: string;
	promptGuidelines?: string[];
	triggerPolicy?: TriggerPolicyFields;
}

const CONFIG_FILE_MODE = 0o600;


export function loadJsonConfig<T>(path: string): T {
	if (!existsSync(path)) return {} as T;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {} as T;
		return parsed as T;
	} catch (err) {
		console.warn(`pi-advisor-omp: invalid JSON at ${path}, using default ({}) — ${(err as Error).message}`);
		return {} as T;
	}
}

export function saveJsonConfig(path: string, data: unknown): boolean {
	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	} catch {
		return false;
	}
	try {
		chmodSync(path, CONFIG_FILE_MODE);
	} catch {
		// chmod is best-effort on non-POSIX filesystems.
	}
	return true;
}


const TRIGGER_ACTIONS = new Set(["off", "remind", "required"]);
const TRIGGER_KEYS: readonly TriggerPolicyKey[] = ["planning", "beforeFirstEdit", "stuck", "preDone", "highRisk"];

function normalizeTriggerPolicyAction(value: unknown): TriggerPolicyAction | undefined {
	if (value === "auto") return "required";
	return typeof value === "string" && TRIGGER_ACTIONS.has(value) ? (value as TriggerPolicyAction) : undefined;
}

function validateTriggerPolicy(value: unknown): TriggerPolicyFields | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const input = value as Record<string, unknown>;
	const policy: TriggerPolicyFields = {};
	if (input.mode === "manual" || input.mode === "phase-gated") policy.mode = input.mode;
	for (const key of TRIGGER_KEYS) {
		const action = normalizeTriggerPolicyAction(input[key]);
		if (action) policy[key] = action;
	}
	if (Number.isInteger(input.maxPerPhase) && (input.maxPerPhase as number) > 0) {
		policy.maxPerPhase = input.maxPerPhase as number;
	}
	if (Number.isInteger(input.maxPerTurn) && (input.maxPerTurn as number) > 0) {
		policy.maxPerTurn = input.maxPerTurn as number;
	}
	return Object.keys(policy).length > 0 ? policy : undefined;
}
export function validateGuidanceFields(fields: unknown): GuidanceFields {
	if (!fields || typeof fields !== "object") return {};
	const g = fields as Record<string, unknown>;
	const result: GuidanceFields = {};
	if (typeof g.promptSnippet === "string" && g.promptSnippet.length > 0) {
		result.promptSnippet = g.promptSnippet;
	}
	if (
		Array.isArray(g.promptGuidelines) &&
		g.promptGuidelines.length > 0 &&
		g.promptGuidelines.every((s) => typeof s === "string" && s.length > 0)
	) {
		result.promptGuidelines = g.promptGuidelines;
	}
	const triggerPolicy = validateTriggerPolicy(g.triggerPolicy);
	if (triggerPolicy) result.triggerPolicy = triggerPolicy;
	return result;
}

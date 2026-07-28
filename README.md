# OMP Consultant Task Agent

A native Oh My Pi task agent for deliberate, evidence-backed second opinions.

This version does **not** use OMP's Advisor runtime and does **not** need an extension/plugin. The main agent calls `task` with `agent: "consultant"` only when a checkpoint review is useful.

## Behavior

The consultant is:

- **on demand** — no background model calls and no review on every turn;
- **blocking** — its result returns inline before the main agent continues, even when async tasks are enabled;
- **read-only** — it may inspect code, diffs, LSP/AST results, git history, and web sources, but cannot edit or spawn another agent;
- **strong by default** — it resolves through OMP's `@slow` model role and defaults to high reasoning;
- **structured** — it returns one `plan`, `correction`, or `stop` outcome with evidence, next steps, confidence, and focused verification.

The task-agent definition is [` .omp/agents/consultant.md`](.omp/agents/consultant.md).

## Install globally

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

### Windows WSL, Linux, or macOS

```bash
sh scripts/install.sh
```

Both installers respect `PI_CODING_AGENT_DIR`. Without that override, they install to:

```text
~/.omp/agent/agents/consultant.md
```

Then open `/agents` and press `Ctrl+R`, or restart OMP. Confirm that `consultant` appears as an available agent.

### Manual installation

Copy:

```text
.omp/agents/consultant.md
```

to either:

- user-wide: `~/.omp/agent/agents/consultant.md`;
- project-only: `<project>/.omp/agents/consultant.md`.

A project agent overrides a user agent with the same exact name.

## Disable the native OMP Advisor

For the current session:

```text
/advisor off
```

Also set **Enable Advisor** to off in `/settings` so future sessions do not start it. The consultant task agent is independent of `advisor.enabled` and `modelRoles.advisor`.

## Choose the consultant model

The definition defaults to:

```yaml
model: "@slow"
thinking-level: high
```

To use a different model, open `/agents`, select `consultant`, and press `Enter` to set its model override. At invocation time, `effort: "hi"` maps to the highest reasoning level supported by the selected model.

## Call it from the main agent

OMP task agents start with a blank conversation. The main agent must pass a complete, self-contained decision packet rather than assuming the consultant can see the parent transcript.

A natural instruction to the main agent is:

> Before proceeding, use the `consultant` task agent to challenge this decision. Give it the objective, proposed approach, material evidence, constraints, and the exact question it must resolve.

With task batching enabled, the equivalent tool shape is:

```json
{
  "context": "# Goal\nDeliver the requested change safely.\n\n# Constraints\nPreserve the user's explicit requirements and avoid unrelated work.",
  "tasks": [
    {
      "name": "ConsultDecision",
      "agent": "consultant",
      "effort": "hi",
      "task": "# Objective\n...\n\n# Decision needed\n...\n\n# Proposed direction\n...\n\n# Evidence\n...\n\n# Constraints\n...\n\n# Acceptance\nReturn one evidence-backed recommendation before implementation continues."
    }
  ]
}
```

With task batching disabled:

```json
{
  "name": "ConsultDecision",
  "agent": "consultant",
  "effort": "hi",
  "task": "# Objective\n...\n\n# Decision needed\n...\n\n# Proposed direction\n...\n\n# Evidence\n...\n\n# Constraints\n...\n\n# Acceptance\nReturn one evidence-backed recommendation before implementation continues."
}
```

Because the agent declares `blocking: true`, the main agent receives the consultation result in the same `task` call.

## Recommended decision packet

Give the consultant these sections whenever they are relevant:

```markdown
# Objective
What the user ultimately needs.

# Decision needed
The exact plan, architecture, diagnosis, risk, or completion claim to judge.

# Proposed direction
What the main agent intends to do and why.

# Evidence
Files, symbols, diffs, command results, errors, tests, links, and unresolved contradictions.

# Constraints
Explicit user instructions, repository rules, compatibility requirements, safety limits, and non-goals.

# Acceptance
What a useful consultation must decide and what proof is required.
```

For large material, save it to a file and pass a `local://...` reference rather than pasting it into the task.

## When to use it

Use the consultant:

- after enough investigation, before committing to a consequential plan or architecture;
- before the first mutation on multi-file, auth, security, data, deployment, provider-routing, or public-API work;
- after repeated non-converging attempts or contradictory evidence;
- after durable implementation and focused checks, before declaring high-impact work complete;
- before irreversible git, filesystem, deployment, publishing, or external-system actions.

Do not call it for routine reads, obvious mechanical steps, every edit, trivial answers, or immediately after a previous consultation without new evidence.

## Output contract

The consultant returns:

- `outcome`: `plan`, `correction`, or `stop`;
- `guidance`: the concise recommendation;
- `next_steps`: ordered actions for the main agent;
- `confidence`: `0.0` to `1.0`;
- optional `evidence`, `assumptions`, and `verification`.

It raises `correction` or `stop` only when it can identify the failing premise, inspected evidence, impact, and better next action. When the main agent is on track, it returns `plan` without inventing criticism.

## Difference from the old plugin

| Old extension | Native task agent |
|---|---|
| Registered `advisor()` and `/advisor` | Selected through the normal `task` tool |
| Direct side-call with copied parent branch | Blank child session with a self-contained decision packet |
| Reviewer had no tools | Consultant can independently inspect the workspace read-only |
| Plugin-level global state and cooldowns | Normal OMP child-session lifecycle and artifacts |
| Custom model/auth path | Native task-agent model resolution, telemetry, output schema, and `agent://` / `history://` observability |
| Could add prompt overhead to every primary turn | Exists in the task-agent list and runs only when selected |

The previous TypeScript extension source remains in the repository for migration history, but the package metadata no longer registers it as an OMP extension on this conversion branch.

# OMP Consultant Task Agent

A native Oh My Pi task agent for deliberate, evidence-backed second opinions.

This version does **not** use OMP's Advisor runtime and does **not** need an extension/plugin. The main agent calls `task` with `agent: "consultant"` only when a checkpoint review is useful.

## Behavior

The consultant is:

- **on demand** — no background model calls and no review on every turn;
- **blocking** — its first result returns inline before the main agent continues, even when async tasks are enabled;
- **read-only** — it may inspect code, diffs, LSP/AST results, git history, and web sources, but cannot edit or spawn another agent;
- **parent-aware** — it reads the caller transcript through `history://Main` or another supplied `history://<agent-id>` URL;
- **resumable** — after its initial task result, reuse the same allocated agent id through `hub send` so it keeps its own consultation history;
- **strong by default** — it resolves through OMP's `@slow` model role and defaults to high reasoning;
- **structured** — it returns one `plan`, `correction`, or `stop` outcome with evidence, next steps, confidence, and focused verification.

The task-agent definition is [`.omp/agents/consultant.md`](.omp/agents/consultant.md).

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

Copy `.omp/agents/consultant.md` to either:

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

## Parent context: use `history://Main`

OMP task agents begin as separate child sessions. They do **not** receive the parent conversation directly in their initial model context.

The consultant closes most of that gap by reading OMP's live internal transcript URL:

```text
history://Main
```

For a consultant spawned by another subagent, pass that caller's actual id instead:

```text
history://<caller-agent-id>
```

This is preferable to a public `/share` link:

- it stays inside the running OMP process;
- it reflects the live transcript rather than a published snapshot;
- it works for live, idle, parked, and on-disk agent transcripts;
- it avoids uploading the session;
- it gives the consultant concise model-readable history.

It is still **not a real fork**. Reading `history://Main` inserts transcript text into the consultant's own child conversation. It does not share the main agent's provider session or prompt-cache key.

## First consultation

The main agent should include the transcript URL and a focused decision packet.

With task batching enabled:

```json
{
  "context": "# Goal\nDeliver the requested change safely.\n\n# Parent transcript\nhistory://Main\n\n# Constraints\nPreserve the user's explicit requirements and avoid unrelated work.",
  "tasks": [
    {
      "name": "Consultant",
      "agent": "consultant",
      "effort": "hi",
      "task": "# Objective\n...\n\n# Decision needed\n...\n\n# Proposed direction\n...\n\n# New evidence\n...\n\n# Acceptance\nReturn one evidence-backed recommendation before implementation continues."
    }
  ]
}
```

With task batching disabled:

```json
{
  "name": "Consultant",
  "agent": "consultant",
  "effort": "hi",
  "task": "# Parent transcript\nhistory://Main\n\n# Objective\n...\n\n# Decision needed\n...\n\n# Proposed direction\n...\n\n# New evidence\n...\n\n# Acceptance\nReturn one evidence-backed recommendation before implementation continues."
}
```

Because the agent declares `blocking: true`, the first consultation result returns in the same `task` call.

## Reuse the same consultant

After the first result, the child stays available as an OMP agent. Keep the allocated id returned by the task tool, normally `Consultant` on first use.

For a later checkpoint, do **not** call `task` again. Send a new turn to the same consultant:

```json
{
  "op": "send",
  "to": "Consultant",
  "message": "Re-review the decision using the latest parent transcript at history://Main. New evidence: ...",
  "await": true
}
```

This preserves:

- the consultant's earlier reasoning and advice;
- its child-session conversation;
- its stable agent identity;
- the best chance of reusing that child's own provider prefix/cache.

Direct `hub send` also revives the agent after OMP parks it. The task tool itself has no resume parameter.

Calling `task` again with `name: "Consultant"` does **not** resume it. OMP allocates another id such as:

```text
Consultant-2
Consultant-3
```

Those are fresh child sessions with separate context and cache identity.

## Recommended decision packet

Give the consultant these sections whenever relevant:

```markdown
# Parent transcript
history://Main

# Objective
What the user ultimately needs.

# Decision needed
The exact plan, architecture, diagnosis, risk, or completion claim to judge.

# Proposed direction
What the main agent intends to do and why.

# New evidence
Files, symbols, diffs, command results, errors, tests, links, and unresolved contradictions.

# Constraints
Explicit user instructions, repository rules, compatibility requirements, safety limits, and non-goals.

# Acceptance
What a useful consultation must decide and what proof is required.
```

For large non-session material, save it to a file and pass a `local://...` reference rather than pasting it into the task.

## How this compares with `/tan`

`/tan` is currently OMP's closest implementation of a true forked worker:

- it forks the persisted main session and receives the full parent transcript;
- it inherits the parent's exact prompt-cache key;
- it uses a distinct provider session id;
- it keeps the same model, thinking level, system prompt, and active tools as the parent;
- it runs as a background job.

That makes `/tan` better for **parent-prefix cache reuse**, but less suitable as a reusable consultant abstraction:

- it is an interactive slash command, not a task-agent type the main model can select through `task`;
- it uses the parent's model instead of a dedicated consultant model;
- it inherits the parent's broad tools rather than this read-only contract;
- it does not return the consultant's structured blocking result through the original task call;
- each `/tan` invocation creates another fork.

The ideal future OMP primitive would combine both designs: a `task` spawn that can fork the current resolved session, inherit the parent prompt-cache key, and then apply a selected task-agent model, system prompt, and tool restrictions.

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
| Direct side-call with copied parent branch | Child reads the live parent transcript via `history://Main` |
| Reviewer had no tools | Consultant can independently inspect the workspace read-only |
| Plugin-level global state and cooldowns | Normal OMP child lifecycle; reuse through `hub send` |
| Custom model/auth path | Native task-agent model resolution, telemetry, structured output, `agent://`, and `history://` |
| Could add prompt overhead to every primary turn | Exists in the task-agent list and runs only when selected |

The previous TypeScript extension source remains in the repository for migration history, but the package metadata no longer registers it as an OMP extension on this conversion branch.

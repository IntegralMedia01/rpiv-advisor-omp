# pi-advisor-omp

OMP-compatible fork of `@juicesharp/rpiv-advisor`.

## What it does

`pi-advisor-omp` adds an `advisor()` tool and `/advisor` command. The tool sends the current conversation branch to a configured stronger reviewer model through a direct side-call, with tools disabled for the reviewer.

It is not a before/after-every-action hook. The advisor should be used at phase boundaries where second judgment matters:

- after enough context has been gathered, before committing to a plan or architecture;
- before the first write/edit/destructive command on multi-file, model-routing, plugin-loading, data, security, or other high-stakes work;
- when stuck after repeated failures or contradictory evidence;
- before declaring substantive work done, after durable output and focused verification exist;
- before irreversible external-system, deployment, destructive git/filesystem, auth, provider, or public API decisions.

## Claude Code ideas carried into this fork

The trigger design borrows Claude Code's fork/subagent shape without copying its runtime model:

- escalation is model-invoked instead of blindly automatic;
- context is branch-copied for cache locality;
- tool definitions stay disabled for the reviewer to avoid recursive tool chains;
- trigger policy values are prompt guidance, not lifecycle hooks: `required` means the executor is instructed to call `advisor()` at that gate, but OMP does not force-run the tool before an action;
- prompt guidance makes the reviewer a challenge reviewer, not a stricter linter;
- runtime guards reject nested advisor calls and repeated successful calls for the same session state.

## Configuration

Run `/advisor` in OMP and select a reviewer model and effort. For JJ's OMP setup, the recommended reviewer is:

```json
{
  "modelKey": "openai-codex:gpt-5.5",
  "effort": "xhigh"
}
```

Safe trigger policy example:

```json
{
  "disabledForModels": [
    { "model": "openai-codex:gpt-5.5", "minEffort": "high" }
  ],
  "guidance": {
    "triggerPolicy": {
      "mode": "phase-gated",
      "planning": "remind",
      "beforeFirstEdit": "remind",
      "stuck": "required",
      "preDone": "remind",
      "highRisk": "required",
      "maxPerTurn": 1,
      "maxPerPhase": 1
    }
  },
  "modelKey": "openai-codex:gpt-5.5",
  "effort": "xhigh"
}
```


Trigger guidance is registered when the plugin loads. After editing `guidance.triggerPolicy` by hand, restart or reload OMP before expecting the model prompt to reflect it. Legacy configs using `"auto"` are accepted and treated as `"required"`; new configs should use `"required"` so nobody mistakes it for a runtime hook.
Configuration is persisted at `~/.config/rpiv-advisor/advisor.json`, matching upstream.

## Important behavior

- `/advisor` configures the reviewer model; it does not itself review work.
- `advisor()` takes no parameters.
- The reviewer receives the current branch context plus tool inventory, but `tools: []` prevents it from calling tools.
- The plugin blocks advisor availability for configured executor model/effort combinations.
- A nested advisor call returns an error instead of launching another reviewer call.
- After a successful advisor response, a second advisor call for the same session state returns a cooldown error; take a concrete research, implementation, or verification step first.

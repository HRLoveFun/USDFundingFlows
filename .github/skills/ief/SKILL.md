---
description: "**WORKFLOW SKILL** — Run a large iterative project under IEF v0.2 (Iterative Execution Framework). USE FOR: planning multi-phase work that exceeds a single conversation's context window; enforcing decision/risk separation; running quality gates and drift triage; managing scope changes safely; running retrospectives that feed back into the framework. INVOKES: file-system tools to read/write `.ief/` artifacts; the user-level prompts /ief-bootstrap, /ief-step, /ief-verify, /ief-retro. DO NOT USE FOR: single-step tasks; quick fixes; conversational Q&A — those belong in the default agent."
---

# IEF — Iterative Execution Framework (Skill)

This skill is a **demo / project-local pointer** to the canonical framework at `~/dev/ief-core/`. It exists to:
1. Make the framework discoverable inside this repo.
2. Pin which `ief-core` version this project expects.
3. Provide a quick-start for collaborators.

> The single source of truth is `~/dev/ief-core/README.md` (v0.2.0). Do **not** duplicate framework content here — read directly from `ief-core/`.

## Pinned framework version
- Expected: `ief-core` v0.2.0
- Verify: `cat ~/dev/ief-core/VERSION`

## Quick start

| Phase | Trigger | Reads |
|---|---|---|
| 0 — Bootstrap | `/ief-bootstrap` | `~/dev/ief-core/workflows/bootstrap.md` |
| 1 — Planning | `/ief-step` (after spec freeze) | `~/dev/ief-core/workflows/planning.md` |
| 2 — Iteration | `/ief-step` per Step | `~/dev/ief-core/workflows/iteration.md` |
| Verify | `/ief-verify` | `~/dev/ief-core/checklists/quality_gate.md` |
| 3 — Finalization | `/ief-step` at last Phase end | `~/dev/ief-core/workflows/finalization.md` |
| 4 — Retrospective | `/ief-retro` | `~/dev/ief-core/workflows/retrospective.md` |

## Project artifacts (after Phase 0)
```
USDFundingFlows/
└── .ief/
    ├── spec.md         (frozen, versioned)
    ├── plan.md
    ├── state.md
    ├── decisions.md    (committed choices)
    ├── risks.md        (open uncertainties — separate ledger)
    ├── handoff.md      (overwritten each Step)
    └── lessons.md      (Phase 4 only)
```

## User-driven nodes (must not auto-pass)
① spec freeze · ② plan approval · ③ phase acceptance · ④ final sign-off · ⑤ drift route / scope decision · ⑥ lesson annotation & rollback.

## When to load this skill
- The user says "use IEF" / "iterative framework" / "bootstrap a plan" / "run a retro".
- The repo contains a `.ief/` directory and the user is continuing work.
- The user is starting a multi-phase project that risks context-window exhaustion.

## When NOT to load this skill
- Single-step coding tasks.
- Conversational Q&A.
- Trivial fixes that fit in one turn.

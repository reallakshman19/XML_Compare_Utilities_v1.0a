# Repository Agent Instructions

This file is the canonical policy for the repository. Tools that discover
`.agents/AGENTS.md` must follow its pointer back to this file.

The repository—not a chat session—is the durable source of work state. These rules apply to **all contributors and agents**: ChatGPT, Codex, Claude, Cursor, Copilot, Gemini, local agents, scripts acting as agents, and humans.

Canonical cross-repository delivery protocol:

`reallaksh19/Common/skills/engineering-pr-delivery/`

## Universal Engineering Delivery and Handover

### Continuous handover invariant

Assume the active agent may disappear, lose context, become incapable, or be replaced after any meaningful action.

At every durable checkpoint, another qualified agent must be able to recover the mission, current truth, partial work, evidence, risks, authority boundaries, validation state, and exact next action from repository + PR artifacts without chat history.

No essential technical state may exist only in private reasoning or conversation history.

### Live grounding before mutation

Before changing production or engineering-sensitive files, establish live repository/PR truth where available: current base/main SHA, WIP/branch/PR identity, PR head and merge base, actual changed files/commits, current checks/reviews, source task, predecessor/follow-on PRs, active overlapping work, and base drift.

Live mutable repository state overrides stale reports and prior conversation.

### Durable WIP/PR identity

Before PR allocation use a unique identity:

```text
WIP-<short-id>
agents/WIP-<short-id>_workreport.md
```

Do not use one shared `PR_PENDING_workreport.md` in a multi-agent repository.

After PR allocation use:

```text
agents/PR<NUMBER>_workreport.md
```

The work report must remain recovery-first and continuously preserve mission/scope, current implementation/partial work, active findings/risks/decisions/questions, current hypothesis and falsifier, authority/invariants, validation PASS/FAIL/NOT_RUN, changed-file ledger, review/check state, highest risk, exact work location, and one executable `EXACT_NEXT_ACTION`.

The existing `.agent-worklogs/` patch ledger remains required by this repository and supplements—not replaces—the PR work report.

### Engineering-critical takeover begins READ_ONLY

For work affecting topology/CAD authority, XML engineering semantics, geometry transforms, engineering exports, piping/model data, or other engineering-sensitive behavior, an incoming agent begins takeover with:

```text
TAKEOVER_AUTHORITY = READ_ONLY
```

Before production mutation it must independently re-ground, reconcile the prior report against the actual PR, inspect critical code/tests/evidence, classify stale/contradicted/inherited facts, complete repository-specific Appendix A qualification, and decide whether to `CONTINUE`, `QUARANTINE`, `SALVAGE_PARTIAL`, or `SUPERSEDE`.

Do not grant implementation authority because an agent claims expertise.

### Appendix A — Implementation Takeover Qualification

Appendix A is an implementation authorization gate, not a theory quiz.

Normally require:

```text
A1 Production Trace
A2 Current Failure Isolation
A3 Authority / Invariant
A4 Independent Validation
A5 Next-Commit / Minimal Patch
```

A question is invalid if it can be answered correctly without opening the current repository, PR diff, tests, evidence, or work report.

Prefer `trace`, `reproduce`, `calculate`, `isolate`, `predict`, `falsify`, `compare`, `prove`, `reconcile`, and exact patch-boundary tasks over generic `define`/`describe`/`explain` prompts.

For engineering-critical takeover, default qualification is:

```text
total >= 92/100
minimum per challenge >= 17/20
```

Fabricated repository evidence, unsafe engineering claims, incorrect authority assumptions, or validation gaming may cause immediate failure regardless of score.

### Multi-agent coordination

Before implementation and before each new stage inspect other active PRs/WIPs for exact-file overlap, path-prefix overlap, topology/CAD/engineering authority overlap, dependency/stacked-PR relationships, and base drift.

Classify:

```text
SAFE
COORDINATION_REQUIRED
BLOCKED_BY_ACTIVE_CLAIM
UNKNOWN
```

No exact-file overlap does not prove semantic/authority independence.

### Validation integrity

Every material check must distinguish:

```text
STATUS      = PASS | FAIL | NOT_RUN | NOT_APPLICABLE
OBSERVATION = execution/inspection/inference basis
ORACLE      = implementation-coupled or independent authority class
```

Never weaken tolerances merely because a test fails, replace independent expected values with production output, change implementation and oracle together and call the result independent, delete difficult benchmarks to obtain green status, hard-code fixture answers into production, silence fail-closed behavior, or claim `NOT_RUN` as `PASS`.

### Damaged PRs and incapable agents

Do not preserve a PR because of sunk effort. If the work report cannot explain the diff, authority is unclear, commits cannot be classified, expected values changed with implementation, or conflict resolution requires guessing engineering intent, quarantine and assess salvage.

Valid outcomes:

```text
CONTINUE
SALVAGE_PARTIAL
SUPERSEDE
ABANDON
```

Preserve known-good commits, benchmarks, independent evidence, decisions, invariants, patch ledgers and provenance even when the implementation PR is superseded.

### AUTO MODE — autonomous phase execution

The exact owner keyword `AUTO MODE` sets:

```text
EXECUTION_MODE = AUTO
AUTO_STATE = RUNNING
SCOPE_AUTHORITY = LOCKED_TO_APPROVED_MISSION
PHASE_PROGRESSION = AUTO
MERGE_AUTHORITY = OWNER_ONLY
```

AUTO MODE authorizes automatic phase progression through the approved plan. It does not authorize scope expansion, topology/CAD/XML authority changes beyond approved scope, switching runtime/writer/canvas, weakening validation, destructive actions, or merge.

For each phase, preserve the existing `.agent-worklogs/` and backup requirements, record the phase plan before product-file edits, implement only the approved phase, validate, refresh module patches/checksums/work report/status/claims/Appendix A as needed, create a durable checkpoint, evaluate hard stops, and continue automatically when none applies.

Routine phase completion is not a reason to ask `Would you like me to continue?`.

Stop AUTO when continuing requires an unapproved change to topology/CAD authority, XML engineering semantics, geometry-transform authority, piping/model data authority, runtime/writer/canvas selection, persistence/export semantics, or any protected engineering source of truth.

If repeated attempts do not narrow uncertainty, if safe selective undo can no longer be proven, or if the agent cannot state a concrete hypothesis, falsifier, next isolating experiment, and protected invariants, stop product mutation and set:

```text
PR_RECOVERY_STATE = TAKEOVER_REQUIRED
TAKEOVER_AUTHORITY = READ_ONLY
AUTO_STATE = TAKEOVER_REQUIRED
```

Refresh the work report, patch ledger, and Appendix A for immediate takeover.

`AUTO MODE` never implies `AUTO MERGE`; merge remains owner-only unless separately and explicitly authorized.

### Merge discipline

- One coherent assignment per PR unless the owner explicitly changes scope.
- Do not silently broaden scope.
- Explain every changed file before closure.
- Do not modify workflow files unless explicitly authorized.
- Keep the PR handover-ready while waiting for review/merge.
- **Never merge without explicit owner authorization.**

## Engineering Principles

- Keep changes simple, explicit, scoped, and easy to reason about.
- Reuse existing logic before adding abstractions; follow DRY, KISS, and YAGNI.
- Fix root causes, preserve unrelated work, and match established repository style.
- Write comments in English and document inputs, outputs, behavior, and explicit fallbacks close to the code.
- Prefer functional design, pure functions, immutable data, strict types, and small single-purpose functions.
- Use classes only for connectors, adapters, and external interfaces.
- Raise specific, actionable errors. Do not silently fail, hide errors, or add unrequested fallbacks.
- Inspect installed dependency source when behavior is unclear; keep dependencies project-managed.

## Common Work Pack Implementation Standards

Every coding Work Pack must enforce all of the following:

- Keep every new JavaScript file under 300 lines. Split existing files where possible only when they are edited, and always back up an existing file before editing it.
- Keep every function under 40 lines where practical.
- Use named exports only; do not add default exports.
- Prefer pure functions where practical.
- Do not add default or hidden mocks.
- Do not add shims or polyfills.
- Avoid mutation-heavy design; prefer immutable patterns.
- Do not switch the runtime, writer, or canvas unless the user explicitly approves it.
- Do not create generated snapshot or data churn unless it is explicitly part of the mission.
- Do not perform broad refactors outside the assigned Work Pack.
- Every PR must deliver usable capability, a UI action, an artifact, a measurable behavior improvement, or a measurable export improvement.
- Do not leave lint errors, dangling code, or unused code. Check this every time.

## Ad-hoc Task Patch Ledger

Every agent task that changes repository files, including a small ad-hoc task, must leave a module-wise local change ledger that another master agent can read and selectively undo.

### Required local structure

```text
.agent-worklogs/<YYYYMMDD_HHmm>_<task-slug>/
  manifest.md
  modules/
    <module-slug>.md
    <module-slug>.patch
```

- Keep `.agent-worklogs/` local and Git-ignored. Preserve it until the work is committed and handed off, or a master agent explicitly removes it.
- Before editing, inspect recent manifests for overlapping files and create a unique task directory.
- Write `manifest.md` before the first product-file edit. Record the request, agent/task identifier, start time, filesystem baseline, pre-existing dirty files, intended scope, and module plan. Version-control status may be included as optional context but must never define the baseline.
- Back up every existing target file using the repository backup rule. Record each backup ID or filename and its pre-edit SHA-256 in the relevant module log.
- Group changes by functional module, not merely by file extension or command batch. Use one module log and patch per independently reversible change group.
- Generate each `.patch` directly from the task's pre-edit snapshot to the final file state. Never derive it from `HEAD`, a commit, a branch, the index, or staged content. The ledger must work without a Git repository and remain valid after any history rewrite.
- `git diff --no-index --binary -- <pre-edit-copy> <current-file>` may be used only as a history-independent binary-safe comparison engine; exit code 1 means differences were found and is expected. An equivalent no-index diff tool is acceptable.
- For a newly created file, record that no pre-image exists, its final SHA-256, and that undo means deleting only that exact file after verifying its checksum and confirming no later agent changed it.

Each `manifest.md` must contain this index:

```markdown
| Module | Status | Planned | Did | Validation | Patch | Backups | Undo |
|---|---|---|---|---|---|---|---|
```

Each `modules/<module-slug>.md` must use these headings:

```markdown
# Module: <name>
## Planned
## Did
## Technical details
## Files and symbols
## Upstream/downstream impact
## Validation
## Patch and backups
## Undo
## Remaining risks or follow-ups
```

- Under **Planned**, state the intended behavior and boundaries before implementation.
- Under **Did**, state the actual behavior changed, including deviations from the plan.
- Under **Technical details**, record algorithms, contracts, data flow, state transitions, fallbacks, and important implementation decisions precisely enough for another agent to reason about the patch.
- Under **Files and symbols**, list every changed file and the functions, classes, selectors, routes, schemas, or configuration keys affected.
- Under **Upstream/downstream impact**, identify callers, consumers, stored data, exports, deployment paths, and compatibility concerns checked.
- Under **Validation**, record exact commands, input basis, expected result, actual result, and any tests not run. Label simulated evidence `[SIMULATED]` and ungrounded conclusions `[GUESSED]`.
- Under **Patch and backups**, link the module patch, list backup IDs/files, and record before/after SHA-256 values.
- Under **Undo**, give file-specific reversal steps based only on snapshots, checksums, and recorded hunks. Require a current checksum check first; restore the pre-edit backup or reverse only the recorded hunks. Never use reset, checkout, revert, or other history-based recovery; never overwrite later changes or undo unrelated dirty work.
- Update the module log after every material change batch and refresh its patch before handoff. Mark status as `planned`, `in_progress`, `completed`, or `blocked`; do not mark completed while required validation or undo data is missing.
- Do not place credentials, tokens, private data, or large generated artifacts in the ledger. Record safe references and checksums instead.
- Before modifying a dirty file touched by another task ledger, read its manifest and preserve its baseline. If selective undo is no longer safe because later changes overlap, stop and escalate instead of guessing.

## Backup and Git Safety

- Before editing any existing file, run `node utils/backup.cjs save <path> "Plan to ..."`.
- The command must create a timestamped binary-safe backup, a timestamped plan-log entry, and a SHA-256 checksum. Never overwrite an earlier backup or substitute a manual copy.
- `.backups/` is local recovery state. Never stage or commit it; clones do not receive it.
- See `docs/backup.md` for verification, restore, and safe pull procedures.
- Before pulling or merging with local product changes, create a preservation branch and commit those changes. Backups supplement Git; they do not replace it.
- Never use destructive Git commands or discard unrelated working-tree changes.

## Workflow

- Inspect the repository and active instructions before editing; prefer `rg` for searches.
- Do not switch runtimes, writers, canvases, deployment models, or hosting without explicit approval.
- Avoid generated snapshot or data churn unless it is part of the requested work.
- Keep refactors surgical. Ask before a major refactor or a risky cross-module change.
- Use non-interactive commands and non-interactive diffs.
- Keep imports at the top and remove unused or dangling code.
- Validate with the repository's existing lint, integration, end-to-end, or smoke strategy.
- Prefer real project data. Label ungrounded simulated results `[SIMULATED]` and solutions lacking upstream/downstream checks or real-world data `[GUESSED]`.

## Testing and Delivery

- Define input basis, expected output, and modules under test before a requested test run.
- Prefer a small number of real integration, end-to-end, or smoke tests; add unit tests only for stable pure transformations when useful.
- Avoid mocks when practical real calls exist, and never add tests only to increase coverage.
- Every delivered change must provide usable capability or measurable behavioral/export improvement.
- Do not submit an audit-only change as completed product work.
- Verify deployment compatibility when routing, hosting, or deployment is affected.

## Grounding and Architecture

- Treat `??`, `how?`, `why?`, `how come`, and `Think` as prompts to restate the problem and re-check assumptions, constraints, failure modes, and downstream effects.
- For complex, recurring, or cross-module changes, explain invariants, edge cases, and architectural impact before editing.
- Use `implementation_plan.md` only when the change is large enough to justify it.

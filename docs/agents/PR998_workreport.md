# PR998 — CII multi-base UI authority fix + concept-note refresh

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_REVIEW_AND_OWNER_MERGE_DECISION
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL_UI_AUTHORITY_SEAM
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 / owner instruction "implement fix in auto mode" + concept-note refresh
PR: 998
BRANCH: agent/cii-multi-base-ui-fix
STACKED_BASE: PR997 / agent/cii-fullscreen-anchor-evidence-ui@3b772956dbd4407f29df66789bae22e5ade112b1
MAIN_AT_FINAL_GROUNDING: df19d1834459f486fddd77eaec4297767ef83c6b
REPORT_BASIS_HEAD: d09b7e4b5e0e318f81db390e29376890c2e21be9
EXECUTION_MODE: AUTO
AUTO_STATE: COMPLETE
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
PHASE_PROGRESSION: COMPLETE
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: HANDOVER / MERGE DECISION
GROUNDING_EPOCH: GE-001 / 2026-08-19
CURRENT_BLOCKER: NONE FOR APPROVED IMPLEMENTATION; COMPLETE-CHECKOUT UI/BROWSER SUITES REMAIN NOT_RUN_ENVIRONMENT
EXACT_NEXT_ACTION: re-ground PR997/PR998 heads immediately before owner-authorized merge; integrate PR997 before or together with stacked PR998
```

## Handover in 60 Seconds

PR997 introduced the full-screen Method A/B evidence UI but still delegated each Base Anchor card to the legacy flat anchor input. That could collapse several independently stable piping regions into one legacy anchor set even though PR995 already supports explicit independent `baseLoops[]`.

PR998 closes that seam:

```text
engineer selects one or more method-qualified cards
        ↓
Method A -> entire validated local bestBase.anchorPairs
Method B -> one qualified pair loop
A+B      -> TWO independent loops
        ↓
dedupe the same Method-A base only
        ↓
baseLoops[]
        ↓
createCiiWorkspacePreview()
        ↓
OR_WITH_CONFLICT_VETO
```

Manual/LANDMARK fallback is separate. Contradictory B claims are deliberately preserved for the existing core conflict veto. `docs/CIIcompareconceptnote.md` is refreshed to the current Method A/B/OD-scaled/multi-base architecture.

---

# 1. Final live ground truth

Observed before final report commit:

```text
main: df19d1834459f486fddd77eaec4297767ef83c6b
PR997: open / draft / mergeable / unmerged
PR997 head: 3b772956dbd4407f29df66789bae22e5ade112b1
PR998: open / draft / mergeable / unmerged
PR998 stacked base: agent/cii-fullscreen-anchor-evidence-ui
PR998 report-basis head: d09b7e4b5e0e318f81db390e29376890c2e21be9
PR998 stacked compare: 0 behind PR997
changed files: 11 expected / 11 actual / 0 unexplained
reviews: none
review threads: none
status checks on observed pre-report head: none
PR workflow runs on observed pre-report head: none
```

Live GitHub state overrides this snapshot. The report commit itself advances PR998 head; use `REPORT_BASIS_HEAD`, not an impossible self-referential report-head rule.

---

# 2. Mission / acceptance result

## Mission

Make the full-screen Base Anchor UI preserve the independent local Method A/B architecture through the actual production preview input, and refresh the concept note to that same authority model.

## Acceptance result

| Requirement | Result |
|---|---|
| Method-A selection carries full validated local base | IMPLEMENTED |
| A+B selection creates two independent loops | IMPLEMENTED |
| Same Method-A base selected through multiple cards dedupes once | IMPLEMENTED |
| Distinct local Method-A bases remain independent | IMPLEMENTED |
| Conflicting B claims survive to core arbitration | IMPLEMENTED |
| LANDMARK_ONLY cannot silently become Method B | IMPLEMENTED |
| Qualified base mode and manual mode do not silently mix | IMPLEMENTED |
| Base-selection change invalidates stale review/export | IMPLEMENTED |
| Review refresh retains bound explicit loops | IMPLEMENTED |
| Concept note reflects x*SOURCE_OD and exact weight basis | IMPLEMENTED |
| Writer/parser/converter/Method-A/B kernels remain unchanged | VERIFIED BY STACKED DIFF |

---

# 3. Root cause and falsifier

## ISS-998-01 — PR997 acceptance was presentation-correct but authority-wrong

PR997 rendered canonical `basisMethod`, `methodA`, `methodB`, tolerance and weight evidence. However its new card action delegated to the old hidden `Accept base anchor` button, which populated the two flat legacy text inputs.

The legacy Analyze path then supplied:

```text
anchorPairs[]
```

instead of:

```text
baseLoops[]
```

For several revised local regions with transforms `T1`, `T2`, `T3`, that behavior could reconstruct the single-base assumption we had already removed from the core.

## Falsifier

The fix fails if either occurs:

```text
select two different Method-A baseIds
  -> preview receives one flat anchorPairs list
```

or:

```text
select A+B candidate
  -> preview receives one fused pseudo-loop instead of A OR B
```

The projection regression explicitly guards both boundaries.

---

# 4. Final production behavior

## 4.1 `cii-workspace-base-loop-selection.js`

Pure deterministic UI-to-core projection.

### Method A

A suggestion contributes Method A only when:

```text
basisMethod = METHOD_A_SPATIAL | METHOD_A_AND_B
methodA.status = READY
methodA.bestBase exists
bestBase has >=3 valid anchor pairs
```

Output:

```js
{
  method: 'METHOD_A_SPATIAL',
  baseId: bestBase.baseId,
  anchorPairs: bestBase.anchorPairs
}
```

The clicked card pair alone is never used as a 3D Method-A basis.

### Method B

A suggestion contributes Method B only when:

```text
basisMethod = METHOD_B_NETWORK | METHOD_A_AND_B
methodB.status = READY
```

Because `basisMethod` is produced only after PR996 mutual-best/winner-gap qualification, a locally READY run basis on a `LANDMARK_ONLY` or A-only candidate does not gain Method-B authority here.

### A+B

```text
METHOD_A_AND_B
  -> Method-A loop
  OR Method-B loop
```

No score summation and no fused method.

### Dedupe / conflict policy

```text
same Method-A baseId selected through multiple cards -> one A loop
same Method-B SOURCE/TARGET pair repeated          -> one B loop
same SOURCE with different TARGET B claims         -> preserve all
```

The UI never hides a true identity conflict from core arbitration.

## 4.2 `cii-workspace-shell.js`

The legacy shell now optionally consumes `options.getBaseLoops()`.

Analyze logic:

```text
if selected qualified loops exist:
    remove stale anchorPairs
    send baseLoops
else:
    remove stale baseLoops
    parse manual anchor fields
    send legacy anchorPairs
```

The existing `run()` function stores the selected mode in `baseInput`. Therefore subsequent review-ledger refresh reuses the same explicit `baseLoops` rather than recomputing from current UI text.

`invalidateExternal()` gives the wrapper one narrow ability: invalidate stale current/review/export state when accepted bases change. It does not modify matching or Writer authority.

## 4.3 `cii-workspace-engineering-ui.js`

The wrapper owns only engineer selection state:

```text
inspection
selected suggestion keys
```

It projects that state through the pure helper above.

User-visible rules:

- several method-qualified cards may stay selected;
- a tray shows loop count and A/B split;
- tray states `OR + conflict veto`;
- selected cards remain visibly selected;
- A+B card states that it creates two independent OR loops;
- selecting qualified bases clears manual text;
- typing manual anchors clears qualified selection;
- file change / reinspection clears stale selected bases;
- LANDMARK_ONLY delegates only to separate manual fallback.

DOM control contract uses the repository namespace:

```text
data-ciiw-selection-key
```

not a browser-only generic dataset name, so existing fake-DOM lifecycle tooling can observe the same control.

## 4.4 Concept note

`docs/CIIcompareconceptnote.md` was rewritten from its obsolete PR989-era baseline.

It now documents:

- fixed-field custody;
- identity/delta/Writer separation;
- no global node-number-offset identity;
- `T = x * SOURCE_OD`, default `x=2`;
- SOURCE minimum-positive incident OD and TARGET-OD invariance;
- independent local transforms;
- `OR_WITH_CONFLICT_VETO`;
- exact Method-A residual qualification and weight `35/25/20/10/10`;
- Method-A three-anchor auto REVIEW cap;
- Method-B two-axis hard gate;
- OD-scaled run length and angular-equivalent displacement;
- compatible 3D weight `40/20/15/15/10`;
- A+B corroboration as two loops;
- explicit engineer selection -> `baseLoops[]`;
- manual fallback separation;
- Base Anchor Method A/B versus downstream row M1/M2 distinction;
- real `SOURCE 3.CII -> TARGET 3-1.CII` benchmark;
- Compare/Delta/Transfer UX direction;
- Writer 1A/1B/2/3 roadmap;
- validation and anti-gaming rules.

---

# 5. Authority / negative assurance

## Preserved engineering invariants

```text
OD identity weight = 0
TARGET OD tolerance authority = 0
node-number offset authority = 0
Method B minimum independent run gate = 2
Method A minimum non-collinear registration pairs = 3
3-pair automatic Method-A confidence remains REVIEW-capped
independent local Method-A transforms need not agree globally
conflict cannot be resolved by score, iteration order or majority vote
Writer still consumes canonical reviewed correspondence/deltas only
```

## No changes in PR998 to

```text
cii-workspace-geometry.js
cii-workspace-pipe-runs.js
cii-workspace-anchor-method-a.js
cii-workspace-anchor-suggestions.js
cii-workspace-multi-base-anchor.js
cii-workspace-multi-base-correspondence.js
Writer 1A / Writer 1B
fixed-field parser
protected converter
GitHub workflows
```

---

# 6. Validation ledger

## VAL-998-01 — base-loop selection projection

```text
STATUS: PASS
OBSERVATION: LOCAL_EXECUTION
ORACLE: IMPLEMENTATION_COUPLED
```

Commands executed on exact helper/test contents:

```text
node --check tabs/cii-workspace/cii-workspace-base-loop-selection.js
node tests/cii-workspace-base-loop-selection.test.js
```

Output:

```text
CII independent multi-base UI selection projection checks passed.
```

Proved:

- A+B -> two independent loops;
- Method A carries complete four-pair base;
- same A base dedupes;
- different A bases remain independent;
- conflicting B claims are preserved;
- LANDMARK_ONLY cannot become Method B;
- explicit engineer acceptance may carry a mathematically READY 3-anchor REVIEW base;
- stale explicit/manual fields are removed when switching authority mode.

## VAL-998-02 — exact executed blob custody

```text
STATUS: PASS
OBSERVATION: ARTIFACT_INSPECTION + LOCAL_EXECUTION
ORACLE: IMPLEMENTATION_COUPLED
```

Executed branch blobs:

```text
selection helper:
  ea660640e4c70cdf61db8350e09758d469b84477
selection regression:
  4852ee0372c14890a3837e0665323a32cc5f97e4
```

The exact Git branch blobs matched the locally executed files.

## VAL-998-03 — initial focused-test failure

```text
STATUS: FAIL -> RESOLVED_BY_TEST_FIX
OBSERVATION: LOCAL_EXECUTION
FAILURE_ORIGIN: TEST_FIXTURE
```

Initial fixture incorrectly assumed:

```js
'METHOD_A_AND_B'.includes('METHOD_B')
```

which is `false` and omitted test Method-B evidence. Production code already used explicit enum comparisons. The fixture was corrected; production thresholds/authority were not changed; rerun passed.

## VAL-998-04 — integration authority review

```text
STATUS: PASS
OBSERVATION: SOURCE_INSPECTION
ORACLE: NONE
```

Reviewed:

- UI selection projection;
- shell explicit-vs-manual branch;
- stale-state invalidation;
- review refresh custody;
- manual/qualified exclusivity;
- file/reinspection reset;
- conflict preservation;
- `data-ciiw-*` lifecycle DOM namespace.

## VAL-998-05 — changed-file / protected-authority reconciliation

```text
STATUS: PASS
OBSERVATION: GIT_COMPARE
ORACLE: NONE
```

Stacked compare against PR997 showed:

```text
11 expected files
11 actual files
0 unexplained files
0 Method A/B math files changed
0 arbitration files changed
0 Writer/parser/converter/workflow files changed
```

## Remaining NOT_RUN

```text
focused full engineering UI module test   NOT_RUN_ENVIRONMENT
existing shell lifecycle                  NOT_RUN_ENVIRONMENT
SOURCE 3/TARGET 3-1 browser workflow      NOT_RUN_ENVIRONMENT
Chromium full-screen/multi-select UX       NOT_RUN_ENVIRONMENT
full repository suite                     NOT_RUN_ENVIRONMENT
```

Reason: the execution container cannot obtain a complete repository checkout from `github.com`. No CI/workflow file was introduced to disguise this environment limitation.

No unexecuted check is claimed as PASS.

---

# 7. Final changed-file ledger — stacked over PR997

```text
agents/MASTER_INDEX.md
agents/PR998_workreport.md
agents/claims/PR998.yaml
agents/status/PR998.yaml
docs/CIIcompareconceptnote.md
tabs/cii-workspace/cii-workspace-base-loop-selection.js
tabs/cii-workspace/cii-workspace-engineering-ui.css
tabs/cii-workspace/cii-workspace-engineering-ui.js
tabs/cii-workspace/cii-workspace-shell.js
tests/cii-workspace-base-loop-selection.test.js
tests/cii-workspace-engineering-ui.test.js
```

Ledger:

```text
expected 11
actual   11
unexplained 0
```

---

# 8. Coordination / merge ordering

PR998 is intentionally stacked on PR997.

Safe integration options require owner merge authorization and live re-grounding:

```text
Option A:
  merge PR997
  rebase/retarget PR998 to current main
  verify resulting PR998 diff is only the 7 functional/docs/test files + PR998 custody
  merge PR998

Option B:
  deliberately combine both stacks after reviewing the union diff
```

Do not squash PR998 independently onto old `main` without checking the resulting dependency/diff.

---

# 9. Remaining bounded risk / question

## RISK-998-01 — browser behavior not observed

Source-level state/event review is complete, but a real browser execution remains required before claiming browser qualification.

## QST-998-01 — alternate qualified Method-A bases containing one pair

`projectCiiMethodAEvidence()` may expose multiple `bases[]` containing the same pair. PR998 deliberately projects `bestBase` for deterministic first UI authority. It does **not** auto-select every alternate spatial base.

If real benchmark review later requires explicit alternate-basis selection, add a separate inspector/control. Do not silently broaden one card into every alternate transform.

---

# 10. AUTO MODE closure

```text
EXECUTION_MODE = AUTO
AUTO_STATE = COMPLETE
APPROVED_SCOPE = COMPLETE
MERGE_AUTHORITY = OWNER_ONLY
```

No hard stop required an owner engineering decision. The only unavailable evidence is environment-limited complete-checkout/browser execution and is explicitly retained as NOT_RUN.

The next action is not another routine implementation phase. It is the owner-controlled integration decision for PR997/PR998 after live head re-grounding.

---

# Appendix A — implementation takeover gate

## A1 — Production trace

Trace a selected `METHOD_A_AND_B` card through:

```text
cii-workspace-engineering-ui.js
 -> cii-workspace-base-loop-selection.js
 -> cii-workspace-shell.js
 -> createCiiWorkspacePreview()
 -> explicitMultiBaseAuthority()
 -> buildCiiMultiBaseCorrespondence()
```

Prove why two independent loops, not one fused loop, enter arbitration.

## A2 — Failure isolation

Construct UI selections:

```text
SOURCE 500 -> TARGET 1500 via Method B
SOURCE 500 -> TARGET 2500 via Method B
```

Identify the first UI function that must preserve both and the first core function that must issue the custody conflict. State expected status.

## A3 — Authority invariant

Explain why a Method-A card must project all `bestBase.anchorPairs` rather than only the card’s clicked pair. Include the 3D rigid-rotation degrees-of-freedom argument.

## A4 — Independent validation

Design a browser/integration case with two Method-A local bases having materially different translations. Prove the preview received two explicit loops, uses `MULTI_BASE / INDEPENDENT_LOCAL_TRANSFORMS`, and did not regress to `LEGACY_ANCHOR_PAIRS`.

## A5 — Minimal future patch

If browser execution reveals one interaction where manual anchors and selected qualified loops coexist, identify the smallest UI/shell patch that restores exclusivity without touching geometry, Method-B gates, arbitration or Writer authority.

Default engineering-critical takeover threshold:

```text
total >= 92/100
every question >= 17/20
```

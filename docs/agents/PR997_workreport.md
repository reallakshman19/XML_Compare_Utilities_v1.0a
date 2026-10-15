# PR997 — CII full-screen method-qualified Base Anchor engineering UI

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_REVIEW
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE_SOURCE_REVIEW_PASS
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL_UI
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 — full-screen CII Workspace + Method A/B Base Anchor evidence
PR: 997
BRANCH: agent/cii-fullscreen-anchor-evidence-ui
BASE: main@df19d1834459f486fddd77eaec4297767ef83c6b
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: VALIDATE / RECONCILE
GROUNDING_EPOCH: GE-001 / 2026-08-19
APPENDIX_A_STATUS: PASS_FOR_CURRENT_INCREMENT
CURRENT_BLOCKER: COMPLETE-CHECKOUT JS + REAL BROWSER TESTS NOT_RUN_ENVIRONMENT
EXACT_NEXT_ACTION: execute focused UI/lifecycle tests and Chromium in a complete checkout; owner review; do not merge without explicit authorization
```

## Handover in 60 Seconds

PR996 merged the actual automatic Method A / Method B Base Anchor evidence. PR997 does not change that authority. It fixes the remaining presentation gap:

```text
canonical PR996 Base Anchor evidence
        |
        +--> existing legacy shell / acceptance control
        |
        +--> PR997 read-only engineering presentation
                 |
                 +-- full viewport workspace
                 +-- persistent SOURCE -> TARGET header
                 +-- Method A spatial evidence cards
                 +-- Method B run evidence cards
                 +-- A+B corroboration
                 +-- REVIEW / ambiguity diagnostics
```

The old Base Anchor table remains in the DOM only because its existing button owns the accepted SOURCE/TARGET anchor-input behavior. Under the engineering wrapper it is visually hidden and the new card button delegates to it. Direct legacy-shell mounting remains available.

## Ground truth

- predecessor PR996 merged by squash to `main@df19d1834459f486fddd77eaec4297767ef83c6b`;
- PR997 is draft/open and based directly on that commit;
- coordination scan found no active CII Workspace UI PR overlap;
- Issue #993 explicitly requires an application-level full-screen workspace and human-readable Method A/B evidence;
- current pre-PR997 shell still described Base Anchor suggestions as `Topology-only evidence` and rendered `row.basis.join(' · ')` in a compact table;
- current pre-PR997 CSS capped the workspace at 1500 px inside a padded modal.

## Authority boundary

PR997 is presentation-only.

It MUST NOT change:

- Method A registration equations, OD-scaled tolerance, basis consistency, or confidence;
- Method B pipe-run extraction, two-axis gate, weight model, mutual-best or winner-gap authority;
- independent local-base OR architecture or conflict veto;
- correspondence generation;
- review ledger semantics;
- engineering-delta semantics;
- transfer policy/plan;
- Writer 1A/1B;
- fixed-field parser;
- protected converters;
- workflow files.

The engineering UI calls `inspectCiiWorkspaceModels()` and renders the returned suggestion contract. It does not recompute `basisMethod`.

## Implemented UI

### Full viewport

- full application viewport is default;
- no browser Fullscreen API dependency;
- sticky/persistent header and tab chrome;
- persistent SOURCE -> TARGET file identity strip;
- readiness summary derived from the current legacy result;
- panels own vertical scrolling;
- `Compact view` restores the previous centered modal footprint;
- primary table headers are sticky.

### Method A card

Primary evidence:

- base identity;
- anchor count and validation-anchor count;
- RMS residual;
- max residual;
- OD-scaled tolerance range;
- minimum non-collinearity sine;
- max normalized residual;
- Method-A weight;
- confidence;
- automatic three-anchor REVIEW cap;
- equal-residual ambiguity diagnostics.

Expandable evidence:

- rotation matrix;
- translation vector;
- establishment/validation counts;
- tolerance authority statement.

### Method B card

Primary evidence:

- SOURCE / TARGET independent run counts;
- run axis labels;
- run lengths;
- element counts;
- terminator classes;
- compatible dimension;
- SOURCE-OD-scaled tolerance;
- mutual-best state;
- winner gap / required gap;
- display weight;
- local run-basis status versus actual Method-B authority.

Expandable evidence:

- compatible-basis count;
- compatible independent-run count;
- normalized geometry error;
- selected SOURCE-run -> TARGET-run mapping.

### A+B semantics

`METHOD_A_AND_B` is shown as corroboration. The UI never adds A and B weights to create a new score.

### Raw evidence policy

Raw objects are not serialized into primary cards. Rotation and run mapping are structured under `<details>` inspectors. Existing compare/delta/transfer rendering is not redefined in this slice.

## Files

Production/UI:

```text
tabs/cii-workspace/cii-workspace-engineering-ui.js
tabs/cii-workspace/cii-workspace-engineering-ui.css
tabs/cii-workspace/cii-workspace-tab.js
tabs/cii-workspace/cii-workspace.css
```

Focused qualification:

```text
tests/cii-workspace-engineering-ui.test.js
```

Custody:

```text
agents/MASTER_INDEX.md
agents/PR997_workreport.md
agents/status/PR997.yaml
agents/claims/PR997.yaml
```

## Focused regression authored

`tests/cii-workspace-engineering-ui.test.js` covers:

1. `METHOD_A_AND_B` canonical label;
2. explicit `A + B corroborated` presentation;
3. Method-A RMS/max/tolerance/weight;
4. Method-B physical run axis/length/count/terminator;
5. winner-gap visibility;
6. transform and network evidence under inspectors;
7. no JSON-object dump;
8. no A+B score-summation presentation;
9. three-anchor Method-A REVIEW-cap warning;
10. non-mutual Method-B local basis shown as REVIEW;
11. winner-gap failure shown as REVIEW;
12. A-only, B-only, and Landmark-only states;
13. application-level full viewport;
14. compact-layout alternative;
15. sticky review-table headers.

## Validation ledger

| ID | Check | Status | Observation | Oracle |
|---|---|---|---|---|
| VAL-001 | merged-main grounding | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE |
| VAL-002 | current shell defect isolation | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE |
| VAL-003 | UI-only changed-path boundary | PASS | GIT_COMPARE | AUTHORITATIVE_REFERENCE |
| VAL-004 | focused engineering UI JS | AUTHORED_NOT_RUN_ENVIRONMENT | NOT_OBSERVED | IMPLEMENTATION_COUPLED |
| VAL-005 | inherited CII shell lifecycle | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE |
| VAL-006 | browser/Chromium full viewport | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE |
| VAL-007 | browser acceptance delegation | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE |
| VAL-008 | full repository suite | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE |
| VAL-009 | exact-head GitHub CI | REFRESH_REQUIRED_EXACT_HEAD | NOT_OBSERVED | NONE |

No product test is represented as passing without execution.

## Risks

- **RISK-001 — duplicated matching authority:** prevented; UI renders canonical `inspectCiiWorkspaceModels()` evidence and does not compute identity.
- **RISK-002 — acceptance drift:** new card delegates to the existing legacy Accept button; no new review ledger or match authority is created.
- **RISK-003 — local Method-B basis misrepresented as authority:** UI derives Method-B qualification from canonical `basisMethod` and separately displays local run-basis status/reason.
- **RISK-004 — A+B score inflation:** no score addition; corroboration only.
- **RISK-005 — browser layout/lifecycle defect:** remains an explicit Chromium gate because this environment cannot execute a complete browser suite.
- **RISK-006 — duplicate legacy Base Anchor presentation:** legacy table is hidden only when `[data-ciiw-layout]` engineering wrapper is active; it remains in DOM for delegation.

## Appendix A

### A1 Production trace — PASS

`installCiiWorkspaceTile()` now mounts `mountCiiWorkspaceEngineeringShell()`, which first mounts the existing `mountCiiWorkspaceShell()` and then adds read-only engineering chrome/evidence. The existing shell remains owner of compare, review, transfer, Writer apply and lifecycle state.

### A2 Failure isolation — PASS

Issue #993 UI defect was in presentation: the old Base Anchor section still claimed topology-only evidence and flattened a now-rich evidence contract into one table cell. Matching authority itself was already implemented by PR994-996.

### A3 Authority / invariant — PASS

UI labels are derived from canonical `basisMethod`; local Method-B READY does not become qualified Method-B UI unless the canonical method says `METHOD_B_NETWORK` or `METHOD_A_AND_B`.

### A4 Independent validation — PARTIAL

Source-level contract tests are authored. Real browser execution remains NOT_RUN_ENVIRONMENT and must occur before representing the full-screen experience as browser-qualified.

### A5 Minimal patch — PASS

No core matching, transfer, Writer or parser file is changed. The legacy shell is wrapped, not rewritten.

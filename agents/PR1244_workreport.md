# PR1244 work report — CII Source ↔ Target census audit

## Recovery header

- `WORK_ITEM`: `reallaksh19/XML_Compare_Utilities#1239`
- `PR`: `#1244`
- `WORK_INTENT`: IMPLEMENT — SLICE 2
- `CRITICALITY`: ENGINEERING_CRITICAL / READ_ONLY_PROJECTION
- `MERGE_AUTHORITY`: OWNER_ONLY / NOT_GRANTED
- `STACK_BASE_PR`: `#1240`
- `STACK_BASE_BRANCH`: `fix/cii-writer2-evidence-qualified-review-1239`
- `STACK_BASE_SHA`: `6e62621c6918b50485314fc87886072ef37b9a69`
- `BRANCH`: `fix/cii-writer2-source-target-audit-1239`
- `PRODUCT_TEST_HEAD_BEFORE_REPORT_ALLOCATION`: `a849709c1efb83566af9d1886a28302df24d5edb`
- `PR_STATE`: OPEN / DRAFT / UNMERGED

## Mission

Add a first-class `Correspondence → Source vs Target` audit that enumerates every SOURCE node, including nodes for which the correspondence engine emitted nothing. Join existing normalized review/correspondence evidence without creating any new identity authority. Drive UI and CSV/JSON export from one census model.

## Audit before implementation

Owner required audit-first execution.

### Existing wrong product boundary

`combinedCompareReview()` in the multi-source preview only concatenates correspondence rows that individual member previews already emitted. Therefore Compare Review is not a census. A source node disappears completely when no NODE correspondence row was emitted.

The existing generic `correspondenceCsv` has the same emitted-row boundary, so simply relabelling it as a Source↔Target export would preserve the omission.

### Reusable source truth already present

Every `memberPreview` retains its full `sourceDocument`; the multi-source preview retains the target document. SOURCE node population can therefore be projected from parsed source evidence without re-running matching or creating a second parser.

### Authority boundary

```text
SOURCE population
  = parsed source element endpoints
  + parsed node keys where available
  + NodeName keys as supplementary population evidence

TARGET mapping
  = existing normalized NODE Compare Review rows only
```

No TARGET identity is inferred for an unemitted SOURCE node. NodeName values are audit payload, never identity authority.

## Implemented behavior

### `tabs/cii-workspace/cii-workspace-source-target-audit.js`

New pure model: `CIIWorkspaceSourceTargetAudit.v1`.

For every SOURCE node it records:

```text
sourceId / file / node / NodeName
state
confidence
TARGET claim(s) + NodeName(s)
qualified NodeName change status
correspondence IDs
workflow statuses
authorities / evidence bases
review decisions
Writer action/status
reason(s)
```

States:

```text
BOUND      = exactly one TARGET claim and at least one normalized bound row
UNRESOLVED = correspondence row(s) exist but identity is not bound
AMBIGUOUS  = more than one TARGET node is claimed for the SOURCE node
UNEMITTED  = SOURCE node exists but no NODE review row was emitted
```

The model also:

- reports aggregate and per-source state counts;
- compares enumerated node count to the source document's declared node count and surfaces `MATCH / MISMATCH / UNKNOWN`;
- marks qualified NodeName change only from existing engineering-delta evidence;
- joins Writer action/status only from existing transfer-plan operations;
- accepts pending review-decision overrides so the census remains synchronized with the visible review table before Apply-to-Preview;
- exports CSV and JSON from the exact same model.

### `tabs/cii-workspace/cii-workspace-source-target-audit-ui.js`

Adds the first-class audit surface:

`Correspondence → Source vs Target`

It renders:

- SOURCE node total;
- BOUND / UNRESOLVED / AMBIGUOUS / UNEMITTED counts;
- qualified NodeName-change count;
- per-source population/state summary;
- complete row-level census;
- population mismatch warning;
- CSV/JSON download links generated from the same model.

### `tabs/cii-workspace/cii-workspace-multisource-review-ui.js`

Narrow integration only:

- appends the complete census after the existing Compare Review table;
- still renders the census when zero correspondence rows were emitted;
- still renders the census when current Compare Review filters hide all emitted rows;
- passes the same pending decision map to the census so Review state does not disagree between tables.

No correspondence-generation or Writer2 code is touched.

### `tests/cii-workspace-source-target-audit.test.js`

Deterministic fixture covers:

- BOUND source node;
- UNRESOLVED emitted source node;
- AMBIGUOUS source node with two target claims;
- UNEMITTED source node;
- manual LOCKED/bound row;
- qualified NodeName delta and Writer action join;
- exact one-row-per-source-node cardinality;
- declared/enumerated population parity;
- CSV and JSON parity from the same model;
- UI presence of the unemitted row and export controls;
- pending decision override synchronization.

## Declared denominator

| Unit | State |
|---|---|
| U1 pure census model | COMPLETE |
| U2 source population + mapping authority audit | COMPLETE |
| U3 Source vs Target UI | COMPLETE |
| U4 census CSV/JSON export | COMPLETE |
| U5 deterministic tests authored | COMPLETE / EXECUTION NOT_RUN |
| U6 stacked PR evidence / recovery | ACTIVE |

The initial plan included attaching the model to the multi-source preview object. Audit showed this was unnecessary coupling: the review renderer already receives all required preview data. The implementation therefore keeps the census as a pure on-demand projection instead of mutating preview construction.

## Protected invariants / negative assurance

No change to:

- correspondence generation;
- anchor selection or Method-A/B;
- #1240 evidence-confidence semantics;
- Writer1C or Writer2 mutation authority;
- V11↔V14 conversion/bridge;
- transfer-scope binding;
- BM-001 authority;
- TEXPECTED benchmark interpretation;
- retained fixture bytes;
- workflow or deployment files.

No production code reads benchmark identities or uses NodeName equality as identity authority.

## Diff boundary relative to stack base #1240

Expected changed files only:

1. `agents/PR1244_workreport.md`
2. `tabs/cii-workspace/cii-workspace-source-target-audit.js`
3. `tabs/cii-workspace/cii-workspace-source-target-audit-ui.js`
4. `tabs/cii-workspace/cii-workspace-multisource-review-ui.js`
5. `tests/cii-workspace-source-target-audit.test.js`

The WIP report is removed after PR allocation.

## Validation truth

| Gate | Status | Observation / oracle |
|---|---|---|
| audit of emitted-row limitation | PASS | exact source inspection |
| source document retention / population seam | PASS | exact preview/intake/topology inspection |
| existing export limitation | PASS | exact export-module inspection |
| stacked diff scope | PASS | compare to `#1240` branch |
| deterministic census test design | PASS | source inspection; no benchmark hard-coding |
| imported Node test execution | NOT_RUN | connector session lacks full authenticated checkout |
| existing review/UI regression execution | NOT_RUN | same environment boundary |
| retained S1/S2/S3→T Chromium benchmark | NOT_RUN | not claimed on this stack head |
| benchmark overlay | NOT_APPLICABLE | intentionally next slice |
| merge | NOT_APPLICABLE | Owner authorization not granted |

## MATERIAL_FRONTIER

Read-only Source↔Target census projection + UI/export only.

## SEMANTIC_EVIDENCE_FRONTIER

```text
SOURCE population = parsed source document evidence
TARGET mapping     = existing normalized NODE review/correspondence evidence
NodeName change    = existing qualified engineering-delta evidence
Writer state       = existing transfer-plan evidence
```

No semantic frontier crosses into correspondence creation or writer authority.

## Highest remaining risk

Executable validation against the retained real S1/S2/S3 fixture is still required. In particular, declared source `nodeCount` must agree with the census population derivation. A mismatch is surfaced as evidence, not silently normalized.

## EXACT_NEXT_ACTION

1. remove the WIP report;
2. re-fetch exact stacked head and changed-file list;
3. check exact-head statuses/workflow runs;
4. publish #1239 slice-2 evidence;
5. in a checkout-capable environment run `node tests/cii-workspace-source-target-audit.test.js`, relevant review UI tests, and retained Chromium benchmark;
6. only after census validation, audit the partial-TEXPECTED benchmark overlay as the next separate slice.

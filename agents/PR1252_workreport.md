# PR1252 work report — TEXPECTED lower-bound validation semantics

## Mission

Implement Slice 9 for #1239 after audit: repair retained Writer2 validation so `TEXPECTED-PARTIALLLYDONE.CII` is enforced as a required-positive lower bound rather than an exact output ceiling, without changing production Writer authority.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- PR: #1252
- Base dependency: draft PR #1250 / branch `fix/cii-writer2-session-persistence-1239`
- Live stack base SHA: `89857fa9a606eff7324a2029ff2e34b5b817c24d`
- Branch: `test/cii-writer2-lower-bound-texpected-1239`
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first finding

The exact stacked-head production path from reviewed correspondence through canonical physical mutation selection, explicit scope, mixed Writer1C replacement + Writer2 structural mutation, and V11/V14 application did not expose a new production Writer-authority defect.

The retained validation did contain a semantic defect: the partial benchmark artifact was still used as an exact ceiling.

Confirmed stale ceiling forms:

1. retained Node benchmark required physical APPLY count and keys to equal the 36 T→TEXPECTED positives exactly;
2. retained Chromium benchmark repeated the exact-equality assumption;
3. the partial postimage oracle compared aggregate NODENAME occupancy / row cardinality to TEXPECTED;
4. the byte-closure call authorized only TEXPECTED deltas even when canonical selected operations could legitimately be a larger qualified set;
5. retained tile UI encoded an older one-physical-APPLY expectation and manually validated only the known CREATE at target 10330.

This contradicted the governing contract: TEXPECTED is a partial positive oracle, not a ceiling.

## Implemented validation semantics

### Required-positive lower bound

The retained T→TEXPECTED derivation remains frozen evidence:
- 36 known-positive NodeName deltas;
- 35 REPLACE;
- 1 CREATE;
- 0 DELETE.

Every required action/target key must still be recovered. Missing any required positive remains blocking.

### Full selected mutation authority

The full canonical physical selection is the byte-authority set when validating a produced output.

New helpers derive:
- physical transfer keys from all selected canonical operations;
- selected-operation deltas for the byte-closure engine;
- missing required lower-bound keys;
- additional qualified selected keys.

Additional selected mutations are reported and permitted only because they have already survived the production correspondence/review/canonical-conflict/scope machinery and still must pass raw identity + byte closure. Their absence from TEXPECTED alone is not a rejection reason.

### Partial postimage oracle

`evaluatePartialTExpectedPostimage()` now requires:
- structurally self-consistent CONTROL / ELEMENT / NODENAME encoding;
- all TEXPECTED known-positive NodeName outcomes;
- preservation outside Writer2 NodeName authority;
- preservation of every unselected pre-existing NodeName payload;
- no unselected NodeName creation.

It no longer requires aggregate NODENAME occupancy or row count to equal the partial artifact.

### Retained Node + Chromium benchmarks

Both now require:
- expected keys are a subset of canonical physical keys;
- no canonical physical conflicts;
- selected raw source/target identity is exact;
- explicit scope APPLY equals the full canonical physical selection;
- readiness family counts equal actual selected operation categories;
- V11/V14 apply validation PASS when executed;
- all 36 positives recovered;
- full selected-operation byte closure;
- unrelated target state preserved.

### Retained tile UI

- scope APPLY count is dynamic, not hard-coded to 1;
- APPLY must be at least the 36-positive lower bound;
- exported output must contain all 36 known positives and preserve unrelated target state;
- target 10330 remains checked as the known structural CREATE checkpoint.

## Branch reconstruction / anti-drift

The initial Slice 9 branch was created from an older #1250 head. Before PR creation, live #1250 had advanced to `89857fa9a606eff7324a2029ff2e34b5b817c24d` with persistence-only reconciliation changes.

The Slice 9 branch was therefore rebuilt instead of opened stale:
- recovered the exact six audited file blob SHAs from the stale Slice 9 branch;
- created a new tree on the live #1250 tree;
- created one commit with live #1250 as its parent;
- rechecked the old Slice 9 ref before force update;
- final compare before PR: `ahead_by=1`, `behind_by=0`, exactly six validation files.

No #1250 persistence change was overwritten.

## Files

Exactly six validation files relative to #1250:

1. `tests/cii-workspace-multisource-partial-texpected-oracle.js`
2. `tests/cii-workspace-multisource-lower-bound-helpers.js`
3. `tests/cii-workspace-multisource-lower-bound-helpers.test.js`
4. `tests/cii-workspace-multisource-retained-auto-anchor-benchmark.test.js`
5. `tests/browser/cii-writer2-multisource-retained-benchmark.spec.mjs`
6. `tests/browser/cii-writer2-multisource-retained-tile-ui.spec.mjs`

No production files are changed by the functional slice.

## Falsifiers / tests authored

- a selected qualified superset satisfies the lower-bound key oracle;
- additional selected key is reported, not rejected;
- missing required key remains blocking;
- byte-authority deltas cover the full selected operation set;
- unselected existing NodeName mutation remains blocking;
- unselected new NodeName creation remains blocking;
- retained Node benchmark requires all 36 positives but permits additional qualified selected mutations;
- retained Chromium benchmark enforces the same rule;
- retained tile UI uses dynamic scope cardinality and validates all known positives after export.

## Protected invariants

- no production correspondence code change;
- no anchor / propagation change;
- no review authority change;
- no canonical mutation selection change;
- no transfer-scope authority change;
- no Writer1C / Writer2 production mutation change;
- no V11/V14 bridge production change;
- no benchmark source/expected files changed;
- every TEXPECTED known positive remains mandatory;
- additional mutation is never accepted merely because the oracle allows supersets: it still requires production qualification and selected-set byte closure;
- owner-only merge remains in force.

## Validation truth

- production transfer-chain audit: PASS (static/source audit; no new production defect proven);
- lower-bound oracle design audit: PASS;
- stacked diff scope before report: PASS — exactly six validation files;
- deterministic lower-bound helper regression: AUTHORED / NOT_RUN in connector-only execution context;
- retained Node benchmark: AUTHORED / NOT_RUN;
- retained Chromium benchmark: AUTHORED / NOT_RUN;
- retained tile UI regression: AUTHORED / NOT_RUN;
- exact-head provider status/workflow evidence: pending final-head query after this report commit;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Validation/test oracle semantics only.

## SEMANTIC_EVIDENCE_FRONTIER

TEXPECTED is a mandatory-positive subset. Canonical selected operations remain the actual mutation and byte-authority set. Validation must prove both: required positives are present and the entire selected set is byte-safe.

## EXACT_NEXT_ACTION

1. refresh PR #1252 exact head after this report commit;
2. verify stacked compare remains ahead-only and no production file appears except this work report;
3. query exact-head commit statuses and PR workflow runs;
4. publish TASK_EVIDENCE on #1239 with explicit PASS / NOT_RUN truth;
5. do not merge.

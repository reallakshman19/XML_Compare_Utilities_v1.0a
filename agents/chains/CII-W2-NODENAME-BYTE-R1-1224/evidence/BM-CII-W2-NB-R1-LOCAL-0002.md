# BM-CII-W2-NB-R1-LOCAL-0002 — multisource REPLACE selectability/orchestration local falsifiers

## Scope
Read-only executable evidence for PB-0003 NodeName REPLACE orchestration while the retained-real S1/S2/S3/T/TEXPECTED benchmark remains unavailable to the local shell.

This evidence does **not** replace the retained benchmark and does **not** grant production write authority.

## Runtime
- local runtime: Node v22.16.0
- workflow/CI: not used
- production mutation: NONE
- frozen benchmark/oracle mutation: NONE

## Current branch source anchors
- `tabs/cii-workspace/cii-workspace-multisource-bm001-correspondence.js` blob `49f36802993fa8bb85464906540fc7ab4a954726`
- `tabs/cii-workspace/cii-workspace-multisource-preview.js` blob `12f203c79fb02ccc5b1832378ba6ab2a8db0f00d`
- `tabs/cii-workspace/cii-workspace-transfer-policy.js` blob `5bb37b810e6b46fbb617d9e6fcf4d72fce1f307f`

The local test host executed exact extracted function bodies / branches from those blobs with irrelevant imports stubbed. It is therefore focused function-level executable evidence, not a claim that the complete production modules were imported byte-for-byte.

## Falsifier A — canonical Writer2 selection drops Writer1C REPLACE
Executed current `ciiWriter2NodeNameCardinalityOperation`, `ciiWriter2PhysicalMutationConflicts`, and `ciiCanonicalWriter2MutationSelection` logic.

Observed:
```text
status                     PASS
Writer2 CREATE eligible    true
Writer1C COPY/REPLACE      false
REPLACE canonical applied  0
CREATE canonical applied   1
duplicate CREATE collapse  PASS
conflicting CREATE veto    PASS
```

Interpretation:
- current canonical Writer2 selector correctly remains CREATE/DELETE-only;
- a reviewed same-cardinality NodeName replacement represented as `action=COPY`, `status=PREVIEW_READY`, `policyAuthority=CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD` is not selected at all;
- future orchestration must add a separate Writer1C REPLACE selection/transaction path rather than misclassifying REPLACE as Writer2 cardinality work.

## Falsifier B — multisource preview conflict arbitration ignores REPLACE
Executed the exact current `targetMutationConflicts()` body from `cii-workspace-multisource-preview.js`.

Two `PREVIEW_READY` same-target NodeName operations with different payloads produced:
```text
COPY/REPLACE vs COPY/REPLACE conflicts = 0
CREATE vs CREATE conflicts             = 1
```

Interpretation:
- current cross-source target conflict arbitration is scoped only to CREATE/DELETE;
- once REPLACE is selectable, exact-target + exact-payload conflict arbitration must cover REPLACE claims too;
- same-target same-payload corroboration may deduplicate, but different proposed payloads must fail closed.

## Falsifier C — low-level transfer policy already supports narrow overwrite opt-in
Executed the exact NodeName branch of current `classifyCiiTransferDelta()`.

For source `NEW`, target `OLD`, changed=true, fixed-layout authority present:
```text
default options:
  action     COPY
  status     BLOCKED
  blocker    TARGET_NODENAME_NONBLANK

allowNodeNameOverwrite=true:
  action     COPY
  status     PREVIEW_READY
  blockers   []
  authority  CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD
```

Interpretation:
- global overwrite semantics should remain blocked by default;
- the reviewed multisource workflow can narrowly opt into the existing Writer1C primitive after correspondence/review custody is established;
- no low-level transfer-policy broadening is required merely to express a reviewed REPLACE.

## Patch-surface consequence
When production mutation is later authorized, the minimal architecture remains:
1. propagation: source-frontier subset injection rather than strict frontier equality;
2. multisource preview/conflict arbitration: include reviewed Writer1C REPLACE physical claims;
3. multisource canonical/scope orchestration: maintain separate Writer1C REPLACE selection alongside Writer2 CREATE/DELETE selection;
4. apply seam: REPLACE against immutable TARGET0 first, re-intake, then structural Writer2 relocation if needed;
5. protect Writer1C existing-row fixed-span writer and Writer2 relocation/write primitives unless a separate falsifier proves them wrong.

Do **not** solve this by weakening `ciiCanonicalWriter2MutationSelection()` into a generic all-writer selector unless a separately reviewed design proves equivalent authority separation.

## Truth boundary
- retained structural baseline: `NOT_RUN_ENVIRONMENT`
- full PB-0003 retained-real benchmark: `NOT_RUN_ENVIRONMENT`
- independent qualification verdict: still deferred pending retained-real executable benchmark evidence
- write authority: `READ_ONLY`

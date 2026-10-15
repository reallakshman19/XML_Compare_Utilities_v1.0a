# BM-CII-W2-NB-R1-LOCAL-0003 — mixed NodeName orchestration trace

Status: READ_ONLY_FOCUSED_EXECUTABLE_EVIDENCE
Retained-real S1/S2/S3/T/TEXPECTED benchmark: NOT_RUN_ENVIRONMENT
Production mutation: NONE
Frozen input/oracle mutation: NONE
Workflow/CI reliance: NONE

## Exact current-branch module custody

- `cii-workspace-multisource-scope.js` blob `04f9241c5daaf8deb7d244f2e8b7f5af1084c3eb`
- `cii-workspace-transfer-scope.js` blob `2d2f2a9ea9ee93e4fed7eab45a0b27496b9d5f2d`
- `cii-workspace-multisource-writer2-readiness.js` blob `b647de19cdba4740fa892388c905cede17d2b23c`
- `cii-workspace-writer2-routing.js` blob `0748657f49956acaf01f5d0c9c0a205474f9a7bd`
- `cii-workspace-target-writer-composite.js` blob `86e363c1fbac1d5aebed92b8054a8bf38cf0a804`
- `cii-workspace-v14-change-projection.js` blob `5b294c8da36a2df48970f1ea603bddbed4b40748`
- `cii-workspace-core.js` blob `cee2858a63992648edf5e61b8f63b3837a937f9e`

## Focused executable predicate falsifier

A local Node predicate-chain falsifier, copied from the exact current module predicates, asserted:

```text
generic_scope_sees_replace=true
writer1c_recognizes_replace=true
writer2_cardinality_rejects_replace=true
source_set_readiness_rejects_replace=true
writer2_cardinality_accepts_create=true
source_set_readiness_accepts_create=true
status=PASS
```

This proves the integration mismatch is deliberate authority filtering, not an ambiguous parser result.

## Read-only trace findings

1. `createCiiTransferScopeSelection()` is generic: every non-KEEP operation is a candidate. It does not need a REPLACE-specific production change.
2. `createCiiExpectedNodeNameSourceSetSelection()` canonicalizes through `ciiCanonicalWriter2MutationSelection()`, so source-set selection currently selects Writer2 CREATE/DELETE only.
3. `ciiWriter2SourceSetNodeNameReadiness()` accepts an APPLY only when `ciiWriter2NodeNameCardinalityOperation()` is true. A reviewed Writer1C COPY/REPLACE would be reported `CII_MS_WRITER2_UNAUTHORIZED_APPLY`.
4. `cii-workspace-writer2-routing.js` intentionally blocks nonblank overwrite with `WRITER_2_NODENAME_OVERWRITE_USE_WRITER_1C`; Writer2 remains CREATE/DELETE authority and is a NO-PATCH domain for REPLACE semantics.
5. `cii-workspace-target-writer-composite.js` already provides exact original-preimage Writer1A/1B/1C claim canonicalization, stale-preimage checks, same-span conflict checks, cross-family overlap checks, equal-width fixed-span writes, and byte-length preservation. This remains a protected primitive.
6. Core exposes Writer1C and Writer2 as distinct apply paths. There is no existing mixed source-set coordinator that applies Writer1C REPLACE and then structural Writer2 relocation.
7. `cii-workspace-v14-change-projection.js::mergeNodeNameBlankTransition()` explicitly rejects nonblank-to-different-nonblank with `CII_V14_PROJECTION_NODENAME_NONBLANK_REPLACEMENT_NOT_AUTHORIZED`; pure V14 REPLACE must therefore bypass broad projection and patch original V14 fixed spans directly.

## Minimal future composition after qualification/write authority

```text
reviewed source-set selection bound against immutable TARGET0
  -> partition selected NodeName operations:
       REPLACE => Writer1C exact existing-row fixed-span authority
       CREATE/DELETE => Writer2 relocation authority
  -> arbitrate all claims by exact physical target + payload before apply
  -> apply all Writer1C REPLACE claims to TARGET0
  -> re-intake resulting postimage and prove provenance from TARGET0 + selected replacement ledger
  -> rebuild/rebind structural CREATE/DELETE subplan against the re-intaken target
  -> apply Writer2 relocation
  -> independent final oracle compares OUTPUT against TARGET0 outside authorized closure
```

Absolute Writer1C spans from TARGET0 must never be reused after Writer2 cardinality changes.

## Protected NO-PATCH conclusions

- generic transfer-scope selection remains protected;
- Writer1C physical fixed-span writer/composite remains protected;
- Writer2 NodeName routing/relocation remains protected for REPLACE semantics;
- V14 projector nonblank replacement blocker remains protected and must not be weakened.

## Still required before production mutation

Exact retained checkout -> retained structural baseline + PB-0003 benchmark under Node -> independent Q1-Q5 verdict -> post-basis/current-main/overlap reconciliation -> repository backup/patch custody -> WRITE_ALLOWED.

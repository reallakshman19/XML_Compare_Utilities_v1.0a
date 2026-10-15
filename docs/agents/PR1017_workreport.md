# PR1017 — Writer 2 composite product/core routing

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1017
BRANCH: agent/cii-writer2-composite-product-routing
BASE: main@5a1602855a0de6c933e52126f8a8a0348f16ba66
MISSION: replace the NODENAME-only Writer-2 product path with the qualified one-original-preimage NODENAME + V11 SIF DELETE composite
CURRENT_STAGE: IMPLEMENTED_DRAFT_AWAITING_REPOSITORY_AND_BROWSER_QUALIFICATION
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Source grounding

PR1016 was squash-merged by explicit owner authorization to:

`main@5a1602855a0de6c933e52126f8a8a0348f16ba66`

This branch was created directly from that SHA.

Existing base engineering deltas already emit:

```text
category  = SIF_TEE
property  = SIF/Tee record presence
authority = ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD
```

The generic transfer policy intentionally classifies changed SIF presence as BLOCKED with future/cardinality qualification required. PR1017 does not alter that generic policy. It adds a Writer-2-only adapter which requalifies the already-audited delta through the merged PR1014/PR1015 SIF DELETE authority.

## 2. Product authority after this PR

Explicit `writerVersion=2` may route only:

```text
NODE_NAME / Node name / to-name / CREATE
NODE_NAME / Node name / to-name / DELETE
SIF_TEE / SIF/Tee record presence / DELETE
```

These may be selected independently or together in one explicit PR1001 APPLY/EXCLUDE scope.

Still blocked:

```text
NODENAME overwrite -> Writer1C
SIF CREATE -> WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
PROCESS -> unsupported Writer2
restraint cardinality -> unsupported Writer2
hanger cardinality -> unsupported Writer2
topology mutation -> Writer3
```

## 3. New composite routing adapter

New file:

`tabs/cii-workspace/cii-workspace-writer2-composite-routing.js`

The adapter deliberately reuses both existing family contracts:

```text
raw auditable transfer plan
 |-- applyCiiWriter2NodeNamePlanContract
 |-- applyCiiWriter2SifDeletePlanContract

route each operation by exact family/property
 -> retain each family's existing policyAuthority/blockers
 -> preserve KEEP rows
 -> block every other mutable family
```

Global `NO_TRANSFERABLE_PREVIEW_OPERATIONS` is removed only because either qualified Writer-2 family may legitimately requalify a previously blocked cardinality operation. Any other raw plan blocker is retained.

Plan readiness is not inferred from generic `previewReadyCount`; it requires at least one explicitly qualified Writer-2 composite mutation.

Operation IDs are required and duplicate IDs block the composite routing plan before scope binding.

## 4. Composite readiness

`ciiWriter2CompositeReadiness(transferPlan, targetDocument, targetGraph)`:

- requires PREVIEW_READY plan;
- requires BOUND explicit transfer scope;
- inspects only scopeDecision=APPLY operations;
- SIF CREATE preserves the exact semantic blocker;
- any other APPLY family produces `WRITER_2_COMPOSITE_UNSUPPORTED_APPLY:<id>`;
- NODENAME operations are projected into the merged PR1011 relocation planner;
- SIF DELETE operations are projected into the merged PR1014 relocation planner;
- either family alone is valid;
- both together are valid only if both component planners are READY.

This is preview/readiness only. Final mutation authority remains the merged PR1016 composite, which independently validates canonical PR1001 parent-scope custody and patches one untouched TARGET preimage.

## 5. Core lifecycle replacement

`tabs/cii-workspace/cii-workspace-core.js` now routes Writer 2 as:

```text
base engineering deltas ONLY
 -> applyCiiWriter2CompositePlanContract
 -> ciiWriter2CompositeReadiness
 -> explicit PR1001 scope
 -> applyCiiWriter2Composite
 -> re-intake writerResult.bytes
 -> validateCiiWriter2CompositeRoundTrip
 -> binary-authoritative Modified_<target>.CII
```

Removed from Writer-2 production dispatch:

```text
applyCiiWriter2NodeNameRelocation
validateCiiWriter2NodeNameRoundTrip
```

Those standalone modules remain unchanged and qualified as component authorities; they are no longer the product-level Writer-2 transaction boundary.

## 6. Authority isolation

The existing core branch remains:

```js
if (version === '2') {
  engineeringDeltas = baseDeltas;
}
```

Therefore Writer 2 does not inherit:

- Writer1B fixed process augmentation;
- restraint pairing/slot augmentation;
- Writer1C selected SIF field augmentation.

No `writerVersion` option still defaults to Writer 1B.

## 7. Scope/product UI

`tabs/cii-workspace/cii-workspace-transfer-scope.js` now constructs the target topology graph for Writer 2 and calls composite readiness after binding scope.

No UI mutation code change was required because the scoped product shell already:

- dispatches `writerVersion=2` through `applyCiiWorkspaceTargetWriter2`;
- disables APPLY unless scope is BOUND and readiness is READY;
- exports `WRITER_2` from `byteString` rather than re-encoding text.

The product tile is unchanged and does not silently default to Writer 2.

## 8. Regressions authored

New:

`tests/cii-workspace-writer2-composite-product-routing.test.js`

Covers:

1. mixed NODENAME CREATE + SIF DELETE routing;
2. removal of obsolete generic no-transfer blocker after valid Writer-2 requalification;
3. unbound composite readiness blocks;
4. bound mixed readiness reaches both component relocation planners;
5. SIF CREATE remains blocked even beside an otherwise transferable NODENAME mutation;
6. unsupported PROCESS APPLY blocks;
7. Writer 1B remains default;
8. Writer 2 still uses base deltas only;
9. core uses composite plan/readiness/apply/validator;
10. old direct NODENAME Phase-4B production calls are absent;
11. scope uses composite readiness with target graph;
12. existing UI Writer-2 binary export remains present;
13. product tile does not silently select Writer 2.

Updated inherited:

`tests/cii-workspace-writer2-product-routing.test.js`

The standalone NODENAME qualification cases are retained. Only the stale #1013 assertion that product Writer 2 must remain NODENAME-only was replaced with assertions for the accepted PR1016 composite architecture.

## 9. Changed-file ledger

Production:

```text
tabs/cii-workspace/cii-workspace-core.js
tabs/cii-workspace/cii-workspace-transfer-scope.js
tabs/cii-workspace/cii-workspace-writer2-composite-routing.js
```

Tests:

```text
tests/cii-workspace-writer2-composite-product-routing.test.js
tests/cii-workspace-writer2-product-routing.test.js
```

Recovery:

```text
agents/PR1017_workreport.md
agents/status/PR1017.yaml
agents/claims/PR1017.yaml
agents/MASTER_INDEX.md
```

Explicitly unchanged:

- protected converter;
- fixed-field parser;
- generic engineering-delta generation;
- generic transfer policy;
- Writer1A/1B/1C implementation;
- PR1011/1012 NODENAME planner/writer/validator;
- PR1014/1015 SIF DELETE planner/writer/validator;
- PR1016 composite writer/validator;
- scoped UI binary-download implementation;
- product tile default;
- benchmark CII files;
- workflows.

## 10. Validation truth

```text
PR1016 merge / current-main grounding                 PASS
branch ancestry                                      PASS_GIT_COMPARE
base SIF-presence delta grounding                     PASS_SOURCE_INSPECTION
generic SIF-cardinality policy grounding              PASS_SOURCE_INSPECTION
core composite dispatch source audit                  PASS_SOURCE_INSPECTION
scope composite-readiness source audit                PASS_SOURCE_INSPECTION
repository composite product-routing regression       AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer2 NODENAME product regression         AUTHORED_NOT_RUN_ENVIRONMENT
PR1016 mixed composite regression                     NOT_RUN_ENVIRONMENT
full repository test                                  NOT_RUN_ENVIRONMENT
browser scoped Writer2 flow                           NOT_RUN_ENVIRONMENT
real-CII mixed export/re-intake                       NOT_RUN_ENVIRONMENT
```

No unexecuted test may be represented as PASS.

## 11. Exact next actions

1. Run the two PR1017 focused routing regressions in an exact checkout.
2. Run inherited PR1016 composite, PR1012 NODENAME and PR1015 SIF DELETE regressions.
3. Exercise browser scoped Writer 2 with:
   - NODENAME-only;
   - SIF-DELETE-only;
   - mixed NODENAME + SIF DELETE;
   - blocked SIF CREATE;
   - blocked unsupported family APPLY.
4. Export Modified_Target.CII from bytes and re-intake it.
5. Run full repository regression if environment permits.
6. Do not merge without fresh owner authorization.

# Appendix A — next-agent qualification

1. Why is the generic SIF presence policy deliberately left BLOCKED rather than edited to PREVIEW_READY?
2. Which layer is allowed to requalify SIF DELETE and why?
3. Which three Writer-2 product mutation shapes are admitted?
4. Why does SIF CREATE remain blocked even though DELETE is now product-routed?
5. Why does Writer 2 continue to consume base engineering deltas only?
6. Which Writer1 augmentation families must never leak into Writer 2?
7. Why is generic `previewReadyCount` insufficient as Writer-2 availability evidence?
8. What must happen if PROCESS is manually selected APPLY beside a valid NODENAME mutation?
9. What is the product-level transaction boundary after PR1017?
10. Why are the standalone NODENAME and SIF writers retained even though core no longer calls the NODENAME writer directly?
11. Which module verifies canonical parent-scope custody immediately before mutation?
12. Why must the final Writer-2 patch still occur once against one untouched TARGET?
13. Why was no scoped UI binary-export code change necessary?
14. What remains the default writer when no version is supplied?
15. Which exact tests remain NOT_RUN?

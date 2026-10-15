# Candidate fix package — CII Writer2 multisource NodeName R1

STATUS: NOT_APPLIED_PRODUCT
OWNER_INSTRUCTION: `fix it` at 2026-09-16T12:17:09Z
WRITE_AUTHORITY: READ_ONLY
QUALIFICATION_STATE: DEFERRED
RETAINED_REAL_BENCHMARK: NOT_RUN_ENVIRONMENT

This file is a durable candidate patch package only. It does not authorize or claim production mutation.

## Proven defect 1 — embedded source-subgraph propagation

Exact current production blob: `tabs/cii-workspace/cii-workspace-propagation.js` SHA `0a422dfaae61a60d0eabe217cd47457adb543de6`.

Focused exact-blob execution already proved the current `sourceEdges.length !== targetEdges.length` gate rejects a valid source frontier when target has an unrelated extra branch. The minimal locally executed candidate is:

```diff
 function frontierAssignment(sourceEdges, targetEdges, matchOptions) {
-  if (sourceEdges.length !== targetEdges.length) return { status: 'BLOCKED', blocker: 'FRONTIER_CARDINALITY_MISMATCH' };
+  if (sourceEdges.length > targetEdges.length) return { status: 'BLOCKED', blocker: 'FRONTIER_CARDINALITY_MISMATCH' };
@@
-    if (!sourceEdges.length && !targetEdges.length) continue;
+    if (!sourceEdges.length) continue;
@@
   const unmatchedSource = [...sourceComponent.edges].filter((id) => !sourceEdgeCustody.has(id));
   const unmatchedTarget = [...targetComponent.edges].filter((id) => !targetEdgeCustody.has(id));
   if (unmatchedSource.length) blockers.add('SOURCE_COMPONENT_NOT_FULLY_PROPAGATED');
-  if (unmatchedTarget.length) blockers.add('TARGET_COMPONENT_NOT_FULLY_CLAIMED');
```

This preserves existing injective enumeration, candidate hard-fail filtering, winner-gap ambiguity, source completeness, edge/node custody and unmatched-target evidence.

Focused candidate results already captured in `BM-CII-W2-NB-R1-LOCAL-0001.md`:
- extra target branch: PASS/READY;
- target-only continuation after a mapped source leaf: PASS/READY;
- missing required target edge: BLOCK;
- two source edges competing for one target edge: BLOCK.

## Proven defect 2 — reviewed REPLACE is dropped before mixed apply

Current exact branch observations:

1. `cii-workspace-multisource-preview.js::targetMutationConflicts()` only arbitrates `CREATE`/`DELETE`; conflicting same-target `COPY`/REPLACE proposals are ignored.
2. `cii-workspace-multisource-bm001-correspondence.js::ciiWriter2NodeNameCardinalityOperation()` correctly admits Writer2 `CREATE`/`DELETE` only.
3. `cii-workspace-multisource-scope.js::createCiiExpectedNodeNameSourceSetSelection()` uses `ciiCanonicalWriter2MutationSelection()`, so Writer1C REPLACE never enters the canonical APPLY set.
4. `cii-workspace-multisource-writer2-readiness.js` correctly rejects a non-Writer2 APPLY with `CII_MS_WRITER2_UNAUTHORIZED_APPLY`.
5. `cii-workspace-transfer-scope.js` then routes every source-set `writerVersion: 2` plan into Writer2-only source-set readiness.
6. `cii-workspace-writer1c-nodename.js` already validates exact-span NodeName `COPY` under `CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD`; low-level Writer1C is protected.

### Required candidate integration

Do **not** broaden the existing Writer2 predicate/selector. Add mixed NodeName orchestration above the protected writers.

A. `cii-workspace-multisource-preview.js`

Extend physical conflict arbitration from structural actions to all preview-ready NodeName mutations:

```diff
-    if (!['CREATE', 'DELETE'].includes(operation?.action) || operation?.status !== 'PREVIEW_READY') continue;
+    if (!['COPY', 'CREATE', 'DELETE'].includes(operation?.action) || operation?.status !== 'PREVIEW_READY') continue;
```

Same target + same proposal remains corroboration; same target + different proposal remains `TARGET_NODENAME_MUTATION_CONFLICT`.

B. `cii-workspace-multisource-bm001-correspondence.js`

Keep every existing `ciiWriter2*` export unchanged. Add separate mixed-operation predicates/keys/selection:

```text
ciiWriter1CNodeNameReplaceOperation(operation)
  NODE_NAME + Node name / to-name
  action COPY, status PREVIEW_READY
  policyAuthority CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD
  matchAuthority REVIEWED|LOCKED
  target identity present
  before nonblank, proposed nonblank, before != proposed

ciiSourceSetNodeNameMutationOperation(operation)
  = Writer1C REPLACE || Writer2 CREATE/DELETE

ciiSourceSetNodeNamePhysicalTargetKey(operation)
  = NODE_NAME|<target identity>

ciiSourceSetNodeNamePhysicalMutationKey(operation)
  = NODE_NAME|<target identity>|<before>|<proposed>

ciiCanonicalSourceSetNodeNameMutationSelection(operations)
  conflict by physical target when mutation keys differ
  canonicalize duplicate/corroborating identical mutations using existing LOCKED-before-REVIEWED rank
```

C. `cii-workspace-multisource-scope.js`

Use the new mixed selector for source-set NodeName selection while leaving generic transfer scope untouched. `ciiExpectedNodeNameOperation()` should recognize the mixed predicate, not the Writer2-only predicate.

D. new/adjacent mixed source-set readiness/coordinator

Do not send a mixed APPLY set to `ciiWriter2SourceSetNodeNameReadiness()`.

Required coordinator contract:

```text
TARGET0 immutable custody
-> verify original source-set/target hashes and bound explicit selection
-> partition APPLY into Writer1C REPLACE and Writer2 structural CREATE/DELETE
-> reject any operation outside those two qualified classes
-> physical same-target conflict arbitration across both classes
-> Writer1C phase plan against TARGET0
-> apply Writer1C REPLACE to TARGET0
-> re-intake Writer1C postimage
-> rebind/revalidate structural CREATE/DELETE against re-intaken target
-> Writer2 relocation phase
-> final independent TARGET0->OUTPUT byte oracle
```

Pure REPLACE must bypass broad V14 projection. Absolute Writer1C spans from TARGET0 must never be reused after Writer2 structural relocation.

## Protected NO-PATCH modules

Unless new retained-real evidence falsifies them:
- generic `cii-workspace-transfer-scope.js` selection mechanics;
- low-level `cii-workspace-writer1c-nodename.js` and Writer1C composite byte writer;
- Writer2 NodeName routing/relocation primitives;
- V14 projector nonblank-NodeName replacement blocker;
- retained benchmark/oracle CII files;
- workflow files.

## Validation required before product commit

1. byte-faithful retained checkout mounted locally;
2. retained SHA-256 custody gates for S1/S2/S3/T;
3. baseline `node tests/cii-workspace-multisource-retained-auto-anchor-benchmark.test.js`;
4. PB-0003 `node tests/cii-workspace-multisource-pb0003-benchmark.test.js`;
5. independent Q1..Q5 verdict `PASS_QUALIFIED_READ_ONLY`;
6. post-PASS main/overlap reconciliation -> explicit `WRITE_ALLOWED` only if clean;
7. before each existing product-file edit: `node utils/backup.cjs save <path> "Plan to ..."` plus local `.agent-worklogs` manifest/module patch ledger;
8. focused F01/F02/F03/F04/F06/F07/F08/F09/F11/F12/F14/F15 regressions;
9. final independent byte oracle against original TARGET0.

Current inability to perform steps 1, 3, 4, 5, 6 and mandatory local backup/ledger means this candidate must remain unapplied.
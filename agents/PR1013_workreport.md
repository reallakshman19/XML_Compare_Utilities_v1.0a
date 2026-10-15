# PR1013 — Writer 2 NODENAME Product/Core Routing Work Report

## Recovery header

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1013
BRANCH: agent/cii-writer2-product-routing
BASE: main@81ac1c91d45eb1357896e41acf8f5bd1a866f497
MISSION: route the merged Writer 2 NODENAME CREATE/DELETE engine through CII Workspace preview, scope, apply, validation and binary export
CURRENT_STAGE: IMPLEMENTED_DRAFT_AWAITING_REPOSITORY_AND_BROWSER_QUALIFICATION
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Scope

PR1013 adds **routing only**. It does not create new CAESAR-II field semantics or a new structural allocator.

Already merged authority reused here:

```text
PR1011 / Phase-4A
  deterministic NODENAME CREATE/DELETE relocation planning
  CONTROL.NONAM after-count
  old-pointer -> new-pointer map
  exact changed ELEMENT pointer custody

PR1012 / Phase-4B
  CONTROL.NONAM physical rewrite
  ELEMENT NODENAME pointer physical rewrite
  variable-length NODENAME payload replacement
  complete independent postimage validation
```

PR1013 connects those qualified components to the product/core lifecycle.

## 2. Writer-version contract

Supported core versions are now:

```text
1A
1B
1C
2
```

The fallback/default remains exactly:

```text
Writer 1B
```

No product surface silently opts into Writer 2. The existing tile passes `context.writerVersion` only when the host deliberately supplies one.

## 3. Writer-2 engineering-delta boundary

Writer 2 uses `buildCiiEngineeringDeltas(...)` output directly.

It deliberately does **not** execute:

```text
augmentCiiEngineeringDeltasWithWriter1BFields
augmentCiiEngineeringDeltasWithRestraintSlots
augmentCiiEngineeringDeltasWithWriter1CSifFields
```

This is an authority boundary, not an optimization. Writer 2 Phase-1 must not acquire process, restraint or SIF operations because another writer happens to know how to express them.

## 4. Writer-2 plan adapter

New module:

`tabs/cii-workspace/cii-workspace-writer2-routing.js`

Policy:

`CII_WRITER_2_NODENAME_RELOCATION`

NODENAME routing matrix:

```text
SOURCE name     TARGET name      Writer-2 result
-----------     -----------      ---------------
nonblank        blank            CREATE
blank           nonblank         DELETE
nonblank        different        BLOCKED -> Writer 1C overwrite territory
same/blank      same/blank        KEEP
```

Required source evidence remains `CII_NODENAME_FIXED_LAYOUT`.

Every non-NODENAME mutable family is rewritten to:

```text
status = BLOCKED
action = BLOCKED
blocker = WRITER_2_PHASE1_NODENAME_ONLY
```

The adapter intentionally removes only the raw-plan blocker `NO_TRANSFERABLE_PREVIEW_OPERATIONS` when Writer 2 can replace the old blocked NODENAME DELETE policy with an authorized Writer-2 DELETE. Other plan blockers are retained.

## 5. Qualification finding QF-1013-001 — false Writer-2 availability

Initial routing used generic `previewReadyCount` to decide whether Writer 2 had work.

That count includes unchanged `KEEP` rows. A preview containing only unchanged/protected operations could therefore appear eligible even with no Writer-2 mutation.

Fixed by introducing the exact predicate:

```text
family == NODE_NAME
property == Node name / to-name
action in {CREATE, DELETE}
status == PREVIEW_READY
policyAuthority == CII_WRITER_2_NODENAME_RELOCATION
```

The plan is blocked with:

`NO_WRITER_2_NODENAME_TRANSFERABLE_OPERATIONS`

unless at least one operation satisfies all of those conditions.

## 6. Explicit transfer scope

`cii-workspace-transfer-scope.js` now routes `writerVersion === '2'` to `ciiWriter2NodeNameReadiness(...)`.

Therefore a Writer-2 preview is not mutation-ready until:

```text
transferScope.status == BOUND
AND at least one Writer-2 NODENAME CREATE/DELETE is APPLY
AND all Phase-4A physical/readiness gates pass
```

Blocked or irrelevant rows may be explicitly EXCLUDED and remain in audit custody. If a non-Writer2 row is manually set to APPLY, Phase-4A rejects the transaction.

## 7. Core apply lifecycle

Core Writer 2 flow:

```text
explicit writerVersion = 2
 -> current TARGET re-intake
 -> stale TARGET SHA check
 -> applyCiiWriter2NodeNameRelocation(...)
 -> re-intake Writer-2 bytes
 -> validateCiiWriter2NodeNameRoundTrip(...)
 -> CIIWorkspaceTargetApplyResult
```

`applyCiiWorkspaceTargetWriter2(...)` is the public core entry point.

Writer-2 and Writer-1C modified targets are re-intaken from `bytes`, not from reconstructed text.

## 8. Product/export lifecycle

The scoped engineering shell now dispatches version `2` to `applyCiiWorkspaceTargetWriter2`.

For download:

```text
WRITER_1C -> authoritative byteString
WRITER_2  -> authoritative byteString
other writers -> text path retained
```

This is mandatory for Writer 2 because NODENAME row insertion/deletion changes byte length and downstream offsets.

The product tile itself remains generic and already mounts `mountCiiWorkspaceScopedEngineeringShell`; no Writer-2 default was added to the tile.

### Legacy direct shell note

`mountCiiWorkspaceShell` is not the Writer-2 product surface. If a caller bypasses the scoped shell and tries to apply a Writer-2 preview through the legacy Writer-1 dispatcher, the core preview-version mismatch gate fails closed before mutation. PR1013 does not broaden that legacy shell.

## 9. Inherited Writer-1 regression compatibility

`tests/cii-workspace-writer1c-routing.test.js` previously asserted the supported core version list as exactly `1A/1B/1C`.

It now asserts `1A/1B/1C/2` while retaining:

```text
production default == Writer 1B
Writer 1C one-preimage composite contract unchanged
Writer 1C explicit scope routing unchanged
Writer 1C is not silently selected by the product tile
Writer 2 is not silently selected by the product tile
```

No Writer-1 mutation implementation file is changed by PR1013.

## 10. Regression inventory

New test:

`tests/cii-workspace-writer2-product-routing.test.js`

Authored cases:

1. blank TARGET -> CREATE;
2. named TARGET + blank SOURCE -> DELETE;
3. old raw DELETE blocker is replaced only by the Writer-2 explicit relocation policy;
4. nonblank overwrite -> Writer-1C blocker;
5. PROCESS P3 -> Writer-2 Phase-1 blocker;
6. unrelated plan blocker remains authoritative;
7. KEEP + PROTECTED only -> no Writer-2 availability;
8. unbound transfer scope -> readiness blocked;
9. bound zero-pointer CREATE -> Phase-4A relocation readiness;
10. static core version/default guard;
11. static scope-bound Writer-2 readiness routing;
12. static binary-authoritative Writer-2 download routing;
13. static product tile deliberate-host-selection guard.

## 11. Executed validation truth

```text
PR1012 merge / base grounding                         PASS
branch ancestry                                      PASS_GIT_COMPARE
branch changed-file boundary                         PASS_GIT_COMPARE
exact writer2-routing Git blob syntax                PASS_ISOLATED_EXACT_WRITER2_ROUTING
exact writer2-routing create/delete gates            PASS_ISOLATED_EXACT_WRITER2_ROUTING
exact writer2-routing overwrite gate                 PASS_ISOLATED_EXACT_WRITER2_ROUTING
exact writer2-routing non-node gate                  PASS_ISOLATED_EXACT_WRITER2_ROUTING
exact writer2-routing empty-availability falsifier   PASS_ISOLATED_EXACT_WRITER2_ROUTING
repository Writer2 product-routing regression         AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer1A/1B/1C regressions                 NOT_RUN_ENVIRONMENT
full npm test                                        NOT_RUN_ENVIRONMENT
browser Product flow                                 NOT_RUN_ENVIRONMENT
real CII Writer2 end-to-end export                   NOT_RUN_ENVIRONMENT
```

The exact routing file executed in the isolated harness had Git blob SHA:

`0748657f49956acaf01f5d0c9c0a205474f9a7bd`

which matched the branch blob at the time of execution.

The execution container still cannot resolve `github.com`, so a complete exact checkout is unavailable. No repository/browser test that was not executed is represented as PASS.

## 12. Changed-file ledger

Implementation/test paths:

```text
tabs/cii-workspace/cii-workspace-core.js
  add Writer 2 version, preview contraction, readiness, apply, re-intake and validation

tabs/cii-workspace/cii-workspace-transfer-scope.js
  recalculate Writer-2 readiness after explicit scope binding

tabs/cii-workspace/cii-workspace-transfer-scope-ui.js
  Writer-2 apply dispatch and binary-authoritative export

tabs/cii-workspace/cii-workspace-writer2-routing.js
  new Writer-2 NODENAME-only product routing contract

tests/cii-workspace-writer2-product-routing.test.js
  focused routing/fail-closed regression

tests/cii-workspace-writer1c-routing.test.js
  inherited version-enumeration/default-authority guard update
```

Recovery paths are this workreport, `agents/status/PR1013.yaml`, `agents/claims/PR1013.yaml`, and `agents/MASTER_INDEX.md`.

No parser, protected converter, benchmark CII, workflow, Writer1A implementation, Writer1B implementation, Writer1C implementation, Phase-4A planner, or Phase-4B writer/validator is modified.

## 13. Explicit exclusions

PR1013 does not authorize:

```text
SIF/TEE block create/delete
hanger create/delete
HGRDAT semantic construction
MISCEL_1 packed-array relocation
generic auxiliary section insertion/deletion
node creation/deletion
element creation/deletion
connectivity mutation
split/merge topology operations
Writer 3
```

## 14. Exact next action

Before merge, run from an exact PR1013 checkout if execution becomes available:

```text
focused Writer2 product-routing test
PR1011 Phase-4A tests
PR1012 Phase-4B write/validation test
Writer1C routing/composite regressions
full npm test
browser flow with deliberate writerVersion='2'
real CII CREATE and DELETE export + re-intake
```

Do not merge without owner authorization.

## Appendix A — takeover qualification

A takeover engineer should be able to answer all of the following before changing authority:

1. Why is Writer 2 routed through an adapter rather than by changing shared transfer-policy semantics?
2. Why must Writer 2 use base deltas only in Phase-1?
3. What exact source/target-name states map to CREATE, DELETE, KEEP and BLOCKED?
4. Why is nonblank overwrite Writer 1C territory rather than Writer 2?
5. What evidence token authorizes a NODENAME routing candidate?
6. Why does `previewReadyCount` not prove Writer-2 availability?
7. What exact predicate defines a Writer-2 cardinality mutation?
8. What happens when a blocked PROCESS/SIF/etc. row is EXCLUDED versus APPLY?
9. Why must Writer-2 output be downloaded from bytes rather than text?
10. Which merged component independently validates the variable-length postimage?
11. Why does the default remain Writer 1B?
12. What evidence would be required before adding SIF-block or hanger cardinality to Writer 2?

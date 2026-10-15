# Qualification answer — CII-W2-NB-R1-QS-0001

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-CII-W2-NB-R1-FIXED-FORMAT-SUBGRAPH
QUESTION_SET_ID: CII-W2-NB-R1-QS-0001
QUALIFICATION_BASIS_HEAD: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
PROGRAM_BASIS_REVISION: PB-0003
CANDIDATE_ID: chatgpt:e37d9cd9-b51b-4b1e-94f1-c75a4a55f52b
ADMISSION_AUTHORITY_ID: OWNER_CHAT_2026-09-16T04:57:31Z_PROCEED_NEXT
QUESTION_SET_ADMISSION_STATUS: VALID_BY_OWNER_PROGRESSION
CANDIDATE_ANSWER_STATUS: COMPLETE
INDEPENDENT_VERDICT_STATUS: PENDING
QUALIFICATION_STATE: ANSWERED_PENDING_INDEPENDENT_VERDICT
WRITE_AUTHORITY: READ_ONLY

## Admission basis

The Owner was shown the complete refreshed Q1-Q5 pack in the immediately preceding active handover and then issued the canonical `proceed next` progression command. Under the current Common skill, explicit current Owner instruction is highest current authority and `proceed next` advances one bounded progression. This receipt therefore treats that command as Owner admission of the displayed current set for the purpose of taking the qualification. It is **not** treated as an independent PASS verdict and does not itself grant write authority.

## Live repository evidence used

All answers below were grounded against exact main `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`.

- `tabs/cii-workspace/cii-workspace-propagation.js` blob `0a422dfaae61a60d0eabe217cd47457adb543de6`
- `tabs/cii-workspace/cii-workspace-multi-base-correspondence.js` blob `fdedb84add2faac6b38bff9300fe79224c8808e5`
- `tabs/cii-workspace/cii-workspace-nodename.js` blob `050df81250d62cc454856e403d6e4ffc85fd9321`
- `parser/fixed-field.js` blob `485daa43553681ca54f488499e57f36d2239be58`
- `tabs/cii-workspace/cii-workspace-transfer-policy.js` current main
- `tabs/cii-workspace/cii-workspace-writer1c-nodename.js` blob `4eda5077279393b2256612fefd5581f09cd95f2e`
- `tabs/cii-workspace/cii-workspace-writer2-composite-routing.js` current main
- `tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js` current main
- `tabs/cii-workspace/cii-workspace-writer2-nodename-write.js` blob `eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c`
- `tabs/cii-workspace/cii-workspace-multisource-bm001-correspondence.js` blob `49f36802993fa8bb85464906540fc7ab4a954726`
- `tabs/cii-workspace/cii-workspace-multisource-scope.js` blob `04f9241c5daaf8deb7d244f2e8b7f5af1084c3eb`
- `tabs/cii-workspace/cii-workspace-multisource-preview.js` blob `12f203c79fb02ccc5b1832378ba6ab2a8db0f00d`
- `tabs/cii-workspace/cii-workspace-core.js` blob `cee2858a63992648edf5e61b8f63b3837a937f9e`
- `tabs/cii-workspace/cii-workspace-writer-version-bridge.js` blob `b929c0d3b2a1c32d47a11f2cc190b4a167374ee9`
- `tabs/cii-workspace/cii-workspace-v14-change-projection.js` current main
- `tests/cii-workspace-multisource-partial-texpected-oracle.js` blob `d4c3941a5a0056fca925831113b3ea1b69e16dc0`

## Q1 — Production trace and correspondence boundary

### Trace

`buildCiiMultiBaseCorrespondence()` selects the correspondence engine per ready loop. `METHOD_B_NETWORK` and one-anchor legacy loops call `propagateSingleCiiAnchorCorrespondence()`. That propagation maintains one-to-one source-edge, target-edge, source-node and target-node custody maps.

At each visited `(sourceNode,targetNode)` pair it computes unclaimed source and target frontiers and calls `frontierAssignment(sourceEdges,targetEdges,matchOptions)`.

The present first wrong condition is exact and precedes candidate scoring:

```js
if (sourceEdges.length !== targetEdges.length) {
  return { status: 'BLOCKED', blocker: 'FRONTIER_CARDINALITY_MISMATCH' };
}
```

For the required positive case:

```text
source frontier: S = {s1,s2}        |S| = 2
target frontier: T = {t1,t2,t3}     |T| = 3
```

where `(s1,t1)` and `(s2,t2)` are uniquely supported and `t3` is an unrelated target-only branch, the current implementation blocks on `2 !== 3`; `candidateMatrix()` and `enumerateAssignments()` never execute.

There is a second whole-component false rejection at the end of propagation. Even if all source edges were successfully claimed, any unclaimed edge in the target connected component causes:

```text
TARGET_COMPONENT_NOT_FULLY_CLAIMED
```

and therefore final status `UNRESOLVED`.

### Required injective condition

The existing assignment enumerator already contains the core injectivity mechanism: it tracks used target indexes and never permits two source rows to choose the same target index. Therefore the minimal mathematical requirement is:

```text
|S| <= |T|
AND
there exists an injective f : S -> T
such that for every s in S:
  candidate(s,f(s)).identitySupported == true
  candidate(s,f(s)).hardFail == false
```

The winner-gap ambiguity rule remains unchanged. If two different target subsets are nearly equivalent, the correspondence stays AMBIGUOUS/REVIEW rather than silently choosing one.

The positive `2 -> 3` case should therefore enumerate mappings of both source edges into distinct members of the three-edge target frontier and leave `t3` recorded as target-only/external evidence.

Two additional completion changes are required for that semantics:

1. when there are zero remaining source edges at a visited source leaf, extra target edges must not manufacture a source failure; they remain target-only evidence;
2. unmatched **source** component edges remain a blocker (`SOURCE_COMPONENT_NOT_FULLY_PROPAGATED`), but unmatched **target** component edges must no longer by themselves add `TARGET_COMPONENT_NOT_FULLY_CLAIMED` as a failure.

### Negative/falsifier

If one required source edge has no compatible target edge, no complete injective assignment exists and the current enumerator naturally yields `NO_SUPPORTED_FRONTIER_ASSIGNMENT`; that must remain blocking.

If two source edges are compatible only with the same single target edge, the enumerator's `used` set prevents a two-row assignment; that is also blocking.

Therefore the repair is not “ignore degree mismatch”; it is “require complete injective coverage of every required source edge while tolerating unused target-only branches.”

## Q2 — Fixed-format NodeName physical reconstruction

### Physical coordinates

Current `cii-workspace-nodename.js` establishes:

```text
ELEMENT block size                    = 15 rows
NODENAME pointer row offset           = 13 (zero-based within block)
pointer fixed field                   = [67,80) => width 13
NODENAME FROM                          = [2,28)  => width 26
NODENAME TO                            = [28,53) => width 25
NODENAME physical row payload width   = 53
```

The pointer is numeric field index 5 under canonical widths `[15,13,13,13,13,13]`:

```text
start = 15 + 4*13 = 67
end   = 67 + 13   = 80
```

CONTROL.NONAM is field index 3 under the same width sequence:

```text
start = 15 + 2*13 = 41
end   = 41 + 13   = 54
width = 13
```

### Same-cardinality REPLACE

Writer1C already owns the correct primitive. For a reviewed exact source name B replacing target name A in an existing physical field:

1. locate all exact physical spans whose owner node is the selected target node;
2. require exact current semantic preimage A;
3. ASCII-check B and require `len(B) <= span.width`;
4. write `B.padEnd(span.width,' ')` over the exact original span;
5. reject shared-record side effects if another owner of that physical span is unselected;
6. reject conflicting after-images or overlapping claims.

Allowed bytes for a pure REPLACE are only the selected existing NODENAME field span(s). Consequences that must remain invariant:

```text
file byte length            unchanged
physical NODENAME row count unchanged
CONTROL.NONAM               unchanged
ELEMENT NODENAME pointers   unchanged
section ordering            unchanged
existing line endings       unchanged
all unrelated bytes         unchanged
```

For a single unique TO field the mutation is exactly 25 bytes; for a single unique FROM field it is exactly 26 bytes. The semantic string may be shorter, but the physical field replacement is equal width.

### Zero-pointer CREATE

Writer2 relocation correctly owns structural CREATE. It requires an exact element binding with pointer `0`. It may fill qualified redundant blank occurrences for the same node when safe, and creates/appends a canonical 53-character NODENAME row associated with the selected element group. It then derives new pointer values after any deletion/compaction and sets:

```text
CONTROL.NONAM_after = finalRows.length
```

Affected pointer fields are exact 13-byte `[67,80)` claims. CONTROL.NONAM is an exact 13-byte `[41,54)` claim. The Writer2 writer uses decimal integer text right-justified to 13 columns; values such as `5.000000`, `5E+00`, or `5D+00` are illegal in these I13 fields even though numerically equivalent to 5.

Writer2 section rebuilding also preserves the existing per-row line ending and uses the retained section ending for appended rows.

### Why whitespace / generic G formatting is not authority

`parser/fixed-field.js` explicitly documents legal adjacent FORTRAN fields such as:

```text
0.000000-0.488281E-03
```

and decodes canonical numeric rows by fixed widths first. Whitespace tokenization is only a compatibility fallback for shorter/noncanonical rows. Reformatting an unchanged numeric row with a generic Python/JS format could alter sign adjacency, exponent spelling, significant digits, compact row width, padding or D/E notation. Therefore unchanged numeric fields stay byte-identical; changed numeric fields must go through an existing edition-qualified fixed-field writer, while pointer/count changes use explicit I13 formatting.

## Q3 — Authority/invariant for REPLACE vs CREATE/DELETE

### Current boundaries

`classifyCiiTransferDelta()` already has an opt-in overwrite gate. A changed NODE_NAME with source and target both nonblank is blocked by `TARGET_NODENAME_NONBLANK` unless `allowNodeNameOverwrite === true`; when explicitly allowed, it remains action `COPY` with policy authority `CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD`.

The lower Writer1C NodeName planner is already safe for that action. It requires PREVIEW_READY, REVIEWED/LOCKED match authority, explicit APPLY, the exact Writer1C policy, exact target physical custody and exact preimage.

Writer2 is intentionally a different authority. `applyCiiWriter2CompositePlanContract()` admits NodeName mutation only for CREATE/DELETE and publishes:

```text
nodeNameMutation: CREATE_DELETE_RELOCATION_ONLY
nodeNameOverwrite: WRITER_1C_ONLY
```

`buildCiiWriter2NodeNameRelocationPlan()` likewise filters only CREATE/DELETE. This is a correct NO-PATCH boundary.

The current multisource workflow loses REPLACE later because:

- `targetMutationConflicts()` in `cii-workspace-multisource-preview.js` examines only CREATE/DELETE;
- `ciiWriter2NodeNameCardinalityOperation()` in `cii-workspace-multisource-bm001-correspondence.js` recognizes only CREATE/DELETE;
- `ciiCanonicalWriter2MutationSelection()` therefore selects only structural cardinality changes;
- `createCiiExpectedNodeNameSourceSetSelection()` consumes that structural-only canonical set.

### Smallest safe composition

The safe semantic split is:

```text
KEEP     -> no physical writer
REPLACE  -> Writer1C existing-row exact-span authority
CREATE   -> Writer2 NodeName relocation
DELETE   -> Writer2 NodeName relocation
```

Do not add nonblank overwrite support to Writer2 relocation or the V14 cardinality projector.

The multisource preview/selection layer must preserve qualified COPY operations rather than collapsing the user-visible universe to Writer2 cardinality operations. Exact target conflicts must consider COPY/REPLACE as well: two sources proposing different exact dotted names for one physical target are CONFLICT, not corroboration and not family-level resolution.

The overwrite opt-in must be scoped to this reviewed multisource NodeName workflow; it must not become a global default for unrelated Writer1/Writer2 preview paths.

### Mixed REPLACE + CREATE/DELETE transaction

Absolute spans from TARGET0 cannot be reused after a cardinality-changing NODENAME rewrite. Two coherent implementations are possible, but only one should be selected in production after a focused test:

**Preferred least-invasive sequencing:**

1. bind the user selection against immutable TARGET0;
2. apply all Writer1C same-length REPLACE claims to TARGET0; because every claim is equal width, offsets and file length remain stable;
3. re-intake the resulting target bytes as a new exact target preimage;
4. derive/rebind the internal structural CREATE/DELETE sub-plan against that re-intaken target, preserving the same reviewed source operations/provenance;
5. execute existing Writer2 relocation/bridge against the refreshed preimage;
6. validate the final postimage against original TARGET0 plus the full authorized mutation ledger.

This sequencing keeps the low-level Writer1C and Writer2 owners unchanged and satisfies the stale-offset invariant. Reusing the original absolute Writer1C claims after Writer2 has inserted/deleted NODENAME rows would fail qualification.

If scope/hash contracts make safe internal rebinding impossible without broad invasive changes, the alternative is a new high-level NodeName transaction planner that materializes REPLACE into row state before structural relocation while retaining one immutable original preimage. That is more invasive and therefore not the first choice.

### Existing blockers that must remain

- Writer1C semantic and raw preimage mismatch -> BLOCK.
- unselected shared-field owner affected by a REPLACE -> `WRITER_1C_NODENAME_UNAPPROVED_ALIAS_EFFECT` -> BLOCK.
- conflicting requested after-images for one physical span -> BLOCK.
- two physical claims that overlap -> BLOCK before apply.
- zero pointer in Writer1C -> CREATE must route to Writer2.
- canonical/family equality (`SL-106`) alone never chooses an exact sibling (`SL-106.3` vs `.4`).

### V14 authority

Pure same-cardinality V14 REPLACE should bypass `projectCanonicalV14WriterDelta()`. The current projector explicitly rejects equal-cardinality cardinality-unit replacement and its special NODENAME merger permits only blank↔nonblank transitions; nonblank→different-nonblank is deliberately blocked. That projector should remain structural-cardinality authority rather than being weakened to carry Writer1C replacement.

## Q4 — Independent byte/section oracle

### Independent parser/checker boundary

The checker must not import production splice, relocation or V14 projector functions. It may use an independent test parser/scanner with fixed format constants duplicated intentionally as oracle code.

For TARGET0 and OUTPUT, independently scan raw bytes into section envelopes while retaining:

```text
section marker bytes
row bytes
row start/end offsets
line-ending bytes
```

Independently parse:

```text
ELEMENTS blocks        = 15 rows
ELEMENT pointer field  = [67,80)
NODENAME FROM          = [2,28)
NODENAME TO            = [28,53)
CONTROL.NONAM          = [41,54)
```

### Pure REPLACE oracle

Build the allowed field set from selected operation target node IDs plus independent TARGET0 pointer/name ownership, not from production writer claims. Assert:

```text
len(OUTPUT) == len(TARGET0)
all changed byte offsets are inside independently-derived selected NODENAME spans
CONTROL raw payload identical
all ELEMENT rows/fields identical
NODENAME row count identical
all unselected NODENAME semantic values identical
selected names equal exact source raw names
all section headers and line endings identical
```

A one-byte change anywhere else fails.

### Structural/mixed oracle

When NODENAME cardinality changes, absolute downstream byte offsets shift, so the independent comparison must be section-aware rather than naïvely offset-global:

- `CONTROL`: mask only the independently derived NONAM `[41,54)` field and require all other bytes exact.
- `ELEMENTS`: mask only exact NODENAME pointer `[67,80)` fields whose values actually require relocation; require every other byte exact.
- `NODENAME`: independently parse final rows; validate selected exact payload, unselected payload preservation where ownership survives, row cardinality and legal physical widths.
- every other section, especially `SIF&TEES`, `RIGID`, `RESTRANT`, MISC/hanger, FLANGES, FORCMNT and ALLOWBLS: raw section bytes must equal TARGET0 exactly, including row order and line endings.

Postimage equations:

```text
CONTROL.NONAM == physical NODENAME row count
for every ELEMENT NODENAME pointer p:
  p == 0 OR 1 <= p <= physical NODENAME row count
```

Each pointer/count field must be exactly 13 characters and match an I13 lexical form: leading spaces followed by decimal digits only. No `.`, `E/e`, or `D/d` is admitted.

### SIF drift falsifier

Take an otherwise correct NodeName output and flip one byte in the raw `SIF&TEES` payload. The independent raw-section equality check must fail even if:

- NodeName count/pointers are correct;
- V14→V11 conversion still succeeds;
- a broad production projector would otherwise consider SIF&TEES a projectable section.

This proves the checker is narrower than the production projector's generic allowed-section set.

### Partial TEXPECTED policy

The historical independent T→TEXPECTED census remains a known-positive witness:

```text
CONTROL.NONAM / physical NODENAME 1265 -> 1266
semantic NODENAME deltas             36
CREATE                                 1
DELETE                                 0
REPLACE                               35
```

For an **oracle-slice** run that applies only those known benchmark operations, exact aggregate count/occupancy/structural comparison to TEXPECTED is valid.

For the **full-discovery** run, TEXPECTED absence is UNKNOWN, not false. The checker therefore requires every known-positive TEXPECTED witness to be satisfied or explicitly accounted for, while additional reviewed source-derived REPLACE operations are validated by source exact identity + correspondence + target preimage. Full-run aggregate cardinality is derived from the actual selected operation set and the final physical postimage, not forced to TEXPECTED's aggregate if future independently qualified structural changes extend beyond it.

The current `evaluatePartialTExpectedPostimage()` compares aggregate count and occupancy to TEXPECTED; it is therefore appropriate for the benchmark slice, not as the sole full-discovery acceptance function. Its raw identity helper currently handles CREATE/DELETE and should be extended or complemented for exact REPLACE testimony.

## Q5 — Minimal coherent patch and rollback

### First proven production changes

**1. `tabs/cii-workspace/cii-workspace-propagation.js`**

Patch only the source-subgraph boundary:

- `frontierAssignment()` must block only when required source degree exceeds available target degree, not whenever degrees differ;
- continue using the existing injective assignment enumerator and winner-gap ambiguity gate;
- a visited source node with no unclaimed source edges may terminate successfully even when target-only edges remain;
- keep `SOURCE_COMPONENT_NOT_FULLY_PROPAGATED` blocking;
- retain `unmatchedTargetElementIds` as evidence but stop making target-only remainder an automatic whole-component blocker.

NO-PATCH: candidate scoring, node/edge custody conflict handling, source-completeness blocker and ambiguity/winner-gap logic stay unchanged unless a focused falsifier proves otherwise.

**2. multisource NodeName selection/orchestration**

The structural-only filters are first wrong for same-cardinality replacement:

- `cii-workspace-multisource-preview.js::targetMutationConflicts()` must include qualified COPY/REPLACE proposals so different exact names to the same target conflict explicitly;
- the multisource operation classifier/canonical selection in `cii-workspace-multisource-bm001-correspondence.js` must distinguish safe existing-field REPLACE from Writer2 cardinality CREATE/DELETE rather than treating “writable” as synonymous with Writer2 relocation;
- `cii-workspace-multisource-scope.js` must select the reviewed qualified NodeName operation set across both routes while retaining per-operation writer policy authority;
- preview construction must explicitly enable NodeName overwrite classification only for this bounded reviewed multisource workflow so valid COPY candidates are not hidden by `TARGET_NODENAME_NONBLANK`.

NO-PATCH: BM-001/TEXPECTED must not become production selection authority beyond corroboration already allowed; extra independently qualified source operations must not be vetoed simply because the partial benchmark lacks them.

**3. high-level apply orchestration**

Add the smallest orchestration seam that partitions the bound NodeName selection into:

```text
Writer1C sub-scope: COPY/REPLACE
Writer2 sub-scope: CREATE/DELETE
```

Apply equal-width Writer1C first, re-intake, then apply existing Writer2 structural route against refreshed target custody, or prove a single-preimage composite equivalent. Do not teach Writer2 relocation to perform arbitrary nonblank replacement.

NO-PATCH boundaries:

- `cii-workspace-writer1c-nodename.js` already has the required exact-span/preimage/shared-owner behavior;
- `cii-workspace-writer2-nodename-relocation.js` remains CREATE/DELETE only;
- `cii-workspace-writer2-nodename-write.js` remains structural count/pointer/NODENAME-section writer unless a retained test exposes a concrete physical defect;
- `cii-workspace-v14-change-projection.js` remains blank↔nonblank/cardinality projection authority; do not weaken its nonblank overwrite blocker;
- frozen converter, SIF/HANGER/RESTRANT CREATE semantics and workflow files remain untouched.

### Minimum tests before/after

1. propagation positive: source degree 2, target degree 3 with one unrelated branch -> READY/qualified source mapping; external target branch recorded.
2. propagation negative: one required source edge has no supported target -> BLOCK.
3. injectivity negative: two required source edges compete for one supported target edge -> BLOCK.
4. multisource transfer: reviewed nonblank A -> exact source B becomes visible/selectable REPLACE with Writer1C policy.
5. sibling negative: `.3` and `.4` same family cannot resolve by canonical family alone.
6. pure direct-V14 REPLACE: file length, CONTROL, ELEMENT pointers and every nonselected byte unchanged.
7. stale preimage and shared-alias negatives remain BLOCK.
8. mixed REPLACE + CREATE: same final semantic result under sequential re-intake and any atomic reference implementation; no stale-span failure.
9. one-byte SIF&TEES postimage corruption -> independent oracle FAIL.
10. TEXPECTED benchmark slice independently reproduces `1265->1266`, CREATE=1, DELETE=0, REPLACE=35.
11. additional independently qualified TEXPECTED-absent REPLACE remains valid and is reported separately, not counted as a benchmark false positive.
12. compact numeric rows and original line endings outside authorized mutation closure remain byte-identical.

### Expected before/after evidence

Before patch:

```text
extra target branch -> FRONTIER_CARDINALITY_MISMATCH / TARGET_COMPONENT_NOT_FULLY_CLAIMED
nonblank replacement -> blocked or excluded from canonical multisource Writer2 selection
```

After patch:

```text
all required source topology maps injectively; target-only branch retained as evidence
reviewed exact REPLACE appears with Writer1C physical authority
CREATE/DELETE still route through Writer2 relocation
pure REPLACE touches selected NODENAME spans only
NodeName-only transaction produces zero SIF/TEE and unrelated-section byte drift
```

### Rollback boundary

The revision should be independently reversible in three modules:

1. source-subgraph correspondence behavior;
2. multisource NodeName operation selection/conflict classification;
3. high-level REPLACE+structural apply orchestration and its independent oracle/tests.

If any layer fails its focused falsifier, revert only that module to its pre-edit snapshot; do not weaken benchmark/oracle expectations or modify frozen converter/SIF authorities to make the test pass.

## Candidate conclusion

The lowest-level fixed-format mechanisms are substantially safer than the current high-level workflow. The root defects for the requested capability are (a) strict full-component graph equivalence and (b) structural-only multisource NodeName selection/orchestration. The safe implementation should reuse Writer1C exact-span replacement and Writer2 cardinality relocation as separate physical authorities, with re-intake between them when structural cardinality changes are present.

This is a candidate technical answer only. No self-score or PASS is asserted. Independent verdict remains required before production mutation.
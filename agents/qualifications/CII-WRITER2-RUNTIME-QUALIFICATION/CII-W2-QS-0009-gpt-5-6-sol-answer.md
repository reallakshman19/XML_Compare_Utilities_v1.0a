# CII-W2-QS-0009 — candidate takeover answer

CANDIDATE: GPT-5.6 Sol
CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
QUESTION_SET_ID: CII-W2-QS-0009
QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
ROLE: CANDIDATE_ONLY
SELF_VERIFICATION: PROHIBITED
WRITE_AUTHORITY: FALSE

## Q1 — Production Trace

The unchanged W2 A entrypoint is `tests/cii-workspace-writer2-restraint-product-routing.test.js`, blob `9922377ddeda86fc9167d65f33c97095346e79fa`.

The test first builds the synthetic fixture and routes its RESTRAINT block-delete operation with `applyCiiWriter2CompositePlanContract()`. Its first authored assertion is:

```js
assert.equal(routedPlan.status, 'PREVIEW_READY', routedPlan.blockers.join('|'));
```

Therefore module/environment failure before that assertion is still `NOT_RUN`; reaching that assertion and failing it is the first authored W2 A `FAIL`.

For the public execution portion, the test calls:

```text
applyCiiWorkspaceTargetWriter2(preview, originalBytes, { cryptoRef: webcrypto })
```

The exact core path on the qualification basis is:

```text
applyCiiWorkspaceTargetWriter2()
  -> applyWriter(..., '2')
     -> currentTargetFor()
        -> intakeCiiWorkspaceDocument(targetInput, ...)
        -> compare currentTarget.contentSha256 to preview.targetDocument.contentSha256
        -> CII_WRITER_2_STALE_TARGET_HASH on mismatch
     -> adaptCiiDocumentToTopologyGraph(currentTarget)
     -> applyLowLevelWriter('2', ...)
        -> writer2HasRestraintApply(preview.transferPlan) == true
        -> applyCiiWriter2CompositeWithRestraintDelete(...)
     -> intakeCiiWorkspaceDocument(writerResult.bytes, ...)
        [canonical postimage re-intake]
     -> validateCiiWriter2ProductRoundTrip(
          currentTarget, modifiedTarget, targetGraph,
          preview.transferPlan, writerResult)
     -> return CIIWorkspaceTargetApplyResult.v1 / PASS
```

The authored W2 A assertions then require the public result to be `PASS`, writer `WRITER_2`, exact byteString equality with the direct composite result, validator `PASS`, validator class `RESTRAINT_DELETE_COMPOSITE`, and zero unexpected semantic deltas.

Static graph closure proves that every observed repository import needed by this route has a pinned repository source. It does not prove that Node successfully loads those exact bytes together or that any authored assertion passes. Runtime evidence begins only when the unchanged entrypoint executes.

## Q2 — Current Unresolved Problem / Failure Isolation

The current unresolved problem is exact repository-byte materialization, not Node availability and not a demonstrated Writer2 defect.

Minimum admissible experiment:

1. obtain an exact checkout of `reallaksh19/XML_Compare_Utilities@a9018c131be736606e44fd0379545d233238f33e` without source reconstruction or import rewriting;
2. prove `git rev-parse HEAD` equals that SHA;
3. prove `git hash-object tests/cii-workspace-writer2-restraint-product-routing.test.js` equals `9922377ddeda86fc9167d65f33c97095346e79fa`;
4. require a clean working tree before execution;
5. run unchanged `node tests/cii-workspace-writer2-restraint-product-routing.test.js` and retain raw stdout/stderr and exit code;
6. require the working tree to remain clean afterwards.

Prediction under the current environment-only hypothesis: once exact bytes are available, module loading advances into authored W2 A code.

Falsifier: the exact checkout loads the test and reaches an authored assertion/product exception. Any such failure becomes `FAIL` and supersedes the environment-only hypothesis.

A sparse/manual reconstruction, rewritten import graph, stub, copied partial core, regenerated entrypoint, or workflow bypass cannot convert `NOT_RUN` into public W2 A PASS because it changes the runtime substrate whose public route is being qualified. Focused exact-blob family tests remain narrower evidence and cannot substitute for the public product route.

## Q3 — Authority / Invariant

While W2 A is `NOT_RUN`, the following remain unqualified:

```text
W2 A                 NOT_RUN
BM-W2-01 public      NOT_RUN
BM-W2-02 public      NOT_RUN
BM-W2-03 public      NOT_RUN
BM-W2-04 public      NOT_RUN
W2 B                 NOT_RUN
W2.35                 NOT_RUN
W2.35a                NOT_RUN
W2.40                 NOT_RUN
W2 H                  NOT_READY
```

No static closure or focused PR #1062 PASS grants:

- SIF CREATE authority;
- Writer3/topology mutation authority;
- benchmark/oracle expected-value mutation;
- tolerance weakening;
- workflow mutation/bypass as qualification evidence;
- widened raw SIF field-2 semantics beyond explicitly qualified uses;
- permission to reinterpret an environment stop as PASS or Writer2 FAIL.

Protected engineering invariants remain lexical I13 pointer/count custody, 24-row RESTRAINT blocks, exact pointer ownership/cardinality, target0 hash custody, postimage re-intake, topology preservation and unrelated-byte negative assurance.

## Q4 — Independent Validation

Frozen W2 A fixture restraint pointers are:

```text
ELEMENTS: [1, 2, 3, 0]
CONTROL restraint block count: 3
RESTRANT blocks: 3
rows/block: 24
rows before: 3 * 24 = 72
```

Deleting physical block/pointer 2 yields the old-to-new pointer map:

```text
old 1 -> new 1
old 2 -> new 0
old 3 -> new 2
old 0 -> new 0
```

Therefore:

```text
ELEMENT restraint pointers: [1,2,3,0] -> [1,0,2,0]
CONTROL restraint count:     3 -> 2
RESTRANT rows:                72 -> 48
retained old blocks:          1 and 3, in original order
```

Lexical I13 means the physical 13-character pointer/count field must contain an integer token, whitespace padded as an integer field. Accepted examples include `            0`, `            2`, `           12` when width is exactly 13. Floating/scientific forms such as `6.000000`, `6.000000E+00` and `6.000000D+00` are rejected even if numerically equivalent.

Independent negative assurance requires:

- only CONTROL restraint count, affected ELEMENT restraint-pointer fields and the RESTRANT section payload may differ;
- retained RESTRAINT block bytes are copied unchanged and compacted only by deletion of block 2;
- element count, endpoints and topology remain unchanged;
- unrelated NODENAME/SIF/HANGER/other section bytes remain unchanged;
- the complete postimage, not only parseability, must match the independently reconstructed expectation.

Implementation testimony consists of the Writer2 planner/writer and implementation-coupled product path. Independent evidence is the arithmetic above plus the separately authored retained-real `INDEPENDENT_STRUCTURAL_POSTIMAGE` BM-W2-04 oracle. BM-W2-04 validates the compaction class independently but does not replace W2 A public runtime.

## Q5 — Next Contribution / Minimal Patch

If exact checkout becomes available, the unchanged sequence is:

```bash
git rev-parse HEAD
git hash-object tests/cii-workspace-writer2-restraint-product-routing.test.js
git status --porcelain=v1
node tests/cii-workspace-writer2-restraint-product-routing.test.js
git status --porcelain=v1
```

Required identities:

```text
HEAD = a9018c131be736606e44fd0379545d233238f33e
W2 A test blob = 9922377ddeda86fc9167d65f33c97095346e79fa
```

If the test first fails in an authored assertion/product exception:

1. retain raw stdout/stderr/exit code before editing;
2. identify the first wrong boundary in order: routing -> readiness -> direct RESTRAINT composite -> canonical re-intake -> product validation -> public/direct equality;
3. prove which expected intermediate first diverges;
4. patch only the production module owning that first divergence, plus the narrowest falsifier/regression required;
5. do not modify the frozen W2 A test, independent benchmark/oracle values, CREATE/topology authority or tolerances;
6. rerun the focused reproducer, unchanged W2 A, then BM-W2-01..04 public in the required order if W2 A passes.

If exact materialization remains unavailable, persist `W2_A = NOT_RUN`, record the precise environment/transport blocker, and leave production/tests/benchmarks/oracles/workflows unchanged.

## Candidate conclusion

The repository evidence supports READ_ONLY continuation only. There is no authored Writer2 product failure yet and therefore no engineering-critical production patch is justified. Candidate self-answer does not grant write authority; an independent verifier verdict remains required before any engineering-critical mutation after a future authored failure.
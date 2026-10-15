# BM-CII-W2-NB-R1-LOCAL-0004 — fix-and-run scratch validation

Date: 2026-09-16
Work item: `github:reallaksh19/XML_Compare_Utilities#1224`
Branch basis before this evidence commit: `649261d50779f59a975722e6c5a875d20043482f`
Main observed: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`
Owner instruction: `2026-09-16T19:24:26Z fix and run`

## Status

`PASS_LOCAL_SCRATCH_CANDIDATE_SEMANTICS`

This is **not** the retained-real S1/S2/S3/T/TEXPECTED benchmark and is not independent qualification evidence. It is a local semantic scratch harness used to re-check the packaged candidate boundaries while product mutation remains prohibited.

## Runtime

```text
node v22.16.0
command: node /tmp/cii_r1_fix_scratch.mjs
exit: 0
```

Observed stdout:

```text
SCRATCH_FIX_VALIDATION_PASS
{
  "propagation": {
    "originalExtraTarget": "FAIL_CARDINALITY",
    "candidateExtraTarget": "PASS",
    "missingRequiredTarget": "BLOCKED",
    "unmatchedTarget": "EVIDENCE_ONLY"
  },
  "mixedSelection": {
    "replace": ["r1"],
    "structural": ["c1", "d1"],
    "conflictingReplace": "BLOCKED",
    "unreviewedReplace": "REJECTED"
  }
}
```

## Assertions exercised

- Current equal-frontier rule rejects source degree 2 -> target degree 3.
- Candidate source-subset rule accepts source degree 2 -> target degree 3.
- Candidate still rejects source degree 3 -> target degree 2.
- Unmatched source edges remain blockers.
- Unmatched target-only edges are retained as evidence and are not blockers.
- Reviewed/locked nonblank -> different-nonblank NodeName `COPY` under `CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD` is classified as Writer1C REPLACE.
- Writer2 CREATE/DELETE remain separately classified under `CII_WRITER_2_NODENAME_RELOCATION`.
- Mixed selection partitions REPLACE from CREATE/DELETE.
- Conflicting same-target REPLACE proposals block.
- Unreviewed REPLACE is rejected.

## Authority / limitations

The harness reimplemented the exact already-inspected predicate shapes plus the proposed mixed predicate in scratch JavaScript; it did **not** import the branch modules from a mounted checkout. Therefore this result cannot be promoted to retained benchmark PASS, branch-module integration PASS, qualification PASS, or WRITE_ALLOWED.

No production file, retained CII input, oracle, or workflow was modified.

## Environment blocker

The local runtime still has no Git checkout and no retained `S1.CII`, `S2.CII`, `S3.CII`, `T.CII`, or `TEXPECTED-PARTIALLLYDONE.CII`. Issue #1224 still has no independent `PASS_QUALIFIED_READ_ONLY` verdict. Repository rules also require `node utils/backup.cjs save ...` and `.agent-worklogs` before product edits; those cannot be performed without a mounted checkout.

## Exact next action

Mount/provide the byte-faithful retained checkout, run the two retained Node benchmarks, obtain independent Q1-Q5 PASS, reconcile main/overlap, execute mandatory backup/patch-ledger custody, then apply `CANDIDATE-CII-W2-NB-R1-FIX-0001.md` beginning with the propagation correction.

# PR1078 Workreport — CII Find & Replace Post-Merge Qualification

## Delivery state

- Base: `main@c80aa9b4f670e90b831d65a9f16c775a50096271`
- UI/manual-grid delivery: merged via transport PR #1077 from exact head `fea952b44338070d5a646b503e96c668393b8b01`.
- Draft PR #1076 was closed unmerged only because the connected Draft→Ready mutation is broken; #1077 carried identical branch content.
- This PR: #1078, evidence/relay only.
- Merge authority: Owner-only; not granted for #1078.

## Merged product state

Main now contains:

- editable Excel-style Manual table entry;
- rectangular Excel/Sheets paste;
- deterministic Update Preview with CSV-row preservation;
- dirty-grid fail-closed gating;
- non-v14 blocker preservation;
- distinct ordered Section 5 workflow: Validate TARGET1 → Apply to New Copy → Download;
- separate Audit JSON action and workflow/KPI presentation;
- corrected zero-approved-row status message.

Protected invariants remain:

- TARGET0 is not overwritten;
- Writer1/Writer2 are not invoked;
- NODE NAME and DISPLACEMENT authority unchanged;
- FORCE remains blocked;
- no parser/converter/workflow authority widening.

## Post-merge execution truth

- GitHub PR workflow runs for merge commit `c80aa9b4f670e90b831d65a9f16c775a50096271`: none.
- Authored manual-grid/session/UI exact-checkout execution: `NOT_RUN / environment`.
- Current runtime has no authenticated repository checkout and no CI run attached to the merge commit.
- Source/diff inspection from the merged head remains PASS for bounded intent.
- No test PASS is manufactured from partial reconstruction.

## FORCMNT continuation

Superseded Draft PR #1075 was closed because it no longer merged cleanly after the UI leg. Its retained-corpus evidence has been carried forward in:

`agents/evidence/CII_FORCMNT_retained_oracle_scan.md`

Retained repository specimens inspected all have CONTROL `FORCMNT=0`. External CAESAR II documentation confirms the FORCMNT pointer join, force/moment semantic fields and two-spec / 20-row neutral-file structure, but public search did not produce a qualifying textual v14 `.CII` with nonzero FORCMNT.

Therefore:

```text
FORCE intake                          BLOCKED
FORCE mutable spans                   0
FORCMNT documented schema             PARTIAL_PASS
nonzero v14 physical ownership        NOT_QUALIFIED
FORCE mutation authority              NONE
```

## Exact next action

Acquire one exact CAESAR II v14 CII with CONTROL FORCMNT > 0 and a positive ELEMENT FORCMNT pointer. Preserve exact bytes/hash and prove pointer → 20-row block → both 10-row specs → node/vector semantics → unused-spec behavior → adjacent falsifiers before any FORCE product change. If an authenticated full checkout becomes available first, run the authored manual-grid/session/UI focused tests and record PASS/FAIL without upgrading unavailable gates.

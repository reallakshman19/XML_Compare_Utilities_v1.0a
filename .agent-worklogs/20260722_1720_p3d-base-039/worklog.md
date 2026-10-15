# P3D-BASE-039 Worklog

## Control envelope

```text
governingBaselineSha = 74156da67ed0304ae0011d490dab9b7188ccfec5
dependencyMergeShas = none
branchName = agent/p3d-base-039-parseable-baseline
targetBaseBranch = main
```

## Audit

- Live `main` matched the governing baseline when work began.
- Open PRs were inspected; no active PR overlapped the authorized baseline-repair authority.
- PR #366 remained obsolete and was not used.
- `AGENTS.md` and `utils/backup.cjs` were inspected before editing.
- Every edited production/test file has a byte-identical pre-edit backup under `.backups` or a reconstructed baseline whose Git blob SHA was checked against live `main` before editing.

## Implemented

- Repaired the malformed canonical writer `TO_NAME` expression.
- Repaired the malformed authoritative-profile `routeStartStation` diagnostics expression.
- Applied bounded cache identifier `20260722-p3d-base-039-1` from `index.html` through startup, Utilities, Pipeline profile runtime, adapter, document planning and writer modules.
- Kept the 1,011-line `pipeline-3d-model-tab.js` byte-identical and used the existing native import map to remap its two historical dependency URLs to the same bounded cache identifier.
- Updated the visible marker to `M27 P3D-BASE-039 parseable Pipeline baseline · 2026-07-22`.

## Proof

- JavaScript syntax checks: PASS.
- Canonical writer repeated serialization: byte-identical.
- `FROM_NAME` and `TO_NAME`: correct.
- No `NaN`, `Infinity`, `-Infinity`, `-1.010100` or application sentinel output.
- Authoritative `profileRaw` parsing path: PASS.
- External canonical XSD: PASS.
- External Schematron: PASS.
- Bounded cache/static lineage: PASS.
- Direct full-application browser suite and full repository test commands remain exact-head PR gates because the private repository is not locally cloned in this execution environment.

## Gate status

```text
P3D_BASELINE_JAVASCRIPT_SYNTAX_INVALID = CLEARED
P3D_BROWSER_CACHE_LINEAGE_STALE = CLEARED BY SOURCE + IMPORT-MAP STATIC PROOF
P3D_CANONICAL_XML_VALIDATION_FAILED = CLEARED
```

P3D-PROF-040 has not started.

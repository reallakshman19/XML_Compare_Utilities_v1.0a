# CII Find & Replace v14 — Scroll / Export focused validation

Basis: `main@06a6f9c16843389fcab0eaa03059eb41641b13bb`

Scope:
- force a stable vertical scrollbar in the editable Preview table;
- make the existing replaced-CII output boundary explicit as `Export Replaced CII`;
- preserve Validate -> Apply to New Copy -> Export custody;
- do not change CII resolver, validator, output artifact builder, Writer1/Writer2, or TARGET0 overwrite authority.

Validation:
- focused local source-contract check: PASS (scrollbar + export custody);
- branch changed-path review before evidence commit: PASS, exactly 4 material paths;
- retained `tests/cii-workspace-find-replace-output.test.js` remains the backend contract for `.find-replace.cii`, Apply-to-New-Copy requirement, hash custody, no overwrite, and no writer invocation; not relabeled as a new local run here;
- browser runtime interaction suite: NOT_RUN;
- full repository suite: NOT_RUN.

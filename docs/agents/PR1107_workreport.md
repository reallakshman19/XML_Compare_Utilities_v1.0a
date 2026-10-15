# PR1107 — CII Writer2 multi-source module import repair

## Mission
Restore CII Workspace availability after #1106 exposed a deterministic parser failure in the #1104 multi-source Writer2 module, while preserving the intended compare-next-step UX without re-authoring the working engineering core.

## Exact current basis
- PR base: `main@f5b0687f00fb15b5180438212f6b1840621574e8`
- repair product commit before this report: `20d02675406a764608376aac41ab12e0f048085b`
- branch: `fix/cii-writer2-module-import-repair`
- #1106 deployed Pages artifact digest: `sha256:e6aa7f0c792757f36a8ff6bfb268deee30277248865c41859f7dc56102be6d3b`

## RCA
The exact #1106 Pages artifact reproduces the user-visible optional-module failure. Importing `tabs/cii-workspace/cii-workspace-tab.js` throws `SyntaxError: missing ) after argument list` through `cii-workspace-multisource-writer2-ui.js`.

PR #1104 had unintentionally rewritten the working per-SOURCE event-handler block while adding next-step UI. The merged blob contains:
- malformed `$${...}` status syntax;
- a mismatched quote in the analyze status message;
- misspelled `dataset.ciw*` property names;
- undefined `setCustodyStatus` calls;
- a globalized manual-anchor binding path that would break independent S2/S3 controls after parser repair.

## Repair design
1. Restore `tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js` exactly to known-good Git blob `27c1640978edfc06d37063aeff96f828ef5e9150` from the pre-#1104 mainline.
2. Add `cii-workspace-multisource-next-step-shell.js`, a small UI-only adapter that:
   - delegates master-ledger and Transfer `Compare models →` actions to the existing analyze control;
   - hides legacy stage chrome only while multi-source is active;
   - renders `READY FOR COMPARE` / `WAITING FOR ANCHORS` before a real multi-source Transfer preview exists;
   - never overwrites a real `[data-ciiw-ms-transfer="1"]` preview.
3. Route Writer2 through the adapter and cache-bust the repaired nested imports with `?v=20260903-ms-import-repair-1`.
4. Extend the Pages graph test to import `cii-workspace-tab.js`, preventing a broken transitive CII import from being published again.

## Changed engineering/test paths
- `tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js`
- `tabs/cii-workspace/cii-workspace-multisource-next-step-shell.js`
- `tabs/cii-workspace/cii-workspace-tab.js`
- `tests/cii-workspace-multisource-next-step-ui.test.js`
- `tests/cii-workspace-source-set-ui-contract.test.js`
- `tests/deploy-workflow-pages-artifact.test.js`

This work report is the seventh PR path and is non-product evidence only.

## Protected invariants
- Manual anchors remain reviewed USER LOCKED base authority only.
- Method B READY still requires at least two independent axes.
- One-axis propagated correspondence remains REVIEW.
- No correspondence engine, Writer2 mutation, NODENAME relocation, V11/V14 converter, target shadow, projector, or BM-001 output authority changes.
- #1105 Find & Replace changes that landed while this repair was being prepared are preserved unchanged.

## Validation executed
- Exact #1106 deployed artifact import failure reproduced locally.
- Restored core Git hash verified as `27c1640978edfc06d37063aeff96f828ef5e9150`.
- `node --check` PASS for restored core, next-step adapter, and routed `cii-workspace-tab.js`.
- Direct import of the repaired deployed-tree `cii-workspace-tab.js`: `CII_WORKSPACE_IMPORT_OK`.
- Focused next-step adapter test: PASS before PR publication.
- Branch reconciliation before PR: 1 commit ahead / 0 behind then-current main with exactly six engineering/test changed paths.

## Not run / not claimed
- Browser/Worker end-to-end CII Writer2 acceptance.
- Full repository test suite.
- Post-merge GitHub Pages deployment.

## Merge authority
Owner-only. Do not merge without a fresh explicit Owner merge instruction.

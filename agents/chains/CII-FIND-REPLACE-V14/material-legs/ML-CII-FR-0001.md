# ML-CII-FR-0001 — Node Name implementation material receipt

CHAIN_ID: CII-FIND-REPLACE-V14
MATERIAL_LEG_ID: ML-CII-FR-0001
PREVIOUS_MATERIAL_LEG: NONE
MATERIAL_LEG_BASE: 10b340ecb8c89e3fc26dd2375c76c79023402270
MATERIAL_LEG_PREWORK_ENDPOINT_FILE: agents/chains/CII-FIND-REPLACE-V14/endpoints/EP-CII-FR-0005.md
MATERIAL_LEG_HEAD: 72e17a743baa198edaedbbf730d400e3d82c79a6
MATERIAL_LEG_HISTORY_STATUS: RECORDED
MATERIAL_SCOPE: Native-v14 Find & Replace NODENAME fixed-field rename only

## Changed production paths

- `tabs/cii-workspace/cii-workspace-find-replace-csv.js`
- `tabs/cii-workspace/cii-workspace-find-replace-nodename-scope.js`
- `tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
- `tabs/cii-workspace/cii-workspace-find-replace-validator.js`
- `tabs/cii-workspace/cii-workspace-find-replace.js`

## Changed test paths

- `tests/cii-workspace-find-replace-nodename.test.js`
- `tests/cii-workspace-find-replace-retained-real.test.js`
- `tests/cii-workspace-find-replace-ui-registration.test.js`

## Preserved domains

Executor/output, existing NODENAME authority module, Writer1/Writer2, converters, FORCE authority, topology, benchmarks/oracles/tolerances/workflows and direct source overwrite were not modified.

## Validation truth

- synthetic Node Name resolver/validator/executor graph: PASS / local reconstructed module execution;
- intake canonicalization core: PASS / local reconstructed module execution;
- retained SOURCE3 CONTROL NONAM=186: PASS / source inspection;
- retained SOURCE3 element `20020 -> 20030` NODENAME pointer=1: PASS / source inspection;
- retained SOURCE3 NODENAME row1 TO=`PS-12146`: PASS / source inspection;
- retained SOURCE3 NODENAME row count=186: PASS / source inspection;
- exact-checkout retained-real JS regression: NOT_RUN;
- native-v14 retained mutation runtime: NOT_RUN;
- complete Find & Replace/full repository suite: NOT_RUN.

No NOT_RUN result is promoted to PASS.

## Falsifier preserved

Any exact-checkout result showing wrong owner, pointer/cardinality mismatch, non-ASCII/overflow acceptance, changed bytes outside the selected full field, or FORCE/direct-overwrite widening invalidates this material leg and requires an isolated correction.

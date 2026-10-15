# PR1120 workreport — restraint composite custody alignment

## Grounding
- base main: `9cff7537d3e400fc717820991f13765b479cdb2e`
- issue: #1120
- predecessor: merged #1119, merged #1116, merged #1114, merged #1112

## Failure
BM-W2-04 Writer bytes matched the independent retained oracle, then product validation failed with:

`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_PARENT_SCOPE_TESTIMONY_MISMATCH`

The restraint writer support still emitted pre-#1112 parent custody while the independent product validator derived the merged SOURCE_SET / ORIGINAL_TARGET model.

## Patch boundary
- `tabs/cii-workspace/cii-workspace-writer2-composite-restraint-support.js`
- `tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation-support.js`
- `tests/cii-workspace-writer2-restraint-source-set-custody.test.js`

No Writer mutation bytes, benchmark/oracle/tolerance, CREATE authority, topology, converter, workflow, or retained CII source changes.

## Validation
- syntax checks for both support modules and focused regression: PASS
- focused DOCUMENT/DOCUMENT custody: PASS
- focused SOURCE_SET + ORIGINAL_TARGET custody: PASS
- writer/independent child scope equality: PASS
- bad source-set hash: fail-closed PASS
- bad original-target hash: fail-closed PASS
- bad normalized-target hash: fail-closed PASS
- BM-W2-04 current-main-equivalent diagnostic with only custody correction represented: PASS
  - pointer 1 / slot 1 / node 190
  - RESTRAINT blocks 7 -> 6
  - RESTRAINT rows 168 -> 144
  - NODENAME count 4 -> 4
  - product validation PASS

## Evidence class
The retained BM-W2-04 result remains diagnostic until the ordered batch is rerun after accepted predecessors. No NOT_RUN gate is promoted by this workreport.

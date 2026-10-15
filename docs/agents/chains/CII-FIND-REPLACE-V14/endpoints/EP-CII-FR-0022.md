# EP-CII-FR-0022 — U2 field-aware mutation progression opened

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0022
PREDECESSOR_ENDPOINT: EP-CII-FR-0021
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRE_U2_PR_HEAD: e4abe09b33d7364bb6a4bc5d6ee0a4fac148f09c
PRE_U2_PRODUCT_MATERIAL_HEAD: 4f9e79fc899fd5e89c33267480208e25f8d627da
STATE: READY_FOR_U2_WRITE
ENGINEERING_STATE: IN_PROGRESS
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT

## Owner progression

The Owner issued `proceed next` from EP-CII-FR-0021. That endpoint explicitly defined the next bounded progression as U2 field-aware mutation authority. This progression therefore opens U2 only; it does not grant merge authority or later UI/CSV expansion.

## U2 write boundary

Authorized material paths:

```text
NEW     tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
NEW     tabs/cii-workspace/cii-workspace-find-replace-v14-field-claims.js
MODIFY  tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
MODIFY  tabs/cii-workspace/cii-workspace-find-replace-validator.js
MODIFY  tests/cii-workspace-find-replace-scope-resolver.test.js
NEW     tests/cii-workspace-find-replace-v14-field-authority.test.js
```

Required behavior:

- Element mutation excludes FROM/TO selector fields and all 15 IEL pointer fields.
- Element Name and Line Number expose only length-declared text payloads, not length prefixes/control columns.
- Generic auxiliary mutation first passes U1 pointer/CONTROL/cardinality/unique-owner resolution.
- Numeric matches stay within one 13-character numeric field and the complete resulting field must still parse finite.
- Length-prefixed text and FLANGES A40 text expose only text payloads.
- Physical blank FLANGES rows remain preserved.
- Cross-field matches are impossible by construction.
- line-ending bytes remain outside authorized spans.
- NODENAME remains on the existing specialized implementation.
- FORCE/FORCMNT remains blocked.
- Default/raw resolver behavior remains U1-compatible; only mutation validation opts into field-aware generic spans.

## Explicitly not authorized in this leg

```text
UI/CSV block-list expansion
NODENAME production changes
FORCE/FORCMNT
CONTROL or IEL pointer writes
record cloning/repointing
Writer1/Writer2
executor/output custody changes
parser/converter changes
benchmarks/oracles/workflows
merge
```

## Pre-promotion local observation

Focused reconstructed execution before remote promotion:

```text
19 PASS
0 FAIL
0 SKIP
```

This is not yet recorded as exact-source branch PASS. Exact-source status requires remote blob closure after promotion.

## Validation truth retained

```text
U1 exact-source focused runtime                  PASS 17/17
PR1081 prior exact-source UI/static closure      PASS 10/10
Merged non-benchmark Find & Replace              PASS 33/33
Merged focused Node Name                         PASS 4/4
SOURCE 3 retained-real authored runtime          NOT_RUN
Full repository suite                            NOT_RUN
Native-v14 archived fixture runtime              NOT_RUN
External CAESAR acceptance                       NOT_RUN
```

## Exact next action

Promote only the six U2 paths listed above, verify remote blob identity against the executed local sources, execute the focused U2 suite against exact branch blobs, then write ML-CII-FR-0004 and a successor endpoint. Do not expand UI/CSV or merge PR #1081 in this material leg.
# #1292 U4.1 work report — boundary-local endpoint evidence

## Recovery header

```text
RESPONSIBILITY: #1292 U4.1
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
PR: #1296 OPEN / DRAFT
BRANCH: fix/cii-boundary-local-endpoint-1292
BASE: PR #1286 @ d919446c09237558da57b01bf9168985bf6d73db
HEAD_BEFORE_REPORT_REFRESH: 52d967e069d4391849881bc53e82caa3d5fc0296
MERGE_AUTHORITY: OWNER_ONLY / NOT AUTHORIZED
RETAINED_ACCEPTANCE: #1291 ONLY
```

## Design authority

#1289 TASK_EVIDENCE issuecomment-6024313634.

Selected responsibility:
`METHOD_A_BOUNDARY_LOCAL_ENDPOINT_IDENTITY` — raw alignment evidence/emission half only.

## Product preimage

`tabs/cii-workspace/cii-workspace-alignment.js@d4e297006bd6470592c5bf252fff1a66eeebfede`.

## Intended product behavior

- preserve current MATCH→MATCH node rows;
- attach candidate-only local endpoint evidence;
- emit REVIEW node candidates at safe MATCH→INSERT_TARGET / INSERT_TARGET→MATCH path boundaries;
- require registered DIRECT M1 local endpoint pass + M2 pass + OD pass;
- do not promote automatic identity in this child;
- do not change element evidence/status.

## Protected

No changes to:
- multi-base Method-A projection;
- node custody;
- arbitration;
- M1/M2 thresholds;
- candidate winner gap;
- geometry;
- preselection;
- Method B/manual;
- Writer/V11-V14;
- Benchmark/TEXPECTED.

## Implemented material

Product:
- `tabs/cii-workspace/cii-workspace-alignment.js@cfdbd033c2852627908874e2542de0e0c33f3014`

Focused test:
- `tests/cii-workspace-boundary-local-endpoint.test.js@e829342e2bd3a1a4ea4a9bf64ef7049e488760cb`

Changed paths are exactly:
1. recovery report;
2. alignment product;
3. focused generic test.

### Product behavior

- MATCH→MATCH existing row/status behavior is preserved;
- candidate-only `evidence.boundaryIdentity` is added;
- MATCH→INSERT_TARGET and INSERT_TARGET→MATCH may emit REVIEW `ADJACENT_MATCH_BOUNDARY` rows when local registered endpoint, M2 and OD evidence all pass;
- no top-level identitySupported/confidence is promoted;
- element rows remain unchanged.

### Focused test coverage authored

Positive:
- existing HIGH/HIGH MATCH→MATCH;
- whole-edge MEDIUM/far-end mismatch with locally-correct shared endpoint;
- MATCH→INSERT_TARGET;
- INSERT_TARGET→MATCH;
- multiple supported insertion-boundary claims retained for later conflict veto.

Negative:
- local endpoint outside tolerance;
- REVERSED M1 orientation;
- M2 topology failure;
- OD mismatch;
- target path discontinuity;
- DELETE_REFERENCE adjacency.

## Validation truth

```text
PRODUCT: AUTHORED / NOT_YET_HOSTED
FOCUSED_TEST: AUTHORED / NOT_YET_HOSTED
METHOD_A_PROJECTION: UNCHANGED / #1293
RETAINED_ACCEPTANCE: NOT_RUN / #1291
```

## Exact next action

Create validation-only branch from the final refreshed PR #1296 head and run exact diff/blob guards, syntax, focused U4.1 test, and inherited alignment-semantics regression. Do not edit this report after qualification; publish exact-head evidence on #1292.

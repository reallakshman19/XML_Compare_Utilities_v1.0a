# #1284 D5.3 work report — Method-A boundary node-custody reconciliation

## Recovery header

```text
RESPONSIBILITY: #1284 D5.3
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
PR: #1286 OPEN / DRAFT
BRANCH: fix/cii-method-a-boundary-custody-1284
BASE: PR #1280 @ 2751b563505caa2c9be0803294b00c3177c2811a
HEAD_BEFORE_REPORT_REFRESH: 2fa767cb06dd66211bfd6abc82eba7a7c04fe0b6
MERGE_AUTHORITY: OWNER_ONLY / NOT AUTHORIZED
RETAINED_ACCEPTANCE: #1285 ONLY
```

## Selected design

Authority: #1283 TASK_EVIDENCE issuecomment-6023671627.

Implement only:
`METHOD_A_BOUNDARY_IDENTITY_PRESERVES_THROUGH_WINNER_GAP_ONLY_NODE_CUSTODY`.

Owning production function:
`tabs/cii-workspace/cii-workspace-node-custody.js::applyCiiNodeCustodyGates()`.

## Preimage

`cii-workspace-node-custody.js@8fbbf0f4040920172ef2b9ebdf9d62a4aa8bf029`.

## Intended product behavior

Preserve an already-arbitrated, evidence-qualified Method-A adjacent-boundary node through node custody only when every incident risky element is a REVIEW/AMBIGUOUS HIGH-winner candidate whose selected target is the winner, M1/M2 agree, and the sole reason is `WINNER_GAP_NOT_SATISFIED`.

Everything else remains fail-closed.

No confidence promotion and no direct mutation authority.

## Protected

No product edits to:
- Method-A projection;
- arbitration;
- candidate winner-gap;
- geometry/preselection;
- Method B;
- USER_LOCKED/manual seeds;
- Compare Review / engineering delta / transfer;
- Writer / V11-V14;
- Benchmark / TEXPECTED.

## Validation plan

Generic focused fixture only. Required positive/negative falsifiers are defined in #1283. No retained identifiers or benchmark values.

## Implemented material

Production:
- `tabs/cii-workspace/cii-workspace-node-custody.js@6e7cb74f9533cde025bee083cdc8ac2b0b05cb25`

Focused generic falsifier suite:
- `tests/cii-workspace-method-a-boundary-node-custody.test.js@030156fd8ee0fda90413a202d6c8f1cc2693ca33`

PR #1286 changed paths are exactly:
1. `agents/WIP-1284-node-custody_workreport.md`
2. `tabs/cii-workspace/cii-workspace-node-custody.js`
3. `tests/cii-workspace-method-a-boundary-node-custody.test.js`

The implementation adds no test export and does not change the existing element candidate state. It only leaves the already-qualified node row unchanged when the #1283 predicate is fully satisfied; all other cases retain the pre-existing blocking custody gate.

## Focused falsifiers authored

Positive:
- qualified Method-A adjacent-boundary node survives custody through one or multiple winner-gap-only REVIEW/AMBIGUOUS affected elements;
- confidence remains the pre-existing MEDIUM/HIGH value;
- affected element rows remain REVIEW/AMBIGUOUS.

Fail-closed:
- UNRESOLVED or CONFLICT affected element;
- M1/M2 disagreement;
- alignment target is not local winner;
- extra ambiguity reason;
- winner confidence below HIGH;
- missing/non-AMBIGUOUS candidate evidence;
- weak left/right boundary evidence;
- REVIEW/unqualified Method-A provenance;
- Method-B-only/copycat provenance;
- correspondence ambiguity/conflict;
- target-custody conflict.

Manual:
- USER_LOCKED remains LOCKED and bypasses the gate exactly as before.

## Validation truth before hosted run

```text
PRODUCT_IMPLEMENTATION: AUTHORED / NOT_YET_HOSTED
FOCUSED_TEST: AUTHORED / NOT_YET_HOSTED
RETAINED_S1: NOT_RUN / #1285 ONLY
BENCHMARK_MUTATION: NONE
MERGE: NOT AUTHORIZED
```

## Exact next action

Create a validation-only branch from the final refreshed PR #1286 head and run:
- exact changed-path/blob guards;
- focused D5.3 custody test;
- inherited D3 anchor/boundary/integration regressions.

Do not edit this report after the qualification run; publish final exact-head evidence on #1284 so the validated PR head remains stable.

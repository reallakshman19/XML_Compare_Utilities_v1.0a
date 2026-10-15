# #1301 U8 work report — boundary-local Method-A node custody independence

## Recovery header

```text
RESPONSIBILITY: #1301 U8
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
PR: #1304 OPEN / DRAFT
BRANCH: fix/cii-boundary-local-node-custody-1301
BASE: PR #1298 @ 4c96220447315d538dd85b3a4db5a9cce6eeac77
HEAD_BEFORE_REPORT_REFRESH: a816ef6cb3a1345f3533c025c44a06835601f662
MERGE_AUTHORITY: OWNER_ONLY / NOT AUTHORIZED
RETAINED_ACCEPTANCE: #1303 ONLY
```

## Selected repair

`METHOD_A_BOUNDARY_LOCAL_NODE_CUSTODY_INDEPENDENCE`

Owner:
`tabs/cii-workspace/cii-workspace-node-custody.js`.

## Preimage

`cii-workspace-node-custody.js@221ae3dd5ea6f1e98afaf763646885db91e51ff2`.

## Intended behavior

When a canonical Method-A adjacent-boundary node carries attested U4.1/U4.2 boundary-local identity, custody may preserve it across REVIEW/AMBIGUOUS incident whole-element rows even when those whole elements prefer another candidate.

Fail closed for:
- correspondence/node conflicts;
- target-custody conflicts;
- missing/inconsistent boundaryIdentity;
- Method-B-only/manual-copycat evidence;
- UNRESOLVED/CONFLICT/hard-fail affected elements;
- missing/non-AMBIGUOUS candidate evidence.

Existing strict winner-gap-only handling remains for:
- legacy adjacent-boundary evidence without boundary-local attestation;
- qualified Method-A base anchors.

No confidence promotion and no element promotion.

## Protected

No edits to:
- alignment;
- Method-A projection;
- arbitration;
- candidate thresholds/winner gap;
- geometry/preselection;
- Method B/manual;
- review/engineering delta/Writer;
- Benchmark/TEXPECTED.

## Implemented material

Production:
- `tabs/cii-workspace/cii-workspace-node-custody.js@cf08a90b97d022432237593eafd665066155d6d6`

Focused generic test:
- `tests/cii-workspace-method-a-boundary-local-node-custody.test.js@568c5d8fbabee18e89d650ffd50812ff9bc4f70b`

Inherited safety tests remain unchanged:
- U4.3 base-anchor custody: `a01f9e216dd3c21cbd95baf60d763b2d6746d28a`
- U4.2 boundary-local projection: `aaef0c3ed47f804d3b1917f24fcc527d3e4614eb`
- U4.1 raw boundary evidence: `e829342e2bd3a1a4ea4a9bf64ef7049e488760cb`
- D5.3 strict adjacent-boundary custody: `030156fd8ee0fda90413a202d6c8f1cc2693ca33`

PR #1304 changed paths are exactly:
1. `agents/WIP-1301-boundary-local-node-custody_workreport.md`
2. `tabs/cii-workspace/cii-workspace-node-custody.js`
3. `tests/cii-workspace-method-a-boundary-local-node-custody.test.js`

## Product behavior

Endpoint-local Method-A adjacent-boundary identity gets a distinct custody path only when:
- canonical projected identity is HIGH/MEDIUM and Method-A attested;
- `boundaryIdentity` is supported and matches the canonical source/target node;
- every affected element remains REVIEW + AMBIGUOUS + non-hard-fail;
- correspondence/node custody conflicts are absent.

The whole-element candidate winner may differ from the node's boundary target. Element evidence is preserved unchanged.

Legacy adjacent-boundary evidence without endpoint-local attestation and qualified base anchors continue to use the stricter winner-gap-only rule.

## Validation truth before U9

```text
PRODUCT_IMPLEMENTATION: AUTHORED
GENERIC_EXACT_HEAD_QUALIFICATION: NOT_RUN / #1302 OWNS
RETAINED_36_OF_36: NOT_RUN / #1303 OWNS
BENCHMARK_MUTATION: NONE
MERGE: NOT AUTHORIZED
```

## Exact next action

#1302 U9 only:
- validate the exact refreshed PR #1304 head;
- run the new focused test plus inherited U4/D5/D3/preselection/manual/conflict controls;
- publish FIT_FOR_U10_RETAINED_VALIDATION only if green.

Do not edit this report after the product head is handed to #1302.

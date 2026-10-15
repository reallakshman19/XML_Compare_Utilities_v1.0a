# PR1065 Node Name independent-verifier packet

CHAIN_ID: CII-FIND-REPLACE-V14
QUESTION_SET_ID: CII-FR-QS-0001
QUALIFICATION_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
CANDIDATE_ID: GPT-5.6-SOL-2026-09-02-A
VERIFIER_REQUIRED: TRUE
SELF_VERIFICATION_ALLOWED: FALSE

## Purpose

This packet minimizes verifier archaeology. It does not contain a verdict and does not grant write authority.

The verifier must independently inspect the candidate answer and repository sources, then write:

`agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-verdict.md`

using the pinned `engineering-pr-delivery-v2` verdict schema.

Required pass threshold:

- Q1..Q5 each >= 17/20;
- total >= 92/100;
- no automatic-failure condition;
- `VERIFIER_ID` must differ from `CANDIDATE_ID`;
- verdict basis must remain materially reconciled to `e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b`.

## Candidate artifact

`agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md`

## Governing endpoint

`agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0001.md`

Latest relay status:

`agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0002.md`

## Q1 evidence anchors — production trace

Find & Replace production at material basis:

- `tabs/cii-workspace/cii-workspace-find-replace-csv.js`
  - `rowBlockers()` currently permits only FORCE/DISPLACEMENT block names;
  - FORCE remains explicitly blocked.
- `tabs/cii-workspace/cii-workspace-find-replace-session.js`
  - `qualifyFindReplaceSession()` forwards approved rows to preimage validation and the existing executor.
- `tabs/cii-workspace/cii-workspace-find-replace-validator.js`
  - generic equal logical-text byte-length rule;
  - calls `resolveFindReplaceScope()`;
  - creates TARGET0-relative physical claims.
- `tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
  - BLOCK currently dispatches only DISPLACEMENT/FORCE;
  - NODENAME therefore remains unsupported at both intake and resolver boundaries.
- `tabs/cii-workspace/cii-workspace-find-replace-executor.js`
  - requires already equal-width claim before/after fields;
  - independently validates TARGET1.

Existing NODENAME physical custody authority:

- `tabs/cii-workspace/cii-workspace-nodename.js`
  - `ELEMENT_BLOCK_ROWS = 15`;
  - NODENAME pointer row = zero-based 13;
  - pointer = sixth numeric item;
  - FROM field `[2,28)` width 26;
  - TO field `[28,53)` width 25;
  - positive pointer is 1-based NODENAME row index;
  - exact parsed-index + endpoint binding is required for qualified physical custody;
  - physical fields retain owner sets by byte span.

Verifier should reject Q1 if the candidate treats generic DOCUMENT search or Writer2 execution as Node Name ownership authority.

## Q2 evidence anchors — retained-real isolating case

Retained source:

`Benchmark/CIICompare/SOURCE 3.CII`

Required independent reconstruction:

- exact element `20020 -> 20030` exists;
- its row13 sixth item is `1`;
- `#$ NODENAME` first payload row contains blank FROM and TO `PS-12146`;
- expected writable semantic field is the 25-byte TO field, not a substring span;
- pointer-zero, pointer-out-of-range, CONTROL count mismatch, duplicate exact element identity, distinct-node field alias, nonmatching semantic name, overflow, and non-ASCII must fail closed.

The verifier should require the candidate to identify resolver ownership as the first wrong boundary if this reconstruction fails.

## Q3 evidence anchors — authority / invariants

Current repository native-v14 authority:

- `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js`
  - NODENAME cardinality unit = 1 row;
  - CONTROL row0 field3 = NODENAME/NONAM count;
  - ELEMENT row13 field5 = NODENAME pointer.

Pinned upstream dialect authority:

- `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4`
- `converters/scripts/cii_v11_v14.py`
  - NODENAME strings are explicitly identified among record shapes unchanged between the qualified V11/V14 profiles.

Negative authority boundary:

- `docs/cii-writer2-v11-v14-lossless-bridge.md`
  - existing V14 Writer2 bridge blocks equal-cardinality NODENAME payload mutation;
  - this Find & Replace leg therefore requires its own native-v14 fixed-field claim authority and may not inherit Writer2 apply authority.

Protected unchanged state for first-priority rename:

- total file length;
- section order;
- NODENAME row count;
- CONTROL NONAM;
- all ELEMENT pointers;
- all non-owned NODENAME fields;
- all line endings and unrelated bytes;
- Writer1/Writer2 production;
- FORCE blocker;
- direct-overwrite prohibition.

## Q4 evidence anchors — independent reconstruction

Logical example:

`PS-12146 -> NODE-20030`

Expected physical model for SOURCE3 element `20020 -> 20030`:

- pointer = 1;
- row = first NODENAME payload row;
- endpoint field = TO;
- field width = 25 bytes;
- `before` = exact TARGET0 25-byte field;
- semantic comparison = `before.trim() === 'PS-12146'`;
- `after` = ASCII replacement right-padded with spaces to 25 bytes;
- claim covers the complete fixed field;
- TARGET1 length equals TARGET0 length;
- every byte outside the claim equals TARGET0.

Owner rule:

Multiple ELEMENT bindings may point to the same physical field only when they resolve to the same node identity. If one physical field has owners with multiple distinct node IDs, mutation must block.

Evidence classes must remain distinct:

- SOURCE3 facts: retained-real V11 source inspection;
- V14 pointer/cardinality: authoritative source inspection;
- V11/V14 NODENAME shape compatibility: pinned upstream authoritative source inspection;
- native-v14 mutation execution: NOT_RUN;
- external CAESAR acceptance: NOT_RUN.

## Q5 evidence anchors — minimal patch

Expected authorized production paths only after a valid PASS:

1. `tabs/cii-workspace/cii-workspace-find-replace-csv.js`
   - admit canonical `NODENAME` block value;
   - keep FORCE blocker unchanged.
2. `tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
   - exact ELEMENT -> row13/item6 -> NODENAME row -> FROM/TO field resolver;
   - reconstruct global field owner sets;
   - CONTROL row-count correlation and all fail-closed cases.
3. `tabs/cii-workspace/cii-workspace-find-replace-validator.js`
   - specialized whole-field NODENAME match/rebuild;
   - ASCII + width checks;
   - preserve generic rules for other scopes.
4. `tabs/cii-workspace/cii-workspace-find-replace.js`
   - enabled NODE NAME option before DISPLACEMENT;
   - FORCE remains disabled.

Expected test paths:

- `tests/cii-workspace-find-replace-scope-resolver.test.js`
- `tests/cii-workspace-find-replace-validator.test.js`
- `tests/cii-workspace-find-replace-session.test.js`
- `tests/cii-workspace-find-replace-ui-registration.test.js`
- `tests/cii-workspace-find-replace-retained-real.test.js`

Must remain unchanged:

- executor/output modules;
- Writer1/Writer2 modules;
- canonical NODENAME evidence module;
- converter sources;
- benchmarks/oracles/tolerances;
- FORCE authority;
- topology;
- workflows;
- direct overwrite controls.

## Automatic-failure watchlist

The verifier must return FAIL/STALE rather than PASS if the answer:

- globally searches for Node Name without ELEMENT/pointer ownership;
- treats multiple distinct-node aliases to one field as safe;
- edits only the matching substring instead of the complete fixed field;
- allows non-ASCII or over-width replacements;
- changes CONTROL/pointers for a same-cardinality rename;
- borrows Writer2 bridge mutation authority;
- represents retained-real V11 source inspection as native-v14 runtime PASS;
- weakens FORCE/direct-overwrite restrictions;
- proposes benchmark/oracle/workflow changes to obtain PASS.

## Verdict template

```text
CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0001
QUESTION_SET_ID: CII-FR-QS-0001
QUALIFICATION_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
CANDIDATE_ID: GPT-5.6-SOL-2026-09-02-A
VERIFIER_ID: <independent verifier>
VERDICT_BASIS_HEAD: <reconciled head/material basis>

Q1 __/20
Q2 __/20
Q3 __/20
Q4 __/20
Q5 __/20
TOTAL __/100
MINIMUM_QUESTION __/20

AUTOMATIC_FAILURE_REASON: <NONE or reason>
VERDICT: PASS_WRITE_ALLOWED | FAIL_READ_ONLY | STALE_REQUALIFICATION_REQUIRED | INVALID_SELF_VERIFIED
```

If PASS, the authority boundary must be explicitly limited to the Node Name files/tests listed above. It does not grant FORCE, Writer1/Writer2, topology, workflows, direct overwrite, merge, or unrelated Find & Replace authority.

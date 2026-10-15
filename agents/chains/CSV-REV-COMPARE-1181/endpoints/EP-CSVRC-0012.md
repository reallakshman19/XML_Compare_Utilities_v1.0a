# Endpoint EP-CSVRC-0012 — Phase 1 + Phase 2 qualified; Phase 3 gated

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0011
CUSTODY_EPOCH: 12
MATERIAL_LEG: LEG-009
MATERIAL_LEG_FILE: agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-009.md
MATERIAL_HEAD: ad8f936665b8bd66c15101fa64297261cb6a13de
HEAD_AT_CHECKPOINT: 6d190aa1ac02b34ed3f2ab095748280f15fb2adc
MAIN_OBSERVED: 419c94cca7649626e0b3e641f20d5261967347ba
PR: 1188
BRANCH: issue-1181-phase1-current-main
PR_STATE: OPEN_DRAFT
PR_MERGEABLE: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:d8a6364c-4d17-47b7-ae66-90a497ec5f2d
QUALIFICATION_SCOPE_ID: QSCOPE-XMLCOMPARE-1181-CSV-XML-LINEAGE
QUESTION_SET_ID: QS-CSVRC-1181-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED

## Owner progression command

Owner command received 2026-09-10T22:58:31+04:00: `proceed next` after reviewing Phase 1 output.

This command authorizes the next sequential benchmark bucket only: Phase 2 `Support location change`. It does not authorize Phase 3, Phase 4, merge, or workflow mutation.

## Fixed benchmark authority

- Unique SupportLocation identity is the composite `CIVIL SECONDARY SUPPORT (Tag provided by Civil) + PIPE`; Civil alone is not a unique item.
- R3 `REMARKS (IF ANY)` is oracle-only and is blanked before production comparison.
- Unsupported/non-mechanically-verifiable tokens such as HOLD/Hold Removed are excluded from scoring/evidence.
- Bucket order remains: Phase 1 `PS No. change` -> Phase 2 `Support location change` -> Phase 3 `Load change` -> Phase 4 `Total no of support change`.

## Qualification vehicle and production equivalence

Qualification workflow run: `34515414467` (`CSV Rev Compare Phase 1 Qualification`, job `phase1`), conclusion `success`.

The successful qualification snapshot is not delivery. Its production trees were compared with delivery material head `ad8f936665b8bd66c15101fa64297261cb6a13de`:

- delivery `tabs` subtree SHA: `231f54acf3fda90cd4bf302c8525d91619fa537a`
- qualification `tabs` subtree SHA: `231f54acf3fda90cd4bf302c8525d91619fa537a`
- delivery `xml-compare` subtree SHA: `81454dc7f1ad9947767847d2269877bef68c6f4a`
- qualification `xml-compare` subtree SHA: `81454dc7f1ad9947767847d2269877bef68c6f4a`

Therefore the executable result applies to the delivery production implementation; differences are qualification infrastructure (`.github`, `scripts`, `tests`), not production code.

## Phase 1 result — qualified

Bucket: `PS No. change`

Real `benchmarks/R2.zip -> benchmarks/R3.zip` result:

- compare stage: `READY_TO_EXPORT`
- compare OK: `true`
- expected: 1
- detected: 1
- true positives: 1
- false positives: 0
- false negatives: 0
- precision: 1
- recall: 1
- F1: 1
- TP composite key: `SL-111001(REF)||BWGA-1000-FL-8"-M1610003-(FL-07)`

R3 oracle text includes `Hold removed`; HOLD is excluded and was not production comparison evidence.

PHASE1_QUALIFICATION: PASS

## Phase 2 result — qualified

Bucket: `Support location change`

The Phase-2 contract is deliberately non-vacuous. Dedicated executable regression coverage passed and requires:

- positive: accepted common-support `1->N` topology + retained persistent reference + trusted coordinate frame -> exactly one `COMMON_SUPPORT_ANCHOR_RELOCATED`, rendered `Relocated Support`;
- negative: ordinary `1->1` coordinate drift does not become a support-location-change remark;
- negative: unchanged common-support anchor, row reorder, under-anchored frame, and sign-format-only changes do not create relocation events;
- safety: unresolved structural ambiguity blocks export and operational events.

The same successful workflow run printed `csv-rev-compare Phase 2 support-location-change tests: PASS`.

Real `R2.zip -> R3.zip` Phase-2 oracle result:

- compare stage: `READY_TO_EXPORT`
- compare OK: `true`
- expected oracle positives: 0
- detected positives: 0
- false positives: 0
- false negatives: 0
- expected items: []
- detected items: []

This real-data result is a negative control, not sufficient by itself for positive proof. Positive proof is supplied by the dedicated structural relocation regression above.

The real benchmark coordinate frame was `SOLVED` from 23 trusted anchors with basis `UNIQUE_SUPPORT_LOCATION_IDENTITY+UNIQUE_PERSISTENT_REFERENCE_SET`; Y and Z axes were `VALIDATED`, X was `HIGH_RESIDUAL`, and `scoreFrameUsable=true` because at least two axes validated.

PHASE2_QUALIFICATION: PASS_WITH_REAL_ORACLE_NEGATIVE_CONTROL_AND_DEDICATED_POSITIVE_REGRESSION

## Validation truth

- Phase 1: PASS on production-equivalent executable snapshot.
- Phase 2: PASS on production-equivalent executable snapshot, with real R3 containing zero mechanically checkable Phase-2 positives; non-vacuity established by dedicated positive regression.
- Phase 3 `Load change`: NOT_STARTED / NOT_AUTHORIZED_BY_THIS_OWNER_COMMAND.
- Phase 4 `Total no of support change`: NOT_STARTED.

No production code was changed for Phase 2 qualification. No workflow file was changed. PR #1188 remains draft and merge unauthorized.

## Exact next action

Stop at the Phase-2 boundary. Await a new explicit Owner progression command before starting Phase 3 `Load change`. On authorization, open a new v2 pre-work endpoint for the Phase-3 material/qualification boundary before any production mutation. Do not infer Phase-3 authorization from the command that authorized Phase 2.
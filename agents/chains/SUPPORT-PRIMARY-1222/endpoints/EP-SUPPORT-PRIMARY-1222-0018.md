CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0018
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0017
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: github:reallaksh19/XML_Compare_Utilities#1179
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-010
MATERIAL_BASE: 684b7955b6bc64096b3d7edc8966a2a0ce4a9059
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
ISSUE_HANDOVER_SYNC_STATUS: PENDING_EP_0018_SYNC

# LEG-010 prework — three-channel qualification + Column 22/23 publication audit

## Objective

Govern how the already-implemented structural, relationship-topology and axis-typicality channels are published into Support Report Columns 22/23 and preserved in trace/debug evidence. This leg must not retune matcher scoring, thresholds, grouping, counting or orphan policy.

## Frozen material boundary

Allowed production paths:
- `tabs/support-steel-relationship-builder/support-report-typicality-projection.js`
- `tabs/support-steel-relationship-builder/support-report-trace-export.js` only if required to preserve new publication/audit fields
- `tabs/support-steel-relationship-builder/support-report-export.js` / XLSX/view only if existing Column 22/23 presentation drops governed publication state
- browser cache-routing files only as required for changed modules

Allowed focused tests:
- new/updated tests for consensus publication matrix, Column 22 blank/publish rules, Column 23 wording, and trace/debug audit retention.

Explicitly frozen / out of scope:
- `support-report-typicality.js` structural matcher scoring/gates
- `support-report-relationship-typicality.js` matcher semantics
- `support-report-axis-typicality.js` matcher semantics/thresholds
- location matching algorithm
- primary grouping/count/orphan recovery
- Support/Steel producer authority (#1216)
- workflow definitions

## Publication policy to qualify

Column 22 (`TYPICAL STRUCTURE (PS NO.)`) may publish a candidate only when a single structural/location candidate remains and consensus has not produced a material conflict/ambiguity. In particular:
- `TYPICAL` with consensus agreement/compatibility/unavailable secondary evidence: publish candidate.
- `REVIEW` caused only by secondary evidence being incomplete/partial but with one retained structural candidate: candidate may remain visible only when explicitly marked as REVIEW in Column 23 and audit; this is to be verified against existing Owner behavior before changing.
- `REVIEW` caused by relationship/axis contradiction (`CONFLICT`, `AXIS_CONFLICT`, `MULTI_CHANNEL_CONFLICT`): do not publish candidate as an accepted typical structure; either blank Column 22 or retain only if existing contract explicitly treats it as a review candidate. LEG-010 must choose one deterministic policy and test it.
- structural `AMBIGUOUS` / `NO_MATCH` / no single candidate: Column 22 blank.
- secondary-only candidate must never populate Column 22.

Preferred conservative rule for this leg: **Column 22 publishes only `TYPICAL`; all `REVIEW`, `AMBIGUOUS`, `NO_MATCH` and unavailable/no-candidate states are blank.** Column 23 carries the review candidate names/reasons when useful. This removes the risk that a conflicted review candidate is mistaken for an accepted typical structure.

## Column 23 requirements

Human-facing wording must distinguish at least:
- all three channels agree;
- structural + axis agree, relationship unavailable;
- structural candidate retained with relationship unavailable;
- relationship incomplete / axis incomplete review;
- relationship conflict;
- axis conflict;
- multi-channel conflict;
- structural ambiguity/no-match.

Machine reason codes remain authoritative and must not be replaced by prose.

## Audit requirements

For every family result, preserve separately:
- structural/location result and candidate/audit IDs;
- relationship topology result, selected candidate, pair audit ID and failed signals;
- axis typicality result, selected candidate, pair audit ID and failed signals;
- final `TypicalityConsensusV1` result/confidence/basis;
- publication decision for Column 22 (`PUBLISHED` / `WITHHELD`) and reason code.

The projected report rows and Debug/Trace outputs must allow a reviewer to reconstruct why Column 22 was populated or blank without rerunning the matcher.

## Qualification matrix

A. structural TYPICAL + relationship MATCH same + axis MATCH same -> publish, VERY_HIGH, all-channel agreement remark.
B. structural TYPICAL + relationship UNAVAILABLE + axis MATCH same -> publish, HIGH, relationship unavailable remark.
C. structural TYPICAL + relationship MATCH same + axis UNAVAILABLE -> publish, HIGH/MEDIUM according to existing consensus, axis unavailable remark.
D. structural TYPICAL + both secondary UNAVAILABLE -> publish structural candidate with reduced confidence and explicit limited-evidence remark.
E. structural TYPICAL + relationship NO_MATCH -> REVIEW conflict; Column 22 withheld under preferred conservative rule.
F. structural TYPICAL + axis NO_MATCH -> REVIEW conflict; Column 22 withheld.
G. structural TYPICAL + both reject -> REVIEW multi-channel conflict; Column 22 withheld.
H. structural REVIEW / partial location arrangement -> Column 22 withheld; Column 23 review wording.
I. structural AMBIGUOUS / NO_MATCH -> Column 22 withheld.
J. structural rejects but relationship/axis independently match -> Column 22 withheld; no secondary promotion.

## Validation truth at prework

PR #1223 observed open/draft/mergeable at head `684b7955b6bc64096b3d7edc8966a2a0ce4a9059`. Previous execution qualification remains NOT_RUN because Actions jobs failed before steps. No merge authorization.

## Exact next action

Synchronize #1222/#1179 handover to EP-0018, then inspect the existing projection/remarks/trace publication seam against the matrix above. Make only the minimum deterministic publication/audit changes required. Do not merge.
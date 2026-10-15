CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0017
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0016
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: github:reallaksh19/XML_Compare_Utilities#1179
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-009
MATERIAL_HEAD: 18938c15695453b476192f21b742fe57caae7754
MATERIAL_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-009.md
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
ISSUE_HANDOVER_SYNC_STATUS: PENDING_EP_0017_SYNC

# LEG-009 closeout — reference-side Primary Support Relationship input

LEG-009 is materially complete.

Delivered:
- symmetric optional reference Clash-within-Supports input;
- automatic reference relationship scope from reference Support Report exact ancestry;
- deepest-zone selection prevents broad-parent sibling leakage;
- no exact reference zone => fail-closed zero authorized relationship rows;
- typed reference `SupportPrimaryRelationshipBundle.v1` supplied to right/reference report only;
- side-specific CURRENT/REFERENCE input audit;
- existing relationship matcher becomes informed on both sides with no matcher mutation;
- cache route and focused controls committed.

Invariants preserved:
- current manual zone semantics unchanged;
- structural, relationship, axis and consensus matcher policies unchanged;
- no grouping/count/orphan mutation;
- no #1216 producer mutation;
- no workflow mutation;
- no merge.

Validation truth:
- source/material review PASS;
- repository Node/browser/ZIP execution NOT_RUN because Actions jobs at material head have `steps=null`;
- PR remains draft/open/mergeable with no unresolved inline review threads;
- real two-sided relationship XML benchmark remains NOT_RUN because Owner inputs are unpinned.

# Recommended next bounded work

Create a separate qualification/presentation leg before release readiness:
- synthetic A/B/C/D matrix covering structural + relationship + axis agreement/conflict/unavailability;
- verify Column 22 candidate publication rules under `TypicalityConsensusV1`;
- verify Column 23 wording for agreement, unavailable channels and conflicts;
- expose three-channel audit summary in Debug JSON/Trace as needed;
- preserve all existing matcher outputs independently;
- do not change thresholds merely to force benchmark agreement.

Do not start this next leg without a fresh bounded prework endpoint. Do not merge without fresh Owner authorization.
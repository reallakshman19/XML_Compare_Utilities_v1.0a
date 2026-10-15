CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0019
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0018
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: github:reallaksh19/XML_Compare_Utilities#1179
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-010
MATERIAL_HEAD: a47af97cda0539751bfad2de5f8ee0844ce83fc6
MATERIAL_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-010.md
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
ISSUE_HANDOVER_SYNC_STATUS: PENDING_EP_0019_SYNC

# LEG-010 closeout — Column 22/23 publication governance

LEG-010 is materially complete.

Delivered:
- `SupportReportTypicalityPublication.v1`;
- Column 22 publishes only final `TYPICAL` with a retained structural candidate;
- `REVIEW`, conflict, ambiguity, no-match and secondary-only candidate states are withheld from Column 22;
- retained review candidate remains visible in Column 23 and row audit;
- `SupportReportTypicalityRowAudit.v1` preserves structural, arrangement-resolved structural, relationship, axis, final consensus and publication evidence independently;
- Column 23 wording distinguishes all-channel agreement, missing secondary channels, relationship conflict, axis conflict and multi-channel conflict;
- `SupportReportTraceCsv.v4` / `SupportReportDebugExport.v4` preserve publication and channel audit evidence;
- nested browser cache route advanced;
- focused A-J publication matrix and trace-v4 controls committed.

Frozen invariants preserved:
- structural matcher scoring/gates unchanged;
- relationship matcher semantics unchanged;
- axis matcher semantics/thresholds unchanged;
- location matcher unchanged;
- grouping/count/orphan unchanged;
- #1216 producer authority unchanged;
- workflow definitions unchanged;
- no merge.

Validation truth:
- source/material review PASS;
- Node/browser/ZIP execution NOT_RUN because Actions at material head fail before steps (`steps=null`);
- real Owner relationship benchmark qualification NOT_RUN;
- no unresolved PR review threads at material closeout.

Current architectural state:
`zone -> Primary Support Assembly -> count/recovery -> structural + relationship + axis matchers -> TypicalityConsensusV1 -> explicit Column 22 publication decision + Column 23/audit explanation`.

# Recommended next bounded work

**Release-readiness / qualification consolidation for PR #1223** rather than another new matcher:
- re-ground current `main` and PR diff;
- audit protected count oracles and 11168->14168 typicality control against all touched seams;
- verify report CSV/XLSX column contract remains stable while trace/debug intentionally advance to v4;
- perform static/source invariant sweep for #1216 authority, fail-closed relationship/axis behavior, and no secondary promotion;
- check browser UI/input contract for current/reference relationship sources, zones, orphan settings and Column 22/23 publication;
- re-run Actions if infrastructure starts executing steps;
- decide whether PR may move from draft to ready-for-review. Do **not** merge without fresh Owner authorization.

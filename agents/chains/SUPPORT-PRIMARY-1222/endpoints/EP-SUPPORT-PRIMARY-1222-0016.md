CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0016
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0015
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: github:reallaksh19/XML_Compare_Utilities#1179
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-009
MATERIAL_BASE: bee56f67eba1bee47740bc92dbae9cf318a7beec
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT

# LEG-009 prework — symmetric reference-side Primary Support Relationship input

Owner progression command: `proceed next`.

This leg makes explicit support-member topology available on the reference/right side of normal Support Report typicality comparison. It must not alter structural, relationship-topology, axis-typicality, grouping, count, orphan, or #1216 producer decision policy.

## User-facing input

Add a second optional XML input paired with the Typical-structure reference XML:

`Reference Primary Support Relationship XML (optional)`

It accepts Navisworks Clash-within-Supports XML and supplies only PS/SL member-to-member Primary Support Assembly connectivity for the reference report.

Current-side relationship input remains unchanged.

## Reference scope strategy

Do NOT reuse current-area manual zone selections for the reference model because reference areas can have different zone IDs.

Instead:
1. parse the reference Support Report XML first;
2. discover its exact ancestor zones with the existing zone discovery primitive;
3. derive an automatic reference relationship scope from all exact primary + secondary zones observed in that reference evidence;
4. scope the reference Clash-within-Supports rows to those exact zone identities before building `SupportPrimaryRelationshipBundle.v1`;
5. expose the derived scope and parsed/scoped/excluded counts in audit/UI state.

If no reference relationship XML is supplied, build the reference report exactly as today and let `RELATIONSHIP_TOPOLOGY_V1` remain `UNAVAILABLE` where explicit right-side authority is missing.

If the reference relationship XML is supplied but the derived reference Support Report zone scope excludes every relationship row, retain an empty explicit bundle/audit state and do not fabricate a topology match. The relationship matcher must remain fail-closed according to its existing authority rules.

## Data flow

Reference Support Report XML
  -> reference evidence
  -> discover exact reference zones
  -> derive automatic reference relationship scope

Reference Clash-within-Supports XML
  -> `buildSupportPrimaryRelationshipInput(...)`
  -> scoped `SupportPrimaryRelationshipBundle.v1`
  -> `buildSupportReportBundle({ primaryRelationshipBundle })`
  -> rightReportBundle
  -> existing `RELATIONSHIP_TOPOLOGY_V1`

No parser duplication.

## Audit contract

Support Report / typicality state must expose side-specific input metadata at minimum:
- side: CURRENT | REFERENCE;
- input present;
- parsed relationship row count;
- scoped relationship row count;
- excluded-by-zone count;
- bundle schema/summary;
- reference auto-scope exact primary/secondary zone IDs;
- scope basis `REFERENCE_SUPPORT_REPORT_EXACT_ANCESTRY`.

Human UI should make it clear that reference relationship topology is optional and independently scoped from the current-area zone selectors.

## Allowed production paths

- `tabs/support-steel-relationship-builder/support-report-addon.js`;
- `support-primary-input.js` and/or `support-report-zone-scope.js` only for a pure reusable reference-scope helper if useful;
- cache routing files only if required;
- focused tests;
- chain/workreport/Issue/PR control-plane files.

Read-only decision paths:
- `support-report-relationship-typicality.js`;
- `support-report-axis-typicality.js`;
- `support-report-typicality.js`;
- `support-report-typicality-projection.js` except no mutation should be required for this input-plumbing leg;
- grouping/count/orphan modules;
- #1216 Support/Steel producer modules.

## Hard prohibitions

- no current-side zone-scope semantic change;
- no matcher threshold/scoring/selection change;
- no structural/relationship/axis consensus policy change;
- no support grouping/count/orphan mutation;
- no workflow mutation;
- no merge.

## Required focused controls

1. reference relationship input absent -> existing reference build preserved and relationship topology may remain `UNAVAILABLE`;
2. reference relationship input present -> typed reference `primaryRelationshipBundle` reaches reference report;
3. reference automatic scope derives from reference evidence, not current selected zones;
4. unrelated relationship rows outside exact reference ancestor zones are excluded;
5. reference input audit records parsed/scoped/excluded counts and exact scope IDs;
6. left/current relationship bundle remains unchanged;
7. structural matcher output is unchanged;
8. axis matcher output is unchanged;
9. explicit topology available on both sides can make the existing relationship matcher informed without changing its code;
10. browser hot-session cache route loads the new UI/input plumbing.

Repository/browser/real benchmark execution remains NOT_RUN unless actual runner steps execute. No merge.
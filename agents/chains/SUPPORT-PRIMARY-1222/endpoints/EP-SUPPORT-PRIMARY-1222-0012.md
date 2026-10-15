CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0012
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0011
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: github:reallaksh19/XML_Compare_Utilities#1179
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-007
MATERIAL_BASE: a10bc76a4bbaf4a131387f6f13a69c42ab4d0154
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT

# LEG-007 prework — Column 22 RELATIONSHIP_TOPOLOGY_V1

Owner progression command: `fix, proceed next`.

This leg adds a **second independent family-level typicality evidence channel** based on Primary Support Assembly topology. It must not modify the existing structural matcher acceptance/scoring in `support-report-typicality.js`.

## Evidence channel

Profile/schema target:
- matcher/channel: `RELATIONSHIP_TOPOLOGY_V1`
- result enum: `MATCH | NO_MATCH | REVIEW | UNAVAILABLE`
- intrinsic evidence only; family numbers, global XYZ and row ordinal are not equality signals.

Family signature may use:
- effective Primary Support Assembly count from `primarySupportFamilySummaries`;
- explicit countable assembly count;
- sorted concrete-member-count spectrum per explicit assembly;
- explicit relationship edge-count/connectivity spectrum where available;
- normalized pipe-class population from report rows;
- nominal bore population where available;
- ambiguity/recovery availability as audit metadata.

## Authority / availability rule

Explicit relationship topology is authoritative for this matcher only when **both** compared families have explicit relationship authority. If either side lacks explicit relationship topology, the relationship matcher returns `UNAVAILABLE`; fallback geometry may be retained as advisory evidence but must not fabricate `NO_MATCH`.

When both sides have explicit authority:
- exact intrinsic signature -> `MATCH`;
- material topology signature difference -> `NO_MATCH`;
- partial/conflicting family evidence -> `REVIEW`.

## Independence rule

- Do not feed relationship signals into `compareStructuralFamilyFeatures` or its geometry cost.
- Do not retune existing structural thresholds to force agreement.
- Existing `structuralMatches` remain reproducible and unchanged.
- `RELATIONSHIP_TOPOLOGY_V1` results are stored as a separate audit channel.

## Integration boundary

This leg may add a conservative consensus wrapper above existing structural family selection and relationship topology evidence, but only if the rule is explicit and fail-visible:
- structural candidate + relationship same candidate -> high-confidence agreement;
- structural candidate + relationship `UNAVAILABLE` -> retain structural candidate with reduced/medium confidence;
- structural candidate + informed relationship rejection/different candidate -> `REVIEW`/`CONFLICT`, never silently overwrite;
- relationship evidence alone must not invent a Column 22 candidate when the structural matcher found none in this first integration leg unless separately audited and deterministic.

Column 23 display wording may mention agreement/unavailability/conflict, while machine reason/status fields remain authoritative.

## Allowed production paths

- new `tabs/support-steel-relationship-builder/support-report-relationship-typicality.js`;
- `support-report-typicality-projection.js` for attaching the independent channel/consensus only;
- `support-report-addon.js` only for cache routing if required;
- focused tests;
- chain/workreport/Issue/PR control-plane files.

Read-only reference paths include:
- `support-report-typicality.js`;
- `support-report-typicality-location.js`;
- `support-primary-relationship.js`;
- `support-primary-counting.js`.

## Hard prohibitions

- no change to existing structural matcher gates, thresholds, ranking, family-name tiebreak rules or location assignment algorithm;
- no Axis Typicality implementation in this leg;
- no raw global axis-vector comparison;
- no first-pass support grouping/orphan/count-policy mutation;
- no #1216 Support/Steel producer mutation;
- no workflow mutation;
- no merge.

## Required focused controls

1. identical explicit assembly topology across different family IDs -> `MATCH`;
2. explicit assembly-count mismatch -> `NO_MATCH`;
3. equal assembly count but different concrete-member-count/connectivity spectrum -> `NO_MATCH`;
4. missing explicit relationship authority on either side -> `UNAVAILABLE`, not `NO_MATCH`;
5. ambiguity/partial explicit family state -> `REVIEW` where applicable;
6. structural matcher output is unchanged when relationship channel is attached;
7. structural candidate + relationship unavailable retains candidate with reduced confidence;
8. structural candidate + relationship contradiction becomes fail-visible `REVIEW`/`CONFLICT`;
9. family ID differences do not affect relationship signature equality.

Repository/real/browser execution remains NOT_RUN unless actual runner steps execute. No merge.
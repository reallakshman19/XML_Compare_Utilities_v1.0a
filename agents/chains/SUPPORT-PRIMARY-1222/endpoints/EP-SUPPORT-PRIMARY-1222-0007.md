# EP-SUPPORT-PRIMARY-1222-0007 — WP-PSA-003 prework

CHAIN_ID: SUPPORT-PRIMARY-1222
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
PR: #1223
BRANCH: feature/support-primary-assembly-graph
BASE_MAIN: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
PREWORK_BRANCH_HEAD: e12aa6123617cdadcc7aa455b8c63a8812ff18cf
MATERIAL_LEG: LEG-004
STATE: PREWORK_READY
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Bounded objective

Implement WP-PSA-003 end-to-end input plumbing without changing grouping tolerances, orphan recovery, or Column 22 authority:

1. discover exact zone ancestor IDs from parsed Support Report paths;
2. expose two searchable multi-select columns: Primary / piping-support zones and Secondary / support zones;
3. use selected zone IDs as exact ancestor gates for current Support Report clash rows;
4. add optional Clash-within-Supports XML input;
5. parse it through `parseSupportMemberRelationshipXml()` and build `SupportPrimaryRelationshipBundle.v1`;
6. scope relationship edges by selected exact zone ancestry before building the bundle;
7. pass the resulting `primaryRelationshipBundle` into `buildSupportReportBundle()`;
8. persist selected zone scope in report/relationship audit state and invalidate stale report results when scope changes.

## Frozen semantics

- Empty zone selection on a side means no restriction for that side; this preserves existing behavior by default.
- Primary report row filtering is conjunctive across enabled sides: selected primary ancestor AND selected secondary ancestor must both match when both selections are non-empty.
- Zone matching is exact normalized path-node identity, never substring matching.
- Relationship XML is optional. If absent or invalid, existing geometry fallback remains the count path.
- Relationship-row zone scoping accepts an edge when at least one source path intersects any selected zone ID; it does not create carrier/steel authority.
- `#1216` Support/Steel producer authority remains untouched.
- Typical-reference XML is not filtered by the current-area zone scope in this leg; separate reference-area scoping is future work.
- No orphan resolver and no tolerance changes in LEG-004.
- No Column 22 matcher/consensus changes in LEG-004.

## Intended production paths

- new pure zone-scope helper under `tabs/support-steel-relationship-builder/`;
- `support-report-addon.js` for UI/input wiring;
- `support-report-engine.js` only if needed to expose zone-scope audit metadata;
- `support-primary-relationship.js` only for storing zone-scope audit metadata, not for changing topology semantics;
- focused tests for discovery, exact filtering, relationship-row scope, and no-selection preservation;
- relay/workreport files.

## Qualification controls

Must demonstrate synthetically:

- `/ASIM-1835-CU-PI-P` is discovered from primary paths and `/ASIM-1835-CU-SU` from secondary paths;
- exact selection excludes rows whose ancestry lacks the selected node even when a similar substring exists;
- empty selections preserve all rows;
- selected primary+secondary zones are conjunctive for report rows;
- optional relationship XML rows are filtered by exact ancestry before assembly construction;
- no relationship XML leaves `primaryRelationshipBundle` unavailable and preserves geometry fallback;
- existing count/typology/orphan code is not modified beyond required input/audit plumbing.

## Validation truth entering leg

- main unchanged at `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`;
- PR #1223 open/draft/mergeable at last observation;
- no merge authorization;
- GitHub Actions runner remains non-executing; repository-suite results remain NOT_RUN unless actual steps execute;
- real 1835 Clash-within-Supports XML remains unpinned.

## Exact next action

Implement LEG-004 within this policy, add focused tests and UI wiring, then inspect material diff and create a receipt/final endpoint. Do not implement orphan recovery or Column 22. Do not merge.

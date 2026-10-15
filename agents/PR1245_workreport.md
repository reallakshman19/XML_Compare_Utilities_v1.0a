# PR1245 work report — dynamic known-positive benchmark overlay

## Mission

Implement Slice 3 for #1239 after audit: derive the partial positive benchmark dynamically from supplied `T.CII -> expected CII`, join it onto the complete Source↔Target census, and expose expected/recovered/missing/additional audit evidence without turning TEXPECTED into identity authority or a complete output ceiling.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- PR: `reallaksh19/XML_Compare_Utilities#1245`
- Protocol: Engineering Relay V3.2, exact Owner-selected Common reference recorded on #1239
- Base dependency: draft PR #1244 / branch `fix/cii-writer2-source-target-audit-1239`
- Stack base SHA: `27488cbc04ad229f381cad5b684d24b0201c7669`
- Branch: `fix/cii-writer2-benchmark-overlay-1239`
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first findings

1. PB-0003 defines `TEXPECTED-PARTIALLLYDONE.CII` as a partial known-positive / lower-bound oracle, not a complete output oracle.
2. Production code must not contain retained benchmark node/hash/count special cases.
3. The existing test oracle already derives T→TEXPECTED NodeName deltas independently; production should use the normal CII intake path and be cross-checked against that independent oracle.
4. Benchmark recovery has two different meanings and must not be conflated:
   - correspondence recovered = known-positive TARGET reached by a bound census row;
   - mutation recovered = same row also has a qualified NodeName delta and the expected Writer action (`REPLACE -> COPY`, `CREATE -> CREATE`, `DELETE -> DELETE`).
5. Qualified mutations absent from TEXPECTED are `ADDITIONAL_QUALIFIED_NOT_IN_PARTIAL_BENCHMARK`, not automatic defects.
6. The benchmark can be loaded as an optional audit sidecar from the Source↔Target surface without modifying correspondence, decisions or transfer state.

## Declared denominator

| Unit | State |
|---|---|
| U1 dynamic T→expected NodeName delta model | IMPLEMENTED |
| U2 census overlay join by existing TARGET identity only | IMPLEMENTED |
| U3 expected / correspondence recovered / mutation recovered / missing / additional summary | IMPLEMENTED |
| U4 UI projection + CSV/JSON from the same overlay model | IMPLEMENTED |
| U5 retained independent-oracle cross-check + focused UI/host tests | AUTHORED / NOT_RUN |
| U6 exact-head evidence + stacked draft PR | ACTIVE |

## Implemented material

- `tabs/cii-workspace/cii-workspace-benchmark-overlay.js`
  - derives NodeName delta dynamically from supplied before/expected CII documents;
  - has raw-CII intake helper using production CII intake;
  - maps `REPLACE` benchmark rows to Writer `COPY` without hard-coded retained answers;
  - builds read-only census overlay and additional-qualified ledger;
  - serializes overlay CSV/JSON.
- `tabs/cii-workspace/cii-workspace-benchmark-overlay-ui.js`
  - lower-bound recovery KPIs and row table;
  - explicit warning that additional qualified rows are not automatically invalid;
  - CSV/JSON links from the same model.
- `tabs/cii-workspace/cii-workspace-benchmark-overlay-host.js`
  - optional expected-CII loader hosted by the census surface;
  - uses current target document as before-authority;
  - session cache keyed by target content hash;
  - updates census benchmark cells and overlay in place;
  - file input remains reusable after a successful load;
  - does not mutate correspondence/review/transfer state.
- `tabs/cii-workspace/cii-workspace-source-target-audit-ui.js`
  - adds Benchmark column;
  - embeds optional benchmark loader when no benchmark is supplied programmatically.

## Tests authored

- `tests/cii-workspace-benchmark-overlay.test.js`
  - synthetic REPLACE/CREATE derivation;
  - correspondence-vs-mutation recovery distinction;
  - additional-qualified lower-bound behavior;
  - CSV/JSON parity;
  - retained-real production derivation cross-checked row-for-row against existing independent TEXPECTED oracle, without embedding retained answer identities in the new test.
- `tests/cii-workspace-benchmark-overlay-ui.test.js`
  - overlay KPIs/statuses, benchmark census column, lower-bound warning and exports.
- `tests/cii-workspace-benchmark-overlay-host.test.js`
  - optional loader host contract and authority language.

## Falsifiers protected

- no production literal for retained result count;
- no production literal for retained action split;
- no production literal for retained CREATE target;
- no retained benchmark hash/node identity special case;
- no benchmark absence veto;
- no NodeName-as-correspondence-authority promotion;
- no correspondence generator changes;
- no mutation-authority changes;
- no benchmark byte changes.

## Validation truth

- architecture/source audit: PASS by exact repository inspection;
- stacked diff scope: PASS by GitHub compare against #1244 head;
- deterministic tests: AUTHORED / NOT_RUN in connector-only execution context;
- retained T/TEXPECTED cross-check: AUTHORED / NOT_RUN;
- browser file-loader interaction: NOT_RUN;
- retained S1/S2/S3→T Chromium benchmark: NOT_RUN;
- exact-head GitHub status/workflow evidence: pending final head check;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Read-only dynamic benchmark derivation + census overlay + optional audit loader + UI/export only.

## SEMANTIC_EVIDENCE_FRONTIER

T/TEXPECTED contributes lower-bound positive target-mutation evidence only. Source↔target mapping remains existing correspondence authority; Writer recovery remains existing engineering-delta/operation authority.

## EXACT_NEXT_ACTION

Delete the provisional WIP report, check exact final head statuses/workflows, publish `TASK_EVIDENCE` on #1239, then begin the next serialized slice only after this material frontier is durable. No merge.
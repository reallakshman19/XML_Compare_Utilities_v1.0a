# PR #1213 Workreport — Support Report DATUM metadata-only fallback

## Custody

- Parent: #1154 — Production-grade Support Report Builder
- Child: #1212 — Use unambiguous family DATUM as metadata-only fallback in Support Report
- PR: #1213
- Branch: `agent/support-report-1212-datum-metadata`
- Base main: `2adda1a481b791d463ed40002670f2a5c9284f38`
- Merge authority: OWNER_ONLY / FALSE at handover

## Owner-output RCA

The Owner-uploaded 1,321-row Support Report retained blank native metadata on rows such as PS-12001 and PS-12002. The authoritative staged 1885_NC source contains line-owned symbolic records such as `/PS-12001/DATUM` and `/PS-12002/DATUM` with `CMPSUPTYPE=REST` and other native support attributes.

The pre-change architecture correctly classified `/.../DATUM` as semantic role `DATUM` and correctly excluded it from reportable primary-support identity. The missing seam was metadata-only use: excluding symbolic identity also discarded its source-proven metadata.

## Implemented authority boundary

DATUM remains non-identity evidence. It may supply metadata only when:

1. no concrete native report member is selected;
2. the row has one physical report location (`locationCountOnPipe <= 1`);
3. the DATUM source is line/branch compatible under the same governed member-context rules used by Support Report member selection;
4. the requested field resolves without authoritative conflict.

Allowed DATUM fallback fields are deliberately narrow:

- SUPPORT TYPE;
- PIPING PRIMARY SUPPORT REFERENCE;
- PRIMARY SUPPORT DESCRIPTION;
- PIPE INSULATION THICKNESS (`INSU` plus the existing explicit thickness aliases).

DATUM never becomes `PIPING PRIMARY SUPPORT`, never participates in PREV-NAME alias resolution, and never supplies coordinate/member identity. Concrete native member attributes and the existing carrier authority remain higher precedence. Multi-location rows explicitly disable DATUM metadata fallback.

## Trace and provenance

Canonical row evidence now records:

- `metadataAttributionBasis`;
- `metadataSourceMemberIds`;
- `metadataAttributeConflicts`.

JSON trace additionally carries source path and line-context records for metadata-only DATUM evidence. Trace CSV advances to `SupportReportTraceCsv.v3` and Debug JSON to `SupportReportDebugExport.v3`, adding metadata attribution/source/conflict/context fields. The operational Owner 21-column CSV/XLSX contract is unchanged.

Field provenance class for successful DATUM fallback is:

`AUTHORITATIVE_NATIVE_FAMILY_DATUM_ATTRIBUTE`

Conflicting compatible DATUM values remain blank with:

`AUTHORITATIVE_SOURCE_CONFLICT`

## Context-matching ownership

The change initially pushed `support-report-engine.js` above the repository 300-line gate. That was not accepted. Shared member line/branch matching was extracted into:

`tabs/support-steel-relationship-builder/support-report-member-context.js`

The report engine now reuses that owner for ordinary concrete-member selection while row enrichment reuses the same owner for DATUM metadata eligibility. Final engine length is below the 300-line gate (299 lines); row-enrichment and trace-export modules also remain below 300 lines.

## Qualification controls

New permanent suite: `tests/support-report-datum-metadata.test.mjs`.

It proves:

1. single-location family DATUM recovers type/reference/description/INSU without becoming primary-support identity;
2. concrete native member metadata outranks DATUM;
3. contradictory-line DATUM is rejected;
4. conflicting compatible DATUM values stay blank and fail-visible;
5. multi-location rows disable DATUM fallback;
6. Trace CSV exposes the metadata source/basis and recovered value.

The suite is permanently wired into `.github/workflows/support-report-typicality-qualification.yml`.

Existing focused qualification simultaneously protects:

- PS-12154 `.2/.5` one physical row / no multi-location remark;
- PS-12120 19-clash → 14-row location behavior and five-location repeated pipe;
- `/SL-147.1` explicit PREV-NAME rename resolution;
- DBREF-form PREV-NAME rejection;
- BORE precedence and CU-PI Site/Zone;
- trace/debug export behavior;
- typicality controls and report-column contract.

## Pre-workreport validation

Validated head: `b690bfc9b1e4b7675cc576bc62b88e9ba97749f7`.

GitHub Actions:

- Support Report Typicality Qualification run `34619471533`: focused Node **86/86 PASS**; browser qualification **PASS**.
- Support Report Typicality ZIP Benchmark run `34619471367`: **PASS**, including 1884/1885 benchmark and selected diagnostics.
- PR mergeability observed TRUE while draft.

The earlier implementation head also passed the same focused package before cache/doc relay; the handover relies on the newer complete pre-workreport head above.

## Cache routing

Browser cache routing is advanced through:

`support-steel-relationship-bootstrap.js`
→ `support-report-addon.js`
→ `support-report-engine.js`
→ `support-report-row-enrichment.js`
→ `support-report-member-context.js`

The addon also advances the Trace CSV/Debug export module URL for the v3 trace contract.

## Concept note

`docs/SupportReportconceptnote.md` is updated to record:

- DATUM metadata-only authority and exclusions;
- multi-location fail-closed behavior;
- trace/debug metadata evidence;
- PREV-NAME DBREF typing;
- same-concrete-member location clustering/member attribution;
- Navisworks clash/report location as operational report-coordinate authority, with native staged POS retained as trace evidence only.

## Final-head gate

This workreport commit changes the branch head after the validation above. Therefore the PR must remain draft until the exact post-workreport head independently passes:

- focused Support Report qualification;
- Support/Steel browser qualification;
- Support Report ZIP benchmark.

No merge authorization is active. Green CI or mergeability does not authorize merge.

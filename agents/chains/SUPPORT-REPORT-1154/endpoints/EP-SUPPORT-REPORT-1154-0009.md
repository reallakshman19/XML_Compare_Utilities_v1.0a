# Endpoint EP-SUPPORT-REPORT-1154-0009 — WP-006 parity-ledger prework

- Previous endpoint: `EP-SUPPORT-REPORT-1154-0008`
- Work item: `github:reallaksh19/XML_Compare_Utilities#1154`
- Owner progression: `proceed next`
- Main observed: `d09849d2596c14c19cf2a03b5d92d349280e6e58`
- Prerequisite stack: #1173 WP-004 provenance; #1174 WP-005 Owner A:U contract
- INPUT-001: durable Owner clash XML
- INPUT-002: durable Owner XLSX oracle
- INPUT-003: still unresolved; no staged-model file exists in conversation custody
- Qualification scope: `QSCOPE-SUPPORT-REPORT-GOLDEN-PARITY-LEDGER`
- Question set: `SUPPORT-REPORT-1154-QS-0006` CURRENT / REFRESHED
- Same-custodian qualification: NOT_REQUIRED
- Chain handover ready: TRUE
- Takeover qualification ready: TRUE
- Write authority for this progression: WRITE_ALLOWED only for a pure WP-006 parity-ledger implementation and focused tests
- Merge authority: OWNER_ONLY / FALSE

## Authorized material boundary

Implement a deterministic comparator that consumes canonical Support Report rows plus an independently supplied golden oracle and emits one cell ledger row per expected row/Owner column with:

`rowKey, column, expected, actual, provenance, status`

Allowed statuses: `PASS`, `FAIL`, `UNRESOLVED_INPUT`.

The comparator may detect missing/duplicate/extra row identities and summarize counts. It must not alter parser, grouping, native member selection, carrier resolution, field projection, spreadsheet contract, expected oracle values, or production UI/export values.

## Acceptance for this material leg

- deterministic row identity uses secondary family + pipe full-line tag;
- Owner 21-column key order is supplied by the caller/contract, not duplicated as engineering truth inside the comparator;
- 10 complete expected rows imply a 210-cell domain;
- PASS + FAIL + UNRESOLVED_INPUT equals compared-cell count;
- blank expected/actual equality may PASS only when the actual field is not explicitly marked unresolved by provenance;
- missing authoritative actual source is classified `UNRESOLVED_INPUT`, never fabricated PASS;
- malformed oracle identity (duplicate/missing row key) fails visible;
- no target-specific PS-007/SL-097 values are hard-coded into production comparator logic.

Exact next action: create isolated `agent/support-report-1154-wp006` from WP-005 head, implement the pure ledger + tests, validate, then freeze LEG-004/EP-0010. Exact target BM-004 remains blocked until INPUT-003 exists.

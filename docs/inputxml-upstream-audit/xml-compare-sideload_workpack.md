# Phase 1 Work Pack — XML Compare sideload diagnostics

This Work Pack is limited to the shared XML Compare sideload enrichment engine and its two existing UI front doors.

## User-visible result

After applying or exporting sideload enrichment, the popup now shows a structured diagnostics panel and offers a downloadable `xml_compare_sideload_diagnostics.json` artifact. The same panel is available in the native Line-wise XML Enrichment workflow.

## Measurable behavior

The run records:

- duplicate input keys and the selected row;
- rows parsed, skipped or unmatched;
- ambiguous restraint-tag fallback;
- ignored restraint pair columns;
- XML attributes added, replaced or left unchanged;
- coordinate parse/solve diagnostics.

The existing last-row-wins and regex-based XML mutation behavior is preserved for compatibility.

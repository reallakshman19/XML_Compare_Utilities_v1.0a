# Table to Categorized XML Architecture

This workspace separates universal table-to-graph contracts from the PS Mapping preset surface.

Implemented in this pass:
- Universal contract validators under `xml-compare/table-categorizer/core/`.
- PS Mapping preset entrypoints under `xml-compare/table-categorizer/presets/ps-mapping/`.
- Profile-driven export policy for document root tag, root partition tag, XML declaration, attributes, and child field elements.
- Explicit SourceXML/TargetXML canvas handoff confirmation.
- Additional creation modes: conditional, lookup-joined, coordinate-clustered, and many-per-row.

Intentionally still constrained:
- The generic XML Compare canvas implementation is not changed by table-categorized handoff.
- PS Mapping compare semantics remain in the PS Mapping compare module.
- Many-per-row uses an explicit list resolver and delimiter; it does not infer array fields automatically.

Protected by tests:
- `tests/table-categorized-export-policy.test.js`
- `tests/table-categorized-canvas-handoff.test.js`
- `tests/table-categorized-contract-fixtures.test.js`
- `tests/table-categorized-creation-modes.test.js`

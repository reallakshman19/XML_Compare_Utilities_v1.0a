# XML Compare transfer proof sample

This proof pack demonstrates the Work Pack 4 transfer review path with compact engineering-style categorized XML.

Files:

- `source-categorized.xml` — Source A fixture containing `Line id="L-100"`, `Element elementKey="E-L100-10-20"`, and `Node nodeNumber="10" role="FROM"`.
- `target-categorized.xml` — Target B fixture containing the matching transfer destination `Line id="L-200"`, `Element elementKey="E-L200-110-120"`, and `Node nodeNumber="110" role="FROM"` plus unrelated same-node-number records.
- `expected-target-after-node-transfer.xml` — deterministic Target B output after replacing `NodeNameBlock` and `SupportBlock` through the state-backed transfer gate.
- `transfer-proof-plan.json` — sample proof metadata used by automated tests.

The sample intentionally proves:

- line/element/node/role-scoped node lookup,
- block replacement,
- append and skip-existing policy behavior in tests,
- unrelated same-node-number protection,
- source XML read-only behavior,
- target-only patched output.

This fixture does not auto-approve connectors, auto-stage transfer, or auto-apply transfer in the UI.

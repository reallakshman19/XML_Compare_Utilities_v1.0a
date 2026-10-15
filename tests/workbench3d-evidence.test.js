// W5: full evidence model (A/B/Delta/basis/traceability), domain templates,
// connector ledger and InputXML bend diagnostic integration.
import assert from 'assert';
import { buildEvidenceModel, connectorLedgerModel, evidenceDomainFor } from '../workbench3d/ui/evidence-view-models.js';
import { connectorLedgerHtml } from '../workbench3d/ui/evidence-panel.js';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';
import { parseInputXmlRecords } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { DIFF_STATUS } from '../workbench3d/contracts/contracts.js';

// ── node-support domain: matched-with-changes + deleted ──────────────────
const node = (id, e, extra = '') => `<Node id="${id}" e="${e}" n="0" u="0" bore="250"><Prop name="PARENT" value="PS-1"/><Prop name="REF" value="R-${id}"/>${extra}</Node>`;
const srcXml = `<NodeSet schema="nodeset/v1" name="src" unit="mm">
  ${node('PS-1.1', 0, '<Prop name="LC1_R" value="100"/><Prop name="TAG" value="LINE-A"/><Support kind="REST" detail="REST-50"/>')}
  ${node('PS-1.2', 5000, '<Support kind="GUIDE" detail="GUIDE-50"/>')}
</NodeSet>`;
const tgtXml = `<NodeSet schema="nodeset/v1" name="tgt" unit="mm">
  ${node('PS-1.1', 40, '<Prop name="LC1_R" value="150"/><Prop name="TAG" value="LINE-B"/><Support kind="REST" detail="REST-50"/>')}
</NodeSet>`;
const graphA = buildNodeSetGraph('source', srcXml);
const graphB = buildNodeSetGraph('target', tgtXml);
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 100 });
const graphs = { A: graphA, B: graphB };
assert.strictEqual(evidenceDomainFor(audit), 'NODE_SUPPORT');

const matchedRow = audit.objectDiff.rows.find((r) => r.sourceObjectId && r.targetObjectId);
const model = buildEvidenceModel(audit, graphs, matchedRow.diffId);
assert.ok(model, 'evidence model built');
assert.strictEqual(model.domain, 'NODE_SUPPORT');
assert.ok(model.hasSource && model.hasTarget);

// A/B fields from the node template, with change flags
const tagField = model.fields.find((f) => f.label === 'Tag');
assert.strictEqual(tagField.a, 'LINE-A');
assert.strictEqual(tagField.b, 'LINE-B');
assert.strictEqual(tagField.changed, true, 'tag change flagged');
const coordField = model.fields.find((f) => f.label === 'Coordinate E/N/U');
assert.ok(coordField.a.startsWith('0.0') && coordField.b.startsWith('40.0'), 'coordinates shown per side');

// delta lists position + load + property changes
assert.ok(model.delta.some(([k]) => k === 'Position Δ'), 'position delta present');
assert.ok(model.delta.some(([k]) => k === 'Load Δ'), 'load delta present');

// basis names the reference key; traceability carries raw rows + via
assert.ok(model.basis.some((b) => /reference key equal/i.test(b)), 'basis explains the match');
const trace = Object.fromEntries(model.traceability);
assert.strictEqual(trace['Source raw row'], 0, 'source raw row index');
assert.ok(String(trace['Match via']).startsWith('key'), 'via recorded');

// deleted row: source only, no target
const deletedRow = audit.objectDiff.rows.find((r) => r.status === DIFF_STATUS.MISSING_IN_TARGET);
const delModel = buildEvidenceModel(audit, graphs, deletedRow.diffId);
assert.ok(delModel.hasSource && !delModel.hasTarget);
assert.strictEqual(delModel.actions.canReject, false, 'deleted row cannot be reject-matched');
assert.ok(delModel.fields.find((f) => f.label === 'Node / support').a && !delModel.fields.find((f) => f.label === 'Node / support').b, 'source-only fields');

// ── element domain uses the XML template ─────────────────────────────────
const pipe = (rev) => `<CAESARII XML_TYPE="Input"><PIPINGMODEL>
  <PIPINGELEMENT FROM_NODE="${rev ? 1000 : 10}.000000" TO_NODE="${rev ? 1010 : 20}.000000" DELTA_X="500.000000" DIAMETER="114.3" WALL_THICK="6.0" MATERIAL_NAME="A106 B" NAME="E1"/>
</PIPINGMODEL></CAESARII>`;
const pAudit = runCompare(buildCanonicalGraph('source', parseInputXmlRecords(pipe(false)).records, {}), buildCanonicalGraph('target', parseInputXmlRecords(pipe(true)).records, {}), {});
const pGraphs = { A: buildCanonicalGraph('source', parseInputXmlRecords(pipe(false)).records, {}), B: buildCanonicalGraph('target', parseInputXmlRecords(pipe(true)).records, {}) };
assert.strictEqual(evidenceDomainFor(pAudit), 'XML_ELEMENT');
const eModel = buildEvidenceModel(pAudit, pGraphs, pAudit.objectDiff.rows[0].diffId);
assert.strictEqual(eModel.domain, 'XML_ELEMENT');
assert.ok(eModel.fields.some((f) => f.label === 'Diameter mm'), 'XML template fields');
assert.ok(eModel.fields.some((f) => f.label === 'Material'));

// unknown diffId → null
assert.strictEqual(buildEvidenceModel(audit, graphs, 'D-NOPE'), null);

// title uses the support node id, not the object id
assert.ok(/PS-1\.1/.test(model.title), `evidence title uses support id (got ${model.title})`);

// ── connector ledger reconciles with diff rows ───────────────────────────
const ledger = connectorLedgerModel(audit, graphs);
assert.strictEqual(ledger.length, audit.objectDiff.rows.length, 'one ledger row per diff row');
assert.ok(ledger.every((r) => r.symbol && r.status && (r.basis !== undefined)));
assert.ok(ledger.some((r) => r.source !== '—' && r.target !== '—'), 'matched rows show both sides');
assert.ok(ledger.some((r) => r.target === '—'), 'deleted row shows dash target');
assert.ok(ledger.some((r) => /PS-1\./.test(r.source)), 'ledger uses support ids');

const integratedHtml = connectorLedgerHtml({
  audit, graphs, sourceName: 'source.xml', targetName: 'target.xml',
  visuals: {
    A: { bendSummary: { requested: 1, resolved: 0, blocked: 1, arcSegments: 0 }, geometryDiagnostics: [{ objectId: 'source:E1', severity: 'BLOCKED', code: 'BEND_RADIUS_MISSING', message: 'Radius required.' }] },
    B: { bendSummary: { requested: 2, resolved: 2, blocked: 0, arcSegments: 24 }, geometryDiagnostics: [] },
  },
});
assert.match(integratedHtml, /data-wb3d-bend-diagnostics/);
assert.match(integratedHtml, /2\/3 resolved · 1 blocked/);
assert.match(integratedHtml, /data-action="select-object" data-object="source:E1"/);
assert.match(integratedHtml, /Connector ledger/);

console.log('workbench3d-evidence.test.js passed');
console.log(`  fields=${model.fields.length} delta=${model.delta.length} basis=${model.basis.length} ledger=${ledger.length}`);

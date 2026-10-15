// W1: DrilldownContext.v1 contract + row resolution + reconciliation with
// dashboard counts + filtered CSV export.
import assert from 'assert';
import { validateDrilldownContext, CONTRACT_VERSIONS } from '../workbench3d/contracts/contracts.js';
import { createDrilldownContext, resolveDrilldownRows, drilldownDomainFor, STATUS_SEVERITY, DRILLDOWN_CSV_COLUMNS } from '../workbench3d/ui/drilldown.js';
import { rowsToCsv } from '../workbench3d/apply/exporters.js';
import { parseInputXmlRecords } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';

// ── contract validation ───────────────────────────────────────────────────
const ctx = createDrilldownContext({
  widgetType: 'KPI_CARD',
  domain: 'XML_ELEMENT',
  title: 'Geometry changed elements',
  filter: { status: ['GEOMETRY_CHANGED'] },
  sourceWidgetId: 'kpi:GEOMETRY_CHANGED',
});
assert.strictEqual(ctx.contract, CONTRACT_VERSIONS.DrilldownContext);
assert.deepStrictEqual(validateDrilldownContext(ctx), [], 'valid context accepted');
assert.ok(validateDrilldownContext({ ...ctx, widgetType: 'POPUP' }).length > 0, 'unknown widget type rejected');
assert.ok(validateDrilldownContext({ ...ctx, filter: { status: 'GEOMETRY_CHANGED' } }).length > 0, 'non-array filter rejected');
assert.ok(validateDrilldownContext({ ...ctx, title: '' }).length > 0, 'missing title rejected');

// ── element-domain resolution reconciles with dashboard counts ───────────
const route = (renumber, tweak = false) => {
  const n = (v) => (v + renumber).toFixed(6);
  return `<CAESARII XML_TYPE="Input"><PIPINGMODEL>
    <PIPINGELEMENT FROM_NODE="${n(10)}" TO_NODE="${n(20)}" DELTA_X="500.000000" DIAMETER="114.3" TEMP_EXP_C1="350.0" NAME="A1"/>
    <PIPINGELEMENT FROM_NODE="${n(20)}" TO_NODE="${n(30)}" DELTA_Z="${tweak ? '900.000000' : '800.000000'}" DIAMETER="114.3" NAME="A2"/>
    <PIPINGELEMENT FROM_NODE="${n(30)}" TO_NODE="${n(40)}" DELTA_X="400.000000" DIAMETER="60.3" ${tweak ? 'PRESSURE1="9.0"' : 'PRESSURE1="2.0"'} NAME="A3"/>
  </PIPINGMODEL></CAESARII>`;
};
const graphA = buildCanonicalGraph('source', parseInputXmlRecords(route(0)).records, {});
const graphB = buildCanonicalGraph('target', parseInputXmlRecords(route(1000, true)).records, {});
const audit = runCompare(graphA, graphB, {});
assert.strictEqual(drilldownDomainFor(audit), 'XML_ELEMENT');

for (const [status, summaryKey] of [
  ['GEOMETRY_CHANGED', 'geometryChangedElements'],
  ['PROPERTY_CHANGED', 'propertyChangedElements'],
  ['MATCHED_UNCHANGED', 'unchangedElements'],
]) {
  const rows = resolveDrilldownRows(createDrilldownContext({ widgetType: 'KPI_CARD', domain: 'XML_ELEMENT', title: status, filter: { status: [status] } }), audit, { A: graphA, B: graphB });
  assert.strictEqual(rows.length, audit.summary[summaryKey], `${status} drilldown count == dashboard count`);
}

// severity ordering: geometry-changed rows before matched-unchanged
const allRows = resolveDrilldownRows(createDrilldownContext({ widgetType: 'KPI_CARD', domain: 'XML_ELEMENT', title: 'all', filter: {} }), audit, { A: graphA, B: graphB });
assert.strictEqual(allRows.length, audit.objectDiff.rows.length, 'no filter = every diff row');
for (let i = 1; i < allRows.length; i += 1) {
  assert.ok(allRows[i - 1].severity >= allRows[i].severity, 'sorted by severity desc');
}
assert.ok(STATUS_SEVERITY.AMBIGUOUS > STATUS_SEVERITY.PROPERTY_CHANGED);

// objectIds + prefix stripping + detail text
const geomRow = audit.objectDiff.rows.find((r) => r.status === 'GEOMETRY_CHANGED');
const byIds = resolveDrilldownRows(createDrilldownContext({ widgetType: 'ALERT', domain: 'XML_ELEMENT', title: 'alert', filter: { objectIds: [geomRow.sourceObjectId] } }), audit, null);
assert.strictEqual(byIds.length, 1);
assert.ok(!byIds[0].source.includes('source:'), 'prefix stripped');
assert.ok(byIds[0].detail.length > 0, 'geometry issue carried into detail');

// groupBy line (node-set graphs give '(nodes)' lines; piping gives '(model)')
const grouped = resolveDrilldownRows(createDrilldownContext({ widgetType: 'PIVOT_CELL', domain: 'XML_ELEMENT', title: 'pivot', filter: { groupBy: 'line', groupValue: '(model)' } }), audit, { A: graphA, B: graphB });
assert.strictEqual(grouped.length, allRows.length, 'single-line model groups everything under (model)');

// node-domain: positionDeltaMm surfaces in rows
const nodeXml = (shift) => `<NodeSet schema="nodeset/v1" name="t" unit="mm">
  <Node id="PS-1" e="${shift}" n="0" u="0" bore="250"/>
  <Node id="PS-2" e="${5000 + shift}" n="0" u="0" bore="250"/>
</NodeSet>`;
const nAudit = runNodeCompare(buildNodeSetGraph('source', nodeXml(0)), buildNodeSetGraph('target', nodeXml(30)), { positionToleranceMm: 100 });
assert.strictEqual(drilldownDomainFor(nAudit), 'NODE_SUPPORT');
const nodeRows = resolveDrilldownRows(createDrilldownContext({ widgetType: 'KPI_CARD', domain: 'NODE_SUPPORT', title: 'n', filter: {} }), nAudit, null);
assert.ok(nodeRows.some((r) => r.positionDeltaMm !== null && Math.abs(r.positionDeltaMm - 30) < 0.5), 'position delta in drilldown rows');

// CSV export of filtered rows
const csv = rowsToCsv(byIds, DRILLDOWN_CSV_COLUMNS);
assert.ok(csv.startsWith('Diff,Status,Source,Target'), 'CSV header');
assert.strictEqual(csv.split('\n').length, 2, 'header + 1 filtered row');

console.log('workbench3d-drilldown.test.js passed');
console.log(`  element rows=${allRows.length} node rows=${nodeRows.length} severityTop=${allRows[0]?.status}`);

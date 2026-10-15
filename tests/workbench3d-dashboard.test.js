// W2: dashboard view-models — KPI reconciliation, review queue, heatmap
// cell sums, exception cards, auto visual-mode selection.
import assert from 'assert';
import { kpiStripModel, reviewQueueModel, heatmapModel, exceptionCardsModel, autoVisualMode } from '../workbench3d/ui/dashboard-view-models.js';
import { resolveDrilldownRows, createDrilldownContext } from '../workbench3d/ui/drilldown.js';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';
import { parseInputXmlRecords } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { DIFF_STATUS } from '../workbench3d/contracts/contracts.js';

// node-set fixture: 2 parents, one moved child, one deleted, one added
const nodeXml = (side) => `<NodeSet schema="nodeset/v1" name="${side}" unit="mm">
  <Node id="PS-1.1" e="0" n="0" u="0" bore="250"><Prop name="PARENT" value="PS-1"/><Prop name="REF" value="R1"/><Support kind="REST" detail="REST-50"/></Node>
  <Node id="PS-1.2" e="${side === 'tgt' ? 40 : 0}" n="500" u="0" bore="250"><Prop name="PARENT" value="PS-1"/><Prop name="REF" value="R2"/><Prop name="LC1_R" value="${side === 'tgt' ? 140 : 100}"/></Node>
  ${side === 'src' ? '<Node id="PS-2.1" e="9000" n="0" u="0" bore="80"><Prop name="PARENT" value="PS-2"/><Prop name="REF" value="R3"/></Node>' : ''}
  ${side === 'tgt' ? '<Node id="PS-3.1" e="20000" n="0" u="0" bore="80"><Prop name="PARENT" value="PS-3"/><Prop name="REF" value="R4"/></Node>' : ''}
</NodeSet>`;
const graphA = buildNodeSetGraph('source', nodeXml('src'));
const graphB = buildNodeSetGraph('target', nodeXml('tgt'));
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 100 });
const graphs = { A: graphA, B: graphB };

// ── KPI strip reconciles with summary ─────────────────────────────────────
const kpis = kpiStripModel(audit);
const kpi = (id) => kpis.find((k) => k.id === id);
assert.strictEqual(kpi('total').value, audit.objectDiff.rows.length);
assert.strictEqual(kpi('added').value, audit.summary.newInTarget);
assert.strictEqual(kpi('deleted').value, audit.summary.missingInTarget);
assert.strictEqual(kpi('changed').value, audit.summary.propertyChangedElements + audit.summary.geometryChangedElements + audit.summary.splitElements + audit.summary.mergeElements);
// each KPI's filter resolves to exactly its displayed count
for (const entry of kpis.filter((k) => k.id !== 'total' && k.id !== 'matched')) {
  const rows = resolveDrilldownRows(createDrilldownContext({ widgetType: 'KPI_CARD', domain: 'NODE_SUPPORT', title: entry.label, filter: entry.filter }), audit, graphs);
  assert.strictEqual(rows.length, entry.value, `KPI ${entry.id} filter resolves to its count`);
}

// ── review queue: non-zero, severity-ordered, resolvable ─────────────────
const queue = reviewQueueModel(audit);
assert.ok(queue.every((e) => e.count > 0), 'only non-zero groups');
assert.ok(queue.some((e) => e.id === 'load-changed'), 'load-changed group present (LC1_R 100→140)');
assert.ok(queue.some((e) => e.id === 'deleted') && queue.some((e) => e.id === 'added'));
const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
for (let i = 1; i < queue.length; i += 1) assert.ok(rank[queue[i - 1].severity] >= rank[queue[i].severity], 'queue severity ordered');
for (const entry of queue) {
  const rows = resolveDrilldownRows(createDrilldownContext({ widgetType: 'KPI_CARD', domain: 'NODE_SUPPORT', title: entry.label, filter: entry.filter }), audit, graphs);
  assert.strictEqual(rows.length, entry.count, `queue ${entry.id} resolves to its count`);
}

// ── heatmap: cell sums reconcile; parent grouping works ──────────────────
const heatmap = heatmapModel(audit, graphs, 'parent');
assert.ok(heatmap.groups.includes('PS-1') && heatmap.groups.includes('PS-2') && heatmap.groups.includes('PS-3'), `parent groups (got ${heatmap.groups})`);
const cellSum = [...heatmap.cells.values()].reduce((s, c) => s + c.count, 0);
assert.strictEqual(cellSum, audit.objectDiff.rows.length, 'every diff row lands in exactly one cell');
for (const status of heatmap.statuses) {
  const columnSum = [...heatmap.cells.values()].filter((c) => c.status === status).reduce((s, c) => s + c.count, 0);
  assert.strictEqual(columnSum, audit.objectDiff.rows.filter((r) => r.status === status).length, `${status} column sum`);
}

// ── exception cards: no unchanged, severity-first, limited ───────────────
const cards = exceptionCardsModel(audit, graphs, 3);
assert.ok(cards.length <= 3);
assert.ok(cards.every((c) => c.status !== DIFF_STATUS.MATCHED_UNCHANGED));
for (let i = 1; i < cards.length; i += 1) assert.ok(cards[i - 1].severity >= cards[i].severity);

// ── auto visual mode ──────────────────────────────────────────────────────
assert.strictEqual(autoVisualMode(audit, graphs).mode, 'node-map', 'node compare → node map');
const pipeXml = `<CAESARII XML_TYPE="Input"><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DELTA_X="500.000000" DIAMETER="114.3"/></PIPINGMODEL></CAESARII>`;
const pipeGraph = buildCanonicalGraph('source', parseInputXmlRecords(pipeXml).records, {});
const pipeAudit = runCompare(pipeGraph, buildCanonicalGraph('target', parseInputXmlRecords(pipeXml).records, {}), {});
assert.strictEqual(autoVisualMode(pipeAudit, { A: pipeGraph, B: pipeGraph }).mode, '3d-overlay', 'element compare → 3D overlay');

console.log('workbench3d-dashboard.test.js passed');
console.log(`  kpis=${kpis.map((k) => `${k.id}:${k.value}`).join(' ')} queue=${queue.length} heatmapGroups=${heatmap.groups.length} cards=${cards.length}`);

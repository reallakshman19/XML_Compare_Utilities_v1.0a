// W4: node-support workspace view-models — 2.5D map, support tree, load
// matrix, support-type flow, match matrix.
import assert from 'assert';
import {
  nodeMapModel, supportTreeModel, loadMatrixModel, supportFlowModel, matchMatrixModel, availableNodeViews,
} from '../workbench3d/ui/node-workspace-view-models.js';
import { resolveDrilldownRows, createDrilldownContext } from '../workbench3d/ui/drilldown.js';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';
import { DIFF_STATUS } from '../workbench3d/contracts/contracts.js';

// PS-1 has 2 children (one load-changed), PS-2.1 deleted, PS-3.1 added,
// plus an ambiguous symmetric pair.
const node = (id, e, n, u, parent, ref, extra = '') =>
  `<Node id="${id}" e="${e}" n="${n}" u="${u}" bore="250"><Prop name="PARENT" value="${parent}"/><Prop name="REF" value="${ref}"/>${extra}</Node>`;
const srcXml = `<NodeSet schema="nodeset/v1" name="src" unit="mm">
  ${node('PS-1.1', 1000, 5000, 0, 'PS-1', 'R1', '<Support kind="REST" detail="REST-50"/>')}
  ${node('PS-1.2', 1000, 6000, 0, 'PS-1', 'R2', '<Prop name="LC1_R" value="100"/><Support kind="GUIDE" detail="GUIDE-50"/>')}
  ${node('PS-2.1', 9000, 5000, 0, 'PS-2', 'R3', '<Support kind="SHOE" detail="SHOE-300"/>')}
  ${node('AMB', 50000, 50000, 0, 'PS-9', '')}
</NodeSet>`;
const tgtXml = `<NodeSet schema="nodeset/v1" name="tgt" unit="mm">
  ${node('PS-1.1', 1000, 5000, 0, 'PS-1', 'R1', '<Support kind="REST" detail="REST-50"/>')}
  ${node('PS-1.2', 1040, 6000, 0, 'PS-1', 'R2', '<Prop name="LC1_R" value="150"/><Support kind="SHOE" detail="SHOE-50"/>')}
  ${node('PS-3.1', 20000, 5000, 0, 'PS-3', 'R9', '<Support kind="REST" detail="REST-80"/>')}
  ${node('AMB-A', 50010, 50000, 0, 'PS-9', '')}
  ${node('AMB-B', 49990, 50000, 0, 'PS-9', '')}
</NodeSet>`;
const graphA = buildNodeSetGraph('source', srcXml);
const graphB = buildNodeSetGraph('target', tgtXml);
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 100 });
const graphs = { A: graphA, B: graphB };

// ── 2.5D map: one point per diff row that has a coordinate ───────────────
const map = nodeMapModel(audit, graphs);
assert.strictEqual(map.points.length, audit.objectDiff.rows.length, 'a map point per diff row');
assert.ok(map.points.every((p) => Number.isFinite(p.east) && Number.isFinite(p.north)), 'east/north numeric');
assert.ok(map.bounds.maxE > map.bounds.minE, 'bounds span east');
const loadPt = map.points.find((p) => p.label === 'PS-1.2');
assert.ok(loadPt && loadPt.loadDeltaPct > 0, 'load delta carried onto map point');
// each point filter resolves to exactly its row
for (const p of map.points.slice(0, 5)) {
  assert.strictEqual(resolveDrilldownRows(createDrilldownContext({ widgetType: 'NODE_MARKER', domain: 'NODE_SUPPORT', title: p.label, filter: p.filter }), audit, graphs).length, 1);
}

// ── support tree: parents grouped, changed parents first ─────────────────
const tree = supportTreeModel(audit, graphs);
const ps1 = tree.find((g) => g.parent === 'PS-1');
assert.ok(ps1, 'PS-1 parent present');
assert.strictEqual(ps1.children.length, 2, 'PS-1 has 2 child supports');
assert.ok(ps1.changed, 'PS-1 flagged changed (PS-1.2 moved/load)');
assert.strictEqual(tree[0].changed, true, 'changed parents sort first');
const treeTotal = tree.reduce((s, g) => s + g.children.length, 0);
assert.strictEqual(treeTotal, audit.objectDiff.rows.length, 'every row appears once in the tree');

// ── load matrix: LC1 present, delta computed, sorted by max delta ────────
const load = loadMatrixModel(audit, graphs);
assert.deepStrictEqual(load.caseIds, ['LC1'], 'one load case discovered');
assert.strictEqual(load.rows.length, 1, 'one matched node carries load props');
assert.ok(Math.abs(load.rows[0].cases.LC1.deltaPct - 33.3) < 0.2, `100→150 ≈ 33.3% (got ${load.rows[0].cases.LC1.deltaPct})`);

// ── support-type flow: same/removed/added links ──────────────────────────
const flow = supportFlowModel(audit, graphs);
assert.ok(flow.some((l) => l.from === 'REST' && l.to === 'REST'), 'REST→REST persists');
assert.ok(flow.some((l) => l.from === 'GUIDE' && l.to === '(removed)'), 'GUIDE removed on PS-1.2');
assert.ok(flow.some((l) => l.to === 'SHOE' && l.from === '(added)') || flow.some((l) => l.from === 'SHOE'), 'SHOE movement captured');
const flowTotal = flow.reduce((s, l) => s + l.count, 0);
assert.ok(flowTotal > 0 && flow.every((l) => l.diffIds.length === l.count), 'flow link counts match diffIds');

// ── match matrix: ambiguous source × candidate targets ───────────────────
const matrix = matchMatrixModel(audit);
assert.strictEqual(matrix.rows.length, 1, 'one ambiguous source');
assert.ok(matrix.rows[0].candidates.length >= 2, 'two candidate targets');
assert.ok(matrix.targets.length >= 2);

// ── availability flags drive the mode tabs ───────────────────────────────
const available = availableNodeViews(audit, graphs);
assert.deepStrictEqual(available, { map: true, tree: true, load: true, flow: true, matrix: true });

console.log('workbench3d-nodeviz.test.js passed');
console.log(`  mapPts=${map.points.length} parents=${tree.length} loadRows=${load.rows.length} flowLinks=${flow.length} ambiguous=${matrix.rows.length}`);

// W3: multi-revision tables, reference-first key ladder, remarks
// classification, and load-case grouping — modeled on the real support
// register (PS-27161 keeps its child supports across Rev 1 → Rev 5 while
// line number, loads, and hold status change).
import assert from 'assert';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { suggestRoles, createNodeSetMapping, validateMapping } from '../workbench3d/tablexml/column-mapper.js';
import { buildNodeSetModel, serializeNodeSetXml, discoverRevisions } from '../workbench3d/tablexml/nodeset-builder.js';
import { detectLoadCaseGroups, buildLoadProps, loadDeltaBetween } from '../workbench3d/tablexml/load-cases.js';
import { classifyRemarks } from '../workbench3d/compare/remarks-classifier.js';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';
import { validateCompareAudit, DIFF_STATUS, CONFIDENCE } from '../workbench3d/contracts/contracts.js';

// ── remarks classifier ────────────────────────────────────────────────────
assert.deepStrictEqual(classifyRemarks(''), []);
assert.deepStrictEqual(classifyRemarks('Line No. Change(Old Line No. QHBF-1000-2-B271XXX3-11441-01)'), ['LINE_NO_CHANGED']);
assert.deepStrictEqual(classifyRemarks('Invalid (Line No. Changed)'), ['INVALID_ROW', 'LINE_NO_CHANGED']);
assert.deepStrictEqual(classifyRemarks('Deleted Support'), ['DELETED_SUPPORT']);
const combo = classifyRemarks('Hold Removed, Load changes, PS No./Line No. Change, Total No. of support change(Earlier was PS-27161(REF))');
for (const flag of ['HOLD_REMOVED', 'LOAD_CHANGED', 'PS_NO_CHANGED', 'LINE_NO_CHANGED', 'SUPPORT_COUNT_CHANGED']) {
  assert.ok(combo.includes(flag), `combo remark includes ${flag} (got ${combo})`);
}

// ── load-case grouping ────────────────────────────────────────────────────
const loadCols = [
  { columnId: 'Fy', header: 'Fy' }, { columnId: 'Fy__2', header: 'Fy' }, { columnId: 'Fy__3', header: 'Fy' },
  { columnId: 'Fx', header: 'Fx' }, { columnId: 'Fy__4', header: 'Fy' }, { columnId: 'Fz', header: 'Fz' },
  { columnId: 'Fx__2', header: 'Fx' }, { columnId: 'Fy__5', header: 'Fy' }, { columnId: 'Fz__2', header: 'Fz' },
];
const cases = detectLoadCaseGroups(loadCols);
assert.strictEqual(cases.length, 5, `Fy Fy Fy | FxFyFz | FxFyFz → 5 cases (got ${cases.length})`);
assert.deepStrictEqual(cases[3].components.map((c) => c.component), ['FX', 'FY', 'FZ']);
const lp = buildLoadProps({ rawByColumnId: { Fx: '-3811', Fy__4: '-6217', Fz: '-1220', Fy: '-5406' } }, cases, []);
assert.strictEqual(lp.LC1_FY, -5406);
assert.ok(Math.abs(lp.LC4_R - Math.hypot(3811, 6217, 1220)) < 0.01, 'resultant magnitude');
const delta = loadDeltaBetween({ LC1_R: '100' }, { LC1_R: '142' });
assert.ok(Math.abs(delta.maxDeltaPct - 29.58) < 0.1, `+42 on 142 base ≈ 29.6% (got ${delta.maxDeltaPct})`);
assert.strictEqual(loadDeltaBetween({ A: '1' }, { A: '2' }), null, 'no LC props → null');

// ── multi-revision register (single paste, Rev 1 + Rev 5) ────────────────
const register = [
  'PSNO\tPIPE\tPIPING PRIMARY SUPPORT\tSUPPORT TYPE\tPIPING PRIMARY SUPPORT REFERENCE\tEAST/WEST\tNORTH/SOUTH\tBOP ELEVATION\tREVISION\tREMARKS\tFx\tFy\tFz',
  // Rev 1: PS-27161 with 4 children at node 280 (24" line), PS-27162 with 2 children
  'PS-27161\t24"-P2710074\t/PS-27161.1, /PS-27161.4, /PS-27161.2, /PS-27161.3\tREST-300, SHOE-300, GUIDE-300, LINE-STOP-300\t=67127059/23522, =67127059/78566, =67127059/82402, =67127059/78567\t82720.84\t669250.002\t100700\t1\tHOLD-1.SUPPORT\t-3811\t-6217\t-1220',
  'PS-27162\t2"-B2710070\t/PS-27162.2, /PS-27162.5\tREST-50, GUIDE-50\t=67127059/28669, =67127059/82045\t77000\t669800\t102350\t1\t\t-100\t-200\t-50',
  // Rev 5: PS-27161 same children/refs, MOVED 5mm, line changed to 12", loads changed, hold removed; PS-27162 lost .5
  'PS-27161\t12"-P2710102\t/PS-27161.1, /PS-27161.4, /PS-27161.2, /PS-27161.3\tREST-300, SHOE-300, GUIDE-300, LINE-STOP-300\t=67127059/23522, =67127059/78566, =67127059/82402, =67127059/78567\t82725\t669250\t100700\t5\tHold Removed, Load changes, PS No./Line No. Change\t-4335\t-8204\t3372',
  'PS-27162\t2"-B2710070\t/PS-27162.2\tREST-50\t=67127059/28669\t77000\t669800\t102350\t5\tPS No. Change(Was Earlier PS-27158(REF))\t-110\t-210\t-55',
].join('\n');

const source = parseTableSource(register, { sourceId: 'TR' });
const roles = suggestRoles(source);
assert.strictEqual(roles.REVISION, 'revision');
assert.strictEqual(roles.REMARKS, 'remarks');
assert.strictEqual(roles.Fx, 'load');
assert.strictEqual(roles.Fy, 'load');
let mapping = createNodeSetMapping(source, roles);
mapping.grain = 'exploded';
assert.deepStrictEqual(validateMapping(mapping), []);
assert.deepStrictEqual(discoverRevisions(source, mapping), ['1', '5']);

const modelA = buildNodeSetModel(source, mapping, [], 'rev1', { revisionFilter: '1' });
const modelB = buildNodeSetModel(source, mapping, [], 'rev5', { revisionFilter: '5' });
assert.strictEqual(modelA.nodes.length, 6, `Rev1: 4+2 exploded nodes (got ${modelA.nodes.length})`);
assert.strictEqual(modelB.nodes.length, 5, `Rev5: 4+1 exploded nodes (got ${modelB.nodes.length})`);
assert.ok(modelA.nodes[0].props.some((p) => p.name === 'REVISION' && p.value === '1'));
assert.ok(modelB.nodes[0].props.some((p) => p.name === 'FLAGS' && p.value.includes('HOLD_REMOVED')), 'flags on rev5 nodes');
assert.ok(modelA.nodes[0].props.some((p) => p.name === 'LC1_R'), 'load resultant prop present');

// ── key ladder: same REF survives the 5mm move AND the line change ────────
const graphA = buildNodeSetGraph('source', serializeNodeSetXml(modelA));
const graphB = buildNodeSetGraph('target', serializeNodeSetXml(modelB));
// tolerance of 1mm — spatial matching alone would FAIL the 5mm move
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 1 });
assert.deepStrictEqual(validateCompareAudit(audit), []);
assert.strictEqual(audit.summary.matchedElements, 5, `all 5 surviving supports matched via keys (got ${audit.summary.matchedElements})`);
assert.strictEqual(audit.summary.keyMatchedElements, 5, 'matched through the key ladder, not spatial grid');
assert.strictEqual(audit.summary.missingInTarget, 1, 'PS-27162.5 deleted');

const row161 = audit.objectDiff.rows.find((r) => graphA.objects.find((o) => o.objectId === r.sourceObjectId)?.fromNode === 'PS-27161.1');
assert.strictEqual(row161.confidence, CONFIDENCE.HIGH, 'key match forces HIGH confidence');
assert.ok(row161.reasons.some((r) => /reference key equal/.test(r)), 'reason names the reference key');
assert.ok(Math.abs(row161.positionDeltaMm - Math.hypot(82725 - 82720.84, 0, 0)) < 0.1, 'move recorded as position delta');
assert.strictEqual(row161.status, DIFF_STATUS.PROPERTY_CHANGED, 'line/load changes classify as property changed');
assert.ok(row161.changedProperties.some((c) => c.property === 'TAG' || c.property.startsWith('LC1_')), 'line or load change captured');
assert.ok(!row161.changedProperties.some((c) => ['REVISION', 'REMARKS', 'FLAGS'].includes(c.property)), 'metadata props excluded from diff');
assert.ok(row161.loadDeltaPct > 5, `load delta computed (got ${row161.loadDeltaPct}%)`);
assert.ok(row161.remarkFlags.includes('LINE_NO_CHANGED'), 'remark flags surfaced on the row');
assert.ok(audit.summary.loadChangedElements >= 4, 'load-changed nodes counted');
assert.ok(audit.summary.remarkFlaggedElements >= 4, 'flagged nodes counted');

console.log('workbench3d-noderevision.test.js passed');
console.log(`  rev1=${modelA.nodes.length} rev5=${modelB.nodes.length} keyMatched=${audit.summary.keyMatchedElements} missing=${audit.summary.missingInTarget} maxLoadΔ=${audit.summary.maxLoadDeltaPct}%`);

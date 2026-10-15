// Table-to-XML engine: extraction against the real table formats, grouping,
// NodeSet build → serialize → parse → graph roundtrip, schema detection.
import assert from 'assert';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import {
  extractNumber, extractAxisComponents, boreToNb, splitList, supportKindOf, previewExtraction, DEFAULT_EXTRACT_RULES,
} from '../workbench3d/tablexml/text-to-number.js';
import {
  suggestRoles, createNodeSetMapping, updateMappingColumn, mappingLinks, validateMapping,
  dynamicFields, fieldIdForColumn,
} from '../workbench3d/tablexml/column-mapper.js';
import { extractPoints, resolveGroups, mergeGroupedRows } from '../workbench3d/tablexml/grouping-resolver.js';
import { buildNodeSetModel, serializeNodeSetXml, NODESET_SCHEMA } from '../workbench3d/tablexml/nodeset-builder.js';
import { isNodeSetXml, parseNodeSetRecords, buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { detectSchema, XML_SCHEMA_KINDS } from '../workbench3d/adapters/inputxml-adapter.js';
import { validateCanonicalObjectGraph } from '../workbench3d/contracts/contracts.js';
import { buildVisualModel } from '../workbench3d/adapters/visual-model-builder.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';

// ── extractNumber against real value shapes ──────────────────────────────
const cases = [
  ['E 3000mm', 3000, 'mm-suffix'],       // format 1 positionRaw fragment
  ['106500mm', 106500, 'mm-suffix'],     // format 7 "U 106500mm"
  ['2in', 50.8, 'inch-suffix'],          // format 5 "2in"
  ['4"', 101.6, 'inch-quote'],           // format 4/7 quoted-inch pipe size
  ['250', 250, 'plain'],                 // format 1 p1bore
  ['273.2', 273.2, 'plain'],             // format 2 table3Od
  ['1179.000', 1179, 'plain'],           // format 5 metre column (scaled via column unit)
  ['-19875', -19875, 'plain'],           // format 2 rawZ negative
];
for (const [raw, expected, ruleId] of cases) {
  const result = extractNumber(raw);
  assert.ok(result.ok, `extracts "${raw}"`);
  assert.ok(Math.abs(result.value - expected) < 1e-6, `"${raw}" → ${expected} (got ${result.value})`);
  assert.strictEqual(result.ruleId, ruleId, `"${raw}" via ${ruleId}`);
}
assert.strictEqual(extractNumber('').ok, false);
assert.strictEqual(extractNumber('unset').ok, false);

// ── axis components ──────────────────────────────────────────────────────
assert.deepStrictEqual(extractAxisComponents('E 0mm S 3000mm U 100000mm'), { e: 0, n: -3000, u: 100000 });
assert.deepStrictEqual(extractAxisComponents('W 27750mm S 559255mm U 106500mm'), { e: -27750, n: -559255, u: 106500 });
assert.deepStrictEqual(extractAxisComponents('E 2100mm N 500mm D 30mm'), { e: 2100, n: 500, u: -30 });

// ── bore + support lists ─────────────────────────────────────────────────
assert.strictEqual(boreToNb(2 * 25.4, 'in'), 50, '2in → DN50');
assert.strictEqual(boreToNb(12 * 25.4, 'in'), 300, '12" → DN300');
assert.deepStrictEqual(splitList('REST-300, SHOE-300, LINE-STOP-300'), ['REST-300', 'SHOE-300', 'LINE-STOP-300']);
assert.strictEqual(supportKindOf('LINE-STOP-300'), 'LINE-STOP');
assert.strictEqual(supportKindOf('REST-50'), 'REST');
assert.strictEqual(supportKindOf('GUIDE'), 'GUIDE');

// ── Format 1 (quoted CSV, psE/psU/psS columns, duplicate coordinates) ────
const format1 = [
  '"rowId","psKey","psName","positionRaw","psE","psU","psS","p1bore","sourceTable"',
  '"r1","PS-01","PS-01","E 0mm S 3000mm U 100000mm","0","100000","3000","250","TABLE1"',
  '"r2","PS-02","PS-02","E 0mm S 6000mm U 100000mm","0","100000","6000","250","TABLE1"',
  '"r3","PS-02B","PS-02B","E 0mm S 6000mm U 100000mm","0","100000","6000","250","TABLE1"', // duplicate coord of r2
  '"r4","PS-05","PS-05","E 6000mm S 12000mm U 100000mm","6000","100000","12000","50","TABLE1"',
].join('\n');
const source1 = parseTableSource(format1, { sourceId: 'T1', sourceName: 'Table-1' });
assert.strictEqual(source1.rows.length, 4);

const roles1 = suggestRoles(source1);
assert.strictEqual(roles1.psE, 'coord-e');
assert.strictEqual(roles1.psU, 'coord-u');
assert.strictEqual(roles1.psS, 'coord-n');
assert.strictEqual(roles1.p1bore, 'bore');
assert.strictEqual(roles1.psKey, 'node-id');
assert.strictEqual(roles1.positionRaw, 'coord-combined');

// map explicit axis columns only (drop combined to avoid double assignment)
let mapping1 = createNodeSetMapping(source1, { ...roles1, positionRaw: 'ignore' });
assert.deepStrictEqual(validateMapping(mapping1), [], 'mapping valid');
assert.ok(mappingLinks(mapping1).some((l) => l.columnId === 'psE' && l.field === 'coord-e'));
mapping1 = updateMappingColumn(mapping1, 'sourceTable', { role: 'prop', propName: 'SOURCE' });

const points1 = extractPoints(source1, mapping1);
assert.deepStrictEqual(points1[0].point, { e: 0, n: 3000, u: 100000 }, 'numeric axis columns extracted (psS→n, psU→u)');

// grouping: r2 + r3 share a coordinate → 3 clusters, psE/psU/psS constant basis
const groups1 = resolveGroups(source1, mapping1);
assert.strictEqual(groups1.clusters.length, 3);
assert.strictEqual(groups1.duplicateClusters, 1);
const dupCluster = groups1.clusters.find((c) => c.rowIds.length === 2);
assert.deepStrictEqual(dupCluster.rowIds, ['T1:2', 'T1:3']);
const merged = mergeGroupedRows(dupCluster.rowIds.map((id) => source1.rows.find((r) => r.rowId === id)), mapping1);
assert.strictEqual(merged.rawByColumnId.psKey, 'PS-02|PS-02B', 'distinct values | concatenated');
assert.strictEqual(merged.rawByColumnId.p1bore, '250', 'identical values not duplicated');

// build + serialize with grouping on
mapping1.grouping.enabled = true;
const model1 = buildNodeSetModel(source1, mapping1, [], 'source-table');
assert.strictEqual(model1.nodes.length, 3, 'grouped to 3 nodes');
const groupedNode = model1.nodes.find((n) => n.id.includes('|'));
assert.ok(groupedNode, 'grouped node id concatenated');
const xml1 = serializeNodeSetXml(model1);
assert.ok(isNodeSetXml(xml1));
assert.strictEqual(detectSchema(xml1), XML_SCHEMA_KINDS.NODESET_XML);

// ── Format 2 (rawX/rawY/rawZ, node ids, support-free) ────────────────────
const format2 = [
  '"rowId","node","rawX","rawY","rawZ","table3Od","finalNodeBore"',
  '"n1","10","17200","0","1000","273","250"',
  '"n2","20","15400","0","-2000","273","250"',
  '"n3","30","13600","0","-5000","273","250"',
].join('\n');
const source2 = parseTableSource(format2, { sourceId: 'T2', sourceName: 'Table-2' });
const roles2 = suggestRoles(source2);
assert.strictEqual(roles2.rawX, 'coord-e');
assert.strictEqual(roles2.rawY, 'coord-n');
assert.strictEqual(roles2.rawZ, 'coord-u');
assert.strictEqual(roles2.node, 'node-id');
const mapping2 = createNodeSetMapping(source2, roles2);
const model2 = buildNodeSetModel(source2, mapping2, [], 'target-table');
assert.strictEqual(model2.nodes.length, 3);
const xml2 = serializeNodeSetXml(model2);

// ── Format 5-style metre columns (unit override) ─────────────────────────
const format5 = [
  'sid\tREST TAG\tPIPE CL# CO-ORDINATE (X) (m)\tPIPE CL# CO-ORDINATE (Y) (m)\tPIPE CL# CO-ORDINATE (Z) (m)\tSUPPORT TAG',
  'FG452\tREST\t1179.000\t226.175\t108.033\tMT1-A-2',
].join('\n');
const source5 = parseTableSource(format5, { sourceId: 'T5' });
const roles5 = suggestRoles(source5);
let mapping5 = createNodeSetMapping(source5, roles5);
for (const axis of ['coord-e', 'coord-n', 'coord-u']) {
  const col = mapping5.columns.find((c) => c.role === axis);
  assert.ok(col, `${axis} suggested for metre header`);
  mapping5 = updateMappingColumn(mapping5, col.columnId, { unit: 'm' });
}
const points5 = extractPoints(source5, mapping5);
assert.deepStrictEqual(points5[0].point, { e: 1179000, n: 226175, u: 108033 }, 'metre columns scaled to mm');

// support list preview
assert.strictEqual(previewExtraction(source5.rows, source5.columnIds[2], DEFAULT_EXTRACT_RULES)[0].ok, true);

// ── Format 7 (real support register): multi-line quoted header, mid-cell
//    inch quotes, trailing empty columns, mixed E/S/N letter coordinates ────
import { normalizeTableText, dropEmptyColumns, prepareTableText } from '../workbench3d/tablexml/table-normalizer.js';

const format7 = [
  'PREV NAME\tSCOPE\t"CIVIL SECONDARY SUPPORT',
  '(Tag provided by Civil)"\tPIPE\tSIZE\tSUPPORT TYPE\tEAST/WEST\tNORTH/SOUTH\tBOP ELEVATION\tNODE NO\t\t\t',
  'PS06855\tQHBF\tPS-27160(REF)\tQHBF-1000-24"-P2710074-36620A1-HC-01\t300\tREST-300, SHOE-300\tE 82720.84mm\tS 669800.04mm\tU 102350mm\t280\t\t\t',
  'PS08225\tQHBF\tPS-27160A(REF)\tQHBF-1000-2-B271XXX3-11441-01\t50\tREST-50\t83075.392mm\tN 669658.543mm\tU 101300mm\t290\t\t\t',
].join('\n');

const normalized7 = prepareTableText(format7);
assert.strictEqual(normalized7.split('\n').length, 3, 'multi-line quoted header merged into one line');
assert.ok(normalized7.includes('CIVIL SECONDARY SUPPORT (Tag provided by Civil)'), 'header cell unwrapped, newline → space');
assert.ok(normalized7.includes('QHBF-1000-24"-P2710074'), 'mid-cell inch quote untouched');

const source7 = parseTableSource(normalized7, { sourceId: 'T7' });
assert.strictEqual(source7.headers.length, 10, `trailing empty columns dropped (got ${source7.headers.length})`);
assert.strictEqual(source7.rows.length, 2);
const roles7 = suggestRoles(source7);
assert.strictEqual(roles7['EAST/WEST'], 'coord-e');
assert.strictEqual(roles7['NORTH/SOUTH'], 'coord-n');
assert.strictEqual(roles7.BOP_ELEVATION, 'coord-u');
assert.strictEqual(roles7.NODE_NO, 'node-id');
assert.strictEqual(roles7.SUPPORT_TYPE, 'support-types');
const mapping7 = createNodeSetMapping(source7, roles7);
assert.deepStrictEqual(validateMapping(mapping7), [], 'format 7 mapping valid');
const model7 = buildNodeSetModel(source7, mapping7, [], 'fmt7');
assert.strictEqual(model7.nodes.length, 2, 'both format-7 rows produce nodes');
assert.ok(Math.abs(model7.nodes[0].e - 82720.84) < 1e-6, 'letter-prefixed coordinate extracted');
assert.ok(Math.abs(model7.nodes[1].e - 83075.392) < 1e-6, 'bare mm coordinate extracted');
assert.ok(model7.nodes[0].supports.some((s) => s.kind === 'SHOE'), 'support kinds parsed');

// ── Dynamic mapping-canvas fields + custom property fields ───────────────
let mappingDyn = updateMappingColumn(mapping7, 'SCOPE', { role: 'prop', propName: 'SCOPE' });
const fieldsDyn = dynamicFields(mappingDyn, ['SCHEDULE']);
assert.ok(fieldsDyn.some((f) => f.id === 'prop:SCOPE' && !f.custom), 'mapped property gets its own field port');
assert.ok(fieldsDyn.some((f) => f.id === 'prop:SCHEDULE' && f.custom), 'user-added custom field present');
assert.ok(!fieldsDyn.some((f) => f.id === 'prop' || f.id === 'ignore'), 'generic prop/ignore not shown as ports');
assert.strictEqual(fieldIdForColumn(mappingDyn.columns.find((c) => c.columnId === 'SCOPE')), 'prop:SCOPE');
assert.ok(mappingLinks(mappingDyn).some((l) => l.columnId === 'SCOPE' && l.field === 'prop:SCOPE'), 'edge targets the named prop port');

// ── Exploded support-point grain (Table-1 style: child list + type + ref) ──
const table1 = [
  'PSNO_PIPE\tPIPING PRIMARY SUPPORT\tSUPPORT TYPE\tPIPING PRIMARY SUPPORT REFERENCE\tEAST/WEST\tNORTH/SOUTH\tBOP ELEVATION',
  'PS-27161\t/PS-27161.1, /PS-27161.4, /PS-27161.2, /PS-27161.3\tREST-300, SHOE-300, GUIDE-300, LINE-STOP-300\t=67127059/23522, =67127059/78566, =67127059/82402, =67127059/78567\t82725\t669250\t100700',
  'PS-27160A\t/PS-27160A.1\tREST-50\t=67135251/10015\t83075\t669659\t101300',
].join('\n');
const source1t = parseTableSource(table1, { sourceId: 'TE' });
const roles1t = suggestRoles(source1t);
assert.strictEqual(roles1t.PIPING_PRIMARY_SUPPORT, 'child-list', 'child support list detected');
assert.strictEqual(roles1t.PIPING_PRIMARY_SUPPORT_REFERENCE, 'child-ref', 'child reference list detected');
assert.strictEqual(roles1t.SUPPORT_TYPE, 'support-types');
assert.strictEqual(roles1t.PSNO_PIPE, 'node-id');
let mappingExp = createNodeSetMapping(source1t, roles1t);
mappingExp.grain = 'exploded';
assert.deepStrictEqual(validateMapping(mappingExp), [], 'exploded mapping valid');
const modelExp = buildNodeSetModel(source1t, mappingExp, [], 'exploded');
assert.strictEqual(modelExp.nodes.length, 5, `2 rows explode to 5 support points (got ${modelExp.nodes.length})`);
const child3 = modelExp.nodes.find((n) => n.id === 'PS-27161.3');
assert.ok(child3, 'child id used as node id (leading / stripped)');
assert.strictEqual(child3.supports[0].kind, 'LINE-STOP', 'type zipped by index');
assert.ok(child3.props.some((p) => p.name === 'PARENT' && p.value === 'PS-27161'), 'parent kept as prop');
assert.ok(child3.props.some((p) => p.name === 'REF' && p.value === '=67127059/78567'), 'reference zipped by index');
assert.strictEqual(new Set(modelExp.nodes.filter((n) => n.props.some((p) => p.value === 'PS-27161')).map((n) => `${n.e}|${n.n}|${n.u}`)).size, 1, 'siblings share the row coordinate');
// row grain on same table: 2 nodes with multi-support lists
const modelRow = buildNodeSetModel(source1t, { ...mappingExp, grain: 'row' }, [], 'row');
assert.strictEqual(modelRow.nodes.length, 2);
assert.strictEqual(modelRow.nodes[0].supports.length, 4, 'row grain keeps full support list');

// normalizer edge cases
assert.strictEqual(normalizeTableText('a\t"x""y"\tb'), 'a\tx"y\tb', 'escaped quotes unescaped');
assert.strictEqual(dropEmptyColumns('A\tB\t\t\n1\t2\t\t'), 'A\tB\n1\t2', 'empty trailing columns dropped');

// ── NodeSet XML → graph → compare roundtrip ──────────────────────────────
const parsed = parseNodeSetRecords(xml1);
assert.strictEqual(parsed.records.length, 3, 'serialize→parse roundtrip');
const graphA = buildNodeSetGraph('source', xml1);
const graphB = buildNodeSetGraph('target', xml2);
assert.deepStrictEqual(validateCanonicalObjectGraph(graphA), [], 'nodeset graph passes contract');
assert.strictEqual(graphA.graphKind, 'nodeset');
assert.strictEqual(graphA.objects.length, 3);
assert.ok(graphA.objects.every((o) => o.lengthMm === 0 && o.fromNode === o.toNode));

const visual = buildVisualModel(graphA, {});
assert.strictEqual(visual.segments.length, 0, 'no segments for point model');
assert.strictEqual(visual.markers.filter((m) => m.isObjectMarker).length, 3, 'object markers for all nodes');

// different coordinates → nothing should silently auto-match at HIGH
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 500 });
assert.strictEqual(audit.summary.sourceCanonicalElements, 3);
assert.strictEqual(audit.summary.targetCanonicalElements, 3);
const seenSource = audit.objectDiff.rows.filter((r) => r.sourceObjectId).length;
const seenTarget = audit.objectDiff.rows.filter((r) => r.targetObjectId).length;
assert.strictEqual(seenSource, 3, 'every source node accounted');
assert.strictEqual(seenTarget, 3, 'every target node accounted');

console.log('workbench3d-tablexml.test.js passed');
console.log(`  format1 nodes=${model1.nodes.length} grouped=1 format2 nodes=${model2.nodes.length} xml1=${xml1.length}B`);

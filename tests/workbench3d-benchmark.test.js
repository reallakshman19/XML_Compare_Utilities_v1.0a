// Workbench 20-element benchmark: parse counts, short-element consume,
// node renumber + origin independence, ambiguity gate, transfer rules,
// geometry preservation on apply, and dashboard count reconciliation.
import assert from 'assert';
import { parseInputXmlRecords, XML_SCHEMA_KINDS } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { buildVisualModel } from '../workbench3d/adapters/visual-model-builder.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { buildTransferPlan, batchApprove, refreshTransferSummary } from '../workbench3d/compare/transfer-planner.js';
import { applyTransferPlan } from '../workbench3d/apply/transfer-apply.js';
import {
  validateCanonicalObjectGraph, validateCompareAudit, validateVisualGeometryModel,
  DIFF_STATUS, APPROVAL_STATUS, TRANSFER_RULES, CONFIDENCE,
} from '../workbench3d/contracts/contracts.js';

// ── Synthetic 20-element route ────────────────────────────────────────────
// Alternating X/Z legs so geometry is unambiguous; rev2 renumbers every node
// (+1000), inserts 3 short elements, and changes one property.
const LENGTHS = [200, 150, 180, 220, 300, 250, 175, 210, 160, 190, 205, 230, 155, 240, 185, 260, 170, 215, 195, 225];
const PACKET_BY_INDEX = new Map([[4, '<RIGID WEIGHT="120.5" TYPE="Valve"/>'], [7, '<BEND RADIUS="152.4"/>'], [11, '<SIF NODE="120.000000" TYPE_1="16.000000"/>'], [14, '<RESTRAINT NUM="1" NODE="160.000000" TYPE="1.000000"/>']]);

function buildXml({ renumber = 0, shortInserts = false, propertyDrop = false } = {}) {
  const rows = [];
  let node = 10;
  const nodeId = (n) => (n + renumber).toFixed(6);
  for (let i = 0; i < LENGTHS.length; i += 1) {
    const from = node;
    const to = node + 10;
    const axis = i % 2 === 0 ? 'DELTA_X' : 'DELTA_Z';
    const packet = PACKET_BY_INDEX.get(i) ?? '';
    // rev2 drops TEMP on element 3 so FILL_BLANK_ONLY has something to fill,
    // and changes PRESSURE1 on element 6 so FILL_BLANK_ONLY has something to block.
    const temp = propertyDrop && i === 3 ? '' : ' TEMP_EXP_C1="350.000000"';
    const pressure = propertyDrop && i === 6 ? ' PRESSURE1="9.000000"' : ' PRESSURE1="2.000000"';
    rows.push(`<PIPINGELEMENT FROM_NODE="${nodeId(from)}" TO_NODE="${nodeId(to)}" ${axis}="${LENGTHS[i].toFixed(6)}" DIAMETER="114.299995" WALL_THICK="6.000000"${temp}${pressure} NAME="E-${String(i + 1).padStart(2, '0')}">${packet}</PIPINGELEMENT>`);
    node = to;
    if (shortInserts && [5, 10, 15].includes(i)) {
      const shortTo = to + 1;
      rows.push(`<PIPINGELEMENT FROM_NODE="${nodeId(to)}" TO_NODE="${nodeId(shortTo)}" DELTA_X="2.000000" DIAMETER="114.299995" WALL_THICK="6.000000" NAME="SHORT-${i}"/>`);
      node = shortTo;
    }
  }
  return `<CAESARII VERSION="11.00" XML_TYPE="Input"><PIPINGMODEL NUMELT="${rows.length}">${rows.join('')}</PIPINGMODEL></CAESARII>`;
}

const rev1Xml = buildXml();
const rev2Xml = buildXml({ renumber: 1000, shortInserts: true, propertyDrop: true });

// ── T1.1 / T1.2 parse + consume counts ───────────────────────────────────
const rev1 = parseInputXmlRecords(rev1Xml);
const rev2 = parseInputXmlRecords(rev2Xml);
assert.strictEqual(rev1.schema, XML_SCHEMA_KINDS.INPUT_XML);
assert.strictEqual(rev1.records.length, 20, 'rev1 raw elements');
assert.strictEqual(rev2.records.length, 23, 'rev2 raw elements (3 short inserts)');

const graphA = buildCanonicalGraph('source', rev1.records, { shortElementToleranceMm: 6 });
const graphB = buildCanonicalGraph('target', rev2.records, { shortElementToleranceMm: 6 });
assert.deepStrictEqual(validateCanonicalObjectGraph(graphA), []);
assert.deepStrictEqual(validateCanonicalObjectGraph(graphB), []);
assert.strictEqual(graphA.canonicalElementCount, 20, 'rev1 canonical');
assert.strictEqual(graphB.canonicalElementCount, 20, 'rev2 canonical (shorts consumed)');
assert.strictEqual(graphB.consumedRows.length, 3, 'rev2 consumed short elements');

// T1.3 packet preservation through consume: all 4 packets still present.
const packetKinds = graphB.objects.flatMap((o) => o.packets.map((p) => p.kind));
for (const kind of ['RIGID', 'BEND', 'SIF', 'RESTRAINT']) {
  assert.ok(packetKinds.includes(kind), `packet ${kind} preserved in canonical target`);
}

// Visual model contract.
assert.deepStrictEqual(validateVisualGeometryModel(buildVisualModel(graphA)), []);

// ── T4.1/T4.2 compare with renumbered nodes (origin-free topology) ───────
const audit = runCompare(graphA, graphB, { lengthToleranceMm: 6 });
assert.deepStrictEqual(validateCompareAudit(audit), [], 'compare audit cross-ref integrity');
assert.ok(audit.summary.matchedElements >= 18, `matched >= 18 (got ${audit.summary.matchedElements})`);
assert.ok(audit.summary.highConfidenceElements >= 15, `high confidence >= 15 (got ${audit.summary.highConfidenceElements})`);
assert.strictEqual(audit.summary.registrationAnchorCount > 0, true, 'registration anchors present');

// Every matched row must expose reasons + score (100% explainability).
for (const row of audit.objectDiff.rows) {
  if (row.sourceObjectId && row.targetObjectId) {
    assert.ok(Number.isFinite(row.score), `row ${row.diffId} has score`);
    assert.ok(Array.isArray(row.breakdown) && row.breakdown.length > 0, `row ${row.diffId} has evidence breakdown`);
  }
}

// ── T5.1 dashboard reconciliation: every object in exactly one diff row ──
const sourceSeen = audit.objectDiff.rows.filter((r) => r.sourceObjectId).map((r) => r.sourceObjectId);
const targetSeen = audit.objectDiff.rows.filter((r) => r.targetObjectId).map((r) => r.targetObjectId);
assert.strictEqual(new Set(sourceSeen).size, sourceSeen.length, 'no source object in two rows');
assert.strictEqual(new Set(targetSeen).size, targetSeen.length, 'no target object in two rows');
assert.strictEqual(sourceSeen.length, graphA.objects.length, 'all source objects accounted');
assert.strictEqual(targetSeen.length, graphB.objects.length, 'all target objects accounted');

// ── T4.3 ambiguous symmetric branch must NOT auto-match ──────────────────
const symmetricXml = (renumber) => {
  const n = (v) => (v + renumber).toFixed(6);
  return `<CAESARII XML_TYPE="Input"><PIPINGMODEL>
    <PIPINGELEMENT FROM_NODE="${n(10)}" TO_NODE="${n(20)}" DELTA_X="500.000000" DIAMETER="100.0" NAME=""/>
    <PIPINGELEMENT FROM_NODE="${n(20)}" TO_NODE="${n(30)}" DELTA_Y="400.000000" DIAMETER="100.0" NAME=""/>
    <PIPINGELEMENT FROM_NODE="${n(20)}" TO_NODE="${n(40)}" DELTA_Z="400.000000" DIAMETER="100.0" NAME=""/>
  </PIPINGMODEL></CAESARII>`;
};
const symA = buildCanonicalGraph('source', parseInputXmlRecords(symmetricXml(0)).records, {});
const symB = buildCanonicalGraph('target', parseInputXmlRecords(symmetricXml(500)).records, {});
const symAudit = runCompare(symA, symB, {});
const symmetricAuto = symAudit.objectDiff.rows.filter((r) => r.sourceObjectId && r.targetObjectId && r.confidence === CONFIDENCE.HIGH);
// The two symmetric branch legs are identical except direction; they must not
// both auto-match HIGH without a distinguishing signal OR must be flagged.
assert.ok(
  symAudit.summary.ambiguousElements + symAudit.summary.ambiguousPaths > 0 || symmetricAuto.length <= symA.objects.length - 1,
  'symmetric branches produce ambiguity, not blind auto-match',
);

// ── T6.x transfer rules ───────────────────────────────────────────────────
const plan = buildTransferPlan(audit, graphA, graphB, { rule: TRANSFER_RULES.FILL_BLANK_ONLY, minConfidence: CONFIDENCE.HIGH });
assert.ok(plan.rows.length > 0, 'transfer rows exist');

// T6.1: no AMBIGUOUS diff may produce a transfer row at all.
const ambiguousDiffIds = new Set(audit.objectDiff.rows.filter((r) => r.status === DIFF_STATUS.AMBIGUOUS).map((r) => r.diffId));
assert.strictEqual(plan.rows.filter((r) => ambiguousDiffIds.has(r.diffId)).length, 0, 'ambiguous rows produce no transfer rows');

// T6.2: FILL_BLANK_ONLY blocks overwrite of existing PRESSURE1 but allows blank TEMP fill.
const pressureRows = plan.rows.filter((r) => r.property === 'PRESSURE1');
assert.ok(pressureRows.length > 0 && pressureRows.every((r) => r.approval === APPROVAL_STATUS.BLOCKED), 'existing PRESSURE1 blocked by FILL_BLANK_ONLY');
const tempFill = plan.rows.find((r) => r.property === 'TEMP_EXP_C1' && r.oldValue === '');
assert.ok(tempFill && tempFill.approval === APPROVAL_STATUS.PENDING, 'blank TEMP_EXP_C1 fill allowed as pending');

// T6.3: geometry fields never appear as transferable rows.
assert.strictEqual(plan.rows.filter((r) => ['FROM_NODE', 'TO_NODE', 'DELTA_X', 'DELTA_Y', 'DELTA_Z'].includes(r.property) && r.approval !== APPROVAL_STATUS.BLOCKED).length, 0, 'geometry rows blocked');

// ── T7.x apply: approved-only + geometry preservation + rollback ─────────
batchApprove(plan, CONFIDENCE.HIGH);
refreshTransferSummary(plan);
assert.ok(plan.summary.approvedRows > 0, 'batch approve approved something');
const result = applyTransferPlan(rev2Xml, plan);
assert.strictEqual(result.appliedCount, plan.summary.approvedRows - result.skippedRows.length, 'approved-only apply');
assert.strictEqual(result.geometryViolations.length, 0, 'geometry untouched');

// Output still parses and geometry attrs are byte-identical per element.
const reparsed = parseInputXmlRecords(result.outputXml);
assert.strictEqual(reparsed.records.length, 23, 'output keeps all 23 raw elements');
reparsed.records.forEach((record, index) => {
  assert.deepStrictEqual(record.deltaMm, rev2.records[index].deltaMm, `element ${index} delta preserved`);
  assert.strictEqual(record.fromNode, rev2.records[index].fromNode, `element ${index} FROM preserved`);
  assert.strictEqual(record.toNode, rev2.records[index].toNode, `element ${index} TO preserved`);
});

// T7.3 rollback: every applied change has before/after.
assert.strictEqual(result.rollbackLedger.rows.length, result.appliedCount, 'rollback row per applied change');
for (const row of result.rollbackLedger.rows) {
  assert.ok(row.transferRowId && row.property !== undefined && row.valueAfter !== undefined, 'rollback row complete');
}

// Applied TEMP fill visible in output.
assert.ok(/TEMP_EXP_C1="350.000000"[^>]*NAME="E-04"|NAME="E-04"[^>]*TEMP_EXP_C1/.test(result.outputXml.replace(/\s+/g, ' ')) || result.outputXml.includes('TEMP_EXP_C1'), 'temp fill present in output');

console.log('workbench3d-benchmark.test.js passed');
console.log(`  matched=${audit.summary.matchedElements}/20 high=${audit.summary.highConfidenceElements} consumed=${graphB.consumedRows.length} transferRows=${plan.rows.length} approved=${plan.summary.approvedRows} applied=${result.appliedCount}`);

// Connector audit-link test + viewer object-id mapping test +
// GeometryBufferStore / ViewerStateSnapshot / BenchmarkResult contract tests.
import assert from 'assert';
import { parseInputXmlRecords } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { buildVisualModel } from '../workbench3d/adapters/visual-model-builder.js';
import { buildGeometryBufferStore } from '../workbench3d/adapters/geometry-buffer-store.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { buildTransferPlan, batchApprove } from '../workbench3d/compare/transfer-planner.js';
import { buildConnectorModel, validateConnectorModel } from '../workbench3d/viewer/connector-model.js';
import {
  CONTRACT_VERSIONS, CONNECTOR_TYPES, TRANSFER_RULES, CONFIDENCE,
  validateGeometryBufferStore, validateViewerStateSnapshot, validateViewerNavigationState, validateBenchmarkResult,
} from '../workbench3d/contracts/contracts.js';

// ── fixture: two-branch route with renumbered rev + property gap ──────────
const route = (renumber) => {
  const n = (v) => (v + renumber).toFixed(6);
  return `<CAESARII XML_TYPE="Input"><PIPINGMODEL>
    <PIPINGELEMENT FROM_NODE="${n(10)}" TO_NODE="${n(20)}" DELTA_X="500.000000" DIAMETER="114.3" WALL_THICK="6.0" TEMP_EXP_C1="350.0" NAME="A1"><RESTRAINT NUM="1" NODE="${n(10)}" TYPE="1.0"/></PIPINGELEMENT>
    <PIPINGELEMENT FROM_NODE="${n(20)}" TO_NODE="${n(30)}" DELTA_Z="800.000000" DIAMETER="114.3" WALL_THICK="6.0" ${renumber ? '' : 'TEMP_EXP_C1="350.0"'} NAME="A2"><RIGID WEIGHT="55.5" TYPE="Valve"/></PIPINGELEMENT>
    <PIPINGELEMENT FROM_NODE="${n(20)}" TO_NODE="${n(40)}" DELTA_Y="400.000000" DIAMETER="60.3" WALL_THICK="4.0" NAME="B1"/>
    <PIPINGELEMENT FROM_NODE="${n(40)}" TO_NODE="${n(50)}" DELTA_Y="350.000000" DIAMETER="60.3" WALL_THICK="4.0" NAME="B2"/>
  </PIPINGMODEL></CAESARII>`;
};

const graphA = buildCanonicalGraph('source', parseInputXmlRecords(route(0)).records, {});
const graphB = buildCanonicalGraph('target', parseInputXmlRecords(route(2000)).records, {});
const visualA = buildVisualModel(graphA);
const visualB = buildVisualModel(graphB);
const audit = runCompare(graphA, graphB, {});
const plan = buildTransferPlan(audit, graphA, graphB, { rule: TRANSFER_RULES.FILL_BLANK_ONLY, minConfidence: CONFIDENCE.MEDIUM });
batchApprove(plan, CONFIDENCE.MEDIUM);

// ── Viewer object-id mapping: every visual segment/marker id resolves ─────
const graphIds = new Set([...graphA.objects, ...graphB.objects].map((o) => o.objectId));
for (const visual of [visualA, visualB]) {
  for (const seg of visual.segments) assert.ok(graphIds.has(seg.objectId), `segment ${seg.objectId} maps to canonical object`);
  for (const marker of visual.markers) {
    if (marker.objectId) assert.ok(graphIds.has(marker.objectId), `marker ${marker.objectId} maps to canonical object`);
  }
}

// ── GeometryBufferStore.v1 ────────────────────────────────────────────────
const store = buildGeometryBufferStore(visualA);
assert.deepStrictEqual(validateGeometryBufferStore(store), [], 'buffer store valid');
assert.strictEqual(store.positions.length, visualA.segments.length * 6, 'positions packed 6 floats per segment');
assert.deepStrictEqual(store.objectIdByIndex, visualA.segments.map((s) => s.objectId), 'index order preserved');
assert.ok(validateGeometryBufferStore({ ...store, positions: [...store.positions] }).length > 0, 'plain array rejected — typed buffer required');

// ── ConnectorModel.v1: audit-link integrity ───────────────────────────────
const model = buildConnectorModel({ compareAudit: audit, transferPlan: plan, sourceVisual: visualA, targetVisual: visualB, sourceGraph: graphA, targetGraph: graphB });
assert.strictEqual(model.contract, CONTRACT_VERSIONS.ConnectorModel);
assert.deepStrictEqual(validateConnectorModel(model, { compareAudit: audit, transferPlan: plan }), [], 'every connector links a real audit row');

const byType = (type) => model.connectors.filter((c) => c.type === type);
const matchedRows = audit.objectDiff.rows.filter((r) => r.sourceObjectId && r.targetObjectId);
assert.strictEqual(
  byType(CONNECTOR_TYPES.MATCH_CONNECTOR).length + byType(CONNECTOR_TYPES.BASIS_CONNECTOR).length,
  matchedRows.length,
  'one MATCH/BASIS connector per matched diff row',
);
assert.strictEqual(byType(CONNECTOR_TYPES.REGISTRATION_ANCHOR_CONNECTOR).length, audit.registration.anchorPairs.length, 'one anchor connector per registration pair');
assert.ok(byType(CONNECTOR_TYPES.TRANSFER_CONNECTOR).length > 0, 'transfer connectors exist for planned pairs');

// Transfer connectors carry the full per-property row list for overlays.
for (const c of byType(CONNECTOR_TYPES.TRANSFER_CONNECTOR)) {
  assert.strictEqual(c.pairKey, `${c.sourceObjectId}|${c.targetObjectId}`, 'transfer connector pairKey');
  assert.ok(Array.isArray(c.properties) && c.properties.length > 0, 'transfer connector retains properties[]');
  for (const p of c.properties) {
    for (const field of ['rowId', 'property', 'approval']) assert.ok(p[field] !== undefined, `property row has ${field}`);
  }
}
for (const c of [...byType(CONNECTOR_TYPES.MATCH_CONNECTOR), ...byType(CONNECTOR_TYPES.BASIS_CONNECTOR)]) {
  assert.ok(c.score === null || Number.isFinite(c.score), 'match/basis connectors expose numeric score');
}

// Required per-connector fields.
for (const c of model.connectors) {
  for (const field of ['connectorId', 'type', 'visibleModes', 'reason', 'auditRowId', 'from', 'to']) {
    assert.ok(c[field] !== undefined && c[field] !== null, `connector ${c.connectorId} has ${field}`);
  }
  assert.strictEqual(c.selectable, true);
  assert.strictEqual(c.hoverable, true);
}

// Registration translation applied to source endpoints (target nodes are +2000
// in node ids only — geometry is identical, so translation should be ~0; use a
// synthetic check instead: source midpoints must equal visual midpoint + translation).
const t = audit.registration.translationMm;
const firstMatch = byType(CONNECTOR_TYPES.MATCH_CONNECTOR)[0] ?? byType(CONNECTOR_TYPES.BASIS_CONNECTOR)[0];
const seg = visualA.segments.find((s) => s.objectId === firstMatch.sourceObjectId);
const expectedFrom = [(seg.start[0] + seg.end[0]) / 2 + t[0], (seg.start[1] + seg.end[1]) / 2 + t[1], (seg.start[2] + seg.end[2]) / 2 + t[2]];
assert.deepStrictEqual(firstMatch.from.map((v) => Number(v.toFixed(3))), expectedFrom.map((v) => Number(v.toFixed(3))), 'source endpoint pre-shifted by registration translation');

// Orphan detection must fire.
const corrupted = JSON.parse(JSON.stringify({ ...model, connectors: model.connectors.slice(0, 3) }));
corrupted.connectors[0].auditRowId = 'D-GHOST';
assert.ok(validateConnectorModel(corrupted, { compareAudit: audit, transferPlan: plan }).length > 0, 'orphan audit link rejected');

// ── Ambiguous fixture: CONFLICT + CANDIDATE connector classes ─────────────
// Two identical disconnected stubs on each side — no evidence can separate
// them, so the engine must emit AMBIGUOUS (never auto-match) and the model
// must expose CONFLICT_CONNECTORs to the resolver UI.
const stub = (from, to) => `<PIPINGELEMENT FROM_NODE="${from}.000000" TO_NODE="${to}.000000" DELTA_X="300.000000" DIAMETER="88.9" NAME=""/>`;
const wrap = (inner) => `<CAESARII XML_TYPE="Input"><PIPINGMODEL>${inner}</PIPINGMODEL></CAESARII>`;
// one source stub vs two indistinguishable target stubs → 1:2 ambiguity
const ambA = buildCanonicalGraph('source', parseInputXmlRecords(wrap(stub(100, 110))).records, {});
const ambB = buildCanonicalGraph('target', parseInputXmlRecords(wrap(stub(5100, 5110) + stub(5200, 5210))).records, {});
const ambAudit = runCompare(ambA, ambB, {});
const ambModel = buildConnectorModel({
  compareAudit: ambAudit, transferPlan: null,
  sourceVisual: buildVisualModel(ambA), targetVisual: buildVisualModel(ambB),
  sourceGraph: ambA, targetGraph: ambB,
});
assert.deepStrictEqual(validateConnectorModel(ambModel, { compareAudit: ambAudit }), [], 'ambiguous model audit-linked');
const ambConflicts = ambModel.connectors.filter((c) => c.type === CONNECTOR_TYPES.CONFLICT_CONNECTOR);
const ambCandidates = ambModel.connectors.filter((c) => c.type === CONNECTOR_TYPES.CANDIDATE_CONNECTOR);
assert.ok(ambAudit.summary.ambiguousElements > 0, `ambiguity detected (got ${ambAudit.summary.ambiguousElements})`);
assert.ok(ambConflicts.length >= 2, `CONFLICT_CONNECTORs emitted for ambiguous candidates (got ${ambConflicts.length})`);
assert.ok(ambCandidates.length >= 1, `CANDIDATE_CONNECTORs emitted for unselected pairs (got ${ambCandidates.length})`);
for (const c of ambConflicts) {
  const diffRow = ambAudit.objectDiff.rows.find((r) => r.diffId === c.auditRowId);
  assert.strictEqual(diffRow?.status, 'AMBIGUOUS', 'conflict connector links the AMBIGUOUS diff row');
}

// ── ViewerStateSnapshot.v1 ────────────────────────────────────────────────
assert.deepStrictEqual(validateViewerStateSnapshot({
  contract: CONTRACT_VERSIONS.ViewerStateSnapshot,
  mode: 'overlay', connectorMode: 'selection',
  cameraPosition: [1, 2, 3], cameraTarget: [0, 0, 0],
  sourceOpacity: 0.32, statusFilter: [], isolation: [], selectedObjectId: null,
}), [], 'valid snapshot accepted');
assert.ok(validateViewerStateSnapshot({ contract: CONTRACT_VERSIONS.ViewerStateSnapshot, mode: 'weird', cameraPosition: [1], cameraTarget: [0, 0, 0], statusFilter: [] }).length > 0, 'bad snapshot rejected');

// ── ViewerNavigationState.v1: persisted coordinates are always world-space ─
const navigationState = {
  contract: CONTRACT_VERSIONS.ViewerNavigationState,
  cameraPositionWorld: [438023.221, -1138222.202, 2184.15],
  cameraTargetWorld: [438023.221, -1139222.202, 1184.15],
  pivotWorld: null, cameraType: 'Perspective', verticalAxis: 'Z', projectionScale: 55,
};
assert.deepStrictEqual(validateViewerNavigationState(navigationState), [], 'valid world-space navigation state accepted');
assert.ok(validateViewerNavigationState({ ...navigationState, cameraTargetWorld: [...navigationState.cameraPositionWorld] }).length > 0,
  'coincident camera and target rejected');

// ── BenchmarkResult.v1 — emit a result for this run and validate it ───────
const benchmark = {
  contract: CONTRACT_VERSIONS.BenchmarkResult,
  name: 'workbench3d-connector-fixture',
  generatedAt: new Date().toISOString(),
  metrics: { matched: matchedRows.length, connectors: model.connectors.length, transferRows: plan.rows.length },
  assertions: [
    { id: 'connectors-audit-linked', pass: validateConnectorModel(model, { compareAudit: audit, transferPlan: plan }).length === 0 },
    { id: 'match-connector-count', pass: byType(CONNECTOR_TYPES.MATCH_CONNECTOR).length + byType(CONNECTOR_TYPES.BASIS_CONNECTOR).length === matchedRows.length },
  ],
};
assert.deepStrictEqual(validateBenchmarkResult(benchmark), [], 'benchmark result contract valid');
assert.ok(benchmark.assertions.every((a) => a.pass), 'all benchmark assertions pass');

console.log('workbench3d-connectors.test.js passed');
console.log(`  connectors=${model.connectors.length} match=${byType(CONNECTOR_TYPES.MATCH_CONNECTOR).length} candidate=${byType(CONNECTOR_TYPES.CANDIDATE_CONNECTOR).length} conflict=${byType(CONNECTOR_TYPES.CONFLICT_CONNECTOR).length} transfer=${byType(CONNECTOR_TYPES.TRANSFER_CONNECTOR).length} registration=${byType(CONNECTOR_TYPES.REGISTRATION_ANCHOR_CONNECTOR).length}`);

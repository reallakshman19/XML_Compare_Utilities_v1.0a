import assert from 'node:assert/strict';
import test from 'node:test';
import { collectSupportCarrierTopologyCatalog } from '../tabs/support-steel-relationship-builder/support-carrier-topology-catalog.js';
import { buildSupportCarrierTopologyBundle } from '../tabs/support-steel-relationship-builder/support-carrier-topology-engine.js';

function component(type, name, attributes = {}) {
  return { type, attributes: { NAME: name, ...attributes } };
}
function build(objects, config = {}) {
  const catalog = collectSupportCarrierTopologyCatalog({ objects });
  return { catalog, topology: buildSupportCarrierTopologyBundle({ catalog, config }) };
}

test('straight pipe, elbow and pipe form one exact topology path', () => {
  const { catalog, topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0', BORE: 100 }),
    component('ELBOW', '/E1', { APOS: '100 0 0', LPOS: '100 100 0', BORE: 100 }),
    component('PIPE', '/P2', { AXIS_START: '100 100 0', AXIS_END: '200 100 0', BORE: 100 }),
  ]);
  assert.equal(catalog.schema, 'SupportCarrierTopologyCatalog.v1');
  assert.equal(catalog.components.length, 3);
  assert.equal(topology.schema, 'SupportCarrierTopologyBundle.v1');
  assert.equal(topology.summary.exactConnectionCount, 2);
  assert.equal(topology.topologyPaths.length, 1);
  assert.equal(topology.topologyPaths[0].pathStatus, 'CONNECTED');
});

test('missing bore remains unknown and does not become a false zero-bore mismatch', () => {
  const { catalog, topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0', OUTSIDE_DIAMETER: 100 }),
    component('ELBOW', '/E1', { APOS: '100 0 0', LPOS: '100 100 0', BORE: 100 }),
  ]);
  assert.equal(catalog.components[0].ports[0].boreMm, null);
  assert.equal(topology.summary.exactConnectionCount, 1);
});

test('reducer permits a bore transition without weakening other bore checks', () => {
  const { topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0', BORE: 100 }),
    component('REDUCER', '/R1', { APOS: '100 0 0', LPOS: '120 0 0', BORE: 75 }),
    component('PIPE', '/P2', { AXIS_START: '120 0 0', AXIS_END: '220 0 0', BORE: 50 }),
  ]);
  assert.equal(topology.summary.exactConnectionCount, 2);
  assert.equal(topology.topologyPaths[0].componentIds.length, 3);
});

test('tee preserves run-in, run-out and branch-out ports', () => {
  const { catalog, topology } = build([
    component('PIPE', '/RUN-A', { AXIS_START: '0 0 0', AXIS_END: '100 0 0' }),
    component('TEE', '/TEE-1', { APOS: '100 0 0', LPOS: '200 0 0', BPOS: '150 50 0' }),
    component('PIPE', '/RUN-B', { AXIS_START: '200 0 0', AXIS_END: '300 0 0' }),
    component('PIPE', '/BRANCH', { AXIS_START: '150 50 0', AXIS_END: '150 150 0' }),
  ]);
  const tee = catalog.components.find((row) => row.componentId === '/TEE-1');
  assert.deepEqual(tee.ports.map((row) => row.role).sort(), ['BRANCH_OUT', 'RUN_IN', 'RUN_OUT']);
  assert.equal(topology.summary.exactConnectionCount, 3);
  assert.ok(topology.connectionEdges.some((row) => row.fromPortRole === 'BRANCH_OUT' || row.toPortRole === 'BRANCH_OUT'));
});

test('olet host ownership stays separate from branch continuity', () => {
  const { topology } = build([
    component('PIPE', '/HOST', { AXIS_START: '0 0 0', AXIS_END: '200 0 0' }),
    component('OLET', '/OLET-1', { POS: '100 0 0', BPOS: '100 50 0', HOST_REF: '/HOST' }),
    component('PIPE', '/OLET-BRANCH', { AXIS_START: '100 50 0', AXIS_END: '100 150 0' }),
  ]);
  const attachment = topology.connectionEdges.find((row) => row.edgeType === 'CARRIER_COMPONENT_ATTACHMENT');
  assert.ok(attachment);
  assert.equal(attachment.relationshipStatus, 'EXPLICIT_REFERENCE_CONNECTION');
  assert.equal(attachment.toComponentId, '/HOST');
  assert.ok(topology.connectionEdges.some((row) => row.edgeType === 'CARRIER_COMPONENT_CONNECTION' && (row.fromPortRole === 'BRANCH_OUT' || row.toPortRole === 'BRANCH_OUT')));
});

test('multiple exact candidates fail closed instead of selecting by order', () => {
  const { topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0' }),
    component('PIPE', '/P2', { AXIS_START: '100 0 0', AXIS_END: '200 0 0' }),
    component('PIPE', '/P3', { AXIS_START: '100 0 0', AXIS_END: '100 100 0' }),
  ]);
  assert.ok(topology.topologyExceptions.some((row) => row.exceptionCode === 'AMBIGUOUS_EXACT_CARRIER_CONNECTION'));
  assert.ok(!topology.connectionEdges.some((row) => row.fromPortId === '/P1::OUTLET' || row.toPortId === '/P1::OUTLET'));
});

test('a unique source-adjacent small gap is repaired and audited', () => {
  const { topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0' }),
    component('PIPE', '/P2', { AXIS_START: '110 0 0', AXIS_END: '210 0 0' }),
  ]);
  assert.equal(topology.summary.smallGapRepairCount, 1);
  assert.equal(topology.connectionEdges[0].gapMm, 10);
  assert.equal(topology.connectionEdges[0].relationshipStatus, 'SMALL_GAP_CARRIER_REPAIR');
});

test('gaps above tolerance remain disconnected', () => {
  const { topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0' }),
    component('PIPE', '/P2', { AXIS_START: '130 0 0', AXIS_END: '230 0 0' }),
  ]);
  assert.equal(topology.connectionEdges.length, 0);
  assert.equal(topology.summary.disconnectedComponentCount, 2);
});

test('nearby components on different authoritative branches do not auto-connect', () => {
  const { topology } = build([
    { type: 'BRANCH', attributes: { NAME: '/LINE-A/B1' }, children: [component('PIPE', '/P-A', { AXIS_START: '0 0 0', AXIS_END: '100 0 0' })] },
    { type: 'BRANCH', attributes: { NAME: '/LINE-B/B1' }, children: [component('PIPE', '/P-B', { AXIS_START: '100 0 0', AXIS_END: '200 0 0' })] },
  ]);
  assert.equal(topology.connectionEdges.length, 0);
  assert.equal(topology.summary.disconnectedComponentCount, 2);
});

test('missing explicit reference targets remain visible', () => {
  const { topology } = build([
    component('PIPE', '/P1', { AXIS_START: '0 0 0', AXIS_END: '100 0 0', TREF: '/MISSING' }),
  ]);
  assert.ok(topology.topologyExceptions.some((row) => row.exceptionCode === 'MISSING_CARRIER_REFERENCE_TARGET'));
});

import assert from 'node:assert/strict';
import { buildCiiEngineeringDeltas } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

const sifCapability = Object.freeze({
  state: 'PARSED', qualification: 'PARTIAL', authority: 'tabs/cii-workspace/cii-workspace-auxiliary.js#SIF_TEE_POINTER', limitations: [],
});
function document(side) {
  return Object.freeze({ side, fileName: `${side}.CII`, contentSha256: side, nodeNames: {}, capabilities: { families: { sifTee: sifCapability } } });
}
function payload(slot2Node, unqualifiedRow6Field0 = 0) {
  const rows = Array.from({ length: 10 }, () => [0, 0, 0, 0, 0, 0]);
  rows[0] = [null, 3, 1.2, 1.3, 0, 0];
  rows[5] = [slot2Node, 4, 2.2, 2.3, 0, 0];
  rows[6][0] = unqualifiedRow6Field0;
  return rows;
}
function record(slot1Node, slot2Node, unqualifiedRow6Field0 = 0) {
  return Object.freeze({
    node: String(slot1Node), rawCode: 3,
    firstRowFields: Object.freeze([slot1Node, 3, 1.2, 1.3, 0, 0]),
    normalizedPayload: Object.freeze(payload(slot2Node, unqualifiedRow6Field0).map((row) => Object.freeze(row))),
  });
}
function edge(elementId, sifTeeEvidence) {
  return Object.freeze({
    elementId, dx: 100, dy: 0, dz: 0, lengthMm: 100, diameter: 60.3, wall: 3.9, P1: 10, T1: 100, T2: 0,
    sifTeeEvidence,
  });
}
const elementRow = Object.freeze({ correspondenceId: 'element:sif', kind: 'ELEMENT', sourceElementId: 'S-E', targetElementIds: ['T-E'], status: 'HIGH' });
function nodeRow(sourceNodeId, targetNodeId, suffix = '') {
  return Object.freeze({ correspondenceId: `node:${sourceNodeId}:${targetNodeId}${suffix}`, kind: 'NODE', sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId), status: 'HIGH' });
}
function normalizedDelta(sourceRecord, targetRecord, nodeRows) {
  const result = buildCiiEngineeringDeltas(
    document('SOURCE'), document('TARGET'),
    { nodes: [], edges: [edge('S-E', sourceRecord)] },
    { nodes: [], edges: [edge('T-E', targetRecord)] },
    { nodeRows, elementRows: [elementRow], componentRows: [] },
  );
  const delta = result.rows.find((row) => row.property === 'SIF/Tee normalized raw payload');
  assert(delta, 'SIF/Tee normalized payload delta must be emitted');
  return delta;
}

const source = record(70, 320);
const target = record(20070, 20320);
const accepted = normalizedDelta(source, target, [nodeRow(70, 20070), nodeRow(320, 20320)]);
assert.equal(accepted.changed, false, 'accepted correspondence renumbering in both qualified tee-slot Node fields must not create a payload delta');
assert.equal(accepted.sourceValue[0][0], null);
assert.equal(accepted.targetValue[0][0], null);
assert.equal(accepted.sourceValue[5][0], null);
assert.equal(accepted.targetValue[5][0], null);
assert.match(accepted.limitations[0], /row 0 field 0 and row 5 field 0/);

const wrongTarget = normalizedDelta(source, target, [nodeRow(70, 20070), nodeRow(320, 20321)]);
assert.equal(wrongTarget.changed, true, 'slot-2 node value must remain a delta when the exact embedded TARGET node is not the accepted counterpart');
assert.equal(wrongTarget.sourceValue[5][0], 320);
assert.equal(wrongTarget.targetValue[5][0], 20320);

const ambiguous = normalizedDelta(source, target, [nodeRow(70, 20070), nodeRow(320, 20320, ':a'), nodeRow(320, 20321, ':b')]);
assert.equal(ambiguous.changed, true, 'ambiguous SOURCE node custody must fail closed instead of canonicalizing by one of several claims');
assert.equal(ambiguous.sourceValue[5][0], 320);
assert.equal(ambiguous.targetValue[5][0], 20320);

const arbitraryNumeric = normalizedDelta(record(70, 320, 320), record(20070, 20320, 20320), [nodeRow(70, 20070), nodeRow(320, 20320)]);
assert.equal(arbitraryNumeric.changed, true, 'a matching node-number pattern in an unqualified SIF payload coordinate must remain an engineering delta');
assert.equal(arbitraryNumeric.sourceValue[6][0], 320);
assert.equal(arbitraryNumeric.targetValue[6][0], 20320);

const slot1Unbound = normalizedDelta(source, target, [nodeRow(320, 20320)]);
assert.equal(slot1Unbound.changed, true, 'legacy row-0 normalization must not hide an unbound slot-1 Node reference');
assert.equal(slot1Unbound.sourceValue[0][0], 70);
assert.equal(slot1Unbound.targetValue[0][0], 20070);

console.log('CII SIF/Tee qualified node-reference normalization checks passed.');

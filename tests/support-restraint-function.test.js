import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportRestraintFunctionBundle } from '../tabs/support-steel-relationship-builder/support-restraint-function-engine.js';

const horizontalCarrier = makeCarrier('/PIPE-1', { x: -100, y: 0, z: 0 }, { x: 100, y: 0, z: 0 });

test('rest function is confirmed below a horizontal carrier', () => {
  const family = makeFamily('/PS-REST', [
    makeMember('/PS-REST.1', 'PIPE_SHOE', { x: 0, y: 0, z: -20 }, { CMPSUPTYPE: 'REST' }),
  ]);
  const bundle = evaluate(family);
  assert.equal(functionStatus(bundle, 'REST'), 'FUNCTION_CONFIRMED');
  assert.ok(bundle.evidencedRestraints[0].evidencedDirections.includes('-VERTICAL'));
});

test('guide function distinguishes two-sided and one-sided evidence', () => {
  const complete = makeFamily('/PS-GUIDE-A', [
    makeMember('/PS-GUIDE-A.1', 'PIPE_SHOE', { x: 0, y: 0, z: -20 }, { CMPSUPTYPE: 'GUIDE' }),
    makeMember('/PS-GUIDE-A.2', 'GUIDE_MEMBER', { x: 0, y: 30, z: 0 }),
    makeMember('/PS-GUIDE-A.3', 'GUIDE_MEMBER', { x: 0, y: -30, z: 0 }),
  ]);
  assert.equal(functionStatus(evaluate(complete), 'GUIDE'), 'FUNCTION_CONFIRMED');

  const partial = makeFamily('/PS-GUIDE-B', [
    makeMember('/PS-GUIDE-B.1', 'PIPE_SHOE', { x: 0, y: 0, z: -20 }, { CMPSUPTYPE: 'GUIDE' }),
    makeMember('/PS-GUIDE-B.2', 'GUIDE_MEMBER', { x: 0, y: 30, z: 0 }),
  ]);
  const partialBundle = evaluate(partial);
  assert.equal(functionStatus(partialBundle, 'GUIDE'), 'FUNCTION_PARTIALLY_CONFIRMED');
  assert.ok(exceptionCodes(partialBundle).includes('GUIDE_ONLY_ONE_SIDE_PROVEN'));
});

test('line stop must align with the carrier axial direction', () => {
  const family = makeFamily('/PS-LS', [
    makeMember('/PS-LS.1', 'PIPE_SHOE', { x: 0, y: 0, z: -20 }, { CMPSUPTYPE: 'LINE STOP' }),
    makeMember('/PS-LS.2', 'LINE_STOP_MEMBER', { x: 0, y: 30, z: 0 }),
  ]);
  const bundle = evaluate(family);
  assert.equal(functionStatus(bundle, 'LINE_STOP'), 'FUNCTION_NOT_PROVEN');
  assert.ok(exceptionCodes(bundle).includes('LINE_STOP_DIRECTION_NOT_PROVEN'));
});

test('hold down requires physical geometry above the carrier', () => {
  const family = makeFamily('/PS-HD', [
    makeMember('/PS-HD.1', 'CLAMP_MEMBER', { x: 0, y: 0, z: 25 }, { CMPSUPTYPE: 'HOLD DOWN' }),
  ]);
  const bundle = evaluate(family);
  assert.equal(functionStatus(bundle, 'HOLD_DOWN'), 'FUNCTION_CONFIRMED');
  assert.ok(bundle.evidencedRestraints[0].evidencedDirections.includes('+VERTICAL'));
});

test('vertical carrier frame remains ambiguous for directional functions', () => {
  const verticalCarrier = makeCarrier('/PIPE-V', { x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: 100 });
  const family = makeFamily('/PS-V', [
    makeMember('/PS-V.1', 'GUIDE_MEMBER', { x: 30, y: 0, z: 0 }, { CMPSUPTYPE: 'GUIDE' }),
    makeMember('/PS-V.2', 'GUIDE_MEMBER', { x: -30, y: 0, z: 0 }),
  ]);
  const bundle = evaluate(family, verticalCarrier);
  assert.equal(functionStatus(bundle, 'GUIDE'), 'FUNCTION_AMBIGUOUS');
  assert.ok(exceptionCodes(bundle).includes('VERTICAL_PIPE_FRAME_AMBIGUOUS'));
});

test('point-only data cannot prove a restraint direction', () => {
  const family = makeFamily('/PS-POINT', [
    {
      memberId: '/PS-POINT.1', semanticRole: 'PIPE_SHOE', attributes: { CMPSUPTYPE: 'REST' },
      analyticalGeometry: { physicalGeometryAvailable: false, representativePointGlobal: { x: 0, y: 0, z: -20 } },
    },
  ]);
  const bundle = evaluate(family);
  assert.equal(functionStatus(bundle, 'REST'), 'FUNCTION_NOT_PROVEN');
  assert.ok(exceptionCodes(bundle).includes('REST_VERTICAL_CONTACT_NOT_PROVEN'));
});

function evaluate(family, carrier = horizontalCarrier) {
  const attachmentMember = family.members[0];
  const attachmentEdge = {
    edgeId: `ATTACH:${attachmentMember.memberId}`,
    supportFamilyId: family.familyId,
    supportMemberId: attachmentMember.memberId,
    supportMemberRole: attachmentMember.semanticRole,
    carrierObjectId: carrier.carrierObjectId,
  };
  return buildSupportRestraintFunctionBundle({
    supportFamilies: [family], carrierObjects: [carrier],
    carrierAttachment: { supportCarrierAttachmentEdges: [attachmentEdge] },
    carrierToStructurePath: { completePaths: [{
      pathId: `PATH:${family.familyId}`, supportFamilyId: family.familyId,
      carrierObjectId: carrier.carrierObjectId, carrierAttachmentEdgeId: attachmentEdge.edgeId,
    }] },
    supportMemberChain: { supportChainEdges: makeChain(family) },
    config: { restraintDirectionToleranceMm: 5 },
  });
}
function makeFamily(familyId, members) { return { familyId, members }; }
function makeMember(memberId, semanticRole, center, attributes = {}) {
  return {
    memberId, semanticRole, attributes,
    analyticalGeometry: {
      physicalGeometryAvailable: true,
      worldAabb: {
        min: { x: center.x - 2, y: center.y - 2, z: center.z - 2 },
        max: { x: center.x + 2, y: center.y + 2, z: center.z + 2 },
      },
    },
  };
}
function makeCarrier(carrierObjectId, start, end) {
  return { carrierObjectId, analyticalGeometry: { physicalCarrierGeometryAvailable: true, axis: { start, end } } };
}
function makeChain(family) {
  const first = family.members[0]?.memberId;
  return family.members.slice(1).map((row, index) => ({
    edgeId: `CHAIN:${index}`, supportFamilyId: family.familyId, supportA: first, supportB: row.memberId,
  }));
}
function functionStatus(bundle, name) {
  return bundle.functionAssessments.find((row) => row.supportFunction === name)?.functionStatus;
}
function exceptionCodes(bundle) { return bundle.functionExceptions.map((row) => row.exceptionCode); }

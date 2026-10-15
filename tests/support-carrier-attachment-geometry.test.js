import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js';

function steelSource() {
  return { objects: [] };
}

function branchWithPipe(pipeAttributes, supports) {
  return {
    objects: [{
      type: 'BRANCH',
      attributes: { NAME: '/LINE-400/B1' },
      children: [{
        type: 'PIPE',
        attributes: {
          NAME: '/PIPE-400',
          CARRIER_ID: '/PIPE-400',
          AXIS_START: 'E -100 N 0 U 0',
          AXIS_END: 'E 100 N 0 U 0',
          OD: 100,
          ...pipeAttributes,
        },
        children: supports,
      }],
    }],
  };
}

function support(id, bounds, extra = {}) {
  return {
    type: 'ATTA',
    attributes: {
      NAME: id,
      DTXR: 'PIPE SHOE',
      BOUNDS: bounds,
      ...extra,
    },
  };
}

function build(supportInput, config = {}) {
  return buildSupportSteelRelationshipBundle({
    supportInput,
    steelInput: steelSource(),
    config,
  });
}

test('creates analytical support-to-carrier contact candidates from OBB and pipe capsule', () => {
  const bundle = build(branchWithPipe({}, [
    support('/PS-940.1', [-10, 50, -10, 10, 60, 10]),
  ]));
  assert.equal(bundle.carrierGeometrySchema, 'SupportCarrierAnalyticalGeometry.v1');
  assert.equal(bundle.carrierAttachmentSchema, 'SupportCarrierAttachmentBundle.v1');
  assert.equal(bundle.summary.analyticalCarrierGeometryCount, 1);
  assert.equal(bundle.summary.carrierAttachmentCandidateCount, 1);
  const carrier = bundle.supportCarrierResolution.carrierObjects[0];
  assert.equal(carrier.analyticalGeometry.outsideRadiusMm, 50);
  assert.equal(carrier.analyticalGeometry.physicalCarrierGeometryAvailable, true);
  const edge = bundle.supportCarrierAttachment.supportCarrierAttachmentEdges[0];
  assert.equal(edge.supportMemberId, '/PS-940.1');
  assert.equal(edge.carrierObjectId, '/PIPE-400');
  assert.equal(edge.edgeType, 'SUPPORT_MEMBER_TO_CARRIER_ATTACHMENT');
  assert.equal(edge.contactEvidenceStatus, 'ANALYTICAL_CONTACT_CANDIDATE');
  assert.equal(edge.distanceMm, 0);
  assert.equal(edge.geometryMethod, 'WORLD_SUPPORT_OBB_TO_CARRIER_AXIS_ENVELOPE');
  assert.equal(edge.geometryQuality, 'HIGH');
  assert.ok(edge.contactPointGlobal);
  assert.ok(edge.nearestPointOnSupportGlobal);
  assert.ok(edge.nearestPointOnCarrierGlobal);
});

test('keeps carrier clearance candidates separate from resolved attachment edges', () => {
  const bundle = build(branchWithPipe({}, [
    support('/PS-941.1', [-10, 60, -10, 10, 70, 10]),
  ]), {
    carrierContactToleranceMm: 2,
    carrierCandidateToleranceMm: 25,
  });
  assert.equal(bundle.summary.carrierAttachmentCandidateCount, 0);
  assert.equal(bundle.summary.nearbyCarrierAttachmentCandidateCount, 1);
  const edge = bundle.supportCarrierAttachment.nearbyCarrierAttachmentCandidates[0];
  assert.equal(edge.edgeType, 'SUPPORT_MEMBER_TO_CARRIER_NEARBY');
  assert.equal(edge.contactEvidenceStatus, 'CLEARANCE_ONLY');
  assert.equal(edge.distanceMm, 10);
});

test('does not resolve attachment from representative points alone', () => {
  const bundle = build(branchWithPipe({
    AXIS_START: undefined,
    AXIS_END: undefined,
    OD: undefined,
    POS: 'E 0 N 0 U 0',
  }, [{
    type: 'ATTA',
    attributes: { NAME: '/PS-942.1', DTXR: 'PIPE SHOE', POS: 'E 0 N 0 U 0' },
  }]));
  assert.equal(bundle.summary.resolvedPhysicalCarrierCount, 1);
  assert.equal(bundle.summary.carrierAttachmentCandidateCount, 0);
  assert.equal(bundle.summary.unresolvedCarrierAttachmentCount, 1);
  const row = bundle.supportCarrierAttachment.unresolvedCarrierAttachments[0];
  assert.equal(row.attachmentStatus, 'UNRESOLVED_SUPPORT_ANALYTICAL_GEOMETRY');
  assert.equal(row.contactEvidenceStatus, 'NOT_PROVEN');
});

test('does not create a physical attachment edge for symbolic DATUM members', () => {
  const source = branchWithPipe({}, [{
    type: 'ATTA',
    attributes: {
      NAME: '/PS-943/DATUM',
      BOUNDS: [-1, 49, -1, 1, 51, 1],
    },
  }]);
  const bundle = build(source);
  const evaluation = bundle.supportCarrierAttachment.evaluations[0];
  assert.equal(evaluation.attachmentStatus, 'NOT_APPLICABLE_SYMBOLIC_MEMBER');
  assert.equal(bundle.supportCarrierAttachment.supportCarrierAttachmentEdges.length, 0);
});

test('respects transformed carrier and support geometry in world space', () => {
  const source = {
    objects: [{
      type: 'BRANCH',
      attributes: { NAME: '/LINE-401/B1', TRANSLATION: [1000, 2000, 3000] },
      children: [{
        type: 'PIPE',
        attributes: {
          NAME: '/PIPE-401',
          CARRIER_ID: '/PIPE-401',
          AXIS_START: [-100, 0, 0],
          AXIS_END: [100, 0, 0],
          AXIS_COORDINATE_SPACE: 'LOCAL',
          OD: 100,
        },
        children: [support('/PS-944.1', [-10, 50, -10, 10, 60, 10])],
      }],
    }],
  };
  const bundle = build(source);
  const edge = bundle.supportCarrierAttachment.supportCarrierAttachmentEdges[0];
  assert.equal(edge.distanceMm, 0);
  assert.ok(edge.contactPointGlobal.x > 900);
  assert.ok(edge.contactPointGlobal.y > 2000);
  assert.ok(edge.contactPointGlobal.z > 2900);
});

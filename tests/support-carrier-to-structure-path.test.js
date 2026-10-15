import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportCarrierToStructurePathBundle } from '../tabs/support-steel-relationship-builder/support-carrier-to-structure-path.js';

function baseInput(overrides = {}) {
  return {
    supportFamilies: [{ familyId: '/PS-100', members: [] }],
    carrierResolution: {
      supportCarrierEdges: [{
        edgeId: 'IDENTITY-1', supportFamilyId: '/PS-100', supportMemberId: '/PS-100.1',
        carrierObjectId: '/PIPE-1', confidence: 'HIGH',
      }],
    },
    carrierAttachment: {
      supportCarrierAttachmentEdges: [{
        edgeId: 'ATTACH-1', supportFamilyId: '/PS-100', supportMemberId: '/PS-100.1',
        carrierObjectId: '/PIPE-1', confidence: 'HIGH',
      }],
      nearbyCarrierAttachmentCandidates: [],
      unresolvedCarrierAttachments: [],
    },
    carrierTopology: {
      topologyPaths: [{
        pathId: 'TOPOLOGY-1', pathStatus: 'CONNECTED',
        componentIds: ['/PIPE-1', '/ELBOW-1'], edgeIds: ['TOPOLOGY-EDGE-1'],
        exceptionCodes: [],
      }],
    },
    supportMemberChain: {
      supportChainEdges: [{
        edgeId: 'CHAIN-1', supportFamilyId: '/PS-100',
        supportA: '/PS-100.1', supportB: '/PS-100.2', confidence: 'HIGH',
      }],
      structuralTerminalEdges: [{
        edgeId: 'TERMINAL-1', edgeType: 'SUPPORT_MEMBER_TO_STRUCTURE',
        supportFamilyId: '/PS-100', supportMemberId: '/PS-100.2',
        steelGroupId: '/SL-1', structuralMemberId: '/SL-1/BEAM',
        contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE', confidence: 'HIGH',
      }],
    },
    ...overrides,
  };
}

test('builds a complete carrier topology to structural terminal evidence path', () => {
  const result = buildSupportCarrierToStructurePathBundle(baseInput());
  assert.equal(result.schema, 'SupportCarrierToStructurePathBundle.v1');
  assert.equal(result.summary.completePathCount, 1);
  assert.equal(result.summary.completeFamilyCount, 1);
  assert.equal(result.pathExceptions.length, 0);
  const path = result.completePaths[0];
  assert.equal(path.pathStatus, 'COMPLETE_CARRIER_TO_STRUCTURE_PATH');
  assert.equal(path.carrierTopologyPathId, 'TOPOLOGY-1');
  assert.deepEqual(path.supportChainEdgeIds, ['CHAIN-1']);
  assert.equal(path.structuralTerminalEdgeId, 'TERMINAL-1');
  assert.equal(path.contactEvidenceStatus, 'ANALYTICAL_PATH_CANDIDATE');
});

test('attachment member may itself be the structural terminal', () => {
  const input = baseInput({
    supportMemberChain: {
      supportChainEdges: [],
      structuralTerminalEdges: [{
        edgeId: 'TERMINAL-SELF', edgeType: 'SUPPORT_MEMBER_TO_STRUCTURE',
        supportFamilyId: '/PS-100', supportMemberId: '/PS-100.1',
        steelGroupId: '/SL-1', contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
        confidence: 'MEDIUM',
      }],
    },
  });
  const result = buildSupportCarrierToStructurePathBundle(input);
  assert.equal(result.completePaths.length, 1);
  assert.deepEqual(result.completePaths[0].supportChainEdgeIds, []);
  assert.ok(result.completePaths[0].relationshipBasis.includes('ATTACHMENT_MEMBER_IS_STRUCTURAL_TERMINAL'));
});

test('carrier identity without analytical attachment remains incomplete', () => {
  const input = baseInput({
    carrierAttachment: {
      supportCarrierAttachmentEdges: [],
      nearbyCarrierAttachmentCandidates: [],
      unresolvedCarrierAttachments: [],
    },
  });
  const result = buildSupportCarrierToStructurePathBundle(input);
  assert.equal(result.completePaths.length, 0);
  assert.equal(result.pathExceptions[0].exceptionCode, 'CARRIER_ATTACHMENT_NOT_PROVEN');
});

test('nearby attachment remains clearance-only evidence', () => {
  const input = baseInput({
    carrierAttachment: {
      supportCarrierAttachmentEdges: [],
      nearbyCarrierAttachmentCandidates: [{
        supportFamilyId: '/PS-100', supportMemberId: '/PS-100.1',
        carrierObjectId: '/PIPE-1', distanceMm: 12,
      }],
      unresolvedCarrierAttachments: [],
    },
  });
  const result = buildSupportCarrierToStructurePathBundle(input);
  assert.equal(result.pathExceptions[0].exceptionCode, 'CARRIER_ATTACHMENT_CLEARANCE_ONLY');
  assert.equal(result.pathExceptions[0].severity, 'INFO');
});

test('topology paths requiring review cannot complete the engineering path', () => {
  const input = baseInput({
    carrierTopology: {
      topologyPaths: [{
        pathId: 'TOPOLOGY-REVIEW', pathStatus: 'REVIEW_REQUIRED',
        componentIds: ['/PIPE-1'], edgeIds: [],
        exceptionCodes: ['DISCONNECTED_CARRIER_COMPONENT'],
      }],
    },
  });
  const result = buildSupportCarrierToStructurePathBundle(input);
  assert.equal(result.completePaths.length, 0);
  assert.equal(result.pathExceptions[0].exceptionCode, 'CARRIER_TOPOLOGY_PATH_REVIEW_REQUIRED');
});

test('analytical attachment without a support-chain route remains incomplete', () => {
  const input = baseInput({
    supportMemberChain: {
      supportChainEdges: [],
      structuralTerminalEdges: [{
        edgeId: 'TERMINAL-1', edgeType: 'SUPPORT_MEMBER_TO_STRUCTURE',
        supportFamilyId: '/PS-100', supportMemberId: '/PS-100.2',
        steelGroupId: '/SL-1', contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
      }],
    },
  });
  const result = buildSupportCarrierToStructurePathBundle(input);
  assert.equal(result.pathExceptions[0].exceptionCode, 'SUPPORT_CHAIN_TO_STRUCTURE_INCOMPLETE');
});

test('clearance-only structural terminals do not qualify', () => {
  const input = baseInput({
    supportMemberChain: {
      supportChainEdges: [],
      structuralTerminalEdges: [{
        edgeId: 'TERMINAL-NEAR', edgeType: 'SUPPORT_MEMBER_TO_STRUCTURE',
        supportFamilyId: '/PS-100', supportMemberId: '/PS-100.1',
        steelGroupId: '/SL-1', contactEvidenceStatus: 'CLEARANCE_ONLY',
      }],
    },
  });
  const result = buildSupportCarrierToStructurePathBundle(input);
  assert.equal(result.pathExceptions[0].exceptionCode, 'STRUCTURAL_TERMINAL_MISSING');
});

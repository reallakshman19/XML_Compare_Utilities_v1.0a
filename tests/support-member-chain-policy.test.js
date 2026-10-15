import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';

test('mismatched SREF target does not inherit a different resolved steel relationship', () => {
  const supportInput = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B10' },
    children: [
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-21000/DATUM',
          STRUCTURE_REF: '/SL-9100',
          POS: { x: 0, y: 0, z: 0 },
        },
      },
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-21000/SREF',
          STEEL_REF: '/SL-OTHER',
          POS: { x: 0, y: 0, z: 0 },
        },
      },
    ],
  }];
  const steelInput = [{
    type: 'SCTN',
    attributes: {
      NAME: '/SL-9100/BEAM-01',
      DESCRIPTION: 'STRUCTURAL STEEL SECTION',
      BOUNDS: { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } },
    },
  }];
  const bundle = buildSupportSteelRelationshipBundle({ supportInput, steelInput });
  assert.equal(bundle.relationships[0].steelGroupId, '/SL-9100');
  assert.equal(bundle.relationships[0].relationshipStatus, 'RESOLVED_EXPLICIT');
  assert.equal(bundle.supportMemberChain.structuralTerminalEdges.length, 0);
});

test('emitNearbyMemberCandidates=false suppresses clearance candidates for API callers', () => {
  const supportInput = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B11' },
    children: [
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-21001.1',
          DTXR: 'PIPE SHOE',
          BOUNDS: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
        },
      },
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-21001.2',
          DTXR: 'WEAR PLATE',
          BOUNDS: { min: { x: 0, y: 0, z: 15 }, max: { x: 10, y: 10, z: 20 } },
        },
      },
    ],
  }];
  const bundle = buildSupportSteelRelationshipBundle({
    supportInput,
    steelInput: [],
    config: {
      memberContactToleranceMm: 2,
      memberCandidateToleranceMm: 10,
      emitNearbyMemberCandidates: false,
    },
  });
  assert.equal(bundle.supportMemberChain.supportChainEdges.length, 0);
  assert.equal(bundle.supportMemberChain.nearbyCandidateEdges.length, 0);
  assert.equal(bundle.supportMemberChain.config.emitNearbyCandidates, false);
});

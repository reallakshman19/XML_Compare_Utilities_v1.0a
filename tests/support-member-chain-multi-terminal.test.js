import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js';

const combinedInput = [
  {
    name: '/LINE-100/B1',
    type: 'BRANCH',
    attributes: { NAME: '/LINE-100/B1' },
    children: [
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-30001.1',
          OWNER: '/LINE-100/B1',
          STEEL_REF: '/SL-30001',
          DTXR: 'PIPE SHOE',
          BOUNDS: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 20, z: 20 } },
        },
      },
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-30001.2',
          OWNER: '/LINE-100/B1',
          STEEL_REF: '/SL-30001',
          DTXR: 'BRACKET',
          BOUNDS: { min: { x: 30, y: 0, z: 0 }, max: { x: 50, y: 20, z: 20 } },
        },
      },
    ],
  },
  {
    name: '/SL-30001',
    type: 'STEEL_GROUP',
    attributes: { NAME: '/SL-30001', DESCRIPTION: 'STRUCTURAL STEEL GROUP' },
    children: [{
      name: '/SL-30001/BEAM-01',
      type: 'SCTN',
      attributes: {
        NAME: '/SL-30001/BEAM-01',
        DESCRIPTION: 'STRUCTURAL STEEL SECTION',
        BOUNDS: { min: { x: 0, y: 0, z: -10 }, max: { x: 50, y: 20, z: 0 } },
      },
    }],
  },
];

test('emits every independently in-contact support member as a structural terminal', () => {
  const bundle = buildSupportSteelRelationshipBundle({
    combinedInput,
    config: { memberContactToleranceMm: 2, memberCandidateToleranceMm: 25 },
  });
  assert.equal(bundle.structuralTerminalEvaluationSchema, 'SupportStructuralTerminalMultiContact.v1');
  const physical = bundle.supportMemberChain.structuralTerminalEdges.filter((row) => (
    row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE'
  ));
  assert.deepEqual(
    physical.map((row) => row.supportMemberId).sort(),
    ['/PS-30001.1', '/PS-30001.2'],
  );
  assert.ok(physical.every((row) => row.relationshipBasis.includes('ALL_IN_CONTACT_MEMBERS')));
  assert.equal(bundle.supportMemberChain.summary.analyticalStructuralTerminalContactCount, 2);
  assert.equal(bundle.supportMemberChain.summary.multiTerminalFamilyCount, 1);
});

test('retains only one nearest clearance candidate when no member contacts structure', () => {
  const shifted = structuredClone(combinedInput);
  shifted[1].children[0].attributes.BOUNDS = {
    min: { x: 0, y: 0, z: -20 },
    max: { x: 50, y: 20, z: -10 },
  };
  const bundle = buildSupportSteelRelationshipBundle({
    combinedInput: shifted,
    config: { memberContactToleranceMm: 2, memberCandidateToleranceMm: 15 },
  });
  const physical = bundle.supportMemberChain.structuralTerminalEdges.filter((row) => row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE');
  assert.equal(physical.length, 1);
  assert.equal(physical[0].contactEvidenceStatus, 'CLEARANCE_ONLY');
  assert.ok(physical[0].relationshipBasis.includes('NEAREST_CLEARANCE_MEMBER_ONLY'));
});

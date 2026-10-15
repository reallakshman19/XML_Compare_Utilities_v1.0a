import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';
import { supportMemberChainToCsv } from '../tabs/support-steel-relationship-builder/support-steel-relationship-export.js';
import {
  SUPPORT_STEEL_SAMPLE_STEEL,
  SUPPORT_STEEL_SAMPLE_SUPPORT,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';
import {
  aabbToAabbDistance,
  obbOverlapSat,
  segmentToSegmentDistance,
} from '../tabs/support-steel-relationship-builder/support-member-analytical-geometry.js';

function build(supportInput = SUPPORT_STEEL_SAMPLE_SUPPORT, steelInput = SUPPORT_STEEL_SAMPLE_STEEL, config = {}) {
  return buildSupportSteelRelationshipBundle({ supportInput, steelInput, config });
}

test('builds analytical support-member chain and structural terminals for the sample family', () => {
  const bundle = build();
  assert.equal(bundle.memberChainEngineSchema, 'SupportMemberChainBundle.v1');
  assert.equal(bundle.bundlePurpose, 'RELATIONSHIP_AND_MEMBER_CONNECTIVITY_INFERENCE');
  assert.equal(bundle.contactEvidenceAvailable, false);
  assert.equal(bundle.analyticalMemberContactEvidenceAvailable, true);
  assert.equal(bundle.summary.analyticalSupportMemberCount, 2);
  assert.equal(bundle.summary.supportChainEdgeCount, 1);
  assert.equal(bundle.summary.structuralTerminalEdgeCount, 2);

  const family = bundle.supportMemberChain.familyChains.find((row) => row.familyId === '/PS-14259');
  assert.ok(family);
  assert.equal(family.supportChainEdges.length, 1);
  const contact = family.supportChainEdges[0];
  assert.deepEqual(new Set([contact.supportA, contact.supportB]), new Set(['/PS-14259.1', '/PS-14259.2']));
  assert.equal(contact.relationshipStatus, 'RESOLVED_ANALYTICAL_CONTACT');
  assert.equal(contact.contactEvidenceStatus, 'ANALYTICAL_CONTACT_CANDIDATE');
  assert.equal(contact.geometryMethod, 'WORLD_OBB_SAT_OVERLAP');
  assert.equal(contact.distanceMm, 0);
  assert.ok(contact.relationshipBasis.includes('ROLE_COMPATIBILITY'));

  const physicalTerminal = family.structuralTerminalEdges.find((edge) => edge.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE');
  assert.ok(physicalTerminal);
  assert.equal(physicalTerminal.supportMemberId, '/PS-14259.2');
  assert.equal(physicalTerminal.structuralMemberId, '/SL-4201/BEAM-01');
  assert.equal(physicalTerminal.relationshipStatus, 'RESOLVED_ANALYTICAL_CONTACT');
  assert.equal(physicalTerminal.contactEvidenceStatus, 'ANALYTICAL_CONTACT_CANDIDATE');

  const symbolicTerminal = family.structuralTerminalEdges.find((edge) => edge.edgeType === 'STRUCTURAL_REFERENCE');
  assert.ok(symbolicTerminal);
  assert.equal(symbolicTerminal.supportMemberId, '/PS-14259/SREF');
  assert.equal(symbolicTerminal.contactEvidenceStatus, 'NOT_PROVEN');
});

test('family membership and coincident representative positions do not create physical chain edges', () => {
  const support = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B1' },
    children: [
      { type: 'ATTA', attributes: { NAME: '/PS-20000.1', POS: { x: 0, y: 0, z: 0 }, DTXR: 'PIPE SHOE' } },
      { type: 'ATTA', attributes: { NAME: '/PS-20000.2', POS: { x: 0, y: 0, z: 0 }, DTXR: 'WEAR PLATE' } },
    ],
  }];
  const bundle = build(support, []);
  const family = bundle.supportMemberChain.familyChains[0];
  assert.equal(family.supportChainEdges.length, 0);
  assert.equal(family.nearbyCandidateEdges.length, 0);
  assert.equal(family.analyticalMemberCount, 0);
  assert.ok(bundle.diagnostics.some((row) => row.code === 'SUPPORT_FAMILY_HAS_NO_PHYSICAL_MEMBER_GEOMETRY'));
});

test('keeps an analytical gap outside contact tolerance as a nearby clearance candidate', () => {
  const support = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B2' },
    children: [
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-20001.1',
          DTXR: 'PIPE SHOE',
          BOUNDS: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
        },
      },
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-20001.2',
          DTXR: 'WEAR PLATE',
          BOUNDS: { min: { x: 0, y: 0, z: 15 }, max: { x: 10, y: 10, z: 20 } },
        },
      },
    ],
  }];
  const bundle = build(support, [], { memberContactToleranceMm: 2, memberCandidateToleranceMm: 10 });
  const family = bundle.supportMemberChain.familyChains[0];
  assert.equal(family.supportChainEdges.length, 0);
  assert.equal(family.nearbyCandidateEdges.length, 1);
  assert.equal(family.nearbyCandidateEdges[0].distanceMm, 5);
  assert.equal(family.nearbyCandidateEdges[0].contactEvidenceStatus, 'CLEARANCE_ONLY');
});

test('keeps DATUM and SREF symbolic even when their positions coincide', () => {
  const support = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B3' },
    children: [
      { type: 'ATTA', attributes: { NAME: '/PS-20002/DATUM', POS: { x: 0, y: 0, z: 0 } } },
      { type: 'ATTA', attributes: { NAME: '/PS-20002/SREF', POS: { x: 0, y: 0, z: 0 }, STEEL_REF: '/SL-8000' } },
    ],
  }];
  const steel = [{
    type: 'SCTN',
    attributes: {
      NAME: '/SL-8000/BEAM-01',
      DESCRIPTION: 'STRUCTURAL STEEL SECTION',
      BOUNDS: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
    },
  }];
  const bundle = build(support, steel);
  const family = bundle.supportMemberChain.familyChains[0];
  assert.equal(family.supportChainEdges.length, 0);
  assert.ok(family.memberNodes.every((member) => !member.analyticalGeometry.physicalGeometryAvailable));
  assert.ok(family.structuralTerminalEdges.some((edge) => edge.edgeType === 'STRUCTURAL_REFERENCE'));
});

test('composes parent translation before evaluating local support-member bounds', () => {
  const support = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B4', TRANSLATION: { x: 100, y: 200, z: 300 } },
    children: [
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-20003.1',
          DTXR: 'PIPE SHOE',
          BOUNDS: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
        },
      },
      {
        type: 'ATTA',
        attributes: {
          NAME: '/PS-20003.2',
          DTXR: 'WEAR PLATE',
          BOUNDS: { min: { x: 0, y: 0, z: 10 }, max: { x: 10, y: 10, z: 12 } },
        },
      },
    ],
  }];
  const bundle = build(support, []);
  const family = bundle.supportMemberChain.familyChains[0];
  assert.equal(family.supportChainEdges.length, 1);
  const shoe = family.memberNodes.find((member) => member.memberId === '/PS-20003.1');
  assert.equal(shoe.analyticalGeometry.worldTransformApplied, true);
  assert.deepEqual(shoe.analyticalGeometry.worldAabb.min, { x: 100, y: 200, z: 300 });
  assert.deepEqual(shoe.analyticalGeometry.worldAabb.max, { x: 110, y: 210, z: 310 });
});

test('keeps explicit member references separate from physical contact edges', () => {
  const support = [{
    type: 'BRANCH',
    attributes: { NAME: '/PIPE/B5' },
    children: [
      { type: 'ATTA', attributes: { NAME: '/PS-20004.1', CONNECTED_TO: '/PS-20004.2' } },
      { type: 'ATTA', attributes: { NAME: '/PS-20004.2' } },
    ],
  }];
  const bundle = build(support, []);
  const family = bundle.supportMemberChain.familyChains[0];
  assert.equal(family.supportChainEdges.length, 0);
  assert.equal(family.referenceEdges.length, 1);
  assert.equal(family.referenceEdges[0].edgeType, 'SUPPORT_MEMBER_REFERENCE');
  assert.equal(family.referenceEdges[0].contactEvidenceStatus, 'NOT_PROVEN');
});

test('analytical distance primitives distinguish overlap and clearance', () => {
  const aabbDistance = aabbToAabbDistance(
    { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
    { min: { x: 13, y: 0, z: 0 }, max: { x: 20, y: 10, z: 10 } },
  );
  assert.equal(aabbDistance.distanceMm, 3);

  const obbA = {
    center: { x: 0, y: 0, z: 0 },
    axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
    halfExtents: [5, 5, 5],
  };
  const obbB = { ...obbA, center: { x: 9, y: 0, z: 0 } };
  const obbC = { ...obbA, center: { x: 11, y: 0, z: 0 } };
  assert.equal(obbOverlapSat(obbA, obbB), true);
  assert.equal(obbOverlapSat(obbA, obbC), false);

  const segments = segmentToSegmentDistance(
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 5, y: 3, z: 0 },
    { x: 5, y: 3, z: 10 },
  );
  assert.equal(segments.distanceMm, 3);
});

test('exports physical, nearby, symbolic and structural terminal edge classes', () => {
  const csv = supportMemberChainToCsv(build());
  assert.match(csv, /edgeId,edgeType,supportFamilyId/);
  assert.match(csv, /SUPPORT_MEMBER_CONTACT/);
  assert.match(csv, /STRUCTURAL_REFERENCE/);
  assert.match(csv, /SUPPORT_MEMBER_TO_STRUCTURE/);
  assert.match(csv, /ANALYTICAL_CONTACT_CANDIDATE/);
});

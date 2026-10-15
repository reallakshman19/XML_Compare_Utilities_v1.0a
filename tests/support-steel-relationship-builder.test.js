import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';
import { supportSteelRelationshipsToCsv } from '../tabs/support-steel-relationship-builder/support-steel-relationship-export.js';
import {
  SUPPORT_STEEL_SAMPLE_STEEL,
  SUPPORT_STEEL_SAMPLE_SUPPORT,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';
import {
  collectSteelGroups,
  collectSupportFamilies,
} from '../tabs/support-steel-relationship-builder/support-steel-source-reader.js';
import { parsePoint } from '../tabs/support-steel-relationship-builder/support-steel-source-utils.js';

function build(config = {}) {
  return buildSupportSteelRelationshipBundle({
    supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT,
    steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
    config,
  });
}

test('reconstructs one support family across multiple pipe branches', () => {
  const families = collectSupportFamilies(SUPPORT_STEEL_SAMPLE_SUPPORT);
  const family = families.find((row) => row.familyId === '/PS-14259');
  assert.ok(family);
  assert.equal(family.members.length, 4);
  assert.equal(family.analyticalMemberCount, 2);
  assert.deepEqual(family.branchIds, [
    '/ASIM-1836-4"-P9001002/B3',
    '/ASIM-1836-6"-P9001001/B1',
  ]);
  assert.deepEqual(family.members.map((member) => member.semanticRole).sort(), [
    'DATUM',
    'PIPE_SHOE',
    'STRUCTURAL_REFERENCE',
    'WEAR_PLATE',
  ]);
});

test('resolves explicit support to steel relationship and includes member connectivity evidence', () => {
  const bundle = build();
  assert.equal(bundle.schema, 'SupportSteelRelationshipBundle.v1');
  assert.equal(bundle.geometryEngineSchema, 'SupportSteelAnalyticalGeometry.v1');
  assert.equal(bundle.memberChainEngineSchema, 'SupportMemberChainBundle.v1');
  assert.equal(bundle.bundlePurpose, 'RELATIONSHIP_AND_MEMBER_CONNECTIVITY_INFERENCE');
  assert.equal(bundle.contactEvidenceAvailable, false);
  assert.equal(bundle.analyticalMemberContactEvidenceAvailable, true);
  assert.equal(bundle.summary.supportFamilyCount, 2);
  assert.equal(bundle.summary.steelGroupCount, 2);
  assert.equal(bundle.summary.analyticalSteelGroupCount, 1);
  assert.equal(bundle.summary.analyticalSupportMemberCount, 2);
  assert.equal(bundle.summary.supportChainEdgeCount, 1);
  assert.equal(bundle.summary.structuralTerminalEdgeCount, 2);
  assert.equal(bundle.summary.resolvedFamilyCount, 1);
  assert.equal(bundle.summary.unresolvedFamilyCount, 1);
  const resolved = bundle.relationships.find((row) => row.supportFamilyId === '/PS-14259');
  assert.equal(resolved.steelGroupId, '/SL-4201');
  assert.equal(resolved.relationshipStatus, 'RESOLVED_EXPLICIT');
  assert.equal(resolved.relationshipCardinality, 'ONE_TO_ONE');
  assert.equal(resolved.evidenceSource, 'STAGED_JSON_RELATIONSHIP_ENGINE');
  assert.equal(resolved.evidenceClass, 'INFERRED');
  assert.equal(resolved.relationshipSemantic, 'INFERRED_STRUCTURAL_RELATIONSHIP');
  assert.equal(resolved.contactEvidenceStatus, 'ANALYTICAL_PROXIMITY_ONLY');
  assert.equal(resolved.analyticalGeometryAvailable, true);
  assert.equal(resolved.geometryMethod, 'POINT_TO_WORLD_OBB');
  assert.equal(resolved.structuralMemberId, '/SL-4201/BEAM-01');
  assert.match(resolved.evidenceId, /^SSRB:/);
  assert.ok(resolved.relationshipBasis.includes('EXPLICIT_REFERENCE'));
  const unresolved = bundle.relationships.find((row) => row.supportFamilyId === '/PS-14260');
  assert.equal(unresolved.relationshipStatus, 'UNRESOLVED');
  assert.equal(unresolved.relationshipCardinality, 'UNRESOLVED');
  assert.equal(unresolved.nearestSteelGroupId, '/SL-4202');
  assert.equal(unresolved.distanceMm, 50);
  assert.equal(unresolved.geometryMethod, 'POINT_TO_REPRESENTATIVE_POINT');
});

test('OWNER remains low-confidence shared-owner evidence and never becomes explicit', () => {
  const support = [{
    type: 'ATTA',
    attributes: { NAME: '/PS-16000/DATUM', OWNER: '/PIPE/B1' },
  }];
  const steel = [{
    type: 'STEEL_GROUP',
    attributes: { NAME: '/SL-6000', OWNER: '/PIPE/B1' },
  }];
  const families = collectSupportFamilies(support);
  assert.deepEqual(families[0].explicitReferences, []);
  const bundle = buildSupportSteelRelationshipBundle({ supportInput: support, steelInput: steel });
  assert.equal(bundle.relationships[0].relationshipStatus, 'RESOLVED_SHARED_OWNER');
  assert.equal(bundle.relationships[0].confidence, 'LOW');
  assert.deepEqual(bundle.relationships[0].relationshipBasis, ['SHARED_OWNER']);
});

test('generic GROUP requires structural class evidence', () => {
  const groups = collectSteelGroups([
    { type: 'GROUP', attributes: { NAME: '/EQUIPMENT-GROUP-1', DESCRIPTION: 'PUMPS' } },
    { type: 'GROUP', attributes: { NAME: '/SL-6100', DESCRIPTION: 'STRUCTURAL STEEL FRAME' } },
  ]);
  assert.deepEqual(groups.map((row) => row.steelGroupId), ['/SL-6100']);
});

test('multiple explicit steel candidates are ambiguous, not multiply resolved', () => {
  const support = [{
    type: 'ATTA',
    attributes: {
      NAME: '/PS-17000/DATUM',
      STEEL_REF: '/SL-7000',
      STRUCTURE_REF: '/SL-7001',
    },
  }];
  const steel = [
    { type: 'STEEL_GROUP', attributes: { NAME: '/SL-7000' } },
    { type: 'STEEL_GROUP', attributes: { NAME: '/SL-7001' } },
  ];
  const bundle = buildSupportSteelRelationshipBundle({ supportInput: support, steelInput: steel });
  assert.equal(bundle.summary.ambiguousFamilyCount, 1);
  assert.equal(bundle.relationships.length, 2);
  assert.ok(bundle.relationships.every((row) => row.relationshipStatus === 'AMBIGUOUS'));
  assert.ok(bundle.relationships.every((row) => row.relationshipCardinality === 'ONE_TO_MANY_AMBIGUOUS'));
});

test('representative point proximity is diagnostic-only by default', () => {
  const support = [{
    type: 'ATTA',
    attributes: { NAME: '/PS-15000/DATUM', POS: { x: 0, y: 0, z: 0 } },
  }];
  const steel = [{
    type: 'STEEL_GROUP',
    attributes: { NAME: '/SL-5000', POS: { x: 0, y: 0, z: 20 } },
  }];
  const bundle = buildSupportSteelRelationshipBundle({ supportInput: support, steelInput: steel });
  assert.equal(bundle.relationships[0].relationshipStatus, 'UNRESOLVED');
  assert.equal(bundle.relationships[0].distanceMm, 20);
  assert.equal(bundle.relationships[0].geometryQuality, 'FALLBACK');
  assert.equal(bundle.relationships[0].analyticalGeometryAvailable, false);
  assert.ok(bundle.diagnostics.some((row) => row.code === 'REPRESENTATIVE_POINT_PROXIMITY_NOT_ACCEPTED'));
});

test('representative point proximity can be enabled only as an explicit compatibility option', () => {
  const support = [{
    type: 'ATTA',
    attributes: { NAME: '/PS-15002/DATUM', POS: { x: 0, y: 0, z: 0 } },
  }];
  const steel = [{
    type: 'STEEL_GROUP',
    attributes: { NAME: '/SL-5002', POS: { x: 0, y: 0, z: 20 } },
  }];
  const bundle = buildSupportSteelRelationshipBundle({
    supportInput: support,
    steelInput: steel,
    config: { requireAnalyticalGeometryForSpatialResolution: false },
  });
  assert.equal(bundle.relationships[0].relationshipStatus, 'RESOLVED_SPATIAL');
  assert.equal(bundle.relationships[0].distanceMm, 20);
  assert.deepEqual(bundle.relationships[0].relationshipBasis, ['REPRESENTATIVE_POINT_PROXIMITY']);
  assert.equal(bundle.relationships[0].confidence, 'LOW');
});

test('resolves unique analytical bounds proximity', () => {
  const support = [{
    type: 'ATTA',
    attributes: { NAME: '/PS-15100/DATUM', POS: { x: 0, y: 0, z: 0 } },
  }];
  const steel = [{
    type: 'SCTN',
    attributes: {
      NAME: '/SL-5200/BEAM-01',
      DESCRIPTION: 'STRUCTURAL STEEL SECTION',
      BOUNDS: { min: { x: 10, y: -2, z: -2 }, max: { x: 30, y: 2, z: 2 } },
    },
  }];
  const bundle = buildSupportSteelRelationshipBundle({ supportInput: support, steelInput: steel });
  const relationship = bundle.relationships[0];
  assert.equal(relationship.relationshipStatus, 'RESOLVED_SPATIAL');
  assert.equal(relationship.distanceMm, 10);
  assert.equal(relationship.geometryMethod, 'POINT_TO_WORLD_OBB');
  assert.equal(relationship.geometryQuality, 'HIGH');
  assert.equal(relationship.analyticalGeometryAvailable, true);
  assert.deepEqual(relationship.relationshipBasis, ['ANALYTICAL_GEOMETRY_PROXIMITY']);
});

test('keeps tied analytical geometry candidates ambiguous', () => {
  const support = [{
    type: 'ATTA',
    attributes: { NAME: '/PS-15001/DATUM', POS: { x: 0, y: 0, z: 0 } },
  }];
  const steel = [
    {
      type: 'SCTN',
      attributes: {
        NAME: '/SL-5100/BEAM-01',
        DESCRIPTION: 'STRUCTURAL STEEL SECTION',
        BOUNDS: { min: { x: 10, y: -1, z: -1 }, max: { x: 12, y: 1, z: 1 } },
      },
    },
    {
      type: 'SCTN',
      attributes: {
        NAME: '/SL-5101/BEAM-01',
        DESCRIPTION: 'STRUCTURAL STEEL SECTION',
        BOUNDS: { min: { x: -12.5, y: -1, z: -1 }, max: { x: -10.5, y: 1, z: 1 } },
      },
    },
  ];
  const bundle = buildSupportSteelRelationshipBundle({ supportInput: support, steelInput: steel });
  assert.equal(bundle.summary.ambiguousFamilyCount, 1);
  assert.equal(bundle.relationships.length, 2);
  assert.ok(bundle.relationships.every((row) => row.relationshipStatus === 'AMBIGUOUS'));
  assert.ok(bundle.relationships.every((row) => row.analyticalGeometryAvailable));
});

test('parses plant coordinates and exports analytical provenance for each ledger row', () => {
  assert.deepEqual(parsePoint('E 437500mm S 1159000mm U 2100mm'), {
    x: 437500,
    y: -1159000,
    z: 2100,
  });
  const bundle = build();
  const csv = supportSteelRelationshipsToCsv(bundle);
  assert.match(csv, /evidenceId,evidenceSource,evidenceClass,sourceSchema,geometryEngineSchema/);
  assert.match(csv, /supportFamilyId,steelGroupId,structuralMemberId,relationshipStatus/);
  assert.match(csv, /analyticalGeometryAvailable,geometryMethod,geometryQuality,distanceMm/);
  assert.match(csv, /PS-14259/);
  assert.match(csv, /RESOLVED_EXPLICIT/);
  assert.match(csv, /ANALYTICAL_PROXIMITY_ONLY/);
  assert.match(csv, /POINT_TO_WORLD_OBB/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  minimumSupportToSteelGeometryDistance,
  pointToAabbDistance,
  pointToObbDistance,
  pointToSegmentDistance,
} from '../tabs/support-steel-relationship-builder/support-steel-analytical-geometry.js';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';
import { collectSteelGroups } from '../tabs/support-steel-relationship-builder/support-steel-source-reader.js';
import {
  multiplyMatrices,
  parseMatrix,
  transformLocalBounds,
  transformPoint,
  translationMatrix,
} from '../tabs/support-steel-relationship-builder/support-steel-world-matrix.js';

test('composes parent and child transforms in hierarchy order', () => {
  const steelSource = [{
    type: 'STEEL_GROUP',
    attributes: {
      NAME: '/SL-9000',
      DESCRIPTION: 'STRUCTURAL STEEL GROUP',
      LOCAL_TRANSLATION: [100, 200, 300],
    },
    children: [{
      type: 'SCTN',
      attributes: {
        NAME: '/SL-9000/BEAM-01',
        DESCRIPTION: 'STRUCTURAL STEEL SECTION',
        LOCAL_TRANSLATION: [10, 0, 0],
        AXIS_START: [0, 0, 0],
        AXIS_END: [100, 0, 0],
        AXIS_COORDINATE_SPACE: 'LOCAL',
      },
    }],
  }];
  const groups = collectSteelGroups(steelSource);
  const beam = groups[0].records.find((record) => record.recordId === '/SL-9000/BEAM-01');
  assert.deepEqual(beam.analyticalGeometry.axis.start, { x: 110, y: 200, z: 300 });
  assert.deepEqual(beam.analyticalGeometry.axis.end, { x: 210, y: 200, z: 300 });
  assert.equal(beam.analyticalGeometry.worldTransformApplied, true);
});

test('normalizes column-major matrix elements and transforms points', () => {
  const columnMajorTranslation = {
    order: 'COLUMN_MAJOR',
    elements: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1,
    ],
  };
  assert.deepEqual(transformPoint(parseMatrix(columnMajorTranslation), { x: 1, y: 2, z: 3 }), {
    x: 11,
    y: 22,
    z: 33,
  });
});

test('multiplies affine transforms in parent then local order', () => {
  const world = multiplyMatrices(translationMatrix({ x: 100, y: 0, z: 0 }), translationMatrix({ x: 25, y: 5, z: 0 }));
  assert.deepEqual(transformPoint(world, { x: 0, y: 0, z: 0 }), { x: 125, y: 5, z: 0 });
});

test('transforms local bounds to world OBB and measures point distance', () => {
  const rotateZ90AndTranslate = [
    0, -1, 0, 100,
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  const transformed = transformLocalBounds(rotateZ90AndTranslate, {
    min: { x: -5, y: -1, z: -1 },
    max: { x: 5, y: 1, z: 1 },
  });
  const result = pointToObbDistance({ x: 105, y: 0, z: 0 }, transformed.worldObb);
  assert.equal(result.distanceMm, 4);
  assert.deepEqual(result.nearestPoint, { x: 101, y: 0, z: 0 });
});

test('calculates point-to-AABB and point-to-axis distances', () => {
  assert.deepEqual(pointToAabbDistance({ x: 15, y: 2, z: 3 }, {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 10, y: 10, z: 10 },
  }), {
    distanceMm: 5,
    nearestPoint: { x: 10, y: 2, z: 3 },
  });
  const segment = pointToSegmentDistance(
    { x: 500, y: 15, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1000, y: 0, z: 0 },
    10,
  );
  assert.equal(segment.centrelineDistanceMm, 15);
  assert.equal(segment.distanceMm, 5);
  assert.equal(segment.axisFraction, 0.5);
});

test('uses a long structural axis instead of its distant representative origin', () => {
  const support = [{
    type: 'ATTA',
    attributes: { NAME: '/PS-9100/DATUM', POS: { x: 900, y: 5, z: 0 } },
  }];
  const steel = [{
    type: 'SCTN',
    attributes: {
      NAME: '/SL-9100/BEAM-01',
      DESCRIPTION: 'STRUCTURAL STEEL SECTION',
      POS: { x: 0, y: 0, z: 0 },
      AXIS_START: { x: 0, y: 0, z: 0 },
      AXIS_END: { x: 1000, y: 0, z: 0 },
    },
  }];
  const bundle = buildSupportSteelRelationshipBundle({ supportInput: support, steelInput: steel });
  const relationship = bundle.relationships[0];
  assert.equal(relationship.relationshipStatus, 'RESOLVED_SPATIAL');
  assert.equal(relationship.distanceMm, 5);
  assert.equal(relationship.geometryMethod, 'POINT_TO_WORLD_AXIS');
  assert.equal(relationship.structuralMemberId, '/SL-9100/BEAM-01');
  assert.equal(relationship.analyticalGeometryAvailable, true);
});

test('returns nearest structural member evidence across a steel group', () => {
  const family = {
    supportPositionGlobal: { x: 0, y: 0, z: 0 },
    positions: [{ x: 0, y: 0, z: 0 }],
  };
  const steel = {
    records: [
      {
        recordId: '/SL-9200/BEAM-FAR',
        positionGlobal: { x: 1000, y: 0, z: 0 },
        analyticalGeometry: {
          structuralMemberId: '/SL-9200/BEAM-FAR',
          geometryMethods: ['WORLD_AXIS'],
          geometryAvailable: true,
          axis: { start: { x: 1000, y: 0, z: 0 }, end: { x: 1100, y: 0, z: 0 } },
          sectionEnvelopeRadiusMm: 0,
        },
      },
      {
        recordId: '/SL-9200/BEAM-NEAR',
        positionGlobal: { x: 100, y: 0, z: 0 },
        analyticalGeometry: {
          structuralMemberId: '/SL-9200/BEAM-NEAR',
          geometryMethods: ['WORLD_AXIS'],
          geometryAvailable: true,
          axis: { start: { x: 0, y: 8, z: 0 }, end: { x: 100, y: 8, z: 0 } },
          sectionEnvelopeRadiusMm: 0,
        },
      },
    ],
  };
  const evidence = minimumSupportToSteelGeometryDistance(family, steel);
  assert.equal(evidence.structuralMemberId, '/SL-9200/BEAM-NEAR');
  assert.equal(evidence.distanceMm, 8);
});

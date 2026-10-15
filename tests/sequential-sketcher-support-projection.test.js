import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPipeSupportProjectionBundle,
  deriveSupportFamilyIdentity,
} from '../tabs/sequential-sketcher/support/sj-pipe-support-projection.js';

const branchId = '/ASIM-1885-6"-S8810111-91261M7-HC-01/B2';

function support(name, pos, extra = {}, index = 10, owner = branchId) {
  return {
    name: 'SUPPORT FAMILY',
    type: 'SUPPORT',
    sourceBranchName: owner,
    sourceSequenceIndex: index,
    path: [0, 'children', index],
    attributes: {
      NAME: name,
      TYPE: 'ATTA',
      OWNER: owner,
      POS: pos,
      SUPPORT_TAG: name.split('/').filter(Boolean)[0] || 'PS',
      ...extra,
    },
  };
}

test('attributes.NAME is authoritative for support family identity', () => {
  assert.deepEqual(deriveSupportFamilyIdentity('/PS-12061/DATUM'), {
    familyId: '/PS-12061',
    familyIdBasis: 'DERIVED_FROM_ATTRIBUTES_NAME',
  });
  assert.deepEqual(deriveSupportFamilyIdentity('/PS-12061.2'), {
    familyId: '/PS-12061',
    familyIdBasis: 'DERIVED_FROM_ATTRIBUTES_NAME',
  });
});

test('groups sibling support members and projects them on the ordered carrier', () => {
  const carriers = [{
    carrierId: 'PIPE-1',
    carrierType: 'PIPE',
    sourceBranchId: branchId,
    sourceSequenceIndex: 1,
    centerline: {
      start: { x: 440517.219, y: -1159925, z: 1157.2 },
      end: { x: 437752.219, y: -1159925, z: 1157.2 },
      lengthMm: 2765,
    },
    traversal: { sourceStartField: 'APOS', traversalStartField: 'APOS', reversedForTraversal: false },
  }];
  const pos = { x: 438667.219, y: -1159925, z: 1157.2 };
  const records = [
    support('/PS-12061/DATUM', pos, { CMPSUPTYPE: 'REST' }, 2),
    support('/PS-12061.1', pos, { CMPSUPTYPE: 'SH-150', DTXR: 'PIPE SHOE' }, 3),
    support('/PS-12061.2', pos, { CMPSUPTYPE: 'W.PAD THK 6mm', DTXR: 'WEAR PLATE' }, 4),
    support('/PS-12061/SREF', pos, { DTXR: 'STRUCTURAL REFERENCE' }, 5),
  ];
  const original = structuredClone(carriers);
  const bundle = buildPipeSupportProjectionBundle({ branchId, carriers, supportRecords: records });

  assert.equal(bundle.schema, 'PipeSupportProjectionBundle.v1');
  assert.deepEqual(carriers, original, 'support projection must not mutate validated carriers');
  assert.equal(bundle.carriers[0].supportFamilies.length, 1);
  const family = bundle.carriers[0].supportFamilies[0];
  assert.equal(family.position.positionStatus, 'ON_CENTERLINE');
  assert.equal(family.position.carrierStationMm, 1850);
  assert.equal(family.position.carrierFraction, 0.669078);
  assert.deepEqual(family.members.map((member) => member.semanticRole), [
    'DATUM', 'PIPE_SHOE', 'WEAR_PLATE', 'STRUCTURAL_REFERENCE',
  ]);
  assert.deepEqual(family.localFrame, {
    origin: pos,
    tangent: { x: -1, y: 0, z: 0 },
    lateral: { x: 0, y: -1, z: 0 },
    vertical: { x: 0, y: 0, z: 1 },
    handedness: 'RIGHT_HANDED',
    frameStatus: 'RESOLVED',
  });
  assert.equal(bundle.supportGlyphs[0].carrierId, 'PIPE-1');
  assert.equal(bundle.supportGlyphs[0].label, 'PS-12061');
});

test('station is measured from validated traversal start when a pipe is reversed', () => {
  const bundle = buildPipeSupportProjectionBundle({
    branchId,
    carriers: [{
      carrierId: 'PIPE-REVERSED',
      carrierType: 'PIPE',
      sourceBranchId: branchId,
      sourceSequenceIndex: 1,
      attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } },
      traversal: { sourceStartField: 'APOS', traversalStartField: 'LPOS', reversedForTraversal: true },
    }],
    supportRecords: [support('/PS-REV/DATUM', { x: 250, y: 0, z: 0 }, {}, 2)],
  });
  const family = bundle.carriers[0].supportFamilies[0];
  assert.deepEqual(bundle.carriers[0].centerline, {
    start: { x: 1000, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
    lengthMm: 1000,
  });
  assert.equal(family.position.carrierStationMm, 750);
  assert.equal(family.traversal.reversedForTraversal, true);
});

test('fitting ports are explicit and equivalent carriers remain ambiguous', () => {
  const fitting = buildPipeSupportProjectionBundle({
    branchId,
    carriers: [{
      carrierId: 'ELBOW-1',
      carrierType: 'ELBOW',
      sourceBranchId: branchId,
      sourceSequenceIndex: 1,
      fittingGeometry: {
        componentCentre: { x: 100, y: 100, z: 0 },
        ports: [
          { portId: 'A', locationType: 'INLET_PORT', point: { x: 0, y: 100, z: 0 }, tangent: { x: 1, y: 0, z: 0 } },
          { portId: 'B', locationType: 'OUTLET_PORT', point: { x: 100, y: 200, z: 0 }, tangent: { x: 0, y: 1, z: 0 } },
        ],
      },
    }],
    supportRecords: [support('/PS-ELBOW/DATUM', { x: 100, y: 200, z: 0 }, {}, 2)],
  });
  assert.equal(fitting.carriers[0].supportFamilies[0].position.positionStatus, 'ATTACHED_TO_COMPONENT_PORT');
  assert.equal(fitting.carriers[0].supportFamilies[0].position.fittingLocation.portId, 'B');

  const ambiguousRecord = support('/PS-AMB/DATUM', { x: 50, y: 0, z: 0 });
  delete ambiguousRecord.path;
  delete ambiguousRecord.sourceSequenceIndex;
  const ambiguous = buildPipeSupportProjectionBundle({
    branchId,
    carriers: ['A', 'B'].map((suffix) => ({
      carrierId: `PIPE-${suffix}`,
      carrierType: 'PIPE',
      sourceBranchId: branchId,
      centerline: { start: { x: 0, y: 0, z: 0 }, end: { x: 100, y: 0, z: 0 } },
    })),
    supportRecords: [ambiguousRecord],
  });
  assert.equal(ambiguous.supportGlyphs.length, 0);
  assert.equal(ambiguous.unresolvedSupportFamilies[0].carrierBinding.bindingStatus, 'AMBIGUOUS');
});

test('out-of-tolerance and foreign families are not silently attached; units are millimetres only', () => {
  const carriers = [{
    carrierId: 'PIPE-1', carrierType: 'PIPE', sourceBranchId: branchId,
    centerline: { start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 } },
  }];
  const foreign = support('/PS-FOREIGN/DATUM', { x: 100, y: 0, z: 0 }, {}, 2, '/OTHER/B1');
  const bundle = buildPipeSupportProjectionBundle({
    branchId,
    carriers,
    supportRecords: [
      support('/PS-FAR/DATUM', { x: 500, y: 84, z: 0 }, {}, 1),
      foreign,
    ],
    projectionToleranceMm: 50,
  });
  assert.equal(bundle.supportGlyphs.length, 0);
  assert.equal(bundle.unresolvedSupportFamilies.length, 1);
  assert.equal(bundle.unresolvedSupportFamilies[0].position.positionStatus, 'OUTSIDE_PROJECTION_TOLERANCE');
  assert.ok(bundle.diagnostics.some((row) => row.code === 'SUPPORT_FAMILY_EXCLUDED_FROM_BRANCH_BUNDLE'));
  assert.throws(() => buildPipeSupportProjectionBundle({
    branchId, carriers: [], supportRecords: [], coordinateSystem: { units: 'm' },
  }), /millimetres/);
});

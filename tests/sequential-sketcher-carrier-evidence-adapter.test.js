import assert from 'node:assert/strict';
import {
  ANALYTICAL_GEOMETRY_STATUSES,
  MASS_PROPERTY_STATUSES,
  buildSequentialCarrierEvidenceCatalog,
} from '../tabs/sequential-sketcher/integration/sequential-carrier-evidence-adapter.js';

const confirmed = Object.freeze({
  schema: 'ConfirmedSequentialConstruction.v1',
  constructionFingerprint: 'confirmed-fingerprint',
  rootBranchId: '/ASIM-1885-4"-P8810241-31441C4-PP-01/B1',
  branchIds: Object.freeze(['/ASIM-1885-4"-P8810241-31441C4-PP-01/B1']),
  downstreamEligibility: Object.freeze({ supportProjection: true, export: true, calculation: true }),
  boundaryClassifications: Object.freeze([{ classificationId: 'BOUNDARY-1', boundaryRole: 'HEAD' }]),
  components: Object.freeze([
    Object.freeze({
      componentId: 'COMP-1', sourceComponentId: '=VALVE/1', sourceName: 'VALVE =VALVE/1',
      branchId: '/ASIM-1885-4"-P8810241-31441C4-PP-01/B1', canonicalType: 'VALVE', sourceType: 'VALV',
      geometry: Object.freeze({ kind: 'INLINE', lengthMm: 100 }),
      shadowCarrierEvidence: Object.freeze({
        componentId: 'SHADOW-1', sourceComponentId: 'PIPE AUTO 1', sourceName: 'PIPE AUTO 1',
      }),
      ports: Object.freeze([
        Object.freeze({ portId: 'P1', role: 'INLET', sourcePosition: { x: 0, y: 0, z: 0 }, boreMm: 100 }),
        Object.freeze({ portId: 'P2', role: 'OUTLET', sourcePosition: { x: 100, y: 0, z: 0 }, boreMm: 100 }),
      ]),
    }),
    Object.freeze({
      componentId: 'COMP-2', sourceComponentId: 'PIPE/2', sourceName: 'PIPE/2',
      branchId: '/ASIM-1885-4"-P8810241-31441C4-PP-01/B1', canonicalType: 'PIPE', sourceType: 'PIPE',
      geometry: Object.freeze({ kind: 'STRAIGHT', lengthMm: 200 }), shadowCarrierEvidence: null,
      ports: Object.freeze([
        Object.freeze({ portId: 'P3', role: 'INLET', sourcePosition: { x: 102, y: 0, z: 0 }, boreMm: 100 }),
        Object.freeze({ portId: 'P4', role: 'OUTLET', sourcePosition: { x: 302, y: 0, z: 0 }, boreMm: 100 }),
      ]),
    }),
    Object.freeze({
      componentId: 'COMP-3', sourceComponentId: 'INSTRUMENT/3', sourceName: 'INSTRUMENT/3',
      branchId: '/ASIM-1885-4"-P8810241-31441C4-PP-01/B1', canonicalType: 'INSTRUMENT', sourceType: 'INST',
      geometry: null, shadowCarrierEvidence: null,
      ports: Object.freeze([
        Object.freeze({ portId: 'P5', role: 'INLET', sourcePosition: { x: 302, y: 0, z: 0 }, boreMm: 100 }),
      ]),
    }),
  ]),
  connections: Object.freeze([Object.freeze({
    connectionId: 'CONNECTION-1', fromPortId: 'P2', toPortId: 'P3',
    fromPosition: { x: 100, y: 0, z: 0 }, toPosition: { x: 100, y: 0, z: 0 },
    status: 'AUTO_REPAIRED_SMALL_GAP',
  })]),
  repairs: Object.freeze([Object.freeze({
    repairId: 'REPAIR-1', connectionId: 'CONNECTION-1', gapMm: 2, approvedBy: 'SYSTEM',
  })]),
});

const catalog = buildSequentialCarrierEvidenceCatalog(confirmed);
assert.deepEqual(catalog, buildSequentialCarrierEvidenceCatalog(confirmed));
assert.equal(catalog.schema, 'SequentialCarrierEvidenceCatalog.v1');
assert.equal(catalog.carriers.length, 3);
assert.equal(catalog.carriers[0].routeOrder, 0);
assert.equal(catalog.carriers[0].lineFamily, 'P8810241');
assert.ok(catalog.carriers[0].aliases.includes('PIPE AUTO 1'));
assert.equal(catalog.carriers[0].shadowCarrierEvidence.independentlyMassCounted, false);
assert.equal(catalog.carriers[0].analyticalGeometryStatus, ANALYTICAL_GEOMETRY_STATUSES.COMPLETE);
assert.equal(catalog.carriers[0].massPropertiesStatus, MASS_PROPERTY_STATUSES.INCOMPLETE);
assert.equal(catalog.carriers[0].physicalMassCountEligible, false);
assert.equal(catalog.carriers[0].repairRecords.length, 1);
assert.equal(catalog.carriers[1].repairRecords.length, 1);
assert.equal(catalog.carriers[2].analyticalGeometryStatus, ANALYTICAL_GEOMETRY_STATUSES.PARTIAL);
assert.deepEqual(catalog.carriers[1].ports[0].sourcePosition, { x: 102, y: 0, z: 0 });
assert.deepEqual(catalog.carriers[1].ports[0].resolvedPosition, { x: 100, y: 0, z: 0 });
assert.equal(catalog.audit.completeAnalyticalGeometryCount, 2);
assert.equal(catalog.audit.partialAnalyticalGeometryCount, 1);
assert.equal(catalog.audit.massPropertiesCompleteCount, 0);
assert.equal(catalog.audit.massPropertiesIncompleteCount, 3);
assert.equal(catalog.audit.shadowCarrierAliasCount, 1);
assert.equal(catalog.audit.supportProjectionConsumed, false);
assert.throws(
  () => buildSequentialCarrierEvidenceCatalog({ schema: 'SequentialConstructionSession.v1' }),
  /ConfirmedSequentialConstruction\.v1/,
);
assert.throws(
  () => buildSequentialCarrierEvidenceCatalog({
    schema: 'ConfirmedSequentialConstruction.v1', constructionFingerprint: 'x',
    downstreamEligibility: { supportProjection: false },
  }),
  /accepted downstream eligibility/,
);

console.log('sequential carrier evidence adapter tests passed');

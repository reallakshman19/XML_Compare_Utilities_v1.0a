import assert from 'node:assert/strict';
import { projectCompareRecords } from '../tabs/revision-compare/revision-compare-projection.js';
import { stagedDocumentMetadata } from '../tabs/revision-compare/revision-document-metadata.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import { revisionBasisApprovalReadiness } from '../tabs/revision-compare/revision-compare-readiness.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { createRevisionScopeProposal } from '../tabs/revision-compare/revision-scope-proposal.js';

const NOW = '2026-07-30T05:30:00.000Z';
const PROFILE_ID = 'sequential-sketcher-source-array/mm-plant-z/v1';

function source(name, endX) {
  return [{
    name: '/ASIM-1885-10"-S8810101-91261M7-HC-01/B1',
    type: 'BRANCH',
    attributes: {
      NAME: '/ASIM-1885-10"-S8810101-91261M7-HC-01/B1',
      HPOS: { x: 0, y: 0, z: 0 },
      TPOS: { x: endX, y: 0, z: 0 },
      HREF: '/PREVIOUS',
      TREF: '/NEXT',
    },
    children: [{
      name,
      type: 'PIPE',
      attributes: {
        APOS: { x: 10, y: 20, z: 30 },
        LPOS: { x: endX, y: 40, z: 50 },
        ROUTE_TIER: 'BUILD_QUEUE_CONTINUITY',
        AUTO_GENERATED_PIPE: 'true',
      },
    }],
  }];
}

function envelope(branches) {
  return {
    schema: 'SequentialProjectExport.v2',
    stagedSchema: 'sequential-sketcher-source-array/v1',
    sourceSchema: 'SequentialBranchSketch.v1',
    unit: 'MM',
    coordinateFrame: 'PLANT',
    verticalAxis: 'Z',
    branches,
    constructionSession: { state: 'ROUTE_COMPLETE' },
    confirmedConstruction: { schema: 'ConfirmedSequentialConstruction.v1' },
    supportProjection: { schema: 'ConfirmedSequentialConstructionSupportProjection.v1' },
  };
}

const inferred = stagedDocumentMetadata(source('PIPE AUTO CONTINUITY CONT-TEST', 100));
assert.equal(inferred.stagedSchema, 'sequential-sketcher-source-array/v1');
assert.equal(inferred.unit, 'MM');
assert.equal(inferred.coordinateFrame, 'PLANT');
assert.equal(inferred.verticalAxis, 'Z');
assert.equal(inferred.profile.profileId, PROFILE_ID);
assert.equal(inferred.profile.authority, 'BOUNDED_PRODUCT_COMPATIBILITY_PROFILE');

const declared = stagedDocumentMetadata(envelope(source('PIPE AUTO CONTINUITY CONT-DECLARED', 100)));
assert.equal(declared.stagedSchema, 'sequential-sketcher-source-array/v1');
assert.equal(declared.unit, 'MM');
assert.equal(declared.coordinateFrame, 'PLANT');
assert.equal(declared.verticalAxis, 'Z');
assert.equal(declared.profile, null, 'producer declarations must not be relabeled as inferred profile evidence');

const unresolved = stagedDocumentMetadata([{ name: '/UNRECOGNIZED', children: [] }]);
assert.equal(unresolved.unit, 'UNKNOWN');
assert.equal(unresolved.coordinateFrame, 'UNKNOWN');
assert.equal(unresolved.verticalAxis, 'UNKNOWN');
assert.equal(unresolved.profile, null);

const request = {
  basisId: 'basis:sequential',
  side: 'A',
  sourceDocumentId: 'document:A',
  sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64),
  selectedBranchIds: ['branch:/ASIM-1885-10"-S8810101-91261M7-HC-01/B1'],
};
const projection = projectCompareRecords(source('PIPE AUTO CONTINUITY CONT-TEST', 100), request);
assert.equal(projection.records.length, 1);
assert.equal(projection.records[0].geometry.availability, 'AVAILABLE');
assert.equal(projection.records[0].geometry.family, 'APOS_LPOS');
assert.deepEqual(projection.records[0].geometry.points, [[10, 20, 30], [100, 40, 50]]);
assert.deepEqual(projection.records[0].visualPrimitive.start, [10, 20, 30]);
assert.deepEqual(projection.records[0].visualPrimitive.end, [100, 40, 50]);
assert.equal(projectCompareRecords(envelope(source('PIPE ENVELOPE', 100)), request).records.length, 1);

const pointsProjection = projectCompareRecords([{
  name: '/POINTS',
  type: 'BRANCH',
  children: [{
    name: 'OBJECT POINTS',
    type: 'PIPE',
    points: [{ x: 0, y: 1, z: 2 }, { x: 3, y: 4, z: 5 }, { x: 6, y: 7, z: 8 }],
  }],
}], {
  ...request,
  sourceDocumentId: 'document:points',
  selectedBranchIds: ['branch:/POINTS'],
});
assert.deepEqual(pointsProjection.records[0].geometry.points, [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
]);

const service = createRevisionLoadService(globalThis.crypto, {
  clientFactory: () => createInlineRevisionWorkerClient(),
});
const revA = await service.loadText('baseline', 'sequential-a.json', JSON.stringify(source('PIPE AUTO CONTINUITY CONT-A', 100)), NOW);
const revB = await service.loadText('candidate', 'sequential-b.json', JSON.stringify(envelope(source('PIPE AUTO CONTINUITY CONT-B', 110))), NOW);
for (const revision of [revA, revB]) {
  assert.equal(revision.document.stagedSchema, 'sequential-sketcher-source-array/v1');
  assert.equal(revision.document.unit, 'MM');
  assert.equal(revision.document.coordinateFrame, 'PLANT');
  assert.equal(revision.document.verticalAxis, 'Z');
  assert.equal(revision.warnings.some((warning) => warning.includes('not declared')), false);
}
assert.equal(revA.document.metadataEvidence.profileId, PROFILE_ID);
assert.equal(revA.document.metadataEvidence.sourceHash, revA.document.sourceHash);
assert.equal(revB.document.metadataEvidence, null);
const proposal = await createRevisionScopeProposal(revA, revB, {}, globalThis.crypto);
const preflight = revisionComparisonPreflight(revA, revB, proposal);
assert.equal(preflight.status, 'READY');
assert.equal(revisionBasisApprovalReadiness(preflight).status, 'READY');
for (const item of [
  preflight.compatibility.unitCompatibility,
  preflight.compatibility.coordinateFrameCompatibility,
  preflight.compatibility.verticalAxisCompatibility,
]) {
  assert.equal(item.status, 'COMPATIBLE');
  assert.equal(item.revAOrigin, 'PRODUCT_COMPATIBILITY_PROFILE');
  assert.equal(item.revBOrigin, 'SOURCE');
  assert.equal(item.revAProfileId, PROFILE_ID);
  assert.equal(item.revBProfileId, undefined);
}
assert(preflight.notes.every((note) => note.includes('bounded product-profile evidence')));
assert.equal(preflight.warnings.some((warning) => warning.includes('Staged schemas differ')), false);
service.dispose();

console.log('revision-compare-sequential-source-recovery: PASS');

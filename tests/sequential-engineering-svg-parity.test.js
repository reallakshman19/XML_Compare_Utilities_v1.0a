import assert from 'node:assert/strict';
import { buildSequentialEngineeringSvgScene } from '../tabs/sequential-sketcher/sequential-engineering-svg-scene.js';
import { validateSequentialEngineeringSvgParity } from '../tabs/sequential-sketcher/sequential-engineering-svg-parity-validation.js';
import {
  buildSequentialReversalSceneEntities,
  projectSequentialReversalCandidates,
} from '../tabs/sequential-sketcher/sequential-engineering-svg-reversal-scene.js';
import { _test as visualModelTest } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-visual-model.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  createSequentialConstructionSession,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import {
  adapterState,
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  rejectedSequentialFixture,
  repairedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function plainPoint(value) { return { x: value.x, y: value.y, z: value.z }; }
function geometryLedger(scene) {
  return scene.entities.map((entity) => ({ id: entity.id, geometry: entity.geometry }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
function reversalFixture() {
  const branchId = '/ESVG/REVERSE';
  const records = [{
    type: 'BRANCH', name: branchId,
    attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: { NAME: 'P1', APOS: { x: -1, y: 0, z: 0 }, LPOS: { x: 1, y: 0, z: 0 } },
    }],
  }];
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const initial = createSequentialConstructionSession(branchId);
  const result = advanceConstruction(initial, evidenceModel, indexes, {});
  assert.equal(result.session.currentDecisionRequest.reason, 'AMBIGUOUS_BRANCH_START');
  return { records, evidenceModel, indexes, initial, session: result.session };
}

const blocked = blockedSequentialFixture();
const builds = Object.fromEntries(['ISO', 'XY', 'XZ', 'YZ'].map((projection) => [
  projection,
  buildSequentialEngineeringSvgScene(adapterState(blocked, projection), {
    sceneId: 'ssk-blocked',
    visibleProjection: projection,
  }),
]));
const iso = builds.ISO;
for (const projection of ['XY', 'XZ', 'YZ']) {
  assert.deepEqual(
    geometryLedger(iso.scene),
    geometryLedger(builds[projection].scene),
    `${projection} projection must not alter engineering XYZ`,
  );
  assert.deepEqual(
    iso.scene.entities.map((entity) => entity.id),
    builds[projection].scene.entities.map((entity) => entity.id),
    `${projection} projection must not alter stable entity identity`,
  );
}
assert.equal(iso.scene.capabilities.editing, false);
assert.equal(iso.parity.confirmedComponentCount, 1);
assert.equal(iso.parity.confirmedGeometryCount, 1);
assert.equal(iso.parity.candidateCount, blocked.session.currentDecisionRequest.candidates.length);
assert.equal(iso.parity.reversalCandidateCount, 0);
assert.equal(iso.parity.activePortCount, 1);
assert.equal(iso.parity.mappedCountByCategory.candidate, iso.parity.candidateCount);
assert.equal(iso.parity.duplicateIds.length, 0);
assert.equal(iso.parity.invalidGeometry.length, 0);
assert.equal(iso.parity.unresolvedPorts.length, 0);
assert.equal(iso.parity.disconnectedConfirmedGeometry.length, 0);
assert.equal(iso.parity.propertySetCoverage.eligible, iso.parity.propertySetCoverage.mapped);
assert(iso.parity.omissions.some((row) => row.category === 'network'));

const confirmed = iso.scene.entities.filter((entity) => entity.layer === 'sequential-confirmed');
const candidates = iso.scene.entities.filter((entity) => entity.layer === 'sequential-candidate');
const active = iso.scene.entities.find((entity) => entity.layer === 'sequential-active-port');
assert(confirmed.every((entity) => entity.contributesToFit));
assert(candidates.every((entity) => !entity.contributesToFit));
assert(candidates.every((entity) => entity.metadata.sequential.status === 'NOT_CONFIRMED'));
assert.equal(active.domainRef.portId, blocked.session.activeExitPortId);
assert.equal(active.contributesToFit, false);
assert.deepEqual(plainPoint(active.geometry.position), blocked.indexes.ports.get(blocked.session.activeExitPortId).sourcePosition);

const reversed = reversalFixture();
const reversalBuilds = Object.fromEntries(['ISO', 'XY', 'XZ', 'YZ'].map((projection) => [
  projection,
  buildSequentialEngineeringSvgScene(adapterState(reversed, projection), {
    sceneId: 'ssk-reversal', visibleProjection: projection,
  }),
]));
const reversalIso = reversalBuilds.ISO;
const reversalRows = projectSequentialReversalCandidates(reversed.session, reversed.indexes);
assert.equal(reversalRows.length, 2);
assert.equal(reversalIso.parity.reversalCandidateCount, reversalRows.length);
assert.equal(reversalIso.parity.mappedCountByCategory.reversalCandidate, reversalRows.length);
validateSequentialEngineeringSvgParity(reversalIso.parity);
for (const projection of ['XY', 'XZ', 'YZ']) {
  assert.deepEqual(geometryLedger(reversalIso.scene), geometryLedger(reversalBuilds[projection].scene));
}
for (const candidate of reversalRows) {
  const entity = reversalIso.scene.entities.find((row) => row.id === `ssk:reversal:${candidate.candidateId}`);
  assert.ok(entity);
  assert.equal(entity.domainRef.category, 'reversalCandidate');
  assert.equal(entity.domainRef.componentId, candidate.componentId);
  assert.equal(entity.domainRef.sourceComponentId, candidate.sourceComponentId);
  assert.equal(entity.domainRef.branchId, candidate.branchId);
  assert.equal(entity.domainRef.entryPortId, candidate.entryPortId);
  assert.equal(entity.domainRef.portRole, candidate.portRole);
  assert.deepEqual(plainPoint(entity.domainRef.sourcePosition), plainPoint(candidate.sourcePosition));
  assert.deepEqual(plainPoint(entity.geometry.position), plainPoint(candidate.sourcePosition));
  assert.equal(entity.contributesToFit, false);
  assert.deepEqual(entity.editCapabilities, []);
  const marker = visualModelTest.marker(entity);
  assert.equal(marker.objectId, entity.id);
  assert.equal(marker.label, 'REVERSE ENTRY');
  assert.deepEqual(marker.position, [candidate.sourcePosition.x, candidate.sourcePosition.y, candidate.sourcePosition.z]);
}
const first = reversalRows[0];
const stalePort = { ...reversed.indexes.ports.get(first.entryPortId), role: 'STALE_ROLE' };
const staleIndexes = {
  ...reversed.indexes,
  components: new Map(reversed.indexes.components),
  ports: new Map(reversed.indexes.ports).set(first.entryPortId, stalePort),
};
assert.throws(
  () => projectSequentialReversalCandidates(reversed.session, staleIndexes),
  /differs from current indexed entry-port evidence/,
);
const omissions = [];
const missing = buildSequentialReversalSceneEntities({
  reversalCandidates: [{ ...first, sourcePosition: null }],
}, omissions);
assert.equal(missing.length, 0);
assert.deepEqual(omissions, [{
  category: 'reversalCandidate', id: first.candidateId,
  reason: 'REVERSAL_ENTRY_PORT_POSITION_MISSING',
}]);

const repaired = repairedSequentialFixture();
const repairedBuild = buildSequentialEngineeringSvgScene(adapterState(repaired), { sceneId: 'ssk-repaired' });
assert.equal(repairedBuild.parity.repairCount, 1);
assert.equal(repairedBuild.parity.mappedCountByCategory.repair, 1);
const repair = repairedBuild.scene.entities.find((entity) => entity.domainRef.category === 'repair');
assert.equal(repair.domainRef.repairId, repaired.session.repairLedger[0].repairId);
assert.equal(repair.metadata.sequential.repair.tolerancePolicyFingerprint, repaired.session.repairLedger[0].tolerancePolicyFingerprint);
const elbow = repairedBuild.scene.entities.find((entity) => entity.metadata.sequential.component?.canonicalType === 'ELBOW');
assert.equal(elbow.geometry.kind, 'polyline');
assert.deepEqual(elbow.geometry.points.map(plainPoint), [
  { x: 112, y: 0, z: 0 },
  { x: 100, y: 0, z: 0 },
  { x: 112, y: 100, z: 0 },
]);

const supported = confirmedSupportSequentialFixture();
const supportedBuild = buildSequentialEngineeringSvgScene(adapterState(supported), { sceneId: 'ssk-supported' });
assert.equal(supportedBuild.parity.supportCount, 1);
assert.equal(supportedBuild.parity.mappedCountByCategory.support, 1);
assert.equal(supportedBuild.parity.supportAttachmentsMissingCarrierEvidence.length, 0);
assert.equal(supportedBuild.parity.revisionConsistency.supportMatchesConfirmed, true);
const support = supportedBuild.scene.entities.find((entity) => entity.layer === 'sequential-support');
assert.equal(support.domainRef.carrierId, supported.confirmedConstruction.components[0].componentId);
assert.deepEqual(plainPoint(support.geometry.position), { x: 250, y: 0, z: 0 });

const rejected = rejectedSequentialFixture();
const rejectedBuild = buildSequentialEngineeringSvgScene(adapterState(rejected), { sceneId: 'ssk-rejected' });
assert.equal(rejectedBuild.parity.rejectedCandidateCount, 1);
assert.equal(rejectedBuild.parity.mappedCountByCategory.rejectedCandidate, 1);
const rejectedEntity = rejectedBuild.scene.entities.find((entity) => entity.domainRef.category === 'rejectedCandidate');
assert.equal(rejectedEntity.domainRef.candidateId, rejected.rejectedCandidate.candidateId);
assert.equal(rejectedEntity.metadata.sequential.decision.resolution.action, 'REJECT_CANDIDATE');
assert.equal(rejectedEntity.contributesToFit, false);

console.log('Sequential engineering SVG scene parity: ok');

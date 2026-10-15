import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSequentialEngineeringSvgAdapter } from '../tabs/sequential-sketcher/sequential-engineering-svg-adapter.js';
import {
  createSequentialEngineeringSvgProductionAdoptionDecision,
  SEQUENTIAL_ENGINEERING_SVG_PRODUCTION_ADOPTION_DECISION_SCHEMA,
} from '../tabs/sequential-sketcher/sequential-engineering-svg-production-readiness.js';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  adapterState,
  blockedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

const EVALUATED_MAIN_SHA = 'afa8388a4cead865fcafae856b8c629d88ab0162';

function assertDeepFrozen(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  Object.entries(value).forEach(([key, child]) => assertDeepFrozen(child, `${path}.${key}`));
}

function geometryLedger(scene) {
  return scene.entities.map((entity) => ({
    id: entity.id,
    geometry: entity.geometry,
    contributesToFit: entity.contributesToFit,
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function assertCurrentIndexesRemainMutable() {
  const indexes = indexSequentialEvidence(buildSequentialEvidenceModel([]));
  assert.equal(Object.isFrozen(indexes), true);
  assert.equal(indexes.components instanceof Map, true);
  indexes.components.set('probe-a', Object.freeze({ componentId: 'probe-a' }));
  assert.equal(indexes.components.has('probe-a'), true);
  assert.equal(indexes.components.delete('probe-a'), true);
  indexes.components.set('probe-b', Object.freeze({ componentId: 'probe-b' }));
  indexes.components.clear();
  assert.equal(indexes.components.size, 0);
}

const decision = createSequentialEngineeringSvgProductionAdoptionDecision(EVALUATED_MAIN_SHA);
const repeated = createSequentialEngineeringSvgProductionAdoptionDecision(EVALUATED_MAIN_SHA);
assert.equal(decision.schema, SEQUENTIAL_ENGINEERING_SVG_PRODUCTION_ADOPTION_DECISION_SCHEMA);
assert.deepEqual(repeated, decision);
assertDeepFrozen(decision);
assert.deepEqual(JSON.parse(JSON.stringify(decision)), decision);
assert.equal(decision.evaluatedMainSha, EVALUATED_MAIN_SHA);
assert.equal(decision.status, 'REVIEW_REQUIRED');
assert.equal(decision.recommendedArchitecture.option, 'A');
assert.equal(decision.recommendedArchitecture.defaultRenderer, 'existing-interactive-sequential-svg');
assert.equal(decision.recommendedArchitecture.visibleSurfaceRule, 'ONE_ACTIVE_VISUAL_SURFACE');
assert.deepEqual(decision.allowedProductionFiles, []);
assert.equal(decision.proposedNextMission, null);
assert.equal(decision.authoritativeOwners.length, 18);
assert.equal(decision.blockers.length, 4);
assert(decision.blockers.some((row) => row.code === 'PRODUCTION_OWNER_SUBSCRIPTION_MISSING'));
assert(decision.blockers.some((row) => row.code === 'BACKEND_SELECTION_MAPPING_NOT_IMPLEMENTED'));
assert(decision.blockers.some((row) => row.code === 'PRODUCTION_INDEX_IMMUTABILITY_UNDEFINED'));
assert.equal(decision.indexBoundary.currentOwnerShape, 'FROZEN_WRAPPER_WITH_MUTABLE_MAPS');
assert.equal(decision.indexBoundary.directMapPublicationAllowed, false);
assert.deepEqual(decision.indexBoundary.prohibitedOperationsForConsumers, ['set', 'delete', 'clear']);
assert(decision.reviewItems.some((row) => row.code === 'SEQUENTIAL_PACKAGE_SCRIPT_MISSING'));
assert.throws(
  () => createSequentialEngineeringSvgProductionAdoptionDecision('not-a-sha'),
  /40-character lowercase commit SHA/,
);
assertCurrentIndexesRemainMutable();

const fixture = blockedSequentialFixture();
const sessionBefore = JSON.stringify(fixture.session);
let current = adapterState(fixture, 'ISO');
const listeners = new Set();
const source = createSequentialEngineeringSvgAdapter({
  adapterId: 'ssk-readiness-adapter',
  sceneId: 'ssk-readiness-scene',
  getState: () => current,
  subscribeState(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
});
assert.equal(source.adapter.descriptor.accessMode, 'read-only');
assert.equal(source.adapter.commandGateway, null);
assert.equal('advanceConstruction' in source, false);
assert.equal('applyConstructionDecision' in source, false);

const isoScene = await source.adapter.getScene();
const candidate = isoScene.entities.find((entity) => entity.domainRef.category === 'candidate');
assert(candidate, 'blocked fixture must publish at least one candidate entity');
assert.equal(candidate.id, `ssk:candidate:${candidate.domainRef.candidateId}`);
const propertySets = await source.adapter.propertyProvider.getPropertySets(
  [candidate.id],
  isoScene.revision,
);
assert.equal(propertySets.length, 1);
assert.equal(propertySets[0].ownerIds[0], candidate.id);
assert(propertySets[0].fields.every((field) => field.editable === false));
assert.equal(JSON.stringify(fixture.session), sessionBefore, 'read-only selection must not mutate construction');

const events = [];
const unsubscribe = source.adapter.subscribeScene((event) => events.push(event));
current = adapterState(fixture, 'XZ');
listeners.forEach((listener) => listener({
  state: current,
  visibleProjection: 'XZ',
  reason: 'presentation-projection-change',
}));
assert.equal(events.length, 1);
assert.equal(events[0].reason, 'presentation-projection-change');
assert.deepEqual(geometryLedger(events[0].scene), geometryLedger(isoScene));
assert.equal(JSON.stringify(fixture.session), sessionBefore, 'projection must not mutate construction');
unsubscribe();
assert.equal(listeners.size, 0);

mkdirSync('artifacts/sequential-engineering-svg-production-readiness', { recursive: true });
writeFileSync(
  'artifacts/sequential-engineering-svg-production-readiness/decision.json',
  `${JSON.stringify(decision, null, 2)}\n`,
);
console.log(`SSK_ESVG_PRODUCTION_READINESS ${decision.status} ${decision.recommendedArchitecture.option}`);
console.log('Sequential Engineering SVG production adoption decision contract: ok');

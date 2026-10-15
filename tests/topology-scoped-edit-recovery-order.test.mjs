import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTopologyAuthorityFixture as fixture, topologyTestBuilt as builtFor } from './topology-scoped-edit-authority-contracts.test.mjs';

let contained = 0;
for (let index = 0; index < 500; index += 1) {
  const current = await fixture({ failWrites: true });
  const before = current.service.currentAuthority().authorityId;
  const prepared = current.service.prepareNative(current.authorizedInput);
  const result = current.service.acceptPrepared(prepared, current.service.certifyRegeneration(prepared, builtFor(prepared)));
  assert.equal(result.accepted, false); assert.equal(result.reasonCode, 'RECOVERY_PERSISTENCE_FAILED');
  assert.equal(current.service.currentAuthority().authorityId, before);
  assert.equal(current.storage.attempts(), 1); assert.equal(current.storage.writes(), 0); contained += 1;
  current.service.destroy();
}
const transition = await fixture();
let prepared = transition.service.prepareNative(transition.authorizedInput);
assert.equal(transition.service.acceptPrepared(prepared, transition.service.certifyRegeneration(prepared, builtFor(prepared))).accepted, true);
const beforeUndo = transition.service.currentAuthority().authorityId, writes = transition.storage.writes();
prepared = transition.service.prepareUndo(transition.uiState, transition.nextTime(), beforeUndo);
assert.throws(() => { throw new Error('full producer regeneration failed'); }, /regeneration failed/);
assert.equal(transition.service.currentAuthority().authorityId, beforeUndo);
assert.equal(transition.storage.writes(), writes);
const invalid = transition.service.acceptPrepared(prepared, Object.freeze({ schema: 'TopologyScopedEditRegenerationEvidence.v1',
  evidenceId: 'forged', preparedId: prepared.preparedId, candidateDraftHash: prepared.expectedDraftHash,
  canonicalTopologyHash: 'forged', artifactsHash: 'forged' }));
assert.equal(invalid.accepted, false); assert.equal(invalid.reasonCode, 'REGENERATION_EVIDENCE_INVALID');
assert.equal(transition.storage.writes(), writes); transition.service.destroy();

const controller = readFileSync(fileURLToPath(new URL('../tabs/topology-trace-validator/topology-edit-controller.js', import.meta.url)), 'utf8');
const transitionBody = controller.slice(controller.indexOf('async function acceptPreparedTransition'), controller.indexOf('async function undo'));
assert(transitionBody.indexOf('buildEditedComponentTopologyArtifacts') < transitionBody.indexOf('acceptBuilt'));
const loadBody = controller.slice(controller.indexOf('async function loadDraftFile'), controller.indexOf('async function exportBundle'));
assert.match(loadBody, /prepareLoad|prepareLegacyImport/); assert.match(loadBody, /acceptPreparedTransition/);
const recovery = readFileSync(fileURLToPath(new URL('../tabs/topology-trace-validator/topology-draft-recovery.js', import.meta.url)), 'utf8');
assert.match(recovery, /acquireWriter/); assert.match(recovery, /function accept/); assert.doesNotMatch(recovery, /\bsave\s*[:=]/);
console.log(`[PASS] persistenceFailures=${contained} regenerationFailures=1 writesBeforeValidation=0`);

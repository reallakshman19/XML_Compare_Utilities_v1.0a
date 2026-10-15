import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';

const branchId = '/SUPPORT/B1';
const records = [{
  type: 'BRANCH',
  name: branchId,
  attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } },
  children: [
    { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } } },
    { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1/DATUM', TYPE: 'ATTA', OWNER: branchId, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'REST' } },
    { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1.1', TYPE: 'ATTA', OWNER: branchId, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'SH-100', DTXR: 'PIPE SHOE' } },
    { type: 'CAP', name: 'C1', attributes: { NAME: 'C1', APOS: { x: 1000, y: 0, z: 0 } } },
  ],
}];

const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const initial = createSequentialConstructionSession(branchId);
assert.throws(
  () => buildConfirmedConstructionSupportProjection(initial, indexes),
  /ConfirmedSequentialConstruction\.v1/,
);
const result = runConstructionUntilBlocked(initial, evidence, indexes, {});
const confirmed = createConfirmedSequentialConstruction(result.session, indexes);
const original = JSON.stringify(confirmed);
const supportProjection = buildConfirmedConstructionSupportProjection(confirmed, indexes, {});

assert.equal(JSON.stringify(confirmed), original, 'support projection must not mutate confirmed construction');
assert.equal(supportProjection.schema, 'SequentialConfirmedSupportProjection.v1');
assert.equal(supportProjection.constructionFingerprint, confirmed.constructionFingerprint);
assert.equal(supportProjection.branchBundles.length, 1);
assert.equal(supportProjection.supportGlyphs.length, 1);
assert.equal(supportProjection.unresolvedSupportFamilies.length, 0);
assert.equal(supportProjection.supportGlyphs[0].label, 'PS-1');
assert.equal(supportProjection.supportGlyphs[0].carrierStationMm, 250);
assert.equal(supportProjection.audit.constructionMutated, false);

console.log('sequential confirmed support projection tests passed');

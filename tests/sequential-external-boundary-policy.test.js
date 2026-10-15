import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import {
  classifySequentialBoundaryReference,
} from '../tabs/sequential-sketcher/construction/sequential-boundary-reference-classifier.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import {
  SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY,
  matchSequentialExternalBoundaryPolicy,
  validateSequentialExternalBoundaryPolicy,
} from '../tabs/sequential-sketcher/policy/sequential-external-boundary-policy.js';

const policy = SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY;
assert.equal(policy.schema, 'SequentialExternalBoundaryPolicy.v1');
assert.equal(policy.policyId, 'AVEVA_1885_NC_EXTERNAL_BOUNDARY');
assert.equal(policy.revision, 1);
assert.equal(policy.sourceDialect, 'AVEVA_1885_NC');
assert.equal(Object.isFrozen(policy), true);
assert.equal(Object.isFrozen(policy.patterns), true);
assert.equal(validateSequentialExternalBoundaryPolicy(policy).valid, true);

const fingerprintInput = {
  schema: policy.schema,
  policyId: policy.policyId,
  revision: policy.revision,
  sourceDialect: policy.sourceDialect,
  classificationSchema: policy.classificationSchema,
  patterns: policy.patterns,
};
assert.equal(policy.policyFingerprint, stableToken(JSON.stringify(fingerprintInput)));
assert.equal(new Set(policy.patterns.map((row) => row.patternId)).size, policy.patterns.length);

for (const [reference, patternId, status] of [
  ['/A-881154-T-88029', 'CONTROLLED_DASH_NOZZLE_REFERENCE', 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED'],
  ['/A-881149/PURGE_CONNECTION', 'CONTROLLED_NAMED_CONNECTION_REFERENCE', 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED'],
  ['/S-801028A/B/OUTLET', 'DIRECTIONAL_EQUIPMENT_PORT', 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED'],
  ['/A-123456/GENERAL', 'EQUIPMENT_REFERENCE_SHAPE', 'EXTERNAL_REFERENCE_CLASSIFIED'],
]) {
  const match = matchSequentialExternalBoundaryPolicy(reference);
  assert.equal(match.patternId, patternId, reference);
  assert.equal(match.status, status, reference);
  const classified = classifySequentialBoundaryReference(reference, 'TAIL');
  assert.equal(classified.patternId, patternId, reference);
  assert.equal(classified.policySchema, policy.schema);
  assert.equal(classified.policyId, policy.policyId);
  assert.equal(classified.policyRevision, policy.revision);
  assert.equal(classified.policyFingerprint, policy.policyFingerprint);
}
assert.equal(matchSequentialExternalBoundaryPolicy('/S-123456/B/INLET/CHILD'), null);

const root = '/SOURCE/POLICY';
const records = [{
  type: 'BRANCH',
  name: root,
  attributes: {
    NAME: root,
    HPOS: { x: 0, y: 0, z: 0 },
    TPOS: { x: 100, y: 0, z: 0 },
    TREF: '/A-881149-TP-04',
  },
  children: [{
    type: 'PIPE',
    name: 'P1',
    attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } },
  }],
}];
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const result = runConstructionUntilBlocked(createSequentialConstructionSession(root), evidence, indexes, {});
assert.equal(result.session.state, 'ROUTE_COMPLETE');
const classification = result.session.boundaryClassifications[0];
assert.equal(classification.patternId, 'CONTROLLED_DASH_NOZZLE_REFERENCE');
assert.equal(classification.policySchema, policy.schema);
assert.equal(classification.policyId, policy.policyId);
assert.equal(classification.policyRevision, policy.revision);
assert.equal(classification.policyFingerprint, policy.policyFingerprint);
assert.equal(result.session.strokeLedger.at(-1).policyFingerprint, policy.policyFingerprint);

const originalFingerprint = sequentialSessionFingerprint(result.session);
const alteredSession = {
  ...result.session,
  boundaryClassifications: result.session.boundaryClassifications.map((row, index) => (
    index === 0 ? { ...row, policyFingerprint: 'different-policy' } : row
  )),
};
assert.notEqual(sequentialSessionFingerprint(alteredSession), originalFingerprint);

console.log('sequential external boundary policy tests passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiWriter2SourceSetPreviewWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import {
  CII_METHOD_A_WEIGHT_DEFAULTS, validateCiiMethodAConfidenceWeights,
} from '../tabs/cii-workspace/cii-workspace-method-a-weights.js';
import {
  ciiForensicSelectedBaseEvidence, ciiForensicRowObservations,
} from './cii-workspace-method-a-forensic-selection.js';

// This is a full retained, TEST-ONLY diagnostic: the benchmark's physical
// source/target identities remain hypotheses until engine evidence qualifies.
// Custom weight settings must not auto-approve Writer2 mutations, override
// custody vetoes or silently treat 11 report slots as 11 emitted matches.
const sha = Object.freeze({
  'S1.CII': '9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b',
  'S2.CII': '7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd',
  'S3.CII': 'c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa',
  'T.CII': 'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060',
});
const pairs = Object.freeze([
  ['S1', '4410', '970', 'HIGH'], ['S1', '4440', '975', 'HIGH'],
  ['S1', '4470', '980', 'HIGH'], ['S1', '4490', '985', 'HIGH'],
  ['S2', '360', '10280', 'HIGH'], ['S2', '370', '10290', 'HIGH'],
  ['S2', '390', '10300', 'HIGH'], ['S2', '400', '10310', 'HIGH'],
  ['S3', '1610', '8920', 'HIGH'], ['S3', '1620', '8940', 'HIGH'],
  ['S3', '1640', '8950', 'HIGH'],
]);
const fixture = (filename) => readFileSync(fileURLToPath(new URL('../Benchmark/' + filename, import.meta.url)));
for (const [filename, expected] of Object.entries(sha)) {
  assert.equal(createHash('sha256').update(fixture(filename)).digest('hex'), expected,
    'DO_NOT_TUNE_OR_CHANGE_ORIGINAL_FIXTURE:' + filename);
}
const sources = ['S1', 'S2', 'S3'].map((sourceId) => ({
  sourceId, fileName: sourceId + '.CII', bytes: fixture(sourceId + '.CII'),
}));
const targetBytes = fixture('T.CII');
const cryptoRef = globalThis.crypto || webcrypto;
const policies = Object.freeze([
  Object.freeze({ label: 'DEFAULT', methodAConfidenceWeights: CII_METHOD_A_WEIGHT_DEFAULTS }),
  Object.freeze({ label: 'TUNED_RESIDUAL_40_CONDITIONING_20',
    methodAConfidenceWeights: validateCiiMethodAConfidenceWeights({
      residualQuality: 40, conditioning: 20, spatialExtent: 20,
      redundancy: 10, basisConsensus: 10,
    }) }),
]);
const thresholds = Object.freeze({ methodAHighConfidenceThreshold: 85, methodAMediumConfidenceThreshold: 70 });
const pointTerms = ['residualQuality', 'conditioning', 'spatialExtent', 'redundancy', 'basisConsensus'];

async function oneRun(policy) {
  const options = { cryptoRef, ...thresholds, methodAConfidenceWeights: policy.methodAConfidenceWeights };
  const inspected = await inspectCiiWorkspaceSourceSetWithVersionBridge(
    { sources, targetBytes, targetFileName: 'T.CII' }, options,
  );
  assert.equal(inspected.memberInspections.length, 3, 'all original members must be inspected');
  const selectedLoops = {};
  const members = {};
  for (const member of inspected.memberInspections) {
    const suggestions = member.inspection?.baseAnchorSuggestions || [];
    const choice = ciiAutomaticBaseSelection(suggestions);
    const qualified = ciiForensicSelectedBaseEvidence(suggestions, choice);
    for (const base of qualified.filter((row) => row.method === 'METHOD_A_SPATIAL')) {
      assert.equal(base.evidenceStatus, 'READY', 'selected Method A base must have real provenance');
      assert(Number.isFinite(base.score), 'no fake or missing selected-base score');
      assert.deepEqual(base.weights, policy.methodAConfidenceWeights,
        'every source member must receive exact effective weight profile');
      assert(Math.abs(pointTerms.reduce((sum, key) => sum + Number(base.components[key] || 0), 0) - base.score) < 0.004,
        'five weighted component terms must close to score within rounding tolerance');
    }
    selectedLoops[member.sourceId] = choice.baseLoops || [];
    members[member.sourceId] = {
      automaticStatus: choice.status, reason: choice.reason,
      sourceNodeId: choice.sourceNodeId || null, targetNodeId: choice.targetNodeId || null,
      outcomeSignature: choice.outcomeSignature || null, evidenceTuple: choice.evidenceTuple || null,
      eligibleCandidates: choice.candidates?.length || 0,
      selectedBases: qualified,
    };
  }
  // A rejected / ambiguous automatic base must not be silently replaced by
  // manual or golden NODE IDs. It is a safe diagnostic, not a failed identity.
  const blocked = Object.entries(members).filter(([, member]) => member.automaticStatus !== 'READY')
    .map(([sourceId, member]) => ({ sourceId, reason: member.reason }));
  if (blocked.length) return {
    policy: policy.label, weights: policy.methodAConfidenceWeights, thresholds,
    inspectionStatus: inspected.status, previewStatus: 'NOT_RUN_NO_AUTOMATIC_BASE',
    blocked, members, observations: [], emitted: 0, bound: 0,
  };
  const preview = await createCiiWriter2SourceSetPreviewWithVersionBridge(
    { sources, targetBytes, targetFileName: 'T.CII', baseLoopsBySource: selectedLoops },
    options,
  );
  assert.deepEqual(preview.audit?.methodAConfidencePolicy, { high: 85, medium: 70 });
  assert.deepEqual(preview.audit?.methodAConfidenceWeights, policy.methodAConfidenceWeights);
  const audit = JSON.parse(preview.artifacts.auditJson);
  assert.deepEqual(audit.methodAConfidenceWeights, policy.methodAConfidenceWeights,
    'downloadable audit must retain exact weight profile');
  assert.equal(audit.target?.originalSha256 || preview.audit?.target?.originalSha256, sha['T.CII'],
    'preview must retain original target SHA identity');
  const observations = ciiForensicRowObservations(preview, pairs);
  assert.equal(observations.length, 11, '11 output slots are not 11 EMITTED matches');
  const emitted = observations.filter((row) => row.status === 'EMITTED').length;
  const bound = observations.filter((row) => row.review.some((item) => item.identityBound)).length;
  const unsafeGrades = observations.filter((row) => row.review.some((item) =>
    item.confidence === 'HIGH' && !item.identityBound));
  assert.deepEqual(unsafeGrades, [], 'unbound matching rows must not be advertised as HIGH');
  const conflicts = preview.correspondence?.conflicts || [];
  const ambiguous = preview.correspondence?.status === 'AMBIGUOUS' || conflicts.length > 0;
  // A tuned profile may legitimately lead to an ambiguous candidate; show
  // that outcome instead of throwing or accepting it as a qualified writer.
  if (ambiguous) {
    assert(preview.correspondence?.status !== 'READY',
      'conflicting correspondence must never be labelled READY');
  }
  return {
    policy: policy.label, weights: policy.methodAConfidenceWeights, thresholds,
    inspectionStatus: inspected.status,
    previewStatus: preview.correspondence?.status,
    blocked: ambiguous ? [{ reason: 'CROSS_LOOP_CORRESPONDENCE_AMBIGUOUS', conflictCount: conflicts.length }] : [],
    members, emitted, bound, observations,
  };
}

const results = [];
for (const policy of policies) results.push(await oneRun(policy));
const [baseline, tuned] = results;
const selectionDrifts = ['S1', 'S2', 'S3'].flatMap((sourceId) => {
  const left = baseline.members[sourceId], right = tuned.members[sourceId];
  if (left?.automaticStatus === right?.automaticStatus
    && left?.outcomeSignature === right?.outcomeSignature
    && left?.sourceNodeId === right?.sourceNodeId
    && left?.targetNodeId === right?.targetNodeId) return [];
  return [{ sourceId, default: left, tuned: right }];
});
const rowChanges = pairs.flatMap(([sourceId, sourceNodeId, targetNodeId]) => {
  const predicate = (x) => x.sourceId === sourceId && x.sourceNodeId === sourceNodeId && x.targetNodeId === targetNodeId;
  const a = baseline.observations.find(predicate), b = tuned.observations.find(predicate);
  const normalized = (x) => ({ status: x?.status || 'NOT_RUN', review: x?.review?.map((row) =>
    ({ confidence: row.confidence, identityBound: row.identityBound, authority: row.authority })) || [] });
  if (JSON.stringify(normalized(a)) === JSON.stringify(normalized(b))) return [];
  return [{ sourceId, sourceNodeId, targetNodeId, default: normalized(a), tuned: normalized(b) }];
});
const analysis = {
  schema: 'CiiRetainedMethodAWeightMatrix.v1', authority: 'FORENSIC_ONLY_NOT_OWNER_ACCEPTANCE',
  sourceSha256: sha, defaultWeights: policies[0].methodAConfidenceWeights,
  tunedWeights: policies[1].methodAConfidenceWeights,
  selectionDrifts, rowChanges,
  // A change of selected physical base is a manual engineering review signal.
  // This script does not re-label unsafe/ambiguous results as accepted.
  qualification: selectionDrifts.length ? 'REVIEW_REQUIRED_SELECTION_DRIFT' : 'NO_SELECTION_DRIFT_OBSERVED',
  results,
};
console.log(JSON.stringify(analysis, null, 2));

import assert from 'node:assert/strict';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  referenceNormalizationAudit,
  resolveSequentialReference,
} from '../tabs/sequential-sketcher/source/sequential-reference-resolver.js';

function indexes(records) {
  return indexSequentialEvidence(buildSequentialEvidenceModel(records));
}

{
  const evidenceIndexes = indexes([{
    type: 'BRANCH', name: '/Plant/Line/B1', attributes: { NAME: '/Plant/Line/B1' },
    children: [{ type: 'PIPE', name: 'P1', attributes: {
      NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
    } }],
  }]);
  const resolution = resolveSequentialReference('plant\\line//b1', evidenceIndexes);
  assert.equal(resolution.status, 'RESOLVED');
  assert.equal(resolution.kind, 'BRANCH');
  assert.equal(resolution.targetBranchId, '/Plant/Line/B1');
  assert.equal(resolution.resolutionBasis, 'UNIQUE_NORMALIZED_BRANCH_ID');
  assert.equal(resolution.rawReference, 'plant\\line//b1');
  assert.equal(resolution.normalizedReference, '/PLANT/LINE/B1');
  assert.deepEqual(resolution.normalizationOperations, [
    'BACKSLASH_TO_SLASH', 'COLLAPSE_REPEATED_SLASH', 'ADD_ROOT_SLASH', 'CASE_FOLD_UPPER',
  ]);
  assert.equal(resolveSequentialReference('/LINE/B1', evidenceIndexes).status, 'MISSING');
}

{
  const evidenceIndexes = indexes([{
    type: 'BRANCH', name: '/HOST', attributes: { NAME: '/HOST' },
    children: [{ type: 'OLET', name: 'O1', attributes: {
      NAME: 'O1', REF: '=Junction/One', POS: { x: 0, y: 0, z: 0 },
    } }],
  }]);
  const resolution = resolveSequentialReference('=junction/one', evidenceIndexes);
  assert.equal(resolution.status, 'RESOLVED');
  assert.equal(resolution.kind, 'JUNCTION_COMPONENT');
  assert.equal(resolution.targetSourceComponentId, 'O1');
  assert.equal(resolution.resolutionBasis, 'UNIQUE_NORMALIZED_COMPONENT_ALIAS');
}

{
  const evidenceIndexes = indexes([
    { type: 'BRANCH', name: '/Plant/A', attributes: { NAME: '/Plant/A' }, children: [] },
    { type: 'BRANCH', name: '\\plant\\a', attributes: { NAME: '\\plant\\a' }, children: [] },
  ]);
  const resolution = resolveSequentialReference('/plant//a', evidenceIndexes);
  assert.equal(resolution.status, 'AMBIGUOUS');
  assert.equal(resolution.kind, 'AMBIGUOUS');
  assert.equal(resolution.resolutionBasis, 'NORMALIZATION_COLLISION');
  assert.equal(resolution.matches.length, 2);
  const collisions = referenceNormalizationAudit(evidenceIndexes);
  assert.ok(collisions.some((row) => row.normalizedReference === '/PLANT/A' && row.targetCount === 2));
}

{
  const reference = '/EXACT/COLLISION';
  const evidenceIndexes = indexes([
    { type: 'BRANCH', name: reference, attributes: { NAME: reference }, children: [] },
    {
      type: 'BRANCH', name: '/HOST/COLLISION', attributes: { NAME: '/HOST/COLLISION' },
      children: [{ type: 'OLET', name: 'O-COLLISION', attributes: {
        NAME: 'O-COLLISION', REF: reference, POS: { x: 0, y: 0, z: 0 },
      } }],
    },
  ]);
  const resolution = resolveSequentialReference(reference, evidenceIndexes);
  assert.equal(resolution.status, 'AMBIGUOUS');
  assert.equal(resolution.resolutionBasis, 'EXACT_BRANCH_COMPONENT_COLLISION');
  assert.equal(resolution.matches.length, 2);
  assert.deepEqual(
    new Set(resolution.matches.map((row) => row.kind)),
    new Set(['BRANCH', 'JUNCTION_COMPONENT']),
  );
}

console.log('sequential reference normalization tests passed');

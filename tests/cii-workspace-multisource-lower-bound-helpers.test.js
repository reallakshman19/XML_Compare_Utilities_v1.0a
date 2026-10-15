import assert from 'node:assert/strict';
import {
  additionalTransferKeys,
  missingRequiredTransferKeys,
  physicalTransferKeys,
  selectedOperationDeltas,
} from './cii-workspace-multisource-lower-bound-helpers.js';

const selected = [
  {
    operationId: 'known-copy', action: 'COPY',
    targetEvidence: { identity: '10', value: 'OLD-10' },
    sourceEvidence: { value: 'NEW-10' }, before: 'OLD-10', proposed: 'NEW-10',
  },
  {
    operationId: 'known-create', action: 'CREATE',
    targetEvidence: { identity: '20', value: '' },
    sourceEvidence: { value: 'NEW-20' }, before: '', proposed: 'NEW-20',
  },
  {
    operationId: 'extra-copy', action: 'COPY',
    targetEvidence: { identity: '30', value: 'OLD-30' },
    sourceEvidence: { value: 'NEW-30' }, before: 'OLD-30', proposed: 'NEW-30',
  },
];

const actualKeys = physicalTransferKeys(selected);
const requiredKeys = ['COPY|10', 'CREATE|20'];
assert.deepEqual(actualKeys, ['COPY|10', 'CREATE|20', 'COPY|30'].sort());
assert.deepEqual(missingRequiredTransferKeys(actualKeys, requiredKeys), [], 'a qualified superset must satisfy the lower-bound key oracle');
assert.deepEqual(additionalTransferKeys(actualKeys, requiredKeys), ['COPY|30'], 'extra selected mutation must be reported, not rejected');
assert.deepEqual(missingRequiredTransferKeys(['COPY|10'], requiredKeys), ['CREATE|20'], 'missing required lower-bound mutation must remain blocking');

assert.deepEqual(selectedOperationDeltas(selected), [
  { nodeId: '10', action: 'REPLACE', oldValue: 'OLD-10', newValue: 'NEW-10', operationId: 'known-copy' },
  { nodeId: '20', action: 'CREATE', oldValue: '', newValue: 'NEW-20', operationId: 'known-create' },
  { nodeId: '30', action: 'REPLACE', oldValue: 'OLD-30', newValue: 'NEW-30', operationId: 'extra-copy' },
], 'byte-authority deltas must cover the full canonical selected operation set, including additional qualified mutations');

console.log('CII Writer2 lower-bound transfer helper checks: PASS');

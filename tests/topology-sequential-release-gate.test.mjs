import assert from 'node:assert/strict';

import { createTopologySequentialCapabilityMatrix } from '../tabs/topology-trace-validator/topology-sequential-capability-matrix.js';
import {
  assertTopologySequentialEditDraftParity,
  assertTopologyValidatorEditDraftPreserved,
  TOPOLOGY_SEQUENTIAL_RELEASE_REJECTION,
} from '../tabs/topology-trace-validator/topology-sequential-release-gate.js';

const matrix = createTopologySequentialCapabilityMatrix();

assert.throws(() => assertTopologyValidatorEditDraftPreserved(matrix),
  (error) => error.code === TOPOLOGY_SEQUENTIAL_RELEASE_REJECTION.VALIDATOR_PRESERVATION_BLOCKED
    && error.blockerCommandTypes.length === 9
    && error.blockerCommandTypes.includes('MERGE_NODES'));

assert.throws(() => assertTopologySequentialEditDraftParity(matrix),
  (error) => error.code === TOPOLOGY_SEQUENTIAL_RELEASE_REJECTION.SEQUENTIAL_PARITY_BLOCKED
    && error.blockerCommandTypes.length === matrix.entries.length
    && error.blockerCommandTypes.includes('ATTRIBUTE_EDIT'));

console.log('[PASS] Topology Validator preservation and Sequential parity claims fail closed');

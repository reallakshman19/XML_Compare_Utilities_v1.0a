/** Executable release gates for Topology Validator preservation and Sequential parity claims. */

import {
  assertTopologySequentialCapabilityMatrix,
  topologySequentialReleaseBlockers,
  TOPOLOGY_SEQUENTIAL_COVERAGE,
} from './topology-sequential-capability-matrix.js';

export const TOPOLOGY_SEQUENTIAL_RELEASE_REJECTION = Object.freeze({
  VALIDATOR_PRESERVATION_BLOCKED: 'TOPOLOGY_VALIDATOR_PRESERVATION_BLOCKED',
  SEQUENTIAL_PARITY_BLOCKED: 'TOPOLOGY_SEQUENTIAL_PARITY_BLOCKED',
});

function blockedRelease(code, label, blockers) {
  const blockerCommandTypes = Object.freeze(blockers.map((row) => row.commandType));
  const error = new RangeError(`${label} is blocked by: ${blockerCommandTypes.join(', ')}`);
  error.code = code;
  error.blockerCommandTypes = blockerCommandTypes;
  throw error;
}

export function assertTopologyValidatorEditDraftPreserved(matrixInput) {
  const matrix = assertTopologySequentialCapabilityMatrix(matrixInput);
  const blockers = topologySequentialReleaseBlockers(matrix);
  if (blockers.length) blockedRelease(
    TOPOLOGY_SEQUENTIAL_RELEASE_REJECTION.VALIDATOR_PRESERVATION_BLOCKED,
    'Topology Validator Edit Draft preservation', blockers);
  return matrix;
}

export function assertTopologySequentialEditDraftParity(matrixInput) {
  const matrix = assertTopologySequentialCapabilityMatrix(matrixInput);
  const blockers = matrix.entries.filter((row) => row.coverage !== TOPOLOGY_SEQUENTIAL_COVERAGE.FULL);
  if (blockers.length) blockedRelease(
    TOPOLOGY_SEQUENTIAL_RELEASE_REJECTION.SEQUENTIAL_PARITY_BLOCKED,
    'Sequential Edit Draft parity', blockers);
  return matrix;
}

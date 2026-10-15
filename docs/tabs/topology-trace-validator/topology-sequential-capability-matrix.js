/** Fail-closed capability mapping between Topology Validator Edit Draft and Sequential Draft Edit 3D. */

import { immutableJson } from '../../contracts/contract-values.js';
import { TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES } from './topology-scoped-edit-command-targets.js';
import { cleanText, semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_CAPABILITY_MATRIX_SCHEMA =
  'TopologySequentialCapabilityMatrix.v1';

export const TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION = Object.freeze({
  NATIVE_SEQUENTIAL_OPERATION: 'NATIVE_SEQUENTIAL_OPERATION',
  ADAPTED_SEQUENTIAL_OPERATION: 'ADAPTED_SEQUENTIAL_OPERATION',
  CONSTRUCTION_AUTHORITY_OPERATION: 'CONSTRUCTION_AUTHORITY_OPERATION',
  VALIDATOR_ONLY_OPERATION: 'VALIDATOR_ONLY_OPERATION',
  EXPLICITLY_UNSUPPORTED: 'EXPLICITLY_UNSUPPORTED',
});

export const TOPOLOGY_SEQUENTIAL_COVERAGE = Object.freeze({
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  PRESERVED_SEPARATELY: 'PRESERVED_SEPARATELY',
  MISSING: 'MISSING',
});

const EXTRA_EDIT_DRAFT_COMMANDS = Object.freeze(['ATTRIBUTE_EDIT', 'REMARK_SET']);
const REQUIRED_COMMANDS = Object.freeze([
  ...TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES,
  ...EXTRA_EDIT_DRAFT_COMMANDS,
].sort());
const DISPOSITIONS = new Set(Object.values(TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION));
const COVERAGE = new Set(Object.values(TOPOLOGY_SEQUENTIAL_COVERAGE));
const NON_BLOCKING_PRESERVATION = new Set([
  TOPOLOGY_SEQUENTIAL_COVERAGE.FULL,
  TOPOLOGY_SEQUENTIAL_COVERAGE.PRESERVED_SEPARATELY,
]);

const DEFAULT_ENTRIES = Object.freeze([
  ['MOVE_NODE', 'NATIVE', 'ADAPTED_SEQUENTIAL_OPERATION', 'PARTIAL',
    'SEQUENTIAL_DERIVED_GEOMETRY', ['STRETCH_NODE'], 'SSK-TTV-CONV-2',
    'Only qualified certified-node movement is covered; generic canonical-node edits require an adapter.'],
  ['MERGE_NODES', 'NATIVE', 'EXPLICITLY_UNSUPPORTED', 'MISSING',
    'UNASSIGNED', [], 'SSK-TTV-CONV-3',
    'Identity-changing node merge has no Sequential structural command.'],
  ['BRIDGE_GAP', 'NATIVE', 'EXPLICITLY_UNSUPPORTED', 'MISSING',
    'UNASSIGNED', [], 'SSK-TTV-CONV-4',
    'Explicit connection creation with engineering context is not implemented.'],
  ['ADD_STRAIGHT_ELEMENT', 'NATIVE', 'CONSTRUCTION_AUTHORITY_OPERATION', 'MISSING',
    'SEQUENTIAL_CONSTRUCTION', [], 'SSK-TTV-CONV-5',
    'New elements require construction ancestry and cannot be published as geometry overrides.'],
  ['SPLIT_EDGE', 'NATIVE', 'ADAPTED_SEQUENTIAL_OPERATION', 'PARTIAL',
    'SEQUENTIAL_STRUCTURAL_TOPOLOGY', ['SPLIT_PIPE'], 'SSK-TS-3Q',
    'The proposed adapter covers only one qualified straight PIPE segment.'],
  ['DISCONNECT_ENDPOINT', 'NATIVE', 'EXPLICITLY_UNSUPPORTED', 'MISSING',
    'UNASSIGNED', [], 'SSK-TTV-CONV-6',
    'Port, node, connection and boundary retirement semantics are not implemented.'],
  ['DELETE_EDGE', 'NATIVE', 'EXPLICITLY_UNSUPPORTED', 'MISSING',
    'UNASSIGNED', [], 'SSK-TTV-CONV-7',
    'Structural deletion and dependent support handling are not implemented.'],
  ['ADD_BEND_DEFINITION', 'NATIVE', 'VALIDATOR_ONLY_OPERATION', 'PRESERVED_SEPARATELY',
    'TOPOLOGY_VALIDATOR', [], 'COMPLETE',
    'Qualified immutable preservation evidence binds the active command, canonical bend, route arms and source ancestry; no Sequential operation is claimed.'],
  ['ADD_JUNCTION_DEFINITION', 'NATIVE', 'VALIDATOR_ONLY_OPERATION', 'PRESERVED_SEPARATELY',
    'TOPOLOGY_VALIDATOR', [], 'COMPLETE',
    'Qualified immutable preservation evidence binds the active command, canonical junction, complete route-arm set and source ancestry; no Sequential operation is claimed.'],
  ['TRIM_EDGE', 'NATIVE', 'ADAPTED_SEQUENTIAL_OPERATION', 'PARTIAL',
    'SEQUENTIAL_DERIVED_GEOMETRY', ['STRETCH_NODE'], 'SSK-TTV-CONV-10',
    'Only endpoint-bound straight geometry may map to node stretch.'],
  ['TRANSACTION', 'NATIVE', 'ADAPTED_SEQUENTIAL_OPERATION', 'PARTIAL',
    'SEQUENTIAL_COMPOSITE_EDIT', [], 'SSK-TS-3S',
    'Sequential lacks heterogeneous atomic transactions across geometry, topology and attributes.'],
  ['ATTRIBUTE_EDIT', 'ATTRIBUTE', 'VALIDATOR_ONLY_OPERATION', 'PRESERVED_SEPARATELY',
    'TOPOLOGY_VALIDATOR_ATTRIBUTE_LEDGER', [], 'SSK-TTV-CONV-11',
    'Attribute edits remain in the Validator ledger and staged-export authority.'],
  ['REMARK_SET', 'REMARK', 'VALIDATOR_ONLY_OPERATION', 'PRESERVED_SEPARATELY',
    'TOPOLOGY_VALIDATOR_COMMAND_JOURNAL', [], 'SSK-TTV-CONV-12',
    'Remarks remain bound to Validator commands, edits and entities.'],
]);

function requiredText(value, label) {
  const result = cleanText(value);
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function stringList(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return Object.freeze([...new Set(value.map((row) => requiredText(row, label)))].sort());
}

function entryFromTuple(tuple) {
  const [commandType, commandKind, disposition, coverage, authorityOwner,
    sequentialOperations, nextGate, limitation] = tuple;
  return { commandType, commandKind, disposition, coverage, authorityOwner,
    sequentialOperations, nextGate, limitation };
}

function normalizeEntry(input) {
  const commandType = requiredText(input.commandType, 'commandType').toUpperCase();
  const disposition = requiredText(input.disposition, `${commandType} disposition`).toUpperCase();
  const coverage = requiredText(input.coverage, `${commandType} coverage`).toUpperCase();
  if (!DISPOSITIONS.has(disposition)) throw new RangeError(`Unsupported ${commandType} disposition: ${disposition}`);
  if (!COVERAGE.has(coverage)) throw new RangeError(`Unsupported ${commandType} coverage: ${coverage}`);
  return Object.freeze({ commandType,
    commandKind: requiredText(input.commandKind, `${commandType} commandKind`).toUpperCase(),
    disposition, coverage,
    authorityOwner: requiredText(input.authorityOwner, `${commandType} authorityOwner`).toUpperCase(),
    sequentialOperations: stringList(input.sequentialOperations || [], `${commandType} sequential operation`),
    nextGate: requiredText(input.nextGate, `${commandType} nextGate`),
    limitation: requiredText(input.limitation, `${commandType} limitation`) });
}

function exactCommandCoverage(entries) {
  const commands = entries.map((row) => row.commandType).sort();
  if (new Set(commands).size !== commands.length) throw new RangeError('Capability matrix contains duplicate command types.');
  if (semanticStringify(commands) !== semanticStringify(REQUIRED_COMMANDS)) {
    throw new RangeError('Capability matrix must cover the complete current Topology Edit Draft command vocabulary.');
  }
}

function summary(entries) {
  const counts = Object.fromEntries(Object.values(TOPOLOGY_SEQUENTIAL_COVERAGE)
    .map((value) => [value, entries.filter((row) => row.coverage === value).length]));
  const blockers = entries.filter((row) => !NON_BLOCKING_PRESERVATION.has(row.coverage))
    .map((row) => row.commandType);
  return Object.freeze({ counts, blockerCommandTypes: Object.freeze(blockers.sort()),
    explicitCoverageReady: entries.length === REQUIRED_COMMANDS.length,
    validatorPreservationReady: blockers.length === 0,
    sequentialParityReady: entries.every((row) => row.coverage === TOPOLOGY_SEQUENTIAL_COVERAGE.FULL) });
}

export function createTopologySequentialCapabilityMatrix(input = {}) {
  const entries = (input.entries || DEFAULT_ENTRIES.map(entryFromTuple)).map(normalizeEntry)
    .sort((left, right) => left.commandType.localeCompare(right.commandType));
  exactCommandCoverage(entries);
  const material = { schema: TOPOLOGY_SEQUENTIAL_CAPABILITY_MATRIX_SCHEMA,
    sourceVocabulary: REQUIRED_COMMANDS, entries, summary: summary(entries) };
  return immutableJson({ ...material,
    matrixFingerprint: semanticHash(material) }, 'Topology Sequential capability matrix');
}

export function assertTopologySequentialCapabilityMatrix(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_CAPABILITY_MATRIX_SCHEMA) {
    throw new TypeError(`Capability matrix must use ${TOPOLOGY_SEQUENTIAL_CAPABILITY_MATRIX_SCHEMA}.`);
  }
  const rebuilt = createTopologySequentialCapabilityMatrix({ entries: value.entries });
  if (semanticStringify(rebuilt) !== semanticStringify(value)) {
    throw new RangeError('Capability matrix differs from canonical regeneration.');
  }
  return rebuilt;
}

export function topologySequentialCapability(matrixInput, commandTypeInput) {
  const matrix = assertTopologySequentialCapabilityMatrix(matrixInput);
  const commandType = requiredText(commandTypeInput, 'commandType').toUpperCase();
  const capability = matrix.entries.find((row) => row.commandType === commandType);
  if (!capability) throw new RangeError(`Topology Edit Draft command is not covered: ${commandType}`);
  return capability;
}

export function topologySequentialReleaseBlockers(matrixInput) {
  const matrix = assertTopologySequentialCapabilityMatrix(matrixInput);
  return Object.freeze(matrix.entries.filter((row) => (
    !NON_BLOCKING_PRESERVATION.has(row.coverage)
  )));
}

export const TOPOLOGY_SEQUENTIAL_REQUIRED_COMMANDS = REQUIRED_COMMANDS;

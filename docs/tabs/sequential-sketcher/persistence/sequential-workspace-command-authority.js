/** Durable Sequential accepted-command authority embedded in workspace package v2. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { createSequentialBranchWorkspaceRegistry } from '../sequential-branch-workspace-state.js';
import {
  createSequentialNativeCommand,
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from '../scoped-edit/sequential-command-contracts.js';
import {
  assertSequentialJournalAdoptionBasis,
  sequentialCommandJournalHeadFingerprint,
  validateSequentialCommandJournalState,
} from '../scoped-edit/sequential-command-journal.js';
import { sequentialBranchSetFingerprint } from '../scoped-edit/sequential-edit-authority.js';

export const SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_SCHEMA = 'SequentialWorkspaceCommandAuthority.v1';
export const SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION = 2;

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `: ${detail}` : ''}`);
}

function registryFromRestoration(branchIds, workspaces) {
  const registry = createSequentialBranchWorkspaceRegistry();
  registry.replace(branchIds, workspaces);
  return registry;
}

function validatedJournalState(value) {
  const errors = validateSequentialCommandJournalState(value);
  if (errors.length) fail('WORKSPACE_COMMAND_JOURNAL_INVALID', errors.join('; '));
  return value;
}

function reconstructedNativeCommand(payload, index) {
  try {
    return createSequentialNativeCommand(payload);
  } catch {
    fail('WORKSPACE_COMMAND_NATIVE_IDENTITY_INVALID', String(index));
  }
}

function validateJournalEntry(entry, sourceFingerprint, registry, index) {
  if (entry.basis?.documentHash !== sourceFingerprint) {
    fail('WORKSPACE_COMMAND_SOURCE_BASIS_MISMATCH', String(index));
  }
  const normalized = reconstructedNativeCommand(entry.payload, index);
  if (!sameSequentialContractValue(normalized, entry.payload)
    || entry.commandType !== normalized.commandType) {
    fail('WORKSPACE_COMMAND_NATIVE_IDENTITY_INVALID', String(index));
  }
  const snapshot = registry.get(normalized.branchId);
  if (!snapshot?.session) fail('WORKSPACE_COMMAND_BRANCH_UNKNOWN', normalized.branchId);
  if (entry.transactionId === null) return;
  const exists = snapshot.session.transactionLedger
    .some((transaction) => transaction.transactionId === entry.transactionId);
  if (!exists) fail('WORKSPACE_COMMAND_TRANSACTION_UNKNOWN', String(entry.transactionId));
}

function authorityMaterial(input, registry) {
  const journalState = validatedJournalState(input.journalState);
  const sourceFingerprint = requiredContractText(input.sourceFingerprint, 'workspace authority sourceFingerprint');
  assertSequentialJournalAdoptionBasis(journalState, sourceFingerprint, registry);
  journalState.journal.entries.forEach((entry, index) => validateJournalEntry(
    entry, sourceFingerprint, registry, index,
  ));
  return {
    schema: SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_SCHEMA,
    readerRevision: SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION,
    minimumReaderRevision: SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION,
    sourceFingerprint,
    adoptionBranchSetFingerprint: journalState.adoptionCheckpoint.branchSetFingerprint,
    currentBranchSetFingerprint: sequentialBranchSetFingerprint(registry),
    checkpointId: journalState.adoptionCheckpoint.checkpointId,
    journalHeadFingerprint: sequentialCommandJournalHeadFingerprint(journalState),
    journalState,
  };
}

export function createSequentialWorkspaceCommandAuthority(input = {}) {
  const registry = input.branchRegistry;
  if (!registry?.ids || !registry?.entries) fail('WORKSPACE_COMMAND_BRANCH_REGISTRY_REQUIRED');
  const material = authorityMaterial(input, registry);
  return immutableJson({
    ...material,
    authorityFingerprint: sequentialSemanticFingerprint('SWPKGAUTH', material),
  }, 'Sequential workspace command authority');
}

export function restoreSequentialWorkspaceCommandAuthority(value, context = {}) {
  if (value?.schema !== SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_SCHEMA) {
    fail('WORKSPACE_COMMAND_AUTHORITY_SCHEMA_INVALID');
  }
  if (value.readerRevision !== SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION
    || !Number.isSafeInteger(value.minimumReaderRevision)
    || value.minimumReaderRevision < 1
    || value.minimumReaderRevision > SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION) {
    fail('WORKSPACE_COMMAND_AUTHORITY_READER_UNSUPPORTED');
  }
  const registry = registryFromRestoration(context.branchIds, context.workspaces);
  const material = authorityMaterial({
    journalState: value.journalState,
    sourceFingerprint: context.sourceFingerprint,
  }, registry);
  for (const key of ['sourceFingerprint', 'adoptionBranchSetFingerprint',
    'currentBranchSetFingerprint', 'checkpointId', 'journalHeadFingerprint']) {
    if (value[key] !== material[key]) fail('WORKSPACE_COMMAND_AUTHORITY_EVIDENCE_MISMATCH', key);
  }
  const expected = sequentialSemanticFingerprint('SWPKGAUTH', material);
  if (value.authorityFingerprint !== expected) fail('WORKSPACE_COMMAND_AUTHORITY_FINGERPRINT_MISMATCH');
  return immutableJson({ ...material, authorityFingerprint: expected }, 'Restored Sequential workspace command authority');
}

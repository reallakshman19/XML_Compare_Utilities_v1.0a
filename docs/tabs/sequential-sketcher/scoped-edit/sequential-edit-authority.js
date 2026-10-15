/** Exact authority derivation for one Sequential branch and its workspace-global journal. */
import { sequentialSessionFingerprint } from '../construction/sequential-session-fingerprint.js';
import {
  SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES,
  createSequentialCommandScope,
  createSequentialEditAuthorityBasis,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import {
  assertSequentialJournalAdoptionBasis,
  sequentialCommandJournalHeadFingerprint,
} from './sequential-command-journal.js';

function text(value) { return String(value ?? '').trim(); }
function completeFingerprint(prefix, value, declared = '') {
  if (!value) return null;
  return sequentialSemanticFingerprint(prefix, {
    declaredFingerprint: text(declared) || null,
    value,
  });
}
function branchRow(entry) {
  const snapshot = entry.snapshot || {};
  const session = snapshot.session;
  return {
    branchId: entry.branchId,
    sessionFingerprint: session ? sequentialSessionFingerprint(session) : null,
    completeSessionFingerprint: session ? sequentialSemanticFingerprint('SBRANCHSESSION', session) : null,
    transactionHeadId: session?.transactionLedger?.at(-1)?.transactionId || null,
    undoHeadTransactionId: session?.undoStack?.at(-1)?.transactionId || null,
    redoHeadTransactionId: session?.redoStack?.at(-1)?.transactionId || null,
    confirmedConstructionFingerprint: completeFingerprint(
      'SCONFIRMED', snapshot.confirmedConstruction,
      snapshot.confirmedConstruction?.constructionFingerprint,
    ),
    supportProjectionFingerprint: completeFingerprint(
      'SSUPPORT', snapshot.supportProjection,
      snapshot.supportProjection?.constructionFingerprint,
    ),
    selectedCandidateId: text(snapshot.selectedCandidateId) || null,
  };
}

export function sequentialBranchSetFingerprint(branchRegistry) {
  const branchIds = branchRegistry?.ids?.();
  const entries = branchRegistry?.entries?.();
  if (!Array.isArray(branchIds) || !Array.isArray(entries)) {
    throw new TypeError('Sequential authority requires branch registry ids and entries.');
  }
  const material = {
    branchIds: [...branchIds].sort((left, right) => left.localeCompare(right)),
    entries: entries.map(branchRow).sort((left, right) => left.branchId.localeCompare(right.branchId)),
  };
  return sequentialSemanticFingerprint('SBRANCHSET', material);
}

export function sequentialOwnerRevisionFingerprint(ownerSnapshot) {
  if (!ownerSnapshot?.revision) throw new TypeError('Sequential authority requires a current owner revision token.');
  return sequentialSemanticFingerprint('SOWNER', ownerSnapshot.revision);
}

export function deriveSequentialEditAuthority(input = {}) {
  const session = input.session;
  if (session?.schema !== 'SequentialConstructionSession.v1') {
    throw new TypeError('Sequential authority requires SequentialConstructionSession.v1.');
  }
  assertSequentialJournalAdoptionBasis(
    input.journalState,
    input.sourceFingerprint,
    input.branchRegistry,
  );
  const transactionHead = session.transactionLedger?.at(-1) || null;
  const undoHead = session.undoStack?.at(-1) || null;
  const redoHead = session.redoStack?.at(-1) || null;
  return createSequentialEditAuthorityBasis({
    sourceFingerprint: input.sourceFingerprint,
    branchId: session.rootBranchId,
    branchSetFingerprint: sequentialBranchSetFingerprint(input.branchRegistry),
    sessionFingerprint: sequentialSessionFingerprint(session),
    completeSessionFingerprint: sequentialSemanticFingerprint('SSESSION', session),
    journalHeadFingerprint: sequentialCommandJournalHeadFingerprint(input.journalState),
    transactionHeadId: transactionHead?.transactionId || null,
    undoHeadTransactionId: undoHead?.transactionId || null,
    redoHeadTransactionId: redoHead?.transactionId || null,
    confirmedConstructionFingerprint: completeFingerprint(
      'SCONFIRMED', input.confirmedConstruction,
      input.confirmedConstruction?.constructionFingerprint,
    ),
    supportProjectionFingerprint: completeFingerprint(
      'SSUPPORT', input.supportProjection,
      input.supportProjection?.constructionFingerprint,
    ),
    ownerRevisionFingerprint: sequentialOwnerRevisionFingerprint(input.ownerSnapshot),
    currentDecisionId: session.currentDecisionRequest?.decisionId || null,
  });
}

export function deriveSequentialCommandScope(input = {}) {
  const authority = input.authority || deriveSequentialEditAuthority(input);
  return createSequentialCommandScope({
    branchId: authority.branchId,
    authorityId: authority.authorityId,
    allowedCommandTypes: SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES,
    currentDecisionId: authority.currentDecisionId,
  });
}

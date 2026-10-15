/** Deterministic prepare/accept service for branch-local support-adjustment undo and redo. */
import {
  immutableJson,
  isIsoTimestamp,
  requiredContractText,
} from '../../../contracts/contract-values.js';
import {
  applySequentialSupportAdjustmentRegister,
  sequentialSupportProjectionFingerprint,
} from '../support/sequential-support-adjusted-projection.js';
import {
  assertSequentialSupportAdjustmentHistory,
  SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_ACTIONS,
  transitionSequentialSupportAdjustmentHistory,
} from '../support/sequential-support-adjustment-history.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';

export const SEQUENTIAL_PREPARED_SUPPORT_HISTORY_SCHEMA =
  'SequentialPreparedSupportAdjustmentHistory.v1';
export const SEQUENTIAL_PREPARED_SUPPORT_HISTORY_CANDIDATE_SCHEMA =
  'SequentialPreparedSupportAdjustmentHistoryCandidate.v1';
export const SEQUENTIAL_SUPPORT_HISTORY_ACCEPTANCE_SCHEMA =
  'SequentialSupportAdjustmentHistoryAcceptance.v1';
export const SEQUENTIAL_SUPPORT_HISTORY_REJECTION = Object.freeze({
  INPUT_INVALID: 'SUPPORT_HISTORY_INPUT_INVALID',
  AUTHORITY_STALE: 'SUPPORT_HISTORY_AUTHORITY_STALE',
  HISTORY_STALE: 'SUPPORT_HISTORY_STALE',
  PREPARED_INVALID: 'SUPPORT_HISTORY_PREPARED_INVALID',
  PUBLICATION_FAILED: 'SUPPORT_HISTORY_PUBLICATION_FAILED',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Support history clock must return an exact ISO timestamp.');
  return value;
}
function action(value) {
  const result = requiredContractText(value, 'support history action').toUpperCase();
  if (!SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_ACTIONS.includes(result)) {
    fail(SEQUENTIAL_SUPPORT_HISTORY_REJECTION.INPUT_INVALID,
      `Unsupported support history action: ${result}`, TypeError);
  }
  return result;
}
function provenance(input = {}, issuedAt) {
  return immutableJson({
    actorId: requiredContractText(input.actorId, 'support history actorId'),
    reason: requiredContractText(input.reason, 'support history reason'),
    evidenceNote: requiredContractText(input.evidenceNote, 'support history evidenceNote'),
    issuedAt,
  }, 'Sequential support history provenance');
}
function preparedMaterial(expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_SUPPORT_HISTORY_SCHEMA, expectedAuthority, candidate };
}
function preparedValue(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_SUPPORT_HISTORY_SCHEMA) {
    fail(SEQUENTIAL_SUPPORT_HISTORY_REJECTION.PREPARED_INVALID,
      `Prepared support history must use ${SEQUENTIAL_PREPARED_SUPPORT_HISTORY_SCHEMA}.`, TypeError);
  }
  const material = preparedMaterial(value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSUPPORTHISTORYPREP', material)) {
    fail(SEQUENTIAL_SUPPORT_HISTORY_REJECTION.PREPARED_INVALID,
      'Prepared support history differs from canonical fingerprint regeneration.');
  }
  return value;
}
function buildPrepared(input, issuedAt, state, historyValue) {
  const normalizedAction = action(input.action);
  const expectedAuthority = deriveSequentialEditAuthority(state);
  const base = state.baseSupportProjection;
  if (base?.schema !== 'SequentialConfirmedSupportProjection.v1') {
    fail(SEQUENTIAL_SUPPORT_HISTORY_REJECTION.HISTORY_STALE,
      'Support history requires an immutable base support projection.');
  }
  const baseProjectionFingerprint = sequentialSupportProjectionFingerprint(base);
  const history = assertSequentialSupportAdjustmentHistory(historyValue, {
    constructionFingerprint: base.constructionFingerprint,
    baseProjectionFingerprint,
  });
  const transition = transitionSequentialSupportAdjustmentHistory(history, normalizedAction);
  const supportProjection = applySequentialSupportAdjustmentRegister(
    base,
    transition.history.currentRegister,
  );
  const candidate = immutableJson({
    schema: SEQUENTIAL_PREPARED_SUPPORT_HISTORY_CANDIDATE_SCHEMA,
    action: normalizedAction,
    expectedBaseProjectionFingerprint: baseProjectionFingerprint,
    expectedHistoryFingerprint: history.historyFingerprint,
    expectedCurrentRegisterHeadFingerprint: history.currentRegister.headFingerprint,
    history: transition.history,
    supportProjection,
    affectedEntry: transition.affectedEntry,
    provenance: provenance(input, issuedAt),
  }, 'Sequential prepared support history candidate');
  const material = preparedMaterial(expectedAuthority, candidate);
  return immutableJson({
    ...material,
    preparedId: sequentialSemanticFingerprint('SSUPPORTHISTORYPREP', material),
  }, 'Sequential prepared support history');
}

export function createSequentialSupportAdjustmentHistoryService(options = {}) {
  const readCurrentState = requiredFunction(options.readCurrentState, 'readCurrentState');
  const readHistory = requiredFunction(options.readHistory, 'readHistory');
  const publishHistoryCandidate = requiredFunction(
    options.publishHistoryCandidate,
    'publishHistoryCandidate',
  );
  const now = requiredFunction(options.now, 'now');

  function prepare(input = {}) {
    return buildPrepared(input, exactNow(now), readCurrentState(), readHistory());
  }
  function accept(preparedInput) {
    const prepared = preparedValue(preparedInput);
    const state = readCurrentState();
    const currentAuthority = deriveSequentialEditAuthority(state);
    if (!sameSequentialContractValue(currentAuthority, prepared.expectedAuthority)) {
      return immutableJson({
        schema: SEQUENTIAL_SUPPORT_HISTORY_ACCEPTANCE_SCHEMA,
        accepted: false,
        reasonCode: SEQUENTIAL_SUPPORT_HISTORY_REJECTION.AUTHORITY_STALE,
        preparedId: prepared.preparedId,
        expectedAuthorityId: prepared.expectedAuthority.authorityId,
        currentAuthorityId: currentAuthority.authorityId,
        publicationState: 'NOT_PUBLISHED',
        publication: null,
      }, 'Sequential support history acceptance');
    }
    const candidate = prepared.candidate;
    const rebuilt = buildPrepared({
      action: candidate.action,
      actorId: candidate.provenance.actorId,
      reason: candidate.provenance.reason,
      evidenceNote: candidate.provenance.evidenceNote,
    }, candidate.provenance.issuedAt, state, readHistory());
    if (!sameSequentialContractValue(rebuilt, prepared)) {
      fail(SEQUENTIAL_SUPPORT_HISTORY_REJECTION.PREPARED_INVALID,
        'Prepared support history differs from independent current-state regeneration.');
    }
    try {
      const publication = publishHistoryCandidate({
        preparedId: prepared.preparedId,
        expectedAuthority: prepared.expectedAuthority,
        candidate,
      });
      return immutableJson({
        schema: SEQUENTIAL_SUPPORT_HISTORY_ACCEPTANCE_SCHEMA,
        accepted: true,
        reasonCode: null,
        preparedId: prepared.preparedId,
        expectedAuthorityId: prepared.expectedAuthority.authorityId,
        currentAuthorityId: currentAuthority.authorityId,
        publicationState: 'COMMITTED',
        publication,
      }, 'Sequential support history acceptance');
    } catch (error) {
      fail(SEQUENTIAL_SUPPORT_HISTORY_REJECTION.PUBLICATION_FAILED,
        error?.message || String(error), Error);
    }
  }
  return Object.freeze({
    schema: 'SequentialSupportAdjustmentHistoryService.v1',
    prepare,
    accept,
  });
}

export const _test = Object.freeze({ buildPrepared, preparedValue, action, provenance });

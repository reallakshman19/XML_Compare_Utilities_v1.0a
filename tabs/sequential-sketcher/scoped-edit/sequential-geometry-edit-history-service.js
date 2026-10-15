/** Deterministic prepare/accept service for branch-local geometry undo and redo. */
import { immutableJson, isIsoTimestamp, requiredContractText } from '../../../contracts/contract-values.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import {
  assertSequentialGeometryEditHistory,
  SEQUENTIAL_GEOMETRY_EDIT_HISTORY_ACTIONS,
  transitionSequentialGeometryEditHistory,
} from './sequential-geometry-edit-history.js';

export const SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_SCHEMA =
  'SequentialPreparedGeometryEditHistory.v1';
export const SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_CANDIDATE_SCHEMA =
  'SequentialPreparedGeometryEditHistoryCandidate.v1';
export const SEQUENTIAL_GEOMETRY_HISTORY_ACCEPTANCE_SCHEMA =
  'SequentialGeometryEditHistoryAcceptance.v1';

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Geometry history clock must return an exact ISO timestamp.');
  return value;
}
function action(value) {
  const result = requiredContractText(value, 'geometry history action').toUpperCase();
  if (!SEQUENTIAL_GEOMETRY_EDIT_HISTORY_ACTIONS.includes(result)) {
    fail('GEOMETRY_HISTORY_INPUT_INVALID', `Unsupported geometry history action: ${result}`, TypeError);
  }
  return result;
}
function provenance(input, issuedAt) {
  return immutableJson({
    actorId: requiredContractText(input.actorId, 'geometry history actorId'),
    reason: requiredContractText(input.reason, 'geometry history reason'),
    evidenceNote: requiredContractText(input.evidenceNote, 'geometry history evidenceNote'),
    issuedAt,
  }, 'Sequential geometry history provenance');
}
function preparedMaterial(expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_SCHEMA, expectedAuthority, candidate };
}
function preparedValue(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_SCHEMA) {
    fail('GEOMETRY_HISTORY_PREPARED_INVALID',
      `Prepared geometry history must use ${SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_SCHEMA}.`, TypeError);
  }
  const material = preparedMaterial(value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSKGEOMETRYHISTORYPREP', material)) {
    fail('GEOMETRY_HISTORY_PREPARED_INVALID',
      'Prepared geometry history differs from canonical fingerprint regeneration.');
  }
  return value;
}
function buildPrepared(input, issuedAt, state, historyValue) {
  const history = assertSequentialGeometryEditHistory(historyValue);
  const transition = transitionSequentialGeometryEditHistory(history, action(input.action));
  const expectedAuthority = deriveSequentialEditAuthority(state);
  const candidate = immutableJson({
    schema: SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_CANDIDATE_SCHEMA,
    action: transition.action,
    expectedBranchId: history.branchId,
    expectedConstructionFingerprint: history.confirmedConstructionFingerprint,
    expectedBaseFingerprint: history.baseFingerprint,
    expectedHistoryFingerprint: history.historyFingerprint,
    expectedCursor: history.cursor,
    expectedActiveHeadFingerprint: history.activeHeadFingerprint,
    history: transition.history,
    affectedEntry: transition.affectedEntry,
    provenance: provenance(input, issuedAt),
  }, 'Sequential prepared geometry history candidate');
  const material = preparedMaterial(expectedAuthority, candidate);
  return immutableJson({
    ...material,
    preparedId: sequentialSemanticFingerprint('SSKGEOMETRYHISTORYPREP', material),
  }, 'Sequential prepared geometry history');
}
function staleAcceptance(prepared, currentAuthority) {
  return immutableJson({
    schema: SEQUENTIAL_GEOMETRY_HISTORY_ACCEPTANCE_SCHEMA,
    accepted: false,
    reasonCode: 'GEOMETRY_HISTORY_AUTHORITY_STALE',
    preparedId: prepared.preparedId,
    expectedAuthorityId: prepared.expectedAuthority.authorityId,
    currentAuthorityId: currentAuthority.authorityId,
    publicationState: 'NOT_PUBLISHED',
    publication: null,
  }, 'Sequential geometry history acceptance');
}

export function createSequentialGeometryEditHistoryService(options = {}) {
  const readCurrentState = requiredFunction(options.readCurrentState, 'readCurrentState');
  const readHistory = requiredFunction(options.readHistory, 'readHistory');
  const publishHistoryCandidate = requiredFunction(options.publishHistoryCandidate,
    'publishHistoryCandidate');
  const now = requiredFunction(options.now, 'now');
  function prepare(input = {}) {
    return buildPrepared(input, exactNow(now), readCurrentState(), readHistory());
  }
  function accept(preparedInput) {
    const prepared = preparedValue(preparedInput);
    const state = readCurrentState();
    const currentAuthority = deriveSequentialEditAuthority(state);
    if (!sameSequentialContractValue(currentAuthority, prepared.expectedAuthority)) {
      return staleAcceptance(prepared, currentAuthority);
    }
    const source = prepared.candidate;
    const rebuilt = buildPrepared({
      action: source.action,
      actorId: source.provenance.actorId,
      reason: source.provenance.reason,
      evidenceNote: source.provenance.evidenceNote,
    }, source.provenance.issuedAt, state, readHistory());
    if (!sameSequentialContractValue(rebuilt, prepared)) {
      fail('GEOMETRY_HISTORY_PREPARED_INVALID',
        'Prepared geometry history differs from independent current-state regeneration.');
    }
    try {
      const publication = publishHistoryCandidate({
        preparedId: prepared.preparedId,
        expectedAuthority: prepared.expectedAuthority,
        candidate: prepared.candidate,
      });
      return immutableJson({
        schema: SEQUENTIAL_GEOMETRY_HISTORY_ACCEPTANCE_SCHEMA,
        accepted: true, reasonCode: null, preparedId: prepared.preparedId,
        expectedAuthorityId: prepared.expectedAuthority.authorityId,
        currentAuthorityId: currentAuthority.authorityId,
        publicationState: 'COMMITTED', publication,
      }, 'Sequential geometry history acceptance');
    } catch (error) {
      fail('GEOMETRY_HISTORY_PUBLICATION_FAILED', error?.message || String(error), Error);
    }
  }
  return Object.freeze({ schema: 'SequentialGeometryEditHistoryService.v1', prepare, accept });
}

export const _test = Object.freeze({ action, buildPrepared, preparedValue, provenance });
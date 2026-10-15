/** Immutable RC-003 review contracts and exact session validation. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';

export const REVIEW_SESSION_SCHEMA = 'ReviewSession.v1';
export const REVIEW_ITEM_SCHEMA = 'ReviewItemState.v1';
export const REVIEW_EVENT_SCHEMA = 'ReviewEvent.v1';
export const REVIEW_NOTE_MAX_LENGTH = 500;
export const EMPTY_NOTE_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const REVIEW_STATES = Object.freeze(['UNREVIEWED', 'REVIEWED', 'NEEDS_CLARIFICATION', 'UNRESOLVED']);
export const REVIEW_ACTIONS = Object.freeze(['SET_REVIEW_STATE', 'SET_NOTE', 'RESET_REVIEW', 'IMPORT_SESSION']);
export const REVIEW_SESSION_STATUSES = Object.freeze(['CURRENT', 'STALE']);

function extraKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => `${label} contains unsupported field ${key}.`);
}
function validTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function reviewableIds(audit) {
  return (audit?.differenceRows ?? []).filter((row) => row.differenceCategory !== 'UNCHANGED')
    .map((row) => row.differenceId).sort();
}
export function reviewItemIndex(session) {
  return new Map((session?.items ?? []).map((item) => [item.differenceId, item]));
}
export function reviewEventIndex(session) {
  return new Map((session?.events ?? []).map((event) => [event.eventId, event]));
}
export function reviewSummary(items) {
  const counts = { UNREVIEWED: 0, REVIEWED: 0, NEEDS_CLARIFICATION: 0, UNRESOLVED: 0 };
  for (const item of items ?? []) if (Object.hasOwn(counts, item.reviewState)) counts[item.reviewState] += 1;
  const completedCount = counts.REVIEWED + counts.NEEDS_CLARIFICATION + counts.UNRESOLVED;
  const total = (items ?? []).length;
  return deepFreeze({
    reviewableTotal: total, unreviewed: counts.UNREVIEWED, reviewed: counts.REVIEWED,
    needsClarification: counts.NEEDS_CLARIFICATION, unresolved: counts.UNRESOLVED,
    completedCount, completionPercent: total ? Math.round((completedCount / total) * 10000) / 100 : 100,
  });
}
function identityErrors(session, audit) {
  const errors = [];
  if (audit?.schema !== 'RevisionCompareAudit.v1' || audit?.validation?.status !== 'READY') errors.push('A valid RevisionCompareAudit.v1 is required.');
  if (session?.auditId !== audit?.auditId) errors.push('auditId does not match the current audit.');
  if (session?.basisId !== audit?.basisId) errors.push('basisId does not match the current audit.');
  if (session?.revADocumentId !== audit?.revADocumentId) errors.push('Rev A document ID does not match the current audit.');
  if (session?.revBDocumentId !== audit?.revBDocumentId) errors.push('Rev B document ID does not match the current audit.');
  return errors;
}
function itemErrors(items, audit) {
  const errors = []; const expected = reviewableIds(audit); const ids = items.map((item) => item?.differenceId);
  if (new Set(ids).size !== ids.length) errors.push('Review items contain duplicate difference IDs.');
  if (ids.join('|') !== [...ids].sort().join('|')) errors.push('Review items must be ordered by differenceId.');
  for (const id of ids) if (!expected.includes(id)) errors.push(`Unknown review difference ID ${id}.`);
  for (const id of expected) if (!ids.includes(id)) errors.push(`Missing review difference ID ${id}.`);
  for (const item of items) {
    errors.push(...extraKeys(item, ['schema', 'differenceId', 'reviewState', 'note', 'noteHash', 'firstReviewedAt', 'updatedAt', 'eventIds'], item?.differenceId ?? 'Review item'));
    if (item?.schema !== REVIEW_ITEM_SCHEMA) errors.push(`${item?.differenceId ?? 'item'} has an invalid schema.`);
    if (!REVIEW_STATES.includes(item?.reviewState)) errors.push(`${item?.differenceId ?? 'item'} has an invalid review state.`);
    if (typeof item?.note !== 'string' || item.note.length > REVIEW_NOTE_MAX_LENGTH) errors.push(`${item?.differenceId ?? 'item'} has an invalid note.`);
    if (!/^[a-f0-9]{64}$/.test(item?.noteHash ?? '')) errors.push(`${item?.differenceId ?? 'item'} has an invalid note hash.`);
    if (item?.firstReviewedAt !== null && !validTimestamp(item.firstReviewedAt)) errors.push(`${item?.differenceId ?? 'item'} has an invalid firstReviewedAt.`);
    if (!validTimestamp(item?.updatedAt)) errors.push(`${item?.differenceId ?? 'item'} has an invalid updatedAt.`);
    if (!Array.isArray(item?.eventIds) || new Set(item.eventIds).size !== item.eventIds.length) errors.push(`${item?.differenceId ?? 'item'} has invalid event references.`);
  }
  return errors;
}
function eventShapeErrors(event, sequence, reviewSessionId, itemIds, eventIds) {
  const errors = extraKeys(event, ['schema', 'eventId', 'sequence', 'differenceId', 'action', 'previousState', 'nextState', 'previousNoteHash', 'nextNoteHash', 'occurredAt'], `Event ${sequence}`);
  if (event?.schema !== REVIEW_EVENT_SCHEMA) errors.push(`Event ${sequence} has an invalid schema.`);
  if (event?.sequence !== sequence) errors.push(`Review event sequence is broken at ${sequence}.`);
  if (event?.eventId !== `${reviewSessionId}:event:${sequence}`) errors.push(`Event ${sequence} has an invalid deterministic ID.`);
  if (eventIds.has(event?.eventId)) errors.push(`Duplicate review event ID ${event?.eventId}.`); eventIds.add(event?.eventId);
  if (!itemIds.has(event?.differenceId)) errors.push(`Event ${sequence} refers to an unknown review item.`);
  if (!REVIEW_ACTIONS.includes(event?.action)) errors.push(`Event ${sequence} has an invalid action.`);
  if (!REVIEW_STATES.includes(event?.previousState) || !REVIEW_STATES.includes(event?.nextState)) errors.push(`Event ${sequence} has invalid state evidence.`);
  if (!/^[a-f0-9]{64}$/.test(event?.previousNoteHash ?? '') || !/^[a-f0-9]{64}$/.test(event?.nextNoteHash ?? '')) errors.push(`Event ${sequence} has invalid note hashes.`);
  if (!validTimestamp(event?.occurredAt)) errors.push(`Event ${sequence} has an invalid timestamp.`);
  return errors;
}
function eventActionErrors(event) {
  const errors = []; const stateChanged = event.previousState !== event.nextState;
  const noteChanged = event.previousNoteHash !== event.nextNoteHash;
  if (event.action === 'SET_NOTE' && stateChanged) errors.push(`${event.eventId} changes state during a note action.`);
  if (event.action === 'SET_NOTE' && !noteChanged) errors.push(`${event.eventId} records a no-op note action.`);
  if (event.action === 'SET_REVIEW_STATE' && (!stateChanged || event.nextState === 'UNREVIEWED')) errors.push(`${event.eventId} has invalid review-state action evidence.`);
  if (event.action === 'SET_REVIEW_STATE' && noteChanged) errors.push(`${event.eventId} changes note evidence during a state action.`);
  if (event.action === 'RESET_REVIEW' && (event.nextState !== 'UNREVIEWED' || event.previousState === 'UNREVIEWED')) errors.push(`${event.eventId} has invalid reset evidence.`);
  if (event.action === 'RESET_REVIEW' && noteChanged) errors.push(`${event.eventId} changes note evidence during reset.`);
  if (event.action === 'IMPORT_SESSION' && (stateChanged || noteChanged)) errors.push(`${event.eventId} changes item evidence during an import receipt.`);
  return errors;
}
function eventChainErrors(events, items) {
  const errors = []; const current = new Map(items.map((item) => [item.differenceId, { state: 'UNREVIEWED', noteHash: EMPTY_NOTE_HASH, eventIds: [] }]));
  for (const event of events) {
    const cursor = current.get(event.differenceId); if (!cursor) continue;
    if (event.previousState !== cursor.state || event.previousNoteHash !== cursor.noteHash) errors.push(`${event.eventId} breaks the append-only evidence chain.`);
    errors.push(...eventActionErrors(event));
    cursor.state = event.nextState; cursor.noteHash = event.nextNoteHash; cursor.eventIds.push(event.eventId);
  }
  for (const item of items) {
    const cursor = current.get(item.differenceId);
    if (cursor.state !== item.reviewState || cursor.noteHash !== item.noteHash) errors.push(`${item.differenceId} does not reconcile with its event history.`);
    if (cursor.eventIds.join('|') !== item.eventIds.join('|')) errors.push(`${item.differenceId} event references are not append-only and ordered.`);
  }
  return errors;
}
function eventErrors(events, items, reviewSessionId) {
  const errors = []; const itemIds = new Set(items.map((item) => item.differenceId)); const eventIds = new Set();
  events.forEach((event, index) => errors.push(...eventShapeErrors(event, index + 1, reviewSessionId, itemIds, eventIds)));
  errors.push(...eventChainErrors(events, items)); return errors;
}
function summaryErrors(session) {
  return JSON.stringify(session.summary) === JSON.stringify(reviewSummary(session.items)) ? [] : ['Review summary does not reconcile with items.'];
}
export function validateReviewSession(session, audit, options = {}) {
  const errors = [];
  errors.push(...extraKeys(session, ['schema', 'reviewSessionId', 'auditId', 'basisId', 'revADocumentId', 'revBDocumentId', 'status', 'revision', 'createdAt', 'updatedAt', 'items', 'events', 'summary', 'validation'], 'Review session'));
  if (session?.schema !== REVIEW_SESSION_SCHEMA) errors.push(`schema must be ${REVIEW_SESSION_SCHEMA}.`);
  if (session?.reviewSessionId !== `review-session:${audit?.auditId}:v1`) errors.push('reviewSessionId is not deterministic for the audit.');
  errors.push(...identityErrors(session, audit));
  if (!REVIEW_SESSION_STATUSES.includes(session?.status)) errors.push('Review session status is invalid.');
  if (options.requireCurrent && session?.status !== 'CURRENT') errors.push('A stale review session cannot be imported as editable state.');
  if (!Number.isInteger(session?.revision) || session.revision < 0 || session.revision !== (session?.events?.length ?? -1)) errors.push('Review session revision is invalid.');
  if (!validTimestamp(session?.createdAt) || !validTimestamp(session?.updatedAt)) errors.push('Review session timestamps are invalid.');
  if (!Array.isArray(session?.items) || !Array.isArray(session?.events)) errors.push('Review items and events are required.');
  else { errors.push(...itemErrors(session.items, audit)); errors.push(...eventErrors(session.events, session.items, session.reviewSessionId)); errors.push(...summaryErrors(session)); }
  errors.push(...extraKeys(session?.summary, ['reviewableTotal', 'unreviewed', 'reviewed', 'needsClarification', 'unresolved', 'completedCount', 'completionPercent'], 'Review summary'));
  errors.push(...extraKeys(session?.validation, ['status', 'errors'], 'Review validation'));
  if (session?.validation?.status !== 'READY' || !Array.isArray(session?.validation?.errors) || session.validation.errors.length) errors.push('Review session validation receipt is invalid.');
  try { assertJsonSafe(session, REVIEW_SESSION_SCHEMA); } catch (error) { errors.push(error.message); }
  return Object.freeze(errors);
}
export function assertValidReviewSession(session, audit, options = {}) {
  const errors = validateReviewSession(session, audit, options);
  if (errors.length) throw new TypeError(`Invalid ReviewSession.v1: ${errors.join(' ')}`);
  return true;
}
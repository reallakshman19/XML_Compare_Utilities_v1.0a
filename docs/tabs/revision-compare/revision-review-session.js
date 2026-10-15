/** Immutable ReviewSession.v1 creation and atomic review transitions. */
import { deepFreeze } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import {
  assertValidReviewSession, EMPTY_NOTE_HASH, REVIEW_EVENT_SCHEMA,
  REVIEW_ITEM_SCHEMA, REVIEW_NOTE_MAX_LENGTH, REVIEW_SESSION_SCHEMA, REVIEW_STATES, reviewSummary,
} from './revision-review-contracts.js';

function requireAudit(audit) {
  if (audit?.schema !== 'RevisionCompareAudit.v1' || audit?.validation?.status !== 'READY') {
    throw new TypeError('A valid RevisionCompareAudit.v1 is required to create review state.');
  }
}
function itemFor(differenceId, createdAt) {
  return deepFreeze({
    schema: REVIEW_ITEM_SCHEMA, differenceId, reviewState: 'UNREVIEWED', note: '', noteHash: EMPTY_NOTE_HASH,
    firstReviewedAt: null, updatedAt: createdAt, eventIds: Object.freeze([]),
  });
}
function sessionIdentity(audit) {
  return {
    reviewSessionId: `review-session:${audit.auditId}:v1`, auditId: audit.auditId, basisId: audit.basisId,
    revADocumentId: audit.revADocumentId, revBDocumentId: audit.revBDocumentId,
  };
}
export function createReviewSession(audit, createdAt) {
  requireAudit(audit);
  const ids = audit.differenceRows.filter((row) => row.differenceCategory !== 'UNCHANGED')
    .map((row) => row.differenceId).sort();
  const items = Object.freeze(ids.map((id) => itemFor(id, createdAt)));
  const session = deepFreeze({
    schema: REVIEW_SESSION_SCHEMA, ...sessionIdentity(audit), status: 'CURRENT', revision: 0,
    createdAt, updatedAt: createdAt, items, events: Object.freeze([]), summary: reviewSummary(items),
    validation: deepFreeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  assertValidReviewSession(session, audit, { requireCurrent: true }); return session;
}
function requireEditable(session) {
  if (session?.status !== 'CURRENT') throw new Error('The review session is stale and read-only.');
}
function eventFor(session, item, input) {
  const sequence = session.events.length + 1;
  return deepFreeze({
    schema: REVIEW_EVENT_SCHEMA, eventId: `${session.reviewSessionId}:event:${sequence}`, sequence,
    differenceId: item.differenceId, action: input.action, previousState: item.reviewState,
    nextState: input.nextState, previousNoteHash: item.noteHash, nextNoteHash: input.nextNoteHash,
    occurredAt: input.occurredAt,
  });
}
function replaceItem(items, nextItem) {
  return Object.freeze(items.map((item) => item.differenceId === nextItem.differenceId ? nextItem : item));
}
function commitTransition(session, audit, nextItem, event, occurredAt) {
  const items = replaceItem(session.items, nextItem); const events = Object.freeze([...session.events, event]);
  const next = deepFreeze({
    ...session, revision: events.length, updatedAt: occurredAt, items, events, summary: reviewSummary(items),
    validation: deepFreeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  assertValidReviewSession(next, audit, { requireCurrent: true }); return next;
}
function findItem(session, differenceId) {
  const item = session.items.find((entry) => entry.differenceId === differenceId);
  if (!item) throw new RangeError(`Unknown review difference ID ${differenceId}.`);
  return item;
}
export function setReviewItemState(session, audit, differenceId, reviewState, occurredAt) {
  requireEditable(session); if (!REVIEW_STATES.includes(reviewState)) throw new RangeError(`Unknown review state ${reviewState}.`);
  const item = findItem(session, differenceId); if (item.reviewState === reviewState) return session;
  const action = reviewState === 'UNREVIEWED' ? 'RESET_REVIEW' : 'SET_REVIEW_STATE';
  const event = eventFor(session, item, { action, nextState: reviewState, nextNoteHash: item.noteHash, occurredAt });
  const nextItem = deepFreeze({
    ...item, reviewState, firstReviewedAt: item.firstReviewedAt ?? (reviewState === 'UNREVIEWED' ? null : occurredAt),
    updatedAt: occurredAt, eventIds: Object.freeze([...item.eventIds, event.eventId]),
  });
  return commitTransition(session, audit, nextItem, event, occurredAt);
}
export async function setReviewItemNote(session, audit, differenceId, note, occurredAt, cryptoRef) {
  requireEditable(session); const text = String(note ?? '');
  if (text.length > REVIEW_NOTE_MAX_LENGTH) throw new RangeError(`Review notes are limited to ${REVIEW_NOTE_MAX_LENGTH} characters.`);
  const item = findItem(session, differenceId); if (item.note === text) return session;
  const noteHash = await sha256Text(text, cryptoRef);
  const event = eventFor(session, item, { action: 'SET_NOTE', nextState: item.reviewState, nextNoteHash: noteHash, occurredAt });
  const nextItem = deepFreeze({ ...item, note: text, noteHash, updatedAt: occurredAt, eventIds: Object.freeze([...item.eventIds, event.eventId]) });
  return commitTransition(session, audit, nextItem, event, occurredAt);
}
export function markReviewSessionStale(session, updatedAt) {
  if (!session || session.status === 'STALE') return session;
  return deepFreeze({ ...session, status: 'STALE', updatedAt });
}
export function reviewSessionMatchesAudit(session, audit) {
  return Boolean(session && audit && session.auditId === audit.auditId && session.basisId === audit.basisId
    && session.revADocumentId === audit.revADocumentId && session.revBDocumentId === audit.revBDocumentId);
}
export function reattachReviewSession(session, audit, updatedAt) {
  if (!reviewSessionMatchesAudit(session, audit)) throw new Error('The stale review session does not match the exact audit.');
  const next = deepFreeze({ ...session, status: 'CURRENT', updatedAt });
  assertValidReviewSession(next, audit, { requireCurrent: true }); return next;
}
export const _test = Object.freeze({ eventFor, sessionIdentity });

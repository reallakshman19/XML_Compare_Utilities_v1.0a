import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { REVIEW_NOTE_MAX_LENGTH, validateReviewSession, reviewSummary } from '../tabs/revision-compare/revision-review-contracts.js';
import { createReviewSession, markReviewSessionStale, reattachReviewSession, setReviewItemNote, setReviewItemState } from '../tabs/revision-compare/revision-review-session.js';
import { createReviewLifecycleState, attachReviewAudit, startNewReviewForAudit } from '../tabs/revision-compare/revision-review-lifecycle.js';
import { createReviewSessionExport, parseReviewSessionJson, serializeReviewSession } from '../tabs/revision-compare/revision-review-manifest.js';
import { _test as viewTest } from '../tabs/revision-compare/revision-review-view.js';

const NOW = '2026-07-18T12:00:00.000Z';
const LATER = '2026-07-18T12:01:00.000Z';
const row = (id, category, certainty = 'EXACT', reasons = []) => ({
  schema: 'RevisionDifferenceRow.v1', differenceId: id, differenceCategory: category,
  matchCertainty: certainty, sourceRecordId: category === 'ADDED' ? null : `A:${id}`,
  targetRecordId: category === 'REMOVED' || certainty === 'AMBIGUOUS' ? null : `B:${id}`,
  changeReasons: reasons, changedProperties: [], geometryDelta: { status: 'UNAVAILABLE', changed: false, reason: 'Unavailable' },
  evidenceSummary: { primary: 'Persisted audit evidence.' }, candidateEvidenceId: certainty === 'AMBIGUOUS' ? `e:${id}` : null,
  visualRefs: { sourceObjectId: null, targetObjectId: null },
  context: { branchId: '/B', componentType: 'PIPE', revAIdentity: `A-${id}`, revBIdentity: `B-${id}` },
});
const audit = (id = 'audit:one') => Object.freeze({
  schema: 'RevisionCompareAudit.v1', auditId: id, basisId: `basis:${id}`, revADocumentId: `docA:${id}`, revBDocumentId: `docB:${id}`,
  engineVersion: 'rc002', configuration: { candidateLimit: 8 }, validation: { status: 'READY', errors: [] },
  summary: { unchanged: 1, changed: 2, added: 1, removed: 1, needsDecision: 1, exact: 3, inferred: 0 },
  differenceRows: [row('d:unch', 'UNCHANGED'), row('d:amb', 'REMOVED', 'AMBIGUOUS'), row('d:prop', 'CHANGED', 'EXACT', ['PROPERTIES']), row('d:geo', 'CHANGED', 'INFERRED', ['GEOMETRY']), row('d:add', 'ADDED', 'NOT_APPLICABLE'), row('d:rem', 'REMOVED', 'NOT_APPLICABLE')],
  candidateEvidence: [], visualModels: { revA: { segments: [], markers: [] }, revB: { segments: [], markers: [] }, statusByObjectId: {} },
});
const clone = (value) => structuredClone(value);

assert.throws(() => createReviewSession({}, NOW), /valid RevisionCompareAudit/);
let session = createReviewSession(audit(), NOW);
assert.equal(session.schema, 'ReviewSession.v1');
assert.equal(session.items.length, 5);
assert(!session.items.some((item) => item.differenceId === 'd:unch'));
assert(session.items.every((item) => item.reviewState === 'UNREVIEWED'));
assert.deepEqual(session.items.map((item) => item.differenceId), [...session.items.map((item) => item.differenceId)].sort());
assert.equal(session.reviewSessionId, 'review-session:audit:one:v1');
assert(Object.isFrozen(session) && Object.isFrozen(session.items[0]));
assert.equal(session.summary.unreviewed, 5);
assert.equal(session.summary.completionPercent, 0);

const originalAudit = JSON.stringify(audit());
assert.equal(setReviewItemState(session, audit(), 'd:amb', 'UNREVIEWED', LATER), session);
session = setReviewItemState(session, audit(), 'd:amb', 'REVIEWED', LATER);
assert.equal(session.events.length, 1);
assert.equal(session.items.find((item) => item.differenceId === 'd:amb').reviewState, 'REVIEWED');
assert.equal(audit().summary.needsDecision, 1);
assert.equal(JSON.stringify(audit()), originalAudit);
assert.equal(setReviewItemState(session, audit(), 'd:amb', 'REVIEWED', LATER), session);

const htmlNote = '<tag>& "review"';
session = await setReviewItemNote(session, audit(), 'd:amb', htmlNote, '2026-07-18T12:02:00.000Z', webcrypto);
assert.equal(session.events.length, 2);
assert.equal(session.items.find((item) => item.differenceId === 'd:amb').note, htmlNote);
assert.match(viewTest.escapeHtml(htmlNote), /&lt;tag&gt;&amp; &quot;review&quot;/);
assert.equal(await setReviewItemNote(session, audit(), 'd:amb', htmlNote, LATER, webcrypto), session);
assert.equal((await setReviewItemNote(session, audit(), 'd:amb', '', '2026-07-18T12:03:00.000Z', webcrypto)).items.find((item) => item.differenceId === 'd:amb').note, '');
await assert.rejects(() => setReviewItemNote(session, audit(), 'd:amb', 'x'.repeat(REVIEW_NOTE_MAX_LENGTH + 1), LATER, webcrypto), /limited/);

session = setReviewItemState(session, audit(), 'd:amb', 'UNREVIEWED', '2026-07-18T12:04:00.000Z');
assert.equal(session.events.at(-1).action, 'RESET_REVIEW');
assert.deepEqual(session.events.map((event) => event.sequence), [1, 2, 3]);
assert.equal(new Set(session.events.map((event) => event.eventId)).size, session.events.length);
assert(session.items.find((item) => item.differenceId === 'd:amb').eventIds.every((id) => session.events.some((event) => event.eventId === id)));
assert.equal(session.revision, session.events.length);
assert.deepEqual(session.summary, reviewSummary(session.items));
assert(Number.isFinite(session.summary.completionPercent) && session.summary.completionPercent >= 0 && session.summary.completionPercent <= 100);

const stale = markReviewSessionStale(session, '2026-07-18T12:05:00.000Z');
assert.equal(stale.status, 'STALE');
assert.throws(() => setReviewItemState(stale, audit(), 'd:add', 'REVIEWED', LATER), /read-only/);
assert.equal(createReviewSessionExport(stale).status, 'STALE');
const reattached = reattachReviewSession(stale, audit(), '2026-07-18T12:06:00.000Z');
assert.equal(reattached.status, 'CURRENT');
assert.equal(reattached.revision, session.revision);
assert.deepEqual(reattached.events, session.events);

const json = serializeReviewSession(reattached);
assert(!json.includes('differenceRows') && !json.includes('visualModels') && !json.includes('staged'));
const imported = await parseReviewSessionJson(json, audit(), '2026-07-18T12:07:00.000Z', webcrypto);
assert.deepEqual(imported, reattached);
assert.equal(JSON.parse(json).reviewSessionId, reattached.reviewSessionId);

async function rejectMutation(mutator, pattern) {
  const value = clone(reattached); mutator(value);
  await assert.rejects(() => parseReviewSessionJson(JSON.stringify(value), audit(), LATER, webcrypto), pattern);
}
await rejectMutation((value) => { value.auditId = 'wrong'; }, /auditId/);
await rejectMutation((value) => { value.basisId = 'wrong'; }, /basisId/);
await rejectMutation((value) => { value.revADocumentId = 'wrong'; }, /Rev A/);
await rejectMutation((value) => { value.revBDocumentId = 'wrong'; }, /Rev B/);
await rejectMutation((value) => { value.items[0].differenceId = 'unknown'; }, /Unknown|Missing/);
await rejectMutation((value) => { value.items.pop(); }, /Missing/);
await rejectMutation((value) => { value.items[1].differenceId = value.items[0].differenceId; }, /duplicate/i);
await rejectMutation((value) => { value.events[1].eventId = value.events[0].eventId; }, /invalid deterministic ID|Duplicate/);
await rejectMutation((value) => { value.events[1].sequence = 7; }, /sequence/);
await rejectMutation((value) => { value.summary.unreviewed += 1; }, /summary/);
await rejectMutation((value) => { value.revision = -1; }, /revision/);
await rejectMutation((value) => { value.items.find((item) => item.note).note += 'tampered'; }, /note hash/);

const invalidState = clone(reattached); invalidState.items[0].reviewState = 'RESOLVED';
assert(validateReviewSession(invalidState, audit()).some((error) => /review state/.test(error)));
const brokenChain = clone(reattached); brokenChain.events[1].previousState = 'UNRESOLVED';
assert(validateReviewSession(brokenChain, audit()).some((error) => /append-only/.test(error)));

let lifecycle = createReviewLifecycleState(); lifecycle = attachReviewAudit(lifecycle, audit(), NOW);
const kept = setReviewItemState(lifecycle.session, audit(), 'd:add', 'NEEDS_CLARIFICATION', LATER);
lifecycle = { ...lifecycle, session: markReviewSessionStale(kept, LATER) };
const same = attachReviewAudit(lifecycle, audit(), '2026-07-18T12:08:00.000Z');
assert.equal(same.session.status, 'CURRENT');
assert.equal(same.session.items.find((item) => item.differenceId === 'd:add').reviewState, 'NEEDS_CLARIFICATION');
const different = attachReviewAudit(same, audit('audit:two'), '2026-07-18T12:09:00.000Z');
assert.equal(different.replacementRequired, true);
assert.equal(different.session.auditId, 'audit:one');
const replaced = startNewReviewForAudit(different, audit('audit:two'), '2026-07-18T12:10:00.000Z');
assert.equal(replaced.session.auditId, 'audit:two');
assert(replaced.session.items.every((item) => item.reviewState === 'UNREVIEWED'));

console.log('revision-compare-rc003-contracts.test.mjs passed');

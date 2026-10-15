import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { reviewSummary, validateReviewSession } from '../tabs/revision-compare/revision-review-contracts.js';
import { createReviewSession, setReviewItemNote, setReviewItemState } from '../tabs/revision-compare/revision-review-session.js';

const NOW = '2026-07-18T14:30:00.000Z';
const LATER = '2026-07-18T14:31:00.000Z';
const row = Object.freeze({
  differenceId: 'd:one', differenceCategory: 'CHANGED', matchCertainty: 'EXACT',
  sourceRecordId: 'A:one', targetRecordId: 'B:one', changeReasons: ['PROPERTIES'],
  context: { branchId: '/A', componentType: 'PIPE', revAIdentity: 'A-one', revBIdentity: 'B-one' },
});
const audit = Object.freeze({
  schema: 'RevisionCompareAudit.v1', auditId: 'audit:owner-fixes', basisId: 'basis:owner-fixes',
  revADocumentId: 'doc:A', revBDocumentId: 'doc:B', validation: { status: 'READY', errors: [] },
  differenceRows: [row],
});

const reviewed = setReviewItemState(createReviewSession(audit, NOW), audit, 'd:one', 'REVIEWED', LATER);
const forgedStateEvent = structuredClone(reviewed);
const forgedHash = 'a'.repeat(64);
forgedStateEvent.events[0].nextNoteHash = forgedHash;
forgedStateEvent.items[0].noteHash = forgedHash;
assert(validateReviewSession(forgedStateEvent, audit).some((error) => /note evidence during a state action/.test(error)));

const noted = await setReviewItemNote(createReviewSession(audit, NOW), audit, 'd:one', 'note', LATER, webcrypto);
const forgedNoteEvent = structuredClone(noted);
forgedNoteEvent.events[0].nextState = 'REVIEWED';
forgedNoteEvent.items[0].reviewState = 'REVIEWED';
forgedNoteEvent.items[0].firstReviewedAt = LATER;
forgedNoteEvent.summary = reviewSummary(forgedNoteEvent.items);
assert(validateReviewSession(forgedNoteEvent, audit).some((error) => /changes state during a note action/.test(error)));

for (const path of [
  '../tabs/revision-compare/revision-compare-actions.js',
  '../tabs/revision-compare/revision-review-view.js',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /review\.filters\.search\s*\|\|\s*state\.compare\.queue\.search/,
    `${path} revives a hidden legacy queue-search filter`);
  assert.match(source, /search:\s*state\.review\.filters\.search/,
    `${path} must use the visible review search as the sole search authority`);
}

console.log('revision-compare-rc003-owner-fixes.test.mjs passed');
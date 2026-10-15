import assert from 'node:assert/strict';
import { createReviewSession, setReviewItemState } from '../tabs/revision-compare/revision-review-session.js';
import { createReviewFilters, nextPriorityDifferenceId, previousPriorityDifferenceId, projectReviewPriority, selectionAfterReviewMutation } from '../tabs/revision-compare/revision-review-priority.js';

const NOW = '2026-07-18T12:00:00.000Z';
const row = (id, category, certainty, reasons = [], branch = '/A', type = 'PIPE', identity = id) => ({
  differenceId: id, differenceCategory: category, matchCertainty: certainty, changeReasons: reasons,
  sourceRecordId: `A:${id}`, targetRecordId: category === 'REMOVED' || certainty === 'AMBIGUOUS' ? null : `B:${id}`,
  context: { branchId: branch, componentType: type, revAIdentity: identity, revBIdentity: identity }, evidenceSummary: { primary: id },
});
const rows = [
  row('d:reviewed', 'CHANGED', 'EXACT', ['PROPERTIES']),
  row('d:property', 'CHANGED', 'EXACT', ['PROPERTIES']),
  row('d:geometry', 'CHANGED', 'INFERRED', ['GEOMETRY']),
  row('d:add', 'ADDED', 'NOT_APPLICABLE'),
  row('d:remove', 'REMOVED', 'NOT_APPLICABLE'),
  row('d:ambiguous', 'REMOVED', 'AMBIGUOUS'),
  row('d:clarify', 'CHANGED', 'EXACT', ['PROPERTIES']),
  row('d:unresolved', 'CHANGED', 'EXACT', ['PROPERTIES']),
];
const audit = { schema: 'RevisionCompareAudit.v1', auditId: 'audit:p', basisId: 'basis:p', revADocumentId: 'A', revBDocumentId: 'B', validation: { status: 'READY', errors: [] }, differenceRows: rows };
let session = createReviewSession(audit, NOW);
session = setReviewItemState(session, audit, 'd:reviewed', 'REVIEWED', '2026-07-18T12:01:00.000Z');
session = setReviewItemState(session, audit, 'd:clarify', 'NEEDS_CLARIFICATION', '2026-07-18T12:02:00.000Z');
session = setReviewItemState(session, audit, 'd:unresolved', 'UNRESOLVED', '2026-07-18T12:03:00.000Z');
const projection = projectReviewPriority(audit, session);
assert.deepEqual(projection.all.map((entry) => entry.row.differenceId), ['d:ambiguous', 'd:clarify', 'd:unresolved', 'd:remove', 'd:add', 'd:geometry', 'd:property', 'd:reviewed']);
assert.equal(nextPriorityDifferenceId(projection, 'd:ambiguous'), 'd:clarify');
assert.equal(nextPriorityDifferenceId(projection, 'd:reviewed'), 'd:ambiguous');
assert.equal(previousPriorityDifferenceId(projection, 'd:clarify'), 'd:ambiguous');
assert.equal(previousPriorityDifferenceId(projection, 'd:ambiguous'), null);

const filtered = projectReviewPriority(audit, session, { ...createReviewFilters(), reviewStates: ['UNREVIEWED'], search: 'geometry' });
assert.deepEqual(filtered.visible.map((entry) => entry.row.differenceId), ['d:geometry']);
assert.deepEqual(filtered.all.map((entry) => entry.row.differenceId), projection.all.map((entry) => entry.row.differenceId));
assert.equal(nextPriorityDifferenceId(filtered, 'd:geometry'), null);
const certainty = projectReviewPriority(audit, session, { ...createReviewFilters(), certainties: ['AMBIGUOUS'] });
assert.deepEqual(certainty.visible.map((entry) => entry.row.differenceId), ['d:ambiguous']);

const before = projectReviewPriority(audit, session, { ...createReviewFilters(), reviewStates: ['UNREVIEWED'] });
const reviewed = setReviewItemState(session, audit, 'd:ambiguous', 'REVIEWED', '2026-07-18T12:04:00.000Z');
const after = projectReviewPriority(audit, reviewed, { ...createReviewFilters(), reviewStates: ['UNREVIEWED'] });
assert.equal(selectionAfterReviewMutation(before, after, 'd:ambiguous'), 'd:remove');

const tieRows = [row('d:2', 'CHANGED', 'EXACT', ['PROPERTIES'], '/A', 'PIPE', 'A'), row('d:1', 'CHANGED', 'EXACT', ['PROPERTIES'], '/A', 'PIPE', 'A')];
const tieAudit = { ...audit, auditId: 'audit:tie', basisId: 'basis:tie', differenceRows: tieRows };
const tieSession = createReviewSession(tieAudit, NOW);
assert.deepEqual(projectReviewPriority(tieAudit, tieSession).all.map((entry) => entry.row.differenceId), ['d:1', 'd:2']);

const largeRows = Array.from({ length: 5000 }, (_, index) => row(`d:${String(index).padStart(5, '0')}`, index % 3 === 0 ? 'REMOVED' : index % 3 === 1 ? 'ADDED' : 'CHANGED', index % 11 === 0 ? 'AMBIGUOUS' : 'EXACT', index % 3 === 2 ? ['PROPERTIES'] : [], `/B${index % 20}`, 'PIPE', `I${index}`));
const largeAudit = { ...audit, auditId: 'audit:5000', basisId: 'basis:5000', differenceRows: largeRows };
const largeSession = createReviewSession(largeAudit, NOW);
const started = performance.now(); const large = projectReviewPriority(largeAudit, largeSession); const elapsedMilliseconds = performance.now() - started;
assert.equal(large.all.length, 5000);
assert.equal(new Set(large.all.map((entry) => entry.row.differenceId)).size, 5000);
assert(elapsedMilliseconds < 5000, `5000-row priority projection took ${elapsedMilliseconds} ms`);
const receipt = Object.freeze({ reviewableRows: 5000, projectedRows: large.all.length, elapsedMilliseconds });
assert.equal(receipt.projectedRows, 5000);

console.log('revision-compare-rc003-priority.test.mjs passed', receipt);

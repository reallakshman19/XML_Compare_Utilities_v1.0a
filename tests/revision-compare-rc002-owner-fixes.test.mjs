import assert from 'node:assert/strict';
import { validateRevisionCompareAudit } from '../tabs/revision-compare/revision-compare-audit.js';
import {
  cancelComparisonState, createComparisonLifecycleState, progressComparisonState, startComparisonState,
} from '../tabs/revision-compare/revision-compare-lifecycle.js';
import {
  cancelWorkspaceComparison, createRevisionWorkspaceState, progressWorkspaceComparison, startWorkspaceComparison,
} from '../tabs/revision-compare/revision-workspace-state.js';

const token = Object.freeze({ generation: 4, runId: 'run:4:basis:test' });
const lateProgress = Object.freeze({
  stage: 'Projecting Rev B scope', recordsProcessed: 0,
  candidatePairsEvaluated: 0, maximumCandidatesForOneRecord: 0,
});

let lifecycle = startComparisonState(createComparisonLifecycleState(), token);
lifecycle = cancelComparisonState(lifecycle);
assert.equal(lifecycle.status, 'CANCELLED');
assert.equal(lifecycle.runGeneration, token.generation + 1);
assert.equal(progressComparisonState(lifecycle, token, lateProgress), lifecycle,
  'late projection progress must not revive a cancelled lifecycle');

let workspace = createRevisionWorkspaceState('session:cancel-race', '2026-07-18T10:50:00.000Z');
workspace = startWorkspaceComparison(workspace, token);
workspace = cancelWorkspaceComparison(workspace);
const afterLateProgress = progressWorkspaceComparison(workspace, token, lateProgress);
assert.equal(afterLateProgress, workspace, 'stale projection progress must not mutate workspace state');
assert.equal(afterLateProgress.compare.status, 'CANCELLED');
assert.equal(afterLateProgress.message, 'Visual comparison cancelled.');

const forgedAudit = {
  schema: 'RevisionCompareAudit.v1',
  differenceRows: [{
    differenceId: 'difference:forged', sourceRecordId: 'record:A:forged', targetRecordId: 'record:B:forged',
    matchCertainty: 'EXACT', candidateEvidenceId: null,
    visualRefs: { sourceObjectId: null, targetObjectId: null },
  }],
  candidateEvidence: [],
  visualModels: { revA: { segments: [], markers: [] }, revB: { segments: [], markers: [] } },
  summary: { unchanged: 1, changed: 0, added: 0, removed: 0 },
};
const reconciliationErrors = validateRevisionCompareAudit(forgedAudit, {
  revA: { records: [{ recordId: 'record:A:actual' }] },
  revB: { records: [{ recordId: 'record:B:actual' }] },
});
assert(reconciliationErrors.some((error) => error.includes('unknown record')));
assert(reconciliationErrors.some((error) => error.includes('not accounted for')));

console.log('revision-compare-rc002-owner-fixes.test.mjs passed');

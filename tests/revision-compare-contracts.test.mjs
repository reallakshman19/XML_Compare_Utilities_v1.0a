import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRevisionComparisonBasis } from '../tabs/revision-compare/revision-comparison-basis.js';
import { createRevisionSessionManifest, createRevisionScopeManifest } from '../tabs/revision-compare/revision-manifests.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { createRevisionScopeProposal, updateScopeDecision } from '../tabs/revision-compare/revision-scope-proposal.js';
import { buildBranchIndex, filterStagedDocument, readStagedRevision } from '../tabs/revision-compare/revision-staged-core.js';
import { createRevisionWorkspaceState, finishWorkspaceLoad, finishWorkspaceScope, setWorkspaceBasis, setWorkspaceProposal, startWorkspaceLoad } from '../tabs/revision-compare/revision-workspace-state.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';

const NOW = '2026-07-18T05:30:00.000Z';
const textA = await readFile(new URL('./fixtures/revision-compare/rev-a.json', import.meta.url), 'utf8');
const textB = await readFile(new URL('./fixtures/revision-compare/rev-b.json', import.meta.url), 'utf8');
const factory = () => createInlineRevisionWorkerClient();
const service = createRevisionLoadService(globalThis.crypto, { clientFactory: factory });
const a = await service.loadText('baseline', 'rev-a.json', textA, NOW);
const b = await service.loadText('candidate', 'rev-b.json', textB, NOW);

assert.equal(a.document.sourceHash.length, 64);
assert.equal(a.document.fileSizeBytes, new TextEncoder().encode(textA).byteLength);
assert(Object.isFrozen(a.document));
assert.equal(a.branchIndex.length, 3);
assert.equal(b.branchIndex.length, 3);

for (const root of [JSON.parse(textA).branches, { objects: JSON.parse(textA).branches }, { hierarchy: JSON.parse(textA).branches }, JSON.parse(textA)]) {
  assert.equal(readStagedRevision(root).stats.branchCount, 3);
}
assert.throws(() => readStagedRevision({ unsupported: [] }), /Unsupported staged JSON root/);
assert.throws(() => buildBranchIndex([{ name: '/A' }, { name: '/A' }]), /Duplicate exact branch/);
assert.equal(filterStagedDocument(JSON.parse(textA), { selectedIds: ['branch:/COMMON-100'] }).stats.branchCount, 1);

let state = createRevisionWorkspaceState('session-1', NOW);
state = startWorkspaceLoad(state, 'baseline', a.generation, 'rev-a.json', a.document.fileSizeBytes, NOW);
state = finishWorkspaceLoad(state, 'baseline', a, NOW);
state = startWorkspaceLoad(state, 'candidate', b.generation, 'rev-b.json', b.document.fileSizeBytes, NOW);
state = finishWorkspaceLoad(state, 'candidate', b, NOW);
const proposal = await createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, {}, globalThis.crypto);
assert.deepEqual(proposal.commonBranches.map((x) => x.branchId), ['branch:/COMMON-100', 'branch:/COMMON-200']);
assert.deepEqual(proposal.revAOnlyBranches.map((x) => x.branchId), ['branch:/REMOVED-300']);
assert.deepEqual(proposal.revBOnlyBranches.map((x) => x.branchId), ['branch:/ADDED-400']);
assert(proposal.includedBranchIdsA.includes('branch:/REMOVED-300'));
assert(proposal.includedBranchIdsB.includes('branch:/ADDED-400'));
assert.equal(proposal.summary.retainedComponentCountA, 4);
assert.equal(proposal.summary.retainedComponentCountB, 6);

const decisions = updateScopeDecision({}, 'branch:/REMOVED-300', true, 'USER_EXCLUDED');
const excluded = await createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, decisions, globalThis.crypto);
assert.equal(excluded.excludedBranches.length, 1);
assert.equal(excluded.summary.excludedBranchCount, 1);
assert.match(excluded.warnings.join(' '), /one-sided branch/);
assert.notEqual(excluded.proposalId, proposal.proposalId);
const repeated = await createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, decisions, globalThis.crypto);
assert.equal(repeated.proposalId, excluded.proposalId);

state = setWorkspaceProposal(state, excluded, decisions);
let preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal);
assert.equal(preflight.status, 'READY');
const scopedA = await service.applyScope('baseline', { selectedIds: excluded.includedBranchIdsA }, NOW);
const scopedB = await service.applyScope('candidate', { selectedIds: excluded.includedBranchIdsB }, NOW);
state = finishWorkspaceScope(state, { baseline: scopedA, candidate: scopedB }, { baseline: {}, candidate: {} }, NOW);
preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal);
const basisInput = { sessionId: state.session.sessionId, revA: state.slots.baseline, revB: state.slots.candidate, proposal: state.proposal, preflight };
const basis = await createRevisionComparisonBasis(basisInput, globalThis.crypto);
const basis2 = await createRevisionComparisonBasis(basisInput, globalThis.crypto);
assert.equal(basis.basisId, basis2.basisId);
assert(Object.isFrozen(basis) && Object.isFrozen(basis.includedBranchesA));
assert.throws(() => { basis.includedBranchesA.push('x'); }, TypeError);
state = setWorkspaceBasis(state, basis);

const sessionManifest = createRevisionSessionManifest(state, preflight);
const scopeManifest = createRevisionScopeManifest(state, preflight);
const sessionJson = JSON.stringify(sessionManifest);
assert.doesNotMatch(sessionJson, /"type":"PIPE"|"children":|"position":/);
assert.equal(scopeManifest.proposal.summary.includedBranchCountA, state.slots.baseline.document.stats.branchCount);
assert.equal(scopeManifest.proposal.summary.includedBranchCountB, state.slots.candidate.document.stats.branchCount);
assert.doesNotThrow(() => JSON.parse(JSON.stringify(scopeManifest)));

const incompatibleService = createRevisionLoadService(globalThis.crypto, { clientFactory: factory });
const mismatch = JSON.stringify({ ...JSON.parse(textB), unit: 'in', verticalAxis: 'Y', coordinateFrame: 'LOCAL' });
const mismatchB = await incompatibleService.loadText('candidate', 'bad.json', mismatch, NOW);
let mismatchState = createRevisionWorkspaceState('session-2', NOW);
mismatchState = startWorkspaceLoad(mismatchState, 'baseline', a.generation, 'rev-a.json', a.document.fileSizeBytes, NOW);
mismatchState = finishWorkspaceLoad(mismatchState, 'baseline', a, NOW);
mismatchState = startWorkspaceLoad(mismatchState, 'candidate', mismatchB.generation, 'bad.json', mismatchB.document.fileSizeBytes, NOW);
mismatchState = finishWorkspaceLoad(mismatchState, 'candidate', mismatchB, NOW);
const mismatchProposal = await createRevisionScopeProposal(mismatchState.slots.baseline, mismatchState.slots.candidate, {}, globalThis.crypto);
const blocked = revisionComparisonPreflight(mismatchState.slots.baseline, mismatchState.slots.candidate, mismatchProposal);
assert.equal(blocked.status, 'BLOCKED');
assert.match(blocked.blockers.join(' '), /Unit mismatch|Coordinate frame mismatch|Vertical axis mismatch/);

const identical = await service.loadText('candidate', 'same.json', textA, NOW);
let identicalState = createRevisionWorkspaceState('session-3', NOW);
identicalState = startWorkspaceLoad(identicalState, 'baseline', a.generation, 'rev-a.json', a.document.fileSizeBytes, NOW);
identicalState = finishWorkspaceLoad(identicalState, 'baseline', a, NOW);
identicalState = startWorkspaceLoad(identicalState, 'candidate', identical.generation, 'same.json', identical.document.fileSizeBytes, NOW);
identicalState = finishWorkspaceLoad(identicalState, 'candidate', identical, NOW);
const identicalProposal = await createRevisionScopeProposal(identicalState.slots.baseline, identicalState.slots.candidate, {}, globalThis.crypto);
assert.match(revisionComparisonPreflight(identicalState.slots.baseline, identicalState.slots.candidate, identicalProposal).notes.join(' '), /identical/);

service.dispose();
incompatibleService.dispose();
console.log('revision-compare-contracts.test.mjs passed');

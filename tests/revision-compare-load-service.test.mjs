import assert from 'node:assert/strict';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService, RevisionRequestSupersededError } from '../tabs/revision-compare/revision-load-service.js';
import { createRevisionWorkspaceState, finishWorkspaceLoad, setWorkspaceBasis, setWorkspaceProposal, startWorkspaceLoad } from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-18T05:30:00.000Z';
const doc = (name, metadata = {}) => JSON.stringify({ schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT', ...metadata, branches: [{ name, children: [{ type: 'PIPE' }] }] });

const clients = [];
const factory = (slotId) => {
  const client = createInlineRevisionWorkerClient();
  clients.push({ slotId, client });
  return client;
};
const service = createRevisionLoadService(globalThis.crypto, { clientFactory: factory });
assert.deepEqual(clients.map((x) => x.slotId), ['baseline', 'candidate']);
const a = await service.loadText('baseline', 'a.json', doc('/A'), NOW);
const b = await service.loadText('candidate', 'b.json', doc('/B'), NOW);
const scopedA = await service.applyScope('baseline', { selectedIds: ['branch:/A'] }, NOW);
assert.equal(scopedA.document.stats.branchCount, 1);
assert.equal(b.document.stats.branchCount, 1, 'candidate remains independently owned');
await assert.rejects(service.applyScope('candidate', { selectedIds: ['branch:/A'] }, NOW), /retains no branches/);

const invalid = createRevisionLoadService(globalThis.crypto, { clientFactory: () => createInlineRevisionWorkerClient() });
await assert.rejects(invalid.loadText('baseline', 'bad.json', '{bad', NOW), /JSON/);
await assert.rejects(invalid.loadText('baseline', 'bad-root.json', '{"x":[]}', NOW), /Unsupported staged JSON root/);

let release;
const slowClient = () => ({
  parse: () => new Promise((resolve) => {
    release = () => resolve({
      rootShape: 'branches',
      branchIndex: [{ branchId: 'branch:/S', label: '/S', site: '', owner: '', componentCount: 1, recordCount: 1, geometryEvidenceCount: 0 }],
      branchTree: [], stats: {},
      metadata: { stagedSchema: 'x', unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'PLANT' },
    });
  }),
  filter: () => Promise.resolve({ filtered: { branches: [{ name: '/S' }] }, retainedBranchIds: ['branch:/S'], stats: { branchCount: 1, componentCount: 1, recordCount: 1, geometryEvidenceCount: 0, scanned: 1, matched: 1, filtered: 0 } }),
  reset: () => Promise.resolve({}),
  dispose: () => {},
});
const staleService = createRevisionLoadService(globalThis.crypto, { clientFactory: slowClient });
const generation = staleService.begin('baseline');
const pending = staleService.loadText('baseline', 'slow.json', doc('/S'), NOW, generation);
for (let attempt = 0; attempt < 20 && !release; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 1));
assert.equal(typeof release, 'function');
const newer = staleService.begin('baseline');
assert.equal(newer, generation + 1);
release();
await assert.rejects(pending, RevisionRequestSupersededError);

const beforeCancelB = b.document.sourceHash;
const cancelGeneration = await service.cancel('baseline');
assert(cancelGeneration > a.generation);
const bScope = await service.applyScope('candidate', { selectedIds: ['branch:/B'] }, NOW);
assert.equal(bScope.document.sourceHash, beforeCancelB);

let state = createRevisionWorkspaceState('session', NOW);
state = startWorkspaceLoad(state, 'baseline', a.generation, 'a.json', a.document.fileSizeBytes, NOW);
state = finishWorkspaceLoad(state, 'baseline', a, NOW);
state = startWorkspaceLoad(state, 'candidate', b.generation, 'b.json', b.document.fileSizeBytes, NOW);
state = finishWorkspaceLoad(state, 'candidate', b, NOW);
state = setWorkspaceProposal(state, Object.freeze({ proposalId: 'p' }), {});
state = setWorkspaceBasis(state, Object.freeze({ basisId: 'basis' }));
state = startWorkspaceLoad(state, 'baseline', 99, 'replacement.json', 10, NOW);
assert.equal(state.basisStatus, 'STALE');
assert.equal(state.proposal, null);
assert.equal(state.session.documents.baseline, null);
assert.notEqual(state.session.documents.candidate, null);

service.dispose();
invalid.dispose();
staleService.dispose();
console.log('revision-compare-load-service.test.mjs passed');

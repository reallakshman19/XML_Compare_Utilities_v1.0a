import assert from 'node:assert/strict';
import { createRevisionActions } from '../tabs/revision-compare/revision-compare-actions.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import { createRevisionScopeProposal } from '../tabs/revision-compare/revision-scope-proposal.js';
import {
  createRevisionWorkspaceState, finishWorkspaceLoad, setWorkspaceProposal, startWorkspaceLoad,
} from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-18T07:45:00.000Z';
const text = (branches) => JSON.stringify({
  schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT',
  branches: branches.map((name) => ({ name, children: [{ type: 'PIPE' }] })),
});

function createDelayedCrypto() {
  const pending = [];
  return {
    cryptoRef: {
      subtle: {
        digest: (algorithm, data) => new Promise((resolve, reject) => {
          pending.push(async () => {
            try { resolve(await globalThis.crypto.subtle.digest(algorithm, data)); }
            catch (error) { reject(error); }
          });
        }),
      },
    },
    wait: async () => {
      for (let attempt = 0; attempt < 100 && !pending.length; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      assert(pending.length, 'expected a delayed digest request');
    },
    release: async () => {
      const operation = pending.shift();
      assert(operation, 'expected a pending digest request');
      await operation();
    },
  };
}

async function setupWorkspace(sessionId) {
  const service = createRevisionLoadService(globalThis.crypto, {
    clientFactory: () => createInlineRevisionWorkerClient(),
  });
  const a = await service.loadText('baseline', 'a.json', text(['/COMMON', '/A-ONLY']), NOW);
  const b = await service.loadText('candidate', 'b.json', text(['/COMMON', '/B-ONLY']), NOW);
  let state = createRevisionWorkspaceState(sessionId, NOW);
  state = startWorkspaceLoad(state, 'baseline', a.generation, 'a.json', a.document.fileSizeBytes, NOW);
  state = finishWorkspaceLoad(state, 'baseline', a, NOW);
  state = startWorkspaceLoad(state, 'candidate', b.generation, 'b.json', b.document.fileSizeBytes, NOW);
  state = finishWorkspaceLoad(state, 'candidate', b, NOW);
  const proposal = await createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, {}, globalThis.crypto);
  state = setWorkspaceProposal(state, proposal, {});
  return { service, state };
}

function actionHarness(setup, delayed) {
  let state = setup.state;
  const actions = createRevisionActions({
    root: { querySelector: () => null },
    options: {},
    service: setup.service,
    cryptoRef: delayed.cryptoRef,
    readState: () => state,
    writeState: (next) => { state = next; },
    render: () => {},
    now: () => NOW,
    downloadArtifact: () => {},
  });
  return { actions, readState: () => state };
}

{
  const setup = await setupWorkspace('proposal-race');
  const delayed = createDelayedCrypto();
  const harness = actionHarness(setup, delayed);
  const pendingProposal = harness.actions.setBranchIncluded('branch:/A-ONLY', false);
  await delayed.wait();
  await harness.actions.cancel('baseline');
  await delayed.release();
  await pendingProposal;
  assert.equal(harness.readState().slots.baseline.status, 'EMPTY');
  assert.equal(harness.readState().proposal, null, 'stale proposal must not restore cancelled source state');
  assert.notEqual(harness.readState().basisStatus, 'CURRENT');
  setup.service.dispose();
}

{
  const setup = await setupWorkspace('basis-race');
  const delayed = createDelayedCrypto();
  const harness = actionHarness(setup, delayed);
  const pendingBasis = harness.actions.approveBasis();
  await delayed.wait();
  await harness.actions.cancel('baseline');
  await delayed.release();
  await pendingBasis;
  assert.equal(harness.readState().slots.baseline.status, 'EMPTY');
  assert.equal(harness.readState().basis, null, 'stale basis must not commit after source invalidation');
  assert.notEqual(harness.readState().basisStatus, 'CURRENT');
  setup.service.dispose();
}

{
  const failedClient = () => ({
    parse: () => Promise.reject(new Error('Injected worker failure')),
    filter: () => Promise.resolve({}),
    reset: () => Promise.resolve({}),
    dispose: () => {},
  });
  const service = createRevisionLoadService(globalThis.crypto, { clientFactory: failedClient });
  await assert.rejects(service.loadText('baseline', 'bad.json', text(['/A']), NOW), /Injected worker failure/);
  service.dispose();
}

console.log('revision-compare-owner-fixes.test.mjs passed');

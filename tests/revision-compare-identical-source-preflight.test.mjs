import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { revisionBasisApprovalReadiness } from '../tabs/revision-compare/revision-compare-readiness.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { createRevisionScopeProposal } from '../tabs/revision-compare/revision-scope-proposal.js';
import {
  createRevisionWorkspaceState,
  finishWorkspaceLoad,
} from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-30T02:55:00.000Z';
const IDENTICAL_BLOCKER = 'Rev A and Rev B are the same source. Replace either revision before approving the comparison basis.';

function staged(x) {
  return {
    schema: 'StagedJSON.v1',
    unit: 'mm',
    coordinateFrame: 'GLOBAL',
    verticalAxis: 'Z',
    branches: [{
      name: 'LINE-1',
      attributes: { OWNER_SITE: 'AREA-1', OWNER: 'PROJECTS' },
      children: [{ id: 'PIPE-1', position: { x, y: 0, z: 0 } }],
    }],
  };
}

async function loadSlot(service, state, slotId, fileName, value) {
  const generation = service.begin(slotId);
  const result = await service.loadText(slotId, fileName, JSON.stringify(value), NOW, generation);
  return finishWorkspaceLoad(state, slotId, result, NOW);
}

async function workspace(service, left, right) {
  let state = createRevisionWorkspaceState('identical-source-session', NOW);
  state = await loadSlot(service, state, 'baseline', 'rev-a.json', left);
  state = await loadSlot(service, state, 'candidate', 'rev-b.json', right);
  const proposal = await createRevisionScopeProposal(
    state.slots.baseline,
    state.slots.candidate,
    {},
    webcrypto,
  );
  return { proposal, state };
}

function assertIdenticalBlocked(state, proposal) {
  const preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, proposal);
  assert.equal(preflight.status, 'BLOCKED');
  assert(preflight.blockers.includes(IDENTICAL_BLOCKER));
  assert(!preflight.notes.includes('Rev A and Rev B file hashes are identical.'));
  assert.equal(revisionBasisApprovalReadiness(preflight).status, 'BLOCKED');
  assert(Object.isFrozen(preflight));
  assert(Object.isFrozen(preflight.blockers));
}

function assertDifferentReady(state, proposal) {
  const preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, proposal);
  assert.equal(preflight.status, 'READY');
  assert(!preflight.blockers.includes(IDENTICAL_BLOCKER));
  assert.equal(revisionBasisApprovalReadiness(preflight).status, 'READY');
}

async function run() {
  const service = createRevisionLoadService(webcrypto, {
    clientFactory: () => createInlineRevisionWorkerClient({ cryptoRef: webcrypto }),
  });
  try {
    const identical = await workspace(service, staged(0), staged(0));
    assertIdenticalBlocked(identical.state, identical.proposal);
    const different = await workspace(service, staged(0), staged(1));
    assertDifferentReady(different.state, different.proposal);
  } finally {
    service.dispose();
  }
}

await run();
console.log('revision-compare-identical-source-preflight: PASS');

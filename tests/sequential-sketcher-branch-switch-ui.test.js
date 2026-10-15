import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';

const registry = createSequentialBranchWorkspaceRegistry();
assert.deepEqual(registry.reset(['/B1', '/B2', '/B2', '']), ['/B1', '/B2']);
assert.deepEqual(registry.position('/B1'), { index: 0, count: 2 });
assert.equal(registry.adjacent('/B1', 1), '/B2');
assert.equal(registry.adjacent('/B1', -1), '/B1');
assert.equal(registry.adjacent('/B2', 1), '/B2');

const session1 = Object.freeze({ rootBranchId: '/B1', state: 'NOT_STARTED', strokeLedger: Object.freeze([]) });
const firstOpen = registry.open('/B1', () => session1);
assert.equal(firstOpen.restored, false);
assert.equal(firstOpen.snapshot.session, session1);
assert.equal(registry.savedCount(), 1);

const progressed = Object.freeze({ rootBranchId: '/B1', state: 'BUILDING', strokeLedger: Object.freeze([{ op: 'DRAW_PIPE' }]) });
registry.save('/B1', { session: progressed, selectedCandidateId: 'C-1' });
const restored = registry.open('/B1', () => { throw new Error('cached branch must not be recreated'); });
assert.equal(restored.restored, true);
assert.equal(restored.snapshot.session, progressed);
assert.equal(restored.snapshot.selectedCandidateId, 'C-1');
assert.equal(registry.status('/B1'), 'BUILDING');
assert.throws(() => registry.open('/UNKNOWN', () => session1), /Unknown Sequential Sketcher branch/);

const markup = readFileSync(new URL('../tabs/sequential-sketcher/sequential-sketcher-markup.js', import.meta.url), 'utf8');
for (const selector of [
  'data-ssk-branch-prev', 'data-ssk-branch-next', 'data-ssk-branch-position',
  'data-ssk-active-branch', 'data-ssk-active-branch-chip', 'data-ssk-saved-branches',
]) assert.match(markup, new RegExp(selector));
assert.match(markup, /aria-live="polite"/);

const workspace = readFileSync(new URL('../tabs/sequential-sketcher/sequential-sketcher-workspace.js', import.meta.url), 'utf8');
assert.match(workspace, /createSequentialBranchWorkspaceRegistry/);
assert.match(workspace, /saveActiveBranch/);
assert.match(workspace, /openBranch/);
assert.match(workspace, /navigateBranch/);
assert.match(workspace, /Restored .* committed operations/);
assert.match(workspace, /No construction was committed by the branch switch/);
assert.match(workspace, /No branch open/);
assert.match(workspace, /ArrowLeft/);
assert.match(workspace, /ArrowRight/);
const openBranchBody = workspace.slice(workspace.indexOf('function openBranch'), workspace.indexOf('function navigateBranch'));
assert.doesNotMatch(openBranchBody, /advanceConstruction|runConstructionUntilBlocked/, 'switching branches must not silently construct geometry');

const css = readFileSync(new URL('../tabs/sequential-sketcher/sequential-sketcher.css', import.meta.url), 'utf8');
for (const className of ['ssk-branch-nav', 'ssk-branch-context', 'ssk-active-branch-chip', 'ssk-toolbar-context']) {
  assert.match(css, new RegExp(`\\.${className}`));
}

console.log('sequential branch switching UI tests passed');

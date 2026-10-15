import assert from 'assert';
import { attemptCiiTargetApply, canExportModifiedTargetCii, createCiiWorkspaceStageModel } from '../tabs/cii-workspace/cii-workspace-placeholders.js';

const blockedStages = createCiiWorkspaceStageModel({ ready: false, blockers: ['WRITER_1A_UNSUPPORTED_OPERATION:RESTRAINT'] });
assert.strictEqual(blockedStages.length, 7);
const blocked06 = blockedStages.find((stage) => stage.id === '06');
assert.strictEqual(blocked06.status, 'BLOCKED_WRITER_1A');
assert.strictEqual(blocked06.actionEnabled, false);
assert(blocked06.blockers.includes('WRITER_1A_UNSUPPORTED_OPERATION:RESTRAINT'));
assert.strictEqual(blockedStages.find((stage) => stage.id === '07').modifiedTargetCiiExportEnabled, false);
assert.strictEqual(canExportModifiedTargetCii({ ready: false }), false);

const readyStages = createCiiWorkspaceStageModel({ ready: true, blockers: [], mutationCount: 3 });
const ready06 = readyStages.find((stage) => stage.id === '06');
assert.strictEqual(ready06.status, 'READY_WRITER_1A');
assert.strictEqual(ready06.actionEnabled, true);
assert.strictEqual(readyStages.find((stage) => stage.id === '07').modifiedTargetCiiExportEnabled, true);
assert.strictEqual(canExportModifiedTargetCii({ ready: true }), true);
assert.throws(() => attemptCiiTargetApply(), /USE_APPLY_CII_WORKSPACE_TARGET_WRITER_1A/);

console.log('CII Workspace Writer 1A Stage06 gate checks passed.');

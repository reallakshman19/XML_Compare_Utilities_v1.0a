import assert from 'node:assert/strict';

import {
  TRANSFER_EXPORT_COMMANDS,
  evaluateTransferExportCommandGate,
  isTransferExportCommand,
} from '../tabs/xml-compare-transfer-export-command-gate.js';

const commands = [
  'export-patched-target-xml',
  'export-transfer-audit-json',
  'download-transfer-proof-json',
  'copy-patched-target-preview',
  'export-transfer-artifact-bundle',
  'export-transfer-diff-summary-json',
  'export-transfer-change-ledger-json',
  'export-transfer-change-ledger-csv',
  'export-transfer-history-json',
];

assert.deepEqual([...TRANSFER_EXPORT_COMMANDS], commands, 'gate must cover every Transfer export/copy command');
for (const action of commands) assert.equal(isTransferExportCommand(action), true, `${action} must be gated`);
assert.equal(isTransferExportCommand('compare'), false, 'non-transfer commands must not be gated');

assert.equal(evaluateTransferExportCommandGate({ action: 'compare' }).allowed, true, 'non-transfer commands pass through');

const noStage = evaluateTransferExportCommandGate({
  action: 'export-patched-target-xml',
  inTransferReview: true,
  transferEvidence: 'none',
  hasVisibleCommand: false,
});
assert.equal(noStage.allowed, false, 'no-stage export must be blocked');
assert.match(noStage.nextAction, /Stage and apply transfer/i, 'no-stage command must point to stage/apply');

const staleDom = evaluateTransferExportCommandGate({
  action: 'export-transfer-artifact-bundle',
  inTransferReview: true,
  transferEvidence: 'available',
  hasVisibleCommand: false,
});
assert.equal(staleDom.allowed, false, 'stale/programmatic hidden command must be blocked');
assert.match(staleDom.reason, /not visible/i, 'stale command must explain visibility mismatch');

const disabled = evaluateTransferExportCommandGate({
  action: 'export-transfer-history-json',
  inTransferReview: true,
  transferEvidence: 'available',
  hasVisibleCommand: true,
  isDisabled: true,
  preflightStatus: 'not available',
});
assert.equal(disabled.allowed, false, 'disabled history export must be blocked');
assert.match(disabled.reason, /disabled/i, 'disabled command must explain readiness state');

const blockedPreflight = evaluateTransferExportCommandGate({
  action: 'export-transfer-change-ledger-json',
  inTransferReview: true,
  transferEvidence: 'available',
  hasVisibleCommand: true,
  preflightStatus: 'blocked',
});
assert.equal(blockedPreflight.allowed, false, 'blocked preflight command must be blocked');
assert.match(blockedPreflight.reason, /blocked/i, 'blocked preflight status must be reported');

const ready = evaluateTransferExportCommandGate({
  action: 'copy-patched-target-preview',
  inTransferReview: true,
  transferEvidence: 'available',
  hasVisibleCommand: true,
  isDisabled: false,
  preflightStatus: 'ready',
});
assert.equal(ready.allowed, true, 'visible enabled ready command must be allowed');

const missingReview = evaluateTransferExportCommandGate({
  action: 'export-transfer-audit-json',
  inTransferReview: false,
  transferEvidence: 'available',
  hasVisibleCommand: true,
  preflightStatus: 'ready',
});
assert.equal(missingReview.allowed, false, 'transfer export command outside Tab 2 must be blocked');

console.log('XML Compare Transfer export command gate tests passed');

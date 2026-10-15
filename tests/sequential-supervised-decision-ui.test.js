import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const contract = read('tabs/sequential-sketcher/construction/sequential-construction-contract.js');
assert.match(contract, /MANUAL_CONNECT/);
assert.match(contract, /REVERSE_COMPONENT/);
assert.match(contract, /DEFER_DECISION/);
assert.match(contract, /RESUME_DECISION/);
assert.match(contract, /UNDO_LAST_TRANSACTION/);
assert.match(contract, /transactionLedger/);
assert.match(contract, /undoStack/);
assert.match(contract, /deferredDecisionIds/);
assert.match(contract, /componentTraversalOverrides/);

const transactions = read('tabs/sequential-sketcher/construction/sequential-construction-transactions.js');
assert.match(transactions, /SequentialConstructionTransaction\.v1/);
assert.match(transactions, /beforeSnapshot/);
assert.match(transactions, /afterSnapshot/);
assert.match(transactions, /beforeFingerprint/);
assert.match(transactions, /afterFingerprint/);
assert.match(transactions, /externalBoundaryPolicyFingerprint/);
assert.match(transactions, /tolerancePolicyFingerprint/);
assert.match(transactions, /DECISION_DEFERRED/);
assert.match(transactions, /TRANSACTION_UNDONE/);

const actions = read('tabs/sequential-sketcher/construction/sequential-supervised-decision-actions.js');
assert.match(actions, /MANUAL_EVIDENCE_REQUIRED/);
assert.match(actions, /USER_MANUAL/);
assert.match(actions, /REVERSAL_REFERENCED_HEAD_REQUIRES_REVIEW/);
assert.match(actions, /SequentialComponentTraversalOverride\.v1/);
assert.match(actions, /reversibleComponentEntryPorts/);

const runtime = read('tabs/sequential-sketcher/construction/sequential-construction-runtime.js');
assert.match(runtime, /RUN_UNTIL_BLOCKED/);
assert.match(runtime, /recordSequentialConstructionTransaction/);
assert.match(runtime, /undoLastSequentialConstructionTransaction/);
assert.match(runtime, /currentDecisionRequest\?\.state === 'DEFERRED'/);

const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
assert.match(markup, /data-ssk-action=\"undo\"/);
assert.match(markup, /Undo transaction/);

const renderer = read('tabs/sequential-sketcher/canvas/sequential-construction-svg.js');
assert.match(renderer, /data-ssk-manual-connect/);
assert.match(renderer, /data-ssk-reverse-component/);
assert.match(renderer, /data-ssk-decision-reason/);
assert.match(renderer, /data-ssk-decision-evidence/);
assert.match(renderer, /DEFER_DECISION/);
assert.match(renderer, /RESUME_DECISION/);
assert.match(renderer, /Supervised transactions/);

const workspace = read('tabs/sequential-sketcher/sequential-sketcher-workspace.js');
assert.match(workspace, /DECISION_ACTIONS\.MANUAL_CONNECT/);
assert.match(workspace, /DECISION_ACTIONS\.REVERSE_COMPONENT/);
assert.match(workspace, /DECISION_ACTIONS\.UNDO_LAST_TRANSACTION/);
assert.match(workspace, /event\.key\.toLowerCase\(\) === 'z'/);
assert.match(workspace, /decisionPayload/);

console.log('sequential supervised decision transaction UI tests passed');

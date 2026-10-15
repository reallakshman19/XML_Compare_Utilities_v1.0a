import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const contract = read('tabs/sequential-sketcher/construction/sequential-construction-contract.js');
assert.match(contract, /REDO_LAST_TRANSACTION/);
assert.match(contract, /redoStack/);

const transactions = read('tabs/sequential-sketcher/construction/sequential-construction-transactions.js');
assert.match(transactions, /redoLastSequentialConstructionTransaction/);
assert.match(transactions, /NOTHING_TO_REDO/);
assert.match(transactions, /REDO_STATE_MISMATCH/);
assert.match(transactions, /REDO_SNAPSHOT_MISMATCH/);
assert.match(transactions, /TRANSACTION_REDONE/);
assert.match(transactions, /redoneTransactionId/);
assert.match(transactions, /currentFingerprint !== redone\.beforeFingerprint/);
assert.match(transactions, /afterFingerprint !== redone\.afterFingerprint/);
assert.match(transactions, /undoStack: \[\.\.\.\(session\.undoStack \|\| \[\]\), redone\]/);
assert.match(transactions, /redoStack,/);

const runtime = read('tabs/sequential-sketcher/construction/sequential-construction-runtime.js');
assert.match(runtime, /redoLastSequentialConstructionTransaction/);
assert.match(runtime, /DECISION_ACTIONS\.REDO_LAST_TRANSACTION/);

const controller = read('tabs/sequential-sketcher/construction/sequential-redo-controller.js');
assert.match(controller, /mountSequentialRedoController/);
assert.match(controller, /DECISION_ACTIONS\.REDO_LAST_TRANSACTION/);
assert.match(controller, /data-ssk-action="redo"/);
assert.match(controller, /key === 'z' && event\.shiftKey/);
assert.match(controller, /key === 'y'/);
assert.match(controller, /createConfirmedSequentialConstruction/);
assert.match(controller, /buildConfirmedConstructionSupportProjection/);
assert.match(controller, /branchRegistry\.save/);
assert.match(controller, /dispatchEvent\(new Event\('change'/);
assert.doesNotMatch(controller, /runConstructionUntilBlocked|advanceConstruction/,
  'redo UI must restore recorded state rather than re-execute construction');

const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
assert.match(markup, /data-ssk-action="redo"/);
assert.match(markup, /Redo transaction/);
assert.match(markup, /A new supervised action after undo clears the redo path/);

const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
assert.match(tab, /mountSequentialRedoController/);
assert.match(tab, /redoController\?\.destroy\(\)/);
assert.match(tab, /20260717-ssk-workspace-apply-receipts-1/);

const utility = read('tabs/psnm-utility-tab.js');
assert.match(utility, /20260718-ssk-geometry-order-1/);

console.log('sequential supervised redo UI tests passed');

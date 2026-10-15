import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ciiMultiSourceAnchorLedgerMarkup } from '../tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js';
import { _test as nextStepTest } from '../tabs/cii-workspace/cii-workspace-multisource-next-step-shell.js';

const inspection = { memberInspections: [
  { sourceId: 'S1', inspection: { baseAnchorSuggestions: [] } },
  { sourceId: 'S2', inspection: { baseAnchorSuggestions: [] } },
  { sourceId: 'S3', inspection: { baseAnchorSuggestions: [] } },
] };
const selected = new Map([['S1', new Set()], ['S2', new Set()], ['S3', new Set()]]);
const covered = new Map([
  ['S1', [{ sourceNodeId: '3870', targetNodeId: '870' }]],
  ['S2', [{ sourceNodeId: '120', targetNodeId: '40070' }]],
  ['S3', [{ sourceNodeId: '1890', targetNodeId: '21890' }]],
]);

const readyMarkup = ciiMultiSourceAnchorLedgerMarkup(inspection, selected, covered);
assert.match(readyMarkup, /3 \/ 3 SOURCE members covered/);
assert.match(readyMarkup, /Anchor authority READY/);
assert.match(readyMarkup, /data-ciiw-ms-compare-now/);
assert.doesNotMatch(readyMarkup, /data-ciiw-ms-compare-now disabled/);
assert.match(readyMarkup, /Compare Review tab is navigation only/);

const incomplete = new Map([['S1', covered.get('S1')], ['S2', []], ['S3', []]]);
const incompleteMarkup = ciiMultiSourceAnchorLedgerMarkup(inspection, selected, incomplete);
assert.match(incompleteMarkup, /Anchor authority incomplete/);
assert.match(incompleteMarkup, /data-ciiw-ms-compare-now disabled/);

const waitingReady = nextStepTest.transferWaitingMarkup(true);
assert.match(waitingReady, /Multi-source Writer2/);
assert.match(waitingReady, /Exact retained S1\/S2\/S3 custody is ready/);
assert.match(waitingReady, /READY FOR COMPARE/);
assert.match(waitingReady, /data-ciiw-ms-transfer-compare-now/);
assert.match(waitingReady, /Writer1A is not used/);
assert.doesNotMatch(waitingReady, /BLOCKED_WRITER_1A/);

const waitingBlocked = nextStepTest.transferWaitingMarkup(false);
assert.match(waitingBlocked, /exact retained S1\/S2\/S3 files/i);
assert.match(waitingBlocked, /WAITING FOR ANCHORS/);
assert.doesNotMatch(waitingBlocked, /data-ciiw-ms-transfer-compare-now/);

const adapter = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-next-step-shell.js', import.meta.url), 'utf8');
assert.match(adapter, /stages\.hidden = active/);
assert.match(adapter, /data-ciiw-ms-compare-now/);
assert.match(adapter, /data-ciiw-ms-transfer-compare-now/);

console.log('CII Writer2 multi-source next-step / legacy stage chrome checks: PASS');

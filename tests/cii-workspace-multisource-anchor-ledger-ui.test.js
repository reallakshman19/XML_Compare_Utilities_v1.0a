import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ciiMultiSourceAnchorLedgerMarkup,
  ciiMultiSourceAnchorLedgerRows,
} from '../tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js';
import {
  ciiMultiSourceBulkAcceptOutcome,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';

const bSuggestion = {
  sourceNodeId: '10', targetNodeId: '110', basisMethod: 'METHOD_B_NETWORK',
  methodB: { status: 'READY' },
};
const inspection = { memberInspections: [
  { sourceId: 'S1', inspection: { baseAnchorSuggestions: [bSuggestion] } },
  { sourceId: 'S2', inspection: { baseAnchorSuggestions: [] } },
  { sourceId: 'S3', inspection: { baseAnchorSuggestions: [] } },
] };
const selected = new Map([['S1', new Set(['10=>110'])], ['S2', new Set()], ['S3', new Set()]]);
const manual = new Map([
  ['S1', []],
  ['S2', [{ sourceNodeId: '120', targetNodeId: '40070' }]],
  ['S3', [{ sourceNodeId: '1890', targetNodeId: '21890' }]],
]);

const rows = ciiMultiSourceAnchorLedgerRows(inspection, selected, manual);
assert.equal(rows.length, 3);
assert(rows.some((row) => row.sourceId === 'S1' && row.authority === 'METHOD B'));
assert(rows.some((row) => row.sourceId === 'S2' && row.authority === 'USER LOCKED'));
const markup = ciiMultiSourceAnchorLedgerMarkup(inspection, selected, manual);
for (const token of ['Source-set Anchor Authority', 'MASTER LEDGER', '120', '40070', '1890', '21890', 'data-ciiw-ms-ledger-update', 'data-ciiw-ms-ledger-auto-remove']) assert(markup.includes(token), token);

const preview = { compareReview: { rows: [
  { correspondenceId: 'a1', decision: 'LOCKED', workflowStatus: 'LOCKED', confidence: 'LOCKED', identityBound: true },
  { correspondenceId: 'a2', decision: 'LOCKED', workflowStatus: 'LOCKED', confidence: 'LOCKED', identityBound: true },
  { correspondenceId: 'a3', decision: 'LOCKED', workflowStatus: 'LOCKED', confidence: 'LOCKED', identityBound: true },
  { correspondenceId: 'r1', decision: 'REVIEW', workflowStatus: 'REVIEW', confidence: 'REVIEW', identityBound: true },
] } };
const decisions = new Map();
const zero = ciiMultiSourceBulkAcceptOutcome(preview, decisions, 'HIGH');
assert.equal(zero.changed, false);
assert.equal(zero.count, 0);
assert.equal(zero.locked, 3);
assert(zero.message.includes('No HIGH correspondence rows are eligible'));
assert(zero.message.includes('3 reviewed anchor row(s) are already LOCKED'));
assert(zero.message.includes('Transfer Preview was not changed'));
assert.equal(decisions.size, 0);

const highPreview = { compareReview: { rows: [
  { correspondenceId: 'h1', confidence: 'HIGH', identityBound: true, decision: 'REVIEW', workflowStatus: 'READY' },
] } };
const highDecisions = new Map();
const high = ciiMultiSourceBulkAcceptOutcome(highPreview, highDecisions, 'HIGH');
assert.equal(high.changed, true);
assert.equal(high.count, 1);
assert.equal(highDecisions.get('h1'), 'ACCEPT');

const shell = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js', import.meta.url), 'utf8');
assert(shell.includes('ciiMultiSourceAnchorLedgerMarkup'));
assert(shell.includes('if (outcome.changed) markReviewDirty(outcome.message); else setMultiSourceStatus(container, outcome.message);'));

console.log('CII Writer2 source-set anchor master ledger + zero-count bulk no-op: PASS');

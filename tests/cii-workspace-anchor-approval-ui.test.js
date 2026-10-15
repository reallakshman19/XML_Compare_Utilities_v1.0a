import assert from 'assert';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../tabs/cii-workspace/cii-workspace-shell.js', import.meta.url), 'utf8');

assert(shell.includes('Base Anchor suggestions'), 'Tab1 must label paired base-anchor suggestions explicitly');
assert(shell.includes('data-ciiw-accept-anchor'), 'each paired base-anchor suggestion must have an Accept action');
assert(shell.includes('Node-number offsets, OD and wall are not used.'), 'base-anchor UI must state excluded identity evidence');
assert(shell.includes('Accept all HIGH'), 'Correspondence Review must expose bulk HIGH acceptance');
assert(shell.includes('Accept all MEDIUM'), 'Correspondence Review must expose bulk MEDIUM acceptance');
assert(shell.includes('REVIEW and UNRESOLVED rows are never bulk accepted.'), 'bulk acceptance must retain fail-closed review boundary');
assert(shell.includes("row.confidence !== confidence || !row.identityBound"), 'bulk acceptance must require the selected confidence and bound identity');
assert(shell.includes("row.decision === 'LOCKED'"), 'bulk acceptance must preserve already locked rows');
assert(shell.includes("decisions.set(row.correspondenceId, 'ACCEPT')"), 'bulk acceptance must only stage explicit ACCEPT decisions');
assert(shell.includes('<th>Approval</th><th>Source</th><th>Target</th>'), 'Engineering Delta Grid must expose Approval before delta evidence');
assert(shell.includes('Approval is inherited from the parent correspondence Decision above'), 'Delta approval must explicitly derive from correspondence review');
assert(shell.includes('updateCiiReviewDecisions(current.review, reviewFrom(decisions))'), 'approval must be bound through the existing review ledger before transfer refresh');
assert(shell.includes('<th>Approval authority</th>'), 'Transfer Preview rows must expose reviewed/locked authority');
assert(shell.includes('TRANSFER PREVIEW · BLOCKED'), 'Tab3 must preserve fail-closed mutation when Writer 1B is not fully qualified');
assert(shell.includes('TARGET MUTATION · WRITER 1B READY'), 'Tab3 must expose qualified Writer 1B mutation separately from preview readiness');
assert(shell.includes('<b>Preview plan:</b> ${h(plan.status)} · <b>Writer 1B:</b>'), 'Tab3 must expose preview readiness separately from writer readiness');
assert(shell.includes('every approved non-KEEP operation is Writer 1B qualified'), 'Writer 1B must be all-or-nothing across approved mutations');
assert(shell.includes('Apply approved Writer 1B changes to target CII'), 'Tab3 must expose the qualified Writer 1B mutation action');

console.log('CII base-anchor / approval-flow Writer 1B UI checks passed.');

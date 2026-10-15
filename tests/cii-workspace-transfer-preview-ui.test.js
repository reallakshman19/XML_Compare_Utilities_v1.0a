import assert from 'assert';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../tabs/cii-workspace/cii-workspace-shell.js', import.meta.url), 'utf8');

assert(shell.includes('<th>Action</th><th>Family</th><th>Property</th>'), 'Tab3 must expose transfer action + family + property');
assert(shell.includes('COPY ${h(byAction.COPY || 0)}'), 'Tab3 must expose COPY count');
assert(shell.includes('CREATE ${h(byAction.CREATE || 0)}'), 'Tab3 must expose CREATE count');
assert(shell.includes('DELETE ${h(byAction.DELETE || 0)}'), 'Tab3 must expose DELETE count');
assert(shell.includes('KEEP ${h(byAction.KEEP || 0)}'), 'Tab3 must expose KEEP count');
assert(shell.includes('Geometry, node numbering and topology remain protected'), 'Tab3 must retain model-structure protections');
assert(shell.includes('OD is conditional to plain non-reducer PIPE'), 'Tab3 must state conditional OD authority');
assert(shell.includes('SIF/TEE remains blocked'), 'Tab3 must state unresolved SIF/TEE mutation authority');
assert(shell.includes('TARGET MUTATION · WRITER 1B READY'), 'Tab3 must expose the qualified Writer 1B state');
assert(shell.includes('TRANSFER PREVIEW · BLOCKED'), 'Tab3 must preserve the fail-closed state');
assert(shell.includes("${readiness.ready ? '' : 'disabled'} data-ciiw-apply-target"), 'target apply button must be enabled only from Writer 1B readiness');
assert(shell.includes('applyCiiWorkspaceTargetWriter1B(current, baseInput.targetText'), 'Tab3 apply must call the qualified Writer 1B core path');
assert(shell.includes('unexpected semantic deltas ${applied.validation.unexpectedSemanticDeltaCount}'), 'UI must surface negative-assurance result after export');
assert(!shell.includes('data-ciiw-apply>Apply to target CII'), 'legacy duplicate Stage06 apply control must remain removed');

console.log('CII Transfer Preview Writer 1B UI checks passed.');

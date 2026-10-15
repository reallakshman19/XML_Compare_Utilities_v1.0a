import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function source(relative) {
  return readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
}

const contracts = source('core/scoped-edit-runtime/scoped-edit-command-contracts.js');
const runtime = source('core/scoped-edit-runtime/scoped-edit-command-runtime.js');
const dragRuntime = source('core/scoped-edit-runtime/scoped-edit-runtime.js');
const index = source('core/scoped-edit-runtime/index.js');

for (const [name, value] of [['command contracts', contracts], ['command runtime', runtime]]) {
  assert(value.split(/\r?\n/).length <= 300, `${name} must remain under 300 lines`);
  assert.doesNotMatch(value, /export\s+default/);
}

assert.match(runtime, /prepareCommand/);
assert.match(runtime, /commitPrepared/);
assert.match(runtime, /COMMAND_NOT_ALLOWED/);
assert.match(runtime, /SCOPE_REVALIDATION_FAILED/);
assert.doesNotMatch(runtime, /beginDrag|solveDrag|cancelDrag|createEditDragSession|validateEdit3DDragRequest|zero-distance/i);
assert.doesNotMatch(contracts, /dragResult|dragState|Edit3DDrag/);
assert.match(index, /scoped-edit-command-contracts\.js/);
assert.match(index, /scoped-edit-command-runtime\.js/);
assert.doesNotMatch(dragRuntime, /prepareCommand|COMMAND_ONLY|allowedCommandNames/);

console.log('[PASS] CORE-SCR-1 static containment: additive command runtime; drag runtime unchanged.');

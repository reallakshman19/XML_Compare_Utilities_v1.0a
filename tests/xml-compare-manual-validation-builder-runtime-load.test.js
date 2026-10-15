import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installXmlCompareManualValidationBuilderRuntime } from '../tabs/xml-compare-manual-validation-builder-runtime.js';
import { manualValidationActionFromClick } from '../tabs/xml-compare-manual-validation-builder-actions.js';

const shell = fs.readFileSync(new URL('../xml-compare/XmlCompareWorkspaceShell.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../tabs/xml-compare-manual-validation-builder-runtime.js', import.meta.url), 'utf8');
const tab = fs.readFileSync(new URL('../tabs/xml-compare-tab.js', import.meta.url), 'utf8');

assert.equal(shell.includes('xml-compare-manual-validation-builder-runtime.js'), false, 'workspace shell no longer imports manual validation sidecar runtime');
assert.equal(shell.includes('loadManualValidationBuilderRuntime'), false, 'workspace shell no longer tracks manual validation runtime promise');
assert.equal(runtime.includes('addEventListener'), false, 'manual validation sidecar has no document listener');
assert.equal(runtime.includes('capture'), false, 'manual validation sidecar has no capture-phase ownership');
assert.equal(runtime.includes('stopPropagation'), false, 'manual validation sidecar does not stop propagation');
assert.equal(runtime.includes('dispatchEvent'), false, 'manual validation sidecar does not dispatch global state events');
assert.equal(installXmlCompareManualValidationBuilderRuntime(), false, 'manual validation runtime installer is inert');
assert.ok(tab.includes('manualValidationActionFromEvent'), 'tab imports native manual validation action mapper');
assert.ok(tab.includes('runManualValidationBuilderAction'), 'tab owns manual validation builder state update path');
assert.deepEqual(manualValidationActionFromClick({ dataset: { xmlCompareValidationBuilderFieldTypeTab: 'numeric' }, matches: (selector) => selector === '[data-xml-compare-validation-builder-field-type-tab]' }), { type: 'set-validation-builder-field-type', fieldType: 'numeric' });

console.log('XML Compare manual validation builder native runtime test passed');

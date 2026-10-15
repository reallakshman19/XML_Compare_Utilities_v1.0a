import assert from 'node:assert/strict';
import fs from 'node:fs';

import { transferStateActionFromButton, selectedTransferBlocksFromState } from '../tabs/xml-compare-transfer-state-button.js';
import { _test as runtimeTest } from '../tabs/xml-compare-transfer-apply-runtime.js';

const source = fs.readFileSync('tabs/xml-compare-transfer-apply-runtime.js', 'utf8');
const tabSource = fs.readFileSync('tabs/xml-compare-tab.js', 'utf8');
const shellSource = fs.readFileSync('xml-compare/XmlCompareWorkspaceShell.js', 'utf8');

assert.equal(shellSource.includes('xml-compare-transfer-apply-runtime'), false, 'workspace shell does not lazy-import transfer sidecar');
assert.equal(source.includes('document.addEventListener'), false, 'transfer sidecar does not install document listener');
assert.equal(source.includes('capture'), false, 'transfer sidecar does not use capture listeners');
assert.equal(source.includes('stopImmediatePropagation'), false, 'transfer sidecar does not stop native tab handling');
assert.equal(source.includes('data-xml-compare-automap-popup'), false, 'transfer sidecar does not depend on legacy automap popup');
assert.equal(source.includes('injectStyle'), false, 'dead style injection removed');
assert.equal(runtimeTest.installXmlCompareTransferApplyRuntime(), false, 'compat installer is intentionally inert');

const detail = transferStateActionFromButton({ dataset: { xmlCompareTransferStateAction: 'export-staged-transfer', xmlCompareTransferScope: 'node' } });
assert.deepEqual(detail, { type: 'export-staged-transfer', scope: 'node' });
assert.deepEqual(selectedTransferBlocksFromState({ aim: { transferBlocks: ['DerivedCoordinateBlock'] } }, { selectedBlocks: ['OldBlock'] }), ['DerivedCoordinateBlock']);
assert.ok(tabSource.includes('handleTransferStateButton'), 'tab lifecycle owns current transfer button handler');
assert.ok(tabSource.includes('afterStateAction(enriched, state)'), 'export path remains attached to native tab handler');

console.log('XML Compare inert transfer apply runtime tests passed');

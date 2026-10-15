import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { _test } from '../xml-compare/XmlCompareTabView.js';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import {
  UNIVERSAL_XML_CATEGORIZER_BUTTON_ATTR,
  UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR,
  renderUniversalXmlCategorizerButtonHtml,
  renderUniversalXmlCategorizerShellHtml,
} from '../xml-compare/universal-categorizer/universal-xml-categorizer-shell.js';
import { universalXmlCategorizerActionFromTarget } from '../tabs/xml-compare-universal-categorizer-runtime.js';

const button = renderUniversalXmlCategorizerButtonHtml();
assert.ok(button.includes('Universal XML Categorizer'));
assert.ok(button.includes(UNIVERSAL_XML_CATEGORIZER_BUTTON_ATTR));

const shell = renderUniversalXmlCategorizerShellHtml(createLinewiseUniversalPreset());
assert.ok(shell.includes(UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR));
assert.ok(shell.includes('Universal Categorizer Workspace'));
assert.ok(shell.includes('Sample preview'));
assert.ok(shell.includes('Export locked'));
assert.ok(shell.includes('Source column review'));
assert.ok(shell.includes('Column role review'));
assert.ok(shell.includes('Structure Recipe Builder'));
assert.ok(shell.includes('Selected item properties'));
assert.ok(shell.includes('Mapping Workbench'));
assert.ok(shell.includes('Mapping review queue'));
assert.ok(shell.includes('Sample value mapping trace'));
assert.ok(shell.includes('Mapping confidence'));
assert.ok(shell.includes('XML export locked'));
assert.ok(shell.includes('Advanced / Developer diagnostics'));
assert.ok(shell.includes('data-uxc-preview-mount'));
assert.ok(!shell.includes('Graph signature:'));

const toolbar = _test.toolbar(minimalState());
assert.ok(toolbar.includes('Line-wise XML Enrichment / Categorized XML'));
assert.ok(toolbar.includes('Universal XML Categorizer'));
assert.ok(toolbar.indexOf('Line-wise XML Enrichment / Categorized XML') < toolbar.indexOf('Universal XML Categorizer'));

const runtimeSource = readFileSync('tabs/xml-compare-universal-categorizer-runtime.js', 'utf8');
assert.match(runtimeSource, /XML_COMPARE_UNIVERSAL_CATEGORIZER_RUNTIME_SCHEMA/);
assert.match(runtimeSource, /export function installUniversalXmlCategorizerRuntime/);
assert.doesNotMatch(runtimeSource, /\ninstallUniversalXmlCategorizerRuntime\(\);/);
assert.match(runtimeSource, /WeakMap/);
assert.doesNotMatch(runtimeSource, /runtimeInstalled|MutationObserver/);
const tabSource = readFileSync('tabs/xml-compare-tab.js', 'utf8');
assert.match(tabSource, /installUniversalXmlCategorizerRuntime\(document\)/);
assert.match(tabSource, /publishUniversalViewportContext\(document, \{ state, workspace \}\)/);
assert.match(tabSource, /universalCategorizerRuntime\?\.destroy/);

assert.equal(universalXmlCategorizerActionFromTarget(fakeTarget(true, false)), 'open');
assert.equal(universalXmlCategorizerActionFromTarget(fakeTarget(false, true)), 'close');
assert.equal(universalXmlCategorizerActionFromTarget(fakeTarget(false, false)), '');

function fakeTarget(isButton, isClose) {
  return { closest: (selector) => (isButton && selector.includes('universal-categorizer-open')) || (isClose && selector.includes('universal-categorizer-close')) ? {} : null, matches: () => false };
}
function minimalState() { return { fileA: null, fileB: null, textA: '', textB: '', filters: { severity: 'ALL', search: '' }, report: null }; }

console.log('xml-compare-universal-categorizer-ui tests passed');

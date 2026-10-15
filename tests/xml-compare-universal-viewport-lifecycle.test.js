import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUniversalViewportContext } from '../xml-compare/universal-categorizer/universal-viewport-context.js';
import { _test as lifecycleTest } from '../xml-compare/universal-categorizer/universal-viewport-lifecycle.js';
import {
  universalXmlCategorizerActionFromTarget,
} from '../tabs/xml-compare-universal-categorizer-runtime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEW_FILES = [
  'universal-viewport-context.js',
  'universal-viewport-state.js',
  'universal-tree-viewport-host.js',
  'universal-pivot-viewport-host.js',
  'universal-viewport-shell-model.js',
  'universal-viewport-shell-view.js',
  'universal-viewport-lifecycle.js',
  'universal-review-panels-view.js',
];
const DIR = path.join(ROOT, 'xml-compare/universal-categorizer');

const loadedContext = createUniversalViewportContext({
  state: { workspaceRevision: 1 },
  workspace: {
    source: { fileName: 'source.xml', records: [{ uid: 's1', fromNode: '10', toNode: '20', lineNo: 'LINE-100' }] },
    target: { fileName: 'target.xml', records: [
      { uid: 'e1', levelId: 'element', elementKey: '10+20', displayName: 'Element 10-20' },
      { uid: 'n1', levelId: 'node', nodeNumber: '10', displayName: 'Node 10' },
    ] },
  },
});
const loadedView = lifecycleTest.viewModelFor(loadedContext);
assert.equal(loadedContext.status, 'loaded');
assert.equal(loadedView.samplePreview.exportLocked, true);
assert.ok(loadedView.samplePreview.tree.nodes.length > 0);
assert.ok(loadedView.samplePreview.pivot.rows.length > 0);

const sampleContext = createUniversalViewportContext({});
const sampleView = lifecycleTest.viewModelFor(sampleContext);
assert.equal(sampleContext.status, 'sample');
assert.equal(sampleView.samplePreview.exportLocked, true);
assert.ok(sampleView.samplePreview.tree.nodes.length > 0);
const seeds = lifecycleTest.seedHosts('signature');
assert.equal(seeds.tree.namespace, 'xml-builder');
assert.ok(!seeds.tree.capabilities.includes('grid'));
assert.ok(!seeds.pivot.capabilities.includes('grid'));
assert.ok(!seeds.tree.capabilities.includes('scale-ratio'));

for (const file of NEW_FILES) {
  const source = fs.readFileSync(path.join(DIR, file), 'utf8');
  assert.ok(source.split(/\r?\n/).length < 300, `${file} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/, `${file} must use named exports`);
  assert.doesNotMatch(source, /pipeline-3d-model|PipelineCad|CategorizedGraph.*=/, `${file} must not import Pipeline or replace graph authority`);
}
const runtime = fs.readFileSync(path.join(ROOT, 'tabs/xml-compare-universal-categorizer-runtime.js'), 'utf8');
assert.doesNotMatch(runtime, /runtimeInstalled|MutationObserver/);
assert.doesNotMatch(runtime, /\ninstallUniversalXmlCategorizerRuntime\(\);/);
assert.match(runtime, /WeakMap/);
assert.match(runtime, /mountUniversalViewportLifecycle/);
const tab = fs.readFileSync(path.join(ROOT, 'tabs/xml-compare-tab.js'), 'utf8');
assert.match(tab, /publishUniversalViewportContext\(document, \{ state, workspace \}\)/);
assert.match(tab, /installUniversalXmlCategorizerRuntime\(document\)/);
assert.match(tab, /universalCategorizerRuntime\?\.destroy/);
const view = fs.readFileSync(path.join(ROOT, 'xml-compare/XmlCompareTabView.js'), 'utf8');
assert.doesNotMatch(view, /publishUniversalViewportContext/);
const shell = fs.readFileSync(path.join(DIR, 'universal-xml-categorizer-shell.js'), 'utf8');
assert.ok(shell.split(/\r?\n/).length < 300);
assert.match(shell, /Loaded preview|contextStatus/);
assert.match(shell, /Export locked/);
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.ok(packageJson.scripts['test:xml-builder-viewport']);
assert.ok(packageJson.scripts['test:xml-builder-viewport-browser']);

function fakeTarget(kind) {
  return {
    closest(selector) {
      if (kind === 'open' && selector.includes('universal-categorizer-open')) return {};
      if (kind === 'close' && selector.includes('universal-categorizer-close')) return {};
      return null;
    },
    matches: () => false,
  };
}
assert.equal(universalXmlCategorizerActionFromTarget(fakeTarget('open')), 'open');
assert.equal(universalXmlCategorizerActionFromTarget(fakeTarget('close')), 'close');
assert.equal(universalXmlCategorizerActionFromTarget(fakeTarget('none')), '');

console.log('xml-compare universal viewport lifecycle tests passed');

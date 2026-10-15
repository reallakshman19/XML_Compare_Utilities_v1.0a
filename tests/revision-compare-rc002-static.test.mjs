import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../tabs/revision-compare/', import.meta.url);
const names = (await readdir(root)).filter((name) => name.endsWith('.js')).sort();
const sources = new Map(await Promise.all(names.map(async (name) => [name, await readFile(new URL(name, root), 'utf8')])));
const adapter = 'revision-compare-viewer-adapter.js';
const workbenchImport = /workbench3d\/viewer\/workbench-viewer\.js/;
for (const [name, source] of sources) {
  if (workbenchImport.test(source)) assert.equal(name, adapter, `only ${adapter} may import the renderer`);
  assert.doesNotMatch(source, /workbench3d\/compare\//, `${name} imports forbidden compare authority`);
  assert.doesNotMatch(source, /\b(?:runCompare|DEFAULT_COMPARE_CONFIG|buildComponentTopologyArtifacts|annotateTopology|buildConnectorModel|buildTransferPlan|batchApprove|applyTransferPlan|ConnectorModel|TransferPlan|registrationTranslation)\b/, `${name} contains forbidden authority`);
  assert.doesNotMatch(source, /revision-compare-wb3d/, `${name} restores the deleted Workbench bridge`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /codex\//, `${name} assumes a prohibited branch prefix`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\([^)]*(?:document|body)/s, `${name} adds a broad observer`);
  assert(source.split('\n').length < 300, `${name} exceeds 300 lines`);
}
assert(workbenchImport.test(sources.get(adapter)), 'viewer adapter must import the qualified renderer');
const deterministic = ['revision-compare-projection.js', 'revision-compare-matching.js', 'revision-compare-differences.js', 'revision-compare-audit.js'];
for (const name of deterministic) {
  const source = sources.get(name);
  assert.doesNotMatch(source, /Date\.now\s*\(|Math\.random\s*\(/, `${name} uses time/randomness in deterministic artifacts`);
}
const presentation = sources.get(adapter);
assert.doesNotMatch(presentation, /translate|rotation|offset|registration/i, 'presentation adapter must not alter engineering coordinates');
assert.match(presentation, /viewer\.setMode\(value\.mode\)/, 'presentation mode must be delegated to the renderer');
const selectionLine = presentation.split('\n').find((line) => line.includes('selectDifference:'));
assert(selectionLine && !selectionLine.includes('fit'), 'queue selection must not auto-fit');

console.log('revision-compare-rc002-static.test.mjs passed');

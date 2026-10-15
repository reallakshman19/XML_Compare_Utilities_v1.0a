import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../tabs/revision-compare/', import.meta.url);
const names = (await readdir(root)).filter((name) => name.endsWith('.js')).sort();
const sources = new Map(await Promise.all(names.map(async (name) => [name, await readFile(new URL(name, root), 'utf8')])));
const adapter = 'revision-compare-viewer-adapter.js'; const rendererImport = /workbench3d\/viewer\/workbench-viewer\.js/;
for (const [name, source] of sources) {
  if (rendererImport.test(source)) assert.equal(name, adapter, `only ${adapter} may import the qualified renderer`);
  assert.doesNotMatch(source, /workbench3d\/compare\//, `${name} imports forbidden Workbench compare authority`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /codex\//, `${name} assumes a prohibited branch prefix`);
  assert.doesNotMatch(source, /new\s+MutationObserver|document\.body\.addEventListener/, `${name} introduces broad DOM observation`);
  assert(source.split(/\r?\n/).length < 300, `${name} reaches the 300-line production limit`);
}
assert(rendererImport.test(sources.get(adapter)), 'viewer adapter must retain the sole qualified renderer import');
const decisionNames = names.filter((name) => name.startsWith('revision-decision-'));
for (const name of decisionNames) {
  const source = sources.get(name);
  assert.doesNotMatch(source, /Date\.now\s*\(|Math\.random\s*\(/, `${name} uses nondeterminism in decision identity`);
  assert.doesNotMatch(source, /revision-compare-(?:matching|worker|engine|projection|differences)/, `${name} imports comparison or candidate-generation authority`);
  assert.doesNotMatch(source, /matchBoundedCandidates|matchExactIdentities|scoreCandidate|projectCompareRecords|compareEngineeringProperties|compareSupportedGeometry/, `${name} reruns comparison evidence`);
  assert.doesNotMatch(source, /buildTransferPlan|applyTransferPlan|writeXml|updatedTarget|ConnectorModel|registrationTranslation|PipeStress|PSI/i, `${name} contains forbidden downstream authority`);
  assert.doesNotMatch(source, /\.(?:differenceCategory|matchCertainty|reviewState|note)\s*=(?!=)/, `${name} mutates audit or RC-003 dimensions`);
  assert.doesNotMatch(source, /translation|rotation|registration|coordinateOffset/i, `${name} introduces presentation or engineering transforms`);
  assert.doesNotMatch(source, /productionFallback|mockEvidence|fallbackCandidate/i, `${name} introduces hidden evidence fallback`);
}
const viewer = sources.get(adapter);
const previewLine = viewer.split(/\r?\n/).find((line) => line.includes('previewPair:'));
assert(previewLine && !/fit/i.test(previewLine), 'candidate preview must not auto-fit');
const decisionView = sources.get('revision-decision-view.js');
assert.doesNotMatch(decisionView, /Worker|postMessage|compareService|projectCompareRecords/, 'evidence disclosure must not invoke workers or comparison');
const ledger = sources.get('revision-decision-ledger.js');
assert.match(ledger, /activeTargetReservations\(ledger\)\.get\(targetRecordId\)/, 'target reservations must use indexed lookup');
assert.doesNotMatch(ledger, /for\s*\([^)]*decisions[^)]*\)[\s\S]{0,120}for\s*\(/, 'ledger must not nest source-by-target scans');

console.log('revision-compare-rc004-static.test.mjs passed');

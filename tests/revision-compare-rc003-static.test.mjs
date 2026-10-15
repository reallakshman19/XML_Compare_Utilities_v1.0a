import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../tabs/revision-compare/', import.meta.url);
const names = (await readdir(root)).filter((name) => name.endsWith('.js')).sort();
const sources = new Map(await Promise.all(names.map(async (name) => [name, await readFile(new URL(name, root), 'utf8')])));
const rendererImport = /workbench3d\/viewer\/workbench-viewer\.js/;
const alwaysForbidden = /workbench3d\/compare\/|buildTransferPlan|applyTransferPlan|ConnectorModel|registrationTranslation|PipeStress|PSI|writeXml|updated target XML/i;
const rc004Authority = /manualCandidate|acceptCandidate|resolveAmbiguity|decisionLedger/i;
const rc004Files = new Set([
  'revision-compare-actions.js', 'revision-compare-view.js', 'revision-compare-viewer-adapter.js',
  'revision-compare-workspace.js', 'revision-review-view.js', 'revision-workspace-state.js',
  'revision-evidence-package.js', 'revision-sign-off.js',
]);
for (const name of names) if (name.startsWith('revision-decision-')) rc004Files.add(name);
for (const [name, source] of sources) {
  if (rendererImport.test(source)) assert.equal(name, 'revision-compare-viewer-adapter.js');
  assert.doesNotMatch(source, alwaysForbidden, `${name} adds forbidden downstream authority`);
  if (!rc004Files.has(name) && !name.startsWith('revision-transfer-')) assert.doesNotMatch(source, rc004Authority, `${name} adds RC-004 authority outside the authorized modules`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /codex\//, `${name} assumes a prohibited branch`);
  assert.doesNotMatch(source, /new\s+MutationObserver|document\.body\.addEventListener/, `${name} adds broad DOM observation`);
  assert(source.split(/\r?\n/).length < 300, `${name} reaches the 300-line production limit`);
}
for (const name of ['revision-review-contracts.js', 'revision-review-session.js', 'revision-review-priority.js', 'revision-review-manifest.js']) {
  const source = sources.get(name); assert(source, `${name} is missing`);
  assert.doesNotMatch(source, /Date\.now\s*\(|Math\.random\s*\(/, `${name} uses nondeterministic session identity`);
  assert.doesNotMatch(source, /\.differenceCategory\s*=(?!=)|\.matchCertainty\s*=(?!=)/, `${name} mutates comparison dimensions`);
  assert.doesNotMatch(source, /visualModels|segments\s*:|markers\s*:/, `${name} copies presentation geometry into review evidence`);
  assert.doesNotMatch(source, rc004Authority, `${name} mutates or owns RC-004 decision authority`);
}
const evidence = sources.get('revision-review-view.js');
assert.doesNotMatch(evidence, /projectCompareRecords|matchExactIdentities|matchBoundedCandidates|runRevisionCompare|compareService|Worker\s*\(/, 'progressive evidence invokes comparison authority');
assert.match(evidence, /audit\.candidateEvidence/, 'progressive evidence must use persisted candidate evidence');
const actions = sources.get('revision-compare-actions.js');
for (const marker of ['setReviewState', 'saveReviewNote', 'navigateReview']) {
  const start = actions.indexOf(`function ${marker}`); const block = actions.slice(start, actions.indexOf('\n}', start) + 2);
  assert(start >= 0 && !/fitAll|fitSelected/.test(block), `${marker} moves the camera`);
}
const viewer = sources.get('revision-compare-viewer-adapter.js');
assert(rendererImport.test(viewer), 'existing viewer adapter must retain the sole qualified renderer import');
console.log('revision-compare-rc003-static.test.mjs passed');

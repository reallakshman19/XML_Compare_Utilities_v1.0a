import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function source(relative) {
  return readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
}
const paths = [
  'tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-move-snap-sources.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-move-snap-intersections.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-move-snap-acquisition.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-move-snap-review-store.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-move-snap-feature.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-feature.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-panel.js',
];
const sources = Object.fromEntries(paths.map((path) => [path, source(path)]));
for (const [path, value] of Object.entries(sources)) {
  assert(value.split(/\r?\n/).length <= 300, `${path} must remain under 300 lines`);
  assert.doesNotMatch(value, /export\s+default|module\.exports|exports\./);
}
const combined = Object.values(sources).join('\n');
assert.doesNotMatch(combined,
  /publishCandidate|commandGateway|localStorage|sessionStorage|indexedDB|appendEditCommand/);
assert.doesNotMatch(combined, /setGhostModel|createWorkbenchViewer|renderer\.domElement/,
  'SSK-TS-3M must not modify or own the generic viewer runtime');
const acquisition = sources[paths[3]];
assert.match(acquisition, /rankEngineeringSvgSnapCandidates/);
assert.match(acquisition, /suggestedCandidateId/);
assert.doesNotMatch(acquisition, /selectedCandidateId\s*:/);
const review = sources[paths[4]];
assert.match(review, /clearSelection/);
assert.match(review, /validateSequentialMoveSnapSelection/);
const moveDraft = sources[paths[6]];
assert.match(moveDraft, /rawDelta/);
assert.match(moveDraft, /snapSelection/);
assert.match(moveDraft, /publicationState: 'NOT_PUBLISHED'/);
const moveFeature = sources[paths[7]];
assert.match(moveFeature, /acquireForPreview/);
assert.match(moveFeature, /onSnapUse/);
assert.match(moveFeature, /onSnapClear/);
const panel = sources[paths[8]];
for (const label of ['Previous', 'Next', 'Use candidate', 'Clear snap']) {
  assert.match(panel, new RegExp(label));
}
assert.match(panel, /not automatically selected/);
const index = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-index.js');
for (const moduleName of ['sequential-move-snap-contracts', 'sequential-move-snap-sources',
  'sequential-move-snap-intersections', 'sequential-move-snap-acquisition',
  'sequential-move-snap-review-store', 'sequential-move-snap-feature']) {
  assert.match(index, new RegExp(moduleName));
}

console.log('Sequential move snap static containment: ok');

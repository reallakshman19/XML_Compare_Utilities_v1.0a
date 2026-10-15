import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSequentialEngineeringSvgProductionAdoptionDecision,
} from '../tabs/sequential-sketcher/sequential-engineering-svg-production-readiness.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const EVALUATED_MAIN_SHA = 'afa8388a4cead865fcafae856b8c629d88ab0162';
const decision = createSequentialEngineeringSvgProductionAdoptionDecision(EVALUATED_MAIN_SHA);

const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
const workspace = read('tabs/sequential-sketcher/sequential-sketcher-workspace.js');
const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
const canvas = read('tabs/sequential-sketcher/canvas/sequential-construction-svg.js');
const projection = read('tabs/sequential-sketcher/sequential-sketcher-projection.js');
const adapter = read('tabs/sequential-sketcher/sequential-engineering-svg-adapter.js');
const scene = read('tabs/sequential-sketcher/sequential-engineering-svg-scene.js');
const shadow = read('tabs/sequential-sketcher/sequential-engineering-svg-shadow-workspace.js');
const readiness = read('tabs/sequential-sketcher/sequential-engineering-svg-production-readiness.js');
const evidenceModel = read('tabs/sequential-sketcher/source/sequential-evidence-model.js');
const packageJson = JSON.parse(read('package.json'));

assert.match(tab, /mountSequentialSketcherWorkspace/);
assert.match(workspace, /renderSequentialConstructionCanvas/);
assert.match(workspace, /renderConstructionInspector/);
assert.match(markup, /data-ssk-canvas/);
assert.match(canvas, /data-ssk-layer="candidate-connections"/);
assert.match(canvas, /data-ssk-candidate-id/);

for (const source of [tab, workspace, markup]) {
  assert.doesNotMatch(source, /sequential-engineering-svg-shadow-workspace/);
  assert.doesNotMatch(source, /sequential-engineering-svg-production-readiness/);
}

assert.match(workspace, /advanceConstruction/);
assert.match(workspace, /runConstructionUntilBlocked/);
assert.match(workspace, /applyConstructionDecision/);
for (const source of [adapter, shadow]) {
  assert.doesNotMatch(source, /from\s+['"][^'"]*sequential-construction-runtime/);
  assert.doesNotMatch(source, /applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked/);
}
assert.doesNotMatch(adapter, /commandGateway\s*:/);
assert.match(adapter, /accessMode:\s*'read-only'/);
assert.match(adapter, /editing:\s*false/);

assert.match(scene, /`ssk:candidate:\$\{candidate\.candidateId\}`/);
assert.match(scene, /candidateId:\s*candidate\.candidateId/);
assert.match(scene, /contributesToFit:\s*false/);
assert.doesNotMatch(adapter, /DECISION_ACTIONS|data-ssk-connect-candidate|data-ssk-reject-candidate/);
assert.doesNotMatch(shadow, /DECISION_ACTIONS|data-ssk-connect-candidate|data-ssk-reject-candidate/);

const projectionStart = workspace.indexOf('const view =');
const projectionEnd = workspace.indexOf('const canvasCandidate', projectionStart);
const projectionHandler = workspace.slice(projectionStart, projectionEnd);
assert.match(projectionHandler, /model\.mode\s*=\s*view/);
assert.match(projectionHandler, /repaint\(\)/);
assert.doesNotMatch(projectionHandler, /advanceConstruction|applyConstructionDecision|runConstructionUntilBlocked/);
assert.match(projection, /PROJECTION_MODES/);
assert.match(projection, /createViewportTransform/);

for (const selector of [
  'data-ssk-candidate-id',
  'data-ssk-select-candidate',
  'data-ssk-connect-candidate',
  'data-ssk-manual-connect',
  'data-ssk-reject-candidate',
  'data-ssk-decision-action',
  'data-ssk-action',
  'data-ssk-branch-prev',
  'data-ssk-branch-next',
]) assert.match(`${workspace}\n${canvas}`, new RegExp(selector));
assert.match(workspace, /event\.ctrlKey \|\| event\.metaKey/);
assert.match(workspace, /UNDO_LAST_TRANSACTION/);
assert.match(workspace, /event\.altKey/);
assert.match(workspace, /ArrowLeft/);
assert.match(workspace, /ArrowRight/);

for (const symbol of ['function inspect', 'function openBranch', 'async function onChange', 'destroy:']) {
  assert.match(workspace, new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(workspace, /model\.branchRegistry\.reset/);
assert.match(workspace, /model\.branchRegistry\.open/);
assert.match(workspace, /root\.removeEventListener\('click'/);
assert.match(tab, /continuityController\?\.destroy/);
assert.match(tab, /active\?\.destroy/);

for (const source of [adapter, shadow, readiness]) {
  assert.doesNotMatch(source, /window\.|document\.|dispatchEvent|addEventListener|CustomEvent/);
}
assert.match(adapter, /subscribeState/);
assert.match(shadow, /owner event requires reason/);
assert.match(shadow, /owner subscription must return an unsubscribe function/);

assert.match(evidenceModel, /return Object\.freeze\(\{/);
assert.match(evidenceModel, /branches:\s*new Map/);
assert.match(evidenceModel, /components:\s*new Map/);
assert.match(evidenceModel, /ports:\s*new Map/);
assert.doesNotMatch(evidenceModel, /readonlyMap|immutableMap/);

assert.equal(packageJson.scripts?.['test:sequential-sketcher'], undefined);
assert(decision.reviewItems.some((row) => row.code === 'SEQUENTIAL_PACKAGE_SCRIPT_MISSING'));
assert.equal(decision.evaluatedMainSha, EVALUATED_MAIN_SHA);
assert.equal(decision.status, 'REVIEW_REQUIRED');
assert.equal(decision.recommendedArchitecture.option, 'A');
assert.deepEqual(decision.allowedProductionFiles, []);
assert.equal(decision.proposedNextMission, null);
assert(decision.blockers.some((row) => row.code === 'PRODUCTION_INDEX_IMMUTABILITY_UNDEFINED'));
assert.equal(decision.indexBoundary.directMapPublicationAllowed, false);
assert(decision.selectionContract.prohibitedSharedClickEffects.includes('confirm-candidate'));
assert(decision.selectionContract.prohibitedSharedClickEffects.includes('change-active-port'));

const imports = [...readiness.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
assert.deepEqual(imports, ['../../core/engineering-scene/index.js']);
assert.ok(readiness.split(/\r?\n/).length <= 300);
assert.doesNotMatch(readiness, /export\s+default\b/);
assert.doesNotMatch(readiness, /Date\.now|new Date|Math\.random|localStorage|sessionStorage/);

console.log('Sequential Engineering SVG production adoption static boundary: ok');

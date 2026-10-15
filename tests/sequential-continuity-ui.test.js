import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const controller = read('tabs/sequential-sketcher/continuity/sequential-continuity-controller.js');
const model = read('tabs/sequential-sketcher/continuity/sequential-continuation-model.js');
const constructor = read('tabs/sequential-sketcher/continuity/sequential-network-constructor.js');
const renderer = read('tabs/sequential-sketcher/continuity/sequential-network-svg.js');
const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
const utility = read('tabs/psnm-utility-tab.js');

assert.match(controller, /Build entire geometry/);
assert.doesNotMatch(controller, />Construct geometry</);
assert.match(controller, /Export constructed source JSON/);
assert.match(controller, /Export source JSON · same import format/);
assert.match(controller, /Export workspace package/);
assert.match(controller, /Build the blocked review queue/);
assert.match(controller, /data-ssk-continuity-reference/);
assert.match(controller, /mountSequentialContinuityController/);
assert.match(model, /SequentialContinuationDraft\.v1/);
assert.match(model, /SequentialBlockedBranchReviewQueue\.v1/);
assert.match(constructor, /SequentialConstructedGeometry\.v1/);
assert.match(constructor, /BUILD_QUEUE_CONTINUITY/);
assert.match(constructor, /JSON\.stringify\(geometry\.records/);
assert.doesNotMatch(constructor, /SequentialWorkspacePackage\.v1/);
assert.match(renderer, /data-ssk-network-svg/);
assert.doesNotMatch(renderer, /canvas|getContext|WebGL/i);
assert.match(tab, /sequential-sketcher-workspace\.js\?v=20260718-ssk-geometry-order-1/);
assert.match(tab, /sequential-continuity-controller\.js\?v=20260717-ssk-continuity-geometry-1/);
assert.match(tab, /sequential-continuity\.css\?v=20260717-ssk-continuity-geometry-1/);
assert.match(utility, /sequential-sketcher-tab\.js\?v=20260718-ssk-geometry-order-1/);

for (const path of [
  'tabs/sequential-sketcher/continuity/sequential-continuation-model.js',
  'tabs/sequential-sketcher/continuity/sequential-network-constructor.js',
  'tabs/sequential-sketcher/continuity/sequential-network-svg.js',
  'tabs/sequential-sketcher/continuity/sequential-continuity-controller.js',
]) {
  const lines = read(path).split(/\r?\n/).length;
  assert.ok(lines <= 300, `${path} exceeds 300 lines`);
  assert.doesNotMatch(read(path), /export\s+default/);
  assert.doesNotMatch(read(path), /from\s+['"]node:|require\(|process\./);
}

console.log('sequential continuity UI/static tests passed');

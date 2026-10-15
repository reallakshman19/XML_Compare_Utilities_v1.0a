import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const moduleSource = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-keyplan-render-session.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js', import.meta.url), 'utf8');

assert.ok(moduleSource.split('\n').length <= 40, 'key-plan render session must remain below 40 lines');
assert.match(moduleSource, /export function createPipelineKeyPlanRenderSession/);
assert.match(moduleSource, /JSON\.stringify\(\[dpr, points \|\| \[\], sheets \|\| \[\], markers \|\| \[\]\]\)/);
assert.match(runtimeSource, /createPipelineKeyPlanRenderSession/);
assert.match(runtimeSource, /instance\.keyPlanSession\.render\(canvas/);
assert.match(runtimeSource, /keyPlanSession: createPipelineKeyPlanRenderSession\(paintKeyPlanCanvas\)/);
assert.match(runtimeSource, /instance\.keyPlanSession\.reset\(\)/);
assert.doesNotMatch(runtimeSource, /if \(canvas\) paintKeyPlanCanvas\(/);
assert.ok(runtimeSource.split('\n').length <= 300, 'profile runtime must remain below 300 lines');

console.log('pipeline-3d-model key-plan render session static: PASS');

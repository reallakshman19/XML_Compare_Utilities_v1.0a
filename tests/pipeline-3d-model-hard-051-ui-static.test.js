import assert from 'node:assert/strict';
import fs from 'node:fs';

const view = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-ui-view.js', import.meta.url), 'utf8');
const controller = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-ui.js', import.meta.url), 'utf8');
assert.match(view, /data-p3d-canonical-section-id/);
assert.match(view, /data-p3d-canonical-section-start/);
assert.match(view, /readonly aria-readonly="true"/);
assert.doesNotMatch(view, /data-p3d-config-action="add-section"/);
assert.doesNotMatch(view, /data-p3d-config-action="remove-section"/);
assert.match(view, /Assign selected branch fields to selected sections/);
assert.match(view, /data-p3d-config-assignment-confirm/);
assert.match(view, /Derived break length/);
assert.match(view, /Source-derived/);
assert.match(controller, /savePipelineEngineeringConfigurationDraft/);
assert.match(controller, /name === 'clear'/);
assert.match(controller, /clearDraft\(instance\)/);
console.log('pipeline-3d-model P3D-HARD-051 UI static: PASS');
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-derived-table-preview.js', import.meta.url), 'utf8');

assert.match(runtime, /buildPipelineDerivedTablePreviewHtml/);
assert.doesNotMatch(runtime, /function renderTsvGrid/);
assert.match(preview, /PIPELINE_DERIVED_TABLE_PREVIEW_HEAD_ROWS = 100/);
assert.match(preview, /PIPELINE_DERIVED_TABLE_PREVIEW_TAIL_ROWS = 100/);
assert.ok(preview.split(/\r?\n/).length < 120);
console.log('pipeline derived table preview static tests passed');

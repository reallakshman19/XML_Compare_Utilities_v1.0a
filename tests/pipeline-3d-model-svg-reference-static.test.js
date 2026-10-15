import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../tabs/pipeline-3d-model/', import.meta.url);
const runtime = fs.readFileSync(new URL('pipeline-3d-model-profile-propagation-runtime.js', root), 'utf8');
const view = fs.readFileSync(new URL('pipeline-3d-model-cad-workspace-view.js', root), 'utf8');
const reference = fs.readFileSync(new URL('pipeline-3d-model-svg-reference.js', root), 'utf8');

assert.match(runtime, /renderPipelineSvgPreview\(table2Svg/);
assert.doesNotMatch(runtime, /table2Svg\.innerHTML\s*=\s*createTable2XSVG/);
assert.match(view, /buildPipelineCadWorkspaceHtml\('table2x', originals\.table2x\)/);
assert.match(view, /opacity:\.38/);
assert.match(view, /filter:grayscale\(1\)/);
assert.match(view, /pointer-events:none/);
assert.doesNotMatch(view, /p3d-cad-svg-reference[^}]*display:none/);
assert.ok(reference.split(/\r?\n/).length < 40);
assert.doesNotMatch(reference, /export\s+default/);

console.log('pipeline-3d-model SVG reference static: PASS');

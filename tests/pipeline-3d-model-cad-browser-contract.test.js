import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const spec = readFileSync(new URL('./browser/pipeline-3d-model-cad-browser.spec.mjs', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./browser/pipeline-cad-fixture.html', import.meta.url), 'utf8');
const config = readFileSync(new URL('../playwright.pipeline-cad.config.mjs', import.meta.url), 'utf8');
const browserSpecCount = (config.match(/pipeline[^']*\.spec\.mjs/g) || []).length;
const workflowPath = new URL('../.github/workflows/pipeline-cad-browser-acceptance.yml', import.meta.url);
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
const layout = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-cad-layout-hardening.js', import.meta.url), 'utf8');
const runtimeConfig = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-config.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

for (const scenario of ['CAD-B01', 'CAD-B02', 'CAD-B03', 'CAD-B04', 'CAD-B05', 'CAD-B06']) {
  assert.match(spec, new RegExp(scenario));
}
assert.match(spec, /page\.mouse\.down/);
assert.match(spec, /page\.mouse\.wheel/);
assert.match(spec, /button: 'right'/);
assert.match(spec, /page\.keyboard\.press/);
assert.match(spec, /page\.screenshot/);
assert.match(spec, /console/);
assert.match(spec, /pageerror/);
assert.match(spec, /stabilizePipelineCadHosts/);
assert.match(spec, /box\.width \/ viewport\.width/);

assert.match(fixture, /pipeline-3d-model-cad-authoring\.js/);
assert.match(fixture, /mountPipelineCadWorkspace/);
assert.match(fixture, /data-p3d-split="table2x-preview"/);
assert.match(fixture, /data-p3d-split="table3x-preview"/);
assert.match(fixture, /__pipelineCadHarness/);

assert.match(layout, /\.p3d-cad-host>/);
assert.match(layout, /position:absolute!important/);
assert.match(layout, /contain:layout paint/);
assert.match(layout, /MutationObserver/);
assert.match(runtimeConfig, /pipeline-3d-model-cad-layout-hardening\.js/);

assert.ok(browserSpecCount >= 15);
assert.match(config, /browserName: 'chromium'/);
assert.match(config, /deviceScaleFactor: 1\.5/);
assert.match(config, /screenshot: 'only-on-failure'/);
assert.match(config, /trace: 'retain-on-failure'/);
assert.match(config, /video: 'retain-on-failure'/);
assert.match(config, /playwright-report\/pipeline-cad-browser/);
assert.match(config, /test-results\/pipeline-cad-browser/);
assert.match(config, /pipeline-cad-browser-results\.json/);
if (workflow) {
  assert.match(workflow, /@playwright\/test@1\.54\.1/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
}
assert.equal(packageJson.scripts['test:pipeline-cad-browser'], 'playwright test --config=playwright.pipeline-cad.config.mjs');

console.log('pipeline-3d-model CAD browser contract tests passed');
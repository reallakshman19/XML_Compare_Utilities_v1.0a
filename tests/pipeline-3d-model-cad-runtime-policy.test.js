import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY,
  PIPELINE_CAD_FALLBACK_STORAGE_KEY,
  PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY,
  PIPELINE_CAD_RENDERER_CANVAS,
  PIPELINE_CAD_RENDERER_STORAGE_KEY,
  PIPELINE_CAD_RENDERER_SVG,
  applyPipelineCadRendererPolicy,
  consumePipelineCadDialogReopen,
  handlePipelineCadRuntimeFailure,
  installPipelineCadDialogRestore,
  markPipelineCadDialogReopen,
  persistPipelineCadRenderer,
  requestPipelineCadRenderer,
  resolvePipelineCadRenderer,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-runtime-policy.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    snapshot() { return Object.fromEntries(map); },
  };
}

{
  const storage = memoryStorage();
  assert.equal(resolvePipelineCadRenderer({ storage, location: { search: '' } }), PIPELINE_CAD_RENDERER_CANVAS);
  assert.equal(applyPipelineCadRendererPolicy({ storage, location: { search: '' } }), PIPELINE_CAD_RENDERER_CANVAS);
  assert.equal(storage.getItem(PIPELINE_CAD_RENDERER_STORAGE_KEY), 'canvas');
  assert.equal(storage.getItem(PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY), '1');
}

{
  const storage = memoryStorage({ [PIPELINE_CAD_RENDERER_STORAGE_KEY]: 'canvas' });
  assert.equal(resolvePipelineCadRenderer({ storage, location: { search: '?pipelineCadRenderer=svg' } }), PIPELINE_CAD_RENDERER_SVG);
  assert.equal(resolvePipelineCadRenderer({ storage, location: { search: '?pipelineCadCanvas=0' } }), PIPELINE_CAD_RENDERER_SVG);
}

{
  const storage = memoryStorage({ [PIPELINE_CAD_RENDERER_STORAGE_KEY]: 'svg', [PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY]: '1' });
  assert.equal(resolvePipelineCadRenderer({ storage, location: { search: '' } }), PIPELINE_CAD_RENDERER_SVG);
  persistPipelineCadRenderer('canvas', storage);
  assert.equal(resolvePipelineCadRenderer({ storage, location: { search: '' } }), PIPELINE_CAD_RENDERER_CANVAS);
}

{
  const storage = memoryStorage({ [PIPELINE_CAD_RENDERER_STORAGE_KEY]: 'canvas', [PIPELINE_CAD_FALLBACK_STORAGE_KEY]: 'old' });
  const sessionStorage = memoryStorage();
  let navigated = '';
  requestPipelineCadRenderer('svg', {
    storage,
    sessionStorage,
    reopenDialog: true,
    location: { href: 'https://example.test/app?pipelineCadRenderer=canvas&x=1' },
    navigate(url) { navigated = url; },
  });
  assert.equal(storage.getItem(PIPELINE_CAD_RENDERER_STORAGE_KEY), 'svg');
  assert.equal(storage.getItem(PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY), null);
  assert.equal(storage.getItem(PIPELINE_CAD_FALLBACK_STORAGE_KEY), null);
  assert.equal(sessionStorage.getItem(PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY), '1');
  assert.match(navigated, /x=1/);
  assert.doesNotMatch(navigated, /pipelineCadRenderer/);
}

{
  const sessionStorage = memoryStorage();
  assert.equal(markPipelineCadDialogReopen(sessionStorage), true);
  let clicks = 0;
  const launcher = { click() { clicks += 1; } };
  const doc = { querySelector(selector) { return selector === '.pipeline-3d-model-dialog' ? null : launcher; } };
  installPipelineCadDialogRestore(doc, { sessionStorage });
  assert.equal(clicks, 1);
  assert.equal(consumePipelineCadDialogReopen(sessionStorage), false);
}

{
  const sessionStorage = memoryStorage({ [PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY]: '1' });
  let clicks = 0;
  const doc = { querySelector() { return { click() { clicks += 1; } }; } };
  installPipelineCadDialogRestore(doc, { sessionStorage });
  assert.equal(clicks, 0);
  assert.equal(consumePipelineCadDialogReopen(sessionStorage), false);
}

{
  const storage = memoryStorage({ [PIPELINE_CAD_RENDERER_STORAGE_KEY]: 'canvas', [PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY]: '1' });
  const sessionStorage = memoryStorage();
  let reloads = 0;
  assert.equal(handlePipelineCadRuntimeFailure(new Error('ordinary failure'), { storage, sessionStorage, reload: () => { reloads += 1; } }), false);
  assert.equal(handlePipelineCadRuntimeFailure(new Error('PipelineCad workspace initialization failed'), { storage, sessionStorage, reload: () => { reloads += 1; } }), true);
  assert.equal(storage.getItem(PIPELINE_CAD_RENDERER_STORAGE_KEY), 'svg');
  assert.equal(storage.getItem(PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY), null);
  assert.match(storage.getItem(PIPELINE_CAD_FALLBACK_STORAGE_KEY), /workspace initialization failed/);
  assert.equal(reloads, 1);
  handlePipelineCadRuntimeFailure(new Error('PipelineCad repeated failure'), { storage, sessionStorage, reload: () => { reloads += 1; } });
  assert.equal(reloads, 1);
}

const runtimeSource = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-cad-runtime-policy.js', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-config.js', import.meta.url), 'utf8');
const browserSpec = readFileSync(new URL('./browser/pipeline-cad-runtime-switch.spec.mjs', import.meta.url), 'utf8');
const browserFixture = readFileSync(new URL('./browser/pipeline-cad-runtime-switch-fixture.html', import.meta.url), 'utf8');
const playwrightConfig = readFileSync(new URL('../playwright.pipeline-cad.config.mjs', import.meta.url), 'utf8');

assert.equal(configSource.split('\n')[0], "import './pipeline-3d-model-cad-runtime-policy.js?v=20260713-cad-default-1';");
assert.match(runtimeSource, /return PIPELINE_CAD_RENDERER_CANVAS;/);
assert.match(runtimeSource, /pipelineCadRenderer/);
assert.match(runtimeSource, /Use Legacy SVG/);
assert.match(runtimeSource, /PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY/);
assert.match(runtimeSource, /installPipelineCadDialogRestore/);
assert.match(runtimeSource, /handlePipelineCadRuntimeFailure/);
assert.match(browserSpec, /CAD-R01/);
assert.match(browserSpec, /CAD-R02/);
assert.match(browserSpec, /CAD-R03/);
assert.match(browserFixture, /data-p3d-legacy-svg/);
assert.match(browserFixture, /pipeline-3d-model-config\.js/);
assert.match(playwrightConfig, /pipeline-cad-runtime-switch\.spec\.mjs/);

console.log('pipeline-3d-model CAD runtime policy tests passed');

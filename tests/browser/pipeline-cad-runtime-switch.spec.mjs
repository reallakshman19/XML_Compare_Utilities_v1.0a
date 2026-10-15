import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-runtime-switch-fixture.html';

async function cleanRendererState(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__pipelineCadRendererTestCleaned') === '1') return;
    localStorage.removeItem('pipeline3dCadRenderer');
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadCanvas');
    sessionStorage.clear();
    sessionStorage.setItem('__pipelineCadRendererTestCleaned', '1');
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => document.body.dataset.pipelineCadRuntimeReady === '1');
}

async function runtimeState(page) {
  return page.evaluate(() => window.__pipelineCadRuntimeState());
}

test.describe('Pipeline CAD guarded default renderer switch', () => {
  test('CAD-R01 — Canvas is the default renderer on a clean profile', async ({ page }) => {
    await cleanRendererState(page);
    await page.goto(FIXTURE);
    await waitReady(page);
    const state = await runtimeState(page);
    expect(state.renderer).toBe('canvas');
    expect(state.canvasStages).toBe(2);
    expect(state.legacySvgs).toBe(0);
    expect(state.label).toContain('Renderer: CAD Canvas');
    expect(state.action).toBe('Use Legacy SVG');
  });

  test('CAD-R02 — explicit SVG override preserves the legacy renderer', async ({ page }) => {
    await cleanRendererState(page);
    await page.goto(`${FIXTURE}?pipelineCadRenderer=svg`);
    await waitReady(page);
    const state = await runtimeState(page);
    expect(state.renderer).toBe('svg');
    expect(state.canvasStages).toBe(0);
    expect(state.legacySvgs).toBe(2);
    expect(state.label).toContain('Renderer: Legacy SVG');
    expect(state.action).toBe('Use CAD Canvas');
  });

  test('CAD-R03 — renderer control persists a switch back to Canvas', async ({ page }) => {
    await cleanRendererState(page);
    await page.goto(`${FIXTURE}?pipelineCadRenderer=svg`);
    await waitReady(page);
    await Promise.all([
      page.waitForNavigation(),
      page.locator('[data-p3d-cad-renderer-switch]').click(),
    ]);
    await waitReady(page);
    const state = await runtimeState(page);
    expect(state.renderer).toBe('canvas');
    expect(state.canvasStages).toBe(2);
    expect(state.legacySvgs).toBe(0);
    expect(page.url()).not.toContain('pipelineCadRenderer');
  });
});

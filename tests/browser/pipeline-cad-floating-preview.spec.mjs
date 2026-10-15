import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-floating-preview-fixture.html';
const CAD_FIXTURE = '/tests/browser/pipeline-cad-preview-modes-fixture.html';
const STORAGE_KEY = 'pipeline3dCadFloatingPreviewV1';

async function openCleanFixture(page) {
  await page.goto(FIXTURE);
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.floatingPreviewReady === '1');
  await page.locator('#open-preview').click();
  await expect(page.locator('[data-p3d-floating-preview="1"]')).toBeVisible();
}

async function openCadFixture(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('pipeline3dCadRenderer', 'canvas');
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadPreviewModeV1');
    localStorage.removeItem('pipeline3dCadFloatingPreviewV1');
  });
  await page.goto(CAD_FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadPreviewModesReady === '1', null, { timeout: 5000 });
  await page.waitForFunction(() => Boolean(window.__pipelineCadPreviewModesWorkspace?.controller?.model), null, { timeout: 5000 });
  expect(errors).toEqual([]);
  await page.locator('[data-p3d-split="btn-preview-x"]').click();
  await expect(page.locator('[data-p3d-floating-preview="1"]')).toBeVisible();
  await expect(page.locator('[data-p3d-cad-viewbar]')).toHaveCount(1);
}

async function floatingState(page) {
  return page.evaluate(() => window.__floatingPreviewState());
}

async function cadState(page) {
  return page.evaluate(() => {
    const workspace = window.__pipelineCadPreviewModesWorkspace;
    const table2 = workspace.graphs.table2x;
    const table3 = workspace.graphs.table3x;
    return {
      mountId: workspace.mountId,
      shellCount: document.querySelectorAll('[data-p3d-cad-viewbar]').length,
      mode: document.querySelector('[data-p3d-split="x-modal"]')?.dataset.p3dCadPreviewMode,
      raw2: document.querySelector('[data-p3d-split="table2a-raw"]')?.value || '',
      revision: workspace.controller.model.revision,
      nodes: workspace.controller.canvasManager.nodes,
      table2: {
        viewport: table2.getViewport(),
        range: table2.getPipelineCadHorizontalRange(),
        snap: table2.getSnapSettings(),
        gridVisible: table2.canvas.dataset.p3dCadGridVisible,
        xStep: table2.canvas.dataset.p3dCadGridXMajorStep,
      },
      table3: {
        viewport: table3.getViewport(),
        range: table3.getPipelineCadHorizontalRange(),
      },
    };
  });
}

async function setScale(page, horizontal, vertical) {
  await page.locator('[data-p3d-cad-h-scale]').fill(String(horizontal));
  await page.locator('[data-p3d-cad-h-scale]').blur();
  await page.locator('[data-p3d-cad-v-scale]').fill(String(vertical));
  await page.locator('[data-p3d-cad-v-scale]').blur();
}

test.describe('Pipeline CAD floating Table 2X / Table 3X preview', () => {
  test('CAD-F01 — preview remains draggable and modeless', async ({ page }) => {
    await openCleanFixture(page);
    const panel = page.locator('[data-p3d-floating-preview="1"]');
    const head = panel.locator('[data-p3d-floating-preview-handle="1"]');
    const initial = await floatingState(page);
    expect(initial.position).toBe('fixed');
    expect(initial.zIndex).toBeGreaterThan(1_000_000);
    await expect(panel).toHaveAttribute('aria-modal', 'false');
    const box = await head.boundingBox();
    await page.mouse.move(box.x + 90, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 70, box.y + 90, { steps: 8 });
    await page.mouse.up();
    const moved = await floatingState(page);
    expect(moved.left).toBeLessThan(initial.left - 100);
    expect(moved.top).toBeGreaterThan(initial.top + 40);
  });

  test('CAD-F02 — resized geometry persists and reset restores defaults', async ({ page }) => {
    await openCleanFixture(page);
    const panel = page.locator('[data-p3d-floating-preview="1"]');
    await panel.evaluate((element) => {
      element.style.setProperty('left', '160px', 'important');
      element.style.setProperty('top', '120px', 'important');
      element.style.setProperty('width', '780px', 'important');
      element.style.setProperty('height', '520px', 'important');
    });
    await expect.poll(async () => (await floatingState(page)).storage?.width).toBe(780);
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.floatingPreviewReady === '1');
    await page.locator('#open-preview').click();
    expect((await floatingState(page)).width).toBeCloseTo(780, 0);
    await page.locator('[data-p3d-floating-preview-reset]').click();
    expect((await floatingState(page)).width).toBeGreaterThan(1000);
  });

  test('CAD-V01 — explicit mount renders shell, world grid and HUD without startup stalls', async ({ page }) => {
    await openCadFixture(page);
    const before = await cadState(page);
    expect(before.shellCount).toBe(1);
    expect(before.table2.gridVisible).toBe('true');
    expect(Number(before.table2.xStep)).toBeGreaterThan(0);
    const canvas = page.locator('[data-p3d-cad-canvas="table2x"]');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await expect(page.locator('[data-p3d-cad-stage="table2x"] [data-p3d-cad-crosshair]')).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-p3d-cad-stage="table2x"] .p3d-cad-crosshair-hud')).toContainText('Elev');
    await page.evaluate(() => window.__pipelineCadPreviewModesWorkspace.graphs.table2x.panHorizontalBy(80));
    const after = await cadState(page);
    expect(after.table2.xStep).toBeTruthy();
    expect(after.raw2).toBe(before.raw2);
  });

  test('CAD-V02 — engineering scales, display grid and snap remain independent and view-only', async ({ page }) => {
    await openCadFixture(page);
    await page.evaluate(() => { window.__pcadNodes = window.__pipelineCadPreviewModesWorkspace.controller.canvasManager.nodes; });
    const before = await cadState(page);
    await setScale(page, 1000, 100);
    await expect(page.locator('[data-p3d-cad-ve]')).toHaveText('VE 10x');
    await page.locator('[data-p3d-cad-view-action="grid"]').click();
    await page.locator('[data-p3d-cad-view-action="grid-snap"]').click();
    const after = await cadState(page);
    expect(after.table2.viewport.zoomY / after.table2.viewport.zoomX).toBeCloseTo(10, 6);
    expect(after.table2.gridVisible).toBe('false');
    expect(after.table2.snap.gridEnabled).toBe(true);
    expect(after.raw2).toBe(before.raw2);
    expect(after.revision).toBe(before.revision);
    expect(await page.evaluate(() => window.__pipelineCadPreviewModesWorkspace.controller.canvasManager.nodes === window.__pcadNodes)).toBe(true);
  });

  test('CAD-V03 — custom range, Auto Fit and Side-by-Side Link X preserve independent Y', async ({ page }) => {
    await openCadFixture(page);
    await page.locator('[data-p3d-cad-view-action="range"]').click();
    for (const [name, value] of Object.entries({ minX: 10, maxX: 30, minY: 230, maxY: 233 })) {
      await page.locator(`[data-range="${name}"]`).fill(String(value));
    }
    await page.locator('[data-range-action="apply"]').click();
    await expect.poll(async () => (await cadState(page)).table2.range.minX).toBeCloseTo(10, 5);
    await page.locator('[data-p3d-cad-view-action="fit"]').click();
    expect((await cadState(page)).table2.viewport.zoomX).toBe(1);
    await page.locator('.p3d-x-tab[data-x-tab="side-by-side"]').click();
    const before = await cadState(page);
    await page.evaluate(() => window.__pipelineCadPreviewModesWorkspace.graphs.table2x.panHorizontalBy(90));
    await expect.poll(async () => {
      const value = await cadState(page);
      return Math.abs(value.table2.range.minX - value.table3.range.minX);
    }).toBeLessThan(1e-6);
    const after = await cadState(page);
    expect(after.table3.viewport.zoomY).toBe(before.table3.viewport.zoomY);
    expect(after.table3.viewport.panY).toBe(before.table3.viewport.panY);
  });

  test('CAD-V04 — snap palette affects committed edit and Undo restores raw data', async ({ page }) => {
    await openCadFixture(page);
    const before = (await cadState(page)).raw2;
    await page.locator('[data-p3d-cad-view-action="snap"]').click();
    await page.locator('[data-snap="elevationStep"]').fill('1');
    await page.locator('[data-snap-action="apply"]').click();
    await page.locator('[data-p3d-cad-view-action="grid-snap"]').click();
    const points = await page.evaluate(() => {
      const graph = window.__pipelineCadPreviewModesWorkspace.graphs.table2x;
      const node = graph.currentNodes()[1];
      const rect = graph.canvas.getBoundingClientRect();
      const start = graph.worldToScreen(node);
      const end = graph.worldToScreen({ x: node.x, y: 231.38 });
      const client = (point) => ({
        x: rect.left + point.x * (rect.width / graph.width),
        y: rect.top + point.y * (rect.height / graph.height),
      });
      return { start: client(start), end: client(end) };
    });
    await page.mouse.move(points.start.x, points.start.y);
    await page.mouse.down();
    await page.mouse.move(points.end.x, points.end.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await cadState(page)).raw2).toContain('0+006.7\t231.00');
    await page.locator('[data-p3d-cad-action="undo"]:visible').first().click();
    await expect.poll(async () => (await cadState(page)).raw2).toBe(before);
  });

  test('CAD-V05 — Overlay is review-only and destroy/remount creates one replacement', async ({ page }) => {
    await openCadFixture(page);
    await page.locator('.p3d-x-tab[data-x-tab="overlay"]').click();
    await expect(page.locator('[data-p3d-cad-h-scale]')).toBeDisabled();
    await expect(page.locator('[data-p3d-cad-overlay-canvas]')).toHaveAttribute('data-p3d-cad-overlay-review-only', 'true');
    await page.locator('[data-p3d-cad-z-origin]').fill('233.8');
    await page.locator('[data-p3d-cad-z-origin]').blur();
    await expect(page.locator('[data-p3d-cad-overlay-canvas]')).toHaveAttribute('data-p3d-cad-overlay-origin', '233.800');
    const first = (await cadState(page)).mountId;
    expect(await page.evaluate(() => window.__pipelineCadPreviewModesDestroy())).toBe(true);
    expect(await page.evaluate(() => window.__pipelineCadPreviewModesRemount())).toBe(true);
    await expect(page.locator('[data-p3d-cad-viewbar]')).toHaveCount(1);
    expect((await cadState(page)).mountId).toBeGreaterThan(first);
  });
});

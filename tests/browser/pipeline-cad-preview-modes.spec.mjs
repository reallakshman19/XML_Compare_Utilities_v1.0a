import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-preview-modes-fixture.html';
const STORAGE_KEY = 'pipeline3dCadPreviewModeV1';
const FLOATING_STORAGE_KEY = 'pipeline3dCadFloatingPreviewV1';
const MODULE = '/tabs/pipeline-3d-model/pipeline-3d-model-cad-preview-modes.js';

async function openCleanFixture(page, saved = null) {
  await page.addInitScript(({ storageKey, floatingKey, savedValue }) => {
    const initializedKey = 'pipeline3dCadPreviewModesFixtureInitialized';
    if (sessionStorage.getItem(initializedKey) === '1') return;
    sessionStorage.setItem(initializedKey, '1');
    localStorage.removeItem(storageKey);
    localStorage.removeItem(floatingKey);
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadCanvas');
    if (savedValue) localStorage.setItem(storageKey, JSON.stringify(savedValue));
  }, { storageKey: STORAGE_KEY, floatingKey: FLOATING_STORAGE_KEY, savedValue: saved });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadPreviewModesReady === '1');
  await page.waitForFunction(() => Boolean(window.__pipelineCadPreviewModesWorkspace?.controller?.model));
  await page.locator('[data-p3d-split="btn-preview-x"]').click();
  await expect(page.locator('[data-p3d-floating-preview="1"]')).toBeVisible();
  await expect(page.locator('.p3d-x-tab[data-x-tab]')).toHaveCount(4);
}

async function modeState(page) {
  return page.evaluate(() => window.__pipelineCadPreviewModesState());
}

test.describe('Pipeline CAD side-by-side and elevation overlay preview modes', () => {
  test('CAD-M01 — Side by Side keeps both independently scaled CAD canvases live and editable', async ({ page }) => {
    await openCleanFixture(page);
    await page.locator('.p3d-x-tab[data-x-tab="side-by-side"]').click();

    const modal = page.locator('[data-p3d-split="x-modal"]');
    await expect(modal).toHaveAttribute('data-p3d-cad-preview-mode', 'side-by-side');
    await expect(page.locator('[data-x-content="table2x"]')).toBeVisible();
    await expect(page.locator('[data-x-content="table3x"]')).toBeVisible();

    const table2Canvas = page.locator('[data-p3d-cad-canvas="table2x"]');
    const table3Canvas = page.locator('[data-p3d-cad-canvas="table3x"]');
    await expect(table2Canvas).toBeVisible();
    await expect(table3Canvas).toBeVisible();
    await expect(table2Canvas).toHaveAttribute('data-p3d-cad-y-axis-label', 'Elevation (m)');
    await expect(table3Canvas).toHaveAttribute('data-p3d-cad-y-axis-label', 'Depth / Z (m)');

    const [box2, box3] = await Promise.all([table2Canvas.boundingBox(), table3Canvas.boundingBox()]);
    expect(box2?.width).toBeGreaterThan(300);
    expect(box3?.width).toBeGreaterThan(300);
    expect(Math.abs((box2?.width || 0) - (box3?.width || 0))).toBeLessThan(20);
    await expect(page.locator('.p3d-cad-toolbar:visible')).toHaveCount(2);

    const raw = page.locator('[data-p3d-split="table2a-raw"]');
    const before = await raw.inputValue();
    const committed = await page.evaluate(() => {
      const controller = window.__pipelineCadPreviewModesWorkspace.controller;
      const row = controller.model.table2Rows.find((candidate) => Number.isFinite(candidate.elevationValue));
      return controller.renameEntity({
        graph: 'table2x',
        entityId: row.id,
        entityType: 'elevation-node',
        value: String(row.elevationValue + 0.2),
      });
    });
    expect(committed).toBe(true);
    await expect.poll(async () => raw.inputValue()).not.toBe(before);
    await expect(page.locator('[data-p3d-cad-action="undo"]:visible').first()).toBeEnabled();
    await page.locator('[data-p3d-cad-action="undo"]:visible').first().click();
    await expect.poll(async () => raw.inputValue()).toBe(before);

    const state = await modeState(page);
    expect(state.mode).toBe('side-by-side');
    expect(state.storage.mode).toBe('side-by-side');
  });

  test('CAD-M02 — Overlay projects Table 3X Z onto one elevation axis and remains review-only', async ({ page }) => {
    await openCleanFixture(page);
    await page.locator('.p3d-x-tab[data-x-tab="overlay"]').click();

    await expect(page.locator('[data-p3d-split="x-modal"]')).toHaveAttribute('data-p3d-cad-preview-mode', 'overlay');
    await expect(page.locator('[data-x-content="table2x"]')).toBeHidden();
    await expect(page.locator('[data-x-content="table3x"]')).toBeHidden();
    await expect(page.locator('[data-x-content="overlay"]')).toBeVisible();
    await expect(page.locator('.p3d-cad-toolbar:visible')).toHaveCount(0);

    const input = page.locator('[data-p3d-cad-z-origin]');
    await expect(input).toHaveValue('231.32');
    const canvas = page.locator('[data-p3d-cad-overlay-canvas]');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-origin', '231.320');
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-elevation-points', '8');
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-projected-z-points', '2');
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-markers', '1');
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-review-only', 'true');
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-formula', 'Projected elevation = Z-origin elevation + Z');

    const overlay = await page.evaluate(async (modulePath) => {
      const module = await import(modulePath);
      return module.buildPipelineCadOverlayModel(
        window.__pipelineCadPreviewModesWorkspace.controller.model,
        231.32,
      );
    }, MODULE);
    expect(overlay.projectedZPoints.map((point) => Number(point.y.toFixed(2)))).toEqual([232.07, 229.82]);
    expect(overlay.elevationPoints[0].y).toBe(231.32);
  });

  test('CAD-M03 — changing the Z-origin shifts only the projected Z profile and persists', async ({ page }) => {
    await openCleanFixture(page);
    await page.locator('.p3d-x-tab[data-x-tab="overlay"]').click();

    const before = await page.evaluate(async (modulePath) => {
      const module = await import(modulePath);
      return module.buildPipelineCadOverlayModel(window.__pipelineCadPreviewModesWorkspace.controller.model, 231.32);
    }, MODULE);

    const input = page.locator('[data-p3d-cad-z-origin]');
    await input.fill('233.80');
    await input.blur();
    const canvas = page.locator('[data-p3d-cad-overlay-canvas]');
    await expect(canvas).toHaveAttribute('data-p3d-cad-overlay-origin', '233.800');

    const after = await page.evaluate(async (modulePath) => {
      const module = await import(modulePath);
      return module.buildPipelineCadOverlayModel(window.__pipelineCadPreviewModesWorkspace.controller.model, 233.8);
    }, MODULE);
    expect(after.elevationPoints.map((point) => point.y)).toEqual(before.elevationPoints.map((point) => point.y));
    expect(after.projectedZPoints.map((point, index) => Number((point.y - before.projectedZPoints[index].y).toFixed(2)))).toEqual([2.48, 2.48]);

    const state = await modeState(page);
    expect(state.storage.mode).toBe('overlay');
    expect(state.storage.zOriginElevation).toBe(233.8);

    await page.reload();
    await page.waitForFunction(() => document.body.dataset.pipelineCadPreviewModesReady === '1');
    await page.locator('[data-p3d-split="btn-preview-x"]').click();
    await expect(page.locator('[data-p3d-split="x-modal"]')).toHaveAttribute('data-p3d-cad-preview-mode', 'overlay');
    await expect(page.locator('[data-p3d-cad-z-origin]')).toHaveValue('233.8');
    await expect(page.locator('[data-p3d-cad-overlay-canvas]')).toHaveAttribute('data-p3d-cad-overlay-origin', '233.800');
  });

  test('CAD-M04 — Overlay hover reports actual Z and projected elevation without mutating source data', async ({ page }) => {
    await openCleanFixture(page);
    await page.locator('.p3d-x-tab[data-x-tab="overlay"]').click();
    const rawBefore = await page.locator('[data-p3d-split="table3b-raw"]').inputValue();
    const historyBefore = await page.evaluate(() => ({
      undo: window.__pipelineCadPreviewModesWorkspace.controller.history.undoStack.length,
      redo: window.__pipelineCadPreviewModesWorkspace.controller.history.redoStack.length,
    }));

    const target = await page.evaluate(async (modulePath) => {
      const module = await import(modulePath);
      const model = module.buildPipelineCadOverlayModel(window.__pipelineCadPreviewModesWorkspace.controller.model, 231.32);
      const point = model.projectedZPoints.find((candidate) => candidate.z === -1.5);
      const canvas = document.querySelector('[data-p3d-cad-overlay-canvas]');
      const rect = canvas.getBoundingClientRect();
      const plotLeft = 70;
      const plotRight = rect.width - 28;
      return {
        clientX: rect.left + plotLeft + ((point.x - model.xRange.min) / (model.xRange.max - model.xRange.min)) * (plotRight - plotLeft),
        clientY: rect.top + rect.height / 2,
      };
    }, MODULE);
    await page.mouse.move(target.clientX, target.clientY);

    const inspector = page.locator('[data-p3d-cad-coordinate-inspector]');
    await expect(inspector).toHaveAttribute('data-active', 'true');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="depth"]')).toContainText('1.5M');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="projectedElevation"]')).toHaveText('229.82 m');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="segment"]')).toContainText('682.337');

    await page.mouse.move(4, 4);
    await expect(inspector).toHaveAttribute('data-active', 'false');
    expect(await page.locator('[data-p3d-split="table3b-raw"]').inputValue()).toBe(rawBefore);
    expect(await page.evaluate(() => ({
      undo: window.__pipelineCadPreviewModesWorkspace.controller.history.undoStack.length,
      redo: window.__pipelineCadPreviewModesWorkspace.controller.history.redoStack.length,
    }))).toEqual(historyBefore);
  });

  test('CAD-M05 — preview modes rebind cleanly after workspace destroy and remount', async ({ page }) => {
    await openCleanFixture(page, { mode: 'side-by-side', zOriginElevation: 232.4 });
    await expect(page.locator('[data-p3d-split="x-modal"]')).toHaveAttribute('data-p3d-cad-preview-mode', 'side-by-side');
    expect(await page.evaluate(() => window.__pipelineCadPreviewModesDestroy())).toBe(true);
    expect(await page.evaluate(() => window.__pipelineCadPreviewModesRemount())).toBe(true);
    await expect(page.locator('.p3d-x-tab[data-x-tab]')).toHaveCount(4);

    await page.locator('.p3d-x-tab[data-x-tab="overlay"]').click();
    await expect(page.locator('[data-p3d-split="x-modal"]')).toHaveAttribute('data-p3d-cad-preview-mode', 'overlay');
    await expect(page.locator('[data-p3d-cad-z-origin]')).toHaveValue('232.4');
    await page.locator('[data-p3d-cad-z-origin]').fill('234.1');
    await page.locator('[data-p3d-cad-z-origin]').blur();
    await expect(page.locator('[data-p3d-cad-overlay-canvas]')).toHaveAttribute('data-p3d-cad-overlay-origin', '234.100');
    expect((await modeState(page)).storage.zOriginElevation).toBe(234.1);
  });
});

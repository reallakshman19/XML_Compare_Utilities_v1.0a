import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-runtime-switch-fixture.html';

async function openCanvasFixture(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('pipeline3dCadRenderer');
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadCanvas');
    sessionStorage.removeItem('pipeline3dCadFallbackReloaded');
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadRuntimeReady === '1');
  await expect(page.locator('[data-p3d-cad-stage]')).toHaveCount(2);
}

async function table2MiddleNodePoint(page, yOffset = 0) {
  return page.evaluate((offset) => {
    const workspace = window.__pipelineCadRuntimeWorkspace;
    const graph = workspace.graphs.table2x;
    const node = graph.currentNodes()[1];
    const screen = graph.worldToScreen(node);
    const rect = graph.canvas.getBoundingClientRect();
    return {
      id: node.id,
      elevation: workspace.controller.model.findRow(node.id).elevationValue,
      clientX: rect.left + screen.x * (rect.width / graph.width),
      clientY: rect.top + (screen.y + offset) * (rect.height / graph.height),
      history: workspace.controller.history.undoStack.length,
    };
  }, yOffset);
}

async function dispatchPointerSequence(page, start, end, terminalType) {
  await page.evaluate(({ startPoint, endPoint, terminal }) => {
    const canvas = document.querySelector('[data-p3d-cad-canvas="table2x"]');
    const event = (type, point, buttons) => new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 91,
      pointerType: 'mouse',
      isPrimary: true,
      button: type === 'pointerdown' ? 0 : -1,
      buttons,
      clientX: point.clientX,
      clientY: point.clientY,
    });
    canvas.dispatchEvent(event('pointerdown', startPoint, 1));
    canvas.dispatchEvent(event('pointermove', endPoint, 1));
    canvas.dispatchEvent(event(terminal, endPoint, 0));
  }, { startPoint: start, endPoint: end, terminal: terminalType });
}

test.describe('Pipeline CAD lifecycle and performance', () => {
  test('CAD-L01 — repeated identical resize notifications do not redraw surfaces', async ({ page }) => {
    await openCanvasFixture(page);
    const before = await page.evaluate(() => window.__pipelineCadLifecycleState());
    await page.evaluate(() => window.__pipelineCadResizeBurst(200));
    const after = await page.evaluate(() => window.__pipelineCadLifecycleState());

    for (const graphName of ['table2x', 'table3x']) {
      expect(after[graphName].appliedResizes - before[graphName].appliedResizes).toBeLessThanOrEqual(1);
      expect(after[graphName].skippedResizes - before[graphName].skippedResizes).toBeGreaterThanOrEqual(190);
    }

    const surfaces = await page.locator('[data-p3d-cad-canvas]').evaluateAll((canvases) => canvases.map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        dpr: window.devicePixelRatio,
      };
    }));
    surfaces.forEach((surface) => {
      expect(surface.width).toBe(Math.round(surface.cssWidth * surface.dpr));
      expect(surface.height).toBe(Math.round(surface.cssHeight * surface.dpr));
    });
  });

  test('CAD-L02 — pointercancel rolls back preview movement without command history', async ({ page }) => {
    await openCanvasFixture(page);
    const start = await table2MiddleNodePoint(page);
    const end = { ...start, clientY: start.clientY - 55 };
    const beforeStats = await page.evaluate(() => window.__pipelineCadLifecycleState());
    await dispatchPointerSequence(page, start, end, 'pointercancel');

    await expect.poll(async () => page.evaluate((id) => {
      const workspace = window.__pipelineCadRuntimeWorkspace;
      const graph = workspace.graphs.table2x;
      return {
        elevation: workspace.controller.model.findRow(id).elevationValue,
        history: workspace.controller.history.undoStack.length,
        dragging: graph.draggingId,
        override: graph.visualOverrides.has(id),
      };
    }, start.id)).toEqual({
      elevation: start.elevation,
      history: start.history,
      dragging: null,
      override: false,
    });

    const afterStats = await page.evaluate(() => window.__pipelineCadLifecycleState());
    expect(afterStats.table2x.cancelledInteractions).toBe(beforeStats.table2x.cancelledInteractions + 1);
  });

  test('CAD-L03 — destroy restores legacy previews and remount stays duplicate-free', async ({ page }) => {
    await openCanvasFixture(page);
    await expect(page.locator('[data-p3d-cad-label-layer]')).toHaveCount(2);
    await expect(page.locator('[data-p3d-cad-live]')).toHaveCount(2);

    expect(await page.evaluate(() => window.__pipelineCadDestroy())).toBe(true);
    await expect(page.locator('[data-p3d-cad-stage]')).toHaveCount(0);
    await expect(page.locator('[data-p3d-legacy-svg]')).toHaveCount(2);
    await expect(page.locator('[data-p3d-cad-label-layer]')).toHaveCount(0);
    await expect(page.locator('[data-p3d-cad-live]')).toHaveCount(0);

    expect(await page.evaluate(() => window.__pipelineCadRemount())).toBe(true);
    await expect(page.locator('[data-p3d-cad-stage]')).toHaveCount(2);
    await expect(page.locator('[data-p3d-legacy-svg]')).toHaveCount(0);
    await expect(page.locator('[data-p3d-cad-label-layer]')).toHaveCount(2);
    await expect(page.locator('[data-p3d-cad-live]')).toHaveCount(2);

    expect(await page.evaluate(() => window.__pipelineCadRemount())).toBe(true);
    await expect(page.locator('[data-p3d-cad-stage]')).toHaveCount(2);
    await expect(page.locator('[data-p3d-cad-label-layer]')).toHaveCount(2);
    await expect(page.locator('[data-p3d-cad-live]')).toHaveCount(2);
  });

  test('CAD-L04 — window blur cancels active drag and clears stuck Space state', async ({ page }) => {
    await openCanvasFixture(page);
    const start = await table2MiddleNodePoint(page);
    const end = { ...start, clientY: start.clientY + 45 };

    await page.evaluate(({ startPoint, endPoint }) => {
      const workspace = window.__pipelineCadRuntimeWorkspace;
      const graph = workspace.graphs.table2x;
      const canvas = graph.canvas;
      const event = (type, point, buttons) => new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 92,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointerdown' ? 0 : -1,
        buttons,
        clientX: point.clientX,
        clientY: point.clientY,
      });
      canvas.dispatchEvent(event('pointerdown', startPoint, 1));
      canvas.dispatchEvent(event('pointermove', endPoint, 1));
      graph.spacePressed = true;
      window.dispatchEvent(new Event('blur'));
    }, { startPoint: start, endPoint: end });

    await expect.poll(async () => page.evaluate((id) => {
      const workspace = window.__pipelineCadRuntimeWorkspace;
      const graph = workspace.graphs.table2x;
      return {
        elevation: workspace.controller.model.findRow(id).elevationValue,
        history: workspace.controller.history.undoStack.length,
        pointer: graph.pointerState,
        dragging: graph.draggingId,
        override: graph.visualOverrides.has(id),
        spacePressed: graph.spacePressed,
      };
    }, start.id)).toEqual({
      elevation: start.elevation,
      history: start.history,
      pointer: null,
      dragging: null,
      override: false,
      spacePressed: false,
    });
  });
});

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

test.describe('Pipeline CAD interaction quality', () => {
  test('CAD-Q01 — keyboard selection announces and nudges Table 2 elevation', async ({ page }) => {
    await openCanvasFixture(page);
    const canvas = page.locator('[data-p3d-cad-canvas="table2x"]');
    await expect(canvas).toHaveAttribute('role', 'application');
    await expect(canvas).toHaveAttribute('aria-keyshortcuts', /ArrowLeft/);
    await canvas.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');

    const before = await page.evaluate(() => {
      const graph = window.__pipelineCadRuntimeWorkspace.graphs.table2x;
      const row = window.__pipelineCadRuntimeWorkspace.controller.model.findRow(graph.selectedId);
      return { id: graph.selectedId, elevation: row.elevationValue };
    });
    expect(before.id).toBeTruthy();

    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => page.evaluate((id) => (
      window.__pipelineCadRuntimeWorkspace.controller.model.findRow(id)?.elevationValue
    ), before.id)).toBeCloseTo(before.elevation + 0.05, 6);

    await expect(page.locator('[data-p3d-cad-live="table2x"]')).toContainText('Table 2 elevation node');
    await expect(page.locator('[data-p3d-cad-label-layer="table2x"] [data-selected="true"]')).toHaveCount(1);
  });

  test('CAD-Q02 — keyboard marker nudge and Enter open the inline editor', async ({ page }) => {
    await openCanvasFixture(page);
    const canvas = page.locator('[data-p3d-cad-canvas="table3x"]');
    await canvas.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');

    const before = await page.evaluate(() => {
      const workspace = window.__pipelineCadRuntimeWorkspace;
      const graph = workspace.graphs.table3x;
      const row = workspace.controller.model.findRow(graph.selected?.id);
      return { id: graph.selected?.id, type: graph.selected?.type, absoluteH: row?.absoluteH };
    });
    expect(before.type).toBe('marker');

    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => page.evaluate((id) => (
      window.__pipelineCadRuntimeWorkspace.controller.model.findRow(id)?.absoluteH
    ), before.id)).toBeGreaterThan(before.absoluteH);

    await page.keyboard.press('Enter');
    const editor = page.locator('[data-p3d-cad-inline-editor="table3x"]');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('PM-001');
    await expect(page.locator('[data-p3d-cad-live="table3x"]')).toContainText('Table 3 marker');
  });

  test('CAD-Q03 — labels do not overlap and controls meet keyboard/touch sizing', async ({ page }) => {
    await openCanvasFixture(page);
    await expect.poll(async () => page.locator('[data-p3d-cad-visual-label]').count()).toBeGreaterThan(0);

    const overlaps = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('[data-p3d-cad-label-layer]').forEach((layer) => {
        const labels = [...layer.querySelectorAll('[data-p3d-cad-visual-label]')];
        const boxes = labels.map((label) => ({ id: label.dataset.p3dCadVisualLabel, rect: label.getBoundingClientRect() }));
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i].rect;
            const b = boxes[j].rect;
            const separated = a.right + 1 <= b.left || b.right + 1 <= a.left || a.bottom + 1 <= b.top || b.bottom + 1 <= a.top;
            if (!separated) result.push([boxes[i].id, boxes[j].id]);
          }
        }
      });
      return result;
    });
    expect(overlaps).toEqual([]);

    const buttonSizes = await page.locator('.p3d-cad-toolbar button').evaluateAll((buttons) => (
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    ));
    expect(buttonSizes.length).toBeGreaterThan(0);
    buttonSizes.forEach(({ width, height }) => {
      expect(width).toBeGreaterThanOrEqual(36);
      expect(height).toBeGreaterThanOrEqual(36);
    });

    const canvas = page.locator('[data-p3d-cad-canvas="table2x"]');
    await canvas.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    for (let index = 0; index < 5; index += 1) await page.keyboard.press('+');
    await expect.poll(async () => page.evaluate(() => Boolean(
      document.querySelector('[data-p3d-cad-label-layer="table2x"] [data-selected="true"]'),
    ))).toBe(true);
    const geometry = await page.evaluate(() => {
      const label = document.querySelector('[data-p3d-cad-label-layer="table2x"] [data-selected="true"]');
      const targetCanvas = document.querySelector('[data-p3d-cad-canvas="table2x"]');
      if (!label || !targetCanvas) return null;
      const selectedBox = label.getBoundingClientRect();
      const canvasBox = targetCanvas.getBoundingClientRect();
      return {
        selectedBox: { x: selectedBox.x, width: selectedBox.width },
        canvasBox: { x: canvasBox.x, width: canvasBox.width },
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry.selectedBox.x).toBeGreaterThanOrEqual(geometry.canvasBox.x);
    expect(geometry.selectedBox.x + geometry.selectedBox.width).toBeLessThanOrEqual(
      geometry.canvasBox.x + geometry.canvasBox.width,
    );
  });

  test('CAD-Q04 — dense profiles cap labels while retaining selected entities', async ({ page }) => {
    await openCanvasFixture(page);
    await page.evaluate(() => {
      const rows = ['H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text'];
      for (let index = 0; index < 300; index += 1) {
        const h = 1000 + index;
        const station = `0+${String(index).padStart(3, '0')}.0`;
        rows.push(`${h}\t—\t1\t${station}\t${(230 + Math.sin(index / 12)).toFixed(2)}`);
      }
      window.__pipelineCadSetRaw('table2a', rows.join('\n'));
    });
    await expect.poll(async () => page.evaluate(() => (
      window.__pipelineCadRuntimeWorkspace.controller.model.table2Rows.length
    ))).toBe(300);

    const layer = page.locator('[data-p3d-cad-label-layer="table2x"]');
    await expect.poll(async () => Number(await layer.getAttribute('data-suppressed-labels'))).toBeGreaterThan(0);
    const visible = Number(await layer.getAttribute('data-visible-labels'));
    expect(visible).toBeLessThanOrEqual(160);

    const canvas = page.locator('[data-p3d-cad-canvas="table2x"]');
    await canvas.focus();
    await page.keyboard.press('End');
    await expect(layer.locator('[data-selected="true"]')).toHaveCount(1);
  });
});

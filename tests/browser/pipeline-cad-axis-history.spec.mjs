import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-runtime-switch-fixture.html';
const AXIS_LABEL = 'HLength Cumulative (m)';

async function openCanvasFixture(page) {
  await page.addInitScript(() => {
    localStorage.setItem('pipeline3dCadRenderer', 'canvas');
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadCanvas');

    const original = CanvasRenderingContext2D.prototype.fillText;
    window.__pipelineCadFillTextLog = [];
    CanvasRenderingContext2D.prototype.fillText = function recordPipelineCadText(text, x, y, ...args) {
      window.__pipelineCadFillTextLog.push({ text: String(text), x: Number(x), y: Number(y) });
      return original.call(this, text, x, y, ...args);
    };
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadRuntimeReady === '1');
  await page.waitForFunction(() => Boolean(window.__pipelineCadRuntimeWorkspace?.controller?.model));
  await page.waitForFunction((label) => window.__pipelineCadFillTextLog?.some((entry) => entry.text === label), AXIS_LABEL);
}

test.describe('Pipeline CAD Table 3X axis and command history', () => {
  test('CAD-U01 — Table 3X renders and exposes the cumulative HLength X-axis label', async ({ page }) => {
    await openCanvasFixture(page);

    const canvas = page.locator('[data-p3d-cad-canvas="table3x"]');
    await expect(canvas).toHaveAttribute('data-p3d-cad-x-axis-label', AXIS_LABEL);
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(`X axis: ${AXIS_LABEL.replace(/[()]/g, '\\$&')}`));

    const labelDraw = await page.evaluate((label) => {
      const matches = window.__pipelineCadFillTextLog.filter((entry) => entry.text === label);
      return matches.at(-1) || null;
    }, AXIS_LABEL);
    expect(labelDraw).not.toBeNull();
    expect(labelDraw.x).toBeGreaterThan(100);
    expect(labelDraw.y).toBeGreaterThan(250);
  });

  test('CAD-U02 — a committed edit enables Undo and undo/redo update both toolbars', async ({ page }) => {
    await openCanvasFixture(page);

    const undoButtons = page.locator('[data-p3d-cad-action="undo"]');
    const redoButtons = page.locator('[data-p3d-cad-action="redo"]');
    await expect(undoButtons).toHaveCount(2);
    await expect(redoButtons).toHaveCount(2);
    await expect(undoButtons.nth(0)).toBeDisabled();
    await expect(undoButtons.nth(1)).toBeDisabled();
    await expect(redoButtons.nth(0)).toBeDisabled();
    await expect(redoButtons.nth(1)).toBeDisabled();

    const raw = page.locator('[data-p3d-split="table2a-raw"]');
    const beforeRaw = await raw.inputValue();
    const edit = await page.evaluate(() => {
      const controller = window.__pipelineCadRuntimeWorkspace.controller;
      const row = controller.model.table2Rows.find((candidate, index) => index > 0 && Number.isFinite(candidate.elevationValue));
      if (!row) throw new Error('No editable Table 2 elevation row was found.');
      const nextValue = Number(row.elevationValue) + 1.25;
      const committed = controller.renameEntity({
        graph: 'table2x',
        entityId: row.id,
        entityType: 'elevation-node',
        value: String(nextValue),
      });
      return { committed, rowId: row.id, nextValue };
    });
    expect(edit.committed).toBe(true);

    await expect.poll(async () => undoButtons.nth(0).isEnabled()).toBe(true);
    await expect(undoButtons.nth(1)).toBeEnabled();
    await expect(redoButtons.nth(0)).toBeDisabled();
    await expect(redoButtons.nth(1)).toBeDisabled();
    const afterRaw = await raw.inputValue();
    expect(afterRaw).not.toBe(beforeRaw);

    await undoButtons.nth(0).click();
    await expect.poll(async () => raw.inputValue()).toBe(beforeRaw);
    await expect(undoButtons.nth(0)).toBeDisabled();
    await expect(undoButtons.nth(1)).toBeDisabled();
    await expect(redoButtons.nth(0)).toBeEnabled();
    await expect(redoButtons.nth(1)).toBeEnabled();

    await redoButtons.nth(1).click();
    await expect.poll(async () => raw.inputValue()).toBe(afterRaw);
    await expect(undoButtons.nth(0)).toBeEnabled();
    await expect(undoButtons.nth(1)).toBeEnabled();
    await expect(redoButtons.nth(0)).toBeDisabled();
    await expect(redoButtons.nth(1)).toBeDisabled();
  });
});

import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-runtime-switch-fixture.html';

async function openEngineeringFixture(page) {
  await page.addInitScript(() => {
    localStorage.setItem('pipeline3dCadRenderer', 'canvas');
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadCanvas');
    const original = CanvasRenderingContext2D.prototype.fillText;
    window.__pipelineCadEngineeringTextLog = [];
    CanvasRenderingContext2D.prototype.fillText = function recordEngineeringText(text, x, y, ...args) {
      window.__pipelineCadEngineeringTextLog.push({ text: String(text), x: Number(x), y: Number(y) });
      return original.call(this, text, x, y, ...args);
    };
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadRuntimeReady === '1');
  await page.waitForFunction(() => Boolean(window.__pipelineCadRuntimeWorkspace?.controller?.model));
  await expect(page.locator('[data-p3d-cad-coordinate-inspector]')).toHaveCount(1);
}

async function moveToGraphCumulative(page, graphName, cumulative, yMode = 'middle') {
  const position = await page.evaluate(({ graphName: name, cumulative: xValue, yMode: mode }) => {
    const graph = window.__pipelineCadRuntimeWorkspace.graphs[name];
    const plot = graph.getPlotRect();
    const y = mode === 'marker'
      ? graph.markerNodes().find((node) => node.text === 'PM-001')?.y ?? ((graph.bounds.minY + graph.bounds.maxY) / 2)
      : (graph.bounds.minY + graph.bounds.maxY) / 2;
    const local = graph.worldToScreen({ x: xValue, y });
    const rect = graph.canvas.getBoundingClientRect();
    return {
      x: rect.left + local.x * (rect.width / graph.width),
      y: rect.top + local.y * (rect.height / graph.height),
      plot: {
        left: rect.left + plot.left * (rect.width / graph.width),
        right: rect.left + plot.right * (rect.width / graph.width),
        top: rect.top + plot.top * (rect.height / graph.height),
        bottom: rect.top + plot.bottom * (rect.height / graph.height),
      },
    };
  }, { graphName, cumulative, yMode });
  expect(position.x).toBeGreaterThan(position.plot.left);
  expect(position.x).toBeLessThan(position.plot.right);
  expect(position.y).toBeGreaterThan(position.plot.top);
  expect(position.y).toBeLessThan(position.plot.bottom);
  await page.mouse.move(position.x, position.y);
}

test.describe('Pipeline CAD engineering axes and linked coordinate review', () => {
  test('CAD-E01 — both graphs render complete engineering axis semantics and numeric ticks', async ({ page }) => {
    await openEngineeringFixture(page);

    const table2 = page.locator('[data-p3d-cad-canvas="table2x"]');
    const table3 = page.locator('[data-p3d-cad-canvas="table3x"]');
    await expect(table2).toHaveAttribute('data-p3d-cad-x-axis-label', 'Station / Chainage (m)');
    await expect(table2).toHaveAttribute('data-p3d-cad-y-axis-label', 'Elevation (m)');
    await expect(table3).toHaveAttribute('data-p3d-cad-x-axis-label', 'HLength Cumulative (m)');
    await expect(table3).toHaveAttribute('data-p3d-cad-y-axis-label', 'Depth / Z (m)');

    const tickCounts = await page.evaluate(() => [...document.querySelectorAll('[data-p3d-cad-canvas]')].map((canvas) => ({
      graph: canvas.dataset.p3dCadCanvas,
      x: Number(canvas.dataset.p3dCadXTickCount),
      y: Number(canvas.dataset.p3dCadYTickCount),
    })));
    expect(tickCounts).toHaveLength(2);
    tickCounts.forEach((entry) => {
      expect(entry.x, `${entry.graph} X ticks`).toBeGreaterThanOrEqual(3);
      expect(entry.y, `${entry.graph} Y ticks`).toBeGreaterThanOrEqual(3);
    });

    const labels = await page.evaluate(() => window.__pipelineCadEngineeringTextLog.map((entry) => entry.text));
    expect(labels).toContain('Station / Chainage (m)');
    expect(labels).toContain('Elevation (m)');
    expect(labels).toContain('HLength Cumulative (m)');
    expect(labels).toContain('Depth / Z (m)');
  });

  test('CAD-E02 — Table 2X hover drives the linked crosshair and approved coordinate inspector', async ({ page }) => {
    await openEngineeringFixture(page);
    await moveToGraphCumulative(page, 'table2x', 26.3);

    const inspector = page.locator('[data-p3d-cad-coordinate-inspector]');
    await expect(inspector).toHaveAttribute('data-active', 'true');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="cumulative"]')).toHaveText('26.3 m');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="station"]')).toHaveText('0+026.3');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="absoluteH"]')).toHaveText(/^688\./);
    await expect(inspector.locator('[data-p3d-cad-inspector-field="elevation"]')).toHaveText(/^231\.[01]\d m$/);
    await expect(inspector.locator('[data-p3d-cad-inspector-field="depth"]')).toContainText('Z -0.');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="segment"]')).toHaveText('682.337 → 716.683');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="segmentLength"]')).toHaveText('34.3 m');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="item"]')).toHaveText('PM-001');

    const linked = await page.evaluate(() => [...document.querySelectorAll('[data-p3d-cad-canvas]')].map((canvas) => Number(canvas.dataset.p3dCadInspectionCumulative)));
    expect(linked).toHaveLength(2);
    linked.forEach((value) => expect(Math.abs(value - 26.3)).toBeLessThan(0.01));
  });

  test('CAD-E03 — Table 3X inspection is bidirectional and clears both graph crosshairs on exit', async ({ page }) => {
    await openEngineeringFixture(page);
    const markerCumulative = await page.evaluate(() => {
      const graph = window.__pipelineCadRuntimeWorkspace.graphs.table3x;
      return graph.markerNodes().find((node) => node.text === 'PM-001')?.x;
    });
    expect(markerCumulative).toBeGreaterThan(20);
    expect(markerCumulative).toBeLessThan(35);
    await moveToGraphCumulative(page, 'table3x', markerCumulative, 'marker');

    const inspector = page.locator('[data-p3d-cad-coordinate-inspector]');
    await expect(inspector).toHaveAttribute('data-active', 'true');
    await expect(inspector.locator('[data-p3d-cad-inspector-field="item"]')).toHaveText('PM-001');
    const linked = await page.evaluate(() => [...document.querySelectorAll('[data-p3d-cad-canvas]')].map((canvas) => Number(canvas.dataset.p3dCadInspectionCumulative)));
    linked.forEach((value) => expect(Math.abs(value - markerCumulative)).toBeLessThan(0.01));

    await page.mouse.move(2, 2);
    await expect(inspector).toHaveAttribute('data-active', 'false');
    await expect.poll(async () => page.evaluate(() => [...document.querySelectorAll('[data-p3d-cad-canvas]')].every((canvas) => !canvas.hasAttribute('data-p3d-cad-inspection-cumulative')))).toBe(true);
  });
});

import { expect, test } from '@playwright/test';

const FIXTURE_URL = '/tests/browser/pipeline-cad-fixture.html';

async function openFixture(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(FIXTURE_URL);
  await page.waitForFunction(() => document.body.dataset.pipelineCadReady === '1');
  await page.evaluate(async () => {
    const layout = await import('/tabs/pipeline-3d-model/pipeline-3d-model-cad-layout-hardening.js');
    layout.stabilizePipelineCadHosts(document);
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    window.__pipelineCadHarness.workspace.resize();
    await frame();
    await frame();
    window.__pipelineCadHarness.workspace.resize();
    await frame();
    await frame();
  });
  await page.waitForFunction(() => {
    const state = window.__pipelineCadHarness.state();
    return Object.values(state.canvas).every((metrics) => (
      metrics.width > 0
      && metrics.height > 0
      && metrics.cssWidth > 0
      && metrics.cssHeight > 0
    ));
  });
  await expect(page.locator('[data-p3d-cad-stage]')).toHaveCount(2);
  await expect(page.locator('[data-p3d-split="table2x-preview"]')).toHaveClass(/p3d-cad-host/);
  await expect(page.locator('[data-p3d-split="table3x-preview"]')).toHaveClass(/p3d-cad-host/);
  await expect(page.locator('[data-p3d-cad-stage="table2x"] [data-p3d-cad-snap="grid"]')).toBeVisible();
  return errors;
}

async function localPoint(page, graphName, query) {
  return page.evaluate(({ graphName, query }) => window.__pipelineCadHarness.findNode(graphName, query), { graphName, query });
}

async function localWorldPoint(page, graphName, world) {
  return page.evaluate(({ graphName, world }) => window.__pipelineCadHarness.worldPoint(graphName, world), { graphName, world });
}

async function clientPoint(page, graphName, local) {
  const box = await page.locator(`[data-p3d-cad-canvas="${graphName}"]`).boundingBox();
  if (!box) throw new Error(`Canvas ${graphName} has no bounding box.`);
  const viewport = await page.evaluate((name) => window.__pipelineCadHarness.workspace.graphs[name].getViewport(), graphName);
  return {
    x: box.x + local.x * (box.width / viewport.width),
    y: box.y + local.y * (box.height / viewport.height),
  };
}

async function dragNode(page, graphName, query, targetWorld) {
  const startLocal = await localPoint(page, graphName, query);
  const targetLocal = await localWorldPoint(page, graphName, targetWorld);
  const start = await clientPoint(page, graphName, startLocal);
  const target = await clientPoint(page, graphName, targetLocal);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  return startLocal;
}

async function enableSnap(page, graphName, mode) {
  const button = page.locator(`[data-p3d-cad-stage="${graphName}"] [data-p3d-cad-snap="${mode}"]`);
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function readState(page) {
  return page.evaluate(() => window.__pipelineCadHarness.state());
}

async function capture(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

function expectNoBrowserErrors(errors) {
  expect(errors, errors.join('\n')).toEqual([]);
}

test.describe('Pipeline CAD Canvas browser acceptance', () => {
  test('CAD-B01 — Table 2 pointer drag preserves profile until Reload Graph', async ({ page }, testInfo) => {
    const errors = await openFixture(page);
    await enableSnap(page, 'table2x', 'grid');

    const node = await localPoint(page, 'table2x', { stationValue: 19 });
    await dragNode(page, 'table2x', { id: node.id }, { x: node.world.x, y: 232.48 });

    await expect.poll(async () => (await readState(page)).table2Rows.find((row) => row.id === node.id)?.elevationValue).toBe(232.5);
    const beforeReload = await readState(page);
    const changedLine = beforeReload.raw.table2a.split('\n').find((line) => line.includes('0+019.0'));
    const columns = changedLine.split('\t');
    expect(columns[2]).toBe('65.567');
    expect(columns[4]).toBe('232.50');
    expect(beforeReload.table2Snapshot.find((row) => row.id === node.id)?.y).toBe(230.82);
    expect(beforeReload.table2Overrides).toContainEqual([node.id, 232.5]);
    await capture(page, testInfo, 'cad-b01-before-reload');

    await page.locator('[data-p3d-cad-stage="table2x"] [data-p3d-cad-action="reload"]').click();
    const afterReload = await readState(page);
    expect(afterReload.table2Snapshot.find((row) => row.id === node.id)?.y).toBe(232.5);
    expect(afterReload.table2Overrides).toEqual([]);
    await capture(page, testInfo, 'cad-b01-after-reload');
    expectNoBrowserErrors(errors);
  });

  test('CAD-B02 — Table 3 pointer drag snaps near-grade depth to A/G', async ({ page }, testInfo) => {
    const errors = await openFixture(page);
    await enableSnap(page, 'table3x', 'grid');

    const depth = await localPoint(page, 'table3x', { type: 'depth-node', zText: '1.5M' });
    await dragNode(page, 'table3x', { id: depth.id }, { x: depth.world.x, y: -0.05 });

    await expect.poll(async () => (await readState(page)).depthRows.find((row) => row.id === depth.id)?.zText).toBe('A/G');
    const state = await readState(page);
    expect(state.depthRows.find((row) => row.id === depth.id)?.z).toBe(0.75);
    expect(state.raw.table3b.split('\n').find((line) => line.startsWith('682.337'))?.endsWith('\tA/G')).toBe(true);
    await capture(page, testInfo, 'cad-b02-above-ground-snap');
    expectNoBrowserErrors(errors);
  });

  test('CAD-B03 — marker pointer drag inverse-maps snapped cumulative X to absolute H', async ({ page }, testInfo) => {
    const errors = await openFixture(page);
    await enableSnap(page, 'table3x', 'station');

    const marker = await localPoint(page, 'table3x', { type: 'marker', markerText: 'PM-001' });
    await dragNode(page, 'table3x', { id: marker.id }, { x: 54.6, y: marker.world.y });

    await expect.poll(async () => (await readState(page)).markerRows.find((row) => row.id === marker.id)?.absoluteH).toBeCloseTo(716.683, 3);
    const state = await readState(page);
    const moved = state.markerRows.find((row) => row.id === marker.id);
    expect(moved.markerText).toBe('PM-001');
    expect(state.markerRows).toHaveLength(1);
    expect(state.raw.table3c).toMatch(/716\.683\tPM-001/);
    await capture(page, testInfo, 'cad-b03-marker-inverse-map');
    expectNoBrowserErrors(errors);
  });

  test('CAD-B04 — structured range identity highlights the correct derived row', async ({ page }, testInfo) => {
    const errors = await openFixture(page);
    await enableSnap(page, 'table3x', 'grid');

    const depth = await localPoint(page, 'table3x', { type: 'depth-node', zText: '1.5M' });
    await dragNode(page, 'table3x', { id: depth.id }, { x: depth.world.x, y: -1.49 });

    await expect.poll(async () => (await readState(page)).outputRows['table3-range']?.dirty).toBe(true);
    const state = await readState(page);
    expect(state.outputRows['table3-decoy'].dirty).toBe(false);
    expect(state.outputRows['table3-range'].dirtyId).toBe(depth.id);
    await capture(page, testInfo, 'cad-b04-range-highlight');
    expectNoBrowserErrors(errors);
  });

  test('CAD-B05 — manual TSV input rebuilds state without replacing Canvas instances', async ({ page }, testInfo) => {
    const errors = await openFixture(page);
    const node = await localPoint(page, 'table2x', { stationValue: 19 });
    await dragNode(page, 'table2x', { id: node.id }, { x: node.world.x, y: 232.2 });
    expect((await readState(page)).table2Overrides.length).toBeGreaterThan(0);

    const raw = (await readState(page)).raw.table2a.replace('232.20', '232.75');
    await page.locator('[data-p3d-split="table2a-raw"]').fill(raw);
    await expect.poll(async () => (await readState(page)).table2Rows.find((row) => row.stationValue === 19)?.elevationValue).toBe(232.75);

    const state = await readState(page);
    expect(state.graphIdentityStable).toBe(true);
    expect(state.table2Overrides).toEqual([]);
    expect(state.table2Snapshot.find((row) => row.id === node.id)?.y).toBe(232.75);
    await capture(page, testInfo, 'cad-b05-manual-raw-override');
    expectNoBrowserErrors(errors);
  });

  test('CAD-B06 — navigation, keyboard, context menu and high-DPI Canvas lifecycle', async ({ page }, testInfo) => {
    const errors = await openFixture(page);
    const canvas = page.locator('[data-p3d-cad-canvas="table2x"]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Table 2X Canvas is not visible.');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
    await expect.poll(async () => (await readState(page)).viewport.table2x.zoom).toBeGreaterThan(1);

    const beforePan = (await readState(page)).viewport.table2x;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(box.x + box.width / 2 + 42, box.y + box.height / 2 + 18, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    const afterPan = (await readState(page)).viewport.table2x;
    expect(afterPan.panX).not.toBe(beforePan.panX);
    expect(afterPan.panY).not.toBe(beforePan.panY);

    await canvas.focus();
    await page.keyboard.press('n');
    expect(await page.evaluate(() => window.__pipelineCadHarness.workspace.graphs.table2x.tool)).toBe('add-node');
    await page.keyboard.press('v');
    expect(await page.evaluate(() => window.__pipelineCadHarness.workspace.graphs.table2x.tool)).toBe('select');

    await page.locator('[data-p3d-cad-stage="table2x"] [data-p3d-cad-action="fit"]').click();
    await expect.poll(async () => (await readState(page)).viewport.table2x.zoom).toBe(1);
    const node = await localPoint(page, 'table2x', { stationValue: 19 });
    const client = await clientPoint(page, 'table2x', node);
    await page.mouse.click(client.x, client.y, { button: 'right' });
    const menu = page.locator('[data-p3d-cad-stage="table2x"] .p3d-cad-context-menu');
    await expect(menu).toBeVisible();
    await menu.locator('[data-p3d-cad-context-action="edit"]').click();
    const editor = page.locator('[data-p3d-cad-stage="table2x"] [data-p3d-cad-inline-editor]');
    await expect(editor).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();

    const state = await readState(page);
    for (const metrics of Object.values(state.canvas)) {
      expect(metrics.width / metrics.cssWidth).toBeCloseTo(metrics.dpr, 1);
      expect(metrics.height / metrics.cssHeight).toBeCloseTo(metrics.dpr, 1);
    }
    await capture(page, testInfo, 'cad-b06-navigation-controls');
    expectNoBrowserErrors(errors);
  });
});
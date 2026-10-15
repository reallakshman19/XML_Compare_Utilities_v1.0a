import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-precision-fixture.html';

async function openFixture(page) {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pcadPrecisionReady === '1');
  return page.locator('[data-browser-fixture="pipeline-precision"]');
}

async function selectEntity(page, name, query) {
  await page.evaluate(({ name, query }) => window.__pcadPrecision.select(name, query), { name, query });
  await page.evaluate(() => window.__pcadPrecision.settle());
  return page.locator(`[data-p3d-cad-precision="${name}"]`);
}

async function setValues(panel, values = {}) {
  if (values.coordinateMode) await panel.locator('[data-field="coordinateMode"]').selectOption(values.coordinateMode);
  if (values.inputMode) await panel.locator('[data-field="inputMode"]').selectOption(values.inputMode);
  if (values.x != null) await panel.locator('[data-field="x"]').fill(String(values.x));
  if (values.y != null) await panel.locator('[data-field="y"]').fill(String(values.y));
  if (values.label != null) await panel.locator('[data-field="label"]').fill(String(values.label));
}

const state = (page) => page.evaluate(() => window.__pcadPrecision.state());

test.describe('Pipeline CAD precision editing', () => {
  test('PCAD-PE-B01 Property editor opens for one selected Table 2 node', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Table 2 node precision edit')).toBeVisible();
    await expect(panel.getByText('table2a-0003')).toBeVisible();
  });

  test('PCAD-PE-B02 Typed absolute Table 2 station/elevation preview and commit', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await setValues(panel, { x: 20, y: 231.25 });
    expect((await state(page)).revision).toBe(0);
    expect((await state(page)).overrides.table2).toHaveLength(1);
    await panel.getByRole('button', { name: 'Apply' }).click();
    const after = await state(page);
    const row = after.table2Rows.find((item) => item.id === 'table2a-0003');
    expect(row.stationValue).toBe(20);
    expect(row.elevationValue).toBe(231.25);
  });

  test('PCAD-PE-B03 Relative Table 2 displacement', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await setValues(panel, { inputMode: 'relative', x: 1, y: 0.1 });
    await panel.getByRole('button', { name: 'Apply' }).click();
    const row = (await state(page)).table2Rows.find((item) => item.id === 'table2a-0003');
    expect(row.stationValue).toBe(20);
    expect(row.elevationValue).toBeCloseTo(230.92, 6);
  });

  test('PCAD-PE-B04 Table 2 invalid ordering is rejected without mutation', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await setValues(panel, { x: 32, y: 231 });
    await expect(panel.locator('[data-role="status"]')).toContainText('less than');
    await panel.getByRole('button', { name: 'Apply' }).click();
    const after = await state(page);
    expect(after.revision).toBe(0);
    expect(after.history.undo).toBe(0);
  });

  test('PCAD-PE-B05 Table 3 depth cumulative-X/Z exact edit', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table3x', { id: 'table3b-0002' });
    await setValues(panel, { x: 50, y: '2.0M' });
    await panel.getByRole('button', { name: 'Apply' }).click();
    const row = (await state(page)).depthRows.find((item) => item.id === 'table3b-0002');
    expect(row.zText).toBe('2.0M');
    expect(row.absoluteH).not.toBe(708.374);
  });

  test('PCAD-PE-B06 Table 3 depth absolute-H/Z exact edit', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table3x', { id: 'table3b-0002' });
    await setValues(panel, { coordinateMode: 'absolute-h', x: 710, y: '2.0M' });
    await panel.getByRole('button', { name: 'Apply' }).click();
    const row = (await state(page)).depthRows.find((item) => item.id === 'table3b-0002');
    expect(row.absoluteH).toBe(710);
    expect(row.z).toBe(-2);
  });

  test('PCAD-PE-B07 Table 3 relative displacement and Above-Ground compatibility', async ({ page }) => {
    await openFixture(page);
    let panel = await selectEntity(page, 'table3x', { id: 'table3b-0002' });
    await setValues(panel, { inputMode: 'relative', x: 1, y: -0.5 });
    await panel.getByRole('button', { name: 'Apply' }).click();
    expect((await state(page)).depthRows.find((item) => item.id === 'table3b-0002').zText).toBe('2.0M');
    panel = await selectEntity(page, 'table3x', { id: 'table3b-0002' });
    await setValues(panel, { y: 'A/G' });
    await panel.getByRole('button', { name: 'Apply' }).click();
    expect((await state(page)).depthRows.find((item) => item.id === 'table3b-0002').zText).toBe('A/G');
  });

  test('PCAD-PE-B08 Marker exact position and label staged edit', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table3x', { id: 'table3c-0001' });
    await setValues(panel, { coordinateMode: 'absolute-h', x: 690, label: 'PM-002' });
    await panel.getByRole('button', { name: 'Apply' }).click();
    const row = (await state(page)).markerRows.find((item) => item.id === 'table3c-0001');
    expect(row.absoluteH).toBe(690);
    expect(row.markerText).toBe('PM-002');
  });

  test('PCAD-PE-B09 Selected grip preview uses Object Snap without model mutation', async ({ page }) => {
    await openFixture(page);
    const proof = await page.evaluate(async () => {
      const api = window.__pcadPrecision; const graph = api.workspace.graphs.table2x;
      const source = api.findNode('table2x', { id: 'table2a-0003' }); const target = api.findNode('table2x', { id: 'table2a-0004' });
      graph.setTool('select'); graph.onPrimaryPointerDown({}, source.screen, source); graph.onPrimaryPointerMove({}, target.screen, target); await api.settle();
      return { revision: api.state().revision, y: graph.currentNodes().find((node) => node.id === source.id).y, targetY: target.y, acquisition: api.workspace.objectSnap.getAcquisition('table2x') };
    });
    expect(proof.revision).toBe(0);
    expect(proof.y).toBe(proof.targetY);
    expect(proof.acquisition.candidate).toBeTruthy();
  });

  test('PCAD-PE-B10 Grip commit equals preview', async ({ page }) => {
    await openFixture(page);
    const proof = await page.evaluate(async () => {
      const api = window.__pcadPrecision; const graph = api.workspace.graphs.table2x;
      const source = api.findNode('table2x', { id: 'table2a-0003' }); const target = api.findNode('table2x', { id: 'table2a-0004' });
      graph.setTool('select'); graph.onPrimaryPointerDown({}, source.screen, source); graph.onPrimaryPointerMove({}, target.screen, target);
      const preview = graph.currentNodes().find((node) => node.id === source.id).y; graph.onPrimaryPointerUp({}, target.screen, target); await api.settle();
      return { preview, committed: api.state().table2Rows.find((row) => row.id === source.id).elevationValue };
    });
    expect(proof.committed).toBe(proof.preview);
  });

  test('PCAD-PE-B11 Cancel/Escape restores canonical geometry', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await setValues(panel, { x: 20, y: 231.25 });
    await panel.getByRole('button', { name: 'Cancel' }).click();
    const after = await state(page);
    expect(after.revision).toBe(0);
    expect(after.overrides.table2).toHaveLength(0);
    await expect(panel).toBeHidden();
  });

  test('PCAD-PE-B12 Apply creates one history entry', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await setValues(panel, { x: 20, y: 231.25 });
    await panel.getByRole('button', { name: 'Apply' }).click();
    expect((await state(page)).history.undo).toBe(1);
  });

  test('PCAD-PE-B13 Undo and Redo restore full row state and raw text', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    const before = await state(page);
    await setValues(panel, { x: 20, y: 231.25 });
    await panel.getByRole('button', { name: 'Apply' }).click();
    await page.evaluate(() => window.__pcadPrecision.workspace.controller.undo());
    expect((await state(page)).raw.table2a).toBe(before.raw.table2a);
    await page.evaluate(() => window.__pcadPrecision.workspace.controller.redo());
    expect((await state(page)).raw.table2a).toContain('0+020.0\t231.25');
  });

  test('PCAD-PE-B14 External reload cancels a stale session', async ({ page }) => {
    await openFixture(page);
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await setValues(panel, { x: 20, y: 231.25 });
    await page.evaluate(() => window.__pcadPrecision.workspace.controller.reloadGraphs());
    await expect(panel).toBeHidden();
    expect((await state(page)).overrides.table2).toHaveLength(0);
  });

  test('PCAD-PE-B15 Overlay review-only mode disables precision editing', async ({ page }) => {
    await openFixture(page);
    await page.evaluate(() => window.__pcadPrecision.setMode('overlay'));
    const panel = await selectEntity(page, 'table2x', { id: 'table2a-0003' });
    await expect(panel).toBeHidden();
    expect((await state(page)).revision).toBe(0);
  });

  test('PCAD-PE-B16 Destroy/remount leaves one lifecycle and no grip/editor leak', async ({ page }) => {
    await openFixture(page);
    expect((await state(page)).lifecycle).toBe('1');
    expect((await state(page)).panels).toHaveLength(2);
    await page.evaluate(() => window.__pcadPrecision.destroy());
    expect(await page.locator('[data-p3d-cad-precision]').count()).toBe(0);
    await page.evaluate(() => window.__pcadPrecision.remount());
    expect((await state(page)).lifecycle).toBe('1');
    expect((await state(page)).panels).toHaveLength(2);
  });

  test('PCAD-PE-B17 Existing Object Snap scenarios remain green', async ({ page }) => {
    await openFixture(page);
    expect(await page.evaluate(() => Boolean(window.__pcadPrecision.workspace.objectSnap))).toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll('[data-p3d-cad-object-snap-glyph]').length)).toBe(2);
  });

  test('PCAD-PE-B18 Existing Pipeline CAD browser foundation remains green', async ({ page }) => {
    const fixture = await openFixture(page);
    await expect(fixture.locator('[data-p3d-cad-canvas="table2x"]')).toBeVisible();
    await expect(fixture.locator('[data-p3d-cad-canvas="table3x"]')).toBeVisible();
    expect(await page.evaluate(() => window.__pcadPrecision.workspace.controller.history.canUndo)).toBe(false);
  });
});

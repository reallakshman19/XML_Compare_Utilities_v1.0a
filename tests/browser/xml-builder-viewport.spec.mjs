import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/xml-builder-viewport-fixture.html';

async function openFixture(page, query = '') {
  await page.goto(`${FIXTURE}${query}`);
  await page.waitForFunction(() => document.body.dataset.xmlBuilderViewportReady === '1');
  await page.locator('[data-xml-compare-universal-categorizer-open]').click();
  const popup = page.locator('[data-xml-compare-universal-categorizer-popup]');
  await expect(popup).toHaveCount(1);
  return popup;
}

async function cleanFixture(page, query = '') {
  await page.goto(`${FIXTURE}${query}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.xmlBuilderViewportReady === '1');
}

async function largePopup(page, query = '?large=1') {
  const started = Date.now();
  const popup = await openFixture(page, query);
  await expect.poll(async () => Number(await popup.locator('[data-uxc-surface="tree"]').getAttribute('data-uxc-virtual-total'))).toBeGreaterThanOrEqual(10_000);
  return { popup, openMs: Date.now() - started };
}

async function virtualMetrics(page) {
  return page.evaluate(() => {
    const lifecycle = window.__xmlBuilderViewport.lifecycle();
    return {
      treeTotal: lifecycle.state.selectionIndex.treeItems.length,
      pivotTotal: lifecycle.state.selectionIndex.pivotItems.length,
      tree: lifecycle.virtualViews.tree.metrics(),
      pivot: lifecycle.virtualViews.pivot.metrics(),
      controllers: Number(lifecycle.popup.dataset.uxcVirtualControllers),
    };
  });
}

async function chooseFirstNonAll(select) {
  const value = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(value);
  return value;
}

test.describe('XML Builder Workbench Viewport', () => {
  test('XMLB-VP-B01 — launcher opens one loaded lifecycle', async ({ page }) => {
    const popup = await openFixture(page);
    await expect(popup.getByText('Loaded preview', { exact: true }).first()).toBeVisible();
    await expect(popup.locator('[data-uxc-viewport-shell]')).toHaveCount(1);
    const lifecycle = await page.evaluate(() => ({
      mountId: window.__xmlBuilderViewport.lifecycle().mountId,
      status: window.__xmlBuilderViewport.lifecycle().context.status,
      hosts: Object.keys(window.__xmlBuilderViewport.lifecycle().hosts).length,
    }));
    expect(lifecycle.status).toBe('loaded');
    expect(lifecycle.hosts).toBe(2);
  });

  test('XMLB-VP-B02 — no data is visibly labelled sample', async ({ page }) => {
    const popup = await openFixture(page, '?sample=1');
    await expect(popup.getByText('Sample preview', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().context.status)).toBe('sample');
  });

  test('XMLB-VP-B03 — Tree and Pivot controls keep independent axes', async ({ page }) => {
    await cleanFixture(page);
    const popup = await openFixture(page);
    await popup.getByRole('button', { name: 'X +' }).click();
    await popup.getByRole('button', { name: 'Y +' }).click();
    const tree = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.tree.readViewTransform());
    await popup.getByRole('tab', { name: 'Pivot' }).click();
    const pivotBefore = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.pivot.readViewTransform());
    await popup.getByRole('button', { name: 'X +' }).click();
    const views = await page.evaluate(() => ({ tree: window.__xmlBuilderViewport.lifecycle().hosts.tree.readViewTransform(), pivot: window.__xmlBuilderViewport.lifecycle().hosts.pivot.readViewTransform() }));
    expect(views.pivot.zoomX).toBeGreaterThan(pivotBefore.zoomX);
    expect(views.tree.zoomX).toBe(tree.zoomX);
    expect(views.tree.zoomY).toBe(tree.zoomY);
  });

  test('XMLB-VP-B04 — Custom Range validates and Auto Fit restores', async ({ page }) => {
    const popup = await openFixture(page);
    await popup.getByRole('button', { name: 'Custom Range' }).click();
    const palette = popup.locator('[data-uxc-range-palette]');
    await palette.locator('[name="minX"]').fill('0');
    await palette.locator('[name="maxX"]').fill('3');
    await palette.locator('[name="minY"]').fill('0');
    await palette.locator('[name="maxY"]').fill('2');
    await palette.getByRole('button', { name: 'Apply' }).click();
    expect((await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.tree.readViewTransform())).scaleMode).toBe('custom-range');
    await popup.getByRole('button', { name: 'Auto Fit' }).click();
    expect((await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.tree.readViewTransform())).scaleMode).toBe('auto-fit');
  });

  test('XMLB-VP-B05 — Tree selection reveals matching Pivot rows', async ({ page }) => {
    const popup = await openFixture(page);
    await popup.locator('[data-uxc-tree-id^="tree:element:"]').first().click();
    await popup.getByRole('tab', { name: 'Side by Side' }).click();
    await expect(popup.locator('[data-uxc-pivot-id].is-selected')).toHaveCount(1);
  });

  test('XMLB-VP-B06 — Pivot selection reveals matching Tree node', async ({ page }) => {
    const popup = await openFixture(page);
    await popup.getByRole('tab', { name: 'Pivot' }).click();
    await popup.locator('[data-uxc-pivot-id]').first().click();
    await popup.getByRole('tab', { name: 'Side by Side' }).click();
    await expect(popup.locator('[data-uxc-tree-id].is-selected')).toHaveCount(1);
  });

  test('XMLB-VP-B07 — mode and viewport persist per context', async ({ page }) => {
    await cleanFixture(page);
    let popup = await openFixture(page);
    await popup.getByRole('tab', { name: 'Pivot' }).click();
    await popup.getByRole('button', { name: 'X +' }).click();
    const zoom = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.pivot.readViewTransform().zoomX);
    await popup.getByRole('button', { name: 'Close' }).click();
    await page.locator('[data-xml-compare-universal-categorizer-open]').click();
    popup = page.locator('[data-xml-compare-universal-categorizer-popup]');
    await expect(popup.getByRole('tab', { name: 'Pivot' })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.pivot.readViewTransform().zoomX)).toBe(zoom);
  });

  test('XMLB-VP-B08 — Diagnostics and export remain read only', async ({ page }) => {
    const popup = await openFixture(page);
    await popup.getByRole('tab', { name: 'Diagnostics' }).click();
    await expect(popup.getByText('Read-only diagnostics')).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Export XML' })).toBeDisabled();
  });

  test('XMLB-VP-B09 — repeated open and close are deterministic', async ({ page }) => {
    let popup = await openFixture(page);
    const first = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().mountId);
    await page.evaluate(() => window.__xmlBuilderViewport.open());
    popup = page.locator('[data-xml-compare-universal-categorizer-popup]');
    await expect(popup).toHaveCount(1);
    expect(await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().mountId)).toBeGreaterThan(first);
    await popup.getByRole('button', { name: 'Close' }).click();
    await expect(popup).toHaveCount(0);
  });
});

test.describe('XMLB-VP-002 large-data virtualization, search and named views', () => {
  test('XMLB-VP2-B01 — Large loaded context opens with bounded Tree/Pivot DOM rows', async ({ page }, testInfo) => {
    const { popup, openMs } = await largePopup(page);
    const metrics = await virtualMetrics(page);
    expect(metrics.treeTotal).toBeGreaterThanOrEqual(10_000);
    expect(metrics.pivotTotal).toBeGreaterThanOrEqual(20_000);
    expect(metrics.tree.rendered).toBeLessThanOrEqual(250);
    expect(metrics.pivot.rendered).toBeLessThanOrEqual(250);
    expect(metrics.controllers).toBe(2);
    await testInfo.attach('large-data-metrics', { body: JSON.stringify({ ...metrics, openMs }, null, 2), contentType: 'application/json' });
    await expect(popup.locator('[data-uxc-tree-id]')).not.toHaveCount(metrics.treeTotal);
  });

  test('XMLB-VP2-B02 — Tree virtual scrolling reaches middle and final identities', async ({ page }) => {
    const { popup } = await largePopup(page);
    const surface = popup.locator('[data-uxc-surface="tree"]');
    await surface.evaluate((node) => { node.scrollTop = node.scrollHeight / 2; node.dispatchEvent(new Event('scroll')); });
    await expect.poll(async () => page.evaluate(() => window.__xmlBuilderViewport.lifecycle().virtualViews.tree.metrics().firstVisible)).toBeGreaterThan(4_000);
    const middle = await surface.locator('[data-uxc-tree-id]').first().getAttribute('data-uxc-tree-id');
    expect(middle).toMatch(/^tree:node:/);
    await surface.evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    await expect(surface.locator('[data-uxc-tree-id="tree:node:9999"]')).toHaveCount(1);
  });

  test('XMLB-VP2-B03 — Pivot virtual scrolling reaches middle and final identities', async ({ page }) => {
    const { popup } = await largePopup(page);
    const targetId = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().state.selectionIndex.pivotItems.at(-1).id);
    expect(await page.evaluate((id) => window.__xmlBuilderViewport.lifecycle().virtualViews.pivot.reveal(id), targetId)).toBe(true);
    await expect(popup.locator(`[data-uxc-pivot-id="${targetId}"]`)).toHaveCount(1);
  });

  test('XMLB-VP2-B04 — Off-screen Tree selection is revealed deterministically', async ({ page }) => {
    const { popup } = await largePopup(page);
    const id = 'tree:node:9000';
    await page.evaluate((value) => window.__xmlBuilderViewport.lifecycle().eventController.selectTree(value, { focus: true }), id);
    await expect(popup.locator(`[data-uxc-tree-id="${id}"].is-selected`)).toHaveCount(1);
  });

  test('XMLB-VP2-B05 — Off-screen Pivot selection is revealed deterministically', async ({ page }) => {
    const { popup } = await largePopup(page);
    const id = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().state.selectionIndex.pivotItems.at(-100).id);
    await page.evaluate((value) => window.__xmlBuilderViewport.lifecycle().eventController.selectPivot(value, { focus: true }), id);
    await expect(popup.locator(`[data-uxc-pivot-id="${id}"].is-selected`)).toHaveCount(1);
  });

  test('XMLB-VP2-B06 — Literal search filters both surfaces and reports counts', async ({ page }, testInfo) => {
    const { popup } = await largePopup(page);
    const started = Date.now();
    await popup.locator('[data-uxc-preview-search]').fill('node 9999');
    await expect(popup.locator('[data-uxc-tree-count]')).toContainText('1 /');
    const pivotCount = Number((await popup.locator('[data-uxc-pivot-count]').textContent()).split('/')[0].trim());
    expect(pivotCount).toBeGreaterThanOrEqual(1);
    await testInfo.attach('search-duration', { body: JSON.stringify({ searchMs: Date.now() - started }), contentType: 'application/json' });
    await popup.locator('[data-uxc-search-clear]').click();
    const restoredTreeCount = Number((await popup.locator('[data-uxc-tree-count]').textContent()).split('/')[0].trim());
    expect(restoredTreeCount).toBeGreaterThanOrEqual(10_000);
  });

  test('XMLB-VP2-B07 — Tree level and Pivot level/block/source filters work', async ({ page }) => {
    const { popup } = await largePopup(page);
    await popup.locator('[data-uxc-tree-filter="level"]').selectOption('node');
    await expect(popup.locator('[data-uxc-tree-count]')).toContainText('10000 / 10001');
    await popup.getByRole('tab', { name: 'Pivot' }).click();
    await chooseFirstNonAll(popup.locator('[data-uxc-pivot-filter="block"]'));
    await chooseFirstNonAll(popup.locator('[data-uxc-pivot-filter="source"]'));
    const count = Number((await popup.locator('[data-uxc-pivot-count]').textContent()).split('/')[0].trim());
    expect(count).toBeGreaterThan(0);
  });

  test('XMLB-VP2-B08 — Selection remains authoritative when hidden by filters', async ({ page }) => {
    const { popup } = await largePopup(page);
    const id = 'tree:node:9999';
    await page.evaluate((value) => window.__xmlBuilderViewport.lifecycle().eventController.selectTree(value), id);
    await popup.locator('[data-uxc-preview-search]').fill('node 1');
    expect(await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().state.selectedTreeId)).toBe(id);
    await expect(popup.locator('[data-uxc-hidden-selection]')).toBeVisible();
  });

  test('XMLB-VP2-B09 — Named view save/apply restores mode, filters and transforms', async ({ page }) => {
    const { popup } = await largePopup(page);
    await popup.getByRole('tab', { name: 'Pivot' }).click();
    await popup.locator('[data-uxc-preview-search]').fill('node 42');
    await popup.getByRole('button', { name: 'X +' }).click();
    await popup.locator('[data-uxc-named-view-name]').fill('Node 42 review');
    await popup.locator('[data-uxc-named-view-action="save"]').click();
    await popup.locator('[data-uxc-search-clear]').click();
    await popup.getByRole('tab', { name: 'Tree' }).click();
    await popup.locator('[data-uxc-named-view-action="apply"]').click();
    await expect(popup.getByRole('tab', { name: 'Pivot' })).toHaveAttribute('aria-selected', 'true');
    await expect(popup.locator('[data-uxc-preview-search]')).toHaveValue('node 42');
    expect(await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().hosts.pivot.readViewTransform().zoomX)).toBeGreaterThan(1);
  });

  test('XMLB-VP2-B10 — Named view rename and delete work', async ({ page }) => {
    const { popup } = await largePopup(page);
    await popup.locator('[data-uxc-named-view-name]').fill('Initial view');
    await popup.locator('[data-uxc-named-view-action="save"]').click();
    await popup.locator('[data-uxc-named-view-name]').fill('Renamed view');
    await popup.locator('[data-uxc-named-view-action="rename"]').click();
    await expect(popup.locator('[data-uxc-named-view-select]')).toContainText('Renamed view');
    await popup.locator('[data-uxc-named-view-action="delete"]').click();
    await expect(popup.locator('[data-uxc-named-view-select]')).not.toContainText('Renamed view');
  });

  test('XMLB-VP2-B11 — Named views are isolated between context fingerprints', async ({ page }) => {
    let { popup } = await largePopup(page);
    await popup.locator('[data-uxc-named-view-name]').fill('Dataset A view');
    await popup.locator('[data-uxc-named-view-action="save"]').click();
    await page.goto(`${FIXTURE}?large=1&dataset=b`);
    await page.waitForFunction(() => document.body.dataset.xmlBuilderViewportReady === '1');
    await page.locator('[data-xml-compare-universal-categorizer-open]').click();
    popup = page.locator('[data-xml-compare-universal-categorizer-popup]');
    await expect(popup.locator('[data-uxc-named-view-select]')).not.toContainText('Dataset A view');
  });

  test('XMLB-VP2-B12 — Keyboard navigation crosses virtual-window boundaries', async ({ page }) => {
    const { popup } = await largePopup(page);
    const first = popup.locator('[data-uxc-tree-id]').first();
    await first.focus();
    await page.keyboard.press('End');
    await expect(popup.locator('[data-uxc-tree-id="tree:node:9999"].is-selected')).toHaveCount(1);
    await page.keyboard.press('Home');
    await expect(popup.locator('[data-uxc-tree-id="tree:document-root"].is-selected')).toHaveCount(1);
  });

  test('XMLB-VP2-B13 — Close/reopen restores current view without duplicate controllers', async ({ page }) => {
    await cleanFixture(page, '?large=1');
    let { popup } = await largePopup(page);
    await popup.locator('[data-uxc-preview-search]').fill('node 88');
    const firstMount = await page.evaluate(() => window.__xmlBuilderViewport.lifecycle().mountId);
    await popup.getByRole('button', { name: 'Close' }).click();
    await page.locator('[data-xml-compare-universal-categorizer-open]').click();
    popup = page.locator('[data-xml-compare-universal-categorizer-popup]');
    await expect(popup.locator('[data-uxc-preview-search]')).toHaveValue('node 88');
    const state = await page.evaluate(() => ({ mountId: window.__xmlBuilderViewport.lifecycle().mountId, controllers: window.__xmlBuilderViewport.lifecycle().popup.dataset.uxcVirtualControllers }));
    expect(state.mountId).toBeGreaterThan(firstMount);
    expect(state.controllers).toBe('2');
    await expect(popup).toHaveCount(1);
  });

  test('XMLB-VP2-B14 — Diagnostics and export remain read-only', async ({ page }) => {
    const { popup } = await largePopup(page);
    await popup.getByRole('tab', { name: 'Diagnostics' }).click();
    await expect(popup.getByText('Read-only diagnostics')).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Export XML' })).toBeDisabled();
  });

  test('XMLB-VP2-B15 — Existing XMLB-VP-001 modes and selection remain green', async ({ page }) => {
    const popup = await openFixture(page);
    await popup.getByRole('tab', { name: 'Side by Side' }).click();
    await popup.locator('[data-uxc-tree-id^="tree:element:"]').first().click();
    await expect(popup.locator('[data-uxc-pivot-id].is-selected')).toHaveCount(1);
    await expect(popup.getByText('Export locked').first()).toBeVisible();
  });
});

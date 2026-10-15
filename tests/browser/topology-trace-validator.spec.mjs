import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function openValidatedWorkspace(page) {
  await page.goto('/tests/browser/topology-trace-validator-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyValidatorReady === '1');
  await expect(page.locator('[data-ttv-status]')).toContainText('Validation complete');
}

test('TTV-B01 — component-aware click traces and immutable projection remain linked', async ({ page }) => {
  await openValidatedWorkspace(page);
  await page.locator('[data-ttv-branch="/B1"]').click();
  await page.locator('[data-ttv-mode="trace"]').click();
  const samples = [
    ['$[0].children[0]', 'canonical:edge:E-P1A'], ['$[0].children[1]', 'canonical:edge:E-VALVE'],
    ['$[0].children[2]', 'canonical:edge:E-FLANGE'], ['$[0].children[4]', 'canonical:edge:E-INST'],
    ['$[0].children[6]', 'canonical:edge:E-BEND-A'], ['$[0].children[7]', 'canonical:junction:J-TEE'],
    ['$[0].children[8]', 'canonical:junction:J-OLET'], ['$[0].children[5]', 'canonical:edge:E-REDU'],
  ];
  for (const [sourcePath, targetKey] of samples) {
    const source = page.locator(`[data-object-key="source:${sourcePath}"]`);
    await source.click();
    await expect(source).toHaveClass(/is-selected/);
    await expect(page.locator(`[data-object-key="${targetKey}"]`)).toHaveClass(/is-related/);
  }
  await page.locator('[data-ttv-branch="/B3"]').click();
  const boundarySource = page.locator('[data-object-key="source:$[2]"]');
  await boundarySource.click();
  await expect(page.locator('[data-object-key="canonical:boundary:BND-EXT"]')).toHaveClass(/is-related/);
  await page.locator('[data-ttv-branch="/B1"]').click();
  await page.locator('[data-ttv-mode="spatial"]').click();
  const horizontalSourceRoute = page.locator('[data-object-key="source:$[0].children[1]"]').first();
  await expect(horizontalSourceRoute).toHaveCount(1);
  await horizontalSourceRoute.dispatchEvent('click');
  await expect(page.locator('[data-canonical-edge-id="E-VALVE"]')).toHaveClass(/is-related/);
  await page.locator('[data-ttv-bottom-tab="projection"]').evaluate((button) => button.click());
  await expect(page.locator('[data-inputxml-element-id="PE-VALVE"]')).toHaveClass(/is-related/);
  await page.locator('[data-inputxml-element-id="PE-ASSEMBLY"]').evaluate((row) => row.click());
  await expect(page.locator('[data-canonical-edge-id="E-FLANGE"]')).toHaveClass(/is-related/);
  await expect(page.locator('[data-canonical-edge-id="E-GASK"]')).toHaveClass(/is-related/);
  const svg = page.locator('.ttv-svg');
  const fittedViewBox = await svg.getAttribute('viewBox');
  await page.locator('[data-ttv-zoom="in"]').click();
  expect(await svg.getAttribute('viewBox')).not.toBe(fittedViewBox);
  await page.locator('[data-ttv-fit]').click();
  expect(await svg.getAttribute('viewBox')).toBe(fittedViewBox);
  await svg.evaluate((node) => {
    for (const child of node.children) {
      child.dataset.ttvTestPointerEvents = child.style.pointerEvents;
      child.style.pointerEvents = 'none';
    }
  });
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  await svg.evaluate((node) => {
    for (const child of node.children) {
      child.style.pointerEvents = child.dataset.ttvTestPointerEvents || '';
      delete child.dataset.ttvTestPointerEvents;
    }
  });
  expect(await svg.getAttribute('viewBox')).not.toBe(fittedViewBox);
  await page.locator('[data-ttv-fit]').click();
  await page.evaluate(() => { window.__ttvSvgBeforeSearch = document.querySelector('.ttv-svg'); });
  await page.locator('[data-ttv-search-name]').fill('PT');
  await expect(page.locator('[data-ttv-search-results]')).toContainText('PIPE');
  await expect(page.locator('[data-ttv-status]')).toContainText('1 matches listed');
  expect(await page.evaluate(() => window.__ttvSvgBeforeSearch === document.querySelector('.ttv-svg'))).toBe(true);
  await expect(page.locator('[data-canonical-edge-id="E-TEE-BR"]')).toHaveCount(0);
  await page.locator('[data-ttv-search-results] [data-object-key]').first().click();
  await expect(page.locator('[data-ttv-branch="/B2"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-canonical-edge-id="E-TEE-BR"]')).toHaveCount(1);
  await expect(page.locator('[data-ttv-component-symbols]')).toBeChecked();
  const immutable = await page.evaluate(() => {
    const controller = window.__topologyValidatorHarness.controller;
    controller.assertNoMutation();
    return controller.evidence().trace.validation.metrics.issueCount;
  });
  expect(immutable).toBe(0);
});

test('TTV-B02 — Trace 3D is native SVG ISO with overlays, support isolation, compass, and navigation', async ({ page }) => {
  await openValidatedWorkspace(page);
  await page.locator('[data-ttv-projection="3D"]').click();
  await expect(page.locator('.ttv-svg')).toHaveCount(1);
  await expect(page.locator('.ttv-svg-host canvas')).toHaveCount(0);
  await expect(page.locator('[data-ttv-axis-compass]')).toHaveAttribute('data-projection', '3D');
  for (const axis of ['x', 'y', 'z']) await expect(page.locator(`[data-ttv-axis="${axis}"]`)).toBeVisible();
  const evidence = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().trace);
  expect(evidence.viewState.projection).toBe('3D');
  const sourcePoint = evidence.artifacts.canonical.nodes[0].position;
  const projected = evidence.viewModel.canonicalNodes[0].projectedPosition;
  expect(projected.x).toBeCloseTo((sourcePoint.x - sourcePoint.y) * Math.cos(Math.PI / 6), 8);
  expect(projected.y).toBeCloseTo(sourcePoint.z + (sourcePoint.x + sourcePoint.y) * Math.sin(Math.PI / 6), 8);

  const svg = page.locator('.ttv-svg');
  const fitted = await svg.getAttribute('viewBox');
  await page.locator('[data-ttv-zoom="in"]').click();
  expect(await svg.getAttribute('viewBox')).not.toBe(fitted);
  await page.locator('[data-ttv-canvas-fit]').click();
  expect(await svg.getAttribute('viewBox')).toBe(fitted);

  await page.locator('[data-ttv-isolate="supports"]').check();
  await expect(page.locator('[data-ttv-component-symbols]')).toBeChecked();
  await expect(page.locator('[data-source-component-type="SUPPORT"]')).toHaveCount(1);
  await expect(page.locator('[data-source-component-type="PIPE"]')).toHaveCount(0);

  await page.locator('[data-ttv-isolate="supports"]').uncheck();
  await page.locator('[data-ttv-component-symbols]').uncheck();
  await expect(page.locator('[data-source-component-type]')).toHaveCount(0);
  await page.locator('[data-ttv-canvas-projection="ISO"]').click();
  await expect(page.locator('[data-ttv-axis-compass]')).toHaveAttribute('data-projection', 'ISO');
  await expect(page.locator('[data-ttv-projection="3D"]')).toHaveClass(/is-active/);
  expect(await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().trace.viewState.projection)).toBe('ISO');
});

test('TTV-B03 — support draft edits are live, undoable, exportable, and evidence-safe', async ({ page }) => {
  await openValidatedWorkspace(page);
  const originalHashes = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().trace.hashes);
  await page.locator('[data-ttv-editor-mode="edit"]').click();
  await expect(page.locator('[data-ttv-editor-panel]')).toBeVisible();
  await expect(page.locator('[data-ttv-component-symbols]')).toBeChecked();

  const support = page.locator('[data-source-component-type="SUPPORT"]');
  await expect(support).toHaveCount(1);
  await support.click();
  await expect(page.locator('[data-ttv-editor-selection]')).toContainText('SRC-SUPPORT');
  await expect(page.locator('[data-ttv-editor-axis="x"]')).toBeVisible();
  await expect(page.locator('[data-ttv-editor-axis="y"]')).toBeVisible();
  await expect(page.locator('[data-ttv-editor-axis="z"]')).toHaveCount(0);

  await page.locator('[data-ttv-editor-coordinate="x"]').fill('17.25');
  await page.locator('[data-ttv-editor-coordinate="y"]').fill('0');
  await page.locator('[data-ttv-editor-coordinate="z"]').fill('0');
  await page.locator('[data-ttv-editor-set]').click();
  let editor = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().editor);
  expect(editor.draft.dirtyCount).toBe(1);
  expect(editor.draft.entities[0].position.x).toBe(17.25);
  await expect(page.locator('[data-ttv-editor-dirty]').first()).toContainText('1 pending');

  await page.locator('[data-ttv-editor-undo]').click();
  editor = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().editor);
  expect(editor.draft.entities[0].position.x).toBe(15);
  await page.locator('[data-ttv-editor-redo]').click();
  editor = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().editor);
  expect(editor.draft.entities[0].position.x).toBe(17.25);

  const xHandle = page.locator('[data-ttv-editor-axis="x"] circle');
  await xHandle.scrollIntoViewIfNeeded();
  const handleBox = await xHandle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 60, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();
  editor = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().editor);
  expect(editor.draft.entities[0].position.x).toBeGreaterThan(17.25);
  expect(editor.draft.entities[0].position.y).toBe(0);
  expect(editor.draft.entities[0].position.z).toBe(0);
  const committedX = editor.draft.entities[0].position.x;

  const cancelHandle = page.locator('[data-ttv-editor-axis="x"] circle');
  await cancelHandle.scrollIntoViewIfNeeded();
  const cancelBox = await cancelHandle.boundingBox();
  await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelBox.x + cancelBox.width / 2 + 80, cancelBox.y + cancelBox.height / 2, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  editor = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().editor);
  expect(editor.draft.entities[0].position.x).toBe(committedX);
  expect(editor.dragging).toBe(false);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-ttv-editor-export]').click(),
  ]);
  const patch = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(patch.schema).toBe('TopologyEditPatch.v1');
  expect(patch.operations).toHaveLength(1);
  expect(patch.operations[0].type).toBe('MOVE_SUPPORT');
  expect(patch.baseHashes).toEqual(originalHashes);

  const final = await page.evaluate(() => {
    const controller = window.__topologyValidatorHarness.controller;
    controller.assertNoMutation();
    return { hashes: controller.evidence().trace.hashes, editor: controller.evidence().editor };
  });
  expect(final.hashes).toEqual(originalHashes);
  expect(final.editor.mode).toBe('edit');
  await expect(page.locator('.ttv-svg-host canvas')).toHaveCount(0);

  await page.locator('[data-ttv-editor-mode="review"]').click();
  await expect(page.locator('[data-ttv-editor-panel]')).toBeHidden();
  expect((await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().editor)).draft.dirtyCount).toBe(1);
});

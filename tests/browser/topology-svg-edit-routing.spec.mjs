import { expect, test } from '@playwright/test';

async function openValidatedWorkspace(page) {
  await page.goto('/tests/browser/topology-trace-validator-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyValidatorReady === '1');
  await expect(page.locator('[data-ttv-status]')).toContainText('Validation complete');
}

test('TTV-SVG-EDIT-01 — first-class SVG Edit tab opens live native SVG support editing', async ({ page }) => {
  await openValidatedWorkspace(page);

  const svgEditTab = page.locator('[data-ttv-workspace-tab="svg-edit"]');
  await expect(svgEditTab).toHaveText('SVG Edit');
  await svgEditTab.click();

  await expect(svgEditTab).toHaveClass(/is-active/);
  await expect(page.locator('[data-ttv-workspace-panel="trace"]')).toBeVisible();
  await expect(page.locator('[data-ttv-workspace-panel="edit"]')).toBeHidden();
  await expect(page.locator('[data-ttv-editor-panel]')).toBeVisible();
  await expect(page.locator('[data-ttv-editor-mode="edit"]')).toHaveClass(/is-active/);
  await expect(page.locator('.ttv-svg-host canvas')).toHaveCount(0);
  await expect(page.locator('.ttv-svg-host .ttv-svg')).toHaveCount(1);

  let evidence = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence());
  expect(evidence.activeTab).toBe('svg-edit');
  expect(evidence.editor.mode).toBe('edit');

  const support = page.locator('[data-ttv-workspace-panel="trace"] [data-source-component-type="SUPPORT"]');
  await expect(support).toHaveCount(1);
  await support.click();
  await expect(page.locator('[data-ttv-editor-selection]')).toContainText('SRC-SUPPORT');
  await expect(page.locator('[data-ttv-editor-axis="x"]')).toBeVisible();
  await expect(page.locator('[data-ttv-editor-axis="y"]')).toBeVisible();

  await page.locator('[data-ttv-workspace-tab="trace"]').click();
  await expect(page.locator('[data-ttv-editor-panel]')).toBeHidden();
  evidence = await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence());
  expect(evidence.activeTab).toBe('trace');
  expect(evidence.editor.mode).toBe('review');

  const topologyEditTab = page.locator('[data-ttv-workspace-tab="edit"]');
  await expect(topologyEditTab).toHaveText('Topology Edit');
  await topologyEditTab.click();
  await expect(page.locator('[data-ttv-workspace-panel="edit"]')).toBeVisible();
  await expect(page.locator('[data-ttv-workspace-panel="trace"]')).toBeHidden();
  expect(await page.evaluate(() => window.__topologyValidatorHarness.controller.evidence().activeTab)).toBe('edit');
});

import { expect, test } from '@playwright/test';

test('TTV-B01 — component-aware click traces and immutable projection remain linked', async ({ page }) => {
  await page.goto('/tests/browser/topology-trace-validator-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyValidatorReady === '1');
  await expect(page.locator('[data-ttv-status]')).toContainText('Validation complete');
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
  await page.locator('[data-object-key="source:$[0].children[1]"]:visible').first().click();
  await expect(page.locator('[data-canonical-edge-id="E-VALVE"]')).toHaveClass(/is-related/);
  await page.locator('[data-ttv-bottom-tab="projection"]').click();
  await expect(page.locator('[data-inputxml-element-id="PE-VALVE"]')).toHaveClass(/is-related/);
  await page.locator('[data-inputxml-element-id="PE-ASSEMBLY"]').click();
  await expect(page.locator('[data-canonical-edge-id="E-FLANGE"]')).toHaveClass(/is-related/);
  await expect(page.locator('[data-canonical-edge-id="E-GASK"]')).toHaveClass(/is-related/);
  const svg = page.locator('.ttv-svg');
  const fittedViewBox = await svg.getAttribute('viewBox');
  await page.locator('[data-ttv-zoom="in"]').click();
  expect(await svg.getAttribute('viewBox')).not.toBe(fittedViewBox);
  await page.locator('[data-ttv-fit]').click();
  expect(await svg.getAttribute('viewBox')).toBe(fittedViewBox);
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30);
  await page.mouse.up();
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
    return controller.evidence().validation.metrics.issueCount;
  });
  expect(immutable).toBe(0);
});

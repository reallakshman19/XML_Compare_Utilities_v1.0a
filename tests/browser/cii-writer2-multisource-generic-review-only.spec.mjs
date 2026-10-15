import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const S1 = fileURLToPath(new URL('../../Benchmark/S1.CII', import.meta.url));
const S2 = fileURLToPath(new URL('../../Benchmark/S2.CII', import.meta.url));
const TARGET = fileURLToPath(new URL('../../Benchmark/T.CII', import.meta.url));

test('Utilities Writer2 generic REVIEW_ONLY binds and filters correspondence review without write controls', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  await page.evaluate(async () => {
    const { installCiiWorkspaceTile } = await import('/tabs/cii-workspace/cii-workspace-tab.js');
    const host = document.createElement('section'); host.setAttribute('data-ciiw-generic-review-host', '1'); document.body.appendChild(host); installCiiWorkspaceTile(host);
  });

  await page.locator('[data-ciiw-open-writer2]').click();
  await page.locator('[data-ciiw-source]').setInputFiles([S1, S2]);
  await page.locator('[data-ciiw-target]').setInputFiles(TARGET);

  await page.locator('[data-ciiw-inspect]').click();
  const inspection = page.locator('[data-ciiw-ms-review-only-inspection="1"]');
  await expect(inspection).toBeVisible({ timeout: 120_000 });
  await expect(inspection).toContainText('Generic multi-source review only');
  await expect(inspection).toContainText('READY FOR REVIEW');
  await expect(page.locator('[data-ciiw-status]')).toContainText('REVIEW ONLY');
  await expect(page.locator('[data-ciiw-ms-review-only-compare]')).toBeVisible();

  await page.locator('[data-ciiw-ms-review-only-compare]').click();
  const reviewTable = page.locator('[data-ciiw-ms-review-table="1"]');
  await expect(reviewTable).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('[data-ciiw-status]')).toContainText('Writer2 operations 0');
  await expect(page.locator('[data-ciiw-ms-review-only-transfer="1"]')).toContainText('CII_MS_REVIEW_ONLY_WRITE_AUTHORITY_REQUIRED');

  const allRows = reviewTable.locator('tbody tr');
  const initialCount = await allRows.count();
  expect(initialCount).toBeGreaterThan(0);
  const confidence = page.locator('[data-ciiw-confidence-filter]');
  await confidence.selectOption('HIGH');
  expect(await reviewTable.locator('tbody tr:visible').count()).toBeGreaterThan(0);
  await confidence.selectOption('ALL');

  const search = page.locator('[data-ciiw-search]');
  await search.fill('S1');
  const s1Rows = reviewTable.locator('tbody tr:visible');
  expect(await s1Rows.count()).toBeGreaterThan(0);
  expect((await s1Rows.allTextContents()).every((text) => text.includes('S1'))).toBe(true);
  await search.fill('');
  await expect(reviewTable.locator('tbody tr:visible')).toHaveCount(initialCount);

  const decisionControls = page.locator('[data-ciiw-ms-decision]');
  expect(await decisionControls.count()).toBeGreaterThan(0);
  expect((await decisionControls.evaluateAll((nodes) => nodes.map((node) => node.disabled))).every((value) => value === false)).toBe(true);
  const reviewButton = page.locator('[data-ciiw-refresh-review]');
  await expect(reviewButton).toHaveText('Bind review decisions');
  await expect(reviewButton).toBeDisabled();
  await expect(page.locator('[data-ciiw-export-csv]')).toBeEnabled();
  await expect(page.locator('[data-ciiw-export-json]')).toBeEnabled();

  await decisionControls.first().selectOption('ACCEPT');
  await expect(page.locator('[data-ciiw-status]')).toContainText('Bind review decisions to audit');
  await expect(reviewButton).toBeEnabled();
  await expect(page.locator('[data-ciiw-export-csv]')).toBeDisabled();
  await expect(page.locator('[data-ciiw-export-json]')).toBeDisabled();

  await reviewButton.click();
  await expect(page.locator('[data-ciiw-status]')).toContainText('review bound to audit', { timeout: 120_000 });
  await expect(page.locator('[data-ciiw-ms-review-only-transfer="1"]')).toContainText('Writer2 operations: 0');
  await expect(page.locator('[data-ciiw-export-csv]')).toBeEnabled();
  await expect(page.locator('[data-ciiw-export-json]')).toBeEnabled();
  await expect(page.locator('[data-ciiw-ms-bind-expected]')).toHaveCount(0);
  await expect(page.locator('[data-ciiw-ms-apply]')).toHaveCount(0);
});

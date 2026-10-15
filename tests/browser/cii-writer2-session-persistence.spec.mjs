import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const S1 = fileURLToPath(new URL('../../Benchmark/S1.CII', import.meta.url));
const S2 = fileURLToPath(new URL('../../Benchmark/S2.CII', import.meta.url));
const S3 = fileURLToPath(new URL('../../Benchmark/S3.CII', import.meta.url));
const TARGET = fileURLToPath(new URL('../../Benchmark/T.CII', import.meta.url));

async function installWriter2(page) {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await page.evaluate(async () => {
    const { installCiiWorkspaceTile } = await import('/tabs/cii-workspace/cii-workspace-tab.js');
    const host = document.createElement('section');
    host.setAttribute('data-ciiw-session-persistence-host', '1');
    document.body.appendChild(host);
    installCiiWorkspaceTile(host);
  });
  await page.locator('[data-ciiw-open-writer2]').click();
  await page.locator('[data-ciiw-source]').setInputFiles([S1, S2, S3]);
  await page.locator('[data-ciiw-target]').setInputFiles(TARGET);
  await page.locator('[data-ciiw-inspect]').click();
  await expect(page.locator('[data-ciiw-ms-anchor-ledger="1"]')).toBeVisible({ timeout: 120_000 });
}

function s1Decision(page) {
  return page.locator('[data-ciiw-ms-review-table="1"] tbody tr')
    .filter({ hasText: 'S1' })
    .locator('[data-ciiw-ms-decision]')
    .first();
}

test('retained Writer2 restores hash-bound pending review state only after exact correspondence rebuild', async ({ page }) => {
  await installWriter2(page);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('cii-writer2-session-v1:')) localStorage.removeItem(key);
  });

  await page.locator('[data-ciiw-analyze]').click();
  await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toBeVisible({ timeout: 120_000 });

  const decision = s1Decision(page);
  await expect(decision).toHaveCount(1);
  await decision.selectOption('REJECT');
  await page.locator('[data-ciiw-search]').fill('S1');
  await expect(page.locator('[data-ciiw-refresh-review]')).toBeEnabled();
  await expect(page.locator('[data-ciiw-ms-review-state="PENDING"]')).toBeVisible();

  const persistedKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('cii-writer2-session-v1:')));
  expect(persistedKeys).toHaveLength(1);
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), persistedKeys[0]);
  expect(persisted.reviewFilters.search).toBe('S1');
  expect(persisted.review.correspondenceIdentity).toBeTruthy();
  expect(Object.values(persisted.review.decisions)).toContain('REJECT');

  await installWriter2(page);
  await expect(page.locator('[data-ciiw-status]')).toContainText('Restored hash-bound Writer2 session');
  await expect(page.locator('[data-ciiw-search]')).toHaveValue('S1');

  await page.locator('[data-ciiw-analyze]').click();
  await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toBeVisible({ timeout: 120_000 });
  await expect(s1Decision(page)).toHaveValue('REJECT');
  await expect(page.locator('[data-ciiw-ms-review-state="PENDING"]')).toBeVisible();
  await expect(page.locator('[data-ciiw-refresh-review]')).toBeEnabled();
  await expect(page.locator('[data-ciiw-status]')).toContainText('Restored');
  await expect(page.locator('[data-ciiw-status]')).toContainText('unapplied changes remain pending');
});
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const S1 = fileURLToPath(new URL('../../Benchmark/S1.CII', import.meta.url));
const S2 = fileURLToPath(new URL('../../Benchmark/S2.CII', import.meta.url));
const S3 = fileURLToPath(new URL('../../Benchmark/S3.CII', import.meta.url));
const TARGET = fileURLToPath(new URL('../../Benchmark/T.CII', import.meta.url));

test('retained Writer2 restores custody-bound manual anchor and review decision after close/reopen', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await page.evaluate(async () => {
    localStorage.clear();
    const { installCiiWorkspaceTile } = await import('/tabs/cii-workspace/cii-workspace-tab.js');
    const host = document.createElement('section'); host.setAttribute('data-ciiw-session-persistence-host', '1');
    document.body.appendChild(host); installCiiWorkspaceTile(host);
  });

  async function openAndInspect() {
    await page.locator('[data-ciiw-open-writer2]').click();
    await page.locator('[data-ciiw-source]').setInputFiles([S1, S2, S3]);
    await page.locator('[data-ciiw-target]').setInputFiles(TARGET);
    await page.locator('[data-ciiw-inspect]').click();
    await expect(page.locator('[data-ciiw-ms-anchor-ledger="1"]')).toBeVisible({ timeout: 120_000 });
  }

  await openAndInspect();

  const s1 = page.locator('[data-ciiw-ms-member="S1"]');
  await s1.locator('[data-ciiw-ms-manual-source]').fill('3910');
  await s1.locator('[data-ciiw-ms-manual-target]').fill('875');
  await s1.locator('[data-ciiw-ms-manual-add]').click();
  await expect(page.locator('[data-ciiw-ms-anchor-ledger-row="manual"] [data-ciiw-ms-ledger-source][data-ciiw-ms-ledger-source-id="S1"]')).toHaveValue('3910');
  await expect(page.locator('[data-ciiw-ms-anchor-ledger-row="manual"] [data-ciiw-ms-ledger-target][data-ciiw-ms-ledger-source-id="S1"]')).toHaveValue('875');

  await page.locator('[data-ciiw-ms-compare-now]').click();
  await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toBeVisible({ timeout: 120_000 });
  const firstDecision = page.locator('[data-ciiw-ms-decision]').first();
  await expect(firstDecision).toBeVisible();
  const correspondenceId = await firstDecision.getAttribute('data-ciiw-ms-decision');
  expect(correspondenceId).toBeTruthy();
  await firstDecision.selectOption('ACCEPT');
  await expect(page.locator('[data-ciiw-ms-review-state="PENDING"]')).toBeVisible();

  await page.locator('[data-ciiw-close]').click();
  await expect(page.locator('.ciiw-backdrop')).toHaveCount(0);

  await openAndInspect();
  await expect(page.locator('[data-ciiw-ms-anchor-ledger-row="manual"] [data-ciiw-ms-ledger-source][data-ciiw-ms-ledger-source-id="S1"]')).toHaveValue('3910');
  await expect(page.locator('[data-ciiw-ms-anchor-ledger-row="manual"] [data-ciiw-ms-ledger-target][data-ciiw-ms-ledger-source-id="S1"]')).toHaveValue('875');
  await expect(page.locator('[data-ciiw-ms-member="S1"] [data-ciiw-evidence-card][data-selected="true"]')).toHaveCount(1, { timeout: 120_000 });
  // Manual remains active on historical sessions; the AUTO base is retained but
  // must not silently feed the legacy Writer2 compare until explicitly selected.

  await page.locator('[data-ciiw-ms-compare-now]').click();
  await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toBeVisible({ timeout: 120_000 });
  const restored = page.locator(`[data-ciiw-ms-decision="${correspondenceId}"]`);
  await expect(restored).toHaveCount(1);
  await expect(restored).toHaveValue('ACCEPT');
  await expect(page.locator('[data-ciiw-ms-review-state="PENDING"]')).toBeVisible();
  await expect(page.locator('[data-ciiw-refresh-review]')).toBeEnabled();

  const stored = await page.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.startsWith('cii-writer2-session-v1:'))
    .map(([key, value]) => [key, JSON.parse(value)]));
  expect(stored).toHaveLength(1);
  expect(stored[0][1].schema).toBe('CIIWorkspaceWriter2Session.v1');
  expect(stored[0][1].manualBySource.S1).toEqual([{ sourceNodeId: '3910', targetNodeId: '875' }]);
  expect(stored[0][1].authorityModeBySource.S1).toBe('MANUAL');
  expect(stored[0][1].selectedBySource.S1).toHaveLength(1);
  expect(stored[0][1].review.correspondenceIdentity).toBeTruthy();
  expect(stored[0][1].review.decisions[correspondenceId]).toBe('ACCEPT');
});

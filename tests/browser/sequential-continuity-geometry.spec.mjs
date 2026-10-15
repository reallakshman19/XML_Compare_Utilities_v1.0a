import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Build queue exposes editable continuation sheets and builds one SVG network', async ({ page }) => {
  await page.goto('/tests/browser/sequential-continuity-geometry-fixture.html');
  await page.locator('[data-ssk-action="inspect"]').click();

  await expect(page.locator('[data-ssk-source-export]')).toBeEnabled();
  await expect(page.locator('[data-ssk-workspace-export]')).toHaveText('Export workspace package');
  await expect(page.locator('.ssk-workspace-package h2')).toHaveText('5. Portable workspace package');

  await page.locator('[data-ssk-review-build]').click();
  await expect(page.locator('[data-ssk-continuity-row]')).toHaveCount(4);
  await expect(page.locator('[data-ssk-continuity-construct]')).toBeEnabled();
  await expect(page.locator('[data-ssk-continuity-construct]')).toHaveText('Build entire geometry');
  await expect(page.locator('[data-ssk-continuity-construct] svg')).toHaveCount(1);

  const externalRow = page.locator('[data-ssk-continuity-row]').filter({ hasText: 'TAIL' }).last();
  await externalRow.locator('[data-ssk-continuity-reference]').fill('/NEXT-SHEET');
  await externalRow.locator('[data-ssk-continuity-reason]').fill('Continuation sheet confirmed in Build queue');

  await page.locator('[data-ssk-continuity-construct]').click();
  await expect(page.locator('[data-ssk-network-svg]')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.ssk-network-continuation.is-internal')).toHaveCount(1);
  await expect(page.locator('.ssk-network-continuation.is-external')).toHaveCount(2);
  await expect(page.locator('[data-ssk-continuity-export]')).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-ssk-continuity-export]').click();
  const download = await downloadPromise;
  const json = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(Array.isArray(json)).toBe(true);
  expect(json).toHaveLength(2);
  expect(json[0].attributes.TREF).toBe('/B');
  expect(json[1].attributes.TREF).toBe('/NEXT-SHEET');

  await page.locator('[data-ssk-view="XY"]').click();
  await expect(page.locator('[data-ssk-network-svg]')).toHaveCount(1);
});

import { expect, test } from '@playwright/test';

test('Support Steel exports become stale after input changes and recover after rebuild', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('navigation', { name: 'Application tabs' })).toBeVisible();
  await page.evaluate(async () => {
    const moduleUrl = new URL('/tabs/support-steel-relationship-builder/support-steel-relationship-tab.js?browser=stale-preview-1', location.href).href;
    const module = await import(moduleUrl);
    module.openSupportSteelRelationshipBuilder({ showToast() {} });
  });

  const modal = page.locator('[data-ssrb-popup="1"]');
  const runState = modal.locator('[data-ssrb-run-state]');
  const preview = modal.locator('[data-ssrb-export-preview]');
  const copy = modal.locator('[data-ssrb-copy]');
  const download = modal.locator('[data-ssrb-download]');

  await expect(modal).toBeVisible();
  await expect(copy).toBeDisabled();
  await expect(download).toBeDisabled();

  await modal.locator('[data-ssrb-load-sample]').click();
  await modal.locator('[data-ssrb-tab="build"]').click();
  await modal.locator('[data-ssrb-build]').click();
  await expect(runState).toContainText('Bundle ready');

  await modal.locator('[data-ssrb-tab="export"]').click();
  await expect(preview).not.toContainText('Build relationships to preview exports.');
  await expect(preview).not.toContainText('Inputs changed.');
  await expect(copy).toBeEnabled();
  await expect(download).toBeEnabled();

  await modal.locator('[data-ssrb-tab="rules"]').click();
  await modal.locator('[data-ssrb-rule="projectionToleranceMm"]').fill('30');
  await expect(runState).toContainText('Inputs changed');

  await modal.locator('[data-ssrb-tab="export"]').click();
  await expect(preview).toHaveText('Inputs changed. Rebuild relationships to refresh exports.');
  await expect(copy).toBeDisabled();
  await expect(download).toBeDisabled();

  await modal.locator('[data-ssrb-tab="build"]').click();
  await modal.locator('[data-ssrb-build]').click();
  await expect(runState).toContainText('Bundle ready');

  await modal.locator('[data-ssrb-tab="export"]').click();
  await expect(preview).not.toContainText('Inputs changed.');
  await expect(copy).toBeEnabled();
  await expect(download).toBeEnabled();
});

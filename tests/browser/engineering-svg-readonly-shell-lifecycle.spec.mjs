import { expect, test } from '@playwright/test';

async function openFixture(page) {
  await page.goto('/tests/browser/engineering-svg-readonly-shell-fixture.html');
  await page.waitForFunction(() => Boolean(globalThis.__engineeringSvgReadOnlyShellFixture));
}

function viewer(page, id) {
  return page.locator(`[data-engineering-svg-shell="${id}"]`);
}

function property(root, key) {
  return root.locator(`[data-engineering-svg-property-key="${key}"]`);
}

test('ESVG-READONLY-B04 two viewers remain isolated', async ({ page }) => {
  await openFixture(page);
  const rootA = viewer(page, 'viewer-a');
  const rootB = viewer(page, 'viewer-b');
  await rootA.locator('[data-engineering-svg-entity-id="a"]').click();
  await rootB.locator('[data-engineering-svg-entity-id="b"]').click();
  await expect(property(rootA, 'label').locator('output')).toHaveText('viewer-a-A');
  await expect(property(rootB, 'label').locator('output')).toHaveText('viewer-b-B');
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainB.bumpSceneRevision());
  await expect(property(rootB, 'revision').locator('output')).toHaveText('2');
  await expect(property(rootA, 'revision').locator('output')).toHaveText('1');
});

test('ESVG-READONLY-B05 destroy and remount clean shell and adapter subscriptions', async ({ page }) => {
  await openFixture(page);
  const before = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.listenerCounts());
  expect(before).toEqual({ scene: 1, property: 1 });
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.destroy());
  await expect(page.locator('[data-engineering-svg-shell="viewer-a"]')).toHaveCount(0);
  const destroyed = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.listenerCounts());
  expect(destroyed).toEqual({ scene: 0, property: 0 });
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.mount());
  await expect(page.locator('[data-engineering-svg-shell="viewer-a"]')).toHaveCount(1);
  await expect(page.locator('#viewer-a [data-engineering-svg-root]')).toHaveCount(1);
  const remounted = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.listenerCounts());
  expect(remounted).toEqual({ scene: 1, property: 1 });
});

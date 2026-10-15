import { expect, test } from '@playwright/test';

async function openFixture(page) {
  await page.goto('/tests/browser/engineering-svg-shell-fixture.html');
  await page.waitForFunction(() => Boolean(globalThis.__engineeringSvgShellFixture));
}

function shell(page, id = 'shell-a') {
  return page.locator(`[data-engineering-svg-shell="${id}"]`);
}

function property(shellRoot, key) {
  return shellRoot.locator(`[data-engineering-svg-property-key="${key}"]`);
}

test('ESVG-SHELL-B01 pointer and keyboard selection render accessible property controls', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await root.locator('[data-engineering-svg-entity-id="a"]').click();
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('a');
  await expect(property(root, 'pressure').locator('input')).toHaveValue('10');
  await expect(property(root, 'tag').locator('input')).toHaveValue('shell-a-A');
  await expect(property(root, 'mode').locator('select')).toHaveValue('A');
  await expect(property(root, 'enabled').locator('input[type="checkbox"]')).toBeChecked();
  await expect(property(root, 'material').locator('output')).toHaveText('A106');
  await expect(root.locator('[data-engineering-svg-entity-id="a"]')).toHaveAttribute('role', 'button');
  await expect(root.locator('[data-engineering-svg-entity-id="a"]')).toHaveAttribute('tabindex', '0');

  const entityB = root.locator('[data-engineering-svg-entity-id="b"]');
  await entityB.focus();
  await entityB.press('Enter');
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('b');
  await expect(entityB).toHaveAttribute('aria-selected', 'true');
});

test('ESVG-SHELL-B02 mixed selection stages exact controls and applies one command', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.shell.setSelection(['a', 'b'], 'test'));
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('a, b');
  const pressure = property(root, 'pressure');
  await expect(pressure).toHaveAttribute('data-engineering-svg-property-state', 'mixed');
  await expect(pressure.locator('input')).toHaveAttribute('placeholder', 'Mixed');
  await expect(property(root, 'tag').locator('output')).toHaveText('Unavailable for full selection');

  await pressure.locator('input').fill('15');
  await expect(root.locator('[data-engineering-svg-apply]')).toBeEnabled();
  await root.locator('[data-engineering-svg-apply]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.commandCalls())).toBe(1);
  await expect.poll(() => page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.values.a.pressure)).toBe(15);
  await expect.poll(() => page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.values.b.pressure)).toBe(15);
  await expect(root.locator('[data-engineering-svg-shell-status]')).toHaveAttribute('data-engineering-svg-shell-state', 'command-committed');
});

test('ESVG-SHELL-B03 invalid and cancelled drafts never execute a command', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await root.locator('[data-engineering-svg-entity-id="a"]').click();
  const pressure = property(root, 'pressure');
  await pressure.locator('input').fill('101');
  await expect(pressure.locator('[data-engineering-svg-property-messages]')).toContainText('above its maximum');
  await expect(root.locator('[data-engineering-svg-apply]')).toBeDisabled();
  await expect(root.locator('[data-engineering-svg-cancel]')).toBeEnabled();
  await root.locator('[data-engineering-svg-cancel]').click();
  await expect(pressure.locator('input')).toHaveValue('10');
  expect(await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.commandCalls())).toBe(0);
  await expect(root.locator('[data-engineering-svg-shell-status]')).toHaveAttribute('data-engineering-svg-shell-state', 'cancelled');
});

test('ESVG-SHELL-B04 text enum and boolean controls stage and commit together', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await root.locator('[data-engineering-svg-entity-id="a"]').click();
  await property(root, 'tag').locator('input').fill('UPDATED-A');
  await property(root, 'mode').locator('select').selectOption('B');
  await property(root, 'enabled').locator('input[type="checkbox"]').uncheck();
  await root.locator('[data-engineering-svg-apply]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.commandCalls())).toBe(1);
  const values = await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.values.a);
  expect(values).toEqual({ pressure: 10, tag: 'UPDATED-A', mode: 'B', enabled: false });
});

test('ESVG-SHELL-B05 stale rejection preserves authoritative values and announces rejection', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await root.locator('[data-engineering-svg-entity-id="a"]').click();
  await property(root, 'pressure').locator('input').fill('17');
  await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.forceStaleRevision());
  await root.locator('[data-engineering-svg-apply]').click();
  await expect(root.locator('[data-engineering-svg-shell-status]')).toHaveAttribute('data-engineering-svg-shell-state', 'command-rejected');
  expect(await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.commandCalls())).toBe(0);
  expect(await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.values.a.pressure)).toBe(10);
  await expect(property(root, 'pressure').locator('input')).toHaveValue('10');
});

test('ESVG-SHELL-B06 delayed stale selection response cannot overwrite active selection', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await page.evaluate(() => {
    const domain = globalThis.__engineeringSvgShellFixture.domainA;
    domain.delayNext('a', 180);
    domain.shell.setSelection(['a'], 'delayed-a');
    domain.shell.setSelection(['b'], 'immediate-b');
  });
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('b');
  await page.waitForTimeout(250);
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('b');
  await expect(property(root, 'pressure').locator('input')).toHaveValue('20');
});

test('ESVG-SHELL-B07 focus and in-progress input survive unrelated scene revision', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await root.locator('[data-engineering-svg-entity-id="a"]').click();
  const tag = property(root, 'tag').locator('input');
  await tag.fill('FOCUS-DRAFT');
  await tag.focus();
  await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.bumpSceneRevision());
  await expect(tag).toBeFocused();
  await expect(tag).toHaveValue('FOCUS-DRAFT');
  await root.locator('[data-engineering-svg-cancel]').click();
});

test('ESVG-SHELL-B08 two shells remain isolated and remount cleanly', async ({ page }) => {
  await openFixture(page);
  const rootA = shell(page, 'shell-a');
  const rootB = shell(page, 'shell-b');
  await rootA.locator('[data-engineering-svg-entity-id="a"]').click();
  await rootB.locator('[data-engineering-svg-entity-id="b"]').click();
  await property(rootB, 'pressure').locator('input').fill('33');
  await expect(property(rootA, 'pressure').locator('input')).toHaveValue('10');
  expect(await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.shell.getInspectorModel().dirtyCount)).toBe(0);
  expect(await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainB.shell.getInspectorModel().dirtyCount)).toBe(1);

  await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.destroy());
  await expect(page.locator('[data-engineering-svg-shell="shell-a"]')).toHaveCount(0);
  await page.evaluate(() => globalThis.__engineeringSvgShellFixture.domainA.mount());
  await expect(page.locator('[data-engineering-svg-shell="shell-a"]')).toHaveCount(1);
  await expect(page.locator('#shell-a [data-engineering-svg-root]')).toHaveCount(1);
});

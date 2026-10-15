import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);

async function waitForLayoutStyles(page) {
  await expect(page.locator('#revision-compare-layout-style')).toHaveAttribute('href', /revision-compare-layout\.css/);
  await expect(page.locator('#revision-compare-review-containment-style')).toHaveAttribute('href', /revision-compare-review-containment\.css/);
  await page.waitForFunction(() => {
    const loaded = [...document.styleSheets].map((sheet) => sheet.href ?? '');
    return loaded.some((href) => href.includes('revision-compare-layout.css'))
      && loaded.some((href) => href.includes('revision-compare-review-containment.css'));
  });
}

async function openWorkspace(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('/tests/browser/revision-compare-layout.html');
  await page.locator('[data-revc-open]').click();
  await expect(page.locator('.revc-dialog')).toBeVisible();
  await waitForLayoutStyles(page);
}

async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}

async function loadPair(page) {
  await upload(page, 'baseline', 'rc002-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText(/ready/i);
  await upload(page, 'candidate', 'rc002-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText(/ready/i);
}

async function expectWithinViewport(page, selector) {
  const result = await page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left, top: box.top, right: box.right, bottom: box.bottom,
      width: innerWidth, height: innerHeight,
    };
  });
  expect(result.left).toBeGreaterThanOrEqual(-0.5);
  expect(result.top).toBeGreaterThanOrEqual(-0.5);
  expect(result.right).toBeLessThanOrEqual(result.width + 0.5);
  expect(result.bottom).toBeLessThanOrEqual(result.height + 0.5);
}

async function setScroll(locator, requested) {
  return locator.evaluate((element, top) => {
    const maximum = Math.max(0, element.scrollHeight - element.clientHeight);
    element.scrollTop = Math.min(top, maximum);
    return element.scrollTop;
  }, requested);
}

async function typeWithRetention(page, locator, text) {
  await locator.focus();
  let expected = '';
  for (const character of text) {
    expected += character;
    await page.keyboard.type(character);
    await expect(locator).toHaveValue(expected);
    await expect(locator).toBeFocused();
  }
  return expected;
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 981, height: 760 },
  { width: 980, height: 760 },
  { width: 390, height: 844 },
]) {
  test(`empty intake remains visible and scrollable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await openWorkspace(page, viewport);
    await expectWithinViewport(page, '.revc-dialog');
    await expect(page.getByRole('heading', { name: 'Load revisions' })).toBeVisible();
    await expect(page.locator('.revc-file-button')).toHaveCount(2);
    await expect(page.locator('.revc-file-button').first()).toContainText('Load staged JSON');

    const body = await page.locator('.revc-body').evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

    const closeHeight = await page.locator('.revc-head > button').evaluate((element) => element.getBoundingClientRect().height);
    expect(closeHeight).toBeLessThanOrEqual(52);

    const input = page.locator('[data-revc-file="baseline"]');
    await input.focus();
    expect(await input.evaluate((element) => element === document.activeElement)).toBe(true);
    await expect(input.locator('xpath=..')).toHaveCSS('outline-style', 'solid');
  });
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 980, height: 760 },
  { width: 390, height: 844 },
]) {
  test(`loaded scope actions remain user-visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await openWorkspace(page, viewport);
    await loadPair(page);

    const approve = page.locator('[data-revc-approve-basis]');
    await approve.scrollIntoViewIfNeeded();
    await expect(approve).toBeVisible();
    await expectWithinViewport(page, '[data-revc-approve-basis]');
    await approve.click();

    const run = page.locator('[data-revc-run-compare]');
    await run.scrollIntoViewIfNeeded();
    await expect(run).toBeVisible();
    await expect(run).toBeEnabled();
    await expectWithinViewport(page, '[data-revc-run-compare]');

    const footer = await page.locator('.revc-dialog > footer').evaluate((element) => element.getBoundingClientRect().height);
    expect(footer).toBeLessThan(viewport.width <= 390 ? 190 : 160);
  });
}

test('scope filtering preserves focus, caret, controls and body scroll', async ({ page }) => {
  await openWorkspace(page, { width: 980, height: 760 });
  await loadPair(page);
  const body = page.locator('.revc-body');
  const initialScroll = await setScroll(body, 80);
  const filter = page.locator('[data-revc-search="common"]');
  const value = await typeWithRetention(page, filter, 'line');
  const selection = await filter.evaluate((element) => ({ start: element.selectionStart, end: element.selectionEnd }));
  expect(selection).toEqual({ start: value.length, end: value.length });
  expect(await body.evaluate((element) => element.scrollTop)).toBeCloseTo(initialScroll, 0);

  const checkbox = page.locator('[data-revc-branch-id]').first();
  await checkbox.focus();
  await checkbox.click();
  await expect(checkbox).toBeFocused();

  const clearVisible = page.locator('[data-revc-group="common"][data-revc-include="none"]');
  await clearVisible.focus();
  await clearVisible.click();
  await expect(clearVisible).toBeFocused();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`visual review contains long evidence and toolbar controls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await openWorkspace(page, viewport);
    await loadPair(page);
    await page.locator('[data-revc-approve-basis]').scrollIntoViewIfNeeded();
    await page.locator('[data-revc-approve-basis]').click();
    await page.locator('[data-revc-run-compare]').scrollIntoViewIfNeeded();
    await page.locator('[data-revc-run-compare]').click();
    await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });

    await expectWithinViewport(page, '.revc-dialog');
    const containment = await page.evaluate(() => {
      const workspace = document.querySelector('.revc-review-workspace');
      const side = document.querySelector('.revc-review-side');
      return {
        workspaceClient: workspace.clientWidth,
        workspaceScroll: workspace.scrollWidth,
        sideClient: side.clientWidth,
        sideScroll: side.scrollWidth,
        workspaceHeight: workspace.clientHeight,
        workspaceScrollHeight: workspace.scrollHeight,
      };
    });
    expect(containment.workspaceScroll).toBeLessThanOrEqual(containment.workspaceClient + 1);
    expect(containment.sideScroll).toBeLessThanOrEqual(containment.sideClient + 1);
    if (viewport.width <= 980) expect(containment.workspaceScrollHeight).toBeGreaterThan(containment.workspaceHeight);

    for (const name of ['3D (WebGL)', 'Engineering SVG', 'Overlay', 'Side-by-side', 'Fit all', 'Fit selected', 'Change scope']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    }
  });
}

test('review search preserves focus, caret and side-panel scroll', async ({ page }) => {
  await openWorkspace(page, { width: 1440, height: 900 });
  await loadPair(page);
  await page.locator('[data-revc-approve-basis]').click();
  await page.locator('[data-revc-run-compare]').click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
  const side = page.locator('.revc-review-side');
  const initialScroll = await setScroll(side, 60);
  const search = page.locator('[data-revc-review-search]');
  const value = await typeWithRetention(page, search, 'pipe');
  const selection = await search.evaluate((element) => ({ start: element.selectionStart, end: element.selectionEnd }));
  expect(selection).toEqual({ start: value.length, end: value.length });
  expect(await side.evaluate((element) => element.scrollTop)).toBeCloseTo(initialScroll, 0);
});

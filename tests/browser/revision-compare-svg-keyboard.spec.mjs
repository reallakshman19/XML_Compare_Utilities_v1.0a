import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);
async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}
async function installHarness(page) {
  await page.evaluate(() => {
    window.rcKeyboardHarness = { webglCreated: 0, webglDisposed: 0 };
    const viewerFactory = async (host, callbacks) => {
      const canvas = document.createElement('canvas'); canvas.dataset.revcKeyboardWebgl = '1'; host.appendChild(canvas);
      window.rcKeyboardHarness.webglCreated += 1;
      let mode = callbacks.initialSnapshot?.mode ?? 'overlay';
      let selectedIds = callbacks.initialSnapshot?.selectedIds ?? [];
      const fitCounts = callbacks.initialSnapshot?.fitCounts ?? { all: 0, selection: 0, noGeometry: 0 };
      return {
        reattach(nextHost) { if (canvas.parentElement !== nextHost) nextHost.appendChild(canvas); },
        setModels() {}, setStatuses() {}, setVerticalAxis() {}, setMode(value) { mode = value; },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; }, fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() { return { schema: 'RevisionCompareKeyboardWebgl.v1', backend: 'WEBGL', mode,
          selectedIds: [...selectedIds], fitCounts: { ...fitCounts } }; },
        dispose() { canvas.remove(); window.rcKeyboardHarness.webglDisposed += 1; },
      };
    };
    window.rcMountOptions = { viewerAdapterOptions: { viewerFactory } };
  });
}
async function openAndCompare(page) {
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc004-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}
async function tabTo(page, locator) {
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((node) => document.activeElement === node)) return;
  }
  throw new Error('Keyboard surface was not reachable in normal Tab order.');
}
function persistent(value) {
  return { schema: value.schema, zoom: value.zoom, panX: value.panX, panY: value.panY,
    minimumZoom: value.minimumZoom, maximumZoom: value.maximumZoom };
}
async function viewer(page) {
  return page.evaluate(() => structuredClone(window.rcHandle.evidence().viewer.viewer));
}
async function authority(page) {
  return page.evaluate(() => {
    const evidence = window.rcHandle.evidence();
    return structuredClone({ audit: evidence.state.compare.audit, review: evidence.state.review.session,
      decision: evidence.state.decision.ledger, property: evidence.property });
  });
}
async function catalog(page) {
  return page.evaluate(() => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows;
    return {
      property: rows.find((row) => row.changedProperties.length > 0 && row.matchCertainty !== 'AMBIGUOUS')?.differenceId,
      changed: rows.find((row) => row.differenceCategory === 'CHANGED' && row.matchCertainty !== 'AMBIGUOUS')?.differenceId,
      added: rows.find((row) => row.differenceCategory === 'ADDED')?.differenceId,
      removed: rows.find((row) => row.differenceCategory === 'REMOVED')?.differenceId,
      ambiguous: rows.find((row) => row.matchCertainty === 'AMBIGUOUS')?.differenceId,
    };
  });
}
async function select(page, id) {
  expect(id).toBeTruthy(); await page.locator(`[data-revc-difference-id="${id}"]`).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.compare.selectedDifferenceId)).toBe(id);
}
async function openLevel(page, level) {
  const details = page.locator(`[data-level="${level}"]`);
  if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}
test('RC-SVG-004-B01 — accessible keyboard SVG navigation', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openAndCompare(page);
  const engineeringSvg = page.getByRole('button', { name: 'Engineering SVG', exact: true });
  const webgl = page.getByRole('button', { name: '3D (WebGL)', exact: true });
  const overlay = page.locator('[data-revc-svg-overlay-root="1"]');
  const panes = page.locator('[data-revc-svg-pane-root="1"]');
  await expect(engineeringSvg).toHaveAttribute('aria-pressed', 'true');
  await expect(overlay).toHaveCount(1); await expect(panes).toHaveCount(0);
  await expect(overlay).toHaveAttribute('role', 'group');
  await expect(overlay).toHaveAttribute('tabindex', '0');
  await expect(overlay).toHaveAttribute('data-revc-svg-keyboard-surface', '1');
  await expect(overlay).toHaveAttribute('aria-label', 'Revision comparison Engineering SVG overlay');
  await expect(overlay).toHaveAttribute('aria-keyshortcuts', /ArrowLeft.*Shift\+ArrowLeft.*=.*-.*/);
  const describedBy = await overlay.getAttribute('aria-describedby');
  const instructions = page.locator(`#${describedBy}`);
  await expect(instructions).toHaveCount(1);
  await expect(instructions).toContainText('Arrow keys pan');
  await expect(instructions).toContainText('Enter or Space selects');
  await tabTo(page, overlay);
  const outline = await overlay.evaluate((node) => ({ style: getComputedStyle(node).outlineStyle,
    width: parseFloat(getComputedStyle(node).outlineWidth) }));
  expect(outline.style).not.toBe('none'); expect(outline.width).toBeGreaterThan(0);
  await overlay.press('ArrowRight');
  let snapshot = await viewer(page); expect(snapshot.viewportHistory.overlay.panX).toBeCloseTo(0.05, 10);
  await overlay.press('Shift+ArrowDown');
  snapshot = await viewer(page); expect(snapshot.viewportHistory.overlay.panY).toBeCloseTo(0.20, 10);
  await overlay.press('=');
  snapshot = await viewer(page); expect(snapshot.viewportHistory.overlay.zoom).toBeCloseTo(1.20, 10);
  await overlay.press('-');
  snapshot = await viewer(page); expect(snapshot.viewportHistory.overlay.zoom).toBeCloseTo(1, 10);
  await overlay.press('Shift+=');
  snapshot = await viewer(page); expect(snapshot.viewportHistory.overlay.zoom).toBeCloseTo(1.20, 10);
  await overlay.press('0');
  snapshot = await viewer(page);
  expect(persistent(snapshot.viewportHistory.overlay)).toEqual(persistent({ ...snapshot.viewportHistory.overlay,
    zoom: 1, panX: 0, panY: 0 }));
  const entity = page.locator('[data-engineering-svg-entity-id]:not([data-revc-hidden-fit-authority])').first();
  await entity.focus(); await entity.press('Enter'); await expect(entity).toHaveAttribute('aria-selected', 'true');
  await entity.press('Space'); await expect(entity).toHaveAttribute('aria-selected', 'true');
  const entityViewport = persistent((await viewer(page)).viewportHistory.overlay);
  await entity.press('ArrowLeft');
  expect(persistent((await viewer(page)).viewportHistory.overlay)).toEqual(entityViewport);
  await page.getByRole('button', { name: 'Side-by-side' }).click(); await expect(panes).toHaveCount(2);
  await expect(panes.nth(0)).toHaveAttribute('aria-label', 'Revision comparison Rev A source Engineering SVG pane');
  await expect(panes.nth(1)).toHaveAttribute('aria-label', 'Revision comparison Rev B target Engineering SVG pane');
  await expect(page.locator('[data-revc-svg-keyboard-instructions]')).toHaveCount(2);
  expect((await viewer(page)).resources.viewportListeners).toBe(14);
  await tabTo(page, panes.nth(0)); await panes.nth(0).press('ArrowLeft');
  await expect.poll(async () => [await panes.nth(0).getAttribute('viewBox'), await panes.nth(1).getAttribute('viewBox')])
    .toEqual([await panes.nth(0).getAttribute('viewBox'), await panes.nth(0).getAttribute('viewBox')]);
  await tabTo(page, panes.nth(1)); await panes.nth(1).press('=');
  expect(await panes.nth(0).getAttribute('viewBox')).toBe(await panes.nth(1).getAttribute('viewBox'));
  const sideHistory = persistent((await viewer(page)).viewportHistory['side-by-side']);
  expect(sideHistory.panX).toBeLessThan(0); expect(sideHistory.zoom).toBeGreaterThan(1);
  const fitsBefore = structuredClone((await viewer(page)).fitCounts);
  const rows = await catalog(page);
  for (const id of [rows.changed, rows.added, rows.removed, rows.ambiguous]) await select(page, id);
  await select(page, rows.property); await openLevel(page, 2);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  await expect(page.getByText('Previous = Rev A · Current = Rev B')).toBeVisible();
  const authorityBefore = await authority(page);
  await panes.nth(1).focus(); await panes.nth(1).press('ArrowUp');
  expect((await viewer(page)).fitCounts).toEqual(fitsBefore);
  expect(await authority(page)).toEqual(authorityBefore);
  const restoredHistory = persistent((await viewer(page)).viewportHistory['side-by-side']);
  await webgl.click(); await expect(page.locator('[data-revc-keyboard-webgl]')).toHaveCount(1);
  await expect(page.locator('[data-revc-svg-keyboard-surface]')).toHaveCount(0);
  await engineeringSvg.click(); await expect(panes).toHaveCount(2);
  expect(persistent((await viewer(page)).viewportHistory['side-by-side'])).toEqual(restoredHistory);
  expect(await panes.nth(0).getAttribute('viewBox')).toBe(await panes.nth(1).getAttribute('viewBox'));
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('[data-revc-svg-keyboard-surface], [data-revc-svg-keyboard-instructions]')).toHaveCount(0);
  await openAndCompare(page);
  await expect(page.locator('[data-revc-svg-overlay-root="1"]')).toHaveCount(1);
  await expect(page.locator('[data-revc-svg-keyboard-instructions]')).toHaveCount(1);
  expect((await viewer(page)).resources.viewportListeners).toBe(7);
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('[data-revc-svg-keyboard-surface], [data-revc-svg-keyboard-instructions]')).toHaveCount(0);
  const counts = await page.evaluate(() => structuredClone(window.rcKeyboardHarness));
  expect(counts.webglDisposed).toBe(counts.webglCreated);
});

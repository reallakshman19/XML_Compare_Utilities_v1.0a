import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);

async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}

async function installHarness(page) {
  await page.evaluate(async () => {
    const svgViewer = await import('/tabs/revision-compare/revision-compare-engineering-svg-viewer.js');
    window.rcPolicyHarness = {
      failSvg: false, failWebgl: false, webglCreated: 0, webglDisposed: 0,
    };
    const svgViewerFactory = (host, callbacks) => {
      if (window.rcPolicyHarness.failSvg) throw new Error('forced Engineering SVG mount failure');
      return svgViewer.createRevisionCompareEngineeringSvgViewer(host, callbacks);
    };
    const viewerFactory = async (host, callbacks) => {
      if (window.rcPolicyHarness.failWebgl) throw new Error('forced WebGL mount failure');
      const canvas = document.createElement('canvas');
      canvas.dataset.revcPolicyWebgl = '1';
      host.appendChild(canvas); window.rcPolicyHarness.webglCreated += 1;
      let mode = callbacks.initialSnapshot?.mode ?? 'overlay';
      let selectedIds = callbacks.initialSnapshot?.selectedIds ?? [];
      const fitCounts = callbacks.initialSnapshot?.fitCounts ?? { all: 0, selection: 0 };
      return {
        reattach(nextHost) { if (canvas.parentElement !== nextHost) nextHost.appendChild(canvas); },
        setModels() {}, setStatuses() {}, setVerticalAxis() {},
        setMode(value) { mode = value; },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; },
        fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() {
          return { schema: 'RevisionComparePolicyWebglSnapshot.v1', backend: 'WEBGL', mode,
            selectedIds: [...selectedIds], fitCounts: { ...fitCounts } };
        },
        dispose() { canvas.remove(); window.rcPolicyHarness.webglDisposed += 1; },
      };
    };
    window.rcMountOptions = { viewerAdapterOptions: { viewerFactory, svgViewerFactory } };
  });
}

async function openWorkspace(page) {
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1);
}

async function compare(page) {
  await upload(page, 'baseline', 'rc004-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}

async function panAndZoom(page, root) {
  const box = await root.boundingBox();
  const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  await root.dispatchEvent('pointerdown', { pointerId: 21, button: 0, clientX: x, clientY: y });
  await root.dispatchEvent('pointermove', { pointerId: 21, button: 0, clientX: x + 55, clientY: y + 22 });
  await root.dispatchEvent('pointerup', { pointerId: 21, button: 0, clientX: x + 55, clientY: y + 22 });
  await root.dispatchEvent('wheel', { deltaY: -360, clientX: x, clientY: y });
}

function persistentViewport(viewport) {
  return {
    schema: viewport.schema,
    minimumZoom: viewport.minimumZoom,
    maximumZoom: viewport.maximumZoom,
    zoom: viewport.zoom,
    panX: viewport.panX,
    panY: viewport.panY,
  };
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

async function select(page, differenceId) {
  expect(differenceId).toBeTruthy();
  await page.locator(`[data-revc-difference-id="${differenceId}"]`).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.compare.selectedDifferenceId))
    .toBe(differenceId);
}

async function openLevel(page, level) {
  const details = page.locator(`[data-level="${level}"]`);
  if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}

async function authoritative(page) {
  return page.evaluate(() => {
    const evidence = window.rcHandle.evidence();
    return structuredClone({
      audit: evidence.state.compare.audit,
      review: evidence.state.review.session,
      decision: evidence.state.decision.ledger,
      property: evidence.property,
    });
  });
}

async function acceptAndRevoke(page, differenceId) {
  await select(page, differenceId);
  await page.locator('[data-revc-preview-candidate-index="0"]').click();
  await openLevel(page, 2);
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  await page.locator('[data-revc-decision-rationale]').fill('Accept candidate during SVG-first policy certification');
  await page.getByRole('button', { name: 'Accept candidate' }).click();
  await page.locator('[data-revc-decision-rationale]').fill('Revoke candidate during SVG-first policy certification');
  await page.getByRole('button', { name: 'Revoke decision' }).click();
}

async function closeWorkspace(page) {
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('.revc-dialog')).toHaveCount(0);
}

test('RC-SVG-003-B01 — SVG-first backend policy', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await installHarness(page); await openWorkspace(page); await compare(page);
  const engineeringSvg = page.getByRole('button', { name: 'Engineering SVG', exact: true });
  const webgl = page.getByRole('button', { name: '3D (WebGL)', exact: true });
  const overlayRoot = page.locator('[data-revc-svg-overlay-root="1"]');
  const paneRoots = page.locator('[data-revc-svg-pane-root="1"]');
  const webglCanvas = page.locator('[data-revc-policy-webgl="1"]');
  await expect(engineeringSvg).toHaveAttribute('aria-pressed', 'true');
  await expect(overlayRoot).toHaveCount(1); await expect(paneRoots).toHaveCount(0);
  await expect(webglCanvas).toHaveCount(0);
  expect(await page.evaluate(() => window.rcHandle.evidence().viewer.mountRequests)).toEqual(['SVG']);
  await panAndZoom(page, overlayRoot);
  const overlayHistory = persistentViewport(await page.evaluate(() => structuredClone(
    window.rcHandle.evidence().viewer.viewer.viewportHistory.overlay,
  )));
  await page.getByRole('button', { name: 'Side-by-side' }).click();
  await expect(paneRoots).toHaveCount(2); await expect(webglCanvas).toHaveCount(0);
  const rows = await catalog(page);
  for (const id of [rows.changed, rows.added, rows.removed, rows.ambiguous]) await select(page, id);
  await select(page, rows.property); await openLevel(page, 2);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  await expect(page.getByText('Previous = Rev A · Current = Rev B')).toBeVisible();
  const authorityBeforeBackend = await authoritative(page);

  await webgl.click();
  await expect(webgl).toHaveAttribute('aria-pressed', 'true');
  await expect(webglCanvas).toHaveCount(1); await expect(page.locator('[data-engineering-svg-root]')).toHaveCount(0);
  await acceptAndRevoke(page, rows.ambiguous);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.viewerBackend)).toBe('WEBGL');
  await expect(webglCanvas).toHaveCount(1);
  const authorityAfterActions = await authoritative(page);
  expect(authorityAfterActions.audit).toEqual(authorityBeforeBackend.audit);
  expect(authorityAfterActions.property.schema).toBe(authorityBeforeBackend.property.schema);

  await engineeringSvg.click();
  await expect(engineeringSvg).toHaveAttribute('aria-pressed', 'true');
  await expect(paneRoots).toHaveCount(2); await expect(webglCanvas).toHaveCount(0);
  const restoredOverlay = persistentViewport(await page.evaluate(() => structuredClone(
    window.rcHandle.evidence().viewer.viewer.viewportHistory.overlay,
  )));
  expect(restoredOverlay).toEqual(overlayHistory);
  await closeWorkspace(page);
  await expect(page.locator('[data-engineering-svg-root], [data-revc-policy-webgl]')).toHaveCount(0);

  await page.evaluate(() => { window.rcPolicyHarness.failSvg = true; });
  await openWorkspace(page); await compare(page);
  await expect(page.getByText('Engineering SVG unavailable.').first()).toBeVisible();
  await expect(webglCanvas).toHaveCount(0);
  const svgRecovery = page.getByRole('button', { name: 'Return to 3D (WebGL)' });
  await expect(svgRecovery).toHaveCount(1);
  expect(await page.evaluate(() => window.rcHandle.evidence().viewer.mountRequests)).toEqual(['SVG']);
  await engineeringSvg.click();
  await expect(page.getByText('Engineering SVG unavailable.').first()).toBeVisible();
  await expect(svgRecovery).toHaveCount(1);
  await expect(webglCanvas).toHaveCount(0);
  expect(await page.evaluate(() => window.rcHandle.evidence().viewer.mountRequests)).toEqual(['SVG', 'SVG']);
  await svgRecovery.click();
  await expect(webglCanvas).toHaveCount(1);
  await page.evaluate(() => { window.rcPolicyHarness.failSvg = false; });
  await engineeringSvg.click(); await expect(overlayRoot).toHaveCount(1);
  await page.evaluate(() => { window.rcPolicyHarness.failWebgl = true; });
  await webgl.click();
  await expect(page.getByText('3D (WebGL) unavailable.').first()).toBeVisible();
  await expect(webglCanvas).toHaveCount(0); await expect(page.locator('[data-engineering-svg-root]')).toHaveCount(0);
  const webglRecovery = page.getByRole('button', { name: 'Return to Engineering SVG' });
  await expect(webglRecovery).toHaveCount(1);
  await webglRecovery.click();
  await expect(overlayRoot).toHaveCount(1); await expect(webglCanvas).toHaveCount(0);
  await closeWorkspace(page);

  await page.evaluate(() => { window.rcPolicyHarness.failWebgl = false; });
  await openWorkspace(page); await compare(page);
  await expect(engineeringSvg).toHaveAttribute('aria-pressed', 'true');
  await expect(overlayRoot).toHaveCount(1); await expect(paneRoots).toHaveCount(0);
  await expect(webglCanvas).toHaveCount(0);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.presentationMode)).toBe('overlay');
  await closeWorkspace(page);
  await expect(page.locator('[data-engineering-svg-root], [data-revc-policy-webgl]')).toHaveCount(0);
  const counts = await page.evaluate(() => structuredClone(window.rcPolicyHarness));
  expect(counts.webglDisposed).toBe(counts.webglCreated);
});
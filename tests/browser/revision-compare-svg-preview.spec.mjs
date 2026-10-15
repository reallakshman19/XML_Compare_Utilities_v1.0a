import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);

async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}

async function uploadValue(page, slot, name, value) {
  const buffer = Buffer.from(JSON.stringify(value));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}

async function installViewerHarness(page, failTargetPane = false) {
  await page.evaluate(async ({ failPane }) => {
    window.rcSvgCertificationLog = { disposed: 0, modes: [], models: null };
    const viewerFactory = async (host) => {
      const canvas = document.createElement('canvas');
      canvas.dataset.revcSvgCertificationWebgl = '1';
      host.appendChild(canvas);
      let mode = 'overlay';
      let selectedIds = [];
      const fitCounts = { all: 0, selection: 0 };
      return {
        reattach(nextHost) { if (canvas.parentElement !== nextHost) nextHost.appendChild(canvas); },
        setModels(models) { window.rcSvgCertificationLog.models = structuredClone(models); },
        setStatuses() {},
        setVerticalAxis() {},
        setMode(value) { mode = value; window.rcSvgCertificationLog.modes.push(value); },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; },
        fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() {
          return { backend: 'WEBGL', mode, selectedIds, fitCounts: { ...fitCounts } };
        },
        dispose() { window.rcSvgCertificationLog.disposed += 1; canvas.remove(); },
      };
    };
    const viewerAdapterOptions = { viewerFactory };
    if (failPane) {
      const viewerModule = await import('/tabs/revision-compare/revision-compare-engineering-svg-viewer.js');
      const svgModule = await import('/core/engineering-svg/index.js');
      viewerAdapterOptions.svgViewerFactory = (host, callbacks) => viewerModule.createRevisionCompareEngineeringSvgViewer(host, {
        ...callbacks,
        workspaceFactory(options) {
          if (options.host.parentElement?.getAttribute('data-revc-svg-pane-shell') === 'B') {
            throw new Error('forced Rev B pane mount failure');
          }
          return svgModule.createEngineeringSvgWorkspace(options);
        },
      });
    }
    window.rcMountOptions = { viewerAdapterOptions };
  }, { failPane: failTargetPane });
}

async function openAndCompare(page, options = {}) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await installViewerHarness(page, options.failTargetPane);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc004-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}

async function viewerSnapshot(page) {
  return page.evaluate(() => structuredClone(window.rcHandle.evidence().viewer.viewer));
}

async function auditEvidence(page) {
  return page.evaluate(() => structuredClone(window.rcHandle.evidence().state.compare.audit));
}

function transform(snapshot, mode) {
  const value = snapshot.viewportHistory[mode];
  return { zoom: value.zoom, panX: value.panX, panY: value.panY };
}

async function pan(page, locator, dx = 60, dy = 25) {
  const box = await locator.boundingBox();
  const x = box.x + (box.width / 2);
  const y = box.y + (box.height / 2);
  await locator.dispatchEvent('pointerdown', { pointerId: 7, button: 0, clientX: x, clientY: y });
  await locator.dispatchEvent('pointermove', { pointerId: 7, button: 0, clientX: x + dx, clientY: y + dy });
  await locator.dispatchEvent('pointerup', { pointerId: 7, button: 0, clientX: x + dx, clientY: y + dy });
}

async function zoom(page, locator, deltaY = -420) {
  const box = await locator.boundingBox();
  await locator.dispatchEvent('wheel', {
    deltaY,
    clientX: box.x + (box.width * 0.35),
    clientY: box.y + (box.height * 0.65),
  });
}

async function rowEvidence(page, category) {
  return page.evaluate((value) => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows
      .filter((row) => row.differenceCategory === value);
    const row = rows.find((item) => item.matchCertainty !== 'AMBIGUOUS') ?? rows[0];
    return row ? {
      differenceId: row.differenceId,
      ids: [row.visualRefs.sourceObjectId, row.visualRefs.targetObjectId].filter(Boolean),
    } : null;
  }, category);
}

async function selectAndProve(page, category) {
  const evidence = await rowEvidence(page, category);
  expect(evidence).not.toBeNull();
  await page.locator(`[data-revc-difference-id="${evidence.differenceId}"]`).click();
  await expect.poll(() => viewerSnapshot(page).then((value) => value.selectedIds)).toEqual(evidence.ids);
  await expect(page.locator('[data-revc-hidden-fit-authority].is-selected')).toHaveCount(0);
}

function sequentialSource(name, endX) {
  return [{
    name: '/ASIM-1885-10"-S8810101-91261M7-HC-01/B1',
    type: 'BRANCH',
    attributes: {
      NAME: '/ASIM-1885-10"-S8810101-91261M7-HC-01/B1',
      HPOS: { x: 0, y: 0, z: 0 },
      TPOS: { x: endX, y: 0, z: 0 },
      HREF: '/PREVIOUS',
      TREF: '/NEXT',
    },
    children: [{
      name,
      type: 'PIPE',
      attributes: {
        APOS: { x: 10, y: 20, z: 30 },
        LPOS: { x: endX, y: 40, z: 50 },
        ROUTE_TIER: 'BUILD_QUEUE_CONTINUITY',
        AUTO_GENERATED_PIPE: 'true',
      },
    }],
  }];
}

test('Sequential source arrays resolve metadata visibly and render object-point geometry', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await installViewerHarness(page);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await uploadValue(page, 'baseline', 'sequential-a.json', sequentialSource('PIPE AUTO CONTINUITY CONT-A', 100));
  await uploadValue(page, 'candidate', 'sequential-b.json', sequentialSource('PIPE AUTO CONTINUITY CONT-B', 110));
  const preflight = page.locator('.revc-preflight').filter({ hasText: 'COMPATIBILITY PREFLIGHT' });
  await expect(preflight).toContainText('MM ↔ MM');
  await expect(preflight).toContainText('PLANT ↔ PLANT');
  await expect(preflight).toContainText('Z ↔ Z');
  await expect(preflight.locator('[data-revc-compatibility-evidence]')).toHaveCount(3);
  await expect(page.locator('[data-revc-visual-metadata]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve comparison basis' })).toBeEnabled();

  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
  const audit = await auditEvidence(page);
  expect(audit.visualModels.revA.segments).toHaveLength(1);
  expect(audit.visualModels.revB.segments).toHaveLength(1);
  await expect(page.locator('[data-revc-svg-overlay-root="1"] line')).not.toHaveCount(0);

  await page.getByRole('button', { name: 'Side-by-side' }).click();
  const panes = page.locator('[data-revc-svg-pane-root="1"]');
  await expect(panes).toHaveCount(2);
  await expect(panes.nth(0).locator('line')).not.toHaveCount(0);
  await expect(panes.nth(1).locator('line')).not.toHaveCount(0);

  await page.getByRole('button', { name: '3D (WebGL)' }).click();
  await expect(page.locator('[data-revc-svg-certification-webgl]')).toHaveCount(1);
  const webglModels = await page.evaluate(() => structuredClone(window.rcSvgCertificationLog.models));
  expect(webglModels.source.segments).toHaveLength(1);
  expect(webglModels.target.segments).toHaveLength(1);
});

test('RC-SVG-001B links panes, viewport history, exact evidence and backend lifecycle', async ({ page }) => {
  await openAndCompare(page);
  const webgl = page.getByRole('button', { name: '3D (WebGL)' });
  const svg = page.getByRole('button', { name: 'Engineering SVG' });
  const overlayButton = page.getByRole('button', { name: 'Overlay' });
  const sideButton = page.getByRole('button', { name: 'Side-by-side' });
  const webglCanvas = page.locator('[data-revc-svg-certification-webgl]');
  const overlayRoot = page.locator('[data-revc-svg-overlay-root="1"]');
  const paneRoots = page.locator('[data-revc-svg-pane-root="1"]');
  await expect(svg).toHaveAttribute('aria-pressed', 'true');
  await expect(overlayRoot).toHaveCount(1);
  await expect(webglCanvas).toHaveCount(0);
  const authoritativeBefore = await auditEvidence(page);
  const fitsBeforeNavigation = (await viewerSnapshot(page)).fitCounts;
  await pan(page, overlayRoot);
  await zoom(page, overlayRoot);
  const overlayView = transform(await viewerSnapshot(page), 'overlay');
  expect(overlayView.zoom).toBeGreaterThan(1);

  await sideButton.click();
  await expect(overlayRoot).toHaveCount(0);
  await expect(paneRoots).toHaveCount(2);
  let snapshot = await viewerSnapshot(page);
  expect(snapshot.resources).toEqual({
    roots: 2,
    observers: 1,
    selectionSubscriptions: 2,
    viewportListeners: 14,
  });
  await expect(page.locator('[data-revc-svg-keyboard-surface]')).toHaveCount(2);
  await expect(page.locator('[data-revc-svg-keyboard-instructions]')).toHaveCount(2);
  expect(await paneRoots.nth(0).getAttribute('viewBox')).toBe(await paneRoots.nth(1).getAttribute('viewBox'));
  await pan(page, paneRoots.nth(0), 50, -20);
  await zoom(page, paneRoots.nth(1), -360);
  expect(await paneRoots.nth(0).getAttribute('viewBox')).toBe(await paneRoots.nth(1).getAttribute('viewBox'));
  await selectAndProve(page, 'CHANGED');
  await selectAndProve(page, 'ADDED');
  await selectAndProve(page, 'REMOVED');

  const ambiguous = await page.evaluate(() => window.rcHandle.evidence().state.compare.audit.differenceRows
    .find((row) => row.matchCertainty === 'AMBIGUOUS').differenceId);
  await page.locator(`[data-revc-difference-id="${ambiguous}"]`).click();
  const sideBeforeCandidate = transform(await viewerSnapshot(page), 'side-by-side');
  await page.getByRole('button', { name: 'Next candidate' }).click();
  await page.getByRole('button', { name: 'Previous candidate' }).click();
  snapshot = await viewerSnapshot(page);
  expect(snapshot.fitCounts).toEqual(fitsBeforeNavigation);
  expect(transform(snapshot, 'side-by-side')).toEqual(sideBeforeCandidate);
  await page.getByRole('button', { name: 'Fit selected' }).click();
  await page.getByRole('button', { name: 'Fit all' }).click();
  snapshot = await viewerSnapshot(page);
  expect(snapshot.fitCounts.selection).toBe(fitsBeforeNavigation.selection + 1);
  expect(snapshot.fitCounts.all).toBe(fitsBeforeNavigation.all + 1);

  await overlayButton.click();
  await expect(overlayRoot).toHaveCount(1);
  expect(transform(await viewerSnapshot(page), 'overlay')).toEqual(overlayView);
  await sideButton.click();
  await expect(paneRoots).toHaveCount(2);
  await pan(page, paneRoots.nth(0), 35, 10);
  const restoredSide = transform(await viewerSnapshot(page), 'side-by-side');
  await webgl.click();
  await expect(webglCanvas).toHaveCount(1);
  await expect(paneRoots).toHaveCount(0);
  await svg.click();
  await expect(paneRoots).toHaveCount(2);
  expect(transform(await viewerSnapshot(page), 'side-by-side')).toEqual(restoredSide);
  expect(await auditEvidence(page)).toEqual(authoritativeBefore);

  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('[data-engineering-svg-root], [data-revc-svg-certification-webgl]')).toHaveCount(0);
});

test('RC-SVG-001B target-pane failure cleans both panes and recovers explicitly', async ({ page }) => {
  await openAndCompare(page, { failTargetPane: true });
  const queueCount = await page.locator('[data-revc-difference-id]').count();
  await expect(page.locator('[data-revc-svg-overlay-root="1"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Side-by-side' }).click();
  await expect(page.getByText('Engineering SVG unavailable.').first()).toBeVisible();
  await expect(page.locator('[data-revc-svg-pane-root], [data-revc-svg-overlay-root], [data-revc-svg-certification-webgl]')).toHaveCount(0);
  await expect(page.locator('[data-revc-difference-id]')).toHaveCount(queueCount);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.viewerBackend)).toBe('SVG');
  await page.getByRole('button', { name: 'Return to 3D (WebGL)' }).first().click();
  await expect(page.locator('[data-revc-svg-certification-webgl]')).toHaveCount(1);
  await expect(page.locator('[data-engineering-svg-root]')).toHaveCount(0);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.viewerBackend)).toBe('WEBGL');
});

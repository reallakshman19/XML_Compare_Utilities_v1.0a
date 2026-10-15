import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);
async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}
async function keyboardActivate(page, name) {
  const button = page.getByRole('button', { name });
  await expect(button).toBeVisible(); await expect(button).toBeEnabled();
  await button.focus(); await page.keyboard.press('Enter');
}
async function installViewer(page, fail = false) {
  await page.evaluate(({ shouldFail }) => {
    window.rcViewerLog = { selections: [], modes: [], fitAll: 0, fitSelected: 0, disposed: 0, models: null, callbacks: null };
    window.rcObservedCompareStages = [];
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.revc-progress > b').forEach((node) => {
        const text = node.textContent?.trim();
        if (text && !window.rcObservedCompareStages.includes(text)) window.rcObservedCompareStages.push(text);
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const viewerFactory = async (host, callbacks) => {
      if (shouldFail) throw new Error('Injected viewer initialization failure');
      window.rcViewerLog.callbacks = callbacks;
      const canvas = document.createElement('canvas'); canvas.dataset.rcFakeCanvas = 'true'; host.appendChild(canvas);
      return {
        reattach(nextHost) { if (canvas.parentElement !== nextHost) nextHost.appendChild(canvas); },
        setModels(models) { window.rcViewerLog.models = structuredClone(models); },
        setStatuses() {}, setMode(mode) { window.rcViewerLog.modes.push(mode); }, setVerticalAxis() {},
        setSelection(id, related = []) { window.rcViewerLog.selections.push([id, ...related]); },
        fitAll() { window.rcViewerLog.fitAll += 1; }, fitSelection() { window.rcViewerLog.fitSelected += 1; },
        getStateSnapshot() { return { cameraPosition: [10, 20, 30], cameraTarget: [0, 0, 0] }; },
        dispose() { window.rcViewerLog.disposed += 1; canvas.remove(); },
      };
    };
    window.rcMountOptions = { viewerAdapterOptions: { viewerFactory, svgViewerFactory: viewerFactory } };
  }, { shouldFail: fail });
}
async function openLoadApprove(page, options = {}) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await installViewer(page, options.viewerFailure ?? false);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc002-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc002-rev-b.json');
  await expect(page.getByRole('heading', { name: 'Confirm branch scope' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await expect(page.locator('footer [data-status="current"]')).toBeVisible();
}
async function runAndOpenReview(page) {
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByRole('heading', { name: 'Visual revision review' })).toBeVisible({ timeout: 20_000 });
}

test('bounded visual compare synchronizes 3D, queue, inspector, evidence, and invalidation', async ({ page }) => {
  await openLoadApprove(page);
  await runAndOpenReview(page);

  await expect(page.getByRole('heading', { name: 'Change summary' })).toBeVisible();
  await expect(page.locator('.revc-review-summary')).toContainText('Changed');
  await expect(page.locator('.revc-review-summary')).toContainText('Added');
  await expect(page.locator('.revc-review-summary')).toContainText('Removed');
  await expect(page.locator('.revc-review-summary')).toContainText('Needs decision');
  const stages = await page.evaluate(() => window.rcObservedCompareStages);
  expect(stages).toContain('Projecting Rev A scope');
  expect(stages).toContain('Building visual review');

  const queueRows = page.locator('[data-revc-difference-id]');
  await expect(queueRows.first()).toBeVisible();
  const fitBefore = await page.evaluate(() => window.rcViewerLog.fitSelected);
  await queueRows.nth(1).click();
  await expect(page.locator('.revc-inspector header')).toBeVisible();
  await expect(page.locator('.revc-inspector')).toContainText('Engineering explanation');
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.selections.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.rcViewerLog.fitSelected)).toBe(fitBefore);

  await page.locator('.revc-evidence summary').click();
  await expect(page.locator('.revc-evidence')).toContainText(/Unique supported identity|Bounded inferred candidate|No accepted counterpart/);
  const coordinatesBefore = await page.evaluate(() => JSON.stringify(window.rcHandle.evidence().state.compare.audit.visualModels));
  await page.getByRole('button', { name: 'Side-by-side' }).click();
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.modes.at(-1))).toBe('side-by-side');
  expect(await page.evaluate(() => JSON.stringify(window.rcHandle.evidence().state.compare.audit.visualModels))).toBe(coordinatesBefore);

  await page.getByRole('button', { name: 'Fit selected' }).click();
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.fitSelected)).toBe(fitBefore + 1);
  await page.locator('[data-revc-needs-decision]').check();
  await expect(page.locator('[data-revc-difference-id]')).toHaveCount(1);
  await expect(page.locator('[data-revc-difference-id]').first()).toContainText('Ambiguous');

  await page.getByRole('button', { name: 'Change scope' }).click();
  const scopeBranch = page.locator('[data-revc-branch-id="branch:/COMMON-500"]');
  await expect(scopeBranch).toBeEnabled();
  await scopeBranch.focus();
  await page.keyboard.press('Space');
  await expect(scopeBranch).not.toBeChecked();
  await expect(page.locator('footer [data-status="stale"]')).toBeVisible();
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.audit)).toBeNull();
  await keyboardActivate(page, 'Approve comparison basis');
  await runAndOpenReview(page);
  await expect(page.getByRole('heading', { name: 'Change summary' })).toBeVisible();

  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('.revc-dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1);
  await expect(page.locator('[data-rc-fake-canvas]')).toHaveCount(0);
});

test('cancelled compare publishes no partial audit', async ({ page }) => {
  await page.addInitScript(() => {
    const cancelled = new Set();
    const client = {
      async compare(runId, _input, onProgress) {
        const stages = ['Building identity indexes', 'Matching exact identities', 'Evaluating bounded candidates'];
        for (const stage of stages) {
          onProgress({ stage, recordsProcessed: 1, candidatePairsEvaluated: 0, maximumCandidatesForOneRecord: 0 });
          await new Promise((resolve) => setTimeout(resolve, 150));
          if (cancelled.has(runId)) { const error = new Error('cancelled'); error.code = 'REVISION_COMPARE_CANCELLED'; throw error; }
        }
        throw new Error('Cancellation test unexpectedly completed.');
      },
      async cancel(runId) { cancelled.add(runId); }, dispose() {},
    };
    window.rcMountOptions = {
      compareServiceOptions: { client },
      viewerAdapter: { clear() {}, dispose() {}, evidence: () => ({}), setPresentationMode() {}, selectDifference() {}, fitAll() {}, fitSelected() {}, render: async () => false },
    };
  });
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc002-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc002-rev-b.json');
  await expect(page.getByRole('heading', { name: 'Confirm branch scope' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('button', { name: 'Cancel comparison' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel comparison' }).click();
  await expect(page.getByRole('button', { name: 'Run visual comparison' })).toBeVisible();
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.audit)).toBeNull();
  expect(await page.evaluate(() => window.rcHandle.evidence().state.compare.status)).toBe('CANCELLED');
});

test('viewer initialization failure leaves queue and inspector usable', async ({ page }) => {
  await openLoadApprove(page, { viewerFailure: true });
  await runAndOpenReview(page);
  await expect(page.getByText('Engineering SVG unavailable').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change queue' })).toBeVisible();
  await page.locator('[data-revc-difference-id]').first().click();
  await expect(page.locator('.revc-inspector')).toContainText('Engineering explanation');
});

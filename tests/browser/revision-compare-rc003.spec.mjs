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
async function installViewer(page) {
  await page.evaluate(() => {
    window.rcViewerLog = { selections: [], fitAll: 0, fitSelected: 0, disposed: 0, modes: [] };
    window.rcObservedCompareStages = [];
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.revc-progress > b').forEach((node) => {
        const text = node.textContent?.trim();
        if (text && !window.rcObservedCompareStages.includes(text)) window.rcObservedCompareStages.push(text);
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const viewerFactory = async (host) => {
      const canvas = document.createElement('canvas'); canvas.dataset.rc003Canvas = 'true'; host.appendChild(canvas);
      return {
        reattach(next) { if (canvas.parentElement !== next) next.appendChild(canvas); }, setModels() {}, setStatuses() {},
        setMode(mode) { window.rcViewerLog.modes.push(mode); }, setVerticalAxis() {},
        setSelection(id, related = []) { window.rcViewerLog.selections.push([id, ...related]); },
        fitAll() { window.rcViewerLog.fitAll += 1; }, fitSelection() { window.rcViewerLog.fitSelected += 1; },
        getStateSnapshot() { return { cameraPosition: [10, 20, 30], cameraTarget: [0, 0, 0] }; },
        dispose() { window.rcViewerLog.disposed += 1; canvas.remove(); },
      };
    };
    window.rcMountOptions = { viewerAdapterOptions: { viewerFactory, svgViewerFactory: viewerFactory } };
  });
}
async function openAndCompare(page) {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installViewer(page);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc002-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc002-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await expect(page.getByRole('heading', { name: 'Confirm branch scope' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 20_000 });
}
async function downloadReview(page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review session' }).click();
  const path = await (await pending).path(); return JSON.parse(await readFile(path, 'utf8'));
}

test('guided review preserves comparison meaning and resumes exact review evidence', async ({ page }) => {
  await openAndCompare(page);
  await expect(page.getByRole('heading', { name: 'Change summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review progress' })).toBeVisible();
  const initial = await page.evaluate(() => window.rcHandle.evidence().state);
  expect(initial.review.session.summary.unreviewed).toBe(initial.review.session.summary.reviewableTotal);
  expect(initial.compare.audit.summary.needsDecision).toBeGreaterThan(0);

  const first = page.locator('[data-revc-difference-id]').first(); await first.click();
  const initialSelected = await page.evaluate(() => window.rcHandle.evidence().state.compare.selectedDifferenceId);
  const fitsBefore = await page.evaluate(() => window.rcViewerLog.fitSelected);
  await page.locator('[data-level="2"] summary').click();
  const note = '<support>& "clarify"';
  await page.locator('[data-revc-review-note]').fill(note);
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.locator('[data-level="2"] summary').click();
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  await expect(page.locator('.revc-inspector-facts')).toContainText('Reviewed');
  await page.locator('[data-level="3"] summary').click();
  await expect(page.locator('[data-level="3"]')).toContainText('Set note');
  await expect(page.locator('[data-level="3"]')).toContainText('Set review state');
  expect(await page.evaluate(() => window.rcViewerLog.fitSelected)).toBe(fitsBefore);
  const afterReview = await page.evaluate(() => window.rcHandle.evidence().state);
  expect(afterReview.compare.audit.summary.needsDecision).toBe(initial.compare.audit.summary.needsDecision);
  expect(afterReview.compare.audit.differenceRows).toEqual(initial.compare.audit.differenceRows);

  const selectionsBefore = await page.evaluate(() => window.rcViewerLog.selections.length);
  await page.getByRole('button', { name: 'Next priority' }).click();
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.selections.length)).toBeGreaterThan(selectionsBefore);
  expect(await page.evaluate(() => window.rcViewerLog.fitSelected)).toBe(fitsBefore);
  await page.locator('[data-level="2"] summary').click();
  await page.getByRole('button', { name: 'Needs clarification' }).click();

  await page.locator('[data-revc-review-state-filter="UNREVIEWED"]').uncheck();
  await page.locator('[data-revc-review-state-filter="REVIEWED"]').uncheck();
  await page.locator('[data-revc-review-state-filter="UNRESOLVED"]').uncheck();
  await expect(page.locator('[data-revc-difference-id]')).toHaveCount(1);
  await page.locator('[data-revc-certainty-filter="EXACT"]').uncheck();
  await page.locator('[data-revc-certainty-filter="INFERRED"]').uncheck();
  await page.locator('[data-revc-certainty-filter="NOT_APPLICABLE"]').uncheck();
  await expect(page.locator('.revc-review-queue')).toContainText(/shown · .* hidden/);

  const stagesBeforeEvidence = await page.evaluate(() => window.rcObservedCompareStages.length);
  const sessionBeforeExport = await page.evaluate(() => window.rcHandle.evidence().state.review.session);
  const exported = await downloadReview(page);
  expect(exported.schema).toBe('ReviewSession.v1');
  expect(exported.items.some((item) => item.note === note)).toBe(true);
  expect(JSON.stringify(exported)).not.toContain('differenceRows');
  expect(await page.evaluate(() => window.rcObservedCompareStages.length)).toBe(stagesBeforeEvidence);

  await page.getByRole('button', { name: 'Change scope' }).click();
  const branch = page.locator('[data-revc-branch-id="branch:/COMMON-500"]');
  await expect(branch).toBeEnabled();
  await branch.focus(); await page.keyboard.press('Space');
  await expect(branch).not.toBeChecked();
  await branch.focus(); await page.keyboard.press('Space');
  await expect(branch).toBeChecked();
  await expect(page.locator('.revc-review-session').filter({ has: page.locator('[data-revc-download-review]') })).toContainText('STALE');
  expect(await page.evaluate(() => window.rcHandle.evidence().state.review.session.status)).toBe('STALE');
  await expect(page.getByRole('button', { name: 'Download review session' })).toBeVisible();
  await keyboardActivate(page, 'Approve comparison basis');
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 20_000 });
  const reattached = await page.evaluate(() => window.rcHandle.evidence().state.review.session);
  expect(reattached.status).toBe('CURRENT'); expect(reattached.reviewSessionId).toBe(sessionBeforeExport.reviewSessionId);
  expect(reattached.items.some((item) => item.note === note)).toBe(true);

  const mismatched = structuredClone(exported); mismatched.auditId = 'audit:mismatch';
  await page.locator('[data-revc-review-import]').setInputFiles({ name: 'mismatch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatched)) });
  await expect(page.locator('.revc-import-error')).toContainText('auditId');
  expect((await page.evaluate(() => window.rcHandle.evidence().state.review.session)).reviewSessionId).toBe(reattached.reviewSessionId);
  await page.locator('[data-revc-review-import]').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('.revc-import-error')).toHaveCount(0);
  expect((await page.evaluate(() => window.rcHandle.evidence().state.review.session)).items.some((item) => item.note === note)).toBe(true);

  await page.getByRole('button', { name: 'Change scope' }).click();
  const changedBranch = page.locator('[data-revc-branch-id="branch:/COMMON-500"]');
  await changedBranch.focus(); await page.keyboard.press('Space');
  await expect(changedBranch).not.toBeChecked();
  await keyboardActivate(page, 'Approve comparison basis');
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByText('The current comparison audit differs')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => window.rcHandle.evidence().state.review.replacementRequired)).toBe(true);
  await page.getByRole('button', { name: 'Start new review session' }).click();
  expect((await page.evaluate(() => window.rcHandle.evidence().state.review.session)).auditId).not.toBe(exported.auditId);

  const disposedBefore = await page.evaluate(() => window.rcViewerLog.disposed);
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.disposed)).toBeGreaterThan(disposedBefore);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1);
  await expect(page.locator('[data-rc003-canvas]')).toHaveCount(0);
  expect(initialSelected).toBeTruthy();
});

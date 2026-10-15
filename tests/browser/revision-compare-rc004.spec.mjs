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
        const text = node.textContent?.trim(); if (text && !window.rcObservedCompareStages.includes(text)) window.rcObservedCompareStages.push(text);
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const viewerFactory = async (host) => {
      const canvas = document.createElement('canvas'); canvas.dataset.rc004Canvas = 'true'; host.appendChild(canvas);
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
  await upload(page, 'baseline', 'rc004-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}
async function clickCandidate(page, targetRecordId) {
  const buttons = page.locator('[data-revc-preview-candidate-index]'); const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    if ((await buttons.nth(index).textContent())?.includes(targetRecordId)) { await buttons.nth(index).click(); return; }
  }
  throw new Error(`Candidate ${targetRecordId} was not rendered.`);
}
async function downloadLedger(page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download decision ledger' }).click();
  const path = await (await pending).path(); return JSON.parse(await readFile(path, 'utf8'));
}

test('ambiguity decision ledger preserves audit evidence and one-to-one target ownership', async ({ page }) => {
  await openAndCompare(page);
  const initial = await page.evaluate(() => window.rcHandle.evidence().state);
  expect(initial.review.session.schema).toBe('ReviewSession.v1');
  expect(initial.decision.ledger.schema).toBe('AmbiguityDecisionLedger.v1');
  expect(initial.decision.ledger.decisions).toHaveLength(2);
  expect(initial.decision.ledger.decisions.every((item) => item.decisionState === 'UNDECIDED')).toBe(true);
  await expect(page.getByRole('heading', { name: 'Decision progress' })).toBeVisible();
  await page.locator('[data-revc-unresolved-ambiguity]').check();

  const firstId = initial.decision.ledger.decisions[0].differenceId; const secondId = initial.decision.ledger.decisions[1].differenceId;
  await page.locator(`[data-revc-difference-id="${firstId}"]`).click();
  await expect(page.locator('.revc-candidate-list button')).toHaveCount(2);
  const fitsBefore = await page.evaluate(() => ({ all: window.rcViewerLog.fitAll, selected: window.rcViewerLog.fitSelected }));
  const selectionsBefore = await page.evaluate(() => window.rcViewerLog.selections.length);
  await page.getByRole('button', { name: 'Next candidate' }).click();
  await page.getByRole('button', { name: 'Previous candidate' }).click();
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.selections.length)).toBeGreaterThan(selectionsBefore);
  expect(await page.evaluate(() => ({ all: window.rcViewerLog.fitAll, selected: window.rcViewerLog.fitSelected }))).toEqual(fitsBefore);

  const stagesBeforeDecision = await page.evaluate(() => window.rcObservedCompareStages.length);
  const reviewStateBefore = initial.review.session.items.find((item) => item.differenceId === firstId).reviewState;
  await page.locator('[data-revc-decision-rationale]').fill('<accept>& explicit evidence');
  await expect(page.getByRole('button', { name: 'Accept candidate' })).toBeEnabled();
  await page.getByRole('button', { name: 'Accept candidate' }).click();
  await expect.poll(() => page.evaluate((id) => window.rcHandle.evidence().state.decision.ledger.decisions.find((item) => item.differenceId === id).decisionState, firstId)).toBe('ACCEPTED_CANDIDATE');
  const accepted = await page.evaluate(() => window.rcHandle.evidence().state);
  const firstDecision = accepted.decision.ledger.decisions.find((item) => item.differenceId === firstId);
  expect(firstDecision.decisionState).toBe('ACCEPTED_CANDIDATE');
  expect(accepted.decision.ledger.summary.activeTargetReservations).toBe(1);
  expect(accepted.compare.audit.differenceRows.find((row) => row.differenceId === firstId).matchCertainty).toBe('AMBIGUOUS');
  expect(accepted.review.session.items.find((item) => item.differenceId === firstId).reviewState).toBe(reviewStateBefore);
  expect(await page.evaluate(() => window.rcObservedCompareStages.length)).toBe(stagesBeforeDecision);

  await page.locator(`[data-revc-difference-id="${secondId}"]`).click();
  await clickCandidate(page, firstDecision.acceptedTargetRecordId);
  await expect(page.locator('.revc-decision-inspector')).toContainText('Target reserved by');
  await page.locator('[data-revc-decision-rationale]').fill('attempt reserved target');
  await expect(page.getByRole('button', { name: 'Accept candidate' })).toBeDisabled();
  await page.getByRole('button', { name: 'Defer' }).click();
  await expect.poll(() => page.evaluate((id) => window.rcHandle.evidence().state.decision.ledger.decisions.find((item) => item.differenceId === id).decisionState, secondId)).toBe('DEFERRED');

  await page.locator('[data-revc-unresolved-ambiguity]').uncheck();
  await page.locator(`[data-revc-difference-id="${firstId}"]`).click();
  await page.locator('[data-revc-decision-rationale]').fill('revoke to release the target');
  await page.getByRole('button', { name: 'Revoke decision' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.decision.ledger.summary.activeTargetReservations)).toBe(0);

  await page.locator(`[data-revc-difference-id="${secondId}"]`).click();
  await clickCandidate(page, firstDecision.acceptedTargetRecordId);
  await page.locator('[data-revc-decision-rationale]').fill('accept the released persisted target');
  await expect(page.getByRole('button', { name: 'Accept candidate' })).toBeEnabled();
  await page.getByRole('button', { name: 'Accept candidate' }).click();
  await expect.poll(() => page.evaluate((id) => window.rcHandle.evidence().state.decision.ledger.decisions.find((item) => item.differenceId === id).decisionState, secondId)).toBe('ACCEPTED_CANDIDATE');
  const resolved = await page.evaluate(async () => {
    const state = window.rcHandle.evidence().state;
    const module = await import('/tabs/revision-compare/revision-decision-projection.js');
    return module.resolvedRevisionReview(state.compare.audit, state.decision.ledger).summary;
  });
  expect(resolved.resolvedCandidateCount).toBe(1); expect(resolved.revokedCount).toBe(1);
  expect(resolved.activeTargetReservations).toBe(1); expect(resolved.remainingNeedsDecision).toBe(1);
  expect(await page.evaluate(() => ({ all: window.rcViewerLog.fitAll, selected: window.rcViewerLog.fitSelected }))).toEqual(fitsBefore);

  const ledgerBeforeExport = await page.evaluate(() => window.rcHandle.evidence().state.decision.ledger);
  const exported = await downloadLedger(page); expect(exported).toEqual(ledgerBeforeExport);
  const exportedText = JSON.stringify(exported);
  for (const token of ['differenceRows', 'visualModels', 'rankedEvidence', 'inputxml-managed-stage']) expect(exportedText).not.toContain(`"${token}"`);

  await page.getByRole('button', { name: 'Change scope' }).click();
  const common = page.locator('[data-revc-branch-id="branch:/COMMON-500"]');
  await expect(common).toBeEnabled();
  await common.focus(); await page.keyboard.press('Space');
  await expect(common).not.toBeChecked();
  await common.focus(); await page.keyboard.press('Space');
  await expect(common).toBeChecked();
  await expect(page.locator('.revc-decision-ledger')).toContainText('STALE');
  expect(await page.evaluate(() => window.rcHandle.evidence().state.decision.ledger.status)).toBe('STALE');
  await expect(page.getByRole('button', { name: 'Download decision ledger' })).toBeVisible();
  await keyboardActivate(page, 'Approve comparison basis');
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.decision.ledger.status)).toBe('CURRENT');
  const reattached = await page.evaluate(() => window.rcHandle.evidence().state.decision.ledger);
  expect(reattached.status).toBe('CURRENT'); expect(reattached.ledgerId).toBe(exported.ledgerId); expect(reattached.events).toEqual(exported.events);

  const mismatch = structuredClone(exported); mismatch.auditId = 'audit:mismatch';
  await page.locator('[data-revc-decision-import]').setInputFiles({ name: 'mismatch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatch)) });
  await expect(page.locator('.revc-decision-import-error')).toContainText('auditId');
  expect((await page.evaluate(() => window.rcHandle.evidence().state.decision.ledger)).ledgerId).toBe(reattached.ledgerId);
  await page.locator('[data-revc-decision-import]').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('.revc-decision-import-error')).toHaveCount(0);
  expect((await page.evaluate(() => window.rcHandle.evidence().state.decision.ledger)).events).toEqual(exported.events);

  await page.getByRole('button', { name: 'Change scope' }).click();
  const changedCommon = page.locator('[data-revc-branch-id="branch:/COMMON-500"]');
  await changedCommon.focus(); await page.keyboard.press('Space');
  await expect(changedCommon).not.toBeChecked();
  await keyboardActivate(page, 'Approve comparison basis');
  await keyboardActivate(page, 'Run visual comparison');
  await expect(page.getByText('The current audit differs. Decision evidence was not remapped.')).toBeVisible({ timeout: 25_000 });
  expect(await page.evaluate(() => window.rcHandle.evidence().state.decision.replacementRequired)).toBe(true);
  await page.getByRole('button', { name: 'Start new decision ledger' }).click();
  expect((await page.evaluate(() => window.rcHandle.evidence().state.decision.ledger)).auditId).not.toBe(exported.auditId);

  const disposedBefore = await page.evaluate(() => window.rcViewerLog.disposed);
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect.poll(() => page.evaluate(() => window.rcViewerLog.disposed)).toBeGreaterThan(disposedBefore);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1); await expect(page.locator('[data-rc004-canvas]')).toHaveCount(0);
});

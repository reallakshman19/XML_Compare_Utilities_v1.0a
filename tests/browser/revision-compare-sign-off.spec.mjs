import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { canonicalRevisionCompareEvidenceValue } from '../../tabs/revision-compare/revision-evidence-package.js';
import { sha256Text } from '../../tabs/revision-compare/revision-hash.js';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);
async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}
async function installHarness(page) {
  await page.evaluate(() => {
    window.rcSignOffHarness = { objectUrls: 0, webglCreated: 0, webglDisposed: 0, nowTick: 0 };
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { if (String(blob?.type).includes('json')) window.rcSignOffHarness.objectUrls += 1; return createObjectURL(blob); };
    const viewerFactory = async (host, callbacks) => {
      const canvas = document.createElement('canvas'); canvas.dataset.revcSignOffWebgl = '1'; host.appendChild(canvas);
      window.rcSignOffHarness.webglCreated += 1;
      let mode = callbacks.initialSnapshot?.mode ?? 'overlay'; let selectedIds = callbacks.initialSnapshot?.selectedIds ?? [];
      const fitCounts = { ...(callbacks.initialSnapshot?.fitCounts ?? { all: 0, selection: 0, noGeometry: 0 }) };
      return {
        reattach(next) { if (canvas.parentElement !== next) next.appendChild(canvas); },
        setModels() {}, setStatuses() {}, setVerticalAxis() {}, setMode(value) { mode = value; },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; }, fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() { return { schema: 'RevisionCompareSignOffWebglSnapshot.v1', backend: 'WEBGL', mode, selectedIds: [...selectedIds], fitCounts: { ...fitCounts } }; },
        dispose() { canvas.remove(); window.rcSignOffHarness.webglDisposed += 1; },
      };
    };
    const now = () => new Date(Date.UTC(2026, 6, 21, 12, 0, window.rcSignOffHarness.nowTick++)).toISOString();
    window.rcMountOptions = { now, viewerAdapterOptions: { viewerFactory } };
  });
}
async function openWorkspace(page) {
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1);
}
async function closeWorkspace(page) {
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('.revc-dialog')).toHaveCount(0);
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
async function selectRow(page, id) {
  await page.locator(`[data-revc-difference-id="${id}"]`).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.compare.selectedDifferenceId)).toBe(id);
}
async function openLevel(page, level = 2) {
  const details = page.locator(`[data-level="${level}"]`);
  if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}
async function rowCatalog(page) {
  return page.evaluate(() => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows;
    return {
      reviewable: rows.filter((row) => row.differenceCategory !== 'UNCHANGED').map((row) => row.differenceId),
      ambiguous: rows.filter((row) => row.matchCertainty === 'AMBIGUOUS').map((row) => row.differenceId),
      note: rows.find((row) => row.differenceCategory !== 'UNCHANGED')?.differenceId,
    };
  });
}
async function completeAuthorities(page, rows) {
  for (const id of rows.reviewable) {
    await selectRow(page, id); await openLevel(page);
    await page.getByRole('button', { name: 'Mark reviewed' }).click();
  }
  for (const id of rows.ambiguous) {
    await selectRow(page, id);
    await page.locator('[data-revc-decision-rationale]').fill(`Resolved ambiguity ${id}`);
    await page.getByRole('button', { name: 'Confirm no match' }).click();
  }
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.signOff.status)).toBe('READY');
}
async function downloadJson(page, selector) {
  const button = page.locator(selector); await expect(button).toBeEnabled();
  const before = await page.evaluate(() => window.rcSignOffHarness.objectUrls);
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const path = await download.path(); const text = await readFile(path, 'utf8');
  expect(await page.evaluate(() => window.rcSignOffHarness.objectUrls)).toBe(before + 1);
  return { text, value: JSON.parse(text), name: download.suggestedFilename() };
}
async function createDeclaration(page, label = 'Create completion declaration', suffix = '') {
  await page.locator('[data-revc-sign-off-name]').fill(`Lakshman${suffix}`);
  await page.locator('[data-revc-sign-off-role]').fill('Principal reviewer');
  await page.locator('[data-revc-sign-off-organization]').fill('Example Engineering');
  await page.locator('[data-revc-sign-off-confirm]').check();
  const button = page.getByRole('button', { name: label, exact: true }); await expect(button).toBeEnabled(); await button.click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.signOff.status)).toBe('CREATED');
}
async function verifyReport(report, sourcePackage, state) {
  expect(report.schema).toBe('RevisionCompareSignOffReport.v1');
  expect(report.reportId).toBe(`revision-sign-off:${report.contentSha256}`); expect(report.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.sourceEvidence.packageId).toBe(sourcePackage.packageId); expect(report.sourceEvidence.packageContentSha256).toBe(sourcePackage.contentSha256);
  expect(report.sourceEvidence.sessionId).toBe(sourcePackage.identity.sessionId); expect(report.sourceEvidence.basisId).toBe(sourcePackage.identity.basisId);
  expect(report.sourceEvidence.auditId).toBe(sourcePackage.identity.auditId); expect(report.sourceEvidence.reviewSessionId).toBe(sourcePackage.identity.reviewSessionId);
  expect(report.sourceEvidence.decisionLedgerId).toBe(sourcePackage.identity.decisionLedgerId);
  expect(report.sourceEvidence.reviewRevision).toBe(state.review.session.revision); expect(report.sourceEvidence.decisionRevision).toBe(state.decision.ledger.revision);
  expect(report.completion).toEqual({ status: 'COMPLETE', reviewSummary: state.review.session.summary, decisionSummary: state.decision.ledger.summary, blockers: [] });
  expect(report.declaration.declarantName).toMatch(/^Lakshman/); expect(report.declaration.declarantRole).toBe('Principal reviewer');
  expect(report.declaration.organization).toBe('Example Engineering'); expect(Number.isNaN(Date.parse(report.declaration.declaredAt))).toBe(false);
  expect(report.declaration.statement).toBe('I confirm that I reviewed the complete Revision Compare evidence set identified by this report and that all review items and ambiguity decisions are resolved in the recorded states.');
  expect(report.trustBoundary).toEqual({ identityStatus: 'SELF_DECLARED', authenticityStatus: 'NOT_ESTABLISHED', statement: 'This is a self-declared review completion record. Declarant identity and cryptographic authenticity are not established.' });
  const { reportId, contentSha256, ...material } = report;
  expect(await sha256Text(JSON.stringify(canonicalRevisionCompareEvidenceValue(material)), webcrypto)).toBe(contentSha256);
  const json = JSON.stringify(report);
  for (const forbidden of ['payload', 'differenceRows', 'visualModels', 'selectedPairEvidence', 'rawUploadedBytes']) expect(json).not.toContain(`"${forbidden}"`);
}

test('RC-SIGN-001-B01 — complete review and create deterministic sign-off report', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page);
  await expect(page.locator('[data-revc-evidence-package-import]')).toHaveCount(0);
  await expect(page.locator('[data-revc-file]')).toHaveCount(2);
  await compare(page);
  await expect(page.locator('[data-revc-sign-off]')).toHaveCount(1);
  await expect(page.locator('[data-revc-sign-off-blockers]')).toContainText('Every review item');
  const rows = await rowCatalog(page); expect(rows.reviewable.length).toBeGreaterThan(0); expect(rows.ambiguous.length).toBeGreaterThan(0);
  await completeAuthorities(page, rows);
  await expect(page.locator('[data-revc-sign-off-blockers]')).toHaveCount(0);
  const packageBefore = await downloadJson(page, '[data-revc-download-evidence-package]');
  const audit = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.compare.audit));
  await createDeclaration(page);
  await expect(page.locator('[data-revc-sign-off-trust]')).toHaveText('This is a self-declared review completion record. Declarant identity and cryptographic authenticity are not established.');
  const stateAtCreation = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state));
  const first = await downloadJson(page, '[data-revc-download-sign-off]'); await verifyReport(first.value, packageBefore.value, stateAtCreation);
  expect(first.name).toContain('revision-sign-off_');
  const repeated = await downloadJson(page, '[data-revc-download-sign-off]'); expect(repeated.text).toBe(first.text); expect(repeated.name).toBe(first.name);

  await page.getByRole('button', { name: 'Side-by-side' }).click(); await expect(page.locator('[data-revc-svg-pane-root="1"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Fit all' }).click(); await selectRow(page, rows.reviewable.at(-1));
  await page.locator('[data-revc-review-search]').fill('presentation-filter'); await page.locator('[data-revc-review-search]').fill('');
  await page.getByRole('button', { name: '3D (WebGL)', exact: true }).click(); await expect(page.locator('[data-revc-sign-off-webgl="1"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.signOff.status)).toBe('CREATED');
  const presentation = await downloadJson(page, '[data-revc-download-sign-off]'); expect(presentation.text).toBe(first.text);

  await selectRow(page, rows.note); await openLevel(page);
  await page.locator('[data-revc-review-note]').fill('Correction after completion declaration');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.signOff.status)).toBe('STALE');
  const staleState = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state));
  expect(staleState.signOff.report).toEqual(first.value); expect(staleState.compare.audit).toEqual(audit);
  await expect(page.locator('[data-revc-sign-off-stale]')).toBeVisible();
  await expect(page.locator('[data-revc-download-sign-off]')).toBeDisabled();
  const packageChanged = await downloadJson(page, '[data-revc-download-evidence-package]');
  expect(packageChanged.value.packageId).not.toBe(packageBefore.value.packageId); expect(packageChanged.value.payload.audit).toEqual(audit);
  await createDeclaration(page, 'Create new completion declaration', ' New');
  const second = await downloadJson(page, '[data-revc-download-sign-off]');
  expect(second.value.reportId).not.toBe(first.value.reportId); expect(second.value.sourceEvidence.packageId).toBe(packageChanged.value.packageId);
  expect((await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.compare.audit)))).toEqual(audit);

  await closeWorkspace(page); await expect(page.locator('[data-revc-sign-off]')).toHaveCount(0);
  expect(await page.evaluate(() => window.rcSignOffHarness.webglDisposed)).toBe(await page.evaluate(() => window.rcSignOffHarness.webglCreated));
  await openWorkspace(page);
  await expect(page.locator('[data-revc-sign-off],[data-revc-create-sign-off]')).toHaveCount(0);
  await expect(page.locator('[data-revc-evidence-package-import]')).toHaveCount(0);
  await expect(page.locator('[data-revc-file]')).toHaveCount(2);
  await closeWorkspace(page);
  await expect(page.locator('[data-revc-sign-off],[data-revc-download-sign-off],[data-revc-sign-off-webgl]')).toHaveCount(0);
  expect(await page.evaluate(() => window.rcSignOffHarness.webglDisposed)).toBe(await page.evaluate(() => window.rcSignOffHarness.webglCreated));
});

import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);
async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}
async function installHarness(page) {
  await page.evaluate(() => {
    window.rcPackageHarness = { objectUrls: 0, webglCreated: 0, webglDisposed: 0 };
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (String(blob?.type).includes('json')) window.rcPackageHarness.objectUrls += 1;
      return createObjectURL(blob);
    };
    const viewerFactory = async (host, callbacks) => {
      const canvas = document.createElement('canvas'); canvas.dataset.revcPackageWebgl = '1'; host.appendChild(canvas);
      window.rcPackageHarness.webglCreated += 1;
      let mode = callbacks.initialSnapshot?.mode ?? 'overlay'; let selectedIds = callbacks.initialSnapshot?.selectedIds ?? [];
      const fitCounts = { ...(callbacks.initialSnapshot?.fitCounts ?? { all: 0, selection: 0, noGeometry: 0 }) };
      return {
        reattach(nextHost) { if (canvas.parentElement !== nextHost) nextHost.appendChild(canvas); },
        setModels() {}, setStatuses() {}, setVerticalAxis() {}, setMode(value) { mode = value; },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; }, fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() { return { schema: 'RevisionComparePackageWebglSnapshot.v1', backend: 'WEBGL', mode, selectedIds: [...selectedIds], fitCounts: { ...fitCounts } }; },
        dispose() { canvas.remove(); window.rcPackageHarness.webglDisposed += 1; },
      };
    };
    window.rcMountOptions = { viewerAdapterOptions: { viewerFactory } };
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
async function openLevel(page, level = 2) {
  const details = page.locator(`[data-level="${level}"]`);
  if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}
async function selectDifference(page, id) {
  await page.locator(`[data-revc-difference-id="${id}"]`).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.compare.selectedDifferenceId)).toBe(id);
}
async function downloadPackage(page) {
  const button = page.locator('[data-revc-download-evidence-package]');
  await expect(button).toBeEnabled();
  const before = await page.evaluate(() => window.rcPackageHarness.objectUrls);
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const path = await download.path(); const text = await readFile(path, 'utf8');
  expect(await page.evaluate(() => window.rcPackageHarness.objectUrls)).toBe(before + 1);
  return { text, value: JSON.parse(text), fileName: download.suggestedFilename() };
}
function verifyPackage(value, state) {
  expect(value.schema).toBe('RevisionCompareEvidencePackage.v1');
  expect(value.validation).toEqual({ status: 'READY', errors: [] });
  expect(value.payload.sessionManifest.schema).toBe('RevisionSessionManifest.v1');
  expect(value.payload.scopeBasisManifest.schema).toBe('RevisionScopeBasisManifest.v1');
  expect(value.payload.audit.schema).toBe('RevisionCompareAudit.v1');
  expect(value.payload.reviewSession.schema).toBe('ReviewSession.v1');
  expect(value.payload.decisionLedger.schema).toBe('AmbiguityDecisionLedger.v1');
  expect(value.identity.sessionId).toBe(value.payload.sessionManifest.session.sessionId);
  expect(value.identity.sessionId).toBe(value.payload.scopeBasisManifest.sessionId);
  expect(value.identity.basisId).toBe(value.payload.scopeBasisManifest.basis.basisId);
  expect(value.identity.auditId).toBe(value.payload.audit.auditId);
  expect(value.identity.reviewSessionId).toBe(value.payload.reviewSession.reviewSessionId);
  expect(value.identity.decisionLedgerId).toBe(value.payload.decisionLedger.ledgerId);
  expect(value.identity.revADocumentId).toBe(value.payload.audit.revADocumentId);
  expect(value.identity.revBDocumentId).toBe(value.payload.audit.revBDocumentId);
  expect(value.payload.audit).toEqual(state.compare.audit);
  expect(value.payload.reviewSession).toEqual(state.review.session);
  expect(value.payload.decisionLedger).toEqual(state.decision.ledger);
  expect(value.contentSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(value.packageId).toBe(`revision-evidence-package:${value.contentSha256}`);
  const json = JSON.stringify(value);
  for (const forbidden of ['viewerBackend', 'presentationMode', 'selectedDifferenceId', 'viewportHistory', 'fitCounts', 'queue', 'filters', 'Blob', 'objectUrl', 'rawUploadedBytes']) {
    expect(json).not.toContain(`"${forbidden}"`);
  }
}
async function rowCatalog(page) {
  return page.evaluate(() => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows;
    return {
      review: rows.find((row) => row.differenceCategory !== 'UNCHANGED' && row.matchCertainty !== 'AMBIGUOUS')?.differenceId,
      ambiguous: rows.find((row) => row.matchCertainty === 'AMBIGUOUS')?.differenceId,
      other: rows.find((row) => row.differenceCategory !== 'UNCHANGED')?.differenceId,
    };
  });
}
async function verifySessionMismatchControl(page) {
  const result = await page.evaluate(async () => {
    const state = structuredClone(window.rcHandle.evidence().state);
    state.basis = { ...state.basis, sessionId: `${state.session.sessionId}:stale` };
    const { _test } = await import('../../tabs/revision-compare/revision-compare-workspace.js');
    const root = document.createElement('div');
    root.innerHTML = '<div class="revc-body"></div>';
    document.body.appendChild(root);
    const before = window.rcPackageHarness.objectUrls;
    _test.prepareEvidencePackageControl(root, state);
    const button = root.querySelector('[data-revc-download-evidence-package]');
    const status = root.querySelector('[data-revc-evidence-package-status]')?.textContent || '';
    button.click();
    const value = { disabled: button.disabled, status, downloads: window.rcPackageHarness.objectUrls - before };
    root.remove();
    return value;
  });
  expect(result.disabled).toBe(true);
  expect(result.status).toContain('does not belong to the current revision session');
  expect(result.downloads).toBe(0);
}

test('RC-PKG-001-B01 — deterministic complete evidence package export', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page);
  const packageButton = page.locator('[data-revc-download-evidence-package]');
  await expect(packageButton).toHaveCount(1); await expect(packageButton).toBeDisabled();
  await expect(page.locator('[data-revc-evidence-package-status]')).toContainText('Evidence package requires');
  await compare(page); await expect(packageButton).toHaveCount(1); await expect(packageButton).toBeEnabled();
  await verifySessionMismatchControl(page);
  const rows = await rowCatalog(page); expect(rows.review).toBeTruthy(); expect(rows.ambiguous).toBeTruthy();
  await selectDifference(page, rows.review); await openLevel(page);
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  await selectDifference(page, rows.ambiguous);
  await page.locator('[data-revc-decision-rationale]').fill('Package decision evidence');
  await page.getByRole('button', { name: 'Confirm no match' }).click();
  await expect.poll(() => page.evaluate((differenceId) => window.rcHandle.evidence().state.decision.ledger.decisions
    .find((item) => item.differenceId === differenceId)?.decisionState, rows.ambiguous))
    .toBe('CONFIRMED_NO_MATCH');
  const state = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state));
  const audit = structuredClone(state.compare.audit);
  const first = await downloadPackage(page); verifyPackage(first.value, state);
  expect(first.fileName).toBe(`${state.session.sessionId}.evidence-package.json`);
  const second = await downloadPackage(page); expect(second.text).toBe(first.text);

  await page.getByRole('button', { name: 'Side-by-side' }).click();
  const panes = page.locator('[data-revc-svg-pane-root="1"]'); await expect(panes).toHaveCount(2);
  const box = await panes.first().boundingBox();
  await panes.first().dispatchEvent('wheel', { deltaY: -360, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
  await page.getByRole('button', { name: 'Fit all' }).click();
  await selectDifference(page, rows.other);
  const search = page.locator('[data-revc-review-search]'); await search.fill('package-filter-does-not-match');
  const uiChanged = await downloadPackage(page); expect(uiChanged.text).toBe(first.text); await search.fill('');

  await selectDifference(page, rows.review); await openLevel(page);
  await page.locator('[data-revc-review-note]').fill('Changed package review note');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect.poll(() => page.evaluate((id) => window.rcHandle.evidence().state.review.session.items
    .find((item) => item.differenceId === id)?.note, rows.review)).toBe('Changed package review note');
  const noteState = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state));
  const changed = await downloadPackage(page); verifyPackage(changed.value, noteState);
  expect(changed.value.contentSha256).not.toBe(first.value.contentSha256);
  expect(changed.value.payload.audit).toEqual(audit);

  await page.getByRole('button', { name: '3D (WebGL)', exact: true }).click();
  await expect(page.locator('[data-revc-package-webgl="1"]')).toHaveCount(1);
  await expect(packageButton).toBeEnabled();
  const webgl = await downloadPackage(page); expect(webgl.text).toBe(changed.text);
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('[data-revc-download-evidence-package], [data-revc-package-webgl]')).toHaveCount(0);
  expect(await page.evaluate(() => window.rcPackageHarness.webglDisposed)).toBe(await page.evaluate(() => window.rcPackageHarness.webglCreated));

  await openWorkspace(page); await expect(packageButton).toHaveCount(1); await expect(packageButton).toBeDisabled();
  await compare(page); await expect(packageButton).toHaveCount(1); await expect(packageButton).toBeEnabled();
  const downloadsBefore = await page.evaluate(() => window.rcPackageHarness.objectUrls);
  await downloadPackage(page);
  expect(await page.evaluate(() => window.rcPackageHarness.objectUrls)).toBe(downloadsBefore + 1);
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('[data-revc-download-evidence-package]')).toHaveCount(0);
});

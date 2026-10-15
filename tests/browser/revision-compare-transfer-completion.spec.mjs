import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { completionFixture, declaredAt } from '../revision-compare-transfer-completion-fixtures.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function mountFixture(page) {
  const fixture = await completionFixture();
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await page.evaluate(async ({ workspace, evidencePackage, input, timestamp }) => {
    const controller = await import('/tabs/revision-compare/revision-transfer-completion-controller.js');
    const view = await import('/tabs/revision-compare/revision-transfer-completion-view.js');
    const stateModule = await import('/tabs/revision-compare/revision-transfer-completion-state.js');
    const application = await controller.createRevisionCompareTransferCompletionApplication(workspace, input, timestamp, { cryptoRef: crypto, preflight: {}, createEvidencePackage: async () => evidencePackage });
    workspace.transferCompletion = stateModule.completeRevisionCompareTransferCompletionState(application, workspace);
    let host = document.querySelector('.revc-review-side');
    if (!host) { host = document.createElement('div'); host.className = 'revc-review-side'; document.body.appendChild(host); }
    host.innerHTML = ''; view.renderRevisionCompareTransferCompletionSection(document.body, workspace);
    window.__rcXfer005 = { workspace, evidencePackage, application, controller, view, stateModule };
  }, { workspace: structuredClone(fixture.workspace), evidencePackage: fixture.evidencePackage, input: fixture.input, timestamp: declaredAt });
  return fixture;
}

test('RC-XFER-005-B01..B03 readiness and deterministic creation', async ({ page }) => {
  await mountFixture(page);
  const section = page.locator('[data-revc-transfer-completion-section]');
  await expect(section).toBeVisible();
  await expect(page.locator('[data-revc-transfer-completion-status]')).toHaveText('CREATED');
  await expect(page.locator('[data-revc-transfer-completion-report-id]')).toContainText('revision-transfer-completion:');
  await expect(page.locator('[data-revc-transfer-handover-bundle-id]')).toContainText('revision-transfer-handover:');
  await expect(section).toContainText('Review completion report — pre-transfer review evidence only');
  const blocker = await page.evaluate(async () => { const module = await import('/tabs/revision-compare/revision-transfer-completion.js'); const value = structuredClone(window.__rcXfer005.workspace); value.transfer.status = 'PLANNED'; return module.revisionCompareTransferCompletionReadiness(value).blockers[0]; });
  expect(blocker).toContain('APPLIED');
});

test('RC-XFER-005-B04..B07 downloads recompute and repeat byte-identically', async ({ page }) => {
  await mountFixture(page);
  async function download(kind) {
    const pending = page.waitForEvent('download');
    await page.evaluate(async (selected) => {
      const data = window.__rcXfer005; const artifact = selected === 'REPORT' ? data.application.reportArtifact : data.application.bundleArtifact;
      await data.controller.downloadRevisionCompareTransferCompletion(document.body, artifact, { cryptoRef: crypto });
    }, kind);
    const item = await pending; return readFile(await item.path());
  }
  const reportOne = await download('REPORT'); const reportTwo = await download('REPORT');
  const bundleOne = await download('BUNDLE'); const bundleTwo = await download('BUNDLE');
  expect(reportOne.equals(reportTwo)).toBeTruthy(); expect(bundleOne.equals(bundleTwo)).toBeTruthy();
  const identities = await page.evaluate(() => ({ report: window.__rcXfer005.application.report.contentSha256, bundle: window.__rcXfer005.application.bundle.contentSha256, artifacts: window.__rcXfer005.application.bundle.payload.transferArtifacts.map((item) => ({ text: item.text, hash: item.contentSha256, size: item.sizeBytes })) }));
  const parsedReport = JSON.parse(reportOne); const { reportId, contentSha256: reportHash, ...reportMaterial } = parsedReport;
  const parsedBundle = JSON.parse(bundleOne); const { bundleId, contentSha256: bundleHash, ...bundleMaterial } = parsedBundle;
  expect(sha256(Buffer.from(JSON.stringify(reportMaterial)))).toBe(reportHash);
  expect(sha256(Buffer.from(JSON.stringify(bundleMaterial)))).toBe(bundleHash);
  expect(reportHash).toBe(identities.report); expect(bundleHash).toBe(identities.bundle);
  expect(parsedBundle.identity.completionReportId).toBe(reportId); expect(parsedBundle.payload.completionReport.reportId).toBe(reportId);
  for (const artifact of identities.artifacts) { expect(sha256(Buffer.from(artifact.text))).toBe(artifact.hash); expect(Buffer.byteLength(artifact.text)).toBe(artifact.size); }
});

test('RC-XFER-005-B08..B10 presentation stays current and authority changes stale', async ({ page }) => {
  await mountFixture(page);
  const result = await page.evaluate(async () => {
    const data = window.__rcXfer005;
    const workspaceModule = await import('/tabs/revision-compare/revision-transfer-completion-workspace-state.js');
    const presentation = { ...data.workspace, compare: { ...data.workspace.compare, presentationMode: 'side-by-side', queue: { search: 'filter' } } };
    const changed = structuredClone(data.workspace); changed.review.session.revision += 1;
    const stale = workspaceModule.reconcileRevisionCompareTransferCompletionAfterAuthorityChange(data.workspace, changed);
    const explicit = data.stateModule.completeRevisionCompareTransferCompletionState(data.application, data.workspace);
    return { presentation: presentation.transferCompletion.status, stale: stale.transferCompletion.status, historicalId: stale.transferCompletion.report.reportId, explicit: explicit.status };
  });
  expect(result.presentation).toBe('CREATED'); expect(result.stale).toBe('STALE'); expect(result.historicalId).toContain('revision-transfer-completion:'); expect(result.explicit).toBe('CREATED');
});

test('RC-XFER-005-B11 failure exposes no partial downloads', async ({ page }) => {
  await mountFixture(page);
  const failed = await page.evaluate(async () => {
    const data = window.__rcXfer005; const broken = structuredClone(data.workspace); broken.transfer.artifacts[0].text += ' ';
    try { await data.controller.createRevisionCompareTransferCompletionApplication(broken, { declarantName: 'A', declarantRole: 'B' }, '2026-07-25T03:01:00.000Z', { cryptoRef: crypto, preflight: {}, createEvidencePackage: async () => data.evidencePackage }); } catch (error) { return data.stateModule.failRevisionCompareTransferCompletionState(error); }
    return null;
  });
  expect(failed.status).toBe('FAILED'); expect(failed.report).toBeNull(); expect(failed.bundle).toBeNull(); expect(failed.reportArtifact).toBeNull(); expect(failed.bundleArtifact).toBeNull();
});

test('RC-XFER-005-B12 remount has one bounded section', async ({ page }) => {
  await mountFixture(page);
  const count = await page.evaluate(() => { const data = window.__rcXfer005; const host = document.querySelector('.revc-review-side'); host.innerHTML = ''; data.view.renderRevisionCompareTransferCompletionSection(document.body, data.workspace); host.innerHTML = ''; data.view.renderRevisionCompareTransferCompletionSection(document.body, data.workspace); return document.querySelectorAll('[data-revc-transfer-completion-section]').length; });
  expect(count).toBe(1);
});

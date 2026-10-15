import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { serializeRevisionCompareTransferHandoverBundle } from '../../tabs/revision-compare/revision-transfer-handover.js';
import { REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS } from '../../tabs/revision-compare/revision-transfer-workspace-bindings.js';
import { handoverInspectionFixture } from '../revision-compare-transfer-handover-inspection-fixtures.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const AUTHORITY_KEYS = Object.freeze([
  'session', 'slots', 'proposal', 'basis', 'compare', 'review', 'decision',
  'evidencePackageImport', 'transfer', 'transferCompletion', 'transferArchive', 'signOff', 'trustReceipt',
]);
async function openWorkspace(page) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await page.evaluate(() => {
    window.__rc9Toasts = []; window.rcMountOptions = {
      showToast: (...args) => window.__rc9Toasts.push(args),
    };
  });
  await page.locator('#open').click();
  await expect(page.locator('[data-revc-handover-inspection]')).toHaveCount(1);
}
async function selectBytes(page, bytes, name = 'handover.json', mimeType = 'application/json') {
  await page.locator('[data-revc-handover-file]').setInputFiles({ name, mimeType, buffer: Buffer.from(bytes) });
}
async function downloadedBytes(page, locator) {
  const pending = page.waitForEvent('download'); await locator.click(); const download = await pending;
  return { bytes: await readFile(await download.path()), filename: download.suggestedFilename() };
}
async function clear(page) {
  await page.locator('[data-revc-clear-handover-inspection]').click();
  await expect(page.locator('[data-revc-handover-status]')).toHaveText('IDLE');
}
async function expectSourceFiles(page, matcher) {
  for (const slot of ['baseline', 'candidate']) {
    await expect(page.locator(`[data-revc-file="${slot}"]`))[matcher]();
  }
}
async function authoritySnapshot(page) {
  return page.evaluate((keys) => {
    const state = window.rcHandle.evidence().state;
    return Object.fromEntries(keys.map((key) => [key, state[key] ?? null]));
  }, AUTHORITY_KEYS);
}
async function renderedAuthorityControls(page) {
  return page.evaluate((selectors) => [...document.querySelectorAll(selectors.join(','))].map((control) => ({
    disabled: 'disabled' in control ? control.disabled : null,
    ariaDisabled: control.getAttribute('aria-disabled'), title: control.getAttribute('title'),
  })), REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS);
}
async function exerciseAuthorityGuardMatrix(page) {
  return page.evaluate((selectors) => {
    const inspection = document.querySelector('[data-revc-handover-inspection]');
    let root = document.querySelector('[data-revc-file]');
    while (root?.parentElement && !root.contains(inspection)) root = root.parentElement;
    root = root ?? document.body; window.__rc9GuardEscapes = 0; window.__rc9Toasts.length = 0;
    selectors.forEach((selector) => {
      const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
      if (!attribute) throw new Error(`Unsupported authority selector ${selector}`);
      const control = document.createElement('button'); control.type = 'button'; control.setAttribute(attribute, '');
      control.addEventListener('click', () => { window.__rc9GuardEscapes += 1; });
      control.addEventListener('change', () => { window.__rc9GuardEscapes += 1; });
      root.appendChild(control); control.click();
      control.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); control.remove();
    });
    return {
      escapes: window.__rc9GuardEscapes,
      failures: window.__rc9Toasts.filter((item) => item[1] === 'error').map((item) => item[0]),
    };
  }, REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS);
}

// RC-XFER-009-B01 — verify and inspect an imported transfer handover.
test('RC-XFER-009-B01 canonical File import, isolation, downloads and lifecycle', async ({ page }) => {
  const fixture = await handoverInspectionFixture();
  const text = serializeRevisionCompareTransferHandoverBundle(fixture.bundle); const bytes = Buffer.from(text);
  await openWorkspace(page);
  await expect(page.locator('[data-revc-handover-boundary]')).toHaveText(
    'This view independently verifies and displays an imported Revision Compare transfer handover bundle. It does not reattach the bundle to an editable workspace, authenticate a signer, establish organizational authority, or make the imported transfer current application authority.',
  );
  await selectBytes(page, bytes);
  await expect(page.locator('[data-revc-handover-status]')).toHaveText('VERIFIED');
  const expected = {
    bundle: fixture.bundle.bundleId, package: fixture.bundle.payload.evidencePackage.packageId,
    completion: fixture.bundle.payload.completionReport.reportId,
    plan: fixture.bundle.payload.transferPlan.planId, result: fixture.bundle.payload.transferResult.resultId,
  };
  await expect(page.locator('[data-revc-handover-bundle-id]')).toHaveText(expected.bundle);
  await expect(page.locator('[data-revc-handover-package-id]')).toHaveText(expected.package);
  await expect(page.locator('[data-revc-handover-completion-id]')).toHaveText(expected.completion);
  await expect(page.locator('[data-revc-handover-plan-id]')).toHaveText(expected.plan);
  await expect(page.locator('[data-revc-handover-result-id]')).toHaveText(expected.result);
  await expect(page.locator('[data-revc-handover-trust-boundary]')).toHaveText(
    'This is a self-declared transfer completion record. Declarant identity, organizational authority and cryptographic authenticity are not established.',
  );
  await expect(page.locator('dt', { hasText: 'Self-declared declarant name' })).toBeVisible();
  await expect(page.locator('.revc-handover-artifacts tbody tr')).toHaveCount(4);
  await expect(page.locator('.revc-handover-artifacts tbody')).toContainText('PATCHED_TARGET');
  await expect(page.locator('.revc-handover-artifacts tbody')).toContainText('TRANSFER_AUDIT');
  await expect(page.locator('.revc-handover-artifacts tbody')).toContainText('TRANSFER_PROOF');
  await expect(page.locator('.revc-handover-artifacts tbody')).toContainText('TRANSFER_MANIFEST');

  const handoverOne = await downloadedBytes(page, page.locator('[data-revc-download-imported-handover]'));
  const handoverTwo = await downloadedBytes(page, page.locator('[data-revc-download-imported-handover]'));
  expect(handoverOne.bytes.equals(handoverTwo.bytes)).toBeTruthy(); expect(handoverOne.bytes.equals(bytes)).toBeTruthy();
  for (let index = 0; index < 4; index += 1) {
    const descriptor = fixture.bundle.payload.transferArtifacts[index];
    const download = await downloadedBytes(page, page.locator(`[data-revc-download-imported-transfer-artifact="${index}"]`));
    expect(download.filename).toBe(descriptor.filename); expect(download.bytes.toString()).toBe(descriptor.text);
    expect(sha256(download.bytes)).toBe(descriptor.contentSha256); expect(download.bytes.byteLength).toBe(descriptor.sizeBytes);
  }

  const controls = await renderedAuthorityControls(page); expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    if (control.disabled !== null) expect(control.disabled).toBeTruthy();
    expect(control.ariaDisabled).toBe('true');
    expect(control.title).toBe('Clear the transfer handover inspection before changing Revision Compare authority.');
  }
  const beforeMatrix = await authoritySnapshot(page); const matrix = await exerciseAuthorityGuardMatrix(page);
  expect(matrix.escapes).toBe(0); expect(matrix.failures.length).toBeGreaterThanOrEqual(REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS.length);
  expect(matrix.failures.every((message) => message.includes('Clear the transfer handover inspection'))).toBeTruthy();
  expect(await authoritySnapshot(page)).toEqual(beforeMatrix);

  await expectSourceFiles(page, 'toBeDisabled');
  await expect(page.locator('[data-revc-evidence-package-import]')).toHaveCount(0);
  await page.evaluate(() => {
    const input = document.querySelector('[data-revc-file="baseline"]'); input.disabled = false;
  });
  await page.locator('[data-revc-file="baseline"]').setInputFiles({ name: 'a.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  const blocked = await page.evaluate(() => ({
    baseline: window.rcHandle.evidence().state.slots.baseline.document,
    failures: window.__rc9Toasts.filter((item) => item[1] === 'error').map((item) => item[0]),
  }));
  expect(blocked.baseline).toBeNull(); expect(blocked.failures.at(-1)).toContain('Clear the transfer handover inspection');
  const planButton = page.locator('[data-revc-create-transfer-plan]');
  if (await planButton.count()) {
    await planButton.evaluate((item) => { item.disabled = false; }); await planButton.click();
    expect((await page.evaluate(() => window.rcHandle.evidence().state.transfer.plan))).toBeNull();
  }
  await clear(page); await expectSourceFiles(page, 'toBeEnabled');

  await selectBytes(page, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), bytes]), 'bom.json');
  await expect(page.locator('[data-revc-handover-status]')).toHaveText('FAILED');
  await expect(page.locator('[data-revc-handover-error]')).toContainText('byte-order mark'); await clear(page);
  await selectBytes(page, Buffer.from([0x7B, 0x22, 0x78, 0x22, 0x3A, 0xC3, 0x28, 0x7D]), 'invalid.json');
  await expect(page.locator('[data-revc-handover-status]')).toHaveText('FAILED'); await clear(page);
  await selectBytes(page, Buffer.from(` ${text}`), 'noncanonical.json');
  await expect(page.locator('[data-revc-handover-error]')).toContainText('canonical serialization'); await clear(page);

  await page.evaluate(() => {
    const Native = window.FileReader;
    window.FileReader = class extends Native {
      readAsArrayBuffer(file) { setTimeout(() => super.readAsArrayBuffer(file), file.name.startsWith('A') ? 120 : 10); }
    };
    window.__rc9Toasts.length = 0;
  });
  await selectBytes(page, bytes, 'A.json'); await selectBytes(page, bytes, 'B.json');
  await expect(page.locator('[data-revc-handover-status]')).toHaveText('VERIFIED');
  await page.waitForTimeout(180);
  const race = await page.evaluate(() => ({ state: window.rcHandle.evidence().state.handoverInspection,
    toasts: window.__rc9Toasts }));
  expect(race.state.fileName).toBe('B.json');
  expect(race.toasts.filter((item) => item[1] === 'success')).toHaveLength(1);
  await clear(page);

  await page.evaluate(() => { window.__rc9Toasts.length = 0; });
  await selectBytes(page, bytes, 'A-clear.json');
  await page.locator('[data-revc-clear-handover-inspection]').click(); await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.handoverInspection.status)).toBe('IDLE');
  expect(await page.evaluate(() => window.__rc9Toasts.length)).toBe(0);
  await selectBytes(page, bytes, 'A-destroy.json'); await page.evaluate(() => window.rcClose());
  await page.waitForTimeout(180); expect(await page.evaluate(() => window.__rc9Toasts.length)).toBe(0);
  await page.locator('#open').click(); await expect(page.locator('[data-revc-handover-inspection]')).toHaveCount(1);
  await expect(page.locator('[data-revc-handover-file]')).toHaveCount(1);
});

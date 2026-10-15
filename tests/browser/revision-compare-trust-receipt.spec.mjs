import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { stableStringify } from '../../tabs/revision-compare/revision-contract-utils.js';
import { sha256Text } from '../../tabs/revision-compare/revision-hash.js';
import {
  REVISION_COMPARE_TRUST_ALGORITHM, REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX,
  REVISION_COMPARE_TRUST_RECEIPT_SCHEMA, REVISION_COMPARE_TRUST_STATEMENT,
  revisionCompareSignOffSignatureSubject, revisionCompareTrustReceiptHashMaterial,
  serializeRevisionCompareSignOffSignaturePayload,
} from '../../tabs/revision-compare/revision-trust-receipt.js';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);
async function upload(page, slot, name) {
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer: await readFile(fixture(name)) });
}
async function installHarness(page) {
  await page.evaluate(() => {
    window.rcTrustHarness = { webglCreated: 0, webglDisposed: 0, nowTick: 0 };
    const viewerFactory = async (host, callbacks) => {
      const canvas = document.createElement('canvas'); canvas.dataset.revcTrustWebgl = '1'; host.appendChild(canvas); window.rcTrustHarness.webglCreated += 1;
      let mode = callbacks.initialSnapshot?.mode ?? 'overlay'; let selectedIds = callbacks.initialSnapshot?.selectedIds ?? [];
      const fitCounts = { ...(callbacks.initialSnapshot?.fitCounts ?? { all: 0, selection: 0, noGeometry: 0 }) };
      return {
        reattach(next) { if (canvas.parentElement !== next) next.appendChild(canvas); }, setModels() {}, setStatuses() {}, setVerticalAxis() {},
        setMode(value) { mode = value; }, setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; }, fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() { return { backend: 'WEBGL', mode, selectedIds: [...selectedIds], fitCounts: { ...fitCounts } }; },
        dispose() { canvas.remove(); window.rcTrustHarness.webglDisposed += 1; },
      };
    };
    const now = () => new Date(Date.UTC(2026, 6, 22, 4, 0, window.rcTrustHarness.nowTick++)).toISOString();
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
  await upload(page, 'baseline', 'rc004-rev-a.json'); await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json'); await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}
async function selectRow(page, id) {
  await page.locator(`[data-revc-difference-id="${id}"]`).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.compare.selectedDifferenceId)).toBe(id);
}
async function openLevel(page, level = 2) {
  const details = page.locator(`[data-level="${level}"]`); if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}
async function rowCatalog(page) {
  return page.evaluate(() => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows;
    return { reviewable: rows.filter((row) => row.differenceCategory !== 'UNCHANGED').map((row) => row.differenceId),
      ambiguous: rows.filter((row) => row.matchCertainty === 'AMBIGUOUS').map((row) => row.differenceId), note: rows.find((row) => row.differenceCategory !== 'UNCHANGED')?.differenceId };
  });
}
async function completeAuthorities(page, rows) {
  for (const id of rows.reviewable) { await selectRow(page, id); await openLevel(page); await page.getByRole('button', { name: 'Mark reviewed' }).click(); }
  for (const id of rows.ambiguous) {
    await selectRow(page, id); await page.locator('[data-revc-decision-rationale]').fill(`Resolved ${id}`);
    await page.getByRole('button', { name: 'Confirm no match' }).click();
  }
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.signOff.status)).toBe('READY');
}
async function createSignOff(page, label = 'Create completion declaration', suffix = '') {
  await page.locator('[data-revc-sign-off-name]').fill(`Lakshman${suffix}`); await page.locator('[data-revc-sign-off-role]').fill('Principal reviewer');
  await page.locator('[data-revc-sign-off-organization]').fill('Example Engineering'); await page.locator('[data-revc-sign-off-confirm]').check();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.signOff.status)).toBe('CREATED');
}
const base64Url = (bytes) => Buffer.from(bytes).toString('base64url');
async function receiptFor(report) {
  const keys = await webcrypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey); const subject = revisionCompareSignOffSignatureSubject(report);
  const payload = serializeRevisionCompareSignOffSignaturePayload(subject);
  const signature = await webcrypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keys.privateKey, new TextEncoder().encode(payload));
  const value = {
    schema: REVISION_COMPARE_TRUST_RECEIPT_SCHEMA, receiptId: '', contentSha256: '', subject,
    signerClaim: { displayName: 'External Reviewer', role: 'Verification authority claim', organization: 'Example Engineering', issuer: null, keyId: 'rsa-key-browser-1' },
    signature: { algorithm: REVISION_COMPARE_TRUST_ALGORITHM, publicKeyJwk,
      publicKeySha256: await sha256Text(stableStringify(publicKeyJwk), webcrypto), signedPayloadSha256: await sha256Text(payload, webcrypto),
      signatureBase64Url: base64Url(new Uint8Array(signature)), signedAt: '2026-07-22T04:20:00.000Z' },
    trustBoundary: { identityStatus: 'EXTERNALLY_ASSERTED', trustStatus: 'NOT_ESTABLISHED' },
  };
  await rehash(value); return value;
}
async function rehash(value) {
  value.contentSha256 = await sha256Text(stableStringify(revisionCompareTrustReceiptHashMaterial(value)), webcrypto);
  value.receiptId = `${REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX}${value.contentSha256}`; return value;
}
async function importReceipt(page, name, value) {
  await page.locator('[data-revc-trust-import]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
}
async function expectCurrent(page, receipt) {
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.trustReceipt.status)).toBe('VERIFIED_CURRENT');
  await expect(page.locator('[data-revc-trust-receipt-id]')).toHaveText(receipt.receiptId);
  await expect(page.locator('[data-revc-trust-boundary]')).toHaveText(REVISION_COMPARE_TRUST_STATEMENT);
  await expect(page.locator('[data-revc-trust-relationship]')).toHaveText('CURRENT');
}
async function assertReadOnlyTrustUi(page) {
  const section = page.locator('[data-revc-trust-status]');
  await expect(section.locator('a,button')).toHaveCount(0); await expect(section.locator('input')).toHaveCount(1);
  await expect(section.locator('[data-revc-trust-signer-claim]')).toContainText('External Reviewer');
}

test('RC-TRUST-001-B01 — Verify detached signature for current and historical sign-off reports', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page);
  await expect(page.locator('[data-revc-evidence-package-import]')).toHaveCount(0);
  await expect(page.locator('[data-revc-file]')).toHaveCount(2);
  await compare(page);
  const rows = await rowCatalog(page); await completeAuthorities(page, rows);
  await expect(page.locator('[data-revc-trust-import]')).toBeDisabled(); await createSignOff(page);
  const firstReport = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.signOff.report)); const firstReceipt = await receiptFor(firstReport);
  await importReceipt(page, 'valid-receipt.json', firstReceipt); await expectCurrent(page, firstReceipt); await assertReadOnlyTrustUi(page);

  const tampered = structuredClone(firstReceipt); tampered.subject.sessionId = 'other-session'; await rehash(tampered);
  await importReceipt(page, 'tampered-subject.json', tampered);
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.trustReceipt.status)).toBe('FAILED');
  expect(await page.evaluate(() => window.rcHandle.evidence().state.trustReceipt.receiptId)).toBe(firstReceipt.receiptId);
  const invalid = structuredClone(firstReceipt); const bytes = Buffer.from(invalid.signature.signatureBase64Url, 'base64url'); bytes[0] ^= 1;
  invalid.signature.signatureBase64Url = bytes.toString('base64url'); await rehash(invalid); await importReceipt(page, 'invalid-signature.json', invalid);
  await expect(page.locator('[data-revc-trust-error]')).toContainText('signature is invalid');

  await selectRow(page, rows.note); await openLevel(page); await page.locator('[data-revc-review-note]').fill('Correction after signature verification');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.trustReceipt.status)).toBe('VERIFIED_HISTORICAL');
  await expect(page.locator('[data-revc-trust-relationship]')).toHaveText('HISTORICAL');
  await createSignOff(page, 'Create new completion declaration', ' New');
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.trustReceipt.status)).toBe('IDLE');
  await expect(page.locator('[data-revc-trust-receipt-id]')).toHaveCount(0);

  const secondReport = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.signOff.report)); const secondReceipt = await receiptFor(secondReport);
  await importReceipt(page, 'second-receipt.json', secondReceipt); await expectCurrent(page, secondReceipt);
  const beforePresentation = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.trustReceipt));
  await page.getByRole('button', { name: 'Side-by-side' }).click(); await page.getByRole('button', { name: '3D (WebGL)', exact: true }).click();
  await page.getByRole('button', { name: 'Engineering SVG' }).click();
  expect(await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.trustReceipt))).toEqual(beforePresentation);

  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function delayedTrustText() { if (this.name.startsWith('slow-')) return new Promise((resolve, reject) => setTimeout(() => original.call(this).then(resolve, reject), 350)); return original.call(this); };
  });
  await importReceipt(page, 'slow-old.json', secondReceipt); await importReceipt(page, 'fast-current.json', secondReceipt); await expectCurrent(page, secondReceipt);
  await page.waitForTimeout(450); await expectCurrent(page, secondReceipt);
  expect(await page.evaluate(() => window.rcHandle.evidence().state.trustReceipt.requestGeneration)).toBeGreaterThan(2);

  await closeWorkspace(page);
  await openWorkspace(page);
  await expect(page.locator('[data-revc-trust-status]')).toHaveCount(0);
  await expect(page.locator('[data-revc-evidence-package-import]')).toHaveCount(0);
  await expect(page.locator('[data-revc-file]')).toHaveCount(2);
  await closeWorkspace(page);
  expect(await page.evaluate(() => window.rcTrustHarness.webglDisposed)).toBe(await page.evaluate(() => window.rcTrustHarness.webglCreated));
});

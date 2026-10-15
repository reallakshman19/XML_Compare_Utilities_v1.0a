import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { sha256Text } from '../../tabs/revision-compare/revision-hash.js';

const NOW = '2026-07-24T12:00:00.000Z';
function documentValue(rootKind, donor) {
  const branch = {
    name: '/TRANSFER-100', extension: { retained: true },
    children: [
      { id: 'PIPE-1', type: 'PIPE', description: donor ? 'Donor description' : 'Receiver description', supportType: donor ? 'GUIDE' : 'STOP', parentId: donor ? 'PARENT-A' : 'PARENT-B', material: 'CS', position: [0, 0, 0] },
      { id: 'PIPE-2', type: 'PIPE', description: 'Unselected', material: 'SS', position: [100, 0, 0] },
    ],
  };
  if (rootKind === 'ARRAY') return [branch];
  return { schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT', metadata: { unknown: 'retained' }, branches: [branch] };
}
async function installHarness(page) {
  await page.evaluate(() => {
    window.rcTransferHarness = { created: 0, revoked: 0, nowTick: 0, failDigest: false };
    const nativeDigest = window.crypto.subtle.digest.bind(window.crypto.subtle);
    const cryptoRef = { subtle: { digest: (...args) => window.rcTransferHarness.failDigest ? Promise.reject(new Error('forced digest failure')) : nativeDigest(...args) } };
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { window.rcTransferHarness.created += 1; return create(blob); };
    URL.revokeObjectURL = (url) => { window.rcTransferHarness.revoked += 1; return revoke(url); };
    window.rcMountOptions = { cryptoRef, now: () => new Date(Date.UTC(2026, 6, 24, 12, 0, window.rcTransferHarness.nowTick++)).toISOString() };
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
async function uploadValue(page, slot, value, name) {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
  await expect(page.locator(`[data-slot="${slot}"] strong`)).toContainText('ready');
}
async function compare(page, rootKind = 'ENVELOPE') {
  await uploadValue(page, 'baseline', documentValue(rootKind, true), `rev-a-${rootKind.toLowerCase()}.json`);
  await uploadValue(page, 'candidate', documentValue(rootKind, false), `rev-b-${rootKind.toLowerCase()}.json`);
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('[data-revc-transfer-section]')).toHaveCount(1);
}
async function transferCatalog(page) {
  return page.evaluate(() => {
    const state = window.rcHandle.evidence().state;
    const row = state.compare.audit.differenceRows.find((item) => item.sourceRecordId && item.targetRecordId
      && item.changedProperties.some((property) => property.propertyKey === 'description'));
    const candidate = window.rcHandle.evidence().transfer.candidates.find((item) => item.differenceId === row.differenceId);
    return { differenceId: row.differenceId, sourceId: row.sourceRecordId, targetId: row.targetRecordId,
      descriptionKey: candidate.fields.find((field) => field.propertyKey === 'description')?.fieldKey,
      controlledKey: candidate.fields.find((field) => field.propertyKey === 'supportType')?.fieldKey,
      protectedKey: candidate.fields.find((field) => field.propertyKey === 'parentId')?.fieldKey };
  });
}
async function selectReviewRow(page, differenceId) {
  await page.locator(`[data-revc-difference-id="${differenceId}"]`).click();
  const details = page.locator('[data-level="2"]');
  if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}
async function clickDatasetValue(page, selector, datasetName, value) {
  await page.locator(selector).evaluateAll((nodes, input) => {
    const node = nodes.find((item) => item.dataset[input.datasetName] === input.value);
    if (!node) throw new Error(`Control not found: ${input.value}`); node.click();
  }, { datasetName, value });
}
async function makeSelection(page, catalog = null) {
  catalog ??= await transferCatalog(page); await selectReviewRow(page, catalog.differenceId);
  await expect(page.getByRole('button', { name: 'Mark reviewed' })).toBeEnabled();
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  await clickDatasetValue(page, '[data-revc-transfer-pair]', 'revcTransferPair', catalog.differenceId);
  await clickDatasetValue(page, '[data-revc-transfer-field]', 'revcTransferField', catalog.descriptionKey);
  await expect(page.locator('[data-revc-transfer-selection-count]')).toHaveText('1 / 1');
  return catalog;
}
async function createPlan(page) {
  await page.getByRole('button', { name: 'Create transfer plan' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('PLANNED');
  await expect(page.locator('[data-revc-transfer-plan-id]')).toContainText('revision-transfer-plan:');
  await expect(page.locator('[data-revc-transfer-operation-row]')).toHaveCount(1);
}
async function applyPlan(page) {
  await page.getByRole('button', { name: 'Apply transfer plan' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('APPLIED');
  await expect(page.locator('[data-revc-transfer-result-id]')).toContainText('revision-transfer-result:');
  await expect(page.locator('[data-revc-transfer-verification="READY"]')).toBeVisible();
}
async function download(page, selector) {
  const descriptor = await page.evaluate((requested) => {
    const map = { patched: 0, audit: 1, proof: 2, manifest: 3 };
    return structuredClone(window.rcHandle.evidence().state.transfer.artifacts[map[requested]]);
  }, selector);
  const buttonSelector = { patched: '[data-revc-download-patched-json]', audit: '[data-revc-download-transfer-audit]', proof: '[data-revc-download-transfer-proof]', manifest: '[data-revc-download-transfer-manifest]' }[selector];
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator(buttonSelector).click()]);
  const text = await readFile(await file.path(), 'utf8');
  expect(file.suggestedFilename()).toBe(descriptor.filename); expect(text).toBe(descriptor.text);
  expect(await sha256Text(text, webcrypto)).toBe(descriptor.contentSha256);
  expect(new TextEncoder().encode(text).byteLength).toBe(descriptor.sizeBytes);
  return { text, value: JSON.parse(text), descriptor };
}

test('RC-XFER-003 bare-array intake remains fail-closed without engineering metadata', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page);
  await uploadValue(page, 'baseline', documentValue('ARRAY', true), 'rev-a-array.json');
  await uploadValue(page, 'candidate', documentValue('ARRAY', false), 'rev-b-array.json');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await expect(page.getByText('Unit is UNKNOWN.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run visual comparison' })).toBeDisabled();
});

for (const rootKind of ['ENVELOPE']) {
  test(`RC-XFER-003 direct transfer — ${rootKind}`, async ({ page }) => {
    await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page);
    await test.step(rootKind === 'ARRAY' ? 'RC-XFER-003-B01 direct bare-array load and eligible transfer' : 'RC-XFER-003-B02 hierarchy/envelope load and root preservation', async () => { await compare(page, rootKind); });
    const original = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.slots.candidate.jsonSnapshot.parsedValue));
    const catalog = await transferCatalog(page);
    await test.step('RC-XFER-003-B04 unreviewed, unresolved and protected fields block selection', async () => {
      const pairDisabled = await page.locator('[data-revc-transfer-pair]').evaluateAll((nodes, id) => nodes.find((node) => node.dataset.revcTransferPair === id)?.disabled, catalog.differenceId);
      expect(pairDisabled).toBe(true);
      for (const key of [catalog.controlledKey, catalog.protectedKey].filter(Boolean)) {
        const disabled = await page.locator('[data-revc-transfer-field]').evaluateAll((nodes, fieldKey) => nodes.find((node) => node.dataset.revcTransferField === fieldKey)?.disabled, key);
        expect(disabled).toBe(true);
      }
    });
    await test.step('RC-XFER-003-B03 explicit pair and field selection', async () => makeSelection(page, catalog));
    await test.step('RC-XFER-003-B05 deterministic immutable plan preview', async () => {
      await createPlan(page); const first = await page.locator('[data-revc-transfer-operation-row]').textContent();
      expect(first).toContain('REPLACE_EXISTING_PROPERTY'); expect(first).toContain('/description');
    });
    await test.step('RC-XFER-003-B06 atomic apply and patched target download', async () => {
      await applyPlan(page); const patched = await download(page, 'patched');
      const branch = Array.isArray(patched.value) ? patched.value[0] : patched.value.branches[0];
      expect(branch.children[0].description).toBe('Donor description');
      expect(branch.children[0].supportType).toBe('STOP'); expect(branch.children[1].description).toBe('Unselected');
      expect(branch.children.map((item) => item.id)).toEqual(['PIPE-1', 'PIPE-2']);
      if (!Array.isArray(patched.value)) expect(patched.value.metadata).toEqual({ unknown: 'retained' });
    });
    await test.step('RC-XFER-003-B07 audit, proof and manifest download/hash reconciliation', async () => {
      const audit = await download(page, 'audit'); const proof = await download(page, 'proof'); const manifest = await download(page, 'manifest');
      expect(audit.value.summary.appliedCount).toBe(1); expect(proof.value.invariants.everyMutationCoveredExactlyOnce).toBe(true);
      expect(manifest.value.artifacts.map((item) => item.contentSha256)).toContain(audit.descriptor.contentSha256);
    });
    await test.step('RC-XFER-003-B08 repeated downloads are byte-identical', async () => {
      const first = await download(page, 'patched'); const second = await download(page, 'patched'); expect(second.text).toBe(first.text);
    });
    await test.step('RC-XFER-003-B09 presentation-only changes keep plan/result current', async () => {
      await page.getByRole('button', { name: 'Side-by-side' }).click(); await page.getByRole('button', { name: 'Fit all' }).click();
      await page.locator('[data-revc-review-search]').fill('PIPE-1'); await page.locator('[data-revc-review-search]').fill('');
      expect(await page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('APPLIED');
    });
    await test.step('RC-XFER-003-B11 original Rev B remains unchanged', async () => {
      expect(await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.slots.candidate.jsonSnapshot.parsedValue))).toEqual(original);
    });
    await test.step('RC-XFER-003-B13 close/remount has no duplicate controls, listeners or URLs', async () => {
      expect(await page.evaluate(() => window.rcTransferHarness.revoked)).toBe(await page.evaluate(() => window.rcTransferHarness.created));
      await closeWorkspace(page); await openWorkspace(page); await expect(page.locator('[data-revc-transfer-section]')).toHaveCount(0); await closeWorkspace(page);
    });
  });
}


async function compareRc004(page) {
  for (const [slot, name] of [['baseline', 'rc004-rev-a.json'], ['candidate', 'rc004-rev-b.json']]) {
    const buffer = await readFile(new URL(`../fixtures/revision-compare/${name}`, import.meta.url));
    await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
    await expect(page.locator(`[data-slot="${slot}"] strong`)).toContainText('ready');
  }
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.locator('[data-revc-transfer-section]')).toHaveCount(1, { timeout: 25_000 });
}
async function selectFirstEligibleTransfer(page) {
  const catalog = await page.evaluate(() => {
    const model = window.rcHandle.evidence().transfer;
    const pair = model.candidates.find((candidate) => candidate.fields.some((field) => field.policy.classification === 'ALLOWED'));
    const field = pair?.fields.find((item) => item.policy.classification === 'ALLOWED');
    return { differenceId: pair?.differenceId, fieldKey: field?.fieldKey };
  });
  expect(catalog.differenceId).toBeTruthy(); await selectReviewRow(page, catalog.differenceId);
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  const refreshed = await page.evaluate((differenceId) => {
    const pair = window.rcHandle.evidence().transfer.candidates.find((candidate) => candidate.differenceId === differenceId);
    return pair.fields.find((field) => field.policy.classification === 'ALLOWED').fieldKey;
  }, catalog.differenceId);
  await clickDatasetValue(page, '[data-revc-transfer-pair]', 'revcTransferPair', catalog.differenceId);
  await clickDatasetValue(page, '[data-revc-transfer-field]', 'revcTransferField', refreshed);
  return catalog.differenceId;
}

test('RC-XFER-003-B10 review, decision and source changes stale immediately', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page); await compareRc004(page);
  const unresolvedDisabled = await page.evaluate(() => window.rcHandle.evidence().transfer.candidates.some((candidate) => candidate.decisionState !== 'NOT_REQUIRED' && !candidate.eligible));
  expect(unresolvedDisabled).toBe(true);
  const differenceId = await selectFirstEligibleTransfer(page); await createPlan(page);
  await selectReviewRow(page, differenceId); await page.locator('[data-revc-review-note]').fill('Review authority changed');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('STALE');
  await page.getByRole('button', { name: 'Create transfer plan' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('PLANNED');
  const ambiguous = await page.evaluate(() => window.rcHandle.evidence().state.compare.audit.differenceRows.find((row) => row.matchCertainty === 'AMBIGUOUS')?.differenceId);
  expect(ambiguous).toBeTruthy(); await selectReviewRow(page, ambiguous);
  await page.locator('[data-revc-decision-rationale]').fill('Decision authority changed');
  await page.getByRole('button', { name: 'Confirm no match' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('STALE');
  await page.getByRole('button', { name: 'Create transfer plan' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('PLANNED');
  await page.getByRole('button', { name: 'Change scope' }).click();
  const source = await readFile(new URL('../fixtures/revision-compare/rc004-rev-a.json', import.meta.url));
  await page.locator('[data-revc-file="baseline"]').setInputFiles({ name: 'replacement-a.json', mimeType: 'application/json', buffer: source });
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('STALE');
  await closeWorkspace(page);
});

test('RC-XFER-003 failure, cleanup and removed import acceptance', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await openWorkspace(page); await compare(page); await makeSelection(page); await createPlan(page);
  await test.step('RC-XFER-003-B12 apply failure creates no downloadable partial artifact', async () => {
    await page.evaluate(() => { window.rcTransferHarness.failDigest = true; });
    await page.getByRole('button', { name: 'Apply transfer plan' }).click();
    await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('FAILED');
    const transfer = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.transfer));
    expect(transfer.result).toBeNull(); expect(transfer.audit).toBeNull(); expect(transfer.proof).toBeNull(); expect(transfer.manifest).toBeNull(); expect(transfer.artifacts).toEqual([]); expect(transfer.patchedSnapshot).toBeNull();
    await expect(page.locator('[data-revc-download-patched-json]')).toHaveCount(0);
  });
  await closeWorkspace(page);
  await test.step('RC-XFER-003-B14 Evidence Package import labels, panel and input remain absent', async () => {
    await expect(page.locator('[data-revc-evidence-package-import],[data-revc-imported-evidence-package]')).toHaveCount(0);
    await expect(page.getByText('Import evidence package', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Resume archived review evidence', { exact: true })).toHaveCount(0);
  });
});

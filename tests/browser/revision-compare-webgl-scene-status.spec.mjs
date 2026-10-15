import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function uploadValue(page, slot, name, value) {
  const buffer = Buffer.from(JSON.stringify(value));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({
    name,
    mimeType: 'application/json',
    buffer,
  });
}

function pipe(name, start, end, attributes = {}) {
  return {
    name,
    type: 'PIPE',
    attributes: {
      APOS: { x: start[0], y: start[1], z: start[2] },
      LPOS: { x: end[0], y: end[1], z: end[2] },
      ROUTE_TIER: 'BUILD_QUEUE_CONTINUITY',
      AUTO_GENERATED_PIPE: 'true',
      ...attributes,
    },
  };
}

function branch(name, start, end, children) {
  return {
    name,
    type: 'BRANCH',
    attributes: {
      NAME: name,
      HPOS: { x: start[0], y: start[1], z: start[2] },
      TPOS: { x: end[0], y: end[1], z: end[2] },
      HREF: `${name}/HEAD`,
      TREF: `${name}/TAIL`,
    },
    children,
  };
}

function representativeSequential(candidate = false) {
  return [
    branch('/PLANT/AREA-01/B1', [0, 0, 0], [2200, 0, 0], [
      pipe('PIPE AUTO CONTINUITY B1-01', [0, 0, 0], candidate ? [1150, 120, 0] : [1100, 0, 0], { LBORE: 250 }),
      ...(candidate ? [] : [pipe('PIPE AUTO CONTINUITY B1-02', [1100, 0, 0], [2200, 0, 0], { LBORE: 250 })]),
      ...(candidate ? [pipe('PIPE AUTO CONTINUITY B1-03', [1150, 120, 0], [2200, 200, 0], { LBORE: 250 })] : []),
    ]),
    branch('/PLANT/AREA-01/B2', [0, 1200, 0], [1800, 1200, 500], [
      pipe('PIPE AUTO CONTINUITY B2-01', [0, 1200, 0], [900, 1200, 250], { LBORE: 150 }),
      pipe('PIPE AUTO CONTINUITY B2-02', [900, 1200, 250], candidate ? [1900, 1300, 650] : [1800, 1200, 500], { LBORE: 150 }),
    ]),
    branch('/PLANT/AREA-02/B3', [0, -900, 300], [1600, -900, 300], [
      pipe('PIPE AUTO CONTINUITY B3-01', [0, -900, 300], [800, -900, 300], { LBORE: 100 }),
      pipe('PIPE AUTO CONTINUITY B3-02', [800, -900, 300], [1600, -900, 300], { LBORE: 100 }),
    ]),
  ];
}

function largeSequential(candidate = false) {
  return Array.from({ length: 120 }, (_, branchIndex) => {
    const y = branchIndex * 800;
    const z = (branchIndex % 5) * 75;
    const name = `/PLANT/LARGE/B${String(branchIndex + 1).padStart(3, '0')}`;
    const children = Array.from({ length: 13 }, (_, segmentIndex) => {
      const start = [segmentIndex * 250, y, z];
      const end = [(segmentIndex + 1) * 250, y, z];
      const changed = candidate && branchIndex % 20 === 0 && segmentIndex === 6;
      return pipe(
        `PIPE AUTO CONTINUITY B${String(branchIndex + 1).padStart(3, '0')}-${String(segmentIndex + 1).padStart(2, '0')}`,
        start,
        end,
        { LBORE: changed ? 175 : 150 },
      );
    });
    return branch(name, [0, y, z], [13 * 250, y, z], children);
  });
}

async function numericText(locator) {
  return Number((await locator.textContent())?.trim());
}

async function installResponsivenessPolicy(page) {
  await page.evaluate(() => {
    const MIB = 1024 * 1024;
    window.rcMountOptions = {
      sceneMonitorOptions: {
        responsivenessPolicy: {
          policyId: 'browser-large-model-policy',
          samplingResolutionMs: 250,
          bands: [
            { bandId: 'FINE', maximumDrawablesExclusive: 3000, sceneObservedMaxMs: 60_000, firstReadyMaxMs: 60_000, fitSelectedMaxMs: 2000, heapGrowthMaxBytes: 2048 * MIB },
            { bandId: 'BALANCED', maximumDrawablesExclusive: 12000, sceneObservedMaxMs: 60_000, firstReadyMaxMs: 60_000, fitSelectedMaxMs: 2000, heapGrowthMaxBytes: 2048 * MIB },
            { bandId: 'COARSE', maximumDrawablesExclusive: null, sceneObservedMaxMs: 60_000, firstReadyMaxMs: 60_000, fitSelectedMaxMs: 2000, heapGrowthMaxBytes: 2048 * MIB },
          ],
        },
      },
    };
  });
}

test('representative Sequential source exposes real Workbench scene, fit and pick evidence', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await uploadValue(page, 'baseline', 'sequential-multibranch-a.json', representativeSequential(false));
  await uploadValue(page, 'candidate', 'sequential-multibranch-b.json', representativeSequential(true));

  const preflight = page.locator('.revc-preflight').filter({ hasText: 'COMPATIBILITY PREFLIGHT' });
  await expect(preflight).toContainText('MM ↔ MM');
  await expect(preflight).toContainText('PLANT ↔ PLANT');
  await expect(preflight).toContainText('Z ↔ Z');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: '3D (WebGL)' }).click();
  const canvas = page.locator('.revc-viewer-host canvas');
  await expect(canvas).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('[data-revc-scene-state]')).toHaveText('READY', { timeout: 45_000 });

  expect(await numericText(page.locator('[data-revc-scene-source]'))).toBeGreaterThanOrEqual(5);
  expect(await numericText(page.locator('[data-revc-scene-target]'))).toBeGreaterThanOrEqual(5);
  expect(await numericText(page.locator('[data-revc-scene-instances]'))).toBeGreaterThan(0);
  expect(await numericText(page.locator('[data-revc-scene-batches]'))).toBeGreaterThan(0);
  await expect(page.locator('[data-revc-scene-runtime]')).not.toHaveText('—');

  const runtime = await page.evaluate(() => structuredClone(window.rcHandle.evidence().viewer.viewer));
  expect(runtime.runtimePending).toBe(false);
  expect(runtime.runtimeRevision).not.toBeNull();
  expect(runtime.instanceCount).toBeGreaterThan(0);
  expect(runtime.drawBatchCount).toBeGreaterThan(0);

  const row = page.locator('[data-revc-difference-id]').first();
  await row.click();
  await expect(page.locator('[data-revc-scene-selection]')).not.toHaveText('None');
  const historyBefore = await page.evaluate(() => window.rcHandle.evidence().viewer.viewer.navigationHistoryCount);
  await page.getByRole('button', { name: 'Fit selected' }).click();
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().viewer.viewer.navigationHistoryCount))
    .toBeGreaterThan(historyBefore);

  const picksBefore = await numericText(page.locator('[data-revc-scene-picks]'));
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
  await expect.poll(() => numericText(page.locator('[data-revc-scene-picks]'))).toBeGreaterThan(picksBefore);
  await expect(page.locator('[data-revc-scene-last-pick]')).not.toHaveText('None');

  const finalEvidence = await page.evaluate(() => structuredClone(window.rcHandle.evidence()));
  expect(finalEvidence.viewer.activeBackend).toBe('WEBGL');
  expect(finalEvidence.viewer.lastPickedObjectId).toBeTruthy();
  expect(finalEvidence.scene.active).toBe(true);
  expect(finalEvidence.scene.status).toBe('READY');
});

test('large Sequential comparison can download and verify consecutive Workbench responsiveness runs', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await installResponsivenessPolicy(page);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await uploadValue(page, 'baseline', 'sequential-large-a.json', largeSequential(false));
  await uploadValue(page, 'candidate', 'sequential-large-b.json', largeSequential(true));

  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 75_000 });
  await page.getByRole('button', { name: '3D (WebGL)' }).click();

  await expect(page.locator('[data-revc-scene-state]')).toHaveText('READY', { timeout: 60_000 });
  const performance = page.locator('[data-revc-performance-status]');
  const receiptButton = performance.getByRole('button', { name: 'Download receipt' });
  await expect(performance).toBeVisible();
  await expect(performance.locator('[data-revc-performance-run]')).toHaveText('Run 1');
  await expect(performance.locator('[data-revc-performance-band]')).toHaveText('BALANCED');
  expect(await numericText(performance.locator('[data-revc-performance-drawables]'))).toBeGreaterThanOrEqual(3000);
  await expect(performance.locator('[data-revc-performance-scene]')).not.toContainText('Pending');
  await expect(performance.locator('[data-revc-performance-ready]')).not.toContainText('Pending');
  await expect(performance.locator('[data-revc-performance-disposition]')).toHaveText('PENDING');
  await expect(receiptButton).toBeDisabled();

  await page.locator('[data-revc-difference-id]').first().click();
  await page.getByRole('button', { name: 'Fit selected' }).click();
  await expect.poll(() => numericText(performance.locator('[data-revc-performance-fit-count]'))).toBeGreaterThan(0);
  await expect(performance.locator('[data-revc-performance-disposition]')).toHaveText('QUALIFIED');
  await expect(receiptButton).toBeEnabled();
  const skippedBefore = await page.evaluate(() => window.rcHandle.evidence().viewer.viewer.skippedRebuildCount);
  const pickCountBefore = await page.evaluate(() => window.rcHandle.evidence().viewer.pickCount);

  await performance.getByRole('button', { name: 'Rerun measurement' }).click();
  await expect(performance.locator('[data-revc-performance-run]')).toHaveText('Run 2');
  await expect(performance.locator('[data-revc-performance-fit-count]')).toHaveText('0');
  await expect(performance.locator('[data-revc-performance-disposition]')).toHaveText('PENDING');
  await expect(receiptButton).toBeDisabled();
  const comparison = performance.locator('[data-revc-run-comparison]');
  await expect(comparison).toBeVisible();
  await expect(comparison).toHaveAttribute('data-state', 'available');
  await expect(comparison).toContainText('Run 1 → Run 2');
  await expect(comparison.locator('[data-revc-run-delta-fit]')).toHaveText('Pending');
  await expect(page.locator('[data-revc-scene-selection]')).not.toHaveText('None');
  await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().viewer.viewer.skippedRebuildCount), { timeout: 60_000 })
    .toBeGreaterThan(skippedBefore);
  expect(await page.evaluate(() => window.rcHandle.evidence().viewer.pickCount)).toBe(pickCountBefore);

  await page.getByRole('button', { name: 'Fit selected' }).click();
  await expect.poll(() => numericText(performance.locator('[data-revc-performance-fit-count]'))).toBeGreaterThan(0);
  await expect(performance.locator('[data-revc-performance-disposition]')).toHaveText('QUALIFIED');
  await expect(receiptButton).toBeEnabled();
  await expect(comparison.locator('[data-revc-run-delta-scene]')).not.toHaveText('Pending');
  await expect(comparison.locator('[data-revc-run-delta-ready]')).not.toHaveText('Pending');
  await expect(comparison.locator('[data-revc-run-delta-fit]')).not.toHaveText('Pending');
  await expect(comparison.locator('[data-revc-run-delta-memory]')).toHaveText(/Pending|MiB/);
  await expect(performance.locator('[data-revc-performance-heap]')).toHaveText(/Unavailable|MiB/);
  await expect(performance.locator('.revc-info-icon')).toHaveAttribute('title', /not engineering acceptance, design validation, or certification/i);

  const evidence = await page.evaluate(() => structuredClone(window.rcHandle.evidence()));
  expect(evidence.scene.runSequence).toBe(2);
  expect(evidence.scene.runId).toMatch(/run:2$/);
  expect(evidence.scene.previousRun.runSequence).toBe(1);
  expect(evidence.scene.responsiveness.bandId).toBe('BALANCED');
  expect(evidence.scene.responsiveness.disposition).toBe('QUALIFIED');
  expect(evidence.scene.responsiveness.comparison.available).toBe(true);
  expect(evidence.scene.responsiveness.comparison.previous.runSequence).toBe(1);
  expect(evidence.scene.responsiveness.comparison.current.runSequence).toBe(2);
  expect(evidence.viewer.fitSelectedCount).toBeGreaterThan(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    receiptButton.click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(download.suggestedFilename()).toMatch(/^revision-responsiveness-.*-run-2\.json$/);
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  expect(receipt.schema).toBe('RevisionResponsivenessObservationReceipt.v2');
  expect(receipt.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(receipt.receiptId).toBe(`responsiveness-observation:${receipt.contentSha256.slice(0, 24)}`);
  expect(receipt.authority.classification).toBe('PRODUCT_RUNTIME_OBSERVATION_ONLY');
  expect(receipt.authority.engineeringCertification).toBe('NONE');
  expect(receipt.authority.statement).toMatch(/not engineering acceptance/i);
  expect(receipt.audit.auditId).toBe(evidence.state.compare.audit.auditId);
  expect(receipt.audit.basisId).toBe(evidence.state.compare.audit.basisId);
  expect(receipt.revisions.revA.sourceHash).toBe(evidence.state.slots.baseline.document.sourceHash);
  expect(receipt.revisions.revB.scopedHash).toBe(evidence.state.slots.candidate.document.scopedHash);
  expect(receipt.observation.runId).toBe(evidence.scene.runId);
  expect(receipt.observation.runSequence).toBe(2);
  expect(receipt.observation.policyId).toBe('browser-large-model-policy');
  expect(receipt.observation.bandId).toBe('BALANCED');
  expect(receipt.observation.disposition).toBe('QUALIFIED');
  expect(receipt.observation.comparison.available).toBe(true);
  expect(receipt.observation.comparison.previous.runSequence).toBe(1);
  expect(receipt.observation.comparison.current.runSequence).toBe(2);
  expect(receipt.observation.metrics.memory.value === null || Number.isFinite(receipt.observation.metrics.memory.value)).toBe(true);

  await page.locator('[data-revc-responsiveness-receipt-import]').setInputFiles({
    name: 'responsiveness-run-2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(receipt)),
  });
  const verification = page.locator('[data-revc-responsiveness-receipt-verification]');
  await expect(verification).toHaveAttribute('data-revc-responsiveness-receipt-verification', 'verified_current');
  await expect(verification).toContainText('VERIFIED_CURRENT');
  await expect(verification).toContainText('Schema structure');
  await expect(verification).toContainText('Content SHA-256');
  await expect(verification).toContainText('Receipt ID');
  await expect(verification).toContainText('VERIFIED');
  await expect(verification).toContainText(receipt.contentSha256);
  await expect(verification).toContainText('Current audit');
  await expect(verification).toContainText('MATCH');
  await expect(verification).toContainText('Active run');
  await expect(verification).toContainText('Authenticity');
  await expect(verification).toContainText('NOT_ESTABLISHED');
  const verifiedEvidence = await page.evaluate(() => structuredClone(window.rcHandle.evidence().responsivenessReceiptVerification));
  expect(verifiedEvidence.status).toBe('VERIFIED_CURRENT');
  expect(verifiedEvidence.contentSha256Status).toBe('VERIFIED');
  expect(verifiedEvidence.contentSha256).toBe(receipt.contentSha256);
  expect(verifiedEvidence.receiptId).toBe(receipt.receiptId);
  expect(verifiedEvidence.authenticityStatus).toBe('NOT_ESTABLISHED');
});

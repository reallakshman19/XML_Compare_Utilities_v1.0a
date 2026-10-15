import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateKnownPositiveNodeNames } from '../cii-workspace-multisource-partial-texpected-oracle.js';
import {
  compareOutsideWriter2NodeNameAuthority,
  deriveExpectedNodeNameDelta,
  parseIndependentNodeNameState,
} from '../cii-workspace-multisource-texpected-oracle.js';

const S1 = fileURLToPath(new URL('../../Benchmark/S1.CII', import.meta.url));
const S2 = fileURLToPath(new URL('../../Benchmark/S2.CII', import.meta.url));
const S3 = fileURLToPath(new URL('../../Benchmark/S3.CII', import.meta.url));
const TARGET = fileURLToPath(new URL('../../Benchmark/T.CII', import.meta.url));
const PARTIAL_EXPECTED = fileURLToPath(new URL('../../Benchmark/TEXPECTED-PARTIALLLYDONE.CII', import.meta.url));

function uiSelectedNodeNameOperations(scopeText, sourceTextsById, targetText) {
  const text = String(scopeText || '').replace(/^Scope ID:\s*/, '');
  const match = text.match(/^transfer-scope:SOURCE_SET:[^:]+:ORIGINAL_TARGET:[^:]+:(.*)$/);
  if (!match) throw new Error('F4V_TILE_SCOPE_ID_PARSE_FAILED');
  const target = parseIndependentNodeNameState(targetText);
  const sources = Object.fromEntries(Object.entries(sourceTextsById)
    .map(([sourceId, sourceText]) => [sourceId, parseIndependentNodeNameState(sourceText)]));
  return match[1].split('|').filter((entry) => entry.endsWith('=APPLY')).map((entry) => {
    const operationId = entry.slice(0, -'=APPLY'.length);
    const op = operationId.match(/^ms-op:(S[123]):op:NODE_NAME:Node name \/ to-name:multi-base-node:([^:]+):([^:]+)$/);
    if (!op) throw new Error(`F4V_TILE_NON_NODENAME_APPLY:${operationId}`);
    const [, sourceId, sourceNodeId, targetNodeId] = op;
    const sourceValue = String(sources[sourceId]?.names?.get(sourceNodeId) || '').trim();
    if (!sourceValue) throw new Error(`F4V_TILE_SOURCE_NAME_MISSING:${sourceId}:${sourceNodeId}`);
    const before = String(target.names.get(targetNodeId) || '').trim();
    return {
      operationId,
      sourceId,
      action: before ? 'COPY' : 'CREATE',
      proposed: sourceValue,
      before,
      sourceEvidence: { value: sourceValue },
      targetEvidence: { identity: targetNodeId, nodeId: targetNodeId, value: before },
    };
  });
}

test('Utilities Writer2 tile walks retained S1/S2/S3 through explicit review, lower-bound scope and validated TARGET export', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  await page.evaluate(async () => {
    const { installCiiWorkspaceTile } = await import('/tabs/cii-workspace/cii-workspace-tab.js');
    const host = document.createElement('section');
    host.setAttribute('data-ciiw-retained-tile-host', '1');
    document.body.appendChild(host);
    installCiiWorkspaceTile(host);
  });

  await expect(page.locator('[data-ciiw-open-writer2]')).toHaveCount(1);
  await page.locator('[data-ciiw-open-writer2]').click();

  const sourceInput = page.locator('[data-ciiw-source]');
  const targetInput = page.locator('[data-ciiw-target]');
  await expect(sourceInput).toHaveCount(1);
  await expect(targetInput).toHaveCount(1);
  await expect(sourceInput).toHaveAttribute('multiple', '');

  await sourceInput.setInputFiles([S1, S2, S3]);
  await targetInput.setInputFiles(TARGET);

  await expect(page.locator('[data-ciiw-status]')).toContainText('Inspect exact retained S1/S2/S3 custody');
  await page.locator('[data-ciiw-inspect]').click();

  const ledger = page.locator('[data-ciiw-ms-anchor-ledger="1"]');
  await expect(ledger).toBeVisible({ timeout: 120_000 });
  await expect(ledger).toContainText('3 / 3 SOURCE members covered');
  await expect(ledger).toContainText('Anchor authority READY');

  for (const sourceId of ['S1', 'S2', 'S3']) {
    const member = page.locator(`[data-ciiw-ms-member="${sourceId}"]`);
    await expect(member).toBeVisible();
    await expect(member.locator('[data-ciiw-evidence-card][data-selected="true"]')).toHaveCount(1);
  }

  await expect(page.locator('[data-ciiw-analyze]')).toBeEnabled();
  await expect(page.locator('[data-ciiw-ms-transfer-waiting="1"]')).toContainText('READY FOR COMPARE');
  await expect(page.locator('[data-ciiw-status]')).toContainText('Auto Anchor seeded deterministic qualified bases for all sources');

  await expect(page.locator('[data-ciiw-ms-review-table="1"]')).toHaveCount(0);
  await expect(page.locator('[data-ciiw-ms-transfer="1"]')).toHaveCount(0);

  await page.locator('[data-ciiw-ms-compare-now]').click();

  const reviewTable = page.locator('[data-ciiw-ms-review-table="1"]');
  await expect(reviewTable).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('[data-ciiw-status]')).toContainText('Multi-source correspondence READY');

  const decisionControls = page.locator('[data-ciiw-ms-decision]');
  expect(await decisionControls.count()).toBeGreaterThan(0);
  const decisionValues = await decisionControls.evaluateAll((nodes) => nodes.map((node) => node.value));
  expect(decisionValues.every((value) => value === '')).toBe(true);

  const applyReview = page.locator('[data-ciiw-refresh-review]');
  const acceptHigh = page.locator('[data-ciiw-accept-high]');
  const acceptMedium = page.locator('[data-ciiw-accept-medium]');
  await expect(applyReview).toBeDisabled();
  await expect(applyReview).toHaveText('Review synchronized with Transfer Preview');
  await expect(page.locator('[data-ciiw-ms-review-state="SYNCHRONIZED"]')).toBeVisible();

  const compareTab = page.locator('[data-ciiw-tab="compare"]');
  const transferTab = page.locator('[data-ciiw-tab="transfer"]');
  const transferScope = page.locator('[data-ciiw-ms-transfer="1"]');
  await expect(compareTab).toHaveAttribute('aria-current', 'page');
  await expect(transferScope).toHaveCount(1);
  await expect(transferScope).toBeHidden();

  await transferTab.click();
  await expect(transferTab).toHaveAttribute('aria-current', 'page');
  await expect(transferScope).toBeVisible();
  await expect(page.locator('[data-ciiw-ms-apply]')).toBeDisabled();

  await compareTab.click();
  await expect(compareTab).toHaveAttribute('aria-current', 'page');
  await expect(reviewTable).toBeVisible();

  const highEligible = Number(await acceptHigh.getAttribute('data-ciiw-eligible-count'));
  const mediumEligible = Number(await acceptMedium.getAttribute('data-ciiw-eligible-count'));
  expect(highEligible + mediumEligible).toBeGreaterThan(0);
  await expect(acceptHigh).toHaveText(`Accept eligible HIGH (${highEligible})`);
  await expect(acceptMedium).toHaveText(`Accept eligible MEDIUM (${mediumEligible})`);
  if (highEligible === 0) await expect(acceptHigh).toBeDisabled(); else await expect(acceptHigh).toBeEnabled();
  if (mediumEligible === 0) await expect(acceptMedium).toBeDisabled(); else await expect(acceptMedium).toBeEnabled();

  if (highEligible > 0) {
    await acceptHigh.click();
    await expect(acceptHigh).toBeDisabled();
    await expect(acceptHigh).toHaveText('Accept eligible HIGH (0)');
  }
  if (mediumEligible > 0) {
    await acceptMedium.click();
    await expect(acceptMedium).toBeDisabled();
    await expect(acceptMedium).toHaveText('Accept eligible MEDIUM (0)');
  }
  await expect(page.locator('[data-ciiw-status]')).toContainText('Apply approvals to Transfer Preview');
  await expect(page.locator('[data-ciiw-ms-review-state="PENDING"]')).toBeVisible();
  await expect(applyReview).toBeEnabled();
  await expect(applyReview).toContainText('pending decision');
  expect(Number(await applyReview.getAttribute('data-ciiw-pending-decision-count'))).toBe(highEligible + mediumEligible);

  await applyReview.click();
  await expect(page.locator('[data-ciiw-status]')).toContainText('Multi-source review bound', { timeout: 120_000 });
  await expect(applyReview).toBeDisabled();
  await expect(applyReview).toHaveText('Review synchronized with Transfer Preview');
  await expect(page.locator('[data-ciiw-ms-review-state="SYNCHRONIZED"]')).toBeVisible();
  await expect(compareTab).toHaveAttribute('aria-current', 'page');
  await expect(transferScope).toBeHidden();

  await transferTab.click();
  await expect(transferTab).toHaveAttribute('aria-current', 'page');
  await expect(transferScope).toBeVisible();

  const bindScope = page.locator('[data-ciiw-ms-bind-expected]');
  await expect(bindScope).toBeEnabled();
  await bindScope.click();

  const status = page.locator('[data-ciiw-status]');
  await expect(status).toContainText('BM-correspondence-qualified scope bound:');
  const statusText = await status.textContent();
  const applyMatch = String(statusText || '').match(/scope bound:\s*(\d+) physical APPLY/i);
  expect(applyMatch).not.toBeNull();
  const applyCount = Number(applyMatch[1]);
  expect(applyCount).toBeGreaterThanOrEqual(36);

  const applyWriter2 = page.locator('[data-ciiw-ms-apply]');
  await expect(applyWriter2).toBeEnabled();
  await expect(transferScope).toContainText(`APPLY: ${applyCount}`);
  const scopeIdText = await transferScope.locator('small').textContent();
  expect(scopeIdText).toContain('Scope ID: transfer-scope:');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    applyWriter2.click(),
  ]);
  await expect(status).toContainText('Modified TARGET exported', { timeout: 120_000 });
  await expect(status).toContainText('version bridge PASS');
  expect(download.suggestedFilename().toUpperCase()).toContain('.CII');

  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const [actualBytes, beforeText, partialExpectedText, s1Text, s2Text, s3Text] = await Promise.all([
    readFile(downloadedPath),
    readFile(TARGET, 'latin1'),
    readFile(PARTIAL_EXPECTED, 'latin1'),
    readFile(S1, 'latin1'),
    readFile(S2, 'latin1'),
    readFile(S3, 'latin1'),
  ]);
  const actualText = actualBytes.toString('latin1');
  const expectedDelta = deriveExpectedNodeNameDelta(beforeText, partialExpectedText);
  expect(expectedDelta.rows).toHaveLength(36);
  const selectedOperations = uiSelectedNodeNameOperations(scopeIdText, {
    S1: s1Text,
    S2: s2Text,
    S3: s3Text,
  }, beforeText);
  expect(selectedOperations).toHaveLength(applyCount);
  const knownPositive = validateKnownPositiveNodeNames(actualText, expectedDelta.rows, selectedOperations);
  const transferText = await transferScope.textContent();
  const finalStatusText = await status.textContent();
  console.log('F4V_TILE_DIAGNOSTIC=' + JSON.stringify({
    applyCount,
    transferText,
    finalStatusText,
    knownPositiveStatus: knownPositive.status,
    knownPositiveDifferences: knownPositive.differences,
    knownPositiveExplanations: knownPositive.explanations,
    selectedOperationCount: selectedOperations.length,
    expectedRows: expectedDelta.rows.length,
  }));
  expect(knownPositive.status).toBe('READY');
  expect(knownPositive.differences).toHaveLength(0);

  const preservation = compareOutsideWriter2NodeNameAuthority(beforeText, actualText);
  expect(preservation.status).toBe('READY');
  expect(preservation.differences).toHaveLength(0);

  const actualNodeNames = parseIndependentNodeNameState(actualText);
  expect(actualNodeNames.names.get('10330')).toBe('SL-115A.4');
});

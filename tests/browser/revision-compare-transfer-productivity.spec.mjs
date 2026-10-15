import { expect, test } from '@playwright/test';

function staged(count, donor) {
  return {
    schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT',
    branches: [{ name: '/PRODUCTIVITY', children: Array.from({ length: count }, (_, index) => ({
      id: `PIPE-${String(index).padStart(4, '0')}`, type: 'PIPE', position: [index * 10, 0, 0],
      description: donor ? `Donor ${index}` : `Receiver ${index}`, material: 'CS',
    })) }],
  };
}
async function installHarness(page) {
  await page.evaluate(() => {
    const host = document.querySelector('#host');
    window.rcProductivityHarness = { inputAdds: 0, inputRemoves: 0, tick: 0 };
    const add = host.addEventListener.bind(host); const remove = host.removeEventListener.bind(host);
    host.addEventListener = (type, listener, options) => {
      if (type === 'input') window.rcProductivityHarness.inputAdds += 1;
      return add(type, listener, options);
    };
    host.removeEventListener = (type, listener, options) => {
      if (type === 'input') window.rcProductivityHarness.inputRemoves += 1;
      return remove(type, listener, options);
    };
    window.rcMountOptions = { now: () => new Date(Date.UTC(2026, 6, 24, 18, 0, window.rcProductivityHarness.tick++)).toISOString() };
  });
}
async function open(page) {
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1);
}
async function close(page) {
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('.revc-dialog')).toHaveCount(0);
}
async function load(page, count) {
  for (const [slot, donor] of [['baseline', true], ['candidate', false]]) {
    const buffer = Buffer.from(`${JSON.stringify(staged(count, donor), null, 2)}\n`);
    await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name: `${slot}.json`, mimeType: 'application/json', buffer });
    await expect(page.locator(`[data-slot="${slot}"] strong`)).toContainText('ready');
  }
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.locator('[data-revc-transfer-section]')).toHaveCount(1, { timeout: 35_000 });
}
async function transferableIds(page, limit) {
  return page.evaluate((count) => window.rcHandle.evidence().transfer.candidates
    .filter((candidate) => candidate.fields.some((field) => field.propertyKey === 'description'))
    .slice(0, count).map((candidate) => candidate.differenceId), limit);
}
async function reviewRows(page, ids) {
  for (const id of ids) {
    await page.locator(`[data-revc-difference-id="${id}"]`).click();
    const level = page.locator('[data-level="2"]');
    if (!(await level.evaluate((node) => node.open))) await level.locator('summary').click();
    await page.getByRole('button', { name: 'Mark reviewed' }).click();
  }
}
async function resetQuery(page) {
  await page.locator('[data-revc-transfer-search]').fill('');
  await page.locator('[data-revc-transfer-eligibility-filter]').selectOption('ALL');
  await page.locator('[data-revc-transfer-policy-filter]').selectOption('ALL');
  await page.locator('[data-revc-transfer-property-group-filter]').selectOption('ALL');
  await page.locator('[data-revc-transfer-match-filter]').selectOption('ALL');
  await page.locator('[data-revc-transfer-sort]').selectOption('DIFFERENCE_ID:ASC');
  await page.locator('[data-revc-transfer-page-size]').selectOption('25');
}
async function selectOne(page, offset = 0) {
  const item = await page.evaluate((index) => {
    const model = window.rcHandle.evidence().transfer;
    const candidate = model.query.entries.map((entry) => entry.candidate)
      .filter((entry) => entry.fields.some((field) => field.eligible))[index];
    const field = candidate?.fields.find((entry) => entry.eligible && entry.policy.classification === 'ALLOWED');
    return { differenceId: candidate?.differenceId, fieldKey: field?.fieldKey };
  }, offset);
  expect(item.differenceId).toBeTruthy();
  await page.locator(`[data-revc-transfer-pair="${item.differenceId}"]`).check();
  await page.locator(`[data-revc-transfer-field="${item.fieldKey}"][data-revc-transfer-difference-id="${item.differenceId}"]`).check();
  return item;
}

test('RC-XFER-004 productivity toolbar, scoped draft and preserved application evidence', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); await open(page); await load(page, 60);
  const ids = await transferableIds(page, 26); await reviewRows(page, ids);
  await test.step('RC-XFER-004-B01 search and combined filters', async () => {
    const source = await page.evaluate(() => window.rcHandle.evidence().transfer.candidates[0].sourceRecordId);
    await page.locator('[data-revc-transfer-search]').fill(source);
    await page.locator('[data-revc-transfer-eligibility-filter]').selectOption('ELIGIBLE');
    await page.locator('[data-revc-transfer-policy-filter]').selectOption('ALLOWED');
    await page.locator('[data-revc-transfer-property-group-filter]').selectOption('DESCRIPTION');
    await page.locator('[data-revc-transfer-match-filter]').selectOption('EXACT');
    await expect(page.locator('[data-revc-transfer-visible-count]')).toHaveText('1');
  });
  await test.step('RC-XFER-004-B02 deterministic sorting and paging', async () => {
    await resetQuery(page); await page.locator('[data-revc-transfer-sort]').selectOption('SOURCE_ENTITY_ID:DESC');
    const first = await page.locator('[data-revc-transfer-pair-row]').evaluateAll((nodes) => nodes.map((node) => node.dataset.revcTransferPairRow));
    expect(first).toHaveLength(25); await page.getByRole('button', { name: 'Next page' }).click();
    const second = await page.locator('[data-revc-transfer-pair-row]').evaluateAll((nodes) => nodes.map((node) => node.dataset.revcTransferPairRow));
    expect(second).toHaveLength(25); expect(second.some((id) => first.includes(id))).toBe(false);
    await page.getByRole('button', { name: 'Previous page' }).click();
    expect(await page.locator('[data-revc-transfer-pair-row]').evaluateAll((nodes) => nodes.map((node) => node.dataset.revcTransferPairRow))).toEqual(first);
  });
  await test.step('RC-XFER-004-B03 visible-page scoped selection; RC-XFER-004-B04 off-page selection persistence', async () => {
    await page.locator('[data-revc-transfer-eligibility-filter]').selectOption('ELIGIBLE');
    await expect(page.locator('[data-revc-transfer-select-visible]')).toHaveText('Select 25 eligible visible fields');
    await page.locator('[data-revc-transfer-select-visible]').click();
    await expect(page.locator('[data-revc-transfer-selected-field-count]')).toHaveText('25');
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('[data-revc-transfer-select-visible]')).toHaveText('Select 1 eligible visible fields');
    await page.locator('[data-revc-transfer-select-visible]').click();
    await expect(page.locator('[data-revc-transfer-selected-field-count]')).toHaveText('26');
  });
  await test.step('RC-XFER-004-B05 clear visible versus clear all', async () => {
    await page.locator('[data-revc-transfer-clear-visible]').click();
    await expect(page.locator('[data-revc-transfer-selected-field-count]')).toHaveText('25');
    await page.locator('[data-revc-transfer-clear-all]').click();
    await expect(page.locator('[data-revc-transfer-selected-field-count]')).toHaveText('0');
  });
  await test.step('RC-XFER-004-B09 selected fields create and apply one current plan', async () => {
    await resetQuery(page); await page.locator('[data-revc-transfer-eligibility-filter]').selectOption('ELIGIBLE');
    await selectOne(page); await page.getByRole('button', { name: 'Create transfer plan' }).click();
    await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('PLANNED');
  });
  await test.step('RC-XFER-004-B06 presentation changes preserve READY/APPLIED evidence', async () => {
    await page.locator('[data-revc-transfer-search]').fill('PIPE');
    await page.locator('[data-revc-transfer-sort]').selectOption('ELIGIBILITY:DESC');
    expect(await page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('PLANNED');
    await page.getByRole('button', { name: 'Apply transfer plan' }).click();
    await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('APPLIED');
    await page.locator('[data-revc-transfer-page-size]').selectOption('100');
    expect(await page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('APPLIED');
  });
  await test.step('RC-XFER-004-B07 selection changes stale plan/result', async () => {
    await resetQuery(page); await page.locator('[data-revc-transfer-eligibility-filter]').selectOption('ELIGIBLE');
    await selectOne(page, 1); await expect.poll(() => page.evaluate(() => window.rcHandle.evidence().state.transfer.status)).toBe('STALE');
    const evidence = await page.evaluate(() => structuredClone(window.rcHandle.evidence().state.transfer));
    expect(evidence.result).toBeTruthy(); expect(evidence.plan).toBeTruthy();
  });
  await test.step('RC-XFER-004-B10 close/remount produces no duplicate controls or listeners', async () => {
    await close(page);
    expect(await page.evaluate(() => window.rcProductivityHarness.inputAdds - window.rcProductivityHarness.inputRemoves)).toBe(0);
    await open(page); await load(page, 2); await expect(page.locator('[data-revc-transfer-section]')).toHaveCount(1);
    await close(page); expect(await page.evaluate(() => window.rcProductivityHarness.inputAdds - window.rcProductivityHarness.inputRemoves)).toBe(0);
  });
});

test('RC-XFER-004-B08 1,000-row corpus renders no more than page size', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  const result = await page.evaluate(async () => {
    const { productivityState } = await import('/tests/revision-compare-transfer-productivity-fixtures.mjs');
    const { deriveRevisionCompareTransferCandidates } = await import('/tabs/revision-compare/revision-transfer-candidates.js');
    const { queryRevisionCompareTransferCandidates } = await import('/tabs/revision-compare/revision-transfer-query.js');
    const { revisionCompareTransferMarkup } = await import('/tabs/revision-compare/revision-transfer-view.js');
    const state = productivityState(1000); const candidates = deriveRevisionCompareTransferCandidates(state);
    const review = state.transferReview; const query = queryRevisionCompareTransferCandidates(candidates, review.draft, review.presentation);
    const host = document.createElement('div'); host.innerHTML = revisionCompareTransferMarkup(state, { candidates, draft: review.draft, review, query });
    return { total: candidates.length, visible: host.querySelectorAll('[data-revc-transfer-pair-row]').length, pageSize: query.presentation.pageSize };
  });
  expect(result.total).toBe(1000); expect(result.visible).toBeLessThanOrEqual(result.pageSize); expect(result.visible).toBe(50);
});

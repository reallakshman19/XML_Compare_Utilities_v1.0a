import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const primaryXml = readFileSync('benchmarks/11168.xml', 'utf8');
const referenceXml = readFileSync('benchmarks/14168.xml', 'utf8');

function relationshipObject(path, item) {
  return `<clashobject><pathlink>${path.map((node) => `<node>${node}</node>`).join('')}</pathlink><smarttag><name>Item Name</name><value>${item}</value></smarttag></clashobject>`;
}

function relationshipClash(name, area, zone, leftMember, rightMember) {
  const root = `/ASIM-${area}-CU-PI`;
  const left = relationshipObject([root, zone, leftMember], leftMember);
  const right = relationshipObject([root, zone, rightMember], rightMember);
  return `<clashresult name="${name}" distance="0.001"><pos3f x="1" y="2" z="3"/>${left}${right}</clashresult>`;
}

function relationshipXml(clashes) {
  return `<exchange><clashtests>${clashes.join('')}</clashtests></exchange>`;
}

async function openSupportReport(page) {
  await page.goto('/index.html');
  await expect(page.getByRole('navigation', { name: 'Application tabs' })).toBeVisible();

  await page.evaluate(async () => {
    await import(new URL('/tabs/support-steel-relationship-builder/support-report-addon.js?browser=typicality-qualification-1', location.href).href);
    const moduleUrl = new URL('/tabs/support-steel-relationship-builder/support-steel-relationship-tab.js?browser=typicality-qualification-1', location.href).href;
    const module = await import(moduleUrl);
    module.openSupportSteelRelationshipBuilder({ showToast() {} });
  });

  const modal = page.locator('[data-ssrb-popup="1"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-ssrb-tab="support-report"]')).toBeVisible();
  await modal.locator('[data-ssrb-tab="support-report"]').click();
  return modal;
}

test('Support Report preserves legacy mode and enables audited typicality with second XML', async ({ page }) => {
  const modal = await openSupportReport(page);

  const primary = modal.locator('[data-ssr-xml]');
  const reference = modal.locator('[data-ssr-typical-xml]');
  const build = modal.locator('[data-ssr-build]');
  const runState = modal.locator('[data-ssr-run-state]');
  const xlsx = modal.locator('[data-ssr-download-xlsx]');
  const csv = modal.locator('[data-ssr-download]');
  const trace = modal.locator('[data-ssr-download-trace]');
  const debug = modal.locator('[data-ssr-download-debug]');

  await primary.fill(primaryXml);
  await build.click();

  await expect(runState).toContainText('Support Report ready');
  await expect(runState).toContainText('legacy 21-column mode');
  await expect(runState).toContainText('POS clusters');
  await expect(runState).toContainText('unresolved member matches');
  await expect(modal.locator('.ssrb-report-table thead th')).toHaveCount(21);
  await expect(modal.locator('.ssrb-report-table tbody tr')).toHaveCount(6);
  await expect(modal.locator('[data-ssr-typicality-summary="1"]')).toHaveCount(0);
  await expect(xlsx).toBeEnabled();
  await expect(csv).toBeEnabled();
  await expect(trace).toBeEnabled();
  await expect(debug).toBeEnabled();

  const [traceDownload] = await Promise.all([page.waitForEvent('download'), trace.click()]);
  expect(traceDownload.suggestedFilename()).toBe('support-report-trace-partial.csv');
  const [debugDownload] = await Promise.all([page.waitForEvent('download'), debug.click()]);
  expect(debugDownload.suggestedFilename()).toBe('support-report-debug-partial.json');

  await reference.fill(referenceXml);
  await expect(xlsx).toBeDisabled();
  await expect(csv).toBeDisabled();
  await expect(trace).toBeDisabled();
  await expect(debug).toBeDisabled();
  await build.click();

  await expect(runState).toContainText('comparison columns 22–24 enabled');
  await expect(runState).toContainText('0 typical');
  await expect(runState).toContainText('1 review');
  await expect(runState).toContainText('Column 22: 0 published / 6 withheld');
  await expect(modal.locator('.ssrb-report-table thead th')).toHaveCount(24);
  await expect(modal.locator('.ssrb-report-table tbody tr')).toHaveCount(6);
  await expect(modal.locator('.ssrb-report-table thead th').nth(21)).toHaveText('TYPICAL STRUCTURE (PS NO.)');
  await expect(modal.locator('.ssrb-report-table thead th').nth(22)).toHaveText('PIPING SUPPORT ARRANGEMENT MATCH');
  await expect(modal.locator('.ssrb-report-table thead th').nth(23)).toHaveText('TYPICALITY AUDIT ID');
  await expect(modal.locator('[data-ssr-typicality-summary="1"]')).toContainText('0 typical');
  await expect(modal.locator('[data-ssr-typicality-summary="1"]')).toContainText('1 review');

  const typicalCells = modal.locator('.ssrb-report-table tbody tr td:nth-child(22)');
  await expect(typicalCells).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await expect(typicalCells.nth(index)).toHaveText('');

  await expect(xlsx).toBeEnabled();
  await expect(csv).toBeEnabled();
  await expect(trace).toBeEnabled();
  await expect(debug).toBeEnabled();
});

test('Primary Support relationship inputs honor current zone selection and derive reference scope independently', async ({ page }) => {
  const modal = await openSupportReport(page);
  const currentPrimaryZone = '/ASIM-1835-CU-PI-P';
  const currentSecondaryZone = '/ASIM-1835-CU-SU';
  const referencePrimaryZone = '/ASIM-1836-CU-PI-P';

  await modal.locator('[data-ssr-xml]').fill(primaryXml);
  await modal.locator('[data-ssr-zone-discover]').click();

  const primaryZoneSelect = modal.locator('[data-ssr-zone-select="primary"]');
  const secondaryZoneSelect = modal.locator('[data-ssr-zone-select="secondary"]');
  await expect(primaryZoneSelect.locator(`option[value="${currentPrimaryZone}"]`)).toHaveCount(1);
  await expect(secondaryZoneSelect.locator(`option[value="${currentSecondaryZone}"]`)).toHaveCount(1);
  await primaryZoneSelect.selectOption([currentPrimaryZone]);
  await secondaryZoneSelect.selectOption([currentSecondaryZone]);

  await modal.locator('[data-ssr-relationship-xml]').fill(relationshipXml([
    relationshipClash('CurrentKeep', '1835', currentPrimaryZone, '/PS-11168.1', '/PS-11168.2'),
    relationshipClash('CurrentReject', '1835', '/ASIM-1835-CU-PI-W', '/PS-11168.15', '/PS-11168.16'),
  ]));
  await modal.locator('[data-ssr-typical-xml]').fill(referenceXml);
  await modal.locator('[data-ssr-reference-relationship-xml]').fill(relationshipXml([
    relationshipClash('ReferenceKeep', '1836', referencePrimaryZone, '/PS-14168.1', '/PS-14168.2'),
    relationshipClash('ReferenceReject', '1836', '/ASIM-1836-CU-PI-D', '/PS-14168.15', '/PS-14168.16'),
  ]));

  const build = modal.locator('[data-ssr-build]');
  const runState = modal.locator('[data-ssr-run-state]');
  const debug = modal.locator('[data-ssr-download-debug]');
  await build.click();
  await expect(runState).toContainText('Support Report ready');
  await expect(debug).toBeEnabled();

  const [debugDownload] = await Promise.all([page.waitForEvent('download'), debug.click()]);
  const debugPath = await debugDownload.path();
  expect(debugPath).not.toBeNull();
  const payload = JSON.parse(readFileSync(debugPath, 'utf8'));
  const report = payload.reportBundle;

  expect(report.zoneScope.active).toBe(true);
  expect(report.zoneScope.primaryZoneIds).toEqual([currentPrimaryZone]);
  expect(report.zoneScope.secondaryZoneIds).toEqual([currentSecondaryZone]);
  expect(report.primaryRelationshipInput.side).toBe('CURRENT');
  expect(report.primaryRelationshipInput.parsedRowCount).toBe(2);
  expect(report.primaryRelationshipInput.scopedRowCount).toBe(1);
  expect(report.primaryRelationshipInput.excludedByZoneCount).toBe(1);
  expect(report.referenceRelationshipInput.side).toBe('REFERENCE');
  expect(report.referenceRelationshipInput.scopeBasis).toBe('REFERENCE_SUPPORT_REPORT_EXACT_ANCESTRY');
  expect(report.referenceRelationshipInput.parsedRowCount).toBe(2);
  expect(report.referenceRelationshipInput.scopedRowCount).toBe(1);
  expect(report.referenceRelationshipInput.excludedByZoneCount).toBe(1);
  expect(report.referenceRelationshipInput.zoneScope.primaryZoneIds).toContain(referencePrimaryZone);
  expect(report.referenceRelationshipInput.zoneScope.primaryZoneIds).not.toContain(currentPrimaryZone);
});

test('large Support Report XML import stays blob-backed and builds in the worker', async ({ page }) => {
  const modal = await openSupportReport(page);
  const largeXml = `${primaryXml}\n<!--${'x'.repeat(1100000)}-->`;
  const fileInput = modal.locator('[data-ssr-file]');
  const textarea = modal.locator('[data-ssr-xml]');
  const status = modal.locator('[data-ssr-file-status]');
  const build = modal.locator('[data-ssr-build]');
  const runState = modal.locator('[data-ssr-run-state]');

  await fileInput.setInputFiles({
    name: 'large-support-report.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from(largeXml),
  });

  await expect(status).toContainText('staged for background parsing (text preview omitted)');
  await expect(textarea).toHaveValue('');
  await build.click();
  await expect(runState).toContainText('Support Report ready');
  await expect(modal.locator('.ssrb-report-table tbody tr')).toHaveCount(6);
});

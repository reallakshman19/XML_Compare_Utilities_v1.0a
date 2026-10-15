import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);

async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}

async function installHarness(page) {
  await page.evaluate(async () => {
    const evidenceModule = await import('/tabs/revision-compare/revision-compare-property-evidence.js');
    window.rcPropertyHarness = { failNext: false, delays: {} };
    const evidenceFactory = (audit) => {
      const base = evidenceModule.createRevisionComparePropertyEvidence(audit);
      return {
        ...base,
        provider: {
          ...base.provider,
          async getPropertySets(ids, revision) {
            const delay = window.rcPropertyHarness.delays[ids[0]] || 0;
            if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
            if (window.rcPropertyHarness.failNext) {
              window.rcPropertyHarness.failNext = false;
              throw new Error('forced property provider failure');
            }
            return base.provider.getPropertySets(ids, revision);
          },
        },
      };
    };
    const viewerFactory = async (host) => {
      const canvas = document.createElement('canvas');
      canvas.dataset.revcPropertyCertificationWebgl = '1';
      host.appendChild(canvas);
      let mode = 'overlay';
      let selectedIds = [];
      const fitCounts = { all: 0, selection: 0 };
      return {
        reattach(nextHost) { if (canvas.parentElement !== nextHost) nextHost.appendChild(canvas); },
        setModels() {}, setStatuses() {}, setVerticalAxis() {},
        setMode(value) { mode = value; },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; },
        fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() {
          return { backend: 'WEBGL', mode, selectedIds: [...selectedIds], fitCounts: { ...fitCounts } };
        },
        dispose() { canvas.remove(); },
      };
    };
    window.rcMountOptions = {
      viewerAdapterOptions: { viewerFactory },
      propertyInspectorOptions: { evidenceFactory },
    };
  });
}

async function openAndCompare(page) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await installHarness(page);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc004-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}

function expectedText(value, type) {
  if (value == null || value === '') return '—';
  if (type === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

async function rowCatalog(page) {
  return page.evaluate(() => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows;
    const propertyRows = rows.filter((row) => row.changedProperties.length > 0 && row.matchCertainty !== 'AMBIGUOUS');
    return {
      property: propertyRows[0]?.differenceId,
      secondProperty: propertyRows[1]?.differenceId ?? propertyRows[0]?.differenceId,
      geometry: rows.find((row) => row.differenceCategory === 'CHANGED' && row.changedProperties.length === 0)?.differenceId,
      added: rows.find((row) => row.differenceCategory === 'ADDED')?.differenceId,
      removed: rows.find((row) => row.differenceCategory === 'REMOVED')?.differenceId,
      ambiguous: rows.find((row) => row.matchCertainty === 'AMBIGUOUS')?.differenceId,
    };
  });
}

async function selectRow(page, differenceId) {
  expect(differenceId).toBeTruthy();
  await page.locator(`[data-revc-difference-id="${differenceId}"]`).click();
  await expect(page.locator(`[data-revc-property-inspector-host="${differenceId}"]`)).toHaveCount(1);
}

async function ensureLevel(page, level) {
  const details = page.locator(`[data-level="${level}"]`);
  if (!(await details.evaluate((node) => node.open))) await details.locator('summary').click();
}

async function propertyAuditRow(page, differenceId) {
  return page.evaluate((id) => structuredClone(window.rcHandle.evidence().state.compare.audit.differenceRows
    .find((row) => row.differenceId === id)), differenceId);
}

async function authoritativeEvidence(page) {
  return page.evaluate(() => {
    const evidence = window.rcHandle.evidence();
    return structuredClone({
      audit: evidence.state.compare.audit,
      review: evidence.state.review.session,
      decision: evidence.state.decision.ledger,
    });
  });
}

async function viewerEvidence(page) {
  return page.evaluate(() => structuredClone(window.rcHandle.evidence().viewer.viewer));
}

async function panAndZoom(page, locator) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  await locator.dispatchEvent('pointerdown', { pointerId: 11, button: 0, clientX: x, clientY: y });
  await locator.dispatchEvent('pointermove', { pointerId: 11, button: 0, clientX: x + 45, clientY: y + 18 });
  await locator.dispatchEvent('pointerup', { pointerId: 11, button: 0, clientX: x + 45, clientY: y + 18 });
  await locator.dispatchEvent('wheel', { deltaY: -320, clientX: x, clientY: y });
}

async function proveNoFabrication(page, differenceId) {
  await selectRow(page, differenceId);
  await ensureLevel(page, 2);
  await expect(page.locator('[data-engineering-svg-property-key]')).toHaveCount(0);
  await expect(page.locator('[data-revc-property-empty]')).toContainText('No supported scalar property changes.');
}

test('RC-SVG-002-B01 — authoritative shared property evidence', async ({ page }) => {
  await openAndCompare(page);
  const rows = await rowCatalog(page);
  expect(rows.property).toBeTruthy();
  expect(rows.added).toBeTruthy();
  expect(rows.removed).toBeTruthy();
  expect(rows.ambiguous).toBeTruthy();
  await page.evaluate((id) => { window.rcPropertyHarness.delays[id] = 250; }, rows.property);
  const immutableBefore = await authoritativeEvidence(page);
  await selectRow(page, rows.property);
  await ensureLevel(page, 2);
  await expect.poll(() => viewerEvidence(page).then((value) => value.selectedIds.length)).toBeGreaterThan(0);
  const viewerBeforeProperty = await viewerEvidence(page);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  const auditRow = await propertyAuditRow(page, rows.property);
  const immutableAfter = await authoritativeEvidence(page);
  const viewerAfterProperty = await viewerEvidence(page);
  expect(immutableAfter).toEqual(immutableBefore);
  expect(viewerAfterProperty).toEqual(viewerBeforeProperty);
  await expect(page.locator('.revc-inspector')).toHaveCount(1);
  await expect(page.getByText('Previous = Rev A · Current = Rev B')).toBeVisible();

  for (const changed of auditRow.changedProperties) {
    const row = page.locator(`[data-engineering-svg-property-key="${changed.propertyKey}"]`);
    const comparison = Object.is(changed.revAValue, changed.revBValue) ? 'unchanged' : 'changed';
    await expect(row).toHaveAttribute('data-engineering-svg-property-comparison', comparison);
    const previous = row.locator(`[data-engineering-svg-property-previous="${changed.propertyKey}"]`).locator(':scope > output:first-of-type');
    const current = row.locator(`[data-engineering-svg-property-current="${changed.propertyKey}"]`).locator(':scope > output:first-of-type');
    const type = typeof (changed.revAValue ?? changed.revBValue);
    await expect(previous).toHaveText(expectedText(changed.revAValue, type));
    await expect(current).toHaveText(expectedText(changed.revBValue, type));
  }
  await expect(page.locator('[data-engineering-svg-inspector-heading]')).toBeHidden();
  await expect(page.locator('[data-engineering-svg-inspector-summary]')).toBeHidden();
  await expect(page.locator('[data-engineering-svg-inspector-actions]')).toBeHidden();
  await expect(page.locator('[data-engineering-svg-apply]:visible')).toHaveCount(0);
  await expect(page.locator('[data-engineering-svg-cancel]:visible')).toHaveCount(0);
  await ensureLevel(page, 3);
  const pathText = await page.locator('[data-level="3"] code').allTextContents();
  for (const changed of auditRow.changedProperties) {
    if (changed.revAEvidencePath) expect(pathText).toContain(changed.revAEvidencePath);
    if (changed.revBEvidencePath) expect(pathText).toContain(changed.revBEvidencePath);
  }

  if (rows.geometry) await proveNoFabrication(page, rows.geometry);
  await proveNoFabrication(page, rows.added);
  await proveNoFabrication(page, rows.removed);
  await selectRow(page, rows.ambiguous);
  await ensureLevel(page, 2);
  const fitsBeforeCandidate = (await viewerEvidence(page)).fitCounts;
  await page.getByRole('button', { name: 'Next candidate' }).click();
  await page.getByRole('button', { name: 'Previous candidate' }).click();
  await expect(page.locator('[data-engineering-svg-property-key]')).toHaveCount(0);
  expect((await viewerEvidence(page)).fitCounts).toEqual(fitsBeforeCandidate);

  await page.evaluate((id) => { window.rcPropertyHarness.delays[id] = 0; }, rows.property);
  await selectRow(page, rows.property);
  await ensureLevel(page, 2);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  const propertyTextBeforeViewer = await page.locator('[data-revc-property-inspector-host]').innerText();
  await page.getByRole('button', { name: 'Engineering SVG' }).click();
  const overlay = page.locator('[data-revc-svg-overlay-root="1"]');
  await expect(overlay).toHaveCount(1);
  await panAndZoom(page, overlay);
  await page.getByRole('button', { name: 'Side-by-side' }).click();
  const panes = page.locator('[data-revc-svg-pane-root="1"]');
  await expect(panes).toHaveCount(2);
  await panAndZoom(page, panes.first());
  await ensureLevel(page, 2);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  expect(await page.locator('[data-revc-property-inspector-host]').innerText()).toBe(propertyTextBeforeViewer);
  await page.getByRole('button', { name: 'Fit selected' }).click();

  const auditBeforeActions = JSON.stringify((await authoritativeEvidence(page)).audit);
  await ensureLevel(page, 2);
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  expect(JSON.stringify((await authoritativeEvidence(page)).audit)).toBe(auditBeforeActions);
  await selectRow(page, rows.ambiguous);
  const candidate = page.locator('[data-revc-preview-candidate-index="0"]');
  await candidate.click();
  await page.locator('[data-revc-decision-rationale]').fill('Accept persisted candidate for property evidence certification');
  await page.getByRole('button', { name: 'Accept candidate' }).click();
  await page.locator('[data-revc-decision-rationale]').fill('Revoke persisted candidate for property evidence certification');
  await page.getByRole('button', { name: 'Revoke decision' }).click();
  expect(JSON.stringify((await authoritativeEvidence(page)).audit)).toBe(auditBeforeActions);

  await page.evaluate(() => { window.rcPropertyHarness.failNext = true; });
  await selectRow(page, rows.property);
  await ensureLevel(page, 2);
  await expect(page.locator('[data-revc-property-status="failed"]')).toContainText('forced property provider failure');
  await expect(page.locator('[data-revc-property-fallback="failure"]')).toBeVisible();
  await selectRow(page, rows.secondProperty);
  await ensureLevel(page, 2);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();

  await page.evaluate((id) => { window.rcPropertyHarness.delays[id] = 300; }, rows.property);
  await selectRow(page, rows.property);
  await selectRow(page, rows.added);
  await page.waitForTimeout(350);
  await expect(page.locator(`[data-revc-property-inspector-host="${rows.added}"]`)).toHaveCount(1);
  await expect(page.locator('[data-engineering-svg-property-key]')).toHaveCount(0);
  expect(await page.evaluate(() => window.rcHandle.evidence().property.staleResultsIgnored)).toBeGreaterThan(0);

  const handleBeforeClose = await page.evaluate(() => window.rcHandle.evidence().property);
  expect(handleBeforeClose.mountedViews).toBe(0);
  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  const disposed = await page.evaluate(() => window.rcHandle.evidence().property);
  expect(disposed.disposed).toBe(true);
  expect(disposed.mountedViews).toBe(0);
  await expect(page.locator('[data-revc-shared-property-view]')).toHaveCount(0);
  for (let index = 0; index < 2; index += 1) {
    await page.getByRole('button', { name: 'Open Revision Compare' }).click();
    await expect(page.locator('.revc-dialog')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
    await expect(page.locator('[data-revc-shared-property-view]')).toHaveCount(0);
  }
});

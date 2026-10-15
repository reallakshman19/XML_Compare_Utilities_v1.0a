import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);

function audit(basisId, currentValue) {
  return {
    schema: 'RevisionCompareAudit.v1', auditId: 'audit-shared-id', basisId,
    revADocumentId: `rev-a-${basisId}`, revBDocumentId: `rev-b-${basisId}`,
    engineVersion: 'revision-compare-v1', differenceRows: [{
      differenceId: 'difference-probe', changedProperties: [{
        propertyKey: 'pressure', revAValue: 1, revBValue: currentValue,
        revAEvidencePath: `/rev-a/${basisId}/pressure`, revBEvidencePath: `/rev-b/${basisId}/pressure`,
        normalizationRule: 'EXACT',
      }],
    }],
  };
}

test('RC-SVG-002-B01 audit identity cache and construction-failure fallback', async ({ page }) => {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  const result = await page.evaluate(async (audits) => {
    const inspectorModule = await import('/tabs/revision-compare/revision-compare-property-inspector.js');
    const evidenceModule = await import('/tabs/revision-compare/revision-compare-property-evidence.js');
    const host = document.createElement('div'); document.body.appendChild(host); const calls = [];
    const controller = inspectorModule.createRevisionComparePropertyInspector({
      evidenceFactory(currentAudit) {
        calls.push(currentAudit.basisId);
        if (currentAudit.basisId === 'basis-fail') throw new Error('forced adapter construction failure');
        return evidenceModule.createRevisionComparePropertyEvidence(currentAudit);
      },
    });
    await controller.render(host, audits.first, 'difference-probe');
    const firstCurrent = host.querySelector('[data-engineering-svg-property-current="pressure"] output')?.textContent;
    await controller.render(host, audits.second, 'difference-probe');
    const secondCurrent = host.querySelector('[data-engineering-svg-property-current="pressure"] output')?.textContent;
    await controller.render(host, audits.failure, 'difference-probe');
    const value = {
      calls, firstCurrent, secondCurrent,
      failureText: host.querySelector('[data-revc-property-status="failed"]')?.textContent,
      fallbackRows: host.querySelectorAll('[data-revc-property-fallback="failure"] tbody tr').length,
      fallbackText: host.querySelector('[data-revc-property-fallback="failure"]')?.textContent,
      beforeDispose: controller.evidence(),
    };
    controller.dispose(); value.afterDispose = controller.evidence(); value.remainingChildren = host.childElementCount;
    host.remove(); return value;
  }, { first: audit('basis-1', 2), second: audit('basis-2', 3), failure: audit('basis-fail', 4) });
  expect(result.calls).toEqual(['basis-1', 'basis-2', 'basis-fail']);
  expect(result.firstCurrent).toBe('2'); expect(result.secondCurrent).toBe('3');
  expect(result.failureText).toContain('forced adapter construction failure');
  expect(result.fallbackRows).toBe(1); expect(result.fallbackText).toContain('pressure');
  expect(result.fallbackText).toContain('4'); expect(result.beforeDispose.mountedViews).toBe(0);
  expect(result.afterDispose.disposed).toBe(true); expect(result.afterDispose.mountedViews).toBe(0);
  expect(result.remainingChildren).toBe(0);
});

async function upload(page, slot, name) {
  const buffer = await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer });
}

async function installHarness(page) {
  await page.evaluate(async () => {
    const module = await import('/tabs/revision-compare/revision-compare-property-evidence.js');
    window.rcPropertyHarness = { failNext: false, delays: {} };
    const evidenceFactory = (auditValue) => {
      const base = module.createRevisionComparePropertyEvidence(auditValue);
      return { ...base, provider: { ...base.provider, async getPropertySets(ids, revision) {
        const delay = window.rcPropertyHarness.delays[ids[0]] || 0;
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (window.rcPropertyHarness.failNext) {
          window.rcPropertyHarness.failNext = false; throw new Error('forced property provider failure');
        }
        return base.provider.getPropertySets(ids, revision);
      } } };
    };
    const viewerFactory = async (host) => {
      const canvas = document.createElement('canvas'); canvas.dataset.revcPropertyCertificationWebgl = '1';
      host.appendChild(canvas); let mode = 'overlay'; let selectedIds = []; const fitCounts = { all: 0, selection: 0 };
      return {
        reattach(next) { if (canvas.parentElement !== next) next.appendChild(canvas); },
        setModels() {}, setStatuses() {}, setVerticalAxis() {}, setMode(value) { mode = value; },
        setSelection(primary, related = []) { selectedIds = [primary, ...related].filter(Boolean); },
        fitAll() { fitCounts.all += 1; }, fitSelection() { fitCounts.selection += 1; },
        getStateSnapshot() { return { backend: 'WEBGL', mode, selectedIds: [...selectedIds], fitCounts: { ...fitCounts } }; },
        dispose() { canvas.remove(); },
      };
    };
    window.rcMountOptions = { viewerAdapterOptions: { viewerFactory }, propertyInspectorOptions: { evidenceFactory } };
  });
}

async function compare(page, first = false) {
  if (first) { await page.goto('/tests/browser/revision-compare-rc001.html'); await installHarness(page); }
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await upload(page, 'baseline', 'rc004-rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rc004-rev-b.json');
  await expect(page.locator('[data-slot="candidate"] strong')).toContainText('ready');
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await page.getByRole('button', { name: 'Run visual comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Guided visual revision review' })).toBeVisible({ timeout: 25_000 });
}

async function catalog(page) {
  return page.evaluate(() => {
    const rows = window.rcHandle.evidence().state.compare.audit.differenceRows;
    const changed = rows.filter((row) => row.changedProperties.length && row.matchCertainty !== 'AMBIGUOUS');
    return {
      property: changed[0]?.differenceId, second: changed[1]?.differenceId ?? changed[0]?.differenceId,
      added: rows.find((row) => row.differenceCategory === 'ADDED')?.differenceId,
      ambiguous: rows.find((row) => row.matchCertainty === 'AMBIGUOUS')?.differenceId,
    };
  });
}

async function select(page, id) {
  await page.locator(`[data-revc-difference-id="${id}"]`).click();
  await expect(page.locator(`[data-revc-property-inspector-host="${id}"]`)).toHaveCount(1);
  const level = page.locator('[data-level="2"]');
  if (!(await level.evaluate((node) => node.open))) await level.locator('summary').click();
}

async function ensureLevel(page, levelNumber) {
  const level = page.locator(`[data-level="${levelNumber}"]`);
  if (!(await level.evaluate((node) => node.open))) await level.locator('summary').click();
}

const authority = (page) => page.evaluate(() => {
  const value = window.rcHandle.evidence();
  return structuredClone({ audit: value.state.compare.audit, review: value.state.review.session,
    decision: value.state.decision.ledger, viewer: value.viewer.viewer });
});

async function bounded(page) {
  return page.evaluate(async () => {
    const { createRevisionComparePropertyInspector } = await import('/tabs/revision-compare/revision-compare-property-inspector.js');
    const host = document.createElement('div'); document.body.appendChild(host);
    const auditValue = { schema: 'RevisionCompareAudit.v1', auditId: 'bounded', basisId: 'bounded-basis',
      revADocumentId: 'bounded-a', revBDocumentId: 'bounded-b', engineVersion: 'revision-compare-v1',
      differenceRows: [{ schema: 'RevisionDifferenceRow.v1', differenceId: 'bounded-row', changedProperties: [
        { propertyKey: 'validSibling', revAValue: 1, revBValue: 2, revAEvidencePath: '  C:\\Rev A\\value  ',
          revBEvidencePath: 'urn:rev-b/value?x=1#field', normalizationRule: 'EXACT' },
        { propertyKey: 'nullPrevious', revAValue: false, revBValue: true, revAEvidencePath: null,
          revBEvidencePath: '/rev-b/null-previous', normalizationRule: 'EXACT' },
        { propertyKey: 'nullCurrent', revAValue: 'A', revBValue: 'B', revAEvidencePath: '/rev-a/null-current',
          revBEvidencePath: null, normalizationRule: 'EXACT' },
        { propertyKey: 'invalidPrevious', revAValue: 3, revBValue: 4, revAEvidencePath: undefined,
          revBEvidencePath: '/rev-b/invalid', normalizationRule: 'EXACT' },
        { propertyKey: 'invalidCurrent', revAValue: 5, revBValue: 6, revAEvidencePath: '/rev-a/invalid',
          revBEvidencePath: { invalid: true }, normalizationRule: 'EXACT' },
      ] }] };
    const stringify = (value) => JSON.stringify(value, (_key, item) => item === undefined ? '__UNDEFINED__' : item);
    const before = stringify(auditValue); const controller = createRevisionComparePropertyInspector();
    await controller.render(host, auditValue, 'bounded-row');
    const text = (selector) => host.querySelector(selector)?.textContent;
    const provenanceNodes = [...host.querySelectorAll([
      '[data-engineering-svg-property-previous-source]',
      '[data-engineering-svg-property-current-source]',
    ].join(', '))];
    const result = { before, after: stringify(auditValue),
      shared: [...host.querySelectorAll('[data-engineering-svg-property-key]')].map((node) => node.dataset.engineeringSvgPropertyKey),
      fallback: [...host.querySelectorAll('[data-revc-property-fallback-key]')].map((node) => [node.dataset.revcPropertyFallbackKey, node.children[3]?.textContent]),
      validA: text('[data-engineering-svg-property-previous-source="validSibling"]'),
      validB: text('[data-engineering-svg-property-current-source="validSibling"]'),
      nullA: text('[data-engineering-svg-property-previous-source="nullPrevious"]'),
      nullB: text('[data-engineering-svg-property-current-source="nullCurrent"]'),
      provenanceControls: provenanceNodes.reduce(
        (count, node) => count + node.querySelectorAll('input, select, button, a').length,
        0,
      ),
      visibleControls: [...host.querySelectorAll('input, select, button, a')]
        .filter((node) => !node.hidden && node.offsetParent !== null).length,
      hiddenActions: host.querySelectorAll('[data-engineering-svg-inspector-actions][hidden] button').length,
      mounted: controller.evidence().mountedViews };
    controller.dispose(); result.children = host.childElementCount; host.remove(); return result;
  });
}

test('RC-SVG-005-B01 — shared Rev A/Rev B property provenance', async ({ page }) => {
  await compare(page, true); const rows = await catalog(page); const before = await authority(page);
  await select(page, rows.property); await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  const auditRow = await page.evaluate((id) => structuredClone(window.rcHandle.evidence().state.compare.audit.differenceRows
    .find((row) => row.differenceId === id)), rows.property);
  expect((await authority(page)).audit).toEqual(before.audit);
  const propertyHost = page.locator(`[data-revc-property-inspector-host="${rows.property}"]`);
  const propertyText = await propertyHost.innerText();
  for (const changed of auditRow.changedProperties) {
    const row = page.locator(`[data-engineering-svg-property-key="${changed.propertyKey}"]`);
    await expect(row.locator(`[data-engineering-svg-property-previous-source="${changed.propertyKey}"]`))
      .toHaveText(`Source: ${changed.revAEvidencePath}`);
    await expect(row.locator(`[data-engineering-svg-property-current-source="${changed.propertyKey}"]`))
      .toHaveText(`Source: ${changed.revBEvidencePath}`);
    await expect(row).toHaveAttribute('data-engineering-svg-property-provenance-state', 'uniform');
    await expect(row.locator('input, select, button, a')).toHaveCount(0);
  }
  const level3 = page.locator('[data-level="3"]'); if (!(await level3.evaluate((node) => node.open))) await level3.locator('summary').click();
  const rawText = await level3.locator('code').allTextContents();
  for (const changed of auditRow.changedProperties) { expect(rawText).toContain(changed.revAEvidencePath); expect(rawText).toContain(changed.revBEvidencePath); }
  const contained = await bounded(page);
  expect(contained.before).toBe(contained.after); expect(contained.shared).toEqual(['nullCurrent', 'nullPrevious', 'validSibling']);
  expect(contained.fallback).toEqual([['invalidPrevious', 'INVALID_EVIDENCE_PATH'], ['invalidCurrent', 'INVALID_EVIDENCE_PATH']]);
  expect(contained.validA).toBe('Source:   C:\\Rev A\\value  '); expect(contained.validB).toBe('Source: urn:rev-b/value?x=1#field');
  expect(contained.nullA).toBe('Source: Explicitly unavailable'); expect(contained.nullB).toBe('Source: Explicitly unavailable');
  expect(contained.provenanceControls).toBe(0); expect(contained.visibleControls).toBe(0);
  expect(contained.hiddenActions).toBe(2); expect(contained.mounted).toBe(1); expect(contained.children).toBe(0);

  const initial = (await authority(page)).viewer;
  const fits = initial.fitCounts;
  const commonFits = { all: fits.all, selection: fits.selection };
  const selected = initial.selectedIds;
  await page.getByRole('button', { name: 'Side-by-side' }).click(); await expect(page.locator('[data-revc-svg-pane-root="1"]')).toHaveCount(2);
  expect((await authority(page)).viewer).toMatchObject({ fitCounts: fits, selectedIds: selected, resources: { roots: 2, observers: 1, selectionSubscriptions: 2 } });
  await page.getByRole('button', { name: '3D (WebGL)' }).click(); await expect(page.locator('[data-revc-property-certification-webgl="1"]')).toHaveCount(1);
  expect((await authority(page)).viewer).toMatchObject({ fitCounts: commonFits, selectedIds: selected });
  await page.getByRole('button', { name: 'Engineering SVG' }).click(); await page.getByRole('button', { name: 'Overlay' }).click();
  await expect(page.locator('[data-revc-svg-overlay-root="1"]')).toHaveCount(1);
  expect((await authority(page)).viewer).toMatchObject({ fitCounts: fits, selectedIds: selected, resources: { roots: 1, observers: 1, selectionSubscriptions: 1 } });
  await ensureLevel(page, 2);
  await expect(propertyHost.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  expect(await propertyHost.innerText()).toBe(propertyText);

  const auditJson = JSON.stringify((await authority(page)).audit); const reviewBefore = (await authority(page)).review;
  await page.getByRole('button', { name: 'Mark reviewed' }).click(); expect(JSON.stringify((await authority(page)).audit)).toBe(auditJson);
  expect((await authority(page)).review).not.toEqual(reviewBefore);
  await select(page, rows.ambiguous); const decisionBefore = (await authority(page)).decision;
  await page.locator('[data-revc-preview-candidate-index="0"]').click();
  await page.locator('[data-revc-decision-rationale]').fill('Accept provenance candidate');
  await page.getByRole('button', { name: 'Accept candidate' }).click();
  await page.locator('[data-revc-decision-rationale]').fill('Revoke provenance candidate');
  await page.getByRole('button', { name: 'Revoke decision' }).click();
  expect(JSON.stringify((await authority(page)).audit)).toBe(auditJson); expect((await authority(page)).decision).not.toEqual(decisionBefore);

  await page.evaluate(() => { window.rcPropertyHarness.failNext = true; }); await select(page, rows.second);
  await expect(page.locator('[data-revc-property-status="failed"]')).toContainText('forced property provider failure');
  await expect(page.locator('[data-revc-property-fallback="failure"]')).toBeVisible(); await select(page, rows.property);
  await expect(page.locator('[data-engineering-svg-property-key]').first()).toBeVisible();
  await select(page, rows.ambiguous); await page.evaluate((id) => { window.rcPropertyHarness.delays[id] = 300; }, rows.property);
  await select(page, rows.property); await select(page, rows.added); await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.rcHandle.evidence().property.staleResultsIgnored)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  expect(await page.evaluate(() => window.rcHandle.evidence().property)).toMatchObject({ disposed: true, mountedViews: 0 });
  await expect(page.locator('[data-revc-shared-property-view], [data-revc-svg-overlay-root], [data-revc-svg-pane-root], [data-revc-property-certification-webgl="1"]')).toHaveCount(0);
  await compare(page); const remount = await catalog(page); await select(page, remount.property);
  await expect(page.locator('[data-revc-shared-property-view], [data-engineering-svg-property-rows], [data-revc-svg-overlay-root="1"]')).toHaveCount(3);
  expect(await page.evaluate(() => window.rcHandle.evidence().property)).toMatchObject({ mountedViews: 1, actionListeners: 2 });
  expect((await authority(page)).viewer.resources).toMatchObject({ roots: 1, observers: 1, selectionSubscriptions: 1 });
});

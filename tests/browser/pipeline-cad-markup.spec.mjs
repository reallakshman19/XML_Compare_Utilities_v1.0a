import { test, expect } from '@playwright/test';

const fixture = '/tests/browser/pipeline-cad-markup-fixture.html';
test.beforeEach(async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#status')).toHaveText('ready');
});
const run = (page, name) => page.evaluate((method) => window.pcadMarkupHarness[method](), name);

test('PCAD-005A-B01 load an empty markup document', async ({ page }) => {
  const state = await run(page, 'empty');
  expect(state.document.schema).toBe('PipelineCadMarkupDocument.v1');
  expect(state.document.dimensions).toEqual([]);
  expect(state.document.annotations).toEqual([]);
  expect(state.panelRows[0]).toContain('No persistent dimensions');
});
test('PCAD-005A-B02 API-created Table 2 horizontal dimension', async ({ page }) => {
  const result = await run(page, 'createTable2Horizontal');
  expect(result.record.dimensionId).toBe('pcad-dim-000001');
  expect(result.record.measurementAuthority).toBe('ENGINEERING_PROFILE');
  expect(result.state.evidence[0].textValue).toBe('10');
});
test('PCAD-005A-B03 API-created Table 2 aligned dimension', async ({ page }) => {
  const result = await run(page, 'createTable2Aligned');
  expect(result.record.dimensionType).toBe('LINEAR_ALIGNED');
  expect(result.state.evidence[0].textValue).toBe('10.77');
});
test('PCAD-005A-B04 Table 3 marker review-evidence dimension', async ({ page }) => {
  const result = await run(page, 'createMarkerDimension');
  expect(result.record.measurementAuthority).toBe('REVIEW_EVIDENCE');
  expect(result.state.evidence[0].authority).toBe('REVIEW EVIDENCE');
});
test('PCAD-005A-B05 graph-point presentation-only dimension', async ({ page }) => {
  const result = await run(page, 'createGraphPointDimension');
  expect(result.record.measurementAuthority).toBe('PRESENTATION_ONLY');
  expect(result.state.evidence[0].textValue).toBe('7');
});
test('PCAD-005A-B06 entity-anchored annotation', async ({ page }) => {
  const result = await run(page, 'createEntityAnnotation');
  expect(result.record.anchor.kind).toBe('ENTITY');
  expect(result.state.panelRows.join(' ')).toContain('Exact marker annotation');
});
test('PCAD-005A-B07 graph-point annotation', async ({ page }) => {
  const result = await run(page, 'createPointAnnotation');
  expect(result.record.anchor.kind).toBe('GRAPH_POINT');
  expect(result.state.evidence[0].authority).toBe('DRAWING EVIDENCE');
});
test('PCAD-005A-B08 pan and zoom projection stability', async ({ page }) => {
  const result = await run(page, 'panZoom');
  expect(result.before.label).toBe(result.after.label);
  expect(result.before.authority).toBe(result.after.authority);
  expect(result.before.start).not.toEqual(result.after.start);
  expect(result.state.document.dimensions).toHaveLength(1);
});
test('PCAD-005A-B09 overlays excluded from fit and Object Snap', async ({ page }) => {
  const result = await run(page, 'fitAndSnapExclusion');
  expect(result.boundsAfter).toEqual(result.boundsBefore);
  expect(result.markupHit).toBeNull();
  expect(result.engineeringCandidates).toBe(3);
  expect(result.sourceUnchanged).toBe(true);
});
test('PCAD-005A-B10 atomic update and delete', async ({ page }) => {
  const result = await run(page, 'updateDelete');
  expect(result.updated.offset).toBe(4);
  expect(result.updated.revision).toBe(2);
  expect(result.afterDelete.document.dimensions).toEqual([]);
  expect(result.afterDelete.document.nextSequence).toBe(2);
});
test('PCAD-005A-B11 Undo and Redo', async ({ page }) => {
  const result = await run(page, 'undoRedo');
  expect(result.created.document.annotations).toHaveLength(1);
  expect(result.undone.document.annotations).toHaveLength(0);
  expect(result.undone.document.nextSequence).toBe(1);
  expect(result.redone.document.annotations[0].annotationId).toBe(result.id);
});
test('PCAD-005A-B12 deterministic export and import', async ({ page }) => {
  const result = await run(page, 'roundTrip');
  expect(result.after).toBe(result.canonical);
  expect(result.state.document.dimensions).toHaveLength(1);
  expect(result.state.document.annotations).toHaveLength(1);
});
test('PCAD-005A-B13 source reload exact reconciliation', async ({ page }) => {
  const result = await run(page, 'exactReconcile');
  expect(result.report.fingerprintChanged).toBe(true);
  expect(result.report.orphanedIds).toEqual([]);
  expect(result.state.document.dimensions[0].status).toBe('ACTIVE');
});
test('PCAD-005A-B14 missing anchor becomes orphaned', async ({ page }) => {
  const result = await run(page, 'orphanReconcile');
  expect(result.report.orphanedIds).toContain(result.id);
  expect(result.state.document.dimensions[0].status).toBe('ORPHANED');
  expect(result.state.panelRows.join(' ')).toContain('ORPHANED');
});
test('PCAD-005A-B15 no geometry InputXML or bend change', async ({ page }) => {
  const result = await run(page, 'invariance');
  expect(result.sourceUnchanged).toBe(true);
  expect(result.state.engineeringRevision).toBe(0);
  expect(result.state.document.revision).toBeGreaterThan(0);
});
test('PCAD-005A-B16 destroy and remount cleanup', async ({ page }) => {
  const result = await run(page, 'destroyRemount');
  expect(result.afterDestroy.oldPanelConnected).toBe(false);
  expect(result.afterDestroy.panels).toBe(0);
  expect(result.afterDestroy.table2Dimensions).toBe(0);
  for (const message of Object.values(result.blocked)) {
    expect(message).toContain('runtime is destroyed');
  }
  expect(result.afterBlocked.document).toBe(result.oldDocument);
  expect(result.afterBlocked.projectionCounts).toEqual(result.afterDestroy.projectionCounts);
  expect(result.afterBlocked.publishCount).toBe(result.afterDestroy.publishCount);
  expect(result.afterBlocked.canUndo).toBe(false);
  expect(result.afterBlocked.canRedo).toBe(false);
  expect(result.afterRemount.document.dimensions).toEqual([]);
  expect(result.afterRemount.document.annotations).toEqual([]);
  expect(result.afterRemount.panelRows).toHaveLength(1);
  expect(result.oldAfterRemount).toContain('runtime is destroyed');
});

import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/tests/browser/sequential-engineering-svg-preview-fixture.html');
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__sskPreview))).toBe(true);
}
async function open(page) { await page.evaluate(() => globalThis.__sskPreview.open()); }
async function activate3d(page, advance = true) {
  await page.evaluate((value) => globalThis.__sskPreview.activate3d(undefined, value), advance);
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.draftState().controller?.active)).toBe(true);
}

// SSK-TS-1B-B01
test('SSK-TS-1B-B01 pre-session Draft Edit 3D is disabled', async ({ page }) => {
  await ready(page); await open(page);
  const state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.buttonDisabled).toBe(true);
  expect(state.controller.available).toBe(false);
  expect(state.controller.active).toBe(false);
  expect(state.hostHidden).toBe(true);
  expect(state.constructionHidden).toBe(false);
});

// SSK-TS-1B-B02
test('SSK-TS-1B-B02 certified scene mounts as read-only VisualGeometryModel', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  const state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.buttonPressed).toBe('true');
  expect(state.hostHidden).toBe(false);
  expect(state.constructionHidden).toBe(true);
  expect(state.constructionInert).toBe(true);
  expect(state.previewHidden).toBe(true);
  expect(state.viewer.targetContract).toBe('VisualGeometryModel.v2');
  expect(state.viewer.mode).toBe('target-only');
  expect(state.viewer.targetSegmentCount + state.viewer.targetMarkerCount).toBeGreaterThan(0);
  expect(state.status).toContain('read-only entities');
});

// SSK-TS-1B-B03
test('SSK-TS-1B-B03 3D pick changes only local viewer selection', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  const before = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(before.viewer.firstObjectId).not.toBe('');
  await page.evaluate((id) => globalThis.__sskPreview.pick3d(id), before.viewer.firstObjectId);
  const after = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(after.viewer.selectedObjectId).toBe(before.viewer.firstObjectId);
  expect(after.stepLabel).toBe(before.stepLabel);
  expect(after.activeBranch).toBe(before.activeBranch);
  expect(after.status).toContain('Read-only; no command issued');
});

// SSK-TS-1B-B04
test('SSK-TS-1B-B04 owner projection changes refresh the 3D camera', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  for (const [projection, view] of [['XY', 'top'], ['XZ', 'front'], ['YZ', 'side'], ['ISO', 'iso']]) {
    await page.evaluate((value) => globalThis.__sskPreview.projection(value), projection);
    await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.draftState().viewer.views.at(-1))).toBe(view);
  }
});

// SSK-TS-1B-B05
test('SSK-TS-1B-B05 branch switch replaces revision and refits', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page, false);
  const before = await page.evaluate(() => globalThis.__sskPreview.draftState());
  await page.evaluate(() => globalThis.__sskPreview.openBranch(globalThis.__sskPreview.branches[1]));
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.draftState().viewer.targetRevisionId))
    .not.toBe(before.viewer.targetRevisionId);
  const after = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(after.viewer.fitCount).toBeGreaterThan(before.viewer.fitCount);
  expect(after.controller.active).toBe(true);
});

// SSK-TS-1B-B06
test('SSK-TS-1B-B06 SVG preview and Draft Edit 3D are mutually exclusive', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  await page.evaluate(async () => { globalThis.__sskPreview.renderer('ENGINEERING_SVG_PREVIEW'); await globalThis.__sskPreview.tick(); await globalThis.__sskPreview.tick(); });
  let state = await page.evaluate(() => ({ preview: globalThis.__sskPreview.state(), draft: globalThis.__sskPreview.draftState() }));
  expect(state.draft.controller.active).toBe(false);
  expect(state.draft.hostHidden).toBe(true);
  expect(state.preview.previewHidden).toBe(false);
  expect(state.preview.sharedRoots).toBe(1);
  await page.evaluate(async () => { globalThis.__sskPreview.draft3d(); await globalThis.__sskPreview.tick(); await globalThis.__sskPreview.tick(); });
  state = await page.evaluate(() => ({ preview: globalThis.__sskPreview.state(), draft: globalThis.__sskPreview.draftState() }));
  expect(state.draft.controller.active).toBe(true);
  expect(state.draft.hostHidden).toBe(false);
  expect(state.preview.previewHidden).toBe(true);
  expect(state.preview.sharedRoots).toBe(0);
});

// SSK-TS-1B-B07
test('SSK-TS-1B-B07 viewer-mount failure retains Construction SVG and permits retry', async ({ page }) => {
  await ready(page); await open(page);
  const branch = await page.evaluate(async () => {
    const f = globalThis.__sskPreview; f.inspect(); f.openBranch(); f.set3dFailure('viewer-mount');
    const value = f.draftState().activeBranch; f.draft3d(); await f.tick(); await f.tick(); return value;
  });
  let state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.controller.active).toBe(false);
  expect(state.hostHidden).toBe(true);
  expect(state.constructionHidden).toBe(false);
  expect(state.activeBranch).toBe(branch);
  expect(state.failureCount).toBe(1);
  expect(state.status).toContain('failed during view mount');
  await page.evaluate(async () => { const f = globalThis.__sskPreview; f.set3dFailure(''); f.draft3d(); await f.tick(); await f.tick(); });
  state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.controller.active).toBe(true);
  expect(state.viewer.targetContract).toBe('VisualGeometryModel.v2');
});

// SSK-TS-1B-B08
test('SSK-TS-1B-B08 runtime and navigation failures fail open', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  await page.evaluate(() => globalThis.__sskPreview.runtimeFailure3d('runtime boom'));
  let state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.controller.active).toBe(false);
  expect(state.constructionHidden).toBe(false);
  expect(state.status).toContain('viewer runtime');
  await page.evaluate(async () => { const f = globalThis.__sskPreview; f.draft3d(); await f.tick(); await f.tick(); f.navigationFailure3d('navigation boom'); });
  state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.controller.active).toBe(false);
  expect(state.constructionHidden).toBe(false);
  expect(state.status).toContain('navigation');
});

// SSK-TS-1B-B09
test('SSK-TS-1B-B09 source reload invalidates 3D authority', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  await page.evaluate(() => globalThis.__sskPreview.reloadSource());
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.draftState().buttonDisabled)).toBe(true);
  const state = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(state.controller.active).toBe(false);
  expect(state.hostHidden).toBe(true);
  expect(state.constructionHidden).toBe(false);
});

// SSK-TS-1B-B10
test('SSK-TS-1B-B10 close disposes viewer and remount starts clean', async ({ page }) => {
  await ready(page); await open(page); await activate3d(page);
  await page.evaluate(() => globalThis.__sskPreview.close());
  expect(await page.locator('.ssk-modal').count()).toBe(0);
  const closed = await page.evaluate(async () => ({
    state: globalThis.__sskPreview.old3dController().getState(),
    show: await globalThis.__sskPreview.old3dController().show(),
    viewer: globalThis.__sskPreview.currentViewer().getStateSnapshot(),
  }));
  expect(closed.state.destroyed).toBe(true);
  expect(closed.show).toBe(false);
  expect(closed.viewer.disposed).toBe(true);
  await open(page);
  const fresh = await page.evaluate(() => globalThis.__sskPreview.draftState());
  expect(fresh.controller.destroyed).toBe(false);
  expect(fresh.controller.active).toBe(false);
  expect(fresh.buttonDisabled).toBe(true);
});

import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/tests/browser/sequential-engineering-svg-preview-fixture.html');
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__sskPreview))).toBe(true);
}
async function open(page) { await page.evaluate(() => globalThis.__sskPreview.open()); }
async function activate(page, advance = true) { await page.evaluate((value) => globalThis.__sskPreview.activatePreview(undefined, value), advance); }

// SSK-ESVG-003C-B01
test('SSK-ESVG-003C-B01 default Construction SVG and no shared root', async ({ page }) => {
  await ready(page); await open(page);
  const state = await page.evaluate(() => globalThis.__sskPreview.state());
  expect(state.controller.renderer).toBe('CONSTRUCTION_SVG'); expect(state.sharedRoots).toBe(0); expect(state.constructionHidden).toBe(false);
});
// SSK-ESVG-003C-B02
test('SSK-ESVG-003C-B02 pre-session preview disabled and null-envelope handling', async ({ page }) => {
  await ready(page); await open(page); await page.evaluate(() => globalThis.__sskPreview.inspect());
  const state = await page.evaluate(() => globalThis.__sskPreview.state());
  expect(state.previewDisabled).toBe(true); expect(state.sharedRoots).toBe(0); expect(state.controller.renderer).toBe('CONSTRUCTION_SVG');
});
// SSK-ESVG-003C-B03
test('SSK-ESVG-003C-B03 explicit branch-open preview mount', async ({ page }) => {
  await ready(page); await open(page); await activate(page, false);
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.state().sharedRoots)).toBe(1);
  expect((await page.evaluate(() => globalThis.__sskPreview.state())).controller.renderer).toBe('ENGINEERING_SVG_PREVIEW');
});
// SSK-ESVG-003C-B04
test('SSK-ESVG-003C-B04 one active surface and accessible inspector', async ({ page }) => {
  await ready(page); await open(page); await activate(page);
  const state = await page.evaluate(() => globalThis.__sskPreview.state());
  expect(state.sharedRoots).toBe(1); expect(state.constructionHidden).toBe(true); expect(state.constructionInert).toBe(true); expect(state.previewHidden).toBe(false); expect(state.inspectorVisible).toBe(true);
});
// SSK-ESVG-003C-B05
test('SSK-ESVG-003C-B05 read-only selection and decision-authority separation', async ({ page }) => {
  await ready(page); await open(page);
  await page.evaluate(async () => { const f=globalThis.__sskPreview; f.inspect(); f.openBranch(); f.run(); const pick=f.root().querySelector('[data-ssk-select-candidate]'); pick?.click(); f.renderer('ENGINEERING_SVG_PREVIEW'); await f.tick(); await f.tick(); });
  const candidate = await page.locator('[data-ssk-select-candidate]').first().getAttribute('data-ssk-select-candidate');
  await expect(page.locator(`[data-ssk-candidate-card="${candidate}"]`)).toHaveClass(/is-selected/);
  await page.locator('[data-engineering-svg-entity-id]').first().click();
  await expect(page.locator(`[data-ssk-candidate-card="${candidate}"]`)).toHaveClass(/is-selected/);
  const boundary = await page.evaluate(async () => { const p=globalThis.__sskPreview.controller().getPreviewWorkspace(); return { access:p.accessMode, command:p.commandGateway, applied:await p.apply(), sharedSelection:p.getSelection() }; });
  expect(boundary.access).toBe('read-only'); expect(boundary.command).toBe(null); expect(boundary.applied).toBe(null); expect(boundary.sharedSelection.length).toBeGreaterThan(0);
});
// SSK-ESVG-003C-B06
test('SSK-ESVG-003C-B06 ISO XY XZ YZ projection switching', async ({ page }) => {
  await ready(page); await open(page); await activate(page);
  const before = await page.evaluate(async () => JSON.stringify((await globalThis.__sskPreview.controller().getPreviewWorkspace().adapter.getScene()).revision));
  for (const projection of ['ISO','XY','XZ','YZ']) {
    await page.evaluate((value) => globalThis.__sskPreview.projection(value), projection);
    await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.controller().getPreviewWorkspace().getProjection())).toBe(projection);
  }
  const after = await page.evaluate(async () => JSON.stringify((await globalThis.__sskPreview.controller().getPreviewWorkspace().adapter.getScene()).revision));
  expect(after).toBe(before);
});
// SSK-ESVG-003C-B07
test('SSK-ESVG-003C-B07 construction advance and branch-switch refresh', async ({ page }) => {
  await ready(page); await open(page); await activate(page, false);
  const initial = await page.evaluate(() => globalThis.__sskPreview.state().controller.refreshCount);
  await page.evaluate(() => globalThis.__sskPreview.advance());
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.state().controller.refreshCount)).toBe(initial + 1);
  await page.evaluate(() => { const f=globalThis.__sskPreview; f.openBranch(f.branches[1]); });
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.state().controller.refreshCount)).toBe(initial + 2);
});
// SSK-ESVG-003C-B08
test('SSK-ESVG-003C-B08 source reload null fallback and selection clear', async ({ page }) => {
  await ready(page); await open(page);
  await page.evaluate(async () => { const f=globalThis.__sskPreview; f.inspect(); f.openBranch(); f.run(); f.renderer('ENGINEERING_SVG_PREVIEW'); await f.tick(); await f.tick(); });
  await page.locator('[data-engineering-svg-entity-id]').first().click();
  expect(await page.evaluate(() => globalThis.__sskPreview.controller().getPreviewWorkspace().getSelection().length)).toBeGreaterThan(0);
  await page.evaluate(() => globalThis.__sskPreview.reloadSource());
  await expect.poll(() => page.evaluate(() => globalThis.__sskPreview.state().sharedRoots)).toBe(0);
  const state = await page.evaluate(() => globalThis.__sskPreview.state()); expect(state.controller.renderer).toBe('CONSTRUCTION_SVG'); expect(state.previewDisabled).toBe(true);
  expect(await page.evaluate(() => globalThis.__sskPreview.controller().getPreviewWorkspace())).toBe(null);
});
// SSK-ESVG-003C-B09
test('SSK-ESVG-003C-B09 mount parity subscription failure containment', async ({ page }) => {
  await ready(page); await open(page);
  const branch = await page.evaluate(async () => { const f=globalThis.__sskPreview; f.inspect(); f.openBranch(); const before=f.state().activeBranch; f.setFailure('parity-validation'); f.renderer('ENGINEERING_SVG_PREVIEW'); await f.tick(); await f.tick(); return before; });
  let state = await page.evaluate(() => globalThis.__sskPreview.state()); expect(state.sharedRoots).toBe(0); expect(state.controller.renderer).toBe('CONSTRUCTION_SVG'); expect(state.status).toContain('failed'); expect(state.activeBranch).toBe(branch);
  await page.evaluate(async () => { const f=globalThis.__sskPreview; f.setFailure('shell-mounting'); f.renderer('ENGINEERING_SVG_PREVIEW'); await f.tick(); await f.tick(); });
  state = await page.evaluate(() => globalThis.__sskPreview.state()); expect(state.sharedRoots).toBe(0); expect(state.controller.renderer).toBe('CONSTRUCTION_SVG');
  const subscription = await page.evaluate(() => globalThis.__sskPreview.subscriptionFailure());
  expect(subscription.state.ownerSubscriptionActive).toBe(false); expect(subscription.roots).toBe(0); expect(subscription.constructionHidden).toBe(false);
});
// SSK-ESVG-003C-B10
test('SSK-ESVG-003C-B10 switch back close and remount cleanup', async ({ page }) => {
  await ready(page); await open(page); await activate(page);
  await page.evaluate(() => globalThis.__sskPreview.renderer('CONSTRUCTION_SVG'));
  expect((await page.evaluate(() => globalThis.__sskPreview.state())).sharedRoots).toBe(0);
  await page.evaluate(() => globalThis.__sskPreview.close()); expect(await page.locator('.ssk-modal').count()).toBe(0);
  expect(await page.evaluate(() => globalThis.__sskPreview.oldController().switchRenderer('ENGINEERING_SVG_PREVIEW'))).toBe(false);
  await open(page); const state = await page.evaluate(() => globalThis.__sskPreview.state()); expect(state.controller.renderer).toBe('CONSTRUCTION_SVG'); expect(state.controller.ownerSubscriptionAttempts).toBe(1); expect(state.sharedRoots).toBe(0);
});

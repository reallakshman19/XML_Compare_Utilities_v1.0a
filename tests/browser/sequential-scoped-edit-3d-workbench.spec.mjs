import { test, expect } from '@playwright/test';

const FIXTURE_IDS = [
  'SSK3D-FIXTURE-AMBIGUOUS-BLOCKED',
  'SSK3D-FIXTURE-CANDIDATE-REJECTED',
  'SSK3D-FIXTURE-GAP-REPAIRED',
  'SSK3D-FIXTURE-SUPPORT-CONFIRMED',
];
const LIMITATION_IDS = [
  'NO_STRUCTURAL_TOPOLOGY_APPLICATION',
  'NO_GEOMETRY_OR_SUPPORT_PERSISTENCE_IN_PORTABLE_PACKAGE',
  'NO_HETEROGENEOUS_ATOMIC_TRANSACTION',
  'NO_UNRESTRICTED_MULTI_SELECTION',
  'NO_AUTOMATIC_TOPOLOGY_REPAIR',
  'ENGINEERING_DEMO_ONLY',
];

async function ready(page) {
  await page.goto('/tests/browser/sequential-scoped-edit-3d-workbench-fixture.html');
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__ssk3dWorkbench))).toBe(true);
}
async function openAndActivate(page, advance = true) {
  await page.evaluate(() => globalThis.__ssk3dWorkbench.open());
  await page.evaluate((value) => globalThis.__ssk3dWorkbench.activate3d(undefined, value), advance);
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().controller?.active)).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().viewer?.runtimePending)).toBe(false);
}
async function durableReady(page) {
  await page.goto('/tests/browser/sequential-draft-edit-package-v3-fixture.html');
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__ssk3dPackage))).toBe(true);
  await page.evaluate(() => globalThis.__ssk3dPackage.open());
  await page.evaluate(() => globalThis.__ssk3dPackage.activate3d());
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.active)).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.viewerState?.runtimePending)).toBe(false);
}
async function selectVisibleMoveTarget(page) {
  const canvas = page.locator('[data-ssk-draft-edit-3d-canvas] canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  for (const ratio of [0.5, 0.45, 0.55, 0.4, 0.6]) {
    await canvas.click({ position: { x: box.width * ratio, y: box.height / 2 } });
    const text = await page.locator('[data-ssk-single-move-target]').textContent();
    if (!text?.includes('No confirmed')) return;
  }
  await expect(page.locator('[data-ssk-single-move-target]')).not.toContainText('No confirmed');
}
async function selectVisibleStretchTarget(page) {
  await page.locator('[data-ssk-component-edit-mode-value="STRETCH_NODE"]').click();
  const canvas = page.locator('[data-ssk-draft-edit-3d-canvas] canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  for (const ratio of [0.5, 0.45, 0.55, 0.4, 0.6]) {
    await canvas.click({ position: { x: box.width * ratio, y: box.height / 2 } });
    const text = await page.locator('[data-ssk-node-stretch-position]').textContent();
    if (text?.includes('Current:')) return;
  }
  await expect(page.locator('[data-ssk-node-stretch-position]')).toContainText('Current:');
}
async function applyVisibleMove(page, delta, expectedCount) {
  await selectVisibleMoveTarget(page);
  await page.locator('[data-ssk-single-move-constraint]').selectOption('X');
  await page.locator('[data-ssk-single-move-axis="x"]').fill(String(delta));
  await page.locator('[data-ssk-single-move-preview]').click();
  await expect(page.locator('[data-ssk-geometry-move-prepare]')).toBeEnabled();
  await page.locator('[data-ssk-geometry-move-actor]').fill('P1_UI_OPERATOR');
  await page.locator('[data-ssk-geometry-move-reason]').fill('Verify deterministic geometry history.');
  await page.locator('[data-ssk-geometry-move-evidence]').fill('Isolated unsupported pipe selected in real Workbench.');
  await page.locator('[data-ssk-geometry-move-prepare]').click();
  await expect(page.locator('[data-ssk-geometry-move-accept]')).toBeEnabled();
  await page.locator('[data-ssk-geometry-move-accept]').click();
  await expect.poll(() => page.evaluate((count) => globalThis.__ssk3dPackage.state()
    .geometryBranches.some((row) => row.entryCount === count), expectedCount)).toBe(true);
}
async function fillHistoryEvidence(page, reason) {
  await page.locator('[data-ssk-geometry-history-actor]').fill('P1_HISTORY_OPERATOR');
  await page.locator('[data-ssk-geometry-history-reason]').fill(reason);
  await page.locator('[data-ssk-geometry-history-evidence]')
    .fill('Cursor, affected operation, branch and visible scene were reviewed.');
}
function expectFixtureEvidence(manifest) {
  expect(manifest.fixtureCatalog.schema).toBe('SequentialDraftEdit3dFixtureCatalog.v1');
  expect(manifest.fixtureCatalog.scenarioCount).toBe(FIXTURE_IDS.length);
  expect(manifest.fixtureCatalog.scenarios.map((row) => row.scenarioId)).toEqual(FIXTURE_IDS);
}
function expectLimitationEvidence(manifest) {
  const register = manifest.limitationRegister;
  expect(register.schema).toBe('SequentialDraftEdit3dLimitationRegister.v1');
  expect(register.entryCount).toBe(LIMITATION_IDS.length);
  expect(register.entries.map((row) => row.limitationId)).toEqual(LIMITATION_IDS);
  const trust = register.ownershipAttestation.trustBoundary;
  expect(trust.contentIntegrity).toBe('ESTABLISHED_BY_CANONICAL_FINGERPRINT');
  expect(trust.signerIdentity).toBe('NOT_ESTABLISHED');
  expect(trust.organizationalAuthority).toBe('NOT_ESTABLISHED');
  expect(trust.productionApproval).toBe('NOT_ESTABLISHED');
}

// SSK-TS-1B-W01
test('SSK-TS-1B-W01 real Workbench realizes the certified Sequential model', async ({ page }) => {
  await ready(page); await openAndActivate(page);
  const state = await page.evaluate(() => globalThis.__ssk3dWorkbench.state());
  expect(state.canvasCount).toBe(1);
  expect(state.hostHidden).toBe(false);
  expect(state.constructionHidden).toBe(true);
  expect(state.viewer.mode).toBe('target-only');
  expect(state.viewer.runtimeError).toBe(null);
  expect(state.viewer.instanceCount).toBeGreaterThan(0);
  expect(state.viewer.drawBatchCount).toBeGreaterThan(0);
  expect(state.viewer.sceneChunkCount).toBeGreaterThan(0);
  expect(state.failures).toEqual([]);
});

// SSK-TS-1B-W02
test('SSK-TS-1B-W02 real Workbench projection and renderer fallback stay live', async ({ page }) => {
  await ready(page); await openAndActivate(page);
  const before = await page.evaluate(() => JSON.stringify(globalThis.__ssk3dWorkbench.state().viewer.navigationState));
  await page.evaluate(() => globalThis.__ssk3dWorkbench.projection('XY'));
  await expect.poll(() => page.evaluate(() => JSON.stringify(globalThis.__ssk3dWorkbench.state().viewer.navigationState))).not.toBe(before);
  await page.evaluate(() => globalThis.__ssk3dWorkbench.renderer('CONSTRUCTION_SVG'));
  const state = await page.evaluate(() => globalThis.__ssk3dWorkbench.state());
  expect(state.controller.active).toBe(false);
  expect(state.hostHidden).toBe(true);
  expect(state.constructionHidden).toBe(false);
});

// SSK-TS-1B-W03
test('SSK-TS-1B-W03 real Workbench replaces scene revision on branch switch', async ({ page }) => {
  await ready(page); await openAndActivate(page, false);
  const before = await page.evaluate(() => globalThis.__ssk3dWorkbench.state().viewer.runtimeRevision);
  await page.evaluate(() => globalThis.__ssk3dWorkbench.openBranch(globalThis.__ssk3dWorkbench.branches[1]));
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().viewer?.runtimePending)).toBe(false);
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().viewer?.runtimeRevision)).not.toBe(before);
  const state = await page.evaluate(() => globalThis.__ssk3dWorkbench.state());
  expect(state.controller.active).toBe(true);
  expect(state.viewer.runtimeError).toBe(null);
  expect(state.viewer.instanceCount).toBeGreaterThan(0);
});

// SSK-TS-1B-W04
test('SSK-TS-1B-W04 real Workbench closes without leaked canvas', async ({ page }) => {
  await ready(page); await openAndActivate(page);
  await page.evaluate(() => globalThis.__ssk3dWorkbench.close());
  expect(await page.locator('.ssk-modal').count()).toBe(0);
  expect(await page.locator('canvas').count()).toBe(0);
});

// SSK-3D-P0-A-W01 / SSK-3D-P0-B-W01 / SSK-3D-P0-C-W01 / SSK-3D-P0-D-W01
test('SSK-3D-P0-D-W01 pilot evidence binds owner-attested limitations', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => globalThis.__ssk3dWorkbench.open());
  expect(await page.evaluate(() => globalThis.__ssk3dWorkbench.state().pilotDisabled)).toBe(true);
  await page.evaluate(() => globalThis.__ssk3dWorkbench.activate3d());
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().pilotDisabled)).toBe(false);
  await page.evaluate(() => globalThis.__ssk3dWorkbench.pilot());
  await page.evaluate(() => globalThis.__ssk3dWorkbench.pilot());
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().pilotExports.length)).toBe(2);
  const manifests = await page.evaluate(() => globalThis.__ssk3dWorkbench.state().pilotExports);
  const manifest = manifests[0];
  expect(JSON.stringify(manifests[1])).toBe(JSON.stringify(manifest));
  expect(manifests[1].manifestFingerprint).toBe(manifest.manifestFingerprint);
  expect(manifest.schema).toBe('SequentialDraftEdit3dReleaseManifest.v1');
  expect(manifest.createdAt).toBeTruthy();
  expect(manifest.baseline.commit).toBe('19e04711fc54083bd8e622bbd82048839ca8ebfa');
  expect(manifest.authority.branchId).toBeTruthy();
  expectFixtureEvidence(manifest);
  expectLimitationEvidence(manifest);
  expect(manifest.controller.fallbackSurface).toBe('CONSTRUCTION_SVG');
  expect(manifest.disposition.internalPilotReady).toBe(false);
  expect(manifest.disposition.newEditingAuthority).toBe(false);
});

// SSK-3D-P0-A-W02
test('SSK-3D-P0-A-W02 injected scene failure returns to Construction SVG', async ({ page }) => {
  await ready(page); await openAndActivate(page);
  await page.evaluate(() => {
    globalThis.__ssk3dWorkbench.injectFailure('scene-apply');
    globalThis.__ssk3dWorkbench.refresh3d();
  });
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dWorkbench.state().controller.active)).toBe(false);
  const state = await page.evaluate(() => globalThis.__ssk3dWorkbench.state());
  expect(state.hostHidden).toBe(true);
  expect(state.constructionHidden).toBe(false);
  expect(state.failures.some((row) => row.stage === 'owner refresh')).toBe(true);
  expect(state.status).toContain('Construction SVG retained');
});

// SSK-3D-P1-A-W01
test('SSK-3D-P1-A-W01 accepted component move survives workspace package reopen', async ({ page }) => {
  await durableReady(page);
  const canvas = page.locator('[data-ssk-draft-edit-3d-canvas] canvas');
  await expect(canvas).toHaveCount(1);
  await selectVisibleMoveTarget(page);
  await page.locator('[data-ssk-single-move-constraint]').selectOption('X');
  await page.locator('[data-ssk-single-move-axis="x"]').fill('25');
  await page.locator('[data-ssk-single-move-preview]').click();
  await expect(page.locator('[data-ssk-geometry-move-prepare]')).toBeEnabled();
  await page.locator('[data-ssk-geometry-move-actor]').fill('P1_UI_OPERATOR');
  await page.locator('[data-ssk-geometry-move-reason]').fill('Verify durable package restoration.');
  await page.locator('[data-ssk-geometry-move-evidence]').fill('Isolated unsupported pipe selected in real Workbench.');
  await page.locator('[data-ssk-geometry-move-prepare]').click();
  await expect(page.locator('[data-ssk-geometry-move-accept]')).toBeEnabled();
  await page.locator('[data-ssk-geometry-move-accept]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .geometryBranches.some((row) => row.entryCount === 1))).toBe(true);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-ssk-workspace-export]').click();
  const download = await downloadPromise;
  const packagePath = await download.path();
  expect(packagePath).toBeTruthy();
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('SequentialWorkspacePackage.v3');
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('1 geometry edits');

  await page.evaluate(() => globalThis.__ssk3dPackage.close());
  await page.evaluate(() => globalThis.__ssk3dPackage.open());
  await page.locator('[data-ssk-workspace-import]').setInputFiles(packagePath);
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('Draft Edit 3D impact INSTALL');
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('1 geometry edits');
  await page.locator('[data-ssk-workspace-apply-reason]')
    .fill('Restore reviewed durable Draft Edit 3D authority.');
  await page.locator('[data-ssk-workspace-apply-evidence]')
    .fill('Package schema, journal authority and edit counts reviewed.');
  await page.locator('[data-ssk-workspace-apply]').click();
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('Applied SequentialWorkspacePackage.v3 revision 3');
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('1 geometry edits');

  await page.locator('[data-ssk-draft-edit-3d]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.active)).toBe(true);
  const restored = await page.evaluate(() => globalThis.__ssk3dPackage.state());
  expect(restored.canvasCount).toBe(1);
  expect(restored.geometryBranches.some((row) => row.entryCount === 1)).toBe(true);
  expect(restored.failures).toEqual([]);
});

// SSK-3D-P1-B-W01
test('SSK-3D-P1-B-W01 geometry cursor and redo survive workspace package reopen', async ({ page }) => {
  await durableReady(page);
  await applyVisibleMove(page, 25, 1);
  await applyVisibleMove(page, 10, 2);
  await expect(page.locator('[data-ssk-geometry-history-position]')).toHaveText('2 / 2');
  await expect(page.locator('[data-ssk-geometry-history-undo]')).toBeEnabled();
  await expect(page.locator('[data-ssk-geometry-history-redo]')).toBeDisabled();

  await fillHistoryEvidence(page, 'Undo the latest accepted component move.');
  await page.locator('[data-ssk-geometry-history-undo]').click();
  await expect(page.locator('[data-ssk-geometry-history-position]')).toHaveText('1 / 2');
  await expect(page.locator('[data-ssk-geometry-history-redo]')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .geometryBranches.some((row) => row.entryCount === 2
      && row.activeEntryCount === 1 && row.redoEntryCount === 1))).toBe(true);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-ssk-workspace-export]').click();
  const packagePath = await (await downloadPromise).path();
  expect(packagePath).toBeTruthy();
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('2 geometry edits');

  await page.evaluate(() => globalThis.__ssk3dPackage.close());
  await page.evaluate(() => globalThis.__ssk3dPackage.open());
  await page.locator('[data-ssk-workspace-import]').setInputFiles(packagePath);
  await expect(page.locator('[data-ssk-workspace-package-summary]'))
    .toContainText('2 geometry edits (1 active, 1 redo)');
  await page.locator('[data-ssk-workspace-apply-reason]')
    .fill('Restore reviewed geometry history cursor.');
  await page.locator('[data-ssk-workspace-apply-evidence]')
    .fill('Active and redo geometry counts reviewed before application.');
  await page.locator('[data-ssk-workspace-apply]').click();
  await page.locator('[data-ssk-draft-edit-3d]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.active)).toBe(true);
  await expect(page.locator('[data-ssk-geometry-history-position]')).toHaveText('1 / 2');
  await expect(page.locator('[data-ssk-geometry-history-redo]')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .geometryBranches.some((row) => row.entryCount === 2
      && row.activeEntryCount === 1 && row.redoEntryCount === 1))).toBe(true);

  await fillHistoryEvidence(page, 'Redo the restored accepted component move.');
  await page.locator('[data-ssk-geometry-history-redo]').click();
  await expect(page.locator('[data-ssk-geometry-history-position]')).toHaveText('2 / 2');
  await expect(page.locator('[data-ssk-geometry-history-redo]')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .geometryBranches.some((row) => row.activeEntryCount === 2
      && row.redoEntryCount === 0))).toBe(true);
  expect((await page.evaluate(() => globalThis.__ssk3dPackage.state())).failures).toEqual([]);
});

// SSK-3D-P1-C-W01
test('SSK-3D-P1-C-W01 pending move restores explicitly and publishes only after fresh prepare', async ({ page }) => {
  await durableReady(page);
  await selectVisibleMoveTarget(page);
  await page.locator('[data-ssk-single-move-constraint]').selectOption('X');
  await page.locator('[data-ssk-single-move-axis="x"]').fill('15');
  await page.locator('[data-ssk-single-move-preview]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .controller.recovery.storage.recordCount)).toBe(1);
  expect((await page.evaluate(() => globalThis.__ssk3dPackage.state())).geometryBranches
    .every((row) => row.entryCount === 0)).toBe(true);

  await page.evaluate(() => globalThis.__ssk3dPackage.close());
  await page.evaluate(() => globalThis.__ssk3dPackage.open());
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.active)).toBe(false);
  await expect(page.locator('[data-ssk-draft-edit-3d-canvas] canvas')).toHaveCount(0);
  await expect(page.locator('[data-ssk-draft-recovery-kind]')).toHaveText('MOVE_COMPONENT');
  await page.locator('[data-ssk-draft-recovery-restore]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.active)).toBe(true);
  await expect(page.locator('[data-ssk-draft-edit-3d-canvas] canvas')).toHaveCount(1);
  await expect(page.locator('[data-ssk-geometry-move-prepare]')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .controller.componentEdit.move.operationId)).not.toBe(null);
  expect((await page.evaluate(() => globalThis.__ssk3dPackage.state())).geometryBranches
    .every((row) => row.entryCount === 0)).toBe(true);

  await page.locator('[data-ssk-geometry-move-actor]').fill('P1_RECOVERY_OPERATOR');
  await page.locator('[data-ssk-geometry-move-reason]').fill('Fresh review after explicit recovery.');
  await page.locator('[data-ssk-geometry-move-evidence]').fill('Recovered exact delta and current target evidence reviewed.');
  await page.locator('[data-ssk-geometry-move-prepare]').click();
  await expect(page.locator('[data-ssk-geometry-move-accept]')).toBeEnabled();
  await page.locator('[data-ssk-geometry-move-accept]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .geometryBranches.some((row) => row.entryCount === 1))).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .controller.recovery.storage.recordCount)).toBe(0);
});

// SSK-3D-P1-C-W02
test('SSK-3D-P1-C-W02 pending stretch can be discarded without accepted authority change', async ({ page }) => {
  await durableReady(page);
  await selectVisibleStretchTarget(page);
  const x = Number(await page.locator('[data-ssk-node-stretch-x]').inputValue());
  await page.locator('[data-ssk-node-stretch-x]').fill(String(x + 5));
  await page.locator('[data-ssk-node-stretch-preview]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .controller.recovery.storage.recordCount)).toBe(1);

  await page.evaluate(() => globalThis.__ssk3dPackage.close());
  await page.evaluate(() => globalThis.__ssk3dPackage.open());
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state().controller?.active)).toBe(false);
  await expect(page.locator('[data-ssk-draft-edit-3d-canvas] canvas')).toHaveCount(0);
  await expect(page.locator('[data-ssk-draft-recovery-kind]')).toHaveText('STRETCH_NODE');
  await page.locator('[data-ssk-draft-recovery-discard]').click();
  await expect(page.locator('[data-ssk-draft-recovery]')).toBeHidden();
  await expect(page.locator('[data-ssk-draft-edit-3d-canvas] canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.__ssk3dPackage.state()
    .controller.recovery.storage.recordCount)).toBe(0);
  expect((await page.evaluate(() => globalThis.__ssk3dPackage.state())).geometryBranches
    .every((row) => row.entryCount === 0)).toBe(true);
});

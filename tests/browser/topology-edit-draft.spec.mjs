import { expect, test } from '@playwright/test';

// The Edit Draft surface is a WebGL canvas (instanced workbench viewer), so
// assertions run against the command model / shared selection through the
// harness plus inspector actions — not SVG DOM. Requires network for the
// three.js importmap/CDN fallback.

const evidence = (page) => page.evaluate(() => window.__topologyEditHarness.controller.evidence().edit);

async function selectRows(page, rows) {
  await page.evaluate((selection) => {
    window.__topologyEditHarness.controller.edit.setExternalSelection(selection);
  }, rows);
}

test('TTV-E01 — reversible Edit Draft commands regenerate evidence and preserve shared selection', async ({ page }) => {
  await page.goto('/tests/browser/topology-edit-draft-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyEditFixtureReady === '1');
  await page.locator('[data-ttv-workspace-tab="edit"]').click();
  await expect(page.locator('[data-ttv-edit-status]')).toContainText('Edit Draft ready');
  await expect(page.locator('[data-ttv-workspace-panel="trace"]')).toBeHidden();
  await expect(page.locator('[data-ttv-workspace-panel="edit"]')).toBeVisible();

  const base = await evidence(page);
  expect(base.baseArtifacts.canonicalTopology.nodes.length).toBe(3);
  expect(base.baseArtifacts.canonicalTopology.edges.length).toBe(2);
  await expect(page.locator('[data-ttv-edit-export]')).toBeEnabled();
  const exportInspector = page.locator('[data-ttv-edit-export-plan]');
  await expect(exportInspector).toContainText('Data & Export Inspector');
  await expect(exportInspector.locator('[data-export-gate]')).toHaveText('READY');
  expect(await exportInspector.locator('[data-export-row]').count()).toBeLessThan(80);
  const bottomDetails = page.locator('.ttv-edit-bottom-details');
  await page.locator('.ttv-edit-bottom-summary').click();
  await expect(bottomDetails).not.toHaveAttribute('open', '');
  await page.locator('.ttv-edit-bottom-summary').click();
  await expect(bottomDetails).toHaveAttribute('open', '');

  // The 3D canvas mounts inside the former SVG host region.
  await expect(page.locator('[data-ttv-edit-svg-host] .ttv-edit-3d-canvas canvas')).toBeVisible();
  await page.locator('[data-ttv-support-scale]').fill('2');
  await expect(page.locator('[data-ttv-support-scale-output]')).toContainText('2.00');
  await expect.poll(async () => (await evidence(page)).supportScale).toBe(2);

  await page.locator('[data-ttv-edit-tool="MEASURE"]').click();
  await expect(page.locator('[data-ttv-edit-tool="MEASURE"]')).toHaveClass(/is-active/);
  await page.evaluate(() => {
    const edit = window.__topologyEditHarness.controller.edit;
    edit.addMeasurementPoint([0, 0, 0]);
    edit.addMeasurementPoint([3000, 4000, 0]);
  });
  await expect(page.locator('[data-ttv-measure-total]')).toHaveText('5.000 m');
  await expect(page.locator('[data-ttv-measure-segments]')).toContainText('S1');
  await page.locator('[data-ttv-measure-clear]').click();
  await page.locator('[data-ttv-edit-tool="SELECT"]').click();

  const nodeIds = base.baseArtifacts.canonicalTopology.nodes.map((node) => node.id);
  await selectRows(page, [{ kind: 'node', id: nodeIds[0] }]);
  await expect(page.locator('[data-ttv-edit-inspector]')).toContainText(nodeIds[0]);
  await expect(page.locator('.ttv-lineage-table')).toBeVisible();
  await expect(page.locator('.ttv-lineage-table')).toContainText('position.x');

  await page.locator('[data-ttv-edit-coordinate="x"]').fill('100');
  await page.locator('[data-ttv-edit-inspector-action="MOVE_EXACT"]').click();
  await expect.poll(async () => (await evidence(page)).draft.commands.length).toBe(1);
  const movedHash = (await evidence(page)).editedArtifacts.canonicalTopology.canonicalTopologyHash;
  const baseHash = (await evidence(page)).baseArtifacts.canonicalTopology.canonicalTopologyHash;
  expect(movedHash).not.toBe(baseHash);

  await page.locator('[data-ttv-edit-undo]').click();
  await expect.poll(async () => (await evidence(page)).editedArtifacts.canonicalTopology.canonicalTopologyHash).toBe(baseHash);
  await page.locator('[data-ttv-edit-redo]').click();
  await expect.poll(async () => (await evidence(page)).editedArtifacts.canonicalTopology.canonicalTopologyHash).toBe(movedHash);

  const edgeId = (await evidence(page)).editedArtifacts.canonicalTopology.edges[0].id;
  await selectRows(page, [{ kind: 'edge', id: edgeId }]);
  await page.locator('[data-ttv-edit-split-fraction]').fill('0.5');
  await page.locator('[data-ttv-edit-inspector-action="SPLIT"]').click();
  await expect.poll(async () => (await evidence(page)).editedArtifacts.canonicalTopology.edges.length).toBe(3);
  await expect(page.locator('[data-ttv-edit-export]')).toBeEnabled();

  // Multi-selection is preserved in the evidence and drives the inspector.
  await selectRows(page, [{ kind: 'node', id: nodeIds[0] }, { kind: 'node', id: nodeIds[1] }]);
  await expect.poll(async () => (await evidence(page)).selection.length).toBe(2);
  await page.locator('[data-ttv-nav-view="front"]').click();
  await expect.poll(async () => (await evidence(page)).projection).toBe('XZ');

  // Shared selection propagates to Trace and Parity surfaces.
  await selectRows(page, [{ kind: 'edge', id: edgeId }]);
  await page.evaluate((id) => {
    window.__topologyEditHarness.controller.synchronizeCanonicalSelection([{ kind: 'edge', id }], 'edit');
  }, edgeId);
  await page.locator('[data-ttv-workspace-tab="trace"]').click();
  await expect(page.locator('[data-ttv-workspace-panel="trace"]').locator(`[data-canonical-edge-id="${edgeId}"]`)).toHaveClass(/is-selected/);
  await page.locator('[data-ttv-workspace-tab="parity"]').click();
  await expect(page.locator(`[data-object-key="scene:edge:${edgeId}"]`).first()).toHaveClass(/is-selected/);
});

test('TTV-E02 — large-offset clicks cannot repivot or hide geometry; CAD navigation stays finite', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/tests/browser/topology-edit-draft-large-offset-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyEditFixtureReady === '1');
  await page.locator('[data-ttv-workspace-tab="edit"]').click();
  const canvas = page.locator('[data-ttv-edit-svg-host] .ttv-edit-3d-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.ttv-edit-view-cube')).toBeVisible();
  await expect(page.locator('.ttv-edit-navigation-dock')).toBeVisible();
  await page.waitForTimeout(400);

  const compactEvidence = () => page.evaluate(() => {
    const edit = window.__topologyEditHarness.controller.evidence().edit;
    return {
      commands: edit.draft.commands.length,
      topologyHash: edit.editedArtifacts.canonicalTopology.canonicalTopologyHash,
      navigation: edit.canvas.navigation,
      instances: edit.canvas.viewer.instanceCount,
      history: edit.canvas.viewer.navigationHistoryCount,
    };
  });
  const finite = (state) => [...state.cameraPositionWorld, ...state.cameraTargetWorld,
    ...(state.pivotWorld ?? []), state.projectionScale].every(Number.isFinite);
  const box = await canvas.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const initial = await compactEvidence();
  expect(finite(initial.navigation)).toBe(true);
  expect(initial.instances).toBeGreaterThan(0);

  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(250);
  const clicked = await compactEvidence();
  expect(clicked.commands).toBe(initial.commands);
  expect(clicked.topologyHash).toBe(initial.topologyHash);
  expect(clicked.navigation).toEqual(initial.navigation);

  await page.mouse.move(point.x + 12, point.y + 12);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(point.x + 16, point.y + 12);
  await page.mouse.up({ button: 'left' });
  const jittered = await compactEvidence();
  expect(jittered.commands).toBe(initial.commands);
  expect(jittered.navigation).toEqual(initial.navigation);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(point.x + 55, point.y + 24, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  const orbited = await compactEvidence();
  expect(orbited.commands).toBe(initial.commands);
  expect(orbited.topologyHash).toBe(initial.topologyHash);
  expect(orbited.navigation.cameraPositionWorld).not.toEqual(initial.navigation.cameraPositionWorld);
  expect(finite(orbited.navigation)).toBe(true);

  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(point.x + 25, point.y + 40, { steps: 3 });
  await page.keyboard.press('Escape');
  await page.mouse.up({ button: 'middle' });
  expect((await compactEvidence()).navigation).toEqual(orbited.navigation);

  const mappings = {
    Z: { top: [2, 1], bottom: [2, -1], front: [1, 1], back: [1, -1], left: [0, -1], right: [0, 1] },
    Y: { top: [1, 1], bottom: [1, -1], front: [2, 1], back: [2, -1], left: [0, -1], right: [0, 1] },
  };
  for (const [axis, views] of Object.entries(mappings)) {
    await page.locator('[data-ttv-vertical-axis]').selectOption(axis);
    await expect.poll(async () => (await compactEvidence()).navigation.verticalAxis).toBe(axis);
    for (const [view, [component, sign]] of Object.entries(views)) {
      await page.locator(`[data-ttv-nav-view="${view}"]`).click();
      await page.waitForTimeout(300);
      const navigation = (await compactEvidence()).navigation;
      const direction = navigation.cameraPositionWorld.map((value, index) => value - navigation.cameraTargetWorld[index]);
      expect(Math.sign(direction[component])).toBe(sign);
      expect(finite(navigation)).toBe(true);
    }
    await page.locator('[data-ttv-nav-view="iso"]').click();
    await page.waitForTimeout(300);
    expect(finite((await compactEvidence()).navigation)).toBe(true);
  }

  const beforeProjection = await compactEvidence();
  await page.locator('[data-ttv-nav-action="camera"]').click();
  const afterProjection = await compactEvidence();
  expect(afterProjection.navigation.cameraType).not.toBe(beforeProjection.navigation.cameraType);
  expect(afterProjection.commands).toBe(initial.commands);
  expect(afterProjection.history).toBeLessThanOrEqual(20);
  expect(afterProjection.instances).toBeGreaterThan(0);
  for (const action of ['select', 'orbit', 'rotate']) {
    const button = page.locator(`[data-ttv-nav-action="${action}"]`);
    await expect(button).toBeVisible();
    await expect(button.locator('img')).toHaveJSProperty('naturalWidth', 24);
  }
  await page.locator('[data-ttv-edit-tool="MOVE"]').click();
  await page.locator('[data-ttv-nav-action="select"]').click();
  await expect(page.locator('[data-ttv-edit-tool="SELECT"]')).toHaveClass(/is-active/);
  const beforeIconOrbit = await compactEvidence();
  await page.locator('[data-ttv-nav-action="orbit"]').click();
  const afterIconOrbit = await compactEvidence();
  expect(afterIconOrbit.navigation.cameraPositionWorld).not.toEqual(beforeIconOrbit.navigation.cameraPositionWorld);
  expect(afterIconOrbit.commands).toBe(initial.commands);
  await page.locator('[data-ttv-nav-action="rotate"]').click();
  const afterIconRotate = await compactEvidence();
  expect(afterIconRotate.navigation.cameraPositionWorld).not.toEqual(afterIconOrbit.navigation.cameraPositionWorld);
  expect(finite(afterIconRotate.navigation)).toBe(true);
  expect(afterIconRotate.commands).toBe(initial.commands);
  const beforeMoveNavigation = afterIconRotate.navigation;
  await page.evaluate(async () => {
    const edit = window.__topologyEditHarness.controller.edit;
    const node = edit.evidence().editedArtifacts.canonicalTopology.nodes[0];
    await edit.executeCommand('MOVE_NODE', {
      nodeId: node.id, position: { x: node.position.x + 10, y: node.position.y, z: node.position.z },
    });
  });
  await expect.poll(async () => (await compactEvidence()).commands).toBe(initial.commands + 1);
  await page.waitForTimeout(300);
  expect((await compactEvidence()).navigation).toEqual(beforeMoveNavigation);
  expect(pageErrors).toEqual([]);
});

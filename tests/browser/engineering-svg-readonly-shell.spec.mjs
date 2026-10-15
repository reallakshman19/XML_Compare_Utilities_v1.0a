import { expect, test } from '@playwright/test';

async function openFixture(page) {
  await page.goto('/tests/browser/engineering-svg-readonly-shell-fixture.html');
  await page.waitForFunction(() => Boolean(globalThis.__engineeringSvgReadOnlyShellFixture));
}

function viewer(page, id = 'viewer-a') {
  return page.locator(`[data-engineering-svg-shell="${id}"]`);
}

function property(root, key) {
  return root.locator(`[data-engineering-svg-property-key="${key}"]`);
}

async function setHistorySelection(page, ids) {
  await page.evaluate((selectedIds) => {
    globalThis.__engineeringSvgReadOnlyShellFixture.history.shell.setSelection(selectedIds, 'browser-certification');
  }, ids);
}

test('ESVG-READONLY-B01 mounts a viewer with output-only properties and no draft path', async ({ page }) => {
  await openFixture(page);
  const root = viewer(page);
  await expect(root).toHaveAttribute('data-engineering-svg-shell-access', 'read-only');
  await expect(root).toHaveAttribute('aria-label', 'Engineering SVG viewer');
  await root.locator('[data-engineering-svg-entity-id="a"]').click();
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('a');
  await expect(property(root, 'label').locator('output')).toHaveText('viewer-a-A');
  await expect(property(root, 'pressure').locator('output')).toHaveText('10 bar');
  await expect(property(root, 'material').locator('output')).toHaveText('A106');
  await expect(root.locator('input[data-engineering-svg-property-control]')).toHaveCount(0);
  await expect(root.locator('select[data-engineering-svg-property-control]')).toHaveCount(0);
  await expect(root.locator('[data-engineering-svg-apply]')).toBeDisabled();
  await expect(root.locator('[data-engineering-svg-cancel]')).toBeDisabled();
  const result = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.shell.apply());
  expect(result).toBeNull();
  await expect(root.locator('[data-engineering-svg-shell-status]')).toHaveAttribute('data-engineering-svg-shell-state', 'read-only');
  const draft = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.shell.draftStore.getSnapshot());
  expect(draft.operationId).toBeNull();
});

test('ESVG-READONLY-B02 keyboard selection and scene refresh preserve selection and revision', async ({ page }) => {
  await openFixture(page);
  const root = viewer(page);
  const entityB = root.locator('[data-engineering-svg-entity-id="b"]');
  await entityB.focus();
  await entityB.press(' ');
  await expect(entityB).toHaveAttribute('aria-selected', 'true');
  await expect(root.locator('[data-engineering-svg-inspector-heading]')).toContainText('b');
  await expect(property(root, 'revision').locator('output')).toHaveText('1');
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.bumpSceneRevision());
  await expect(entityB).toHaveAttribute('aria-selected', 'true');
  await expect(property(root, 'revision').locator('output')).toHaveText('2');
  const draft = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.domainA.shell.draftStore.getSnapshot());
  expect(draft.operationId).toBeNull();
});

test('ESVG-READONLY-B03 access-mode mismatches fail deterministically', async ({ page }) => {
  await openFixture(page);
  const errors = await page.evaluate(async () => {
    const runtime = await import('/core/engineering-svg/shell-runtime.js');
    const domain = globalThis.__engineeringSvgReadOnlyShellFixture.domainA;
    const dependencies = domain.bridge.getDependencies();
    const makeHost = () => document.createElement('div');
    const messages = [];
    try {
      runtime.createEngineeringSvgWorkspaceShellFromAdapterBridge({
        bridge: domain.bridge, accessMode: 'editable', shellId: 'mismatch', host: makeHost(),
      });
    } catch (error) { messages.push(String(error.message)); }
    try {
      runtime.createEngineeringSvgWorkspaceShell({
        accessMode: 'read-only', shellId: 'read-only-gateway', host: makeHost(),
        sceneSource: dependencies.sceneSource, propertyProvider: dependencies.propertyProvider,
        commandGateway: { execute: () => null },
      });
    } catch (error) { messages.push(String(error.message)); }
    try {
      runtime.createEngineeringSvgWorkspaceShell({
        accessMode: 'editable', shellId: 'editable-no-gateway', host: makeHost(),
        sceneSource: dependencies.sceneSource, propertyProvider: dependencies.propertyProvider,
      });
    } catch (error) { messages.push(String(error.message)); }
    return messages;
  });
  expect(errors).toEqual([
    'Engineering SVG shell access mode must match the adapter descriptor.',
    'Read-only engineering SVG shell cannot expose a commandGateway.',
    'Editable engineering SVG shell requires a commandGateway.',
  ]);
});

test('ESVG-PROP-B06 previous/current property evidence', async ({ page }) => {
  await openFixture(page);
  const root = viewer(page, 'viewer-history');
  await root.locator('[data-engineering-svg-entity-id="changed"]').click();
  const pressure = property(root, 'pressure');
  await expect(pressure).toHaveAttribute('data-engineering-svg-property-comparison', 'changed');
  await expect(pressure.getByText('Previous', { exact: true })).toBeVisible();
  await expect(pressure.getByText('Current', { exact: true })).toBeVisible();
  await expect(pressure.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('10 bar');
  await expect(pressure.locator('[data-engineering-svg-property-current] > output').first()).toHaveText('12 bar');
  await expect(pressure.locator('[data-engineering-svg-property-previous] input, [data-engineering-svg-property-previous] select')).toHaveCount(0);

  await root.locator('[data-engineering-svg-entity-id="unchanged"]').click();
  const status = property(root, 'status');
  await expect(status).toHaveAttribute('data-engineering-svg-property-comparison', 'unchanged');
  await expect(status.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('Ready');
  await expect(status.locator('[data-engineering-svg-property-current] > output').first()).toHaveText('Ready');

  await root.locator('[data-engineering-svg-entity-id="explicit-null"]').click();
  const comment = property(root, 'comment');
  await expect(comment).toHaveAttribute('data-engineering-svg-property-comparison', 'changed');
  await expect(comment.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('—');
  await expect(comment.locator('[data-engineering-svg-property-current] > output').first()).toHaveText('Current 1');

  await root.locator('[data-engineering-svg-entity-id="legacy"]').click();
  const legacy = property(root, 'legacyNote');
  await expect(legacy).toHaveAttribute('data-engineering-svg-property-comparison', 'not-applicable');
  await expect(legacy.locator('[data-engineering-svg-property-previous]')).toHaveCount(0);
  await expect(legacy.locator('[data-engineering-svg-property-current]')).toHaveCount(0);
  await expect(legacy.locator('output')).toHaveText('Legacy 1');

  await setHistorySelection(page, ['uniform-a', 'uniform-b']);
  let temperature = property(root, 'temperature');
  await expect(temperature.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('100 °C');
  await expect(temperature.locator('[data-engineering-svg-property-current] > output').first()).toHaveText('110 °C');
  await expect(temperature).toHaveAttribute('data-engineering-svg-property-comparison', 'changed');

  await setHistorySelection(page, ['mixed-a', 'mixed-b']);
  temperature = property(root, 'temperature');
  await expect(temperature.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('Mixed');
  await expect(temperature).toHaveAttribute('data-engineering-svg-property-comparison', 'mixed');

  await setHistorySelection(page, ['unavailable-a', 'unavailable-b']);
  temperature = property(root, 'temperature');
  await expect(temperature.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('Unavailable for full selection');
  await expect(temperature).toHaveAttribute('data-engineering-svg-property-comparison', 'unavailable');

  await setHistorySelection(page, ['changed']);
  await expect(property(root, 'pressure').locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('10 bar');
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.bumpProviderRevision());
  await expect(property(root, 'pressure').locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('20 bar');
  await expect(property(root, 'pressure').locator('[data-engineering-svg-property-current] > output').first()).toHaveText('22 bar');

  const readOnlyEvidence = await page.evaluate(async () => {
    const history = globalThis.__engineeringSvgReadOnlyShellFixture.history;
    return {
      applyResult: await history.shell.apply(),
      commandGateway: history.bridge.getDependencies().commandGateway,
      draft: history.shell.draftStore.getSnapshot(),
    };
  });
  expect(readOnlyEvidence.applyResult).toBeNull();
  expect(readOnlyEvidence.commandGateway).toBeNull();
  expect(readOnlyEvidence.draft.operationId).toBeNull();

  const keyboardEntity = root.locator('[data-engineering-svg-entity-id="unchanged"]');
  await keyboardEntity.focus();
  await keyboardEntity.press(' ');
  await expect(keyboardEntity).toHaveAttribute('aria-selected', 'true');
  await expect(property(root, 'status')).toHaveAttribute('data-engineering-svg-property-comparison', 'unchanged');

  const before = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.listenerCounts());
  expect(before).toEqual({ scene: 1, property: 1 });
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.destroy());
  await expect(root).toHaveCount(0);
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.mount());
  const remounted = viewer(page, 'viewer-history');
  await expect(remounted).toHaveCount(1);
  await expect(remounted.locator('[data-engineering-svg-inspector-actions]')).toHaveCount(1);
  await expect(remounted.locator('[data-engineering-svg-root]')).toHaveCount(1);
  const after = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.listenerCounts());
  expect(after).toEqual({ scene: 1, property: 1 });
});

test('ESVG-PROP-B07 — Previous/Current provenance evidence', async ({ page }) => {
  await openFixture(page);
  const root = viewer(page, 'viewer-history');
  await root.locator('[data-engineering-svg-entity-id="changed"]').click();
  let pressure = property(root, 'pressure');
  const previousSource = pressure.locator('[data-engineering-svg-property-previous-source]');
  const currentSource = pressure.locator('[data-engineering-svg-property-current-source]');
  await expect(pressure.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('10 bar');
  await expect(pressure.locator('[data-engineering-svg-property-current] > output').first()).toHaveText('12 bar');
  expect(await previousSource.textContent()).toBe('Source:  /sources/previous/pressure.xml#/P-1 ');
  expect(await currentSource.textContent()).toBe('Source:  /sources/current/pressure.xml#/P-1 ');
  await expect(previousSource).toHaveAttribute('data-engineering-svg-property-provenance-state', 'uniform');
  await expect(currentSource).toHaveAttribute('data-engineering-svg-property-provenance-state', 'uniform');
  await expect(pressure.locator('[data-engineering-svg-property-previous-source] input, [data-engineering-svg-property-previous-source] button, [data-engineering-svg-property-previous-source] a')).toHaveCount(0);
  await expect(pressure.locator('[data-engineering-svg-property-current-source] input, [data-engineering-svg-property-current-source] button, [data-engineering-svg-property-current-source] a')).toHaveCount(0);

  await root.locator('[data-engineering-svg-entity-id="unchanged"]').click();
  const status = property(root, 'status');
  await expect(status.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: model://status/shared');
  await expect(status.locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: model://status/shared');

  await root.locator('[data-engineering-svg-entity-id="explicit-null"]').click();
  const comment = property(root, 'comment');
  await expect(comment.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: Explicitly unavailable');
  await expect(comment.locator('[data-engineering-svg-property-previous-source]')).toHaveAttribute('data-engineering-svg-property-provenance-state', 'uniform');

  await root.locator('[data-engineering-svg-entity-id="previous-source-absent"]').click();
  const flow = property(root, 'flow');
  await expect(flow.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: Not supplied');
  await expect(flow.locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: model://flow/current');

  await root.locator('[data-engineering-svg-entity-id="current-source-null"]').click();
  const density = property(root, 'density');
  await expect(density.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: model://density/previous');
  await expect(density.locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: Not supplied');

  await root.locator('[data-engineering-svg-entity-id="legacy"]').click();
  const legacy = property(root, 'legacyNote');
  await expect(legacy.locator('[data-engineering-svg-property-previous-source]')).toHaveCount(0);
  await expect(legacy.locator('[data-engineering-svg-property-current-source]')).toHaveCount(0);
  await expect(legacy.locator('[data-engineering-svg-property-previous]')).toHaveCount(0);
  await expect(legacy.locator('output')).toHaveText('Legacy 1');

  await setHistorySelection(page, ['uniform-a', 'uniform-b']);
  let temperature = property(root, 'temperature');
  await expect(temperature.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: model://temperature/previous/common');
  await expect(temperature.locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: model://temperature/current/common');
  await expect(temperature).toHaveAttribute('data-engineering-svg-property-provenance-state', 'uniform');

  await setHistorySelection(page, ['mixed-a', 'mixed-b']);
  temperature = property(root, 'temperature');
  await expect(temperature.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: Mixed');
  await expect(temperature.locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: Mixed');
  await expect(temperature).toHaveAttribute('data-engineering-svg-property-provenance-state', 'mixed');

  await setHistorySelection(page, ['unavailable-a', 'unavailable-b']);
  temperature = property(root, 'temperature');
  await expect(temperature.locator('[data-engineering-svg-property-previous-source]')).toHaveText('Source: Unavailable for full selection');
  await expect(temperature.locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: Unavailable for full selection');
  await expect(temperature).toHaveAttribute('data-engineering-svg-property-provenance-state', 'unavailable');

  await setHistorySelection(page, ['changed']);
  pressure = property(root, 'pressure');
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.bumpProviderRevision());
  await expect(pressure.locator('[data-engineering-svg-property-previous] > output').first()).toHaveText('20 bar');
  await expect(pressure.locator('[data-engineering-svg-property-current] > output').first()).toHaveText('22 bar');
  expect(await pressure.locator('[data-engineering-svg-property-previous-source]').textContent()).toBe('Source:  /sources/previous/pressure-r2.xml#/P-1 ');
  expect(await pressure.locator('[data-engineering-svg-property-current-source]').textContent()).toBe('Source:  /sources/current/pressure-r2.xml#/P-1 ');

  const readOnly = await page.evaluate(async () => {
    const history = globalThis.__engineeringSvgReadOnlyShellFixture.history;
    return {
      applyResult: await history.shell.apply(),
      draft: history.shell.draftStore.getSnapshot(),
      commandGateway: history.bridge.getDependencies().commandGateway,
    };
  });
  expect(readOnly.applyResult).toBeNull();
  expect(readOnly.commandGateway).toBeNull();
  expect(readOnly.draft.operationId).toBeNull();
  expect(readOnly.draft.properties).toEqual({});

  const keyboardEntity = root.locator('[data-engineering-svg-entity-id="unchanged"]');
  await keyboardEntity.focus();
  await keyboardEntity.press('Enter');
  await expect(keyboardEntity).toHaveAttribute('aria-selected', 'true');
  await expect(property(root, 'status').locator('[data-engineering-svg-property-current-source]')).toHaveText('Source: model://status/shared');

  const before = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.listenerCounts());
  expect(before).toEqual({ scene: 1, property: 1 });
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.destroy());
  await expect(root).toHaveCount(0);
  await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.mount());
  const remounted = viewer(page, 'viewer-history');
  await expect(remounted).toHaveCount(1);
  await expect(remounted.locator('[data-engineering-svg-property-rows]')).toHaveCount(1);
  await expect(remounted.locator('[data-engineering-svg-inspector-actions]')).toHaveCount(1);
  const after = await page.evaluate(() => globalThis.__engineeringSvgReadOnlyShellFixture.history.listenerCounts());
  expect(after).toEqual({ scene: 1, property: 1 });
});

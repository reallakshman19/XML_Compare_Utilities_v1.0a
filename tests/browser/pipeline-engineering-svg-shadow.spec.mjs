import { expect, test } from '@playwright/test';

const REQUIRED_CATEGORIES = [
  'routeSegments',
  'routeVertices',
  'gradeEvents',
  'depthEvents',
  'markers',
  'referenceEvents',
];
const PROCESS_KEYS = ['p1', 't1', 't2', 't3', 'fluidDensity', 'materialCode', 'insulationDensity', 'hydroPressure'];

async function openFixture(page) {
  await page.goto('/tests/browser/pipeline-engineering-svg-shadow-fixture.html');
  await page.waitForFunction(() => Boolean(globalThis.__pipelineEngineeringSvgShadowFixture));
}

async function requireMounted(page) {
  const state = await page.evaluate(() => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    return { initializationError: fixture.initializationError, mounted: Boolean(fixture.workspace) };
  });
  expect(state.initializationError, 'marker-rich Pipeline adapter initialization').toBe('');
  expect(state.mounted).toBe(true);
}

function shell(page) {
  return page.locator('[data-engineering-svg-shell="pipeline-shadow-shell"]');
}

function property(root, key) {
  return root.locator(`[data-engineering-svg-property-key="${key}"] output`);
}

function display(value, unit = '') {
  if (value == null || value === '') return '—';
  return `${value}${unit ? ` ${unit}` : ''}`;
}

async function categoryEntity(page, category) {
  return page.evaluate(async (name) => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const entity = scene.entities.find((value) => value.domainRef.category === name);
    return entity ? JSON.parse(JSON.stringify(entity)) : null;
  }, category);
}

test('PCAD-ESVG-SHADOW-B01 real fixture mount and complete parity', async ({ page }) => {
  await openFixture(page);
  await requireMounted(page);
  const root = shell(page);
  await expect(root).toHaveAttribute('data-engineering-svg-shell-access', 'read-only');
  await expect(root).toHaveAttribute('aria-label', 'Pipeline engineering read-only viewer');
  await expect(page.locator('[data-pipeline-coordinate-evidence]')).toHaveCount(1);

  const evidence = await page.evaluate(async () => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const parity = fixture.workspace.getParityReport();
    const output = fixture.snapshot.output;
    const samePoint = (left, right) => left && right
      && left.x === right.x && left.y === right.y && left.z === right.z;
    const pointEntities = scene.entities.filter((entity) => entity.geometry.kind === 'point')
      .sort((left, right) => left.metadata.pipeline.sourceIndex - right.metadata.pipeline.sourceIndex);
    const segmentEntities = scene.entities.filter((entity) => entity.geometry.kind === 'segment')
      .sort((left, right) => left.metadata.pipeline.sourceIndex - right.metadata.pipeline.sourceIndex);
    const sceneIds = scene.entities.map((entity) => entity.id).sort();
    const renderedIds = [...document.querySelectorAll('#shadow [data-engineering-svg-entity-id]')]
      .map((node) => node.getAttribute('data-engineering-svg-entity-id')).sort();
    return {
      parity,
      coordinateSystem: scene.coordinateSystem,
      entityCount: fixture.workspace.shell.workspace.getEntityCount(),
      evidenceRows: document.querySelectorAll('[data-pipeline-coordinate-node]').length,
      sceneIds,
      renderedIds,
      categories: await fixture.categoryIds(),
      rowsExact: pointEntities.length === output.coordinateRows.length
        && pointEntities.every((entity, index) => samePoint(entity.geometry.position, output.coordinateRows[index])),
      segmentsExact: segmentEntities.length === output.inputXmlCoordinateRows.length - 1
        && segmentEntities.every((entity, index) => samePoint(entity.geometry.start, output.inputXmlCoordinateRows[index])
          && samePoint(entity.geometry.end, output.inputXmlCoordinateRows[index + 1])),
      continuityExact: segmentEntities.every((entity, index) => index === 0
        || samePoint(segmentEntities[index - 1].geometry.end, entity.geometry.start)),
      ownerEvidenceExact: pointEntities.every((entity) => entity.metadata.pipeline.elevationAuthority === 'TABLE_2'),
      noDisplayCoordinates: !/(screen|canvas|pixel)(X|Y|Coordinate)?/i.test(JSON.stringify(scene.entities)),
      outputRows: output.coordinateRows.length,
    };
  });

  console.log('Pipeline shadow parity', JSON.stringify({
    totals: { expected: evidence.parity.totalExpected, mapped: evidence.parity.totalMapped },
    categories: evidence.parity.mappedByCategory,
  }));
  expect(evidence.parity.passed).toBe(true);
  expect(evidence.entityCount).toBe(evidence.parity.totalMapped);
  expect(evidence.evidenceRows).toBe(evidence.outputRows);
  expect(evidence.sceneIds).toEqual(evidence.renderedIds);
  for (const category of REQUIRED_CATEGORIES) {
    expect(evidence.categories[category].length).toBeGreaterThan(0);
    expect(evidence.parity.mappedByCategory[category]).toBe(evidence.categories[category].length);
  }
  for (const key of ['omittedEntities', 'duplicateIds', 'invalidCoordinates', 'unresolvedReferences',
    'routeDiscontinuities', 'coordinateRowMismatches', 'inputXmlMismatches', 'propertyCoverageGaps']) {
    expect(evidence.parity[key]).toEqual([]);
  }
  expect(evidence.coordinateSystem).toMatchObject({ unit: 'mm', verticalAxis: 'Z', frame: 'GLOBAL' });
  expect(evidence.rowsExact).toBe(true);
  expect(evidence.segmentsExact).toBe(true);
  expect(evidence.continuityExact).toBe(true);
  expect(evidence.ownerEvidenceExact).toBe(true);
  expect(evidence.noDisplayCoordinates).toBe(true);
  await expect(root.locator('input, select, textarea')).toHaveCount(0);
});

test('PCAD-ESVG-SHADOW-B02 exact route, node and marker property evidence', async ({ page }) => {
  await openFixture(page);
  await requireMounted(page);
  const root = shell(page);
  const segment = await categoryEntity(page, 'routeSegments');
  await root.locator(`[data-engineering-svg-entity-id="${segment.id}"]`).dispatchEvent('click');
  const segmentEvidence = segment.metadata.pipeline;
  await expect(property(root, 'entityId')).toHaveText(segment.id);
  await expect(property(root, 'fromNode')).toHaveText(display(segmentEvidence.fromNode));
  await expect(property(root, 'toNode')).toHaveText(display(segmentEvidence.toNode));
  for (const [key, value] of Object.entries({
    startX: segmentEvidence.start.x, startY: segmentEvidence.start.y, startZ: segmentEvidence.start.z,
    endX: segmentEvidence.end.x, endY: segmentEvidence.end.y, endZ: segmentEvidence.end.z,
    deltaX: segmentEvidence.delta.x, deltaY: segmentEvidence.delta.y, deltaZ: segmentEvidence.delta.z,
  })) await expect(property(root, key)).toHaveText(display(value, 'mm'));
  await expect(property(root, 'inputXmlElement')).toHaveText(display(segmentEvidence.xmlElement.elementNumber));

  const node = await categoryEntity(page, 'routeVertices');
  const nodeElement = root.locator(`[data-engineering-svg-entity-id="${node.id}"]`);
  await nodeElement.focus();
  await nodeElement.press('Enter');
  await expect(nodeElement).toHaveAttribute('aria-selected', 'true');
  const nodeEvidence = node.metadata.pipeline;
  await expect(property(root, 'entityId')).toHaveText(node.id);
  await expect(property(root, 'nodeNumber')).toHaveText(display(nodeEvidence.nodeNumber));
  await expect(property(root, 'nodeName')).toHaveText(display(nodeEvidence.nodeName));
  await expect(property(root, 'X')).toHaveText(display(nodeEvidence.point.x, 'mm'));
  await expect(property(root, 'Y')).toHaveText(display(nodeEvidence.point.y, 'mm'));
  await expect(property(root, 'Z')).toHaveText(display(nodeEvidence.point.z, 'mm'));
  await expect(property(root, 'station')).toHaveText(display(nodeEvidence.horizontal, 'm'));
  await expect(property(root, 'gradeElevation')).toHaveText(display(nodeEvidence.grade, 'm'));
  await expect(property(root, 'elevationAuthority')).toHaveText('TABLE_2');
  await expect(property(root, 'eventSources')).toHaveText(nodeEvidence.eventSources.join(', '));

  const marker = await categoryEntity(page, 'markers');
  await root.locator(`[data-engineering-svg-entity-id="${marker.id}"]`).dispatchEvent('click');
  const markerEvidence = marker.metadata.pipeline;
  await expect(property(root, 'entityId')).toHaveText(marker.id);
  await expect(property(root, 'X')).toHaveText(display(markerEvidence.point.x, 'mm'));
  await expect(property(root, 'Y')).toHaveText(display(markerEvidence.point.y, 'mm'));
  await expect(property(root, 'Z')).toHaveText(display(markerEvidence.point.z, 'mm'));
  await expect(property(root, 'eventSources')).toHaveText(markerEvidence.eventSources.join(', '));
  await expect(property(root, 'markerEvidence')).toHaveText(JSON.stringify(markerEvidence.markerEvidence));
});

test('PCAD-ESVG-SHADOW-B03 read-only scene and process-scope boundaries', async ({ page }) => {
  await openFixture(page);
  await requireMounted(page);
  const root = shell(page);
  const segment = await categoryEntity(page, 'routeSegments');
  await root.locator(`[data-engineering-svg-entity-id="${segment.id}"]`).dispatchEvent('click');
  await expect(property(root, 'p1')).toHaveText('55');

  const evidence = await page.evaluate(async (entityId) => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const sets = await fixture.workspace.adapter.propertyProvider.getPropertySets([entityId], scene.revision);
    const sceneSet = sets.find((set) => set.ownerIds.includes(scene.sceneId));
    const entitySets = sets.filter((set) => !set.ownerIds.includes(scene.sceneId));
    return {
      accessMode: fixture.workspace.adapter.descriptor.accessMode,
      editing: fixture.workspace.adapter.descriptor.capabilities.editing,
      commandGateway: fixture.workspace.adapter.commandGateway,
      snapCount: fixture.workspace.adapter.snapProviders.length,
      sceneScopes: sceneSet.fields.map((field) => field.scope),
      sceneKeys: sceneSet.fields.map((field) => field.key),
      entityScopes: entitySets.flatMap((set) => set.fields.map((field) => field.scope)),
      entityKeys: entitySets.flatMap((set) => set.fields.map((field) => field.key)),
      applyResult: await fixture.workspace.shell.apply(),
      draft: fixture.workspace.shell.draftStore.getSnapshot(),
      mutationCount: fixture.mutationCount(),
    };
  }, segment.id);
  expect(evidence.accessMode).toBe('read-only');
  expect(evidence.editing).toBe(false);
  expect(evidence.commandGateway).toBeNull();
  expect(evidence.snapCount).toBe(0);
  expect(new Set(evidence.sceneScopes)).toEqual(new Set(['SCENE']));
  expect(new Set(evidence.entityScopes)).toEqual(new Set(['ENTITY']));
  for (const key of PROCESS_KEYS) {
    expect(evidence.sceneKeys).toContain(key);
    expect(evidence.entityKeys).not.toContain(key);
  }
  expect(evidence.applyResult).toBeNull();
  expect(evidence.draft.operationId).toBeNull();
  expect(evidence.mutationCount).toBe(0);
  await expect(root.locator('[data-engineering-svg-apply]')).toBeDisabled();
  await expect(root.locator('input, select, textarea')).toHaveCount(0);
});

test('PCAD-ESVG-SHADOW-B04 revision refresh and projection invariance', async ({ page }) => {
  await openFixture(page);
  await requireMounted(page);
  const root = shell(page);
  const segment = await categoryEntity(page, 'routeSegments');
  await root.locator(`[data-engineering-svg-entity-id="${segment.id}"]`).dispatchEvent('click');
  await expect(property(root, 'entityId')).toHaveText(segment.id);

  const evidence = await page.evaluate(async () => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    const beforeScene = await fixture.workspace.adapter.getScene();
    const beforeLedger = fixture.geometryLedger(beforeScene);
    const beforeProjected = fixture.workspace.shell.workspace.render();
    const beforeRevision = beforeScene.revision;
    fixture.emitOwnerUpdate();
    await fixture.workspace.shell.refreshProperties('owner-update-proof');
    const afterScene = await fixture.workspace.adapter.getScene();
    const afterProjected = fixture.workspace.shell.workspace.render();
    const ledgers = {};
    for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) {
      fixture.workspace.shell.workspace.setProjection(projection);
      ledgers[projection] = fixture.geometryLedger(await fixture.workspace.adapter.getScene());
    }
    const inspector = fixture.workspace.shell.getInspectorModel();
    return {
      beforeLedger,
      afterLedger: fixture.geometryLedger(afterScene),
      ledgers,
      beforeRevision,
      afterRevision: afterScene.revision,
      beforeFit: beforeProjected.fit,
      afterFit: afterProjected.fit,
      selection: fixture.workspace.shell.getSelection(),
      inspectorEntityId: inspector.rows.find((row) => row.key === 'entityId')?.display?.value,
      pressure: inspector.rows.find((row) => row.key === 'p1')?.display?.value,
      finalProjection: fixture.workspace.shell.workspace.getProjection(),
      listenerCount: fixture.listenerCount(),
      mutationCount: fixture.mutationCount(),
    };
  });
  expect(evidence.afterRevision).not.toEqual(evidence.beforeRevision);
  expect(evidence.afterLedger).toEqual(evidence.beforeLedger);
  for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) expect(evidence.ledgers[projection]).toEqual(evidence.beforeLedger);
  expect(evidence.beforeFit).toEqual(evidence.afterFit);
  expect(evidence.selection).toEqual([segment.id]);
  expect(evidence.inspectorEntityId).toBe(segment.id);
  expect(evidence.pressure).toBe('56');
  expect(evidence.finalProjection).toBe('YZ');
  expect(evidence.listenerCount).toBe(1);
  expect(evidence.mutationCount).toBe(0);
  await expect(root.locator(`[data-engineering-svg-entity-id="${segment.id}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(property(root, 'p1')).toHaveText('56');
});

test('PCAD-ESVG-SHADOW-B05 deterministic failure, destroy and remount', async ({ page }) => {
  await openFixture(page);
  await requireMounted(page);
  expect(await page.evaluate(() => globalThis.__pipelineEngineeringSvgShadowFixture.listenerCount())).toBe(1);
  const failures = await page.evaluate(async () => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    return {
      missingShell: await fixture.attemptInvalidMount('missing-shell-id'),
      missingRevision: await fixture.attemptInvalidMount('missing-revision'),
    };
  });
  expect(failures.missingShell.message).toContain('requires shellId');
  expect(failures.missingRevision.message).toContain('requires revision');
  expect(failures.missingShell.shellCount).toBe(0);
  expect(failures.missingRevision.shellCount).toBe(0);

  const destroyed = await page.evaluate(() => {
    const fixture = globalThis.__pipelineEngineeringSvgShadowFixture;
    const previous = fixture.workspace;
    const results = [fixture.destroy(), fixture.destroy()];
    let bridgeDisposed = false;
    try { previous.bridge.getDependencies(); } catch { bridgeDisposed = true; }
    return { results, bridgeDisposed, shellDestroyAgain: previous.shell.destroy() };
  });
  expect(destroyed).toEqual({ results: [true, false], bridgeDisposed: true, shellDestroyAgain: false });
  await expect(shell(page)).toHaveCount(0);
  await expect(page.locator('#shadow [data-engineering-svg-root]')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__pipelineEngineeringSvgShadowFixture.listenerCount())).toBe(0);

  await page.evaluate(() => globalThis.__pipelineEngineeringSvgShadowFixture.mount());
  await expect(shell(page)).toHaveCount(1);
  await expect(page.locator('#shadow [data-engineering-svg-root]')).toHaveCount(1);
  expect(await page.evaluate(() => globalThis.__pipelineEngineeringSvgShadowFixture.listenerCount())).toBe(1);
  const bridgeState = await page.evaluate(() => globalThis.__pipelineEngineeringSvgShadowFixture.workspace.bridge.getLastRejectedEvent());
  expect(bridgeState).toBeNull();
});

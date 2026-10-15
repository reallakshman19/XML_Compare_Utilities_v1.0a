import { expect, test } from '@playwright/test';

const CATEGORY_NAMES = [
  'sourceComponents',
  'sourcePorts',
  'canonicalNodes',
  'canonicalEdges',
  'pointFeatures',
  'junctions',
  'boundaries',
];

async function openFixture(page) {
  await page.goto('/tests/browser/topology-engineering-svg-shadow-fixture.html');
  await page.waitForFunction(() => Boolean(globalThis.__topologyEngineeringSvgShadowFixture));
}

function shell(page) {
  return page.locator('[data-engineering-svg-shell="ttv-shadow-shell"]');
}

function property(root, key) {
  return root.locator(`[data-engineering-svg-property-key="${key}"] output`);
}

test('TTV-ESVG-SHADOW-B01 mounts real fixture with complete parity and exact geometry', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await expect(root).toHaveAttribute('data-engineering-svg-shell-access', 'read-only');
  await expect(root).toHaveAttribute('aria-label', 'Topology Trace engineering viewer');
  await expect(page.locator('#legacy svg.ttv-svg[data-view-model-schema]')).toHaveCount(1);
  const evidence = await page.evaluate(async () => {
    const fixture = globalThis.__topologyEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const view = fixture.viewModel();
    const parity = fixture.workspace.getParityReport();
    const samePoint = (left, right) => left.x === right.x && left.y === right.y && left.z === right.z;
    const entityById = new Map(scene.entities.map((entity) => [entity.id, entity]));
    const componentByKey = new Map(view.sourceComponents.map((component) => [component.objectKey, component]));
    const nodeById = new Map(view.canonicalNodes.map((node) => [node.id, node]));
    const pointGeometryMatches = (records) => records.every((record) => (
      samePoint(entityById.get(record.objectKey).geometry.position, record.position)
    ));
    const sourcePipe = scene.entities.find((entity) => entity.domainRef.sourceEntityId === 'SRC-PIPE-1');
    const pipeOwner = view.sourceComponents.find((component) => component.sourceEntityId === 'SRC-PIPE-1');
    const bend = scene.entities.find((entity) => entity.domainRef.sourceEntityId === 'SRC-BEND');
    const bendOwner = view.sourceComponents.find((component) => component.sourceEntityId === 'SRC-BEND');
    const sourcePort = scene.entities.find((entity) => entity.id.endsWith(':port:A'));
    const portOwner = componentByKey.get(sourcePort.id.slice(0, sourcePort.id.lastIndexOf(':port:')));
    return {
      parity,
      entityCount: fixture.workspace.shell.workspace.getEntityCount(),
      idsStable: scene.entities.every((entity) => entity.id === entity.domainRef.objectKey),
      legacyMarkupStable: fixture.legacyMarkupBeforeShadow === fixture.buildLegacyMarkup(),
      sourcePipeExact: samePoint(sourcePipe.geometry.start, pipeOwner.positions.APOS)
        && samePoint(sourcePipe.geometry.end, pipeOwner.positions.LPOS),
      bendExact: bend.geometry.points.every((point, index) => samePoint(
        point,
        [bendOwner.positions.APOS, bendOwner.positions.POS, bendOwner.positions.LPOS][index],
      )),
      sourcePortExact: samePoint(sourcePort.geometry.position, portOwner.positions.APOS),
      canonicalNodesExact: view.canonicalNodes.every((node) => samePoint(entityById.get(node.objectKey).geometry.position, node.position)),
      canonicalEdgesExact: view.canonicalEdges.every((edge) => {
        const geometry = entityById.get(edge.objectKey).geometry;
        return samePoint(geometry.start, nodeById.get(edge.fromNodeId).position)
          && samePoint(geometry.end, nodeById.get(edge.toNodeId).position);
      }),
      pointFeaturesExact: pointGeometryMatches(view.pointFeatures),
      junctionsExact: pointGeometryMatches(view.junctions),
      boundariesExact: pointGeometryMatches(view.boundaries),
    };
  });
  console.log('TTV shadow parity', JSON.stringify({
    totals: evidence.parity.totals,
    categories: Object.fromEntries(CATEGORY_NAMES.map((name) => [name, evidence.parity.categories[name]])),
  }));
  expect(evidence.parity.totals.omitted).toBe(0);
  expect(evidence.entityCount).toBe(evidence.parity.totals.mapped);
  expect(evidence.idsStable).toBe(true);
  expect(evidence.legacyMarkupStable).toBe(true);
  for (const category of CATEGORY_NAMES) {
    expect(evidence.parity.categories[category].mapped).toBeGreaterThan(0);
    expect(evidence.parity.categories[category].omitted).toBe(0);
  }
  expect(evidence.sourcePipeExact).toBe(true);
  expect(evidence.bendExact).toBe(true);
  expect(evidence.sourcePortExact).toBe(true);
  expect(evidence.canonicalNodesExact).toBe(true);
  expect(evidence.canonicalEdgesExact).toBe(true);
  expect(evidence.pointFeaturesExact).toBe(true);
  expect(evidence.junctionsExact).toBe(true);
  expect(evidence.boundariesExact).toBe(true);
  await expect(root.locator('input[data-engineering-svg-property-control]')).toHaveCount(0);
  await expect(root.locator('select[data-engineering-svg-property-control]')).toHaveCount(0);
  await expect(root.locator('input, select, textarea')).toHaveCount(0);
});

test('TTV-ESVG-SHADOW-B02 pointer selection exposes exact source properties without a draft path', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  const pipeKey = 'source:$[0].children[0]';
  await root.locator(`[data-engineering-svg-entity-id="${pipeKey}"]`).dispatchEvent('click');
  await expect(property(root, 'objectKey')).toHaveText(pipeKey);
  await expect(property(root, 'domainType')).toHaveText('TTV_SOURCE_COMPONENT');
  await expect(property(root, 'sourceEntityId')).toHaveText('SRC-PIPE-1');
  await expect(property(root, 'componentCategory')).toHaveText('PIPE');
  await expect(property(root, 'sourcePath')).toHaveText('$[0].children[0]');
  await expect(property(root, 'startX')).toHaveText('0 mm');
  await expect(property(root, 'startY')).toHaveText('0 mm');
  await expect(property(root, 'startZ')).toHaveText('0 mm');
  await expect(property(root, 'endX')).toHaveText('10 mm');
  const bendKey = 'source:$[0].children[6]';
  await root.locator(`[data-engineering-svg-entity-id="${bendKey}"]`).dispatchEvent('click');
  await expect(property(root, 'coordinates')).toHaveText('[{"x":18,"y":0,"z":0},{"x":20,"y":0,"z":0},{"x":20,"y":2,"z":0}]');
  const result = await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.workspace.shell.apply());
  expect(result).toBeNull();
  const draft = await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.workspace.shell.draftStore.getSnapshot());
  expect(draft.operationId).toBeNull();
  const commandGateway = await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.workspace.adapter.commandGateway);
  expect(commandGateway).toBeNull();
});

test('TTV-ESVG-SHADOW-B03 keyboard selection exposes exact canonical edge evidence', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  const objectKey = 'canonical:edge:E-VALVE';
  const edge = root.locator(`[data-engineering-svg-entity-id="${objectKey}"]`);
  await edge.focus();
  await edge.press('Enter');
  await expect(edge).toHaveAttribute('aria-selected', 'true');
  await expect(property(root, 'objectKey')).toHaveText(objectKey);
  await expect(property(root, 'domainType')).toHaveText('TTV_CANONICAL_EDGE');
  await expect(property(root, 'canonicalId')).toHaveText('E-VALVE');
  await expect(property(root, 'sourceEntityIds')).toHaveText('SRC-VALVE');
  await expect(property(root, 'startX')).toHaveText('10 mm');
  await expect(property(root, 'startY')).toHaveText('0 mm');
  await expect(property(root, 'startZ')).toHaveText('0 mm');
  await expect(property(root, 'endX')).toHaveText('12 mm');
  await expect(property(root, 'endY')).toHaveText('0 mm');
  await expect(property(root, 'endZ')).toHaveText('0 mm');
  await expect(property(root, 'inputXmlElementIds')).toHaveText('PE-VALVE');
});

test('TTV-ESVG-SHADOW-B04 owner revision and shell projections preserve identity and authoritative geometry', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  const objectKey = 'canonical:edge:E-VALVE';
  await root.locator(`[data-engineering-svg-entity-id="${objectKey}"]`).dispatchEvent('click');
  await expect(property(root, 'objectKey')).toHaveText(objectKey);
  const evidence = await page.evaluate(async (selectedKey) => {
    const fixture = globalThis.__topologyEngineeringSvgShadowFixture;
    const before = fixture.geometryLedger((await fixture.workspace.adapter.getScene()));
    fixture.changeOwnerProjection('XZ');
    await fixture.workspace.shell.refreshProperties('owner-event-proof');
    const afterOwnerEvent = fixture.geometryLedger((await fixture.workspace.adapter.getScene()));
    const projectionLedgers = {};
    for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) {
      fixture.workspace.shell.workspace.setProjection(projection);
      projectionLedgers[projection] = fixture.geometryLedger((await fixture.workspace.adapter.getScene()));
    }
    return {
      before,
      afterOwnerEvent,
      projectionLedgers,
      selection: fixture.workspace.shell.getSelection(),
      inspectorObjectKey: fixture.workspace.shell.getInspectorModel().rows
        .find((row) => row.key === 'objectKey')?.display?.value,
      finalProjection: fixture.workspace.shell.workspace.getProjection(),
      selectedKey,
    };
  }, objectKey);
  expect(evidence.selection).toEqual([objectKey]);
  expect(evidence.inspectorObjectKey).toBe(objectKey);
  expect(evidence.afterOwnerEvent).toEqual(evidence.before);
  for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) {
    expect(evidence.projectionLedgers[projection]).toEqual(evidence.before);
  }
  expect(evidence.finalProjection).toBe('YZ');
  await expect(root.locator(`[data-engineering-svg-entity-id="${objectKey}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(property(root, 'objectKey')).toHaveText(objectKey);
});

test('TTV-ESVG-SHADOW-B05 destroy and remount leave one clean shell and owner subscription', async ({ page }) => {
  await openFixture(page);
  expect(await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.listenerCount())).toBe(1);
  const destroyEvidence = await page.evaluate(() => {
    const fixture = globalThis.__topologyEngineeringSvgShadowFixture;
    const previous = fixture.workspace;
    const results = [fixture.destroy(), fixture.destroy()];
    let bridgeDisposed = false;
    try { previous.bridge.getDependencies(); } catch { bridgeDisposed = true; }
    return { results, bridgeDisposed, shellDestroyAgain: previous.shell.destroy() };
  });
  expect(destroyEvidence).toEqual({ results: [true, false], bridgeDisposed: true, shellDestroyAgain: false });
  await expect(shell(page)).toHaveCount(0);
  await expect(page.locator('#shadow [data-engineering-svg-root]')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.listenerCount())).toBe(0);
  await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.mount());
  await expect(shell(page)).toHaveCount(1);
  await expect(page.locator('#shadow [data-engineering-svg-root]')).toHaveCount(1);
  expect(await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.listenerCount())).toBe(1);
  const bridgeState = await page.evaluate(() => globalThis.__topologyEngineeringSvgShadowFixture.workspace.bridge.getLastRejectedEvent());
  expect(bridgeState).toBeNull();
});

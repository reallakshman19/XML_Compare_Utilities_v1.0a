import { expect, test } from '@playwright/test';

async function openFixture(page) {
  await page.goto('/tests/browser/sequential-engineering-svg-shadow-fixture.html');
  await page.waitForFunction(() => Boolean(globalThis.__sequentialEngineeringSvgShadowFixture));
}

function shell(page) {
  return page.locator('[data-engineering-svg-shell="ssk-shadow-shell"]');
}

function property(root, key) {
  return root.locator(`[data-engineering-svg-property-key="${key}"] output`);
}

async function scenario(page, name) {
  await page.evaluate((value) => globalThis.__sequentialEngineeringSvgShadowFixture.setScenario(value), name);
}

async function categoryId(page, category) {
  return page.evaluate((value) => globalThis.__sequentialEngineeringSvgShadowFixture.entityId(value), category);
}

test('SSK-ESVG-SHADOW-B01 blocked state exposes confirmed, candidates and active port', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await expect(root).toHaveAttribute('data-engineering-svg-shell-access', 'read-only');
  await expect(root).toHaveAttribute('aria-label', 'Sequential Sketcher engineering viewer');
  const evidence = await page.evaluate(async () => {
    const fixture = globalThis.__sequentialEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const parity = fixture.workspace.getParityReport();
    const omissions = fixture.workspace.getParityEvidence();
    return {
      parity,
      approved: omissions.approvedOmissions.map((row) => row.category).sort(),
      unexplained: omissions.unexplainedOmissions,
      layers: Object.fromEntries(['confirmed', 'candidate', 'activePort'].map((category) => [
        category,
        scene.entities.filter((entity) => entity.domainRef.category === category).length,
      ])),
      candidatesExcluded: scene.entities.filter((entity) => entity.domainRef.category === 'candidate')
        .every((entity) => !entity.contributesToFit && entity.metadata.sequential.status === 'NOT_CONFIRMED'),
      confirmedIncluded: scene.entities.filter((entity) => entity.domainRef.category === 'confirmed')
        .every((entity) => entity.contributesToFit),
      decisionReason: fixture.state.session.currentDecisionRequest.reason,
    };
  });
  expect(evidence.layers.confirmed).toBeGreaterThan(0);
  expect(evidence.layers.candidate).toBeGreaterThanOrEqual(2);
  expect(evidence.layers.activePort).toBe(1);
  expect(evidence.candidatesExcluded).toBe(true);
  expect(evidence.confirmedIncluded).toBe(true);
  expect(evidence.decisionReason).toBeTruthy();
  expect(evidence.approved).toEqual(['analyticalSupportAttachment', 'network', 'restraint']);
  expect(evidence.unexplained).toEqual([]);

  const candidateId = await categoryId(page, 'candidate');
  await root.locator(`[data-engineering-svg-entity-id="${candidateId}"]`).dispatchEvent('click');
  await expect(property(root, 'candidateId')).not.toHaveText('');
  await expect(property(root, 'candidateStatus')).toHaveText('NOT_CONFIRMED');
  await expect(property(root, 'decisionReason')).not.toHaveText('');
  await expect(property(root, 'fromPortId')).not.toHaveText('');
  await expect(property(root, 'toPortId')).not.toHaveText('');
  await expect(property(root, 'eligible')).toBeVisible();

  const activeId = await categoryId(page, 'activePort');
  await root.locator(`[data-engineering-svg-entity-id="${activeId}"]`).dispatchEvent('click');
  await expect(property(root, 'portId')).not.toHaveText('');
  await expect(property(root, 'ownerComponentId')).not.toHaveText('');
  await expect(property(root, 'activePortX')).toBeVisible();
  await expect(root.locator('input, select, textarea')).toHaveCount(0);
});

test('SSK-ESVG-SHADOW-B02 repaired continuity and rejected evidence remain domain-owned', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  await scenario(page, 'REPAIRED');
  const repaired = await page.evaluate(async () => {
    const fixture = globalThis.__sequentialEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const repair = scene.entities.find((entity) => entity.domainRef.category === 'repair');
    const elbow = scene.entities.find((entity) => entity.metadata.sequential.component?.canonicalType === 'ELBOW');
    return {
      repairId: repair.id,
      repairDomain: repair.domainRef,
      policyFingerprint: repair.metadata.sequential.repair.tolerancePolicyFingerprint,
      geometry: repair.geometry,
      elbowGeometry: elbow.geometry,
    };
  });
  expect(repaired.repairDomain.repairId).toBeTruthy();
  expect(repaired.repairDomain.connectionId).toBeTruthy();
  expect(repaired.policyFingerprint).toBeTruthy();
  expect(repaired.elbowGeometry.kind).toBe('polyline');
  expect(repaired.elbowGeometry.points.length).toBeGreaterThan(2);
  await root.locator(`[data-engineering-svg-entity-id="${repaired.repairId}"]`).dispatchEvent('click');
  await expect(property(root, 'repairId')).not.toHaveText('');
  await expect(property(root, 'connectionId')).not.toHaveText('');
  await expect(property(root, 'repairPolicy')).not.toHaveText('');
  await expect(property(root, 'tolerancePolicyFingerprint')).not.toHaveText('');

  await scenario(page, 'REJECTED');
  const rejected = await page.evaluate(async () => {
    const scene = await globalThis.__sequentialEngineeringSvgShadowFixture.workspace.adapter.getScene();
    const entity = scene.entities.find((row) => row.domainRef.category === 'rejectedCandidate');
    return {
      id: entity.id,
      candidateId: entity.domainRef.candidateId,
      action: entity.metadata.sequential.decision.resolution.action,
      rationale: entity.metadata.sequential.decision.resolution.reason,
      geometry: entity.geometry,
      fit: entity.contributesToFit,
    };
  });
  expect(rejected.candidateId).toBeTruthy();
  expect(rejected.action).toBe('REJECT_CANDIDATE');
  expect(rejected.rationale).toBe('Not continuous');
  expect(rejected.geometry).toBeTruthy();
  expect(rejected.fit).toBe(false);
  await root.locator(`[data-engineering-svg-entity-id="${rejected.id}"]`).dispatchEvent('click');
  await expect(property(root, 'candidateStatus')).toHaveText('REJECTED');
  await expect(property(root, 'rejectionReason')).toHaveText('Not continuous');
  await expect(property(root, 'evidenceNote')).not.toHaveText('');
});

test('SSK-ESVG-SHADOW-B03 accepted support retains fingerprint ownership and exact attachment', async ({ page }) => {
  await openFixture(page);
  await scenario(page, 'SUPPORTED');
  const root = shell(page);
  const evidence = await page.evaluate(async () => {
    const fixture = globalThis.__sequentialEngineeringSvgShadowFixture;
    const scene = await fixture.workspace.adapter.getScene();
    const support = scene.entities.find((entity) => entity.domainRef.category === 'support');
    const parity = fixture.workspace.getParityReport();
    return {
      id: support.id,
      domainRef: support.domainRef,
      geometry: support.geometry,
      status: support.metadata.sequential.status,
      revision: parity.revisionConsistency,
      supportCount: parity.supportCount,
      missingCarrier: parity.supportAttachmentsMissingCarrierEvidence,
    };
  });
  expect(evidence.supportCount).toBe(1);
  expect(evidence.missingCarrier).toEqual([]);
  expect(evidence.domainRef.supportId).toBeTruthy();
  expect(evidence.domainRef.familyId).toBeTruthy();
  expect(evidence.domainRef.carrierId).toBeTruthy();
  expect(evidence.geometry.position).toEqual({ schema: 'EngineeringPoint3D.v1', x: 250, y: 0, z: 0 });
  expect(evidence.revision.supportMatchesConfirmed).toBe(true);
  expect(evidence.revision.supportConstructionFingerprint)
    .toBe(evidence.revision.confirmedConstructionFingerprint);
  await root.locator(`[data-engineering-svg-entity-id="${evidence.id}"]`).dispatchEvent('click');
  await expect(property(root, 'supportId')).not.toHaveText('');
  await expect(property(root, 'supportFamilyId')).not.toHaveText('');
  await expect(property(root, 'attachmentCarrierId')).not.toHaveText('');
  await expect(property(root, 'attachmentStatus')).not.toHaveText('');
  await expect(property(root, 'attachmentX')).toHaveText('250 mm');
});

test('SSK-ESVG-SHADOW-B04 projections and interactions preserve immutable construction', async ({ page }) => {
  await openFixture(page);
  const root = shell(page);
  const before = await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.allConstructionSnapshots()
  ));
  const candidateId = await categoryId(page, 'candidate');
  await root.locator(`[data-engineering-svg-entity-id="${candidateId}"]`).dispatchEvent('click');
  const evidence = await page.evaluate(async (selectedId) => {
    const fixture = globalThis.__sequentialEngineeringSvgShadowFixture;
    const initialScene = await fixture.workspace.adapter.getScene();
    const initialLedger = fixture.geometryLedger(initialScene);
    const ledgers = {};
    for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) {
      fixture.workspace.shell.workspace.setProjection(projection);
      ledgers[projection] = fixture.geometryLedger(await fixture.workspace.adapter.getScene());
    }
    await fixture.setOwnerProjection('XZ');
    const ownerLedger = fixture.geometryLedger(await fixture.workspace.adapter.getScene());
    return {
      initialLedger,
      ledgers,
      ownerLedger,
      selection: fixture.workspace.shell.getSelection(),
      selectedId,
    };
  }, candidateId);
  for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) {
    expect(evidence.ledgers[projection]).toEqual(evidence.initialLedger);
  }
  expect(evidence.ownerLedger).toEqual(evidence.initialLedger);
  expect(evidence.selection).toEqual([candidateId]);

  await scenario(page, 'SUPPORTED');
  expect(await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.workspace.shell.getSelection()
  ))).toEqual([]);
  const result = await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.workspace.shell.apply()
  ));
  expect(result).toBeNull();
  const draft = await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.workspace.shell.draftStore.getSnapshot()
  ));
  expect(draft.operationId).toBeNull();
  const after = await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.allConstructionSnapshots()
  ));
  expect(after).toEqual(before);
});

test('SSK-ESVG-SHADOW-B05 failure contracts, destroy and remount are deterministic', async ({ page }) => {
  await openFixture(page);
  const fixtureResult = await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.failureContracts()
  ));
  expect(fixtureResult.every((row) => row.rejected)).toBe(true);
  expect(fixtureResult.every((row) => (row.shellCount ?? 0) === 0)).toBe(true);
  expect(fixtureResult.every((row) => (row.svgCount ?? 0) === 0)).toBe(true);
  expect(fixtureResult.every((row) => (row.listenerCount ?? 0) === 0)).toBe(true);

  expect(await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.listenerCount()
  ))).toBe(1);
  expect(await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.selectorListenerCount()
  ))).toBe(1);
  const destroyed = await page.evaluate(() => {
    const fixture = globalThis.__sequentialEngineeringSvgShadowFixture;
    const previous = fixture.workspace;
    const results = [fixture.destroy(), fixture.destroy()];
    let bridgeDisposed = false;
    try { previous.bridge.getDependencies(); } catch { bridgeDisposed = true; }
    return { results, bridgeDisposed, shellDestroyAgain: previous.shell.destroy() };
  });
  expect(destroyed).toEqual({ results: [true, false], bridgeDisposed: true, shellDestroyAgain: false });
  await expect(shell(page)).toHaveCount(0);
  await expect(page.locator('#shadow [data-engineering-svg-root]')).toHaveCount(0);
  expect(await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.listenerCount()
  ))).toBe(0);

  await page.evaluate(() => globalThis.__sequentialEngineeringSvgShadowFixture.mount());
  await expect(shell(page)).toHaveCount(1);
  await expect(page.locator('#shadow [data-engineering-svg-root]')).toHaveCount(1);
  expect(await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.listenerCount()
  ))).toBe(1);
  expect(await page.evaluate(() => (
    globalThis.__sequentialEngineeringSvgShadowFixture.selectorListenerCount()
  ))).toBe(1);
});

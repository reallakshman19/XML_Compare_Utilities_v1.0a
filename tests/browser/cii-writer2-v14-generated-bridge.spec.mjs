import { expect, test } from '@playwright/test';

test('CII Writer2 converter-generated V14 bridge reproduces the validated V11 product postimage', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const [{ decodeCiiNumericRow }, core, intake, topology, physical, restraintWriter, scope, bridge, converter] = await Promise.all([
      import('/parser/fixed-field.js'),
      import('/tabs/cii-workspace/cii-workspace-core.js'),
      import('/tabs/cii-workspace/cii-workspace-intake.js'),
      import('/tabs/cii-workspace/cii-workspace-topology-adapter.js'),
      import('/tabs/cii-workspace/cii-workspace-physical-file.js'),
      import('/tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js'),
      import('/tabs/cii-workspace/cii-workspace-transfer-scope.js'),
      import('/tabs/cii-workspace/cii-workspace-writer-version-bridge.js'),
      import('/tabs/cii-workspace/cii-workspace-v11-v14-converter.js'),
    ]);

    const { applyCiiWorkspaceTargetWriter2 } = core;
    const { intakeCiiWorkspaceDocument } = intake;
    const { adaptCiiDocumentToTopologyGraph } = topology;
    const { ciiPhysicalSectionRows } = physical;
    const { applyCiiWriter2CompositeWithRestraintDelete } = restraintWriter;
    const {
      bindCiiTransferScopeToPreview,
      ciiTransferScopeCandidateOperations,
      createCiiTransferScopeSelection,
    } = scope;
    const {
      applyCiiWorkspaceTargetWriter2WithVersionBridge,
      createCiiWorkspacePreviewWithVersionBridge,
    } = bridge;
    const {
      ciiByteStringToBytes,
      ciiBytesEqual,
      ciiSha256,
      convertCiiNeutralVersionLossless,
      detectCiiNeutralVersion,
    } = converter;

    const BLOCK_ROWS = 24;
    const SLOT_ROWS = 4;
    const SLOTS = 6;
    const SOURCE_SHA = '3'.repeat(64);

    function prefixedText(row) {
      const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
      if (!match) return null;
      return String(match[2] || '').slice(0, Number(match[1]));
    }
    function slotState(rows, pointer, slot) {
      const base = (pointer - 1) * BLOCK_ROWS + (slot - 1) * SLOT_ROWS;
      if (base < 0 || base + 3 >= rows.length) return null;
      const first = decodeCiiNumericRow(rows[base].text);
      const second = decodeCiiNumericRow(rows[base + 1].text);
      if (!Array.isArray(first) || first.length < 6 || !Array.isArray(second) || second.length < 3) return null;
      const line1 = first.slice(0, 6).map(Number);
      const line2 = second.slice(0, 3).map(Number);
      if (![...line1, ...line2].every(Number.isFinite)) return null;
      const tag = prefixedText(rows[base + 2].text);
      const guid = prefixedText(rows[base + 3].text);
      if (tag == null || guid == null) return null;
      return Object.freeze({
        pointer,
        slot,
        line1: Object.freeze(line1),
        line2: Object.freeze(line2),
        tag,
        guid,
        occupied: !(Math.abs(line1[0]) <= 1e-12 && Math.abs(line1[1]) <= 1e-12),
      });
    }
    function ownersForPointer(document, pointer) {
      return Object.values(document?.auxiliaryEvidence?.elements || {})
        .filter((item) => Number(item?.pointers?.restraint || 0) === pointer)
        .sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex));
    }
    function chooseRealDeleteCandidate(document) {
      const rows = ciiPhysicalSectionRows(document.physicalFile, 'RESTRANT');
      if (rows.length % BLOCK_ROWS !== 0) throw new Error('W2_V14_GENERATED_RESTRANT_BLOCK_SHAPE_REQUIRED');
      for (let pointer = 1; pointer <= rows.length / BLOCK_ROWS; pointer += 1) {
        const states = Array.from({ length: SLOTS }, (_, index) => slotState(rows, pointer, index + 1));
        if (states.some((item) => !item || item.tag || item.guid)) continue;
        const occupied = states.filter((item) => item.occupied);
        if (occupied.length !== 1) continue;
        const owners = ownersForPointer(document, pointer);
        if (owners.length !== 1) continue;
        const state = occupied[0];
        const node = String(Math.round(state.line1[0]));
        if (node !== String(owners[0].from) && node !== String(owners[0].to)) continue;
        const nodeRecords = document?.auxiliaryEvidence?.restraints?.byNode?.[node] || [];
        if (nodeRecords.length !== 1) continue;
        return Object.freeze({ pointer, slot: state.slot, targetNode: node, beforeSlot: state });
      }
      throw new Error('W2_V14_GENERATED_REAL_DELETE_CANDIDATE_REQUIRED');
    }
    function deleteOperation(candidate) {
      const mutation = Object.freeze({
        schema: 'CIIWorkspaceRestraintSlotMutation.v1',
        status: 'QUALIFIED',
        mode: 'CLEAR',
        authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE',
        pointer: candidate.pointer,
        slot: candidate.slot,
        targetNode: candidate.targetNode,
        beforeSlot: candidate.beforeSlot,
      });
      return Object.freeze({
        operationId: `W2-V14-GENERATED-DELETE-P${candidate.pointer}-S${candidate.slot}`,
        family: 'RESTRAINT',
        property: 'Qualified restraint slot mutation',
        action: 'DELETE',
        status: 'PREVIEW_READY',
        scopeDecision: 'APPLY',
        policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
        matchAuthority: Object.freeze({ status: 'REVIEWED' }),
        sourceEvidence: Object.freeze({ value: mutation }),
        proposed: mutation,
      });
    }
    function boundSeedPlan(targetDocument, operation) {
      const id = operation.operationId;
      return Object.freeze({
        status: 'PREVIEW_READY',
        blockers: Object.freeze([]),
        sourceDocument: Object.freeze({ fileName: 'CONTROLLED_V11_SOURCE', contentSha256: SOURCE_SHA }),
        targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
        operations: Object.freeze([operation]),
        excludedOperations: Object.freeze([]),
        transferScope: Object.freeze({
          schema: 'CIIWorkspaceTransferScope.v1',
          mode: 'EXPLICIT_APPLY_EXCLUDE',
          status: 'BOUND',
          authority: 'USER_EXPLICIT_OPERATION_SCOPE',
          scopeId: `W2-V14-GENERATED-SEED:${id}`,
          sourceSha256: SOURCE_SHA,
          targetSha256: targetDocument.contentSha256,
          candidateOperationIds: Object.freeze([id]),
          appliedOperationIds: Object.freeze([id]),
          excludedOperationIds: Object.freeze([]),
          appliedOperationCount: 1,
          excludedOperationCount: 0,
        }),
      });
    }

    const benchmarkResponse = await fetch('/Benchmark/CIICompare/BM_CII_SOURCE.CII', { cache: 'no-store' });
    if (!benchmarkResponse.ok) throw new Error(`W2_V14_GENERATED_BENCHMARK_HTTP:${benchmarkResponse.status}`);
    const v11TargetBytes = new Uint8Array(await benchmarkResponse.arrayBuffer());
    const before = await intakeCiiWorkspaceDocument(v11TargetBytes, 'BM_CII_SOURCE.CII', {
      side: 'TARGET', cryptoRef: crypto,
    });
    const graph = adaptCiiDocumentToTopologyGraph(before);
    const candidate = chooseRealDeleteCandidate(before);
    const seed = applyCiiWriter2CompositeWithRestraintDelete({
      targetDocument: before,
      targetGraph: graph,
      transferPlan: boundSeedPlan(before, deleteOperation(candidate)),
    });
    if (seed.status !== 'APPLIED') throw new Error(`W2_V14_GENERATED_SEED_NOT_APPLIED:${seed.status}`);

    const [generatedSourceV14, generatedTargetV14] = await Promise.all([
      convertCiiNeutralVersionLossless(seed.bytes, 14, { fileName: 'W2_SOURCE_V11.CII', cryptoRef: crypto }),
      convertCiiNeutralVersionLossless(v11TargetBytes, 14, { fileName: 'BM_CII_SOURCE.CII', cryptoRef: crypto }),
    ]);
    if (detectCiiNeutralVersion(generatedSourceV14.outputBytes) !== 14) throw new Error('W2_V14_GENERATED_SOURCE_VERSION_MISMATCH');
    if (detectCiiNeutralVersion(generatedTargetV14.outputBytes) !== 14) throw new Error('W2_V14_GENERATED_TARGET_VERSION_MISMATCH');

    const policy = Object.freeze({
      writerVersion: '2',
      cryptoRef: crypto,
      spatialToleranceMm: 1,
      diameterToleranceRatio: 0.01,
      wallToleranceRatio: 0.01,
      identityWeight: 50,
      diameterWeight: 30,
      wallWeight: 30,
      winnerGap: 8,
    });
    const initialPreview = await createCiiWorkspacePreviewWithVersionBridge({
      sourceBytes: generatedSourceV14.outputBytes,
      sourceFileName: 'W2_SOURCE_GENERATED_V14.CII',
      targetBytes: generatedTargetV14.outputBytes,
      targetFileName: 'BM_CII_SOURCE_GENERATED_V14.CII',
      anchorPairs: [{ sourceNodeId: candidate.targetNode, targetNodeId: candidate.targetNode }],
    }, policy);
    if (initialPreview.versionBridge?.source?.originalVersion !== 14
      || initialPreview.versionBridge?.target?.originalVersion !== 14) {
      throw new Error('W2_V14_GENERATED_BRIDGE_ORIGINAL_VERSION_EVIDENCE_REQUIRED');
    }

    const productOperation = (initialPreview.transferPlan?.operations || []).find((operation) =>
      operation.family === 'RESTRAINT'
      && operation.property === 'Qualified restraint slot mutation'
      && operation.action === 'DELETE');
    if (!productOperation) throw new Error(`W2_V14_GENERATED_PRODUCT_DELETE_REQUIRED:${initialPreview.transferPlan?.blockers?.join('|') || ''}`);
    if (productOperation.status !== 'PREVIEW_READY') {
      throw new Error(`W2_V14_GENERATED_PRODUCT_DELETE_NOT_READY:${productOperation.blockers?.join('|') || ''}`);
    }

    const decisions = Object.fromEntries(
      ciiTransferScopeCandidateOperations(initialPreview.transferPlan)
        .filter((operation) => operation.action !== 'KEEP')
        .map((operation) => [operation.operationId, operation.operationId === productOperation.operationId ? 'APPLY' : 'EXCLUDE']),
    );
    const selection = createCiiTransferScopeSelection(initialPreview.transferPlan, decisions);
    const preview = bindCiiTransferScopeToPreview(initialPreview, selection);
    if (preview.transferScope?.status !== 'BOUND') throw new Error('W2_V14_GENERATED_BOUND_SCOPE_REQUIRED');
    if (preview.writerReadiness?.ready !== true) {
      throw new Error(`W2_V14_GENERATED_WRITER2_NOT_READY:${preview.writerReadiness?.blockers?.join('|') || ''}`);
    }

    const normalizedTarget = await convertCiiNeutralVersionLossless(generatedTargetV14.outputBytes, 11, {
      fileName: 'BM_CII_SOURCE_GENERATED_V14.CII', cryptoRef: crypto,
    });
    const directV11 = await applyCiiWorkspaceTargetWriter2(preview, normalizedTarget.outputBytes, { cryptoRef: crypto });
    if (directV11.status !== 'PASS' || directV11.validation?.status !== 'PASS') {
      throw new Error('W2_V14_GENERATED_DIRECT_V11_PRODUCT_PASS_REQUIRED');
    }

    const appliedV14 = await applyCiiWorkspaceTargetWriter2WithVersionBridge(
      preview,
      generatedTargetV14.outputBytes,
      { cryptoRef: crypto },
    );
    if (appliedV14.status !== 'PASS') throw new Error(`W2_V14_GENERATED_BRIDGE_PRODUCT_NOT_PASS:${appliedV14.status}`);
    if (appliedV14.versionBridgeValidation?.status !== 'PASS') throw new Error('W2_V14_GENERATED_BRIDGE_VALIDATION_PASS_REQUIRED');
    if (appliedV14.versionBridgeValidation?.path !== 'V14_CHANGE_ISOLATED_VIA_V11') {
      throw new Error(`W2_V14_GENERATED_BRIDGE_PATH_MISMATCH:${appliedV14.versionBridgeValidation?.path}`);
    }
    if (appliedV14.versionBridgeValidation?.projectedNormalizedPostimageExact !== true) {
      throw new Error('W2_V14_GENERATED_PROJECTED_NORMALIZED_POSTIMAGE_EXACT_REQUIRED');
    }

    const appliedV14Bytes = ciiByteStringToBytes(appliedV14.byteString);
    if (detectCiiNeutralVersion(appliedV14Bytes) !== 14) throw new Error('W2_V14_GENERATED_OUTPUT_VERSION_14_REQUIRED');
    const finalDowngrade = await convertCiiNeutralVersionLossless(appliedV14Bytes, 11, {
      fileName: appliedV14.fileName, cryptoRef: crypto,
    });
    const directV11Bytes = ciiByteStringToBytes(directV11.byteString);
    if (!ciiBytesEqual(finalDowngrade.outputBytes, directV11Bytes)) {
      throw new Error('W2_V14_GENERATED_FINAL_DOWNGRADE_NOT_EXACT_VALIDATED_V11_POSTIMAGE');
    }

    const finalDowngradeSha256 = await ciiSha256(finalDowngrade.outputBytes, crypto);
    const directV11Sha256 = await ciiSha256(directV11Bytes, crypto);
    if (finalDowngradeSha256 !== directV11Sha256) throw new Error('W2_V14_GENERATED_FINAL_DOWNGRADE_SHA_MISMATCH');

    return {
      fixtureClass: 'CONVERTER_GENERATED_V14_FROM_REAL_V11_BENCHMARK',
      candidatePointer: candidate.pointer,
      bridgePath: appliedV14.versionBridgeValidation.path,
      bridgeStatus: appliedV14.versionBridgeValidation.status,
      projectedNormalizedPostimageExact: appliedV14.versionBridgeValidation.projectedNormalizedPostimageExact,
      finalDowngradeEqualsValidatedV11: true,
      finalDowngradeSha256,
      directV11Sha256,
      changedV14Sections: appliedV14.versionBridgeValidation.changedV14Sections,
      sourceVersion: detectCiiNeutralVersion(generatedSourceV14.outputBytes),
      targetVersion: detectCiiNeutralVersion(generatedTargetV14.outputBytes),
      outputVersion: detectCiiNeutralVersion(appliedV14Bytes),
    };
  });

  expect(result.fixtureClass).toBe('CONVERTER_GENERATED_V14_FROM_REAL_V11_BENCHMARK');
  expect(result.sourceVersion).toBe(14);
  expect(result.targetVersion).toBe(14);
  expect(result.outputVersion).toBe(14);
  expect(result.bridgeStatus).toBe('PASS');
  expect(result.bridgePath).toBe('V14_CHANGE_ISOLATED_VIA_V11');
  expect(result.projectedNormalizedPostimageExact).toBe(true);
  expect(result.finalDowngradeEqualsValidatedV11).toBe(true);
  expect(result.finalDowngradeSha256).toBe(result.directV11Sha256);
  expect(result.changedV14Sections).toEqual(expect.arrayContaining(['CONTROL', 'ELEMENTS', 'RESTRANT']));
  expect(result.changedV14Sections).not.toContain('MISCEL_1');
});

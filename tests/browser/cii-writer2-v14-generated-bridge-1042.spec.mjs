import { expect, test } from '@playwright/test';

test('CII Writer2 generated V14 bridge preserves #1042 NONAM custody', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const [{ decodeCiiNumericRow }, intake, topology, physical, restraintWriter, scope, bridge, converter] = await Promise.all([
      import('/parser/fixed-field.js'),
      import('/tabs/cii-workspace/cii-workspace-intake.js'),
      import('/tabs/cii-workspace/cii-workspace-topology-adapter.js'),
      import('/tabs/cii-workspace/cii-workspace-physical-file.js'),
      import('/tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js'),
      import('/tabs/cii-workspace/cii-workspace-transfer-scope.js'),
      import('/tabs/cii-workspace/cii-workspace-writer-version-bridge.js'),
      import('/tabs/cii-workspace/cii-workspace-v11-v14-converter.js'),
    ]);

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
      convertCiiNeutralVersionLossless,
      detectCiiNeutralVersion,
    } = converter;

    const BLOCK_ROWS = 24;
    const SLOT_ROWS = 4;
    const SLOTS = 6;
    const SOURCE_SHA = '4'.repeat(64);

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
      if (rows.length % BLOCK_ROWS !== 0) throw new Error('W2_1042_RESTRANT_BLOCK_SHAPE_REQUIRED');
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
      throw new Error('W2_1042_REAL_DELETE_CANDIDATE_REQUIRED');
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
        operationId: `W2-V14-1042-DELETE-P${candidate.pointer}-S${candidate.slot}`,
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
          scopeId: `W2-V14-1042-SEED:${id}`,
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

    function rawSectionRows(value, sectionName) {
      const text = new TextDecoder('utf-8').decode(value);
      const lines = text.split(/\r?\n/);
      const rows = [];
      let active = false;
      for (const line of lines) {
        const marker = /^\s*#\$\s+([A-Z0-9_&]+)\s*$/.exec(line);
        if (marker) {
          if (active) break;
          active = marker[1] === sectionName;
          continue;
        }
        if (active) rows.push(line);
      }
      if (!rows.length) throw new Error(`W2_1042_SECTION_REQUIRED:${sectionName}`);
      return rows;
    }

    function rawI13(value, rowIndex, fieldIndex) {
      const rows = rawSectionRows(value, 'CONTROL');
      const row = rows[rowIndex];
      if (typeof row !== 'string') throw new Error(`W2_1042_CONTROL_ROW_REQUIRED:${rowIndex}`);
      const start = 2 + fieldIndex * 13;
      const raw = row.slice(start, start + 13);
      if (raw.length !== 13) throw new Error(`W2_1042_CONTROL_I13_WIDTH_REQUIRED:${rowIndex}:${fieldIndex}`);
      return raw;
    }

    function integerI13(raw, label) {
      const token = String(raw).trim();
      if (!/^[+-]?\d+$/.test(token)) throw new Error(`W2_1042_INTEGER_I13_REQUIRED:${label}:${token}`);
      return Number(token);
    }

    const benchmarkResponse = await fetch('/Benchmark/CIICompare/BM_CII_SOURCE.CII', { cache: 'no-store' });
    if (!benchmarkResponse.ok) throw new Error(`W2_1042_BENCHMARK_HTTP:${benchmarkResponse.status}`);
    const v11TargetBytes = new Uint8Array(await benchmarkResponse.arrayBuffer());
    const before = await intakeCiiWorkspaceDocument(v11TargetBytes, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: crypto });
    const graph = adaptCiiDocumentToTopologyGraph(before);
    const candidate = chooseRealDeleteCandidate(before);
    const seed = applyCiiWriter2CompositeWithRestraintDelete({
      targetDocument: before,
      targetGraph: graph,
      transferPlan: boundSeedPlan(before, deleteOperation(candidate)),
    });
    if (seed.status !== 'APPLIED') throw new Error(`W2_1042_SEED_NOT_APPLIED:${seed.status}`);

    const [generatedSourceV14, generatedTargetV14] = await Promise.all([
      convertCiiNeutralVersionLossless(seed.bytes, 14, { fileName: 'W2_SOURCE_V11.CII', cryptoRef: crypto }),
      convertCiiNeutralVersionLossless(v11TargetBytes, 14, { fileName: 'BM_CII_SOURCE.CII', cryptoRef: crypto }),
    ]);
    if (detectCiiNeutralVersion(generatedSourceV14.outputBytes) !== 14
      || detectCiiNeutralVersion(generatedTargetV14.outputBytes) !== 14) {
      throw new Error('W2_1042_GENERATED_V14_REQUIRED');
    }

    const originalNonamRaw = rawI13(generatedTargetV14.outputBytes, 0, 3);
    const originalRestraintRaw = rawI13(generatedTargetV14.outputBytes, 1, 3);
    const originalNonam = integerI13(originalNonamRaw, 'CONTROL_ROW1_FIELD4_NONAM');
    const originalRestraintCount = integerI13(originalRestraintRaw, 'CONTROL_ROW2_FIELD4_RESTRAINTS');

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

    const productOperation = (initialPreview.transferPlan?.operations || []).find((operation) =>
      operation.family === 'RESTRAINT'
      && operation.property === 'Qualified restraint slot mutation'
      && operation.action === 'DELETE');
    if (!productOperation || productOperation.status !== 'PREVIEW_READY') {
      throw new Error(`W2_1042_PRODUCT_DELETE_REQUIRED:${initialPreview.transferPlan?.blockers?.join('|') || ''}`);
    }

    const decisions = Object.fromEntries(
      ciiTransferScopeCandidateOperations(initialPreview.transferPlan)
        .filter((operation) => operation.action !== 'KEEP')
        .map((operation) => [operation.operationId, operation.operationId === productOperation.operationId ? 'APPLY' : 'EXCLUDE']),
    );
    const selection = createCiiTransferScopeSelection(initialPreview.transferPlan, decisions);
    const preview = bindCiiTransferScopeToPreview(initialPreview, selection);
    if (preview.transferScope?.status !== 'BOUND' || preview.writerReadiness?.ready !== true) {
      throw new Error(`W2_1042_BOUND_READY_PREVIEW_REQUIRED:${preview.writerReadiness?.blockers?.join('|') || ''}`);
    }

    const appliedV14 = await applyCiiWorkspaceTargetWriter2WithVersionBridge(
      preview,
      generatedTargetV14.outputBytes,
      { cryptoRef: crypto },
    );
    if (appliedV14.status !== 'PASS'
      || appliedV14.versionBridgeValidation?.status !== 'PASS'
      || appliedV14.versionBridgeValidation?.path !== 'V14_CHANGE_ISOLATED_VIA_V11') {
      throw new Error(`W2_1042_BRIDGE_PASS_REQUIRED:${appliedV14.status}:${appliedV14.versionBridgeValidation?.status}:${appliedV14.versionBridgeValidation?.path}`);
    }

    const appliedV14Bytes = ciiByteStringToBytes(appliedV14.byteString);
    if (detectCiiNeutralVersion(appliedV14Bytes) !== 14) throw new Error('W2_1042_FINAL_V14_REQUIRED');
    const finalNonamRaw = rawI13(appliedV14Bytes, 0, 3);
    const finalRestraintRaw = rawI13(appliedV14Bytes, 1, 3);
    const finalNonam = integerI13(finalNonamRaw, 'FINAL_CONTROL_ROW1_FIELD4_NONAM');
    const finalRestraintCount = integerI13(finalRestraintRaw, 'FINAL_CONTROL_ROW2_FIELD4_RESTRAINTS');

    if (finalNonamRaw !== originalNonamRaw || finalNonam !== originalNonam) {
      throw new Error('W2_1042_NONAM_RAW_I13_DRIFT');
    }
    if (finalRestraintCount !== originalRestraintCount - 1) {
      throw new Error(`W2_1042_RESTRAINT_COUNT_DELTA:${originalRestraintCount}:${finalRestraintCount}`);
    }

    const fixedFieldAuthority = appliedV14.versionBridgeValidation?.fixedFieldAuthority;
    if (fixedFieldAuthority?.status !== 'PASS' || !Array.isArray(fixedFieldAuthority.claims)) {
      throw new Error('W2_1042_FIXED_FIELD_AUTHORITY_PASS_REQUIRED');
    }
    const claimCounts = Object.create(null);
    for (const claim of fixedFieldAuthority.claims) {
      const identity = String(claim?.fieldIdentity || '');
      claimCounts[identity] = (claimCounts[identity] || 0) + 1;
    }
    if (claimCounts.CONTROL_RESTRAINT_BLOCK_COUNT !== 1) {
      throw new Error(`W2_1042_RESTRAINT_CONTROL_CLAIM_REQUIRED:${claimCounts.CONTROL_RESTRAINT_BLOCK_COUNT || 0}`);
    }
    if ((claimCounts.ELEMENT_RESTRAINT_POINTER || 0) < 1) {
      throw new Error('W2_1042_RESTRAINT_POINTER_CLAIM_REQUIRED');
    }
    for (const forbidden of [
      'CONTROL_NODENAME_NONAM_COUNT',
      'CONTROL_SIF_TEE_BLOCK_COUNT',
      'ELEMENT_NODENAME_POINTER',
      'ELEMENT_SIF_TEE_POINTER',
    ]) {
      if (claimCounts[forbidden]) throw new Error(`W2_1042_FORBIDDEN_AUTHORITY_CLAIM:${forbidden}:${claimCounts[forbidden]}`);
    }

    return {
      fixtureClass: 'CONVERTER_GENERATED_V14_FROM_REAL_V11_BENCHMARK',
      bridgePath: appliedV14.versionBridgeValidation.path,
      fixedFieldAuthorityStatus: fixedFieldAuthority.status,
      originalNonamRaw,
      finalNonamRaw,
      originalNonam,
      finalNonam,
      originalRestraintCount,
      finalRestraintCount,
      restraintControlClaimCount: claimCounts.CONTROL_RESTRAINT_BLOCK_COUNT || 0,
      restraintPointerClaimCount: claimCounts.ELEMENT_RESTRAINT_POINTER || 0,
      nonamControlClaimCount: claimCounts.CONTROL_NODENAME_NONAM_COUNT || 0,
      sifControlClaimCount: claimCounts.CONTROL_SIF_TEE_BLOCK_COUNT || 0,
      nodenamePointerClaimCount: claimCounts.ELEMENT_NODENAME_POINTER || 0,
      sifPointerClaimCount: claimCounts.ELEMENT_SIF_TEE_POINTER || 0,
    };
  });

  expect(result.fixtureClass).toBe('CONVERTER_GENERATED_V14_FROM_REAL_V11_BENCHMARK');
  expect(result.bridgePath).toBe('V14_CHANGE_ISOLATED_VIA_V11');
  expect(result.fixedFieldAuthorityStatus).toBe('PASS');
  expect(result.finalNonamRaw).toBe(result.originalNonamRaw);
  expect(result.finalNonam).toBe(result.originalNonam);
  expect(result.finalRestraintCount).toBe(result.originalRestraintCount - 1);
  expect(result.restraintControlClaimCount).toBe(1);
  expect(result.restraintPointerClaimCount).toBeGreaterThan(0);
  expect(result.nonamControlClaimCount).toBe(0);
  expect(result.sifControlClaimCount).toBe(0);
  expect(result.nodenamePointerClaimCount).toBe(0);
  expect(result.sifPointerClaimCount).toBe(0);
});

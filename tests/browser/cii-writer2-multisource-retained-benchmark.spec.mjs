import { expect, test } from '@playwright/test';

test('retained S1/S2/S3 Auto Anchor -> mixed Writer1C/Writer2 recovers all lower-bound positives byte-safely', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  const diagnostics = await page.evaluate(async () => {
    const [sourceSet, baseSelection, previewModule, bmModule, authority, scopeModule, transferScope, bridge, converter, oracle, partialOracle, byteOracle, lowerBound] = await Promise.all([
      import('/tabs/cii-workspace/cii-workspace-source-set.js'),
      import('/tabs/cii-workspace/cii-workspace-base-loop-selection.js'),
      import('/tabs/cii-workspace/cii-workspace-multisource-preview.js'),
      import('/tabs/cii-workspace/cii-workspace-multisource-bm001-correspondence.js'),
      import('/tabs/cii-workspace/cii-workspace-multisource-nodename-authority.js'),
      import('/tabs/cii-workspace/cii-workspace-multisource-scope.js'),
      import('/tabs/cii-workspace/cii-workspace-transfer-scope.js'),
      import('/tabs/cii-workspace/cii-workspace-writer-version-bridge.js'),
      import('/tabs/cii-workspace/cii-workspace-v11-v14-converter.js'),
      import('/tests/cii-workspace-multisource-texpected-oracle.js'),
      import('/tests/cii-workspace-multisource-partial-texpected-oracle.js'),
      import('/tests/cii-workspace-multisource-byte-closure-oracle.js'),
      import('/tests/cii-workspace-multisource-lower-bound-helpers.js'),
    ]);

    const { inspectCiiWorkspaceSourceSetWithVersionBridge } = sourceSet;
    const { ciiAutomaticBaseSelection } = baseSelection;
    const { createCiiWriter2SourceSetPreviewWithVersionBridge } = previewModule;
    const { ciiCanonicalWriter2MutationSelection } = bmModule;
    const { parseCiiMsBm001 } = authority;
    const { createCiiExpectedNodeNameSourceSetSelection } = scopeModule;
    const { bindCiiTransferScopeToPreview } = transferScope;
    const { applyCiiWorkspaceTargetWriter2WithVersionBridge } = bridge;
    const { ciiBytesToByteString } = converter;
    const { deriveExactNameRelocations, deriveExpectedNodeNameDelta } = oracle;
    const {
      evaluatePartialTExpectedPostimage,
      expectedNodeNameTransferKeys,
      validateAppliedRawIdentity,
      validateKnownPositiveNodeNames,
      validateRawMutationIdentity,
    } = partialOracle;
    const { validateIndependentMixedNodeNameByteClosure } = byteOracle;
    const { additionalTransferKeys, missingRequiredTransferKeys, physicalTransferKeys, selectedOperationDeltas } = lowerBound;

    function assert(condition, message) { if (!condition) throw new Error(message); }
    function equal(actual, expected, message) { if (actual !== expected) throw new Error(`${message}: actual=${actual} expected=${expected}`); }
    function deepEqual(actual, expected, message) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    }
    async function fetchBytes(path) {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`RETAINED_BENCHMARK_HTTP:${path}:${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    }
    function autoBaseLoops(inspection) {
      const choices = []; const loops = {};
      for (const member of inspection.memberInspections || []) {
        const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
        choices.push({ sourceId: member.sourceId, ...choice });
        if (choice.status === 'READY') loops[member.sourceId] = choice.baseLoops;
      }
      return { choices, loops };
    }
    function automaticReviewBySource(preview) {
      return Object.fromEntries((preview?.memberPreviews || []).map(({ sourceId, preview: member }) => {
        const rows = member?.compareReview?.rows || [];
        return [sourceId, {
          ...(member?.review || {}),
          reviewedCorrespondenceIds: rows.filter((row) => row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence)).map((row) => row.correspondenceId),
          lockedCorrespondenceIds: rows.filter((row) => row.decision === 'LOCKED').map((row) => row.correspondenceId),
          rejectedCorrespondenceIds: [],
        }];
      }));
    }
    function candidateOperations(plan) {
      const byId = new Map();
      for (const operation of [...(plan?.operations || []), ...(plan?.excludedOperations || [])]) {
        const id = String(operation?.operationId || '').trim(); if (id && !byId.has(id)) byId.set(id, operation);
      }
      return byId;
    }
    function canonicalPhysicalTransfer(preview) {
      const candidates = candidateOperations(preview.transferPlan);
      const canonical = ciiCanonicalWriter2MutationSelection([...candidates.values()]);
      const operations = canonical.appliedOperationIds.map((id) => candidates.get(id));
      return { canonical, operations, keys: physicalTransferKeys(operations) };
    }
    function checkpointDiagnostics(preview, expectedRelocations) {
      return [['8870', '9040'], ['10350', '10190'], ['1005', '925']].map(([fromNodeId, toNodeId]) => ({
        fromNodeId, toNodeId,
        correspondenceMatches: (preview?.correspondence?.nodeRows || [])
          .filter((row) => String(row?.sourceNodeId) === fromNodeId && String(row?.targetNodeId) === toNodeId)
          .map((row) => ({ sourceId: row.sourceId, correspondenceId: row.correspondenceId, status: row.status, confidence: row.confidence })),
        exactNameRelocation: expectedRelocations.find((row) => row.fromNodeId === fromNodeId && row.toNodeId === toNodeId) || null,
      }));
    }

    const sourceNames = ['S1.CII', 'S2.CII', 'S3.CII'];
    const sourceBytes = await Promise.all(sourceNames.map((name) => fetchBytes(`/Benchmark/${name}`)));
    const [targetBytes, expectedBytes] = await Promise.all([fetchBytes('/Benchmark/T.CII'), fetchBytes('/Benchmark/TEXPECTED-PARTIALLLYDONE.CII')]);
    const sources = sourceNames.map((fileName, index) => ({ sourceId: `S${index + 1}`, fileName, bytes: sourceBytes[index] }));
    const sourceTextsById = Object.fromEntries(sources.map((source) => [source.sourceId, ciiBytesToByteString(source.bytes)]));
    const targetText = ciiBytesToByteString(targetBytes); const expectedText = ciiBytesToByteString(expectedBytes);
    const expectedDelta = deriveExpectedNodeNameDelta(targetText, expectedText);
    const expectedKeys = expectedNodeNameTransferKeys(expectedDelta.rows);
    const expectedRelocations = deriveExactNameRelocations(expectedDelta.rows);
    const bmRows = parseCiiMsBm001();

    equal(expectedDelta.rows.length, 36, 'retained lower-bound NodeName delta count');
    equal(expectedDelta.rows.filter((row) => row.action === 'REPLACE').length, 35, 'retained lower-bound replacement count');
    equal(expectedDelta.rows.filter((row) => row.action === 'CREATE').length, 1, 'retained lower-bound create count');
    equal(expectedDelta.rows.filter((row) => row.action === 'DELETE').length, 0, 'retained lower-bound delete count');

    const inspection = await inspectCiiWorkspaceSourceSetWithVersionBridge({ sources, targetBytes, targetFileName: 'T.CII' }, { cryptoRef: crypto });
    const automatic = autoBaseLoops(inspection);
    equal(automatic.choices.length, 3, 'retained Auto Anchor requires S1/S2/S3 independently');
    for (const choice of automatic.choices) {
      equal(choice.status, 'READY', `${choice.sourceId} Auto Anchor must resolve unique qualified topology`);
      assert(choice.baseLoops.length > 0, `${choice.sourceId} Auto Anchor must project at least one qualified loop`);
    }
    deepEqual(Object.keys(automatic.loops).sort(), ['S1', 'S2', 'S3'], 'no manual/benchmark anchor may be needed');

    const previewInput = (reviewBySource) => ({
      sources, targetBytes, targetFileName: 'T.CII', baseLoopsBySource: automatic.loops,
      ...(reviewBySource ? { reviewBySource } : {}),
    });
    const discoveryPreview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput(), { cryptoRef: crypto });
    const preview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput(automaticReviewBySource(discoveryPreview)), { cryptoRef: crypto });
    equal(preview.correspondence.status, 'READY', `Auto Anchor correspondence blockers=${(preview.correspondence.blockers || []).join('|')}`);
    equal(preview.correspondence.conflicts.length, 0, 'cross-source target conflicts must remain zero');

    const physical = canonicalPhysicalTransfer(preview);
    const missingKnownPositiveKeys = missingRequiredTransferKeys(physical.keys, expectedKeys);
    const additionalQualifiedKeys = additionalTransferKeys(physical.keys, expectedKeys);
    const replacementCount = physical.operations.filter((operation) => operation.action === 'COPY').length;
    const structuralCount = physical.operations.filter((operation) => ['CREATE', 'DELETE'].includes(operation.action)).length;
    equal(physical.canonical.conflicts.length, 0, 'canonical physical Transfer conflicts must remain zero');
    equal(new Set(physical.keys).size, physical.keys.length, 'physical Transfer keys must be unique');
    deepEqual(missingKnownPositiveKeys, [], 'all lower-bound action/target keys must be recovered');
    assert(replacementCount >= 35, 'all 35 known-positive replacements must be present');
    assert(physical.operations.filter((operation) => operation.action === 'CREATE').length >= 1, 'known-positive CREATE must be present');
    const rawMutationIdentity = validateRawMutationIdentity(physical.operations, sourceTextsById, targetText, bmRows);
    equal(rawMutationIdentity.status, 'READY', `raw mutation identity errors=${JSON.stringify(rawMutationIdentity.errors.slice(0, 10))}`);

    const exactScope = await createCiiExpectedNodeNameSourceSetSelection(preview.transferPlan, { cryptoRef: crypto });
    equal(exactScope.authority.rowCount, 329, 'frozen BM authority row count must remain 329');
    equal(exactScope.authority.correspondenceCoverage.status, 'READY', 'observed BM claims must be exact frozen-table rows');
    equal(exactScope.authority.correspondenceCoverage.invalidOperationIds.length, 0, 'observed BM claims must have no invalid operations');
    assert(exactScope.authority.correspondenceCoverage.matchedRowCount > 0, 'retained path must expose observed BM evidence');
    deepEqual([...exactScope.appliedOperationIds].sort(), [...physical.canonical.appliedOperationIds].sort(), 'bound scope APPLY must equal full canonical physical selection');

    const scopedPreview = bindCiiTransferScopeToPreview(preview, exactScope.selection);
    equal(scopedPreview.writerReadiness.ready, true, `mixed readiness blockers=${(scopedPreview.writerReadiness.blockers || []).join('|')}`);
    equal(scopedPreview.writerReadiness.familyMutationCounts.nodeNameReplace, replacementCount, 'readiness replacement count');
    equal(scopedPreview.writerReadiness.familyMutationCounts.nodeNameStructural, structuralCount, 'readiness structural count');
    const applied = await applyCiiWorkspaceTargetWriter2WithVersionBridge(scopedPreview, targetBytes, { cryptoRef: crypto });
    equal(applied.versionBridgeValidation.status, 'PASS', 'V11/V14 bridge validation must pass');

    const structuralPostimage = evaluatePartialTExpectedPostimage(targetText, applied.byteString, expectedText, physical.operations);
    const emittedRawIdentity = validateAppliedRawIdentity(applied.byteString, physical.operations);
    const knownPositiveNames = validateKnownPositiveNodeNames(applied.byteString, expectedDelta.rows, physical.operations);
    const byteClosure = validateIndependentMixedNodeNameByteClosure(targetText, applied.byteString, {
      expectedDeltas: selectedOperationDeltas(physical.operations),
      selectedOperations: physical.operations,
    });
    equal(structuralPostimage.preservation.status, 'READY', 'output must preserve target outside NodeName mutation authority');
    equal(structuralPostimage.nodeNamePayloadPreservation.status, 'READY', 'unselected target NODENAME payloads must be unchanged');
    equal(structuralPostimage.encoding.differences.length, 0, 'selected output must remain structurally well-formed');
    equal(structuralPostimage.semantics.differences.length, 0, 'all lower-bound positives must be recovered');
    equal(emittedRawIdentity.status, 'READY', `exact raw emission errors=${JSON.stringify(emittedRawIdentity.errors.slice(0, 10))}`);
    equal(knownPositiveNames.status, 'READY', `known-positive NodeName errors=${JSON.stringify(knownPositiveNames.differences.slice(0, 10))}`);
    equal(byteClosure.status, 'READY', `raw-byte closure errors=${JSON.stringify(byteClosure.differences.slice(0, 10))}`);
    equal(structuralPostimage.status, 'READY', 'retained mixed postimage must satisfy lower-bound oracle');

    return {
      autoAnchor: automatic.choices.map((choice) => ({ sourceId: choice.sourceId, status: choice.status, sourceNodeId: choice.sourceNodeId, targetNodeId: choice.targetNodeId, confidence: choice.confidence, basisMethod: choice.basisMethod, outcomeSignature: choice.outcomeSignature })),
      correspondence: { status: preview.correspondence.status, nodeRows: preview.correspondence.nodeRows.length, conflicts: preview.correspondence.conflicts.length },
      transfer: {
        knownPositiveLowerBoundCount: expectedKeys.length,
        actualApplyRowCount: physical.keys.length,
        missingKnownPositiveKeys,
        additionalQualifiedKeys,
        replacementCount,
        structuralCount,
        duplicateCorroborationCount: physical.canonical.duplicateOperationIds.length,
        rawMutationIdentity: rawMutationIdentity.status,
        sourceOnlyCreateOperationIds: rawMutationIdentity.sourceOnlyCreateOperationIds,
      },
      bm001: exactScope.authority.correspondenceCoverage,
      compare: {
        lowerBoundPostimageStatus: structuralPostimage.status,
        structuralEncodingDifferences: structuralPostimage.encoding.differences.length,
        knownPositiveNameStatus: knownPositiveNames.status,
        knownPositiveNameDifferences: knownPositiveNames.differences.length,
        byteClosureStatus: byteClosure.status,
        byteClosureDifferences: byteClosure.differences.length,
        unrelatedTargetDifferences: structuralPostimage.preservation.differences.length,
        unselectedNodeNamePayloadDifferences: structuralPostimage.nodeNamePayloadPreservation.differences.length,
      },
      versionBridgeStatus: applied.versionBridgeValidation.status,
      ownerCheckpointEvidence: checkpointDiagnostics(preview, expectedRelocations),
    };
  });

  console.log(JSON.stringify(diagnostics, null, 2));
  expect(diagnostics.correspondence.status).toBe('READY');
  expect(diagnostics.transfer.actualApplyRowCount).toBeGreaterThanOrEqual(diagnostics.transfer.knownPositiveLowerBoundCount);
  expect(diagnostics.transfer.missingKnownPositiveKeys).toEqual([]);
  expect(diagnostics.transfer.replacementCount).toBeGreaterThanOrEqual(35);
  expect(diagnostics.transfer.rawMutationIdentity).toBe('READY');
  expect(diagnostics.bm001.invalidOperationIds).toEqual([]);
  expect(diagnostics.compare.lowerBoundPostimageStatus).toBe('READY');
  expect(diagnostics.compare.knownPositiveNameStatus).toBe('READY');
  expect(diagnostics.compare.byteClosureStatus).toBe('READY');
  expect(diagnostics.versionBridgeStatus).toBe('PASS');
});

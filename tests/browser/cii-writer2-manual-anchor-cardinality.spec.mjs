import { expect, test } from '@playwright/test';

test('retained S1 manual anchors are measured as independent propagation seeds, not mutation cardinality', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  const diagnostics = await page.evaluate(async () => {
    const [sourceSet, baseSelection, multiPreview, singlePreview, censusModule, benchmarkModule] = await Promise.all([
      import('/tabs/cii-workspace/cii-workspace-source-set.js'),
      import('/tabs/cii-workspace/cii-workspace-base-loop-selection.js'),
      import('/tabs/cii-workspace/cii-workspace-multisource-preview.js'),
      import('/tabs/cii-workspace/cii-workspace-writer-version-bridge.js'),
      import('/tabs/cii-workspace/cii-workspace-source-target-audit.js'),
      import('/tabs/cii-workspace/cii-workspace-benchmark-overlay.js'),
    ]);
    const { inspectCiiWorkspaceSourceSetWithVersionBridge } = sourceSet;
    const { ciiAutomaticBaseSelection } = baseSelection;
    const { createCiiWriter2SourceSetPreviewWithVersionBridge } = multiPreview;
    const { createCiiWorkspacePreviewWithVersionBridge } = singlePreview;
    const { buildCiiSourceTargetAudit } = censusModule;
    const { deriveCiiNodeNameBenchmarkDeltaFromCii, buildCiiSourceTargetBenchmarkOverlay } = benchmarkModule;

    function assert(condition, message) { if (!condition) throw new Error(message); }
    async function fetchBytes(path) {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`RETAINED_BENCHMARK_HTTP:${path}:${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    }
    function automaticLoops(inspection) {
      const loops = {};
      for (const member of inspection.memberInspections || []) {
        const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
        if (choice.status === 'READY') loops[member.sourceId] = choice.baseLoops;
      }
      return loops;
    }
    function s1Metrics(preview, benchmark, elapsedMs, scenario) {
      const audit = buildCiiSourceTargetAudit(preview);
      const overlay = buildCiiSourceTargetBenchmarkOverlay(audit, benchmark);
      const s1Rows = audit.rows.filter((row) => row.sourceId === 'S1');
      const member = preview.memberPreviews.find((item) => item.sourceId === 'S1')?.preview;
      const s1Key = (value) => String(value || '').startsWith('S1:');
      const expectedWithS1Correspondence = overlay.rows.filter((row) => (row.sourceRowKeys || []).some(s1Key)).length;
      const expectedWithS1Mutation = overlay.rows.filter((row) => (row.mutationSourceRowKeys || []).some(s1Key)).length;
      return {
        scenario: scenario.name,
        anchorCount: scenario.anchors.length,
        anchors: scenario.anchors,
        elapsedMs: Number(elapsedMs.toFixed(1)),
        memberStatus: member?.correspondence?.status || 'UNKNOWN',
        authorityMode: member?.multiBaseAuthority?.inputMode || 'UNKNOWN',
        combination: member?.multiBaseCorrespondence?.combination || 'UNKNOWN',
        seedCoverage: member?.multiBaseCorrespondence?.seedCoverage || null,
        seedDiagnostics: member?.multiBaseCorrespondence?.seedDiagnostics || [],
        memberBlockers: member?.correspondence?.blockers || [],
        crossSeedConflicts: member?.multiBaseCorrespondence?.conflicts?.length || 0,
        lockedNodeRows: (member?.correspondence?.nodeRows || []).filter((row) => row.status === 'LOCKED').length,
        emittedNodeRows: (member?.correspondence?.nodeRows || []).length,
        boundNodeCount: s1Rows.filter((row) => row.state === 'BOUND').length,
        unresolvedNodeCount: s1Rows.filter((row) => row.state === 'UNRESOLVED').length,
        ambiguousNodeCount: s1Rows.filter((row) => row.state === 'AMBIGUOUS').length,
        unemittedNodeCount: s1Rows.filter((row) => row.state === 'UNEMITTED').length,
        qualifiedNodeNameChangeCount: s1Rows.filter((row) => row.qualifiedNodeNameChange).length,
        knownPositiveCorrespondenceRecoveredByS1: expectedWithS1Correspondence,
        knownPositiveMutationRecoveredByS1: expectedWithS1Mutation,
        additionalQualifiedByS1: overlay.additionalQualifiedRows.filter((row) => row.sourceId === 'S1').length,
      };
    }
    function legacyMetrics(preview, elapsedMs, scenario) {
      const rows = preview?.compareReview?.rows || [];
      return {
        scenario: scenario.name,
        anchorCount: scenario.anchors.length,
        elapsedMs: Number(elapsedMs.toFixed(1)),
        authorityMode: preview?.multiBaseAuthority?.inputMode || 'UNKNOWN',
        combination: preview?.multiBaseCorrespondence?.combination || 'UNKNOWN',
        correspondenceStatus: preview?.correspondence?.status || 'UNKNOWN',
        nodeRows: (preview?.correspondence?.nodeRows || []).length,
        boundReviewRows: rows.filter((row) => row.kind === 'NODE' && row.identityBound).length,
        blockers: preview?.correspondence?.blockers || [],
      };
    }
    function rankScenario(row) {
      return [
        row.crossSeedConflicts ? 0 : 1,
        row.knownPositiveMutationRecoveredByS1,
        row.knownPositiveCorrespondenceRecoveredByS1,
        row.boundNodeCount,
        -row.unresolvedNodeCount,
        -row.ambiguousNodeCount,
        -row.anchorCount,
      ];
    }
    function compareRank(a, b) {
      const left = rankScenario(a); const right = rankScenario(b);
      for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return right[index] - left[index];
      return a.scenario.localeCompare(b.scenario);
    }

    const sourceNames = ['S1.CII', 'S2.CII', 'S3.CII'];
    const sourceBytes = await Promise.all(sourceNames.map((name) => fetchBytes(`/Benchmark/${name}`)));
    const [targetBytes, expectedBytes] = await Promise.all([
      fetchBytes('/Benchmark/T.CII'),
      fetchBytes('/Benchmark/TEXPECTED-PARTIALLLYDONE.CII'),
    ]);
    const sources = sourceNames.map((fileName, index) => ({ sourceId: `S${index + 1}`, fileName, bytes: sourceBytes[index] }));
    const benchmark = await deriveCiiNodeNameBenchmarkDeltaFromCii(targetBytes, expectedBytes, {
      beforeFileName: 'T.CII', expectedFileName: 'TEXPECTED-PARTIALLLYDONE.CII', cryptoRef: crypto,
    });
    assert(benchmark.rows.length > 0, 'dynamic retained benchmark must contain at least one positive delta');

    const inspection = await inspectCiiWorkspaceSourceSetWithVersionBridge({ sources, targetBytes, targetFileName: 'T.CII' }, { cryptoRef: crypto });
    const baseLoopsBySource = automaticLoops(inspection);
    assert(baseLoopsBySource.S2?.length, 'S2 automatic base must remain available for the experiment');
    assert(baseLoopsBySource.S3?.length, 'S3 automatic base must remain available for the experiment');
    delete baseLoopsBySource.S1;

    const scenarios = [
      { name: 'ONE', anchors: [{ sourceNodeId: '3910', targetNodeId: '875' }] },
      { name: 'TWO', anchors: [{ sourceNodeId: '3910', targetNodeId: '875' }, { sourceNodeId: '3940', targetNodeId: '880' }] },
      { name: 'THREE', anchors: [{ sourceNodeId: '3910', targetNodeId: '875' }, { sourceNodeId: '3940', targetNodeId: '880' }, { sourceNodeId: '3870', targetNodeId: '870' }] },
    ];

    const seedResults = [];
    for (const scenario of scenarios) {
      const started = performance.now();
      const preview = await createCiiWriter2SourceSetPreviewWithVersionBridge({
        sources, targetBytes, targetFileName: 'T.CII', baseLoopsBySource,
        anchorPairsBySource: { S1: scenario.anchors },
      }, { cryptoRef: crypto });
      seedResults.push(s1Metrics(preview, benchmark, performance.now() - started, scenario));
    }

    const legacyResults = [];
    for (const scenario of scenarios.filter((row) => row.anchorCount !== 1 && row.anchors.length > 1)) {
      const started = performance.now();
      const preview = await createCiiWorkspacePreviewWithVersionBridge({
        sourceBytes: sourceBytes[0], sourceFileName: 'S1.CII',
        targetBytes, targetFileName: 'T.CII', anchorPairs: scenario.anchors,
      }, { cryptoRef: crypto, writerVersion: '2' });
      legacyResults.push(legacyMetrics(preview, performance.now() - started, scenario));
    }

    for (const row of seedResults) {
      assert(row.authorityMode === 'INDEPENDENT_MANUAL_SEEDS', `${row.scenario}: multi-source manual anchors must use independent seed authority`);
      assert(row.lockedNodeRows >= row.anchorCount, `${row.scenario}: every reviewed anchor must remain visible as a locked node claim`);
    }
    assert(seedResults[0].combination === 'INDEPENDENT_MANUAL_SEED', 'one-anchor scenario must retain single-seed propagation');
    assert(seedResults[1].combination === 'INDEPENDENT_MANUAL_SEEDS_WITH_CONFLICT_VETO', 'two anchors must be independent seeds, not a locked span');
    assert(seedResults[2].combination === 'INDEPENDENT_MANUAL_SEEDS_WITH_CONFLICT_VETO', 'three anchors must be independent seeds, not a locked span');
    for (const row of legacyResults) {
      assert(row.authorityMode === 'LEGACY_ANCHOR_PAIRS', `${row.scenario}: generic legacy baseline must remain unchanged`);
      assert(row.combination === 'LEGACY_SINGLE_LOOP_COMPATIBILITY', `${row.scenario}: baseline must still exercise historical locked-span path`);
    }

    const ranked = [...seedResults].sort(compareRank);
    return {
      benchmarkExpectedCount: benchmark.summary.expectedCount,
      seedResults,
      legacySpanBaselines: legacyResults,
      recommendation: {
        scenario: ranked[0].scenario,
        anchorCount: ranked[0].anchorCount,
        basis: 'max conflict-free known-positive mutation recovery, then correspondence recovery, bound coverage, lower ambiguity, then fewer anchors',
      },
    };
  });

  console.log(JSON.stringify(diagnostics, null, 2));
  expect(diagnostics.seedResults).toHaveLength(3);
  expect(diagnostics.legacySpanBaselines).toHaveLength(2);
  expect(diagnostics.benchmarkExpectedCount).toBeGreaterThan(0);
  expect(['ONE', 'TWO', 'THREE']).toContain(diagnostics.recommendation.scenario);
});

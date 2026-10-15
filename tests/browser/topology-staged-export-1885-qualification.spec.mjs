import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const BENCHMARK_SHA256 = '38c6080c73f84e55581ad75dcbfb6b580ea587fc287ecf1861d9dc8e793b5cd3';
const REPRESENTABLE_OPERATIONS = new Set(['MOVE_NODE', 'MERGE_NODES', 'TRIM_EDGE']);

test('TTV-C06 — exact 1885 staged export preserves hierarchy shape and rebuilds the edited topology', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/tests/browser/topology-checker-autofix-1885-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyValidatorReady === '1'
    || Boolean(document.body.dataset.topologyValidatorError), null, { timeout: 180_000 });
  expect(await page.evaluate(() => document.body.dataset.topologyValidatorError || '')).toBe('');

  await page.locator('[data-ttv-checker-open]').click();
  const beforeRunCount = await page.evaluate(() => window.__topologyValidatorHarness.controller.checker.evidence().autoFixRuns.length);
  await page.locator('[data-ttv-checker-auto-fix]').click();
  await page.waitForFunction((count) => window.__topologyValidatorHarness.controller.checker.evidence().autoFixRuns.length > count,
    beforeRunCount, { timeout: 180_000 });

  const committed = await page.evaluate(() => {
    const harness = window.__topologyValidatorHarness;
    const checker = harness.controller.checker.evidence();
    const edit = harness.controller.evidence().edit;
    return {
      run: checker.autoFixRuns.at(-1),
      editedCanonicalTopologyHash: edit.editedArtifacts.canonicalTopology.canonicalTopologyHash,
      sourceHash: edit.projectDocument.sourceHash,
      draftHash: edit.draft.topologyEditDraftHash,
      activeCommandIds: edit.commandJournal.activeCommandIds,
    };
  });
  expect(committed.run.committed).toBe(true);
  expect(committed.run.applied).toHaveLength(60);
  expect(committed.run.rejected).toHaveLength(0);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-ttv-edit-export-staged]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_edited_stage\.json$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  const text = bytes.toString('utf8');
  const exported = JSON.parse(text);
  const exportSha256 = createHash('sha256').update(bytes).digest('hex');

  expect(Array.isArray(exported)).toBe(true);
  expect(exported).toHaveLength(23);
  expect(Object.hasOwn(exported, 'provenance')).toBe(false);

  const directExport = await page.evaluate(async () => {
    const exporter = await import('/tabs/topology-trace-validator/topology-staged-export.js');
    const ledger = await import('/tabs/topology-trace-validator/topology-update-ledger-model.js');
    const harness = window.__topologyValidatorHarness;
    const controllerEvidence = harness.controller.evidence();
    const edit = controllerEvidence.edit;
    const rows = ledger.buildUpdateLedgerRows({
      draft: edit.draft,
      attributeLedger: edit.attributeLedger,
      remarks: edit.remarks,
    });
    return exporter.buildStagedExport({
      baseStagedJson: controllerEvidence.trace.artifacts.source.raw,
      baseCanonical: edit.baseArtifacts.canonicalTopology,
      draft: edit.draft,
      editedCanonicalHash: edit.editedArtifacts.canonicalTopology.canonicalTopologyHash,
      attributeLedger: edit.attributeLedger,
      commandJournal: edit.commandJournal,
      exportedAt: '2026-07-28T08:00:00.000Z',
      ledgerRows: rows,
    });
  });
  const provenance = directExport.provenance;
  expect(JSON.parse(directExport.text)).toEqual(exported);
  expect(provenance.schema).toBe('StagedEditProvenance.v1');
  expect(provenance.baseCanonicalTopologyHash).toBe(committed.run.beforeTopologyHash);
  expect(provenance.topologyEditDraftHash).toBe(committed.draftHash);
  expect(provenance.editedCanonicalTopologyHash).toBe(committed.editedCanonicalTopologyHash);
  expect(provenance.commandJournal.activeCommandIds).toEqual(committed.activeCommandIds);
  expect(provenance.positionIdentityToleranceMm).toBe(1e-6);
  expect(provenance.positionRemaps).toHaveLength(60);
  expect(provenance.supportSourcePositionField).toBe('TOPOLOGY_SOURCE_POSITION');
  expect(provenance.supportCarrierAuthorityField).toBe('TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH');
  expect(provenance.supportProjectionEvidencePreserved).toBe(10);
  expect(directExport.summary.supportProjectionEvidencePreserved).toBe(10);
  expect(provenance.ledger).toHaveLength(60);
  expect(directExport.summary.rootShape).toBe('array');

  const operations = flattenOperations(provenance.commands);
  expect(operations).toHaveLength(60);
  expect(new Set(operations.map((row) => row.type))).toEqual(new Set(['MOVE_NODE']));
  expect(operations.every((row) => REPRESENTABLE_OPERATIONS.has(row.type))).toBe(true);
  const remapsByNode = new Map(provenance.positionRemaps.map((row) => [row.nodeId, row]));
  expect(remapsByNode.size).toBe(60);
  for (const operation of operations) {
    const remap = remapsByNode.get(operation.payload.nodeId);
    expect(remap, `missing staged remap for ${operation.payload.nodeId}`).toBeTruthy();
    expect(remap.to).toEqual([operation.payload.position.x, operation.payload.position.y, operation.payload.position.z]);
  }

  const roundTrip = await page.evaluate(async (stagedText) => {
    const core = await import('/vendor/3d-converters/topology-browser-core.mjs');
    const staged = await import('/workbench3d/core/staged-json-core.js');
    const parsed = JSON.parse(stagedText);
    const root = staged.readStagedBranches(parsed);
    const producerText = JSON.stringify(root.branches);
    const options = {
      sourceName: 'ATTRIBUTE_managed_stage_1885_Steam_edited_stage.json',
      jobName: '1885 Steam Staged Export Round Trip',
      toleranceMm: 0.1,
      supportProjectionToleranceMm: 50,
      enrichmentConfig: {},
    };
    const built = await core.buildComponentTopologyArtifacts(producerText, options);
    const report = core.runTopologyChecks(built.canonicalTopology, {
      shortElementMm: 6, toleranceMm: 0.1, snapToleranceMm: 25,
      angleToleranceDeg: 5, originToleranceMm: 0.1, clearanceMm: 0,
    });
    const harness = window.__topologyValidatorHarness;
    const edit = harness.controller.evidence().edit;
    const checker = harness.controller.checker.evidence();
    const editedCanonical = edit.editedArtifacts.canonicalTopology;
    const normalizedProjection = engineeringProjection(built.canonicalTopology);
    const editedProjection = engineeringProjection(editedCanonical);
    return {
      rootShape: Array.isArray(parsed) ? 'array' : root.rootKey,
      branchCount: root.branches.length,
      normalizedCanonicalTopologyHash: built.canonicalTopology.canonicalTopologyHash,
      editedCanonicalTopologyHash: editedCanonical.canonicalTopologyHash,
      normalizedEngineeringSignature: await sha256(JSON.stringify(normalizedProjection)),
      editedEngineeringSignature: await sha256(JSON.stringify(editedProjection)),
      normalizedCollectionSignatures: await collectionSignatures(normalizedProjection),
      editedCollectionSignatures: await collectionSignatures(editedProjection),
      firstNodeDifference: firstDifference(normalizedProjection.nodes, editedProjection.nodes),
      firstSupportDifference: firstDifference(normalizedProjection.supports, editedProjection.supports),
      normalizedFindingSignature: await findingSignature(report),
      editedFindingSignature: await findingSignature(checker.report),
      activeFindingCount: report.issues.length,
      expectedShortCount: report.issues.filter((row) => row.code === 'EXPECTED_SHORT_INLINE_COMPONENT').length,
      nodeCount: built.canonicalTopology.nodes.length,
      edgeCount: built.canonicalTopology.edges.length,
      editedNodeCount: editedCanonical.nodes.length,
      editedEdgeCount: editedCanonical.edges.length,
    };

    function engineeringProjection(canonical) {
      const nodes = canonical?.nodes ?? [];
      const nodePositions = new Map(nodes.map((node) => [String(node.id ?? ''), normalize(node.position)]));
      const projection = {
        nodes: sorted(nodes.map((node) => engineeringRecord({ ...node, id: undefined }))),
        edges: sorted((canonical?.edges ?? []).map((edge) => engineeringRecord({
          ...edge,
          id: undefined,
          fromNodeId: undefined,
          toNodeId: undefined,
          fromPosition: nodePositions.get(String(edge.fromNodeId ?? '')) ?? null,
          toPosition: nodePositions.get(String(edge.toNodeId ?? '')) ?? null,
        }))),
      };
      for (const key of ['pointFeatures', 'junctions', 'boundaries', 'supports', 'rigids', 'bends']) {
        projection[key] = sorted((canonical?.[key] ?? []).map(engineeringRecord));
      }
      return projection;
    }

    function engineeringRecord(value) {
      if (Array.isArray(value)) return value.map(engineeringRecord);
      if (!value || typeof value !== 'object') return value;
      const excluded = new Set([
        'canonicalTopologyHash', 'sourceIdentity', 'sourcePath', 'sourcePaths', 'sourceRef',
        'sourceEntityId', 'sourceEntityIds', 'sourcePortId', 'sourcePortIds',
        'viewKey', 'recordId', 'inputHash', 'contentHash', 'createdAt', 'updatedAt',
        'generatedAt', 'sourceName', 'jobName', 'positionAuthority', 'sourcePosition',
      ]);
      return Object.fromEntries(Object.keys(value).sort()
        .filter((key) => value[key] !== undefined && !excluded.has(key) && key !== 'id' && !/Ids?$/.test(key))
        .map((key) => [key, engineeringRecord(value[key])]));
    }

    function sorted(values) {
      return values.map(engineeringRecord).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    }

    function firstDifference(left, right) {
      const length = Math.max(left.length, right.length);
      for (let index = 0; index < length; index += 1) {
        if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
          return { index, normalized: left[index] ?? null, edited: right[index] ?? null };
        }
      }
      return null;
    }

    async function collectionSignatures(projection) {
      return Object.fromEntries(await Promise.all(Object.entries(projection)
        .map(async ([key, value]) => [key, await sha256(JSON.stringify(value))])));
    }

    async function findingSignature(value) {
      const issues = (value?.issues ?? []).map((issue) => normalize({
        code: issue.code,
        category: issue.category,
        severity: issue.severity,
        blocking: issue.blocking,
        message: issue.message,
        objectIds: issue.objectIds,
        details: issue.details,
        location: issue.location,
      }));
      return sha256(JSON.stringify(issues));
    }

    function normalize(value) {
      if (Array.isArray(value)) return value.map(normalize);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
    }

    async function sha256(value) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  }, text);

  const qualificationEvidence = {
    benchmarkSha256: BENCHMARK_SHA256,
    exportSha256,
    exportByteLength: bytes.length,
    committed,
    export: {
      rootShape: directExport.summary.rootShape,
      branchCount: exported.length,
      positionIdentityToleranceMm: provenance.positionIdentityToleranceMm,
      remapCount: provenance.positionRemaps.length,
      operationCount: operations.length,
      operationTypes: [...new Set(operations.map((row) => row.type))],
      ledgerCount: provenance.ledger.length,
      supportSourcePositionField: provenance.supportSourcePositionField,
      supportCarrierAuthorityField: provenance.supportCarrierAuthorityField,
      supportProjectionEvidencePreserved: provenance.supportProjectionEvidencePreserved,
    },
    roundTrip,
  };
  const evidenceDirectory = 'qualification-evidence/topology-1885';
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(`${evidenceDirectory}/ATTRIBUTE_managed_stage_1885_Steam_edited_stage.json`, bytes);
  fs.writeFileSync(`${evidenceDirectory}/topology-staged-export-1885-provenance.json`, directExport.provenanceText);
  fs.writeFileSync(`${evidenceDirectory}/topology-staged-export-1885-evidence.json`, `${JSON.stringify(qualificationEvidence, null, 2)}\n`);

  await testInfo.attach('ATTRIBUTE_managed_stage_1885_Steam_edited_stage.json', {
    body: bytes,
    contentType: 'application/json',
  });
  await testInfo.attach('topology-staged-export-1885-provenance.json', {
    body: Buffer.from(directExport.provenanceText),
    contentType: 'application/json',
  });
  await testInfo.attach('topology-staged-export-1885-evidence.json', {
    body: Buffer.from(`${JSON.stringify(qualificationEvidence, null, 2)}\n`),
    contentType: 'application/json',
  });

  expect(roundTrip.rootShape).toBe('array');
  expect(roundTrip.branchCount).toBe(23);
  expect(roundTrip.normalizedCanonicalTopologyHash).not.toBe(roundTrip.editedCanonicalTopologyHash);
  expect(roundTrip.normalizedEngineeringSignature).toBe(roundTrip.editedEngineeringSignature);
  expect(roundTrip.normalizedCollectionSignatures).toEqual(roundTrip.editedCollectionSignatures);
  expect(roundTrip.firstNodeDifference).toBeNull();
  expect(roundTrip.firstSupportDifference).toBeNull();
  expect(roundTrip.normalizedFindingSignature).toBe(roundTrip.editedFindingSignature);
  expect(roundTrip.nodeCount).toBe(roundTrip.editedNodeCount);
  expect(roundTrip.edgeCount).toBe(roundTrip.editedEdgeCount);
  expect(roundTrip.expectedShortCount).toBe(0);
  expect(roundTrip.activeFindingCount).toBe(8);
  expect(pageErrors).toEqual([]);
});

function flattenOperations(commands) {
  const result = [];
  const visit = (command) => {
    if (command?.type === 'TRANSACTION') {
      for (const operation of command.payload?.operations ?? []) visit(operation);
      return;
    }
    result.push(command);
  };
  for (const command of commands ?? []) visit(command);
  return result;
}

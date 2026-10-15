import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiWriter2SourceSetPreviewWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import { CII_METHOD_A_WEIGHT_DEFAULTS } from '../tabs/cii-workspace/cii-workspace-method-a-weights.js';
import { ciiForensicSelectedBaseEvidence, ciiForensicRowObservations } from './cii-workspace-method-a-forensic-selection.js';

// Owner Phase 1 assertions are treated as hypotheses: this script measures each
// grade and its geometric causes rather than force-promoting any NODE identity.
const expectedSha = Object.freeze({
  'S1.CII': '9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b',
  'S2.CII': '7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd',
  'S3.CII': 'c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa',
  'T.CII': 'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060',
});
const requested = Object.freeze([
  ['S1', '4410', '970', 'HIGH'],
  ['S1', '4440', '975', 'HIGH'],
  ['S1', '4470', '980', 'HIGH'],
  ['S1', '4490', '985', 'HIGH'],
  ['S2', '360', '10280', 'HIGH'],
  ['S2', '370', '10290', 'HIGH'],
  ['S2', '390', '10300', 'HIGH'],
  ['S2', '400', '10310', 'HIGH'],
  ['S3', '1610', '8920', 'HIGH'],
  ['S3', '1620', '8940', 'HIGH'],
  ['S3', '1640', '8950', 'HIGH'],
]);

const fixture = (name) => readFileSync(fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url)));
for (const [fileName, sha] of Object.entries(expectedSha)) {
  assert.equal(createHash('sha256').update(fixture(fileName)).digest('hex'), sha, `${fileName} fixture changed`);
}
const sources = ['S1', 'S2', 'S3'].map((sourceId) => ({
  sourceId, fileName: `${sourceId}.CII`, bytes: fixture(`${sourceId}.CII`),
}));
const targetBytes = fixture('T.CII');
const cryptoRef = globalThis.crypto || webcrypto;
const policy = Object.freeze({
  methodAHighConfidenceThreshold: 85, methodAMediumConfidenceThreshold: 70,
  methodAConfidenceWeights: CII_METHOD_A_WEIGHT_DEFAULTS,
});
const inspection = await inspectCiiWorkspaceSourceSetWithVersionBridge(
  { sources, targetBytes, targetFileName: 'T.CII' }, { cryptoRef, ...policy },
);
assert.equal(inspection.memberInspections.length, 3);
const baseLoopsBySource = {};
const baseEvidence = {};
const baseSelection = {};
for (const member of inspection.memberInspections) {
  const suggestions = member.inspection?.baseAnchorSuggestions || [];
  const choice = ciiAutomaticBaseSelection(suggestions);
  baseSelection[member.sourceId] = {
    status: choice.status, reason: choice.reason,
    selectedSourceNodeId: choice.sourceNodeId || null,
    selectedTargetNodeId: choice.targetNodeId || null,
    evidenceTuple: choice.evidenceTuple || null,
    candidateCount: choice.candidates?.length || 0,
    outcomeSignature: choice.outcomeSignature || null,
  };
  baseLoopsBySource[member.sourceId] = choice.baseLoops || [];
  const selectedEvidence = ciiForensicSelectedBaseEvidence(suggestions, choice);
  // A selected Method A invocation descriptor must be traceable to original
  // base evidence. Null scores are a report defect, not a passed qualification.
  for (const base of selectedEvidence.filter((item) => item.method === 'METHOD_A_SPATIAL')) {
    assert.equal(base.evidenceStatus, 'READY',
      `Selected Method A base evidence missing for ${member.sourceId}:${base.baseId}`);
    assert(Number.isFinite(base.score), 'Selected Method A score must be finite');
    assert(base.weights, 'Selected Method A score weights must be reported');
  }
  baseEvidence[member.sourceId] = selectedEvidence;
}
const preview = await createCiiWriter2SourceSetPreviewWithVersionBridge({
  sources, targetBytes, targetFileName: 'T.CII', baseLoopsBySource,
}, { cryptoRef, ...policy });
assert.deepEqual(preview.audit?.methodAConfidencePolicy, { high: 85, medium: 70 },
  'retained audit must serialize the applied default confidence policy');
assert.deepEqual(JSON.parse(preview.artifacts.auditJson)?.methodAConfidencePolicy,
  { high: 85, medium: 70 }, 'downloadable JSON audit must retain threshold custody');
assert.deepEqual(preview.audit?.methodAConfidenceWeights, CII_METHOD_A_WEIGHT_DEFAULTS);
assert.deepEqual(JSON.parse(preview.artifacts.auditJson)?.methodAConfidenceWeights,
  CII_METHOD_A_WEIGHT_DEFAULTS, 'downloadable JSON audit must retain weight custody');

function focusedS3AlignmentTrace(memberPreviews) {
  const member = (memberPreviews || []).find((row) => row.sourceId === 'S3')?.preview;
  const results = member?.multiBaseCorrespondence?.loopResults || [];
  const selected = results.find((row) => row.loop?.method === 'METHOD_A_SPATIAL') || null;
  const correspondence = selected?.correspondence;
  const sourceEdges = correspondence?.sourcePath?.elements || [];
  const targetEdges = correspondence?.targetPath?.elements || [];
  const operations = correspondence?.alignment?.operations || [];
  const focus = new Set(['1740', '1750', '1760', '1770']);
  const sourceLocal = sourceEdges.filter((edge) => focus.has(String(edge.routeFrom)) || focus.has(String(edge.routeTo)));
  const sourceLocalIds = new Set(sourceLocal.map((edge) => String(edge.elementId)));
  const operationIndexes = operations.flatMap((operation, index) =>
    sourceLocalIds.has(String(operation.sourceElementId || '')) ? [index] : []);
  const selectedIndexes = new Set(operationIndexes.flatMap((index) =>
    [index - 3, index - 2, index - 1, index, index + 1, index + 2, index + 3]
      .filter((value) => value >= 0 && value < operations.length)));
  const focusedOperations = operations.flatMap((operation, index) =>
    selectedIndexes.has(index) ? [{ index, ...operation }] : []);
  return {
    evidenceStatus: 'READ_ONLY_ALIGNMENT_OPERATION_TRACE_NOT_IDENTITY_AUTHORITY',
    selectedLoopMethod: selected?.loop?.method || null,
    selectedLoopStatus: correspondence?.status || null,
    selectedLoopId: selected?.loop?.loopId || null,
    selectedSourcePath: {
      startNode: correspondence?.sourcePath?.startNode || null,
      endNode: correspondence?.sourcePath?.endNode || null,
      edgeCount: sourceEdges.length,
    },
    selectedTargetPath: {
      startNode: correspondence?.targetPath?.startNode || null,
      endNode: correspondence?.targetPath?.endNode || null,
      edgeCount: targetEdges.length,
    },
    sourceLocalEdges: sourceLocal.map((edge) => ({
      elementId: edge.elementId, routeFrom: edge.routeFrom, routeTo: edge.routeTo,
      componentKind: edge.componentKind, diameter: edge.diameter, lengthMm: edge.lengthMm,
    })),
    targetLocalEdges: targetEdges.filter((edge) => focusedOperations.some((operation) =>
      String(operation.targetElementId || '') === String(edge.elementId))).map((edge) => ({
      elementId: edge.elementId, routeFrom: edge.routeFrom, routeTo: edge.routeTo,
      componentKind: edge.componentKind, diameter: edge.diameter, lengthMm: edge.lengthMm,
    })),
    localElementRows: (correspondence?.elementRows || [])
      .filter((row) => sourceLocalIds.has(String(row.sourceElementId || '')))
      .map((row) => {
        const original = row.evidence?.element || row.evidence || {};
        const m1 = original.methods?.m1Spatial || {};
        const m2 = original.methods?.m2Network || {};
        const od = original.dimensions?.diameter || {};
        return {
          sourceElementId: row.sourceElementId, targetElementIds: row.targetElementIds,
          status: row.status, candidateStatus: row.evidence?.candidates?.status || null,
          original: {
            hardFail: original.hardFail === true,
            identitySupported: original.identitySupported === true,
            identityConfidence: original.identityConfidence || null,
            m1Available: m1.available === true, m1Pass: m1.pass === true,
            m1Basis: m1.basis || null, m1Orientation: m1.orientation || null,
            m1EndpointDistancesMm: m1.endpointDistancesMm || [],
            m1ToleranceMm: m1.toleranceMm ?? null,
            m2Pass: m2.pass === true, m2Score: m2.score ?? null,
            m2Threshold: m2.threshold ?? null, m2Blockers: m2.blockers || [],
            odAvailable: od.available === true, odPass: od.pass === true,
            odSource: od.source ?? null, odTarget: od.target ?? null,
            odRelativeDelta: od.relativeDelta ?? null,
          },
        };
      }),
    operationCount: operations.length,
    operationIndexCount: operationIndexes.length,
    focusedOperations,
    matchedNodeRows: (correspondence?.nodeRows || []).filter((row) => focus.has(String(row.sourceNodeId)))
      .map((row) => ({
        sourceNodeId: row.sourceNodeId, targetNodeId: row.targetNodeId,
        status: row.status, authority: row.authority,
        identityEvidenceBasis: row.evidence?.identityEvidenceBasis || null,
        boundaryIdentity: row.evidence?.boundaryIdentity || null,
      })),
    pathGate: correspondence?.pathGate ? {
      status: correspondence.pathGate.status,
      blockers: correspondence.pathGate.blockers || [],
    } : null,
  };
}
const s3InteriorAlignmentTrace = focusedS3AlignmentTrace(preview.memberPreviews);

// Independent registered endpoint after a skipped SOURCE segment may be bound,
// but the skipped segment's other endpoint must never inherit its identity.
const s3Preview = (preview.memberPreviews || []).find((item) => item.sourceId === 'S3')?.preview;
assert(s3Preview, 'S3 retained member preview required');
const s3ReviewRows = (s3Preview.compareReview?.rows || []).filter((row) => row.kind === 'NODE');
const recovered = s3ReviewRows.filter((row) => String(row.source) === '1760' && String(row.target) === '9060');
assert.equal(recovered.length, 1, 'S3 1760 must project exactly one registered endpoint correspondence');
assert.equal(recovered[0].identityBound, true, 'S3 1760 must be physically bound');
assert.equal(recovered[0].confidence, 'MEDIUM', 'Method A base ceiling must remain MEDIUM');
assert.equal(recovered[0].methodABoundaryDiagnostics?.localBoundary?.reason,
  'REGISTERED_ENDPOINT_M2_OD_SUPPORTED');
assert.equal(s3ReviewRows.some((row) => String(row.source) === '1750'), false,
  'S3 1750 must not inherit TARGET 9060 across the deleted segment');

const observed = ciiForensicRowObservations(preview, requested);
assert.equal(observed.length, 11, 'all owner-reported Phase 1 NODE pairs must appear in forensic output');
console.log(JSON.stringify({
  schema: 'CiiPhase1MethodAGradeForensics.v1',
  evidenceStatus: 'FORENSIC_REPORT_ONLY_NOT_ACCEPTANCE',
  sourceSetSha256: inspection.sourceSet?.sourceSetSha256,
  confidencePolicy: policy, baseEvidence, baseSelection,
  s3InteriorAlignmentTrace,
  inspectionStatus: inspection.status, previewStatus: preview.correspondence?.status,
  emitted: observed.filter((row) => row.status === 'EMITTED').length,
  unEmitted: observed.filter((row) => row.status !== 'EMITTED').length,
  observations: observed,
}, null, 2));

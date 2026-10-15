import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiRetainedMethodATerminalForensics } from './cii-workspace-method-a-terminal-continuation-forensics.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiWriter2SourceSetPreviewWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import { ciiCanonicalWriter2MutationSelection } from '../tabs/cii-workspace/cii-workspace-multisource-bm001-correspondence.js';
import { parseCiiMsBm001 } from '../tabs/cii-workspace/cii-workspace-multisource-nodename-authority.js';
import { createCiiExpectedNodeNameSourceSetSelection } from '../tabs/cii-workspace/cii-workspace-multisource-scope.js';
import { bindCiiTransferScopeToPreview } from '../tabs/cii-workspace/cii-workspace-transfer-scope.js';
import { applyCiiWorkspaceTargetWriter2WithVersionBridge } from '../tabs/cii-workspace/cii-workspace-writer-version-bridge.js';
import { deriveExactNameRelocations, deriveExpectedNodeNameDelta, parseIndependentNodeNameState } from './cii-workspace-multisource-texpected-oracle.js';
import {
  buildCiiSourceTargetAudit, ciiSourceTargetAuditToCsv, ciiSourceTargetAuditToJson,
} from '../tabs/cii-workspace/cii-workspace-source-target-audit.js';
import {
  evaluatePartialTExpectedPostimage,
  expectedNodeNameTransferKeys,
  validateAppliedRawIdentity,
  validateKnownPositiveNodeNames,
  validateRawMutationIdentity,
} from './cii-workspace-multisource-partial-texpected-oracle.js';
import {
  additionalTransferKeys,
  missingRequiredTransferKeys,
  physicalTransferKeys,
  selectedOperationDeltas,
} from './cii-workspace-multisource-lower-bound-helpers.js';
import { validateIndependentMixedNodeNameByteClosure } from './cii-workspace-multisource-byte-closure-oracle.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
const sourceNames = ['S1.CII', 'S2.CII', 'S3.CII'];
const sources = sourceNames.map((fileName, index) => ({ sourceId: `S${index + 1}`, fileName, bytes: readFileSync(benchmark(fileName)) }));
const sourceTextsById = Object.fromEntries(sources.map((source) => [source.sourceId, source.bytes.toString('latin1')]));
const targetBytes = readFileSync(benchmark('T.CII'));
const targetText = targetBytes.toString('latin1');
const expectedText = readFileSync(benchmark('TEXPECTED-PARTIALLLYDONE.CII'), 'latin1');
const expectedDelta = deriveExpectedNodeNameDelta(targetText, expectedText);
const expectedKeys = expectedNodeNameTransferKeys(expectedDelta.rows);
const expectedRelocations = deriveExactNameRelocations(expectedDelta.rows);
const bmRows = parseCiiMsBm001();

assert.equal(expectedDelta.rows.length, 36, 'retained lower-bound oracle must remain 36 known-positive NodeName deltas');
assert.equal(expectedDelta.rows.filter((row) => row.action === 'REPLACE').length, 35, 'retained lower-bound oracle must remain 35 known-positive replacements');
assert.equal(expectedDelta.rows.filter((row) => row.action === 'CREATE').length, 1, 'retained lower-bound oracle must remain one known-positive create');
assert.equal(expectedDelta.rows.filter((row) => row.action === 'DELETE').length, 0, 'retained lower-bound oracle must remain zero known-positive deletes');

function autoBaseLoops(inspection) {
  const choices = []; const loops = {};
  for (const member of inspection.memberInspections || []) {
    const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
    choices.push(Object.freeze({ sourceId: member.sourceId, ...choice }));
    if (choice.status === 'READY') loops[member.sourceId] = choice.baseLoops;
  }
  return Object.freeze({ choices: Object.freeze(choices), loops: Object.freeze(loops) });
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
  return Object.freeze({ canonical, operations: Object.freeze(operations), keys: physicalTransferKeys(operations) });
}
function checkpointDiagnostics(preview) {
  const pairs = [['8870', '9040'], ['10350', '10190'], ['1005', '925']]; const nodeRows = preview?.correspondence?.nodeRows || [];
  return Object.freeze(pairs.map(([fromNodeId, toNodeId]) => Object.freeze({
    fromNodeId, toNodeId,
    correspondenceMatches: Object.freeze(nodeRows.filter((row) => String(row?.sourceNodeId) === fromNodeId && String(row?.targetNodeId) === toNodeId)
      .map((row) => ({ sourceId: row.sourceId, correspondenceId: row.correspondenceId, status: row.status, confidence: row.confidence }))),
    exactNameRelocation: expectedRelocations.find((row) => row.fromNodeId === fromNodeId && row.toNodeId === toNodeId) || null,
  })));
}

const { inspection, preparedSession } = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge(
  { sources, targetBytes, targetFileName: 'T.CII' }, { cryptoRef });
const automatic = autoBaseLoops(inspection);
assert.equal(automatic.choices.length, 3, 'retained Auto Anchor test requires S1/S2/S3 independently');
for (const choice of automatic.choices) {
  assert.equal(choice.status, 'READY', `${choice.sourceId} Auto Anchor must resolve a unique qualified base: ${choice.reason}`);
  assert(choice.baseLoops.length > 0, `${choice.sourceId} Auto Anchor must project at least one qualified Method A/B loop`);
}
assert.deepEqual(Object.keys(automatic.loops).sort(), ['S1', 'S2', 'S3'], 'no manual/benchmark anchor may be needed for retained Auto Anchor path');

const previewInput = (reviewBySource = undefined) => ({
  sources, targetBytes, targetFileName: 'T.CII', baseLoopsBySource: automatic.loops,
  ...(reviewBySource ? { reviewBySource } : {}),
});
const discoveryPreview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput(), { cryptoRef, methodATerminalContinuation: true });
const preview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput(automaticReviewBySource(discoveryPreview)), { cryptoRef, methodATerminalContinuation: true });
assert.equal(preview.correspondence.status, 'READY', `Auto Anchor correspondence must be READY: ${(preview.correspondence.blockers || []).join(',')}`);
assert.equal(preview.correspondence.conflicts.length, 0, 'Auto Anchor correspondence must not accept cross-source target conflicts');


// The SOURCE census is independent of the emitted correspondence row count,
// NODENAME payload record count and Writer2 mutation count. Reconcile every
// physical SOURCE NODE endpoint using the test-only 15-row ELEMENTS parser.
const sourceAudit = buildCiiSourceTargetAudit(preview);
const physicalSourceIds = new Map(sources.map(({ sourceId }) => {
  const independent = parseIndependentNodeNameState(sourceTextsById[sourceId]);
  assert.deepEqual(independent.conflicts, [], sourceId + ' must have unambiguous raw name custody');
  const ids = [...new Set(independent.elements.flatMap((item) => [item.from, item.to]))]
    .sort((a, b) => Number(a) - Number(b));
  return [sourceId, ids];
}));
const physicalCounts = Object.fromEntries([...physicalSourceIds].map(([id, nodes]) => [id, nodes.length]));
assert.deepEqual(physicalCounts, { S1: 57, S2: 47, S3: 46 },
  'independent physical NODE inventory must not drift with Name payload record counts');
const independentKeys = [...physicalSourceIds].flatMap(([sourceId, ids]) => ids.map((nodeId) => sourceId + ':' + nodeId)).sort();
const actualKeys = sourceAudit.rows.map((row) => row.rowKey).sort();
assert.deepEqual(actualKeys, independentKeys, 'complete SOURCE custody requires every physical NODE exactly once and no phantom row');
assert.equal(sourceAudit.summary.totalSourceNodes, 150);
const stateNames = ['BOUND', 'UNRESOLVED', 'AMBIGUOUS', 'UNEMITTED'];
assert.equal(stateNames.reduce((sum, state) => sum + sourceAudit.summary[state], 0), 150);
assert.equal(sourceAudit.summary.bySource.length, 3);
for (const member of sourceAudit.summary.bySource) {
  const memberRows = sourceAudit.rows.filter((row) => row.sourceId === member.sourceId);
  assert.equal(member.enumeratedNodeCount, physicalCounts[member.sourceId]);
  assert.equal(stateNames.reduce((sum, state) => sum + member[state], 0), memberRows.length);
  assert.equal(member.populationStatus, 'MATCH',
    member.sourceId + ': declared vs physical node count must match, not just emitted correspondences');
}
const retainedBound = [
  ['S1', '4410', '970', 'MEDIUM'], ['S1', '4440', '975', 'MEDIUM'],
  ['S1', '4470', '980', 'MEDIUM'], ['S1', '4490', '985', 'MEDIUM'],
  ['S2', '360', '10280', 'HIGH'], ['S2', '370', '10290', 'HIGH'],
  ['S2', '390', '10300', 'HIGH'], ['S2', '400', '10310', 'HIGH'],
  ['S3', '1610', '8920', 'MEDIUM'], ['S3', '1620', '8940', 'MEDIUM'],
  ['S3', '1640', '8950', 'MEDIUM'],
];
for (const [sourceId, physicalNodeId, targetId, expectedGrade] of retainedBound) {
  const node = sourceAudit.rows.find((row) => row.rowKey === sourceId + ':' + physicalNodeId);
  assert(node, sourceId + ':' + physicalNodeId + ' physical row absent');
  assert.equal(node.state, 'BOUND', node.rowKey + ' must be bound without relying on a matching Name');
  assert.equal(node.targetNodeId, targetId, node.rowKey + ' target identity drift');
  assert.equal(node.confidence, expectedGrade, node.rowKey + ' grade drift');
}
for (const key of ['S1:4490', 'S2:400']) {
  const row = sourceAudit.rows.find((item) => item.rowKey === key);
  assert.equal(row.sourceNodeName, '', key + ': physically existing unnamed NODE must remain bound');
}
const boundTargets = new Set(sourceAudit.rows.filter((row) => row.identityBound && row.targetNodeId)
  .map((row) => row.targetNodeId));
const missingPositiveBoundTargets = expectedDelta.rows.filter((row) => !boundTargets.has(row.nodeId))
  .map((row) => row.nodeId);
assert.deepEqual(missingPositiveBoundTargets, [],
  'all 36 known-positive target mutations need a bound SOURCE physical correspondence');
// REC-02: the complete real retained 11-row unresolved set must expose the
// *individual failed predicates* before anyone considers changing identity rules.
const expectedUnboundBoundaryNodes = [
  'S1:3970', 'S1:4020', 'S1:4050', 'S1:4060',
  'S2:210', 'S2:220', 'S2:230',
  'S3:1800', 'S3:1810', 'S3:1820', 'S3:1840',
];
const unboundBoundaries = sourceAudit.rows.filter((row) =>
  expectedUnboundBoundaryNodes.includes(row.rowKey));
assert.equal(unboundBoundaries.length, expectedUnboundBoundaryNodes.length,
  'every retained Method A boundary review case must appear in the physical SOURCE census');
for (const row of unboundBoundaries) {
  assert.equal(row.state, 'UNRESOLVED', row.rowKey + ' must not be auto-promoted by diagnostic projection');
  assert.equal(row.methodABoundaryDiagnostics?.length, 1, row.rowKey + ' must retain one Method A boundary diagnosis');
  const evidence = row.methodABoundaryDiagnostics[0];
  assert.equal(evidence.upstreamIdentitySupported, false, row.rowKey + ' upstream identity must remain unsupported');
  assert.equal(evidence.localBoundary?.identitySupported, false, row.rowKey + ' local boundary is not qualified');
  const checks = evidence.localBoundary?.endpointChecks || [];
  assert.equal(checks.length, 2, row.rowKey + ' must retain both TO/FROM endpoint checks');
  assert(checks.some((item) => !item.identitySupported && item.failedPredicates.length > 0),
    row.rowKey + ' must report a first failing M1/M2/OD predicate');
  for (const check of checks) {
    assert.equal(typeof check.m1Available, 'boolean');
    assert.equal(typeof check.m2Pass, 'boolean');
    assert.equal(typeof check.odPass, 'boolean');
    assert(Array.isArray(check.failedPredicates));
    assert(check.sourceElementId && check.targetElementId, row.rowKey + ' checked edge custody must be known');
  }
}
console.log(JSON.stringify({
  schema: 'CiiMethodABoundaryPredicateReconciliation.v1',
  evidenceStatus: 'ACTUAL_RETAINED_SOURCE_LEVEL_FORENSICS_NOT_BIND_AUTHORITY',
  headSource: 'native retained S1/S2/S3 to T auto-anchor preview',
  unboundCount: unboundBoundaries.length,
  rows: unboundBoundaries.map((row) => ({
    rowKey: row.rowKey, targetNodeId: row.targetNodeId, state: row.state,
    custodyVeto: row.methodABoundaryDiagnostics[0]?.custodyVeto || null,
    localBoundary: row.methodABoundaryDiagnostics[0]?.localBoundary || null,
  })),
}, null, 2));

// Strict exterior extension must be qualified under the *same* retained
// Writer2 scope/apply/physical-byte-closure machinery as the default flow.
const expectedNewBound = [
  ['S1','3830','860','MEDIUM'], ['S1','4960','1060','MEDIUM'],
  ['S2','80','40050','HIGH'], ['S2','50','40040','HIGH'],
  ['S2','620','10460','HIGH'], ['S3','1920','21920','MEDIUM'],
];
for (const [sourceId,sourceNodeId,targetNodeId,confidence] of expectedNewBound) {
  const row = sourceAudit.rows.find((item)=>item.rowKey === sourceId + ':' + sourceNodeId);
  assert.equal(row?.state, 'BOUND', sourceId+':'+sourceNodeId+' not retained bound');
  assert.equal(row?.targetNodeId, targetNodeId);
  assert.equal(row?.confidence, confidence);
}
assert.deepEqual(
  { BOUND: sourceAudit.summary.BOUND, UNRESOLVED: sourceAudit.summary.UNRESOLVED,
    UNEMITTED: sourceAudit.summary.UNEMITTED },
  { BOUND:111, UNRESOLVED:11, UNEMITTED:28 },
  'opt-in extension must add exactly six independently registered exterior identities');
const bindingClaims = sourceAudit.rows.filter((row)=>row.identityBound && row.targetNodeId);
assert.equal(new Set(bindingClaims.map((row)=>row.targetNodeId)).size,bindingClaims.length,
  'opt-in continuation cannot duplicate TARGET NODE ownership across members');

const censusCsv = ciiSourceTargetAuditToCsv(sourceAudit);
const censusJson = ciiSourceTargetAuditToJson(sourceAudit);
assert.equal(censusCsv.split('\n').length, 151, 'CSV must expose all 150 rows, not only displayed review matches');
assert.deepEqual(JSON.parse(censusJson).summary, sourceAudit.summary, 'exported JSON must preserve all census counts');
assert.equal(ciiSourceTargetAuditToCsv(sourceAudit), censusCsv, 'census CSV must be deterministic');
assert.equal(ciiSourceTargetAuditToJson(sourceAudit), censusJson, 'census JSON must be deterministic');
const censusEvidenceDir = fileURLToPath(new URL('../test-results/cii-method-a-qualification/', import.meta.url));
mkdirSync(censusEvidenceDir, { recursive: true });
writeFileSync(join(censusEvidenceDir, 'source-target-census-optin.json'), censusJson, 'utf8');
writeFileSync(join(censusEvidenceDir, 'source-target-census-optin.csv'), censusCsv, 'utf8');
const censusSummary = Object.freeze({
  sourceNodes: sourceAudit.summary.totalSourceNodes,
  physicalCounts, states: Object.fromEntries(stateNames.map((state) => [state, sourceAudit.summary[state]])),
  boundKnownPositiveTargetCount: expectedDelta.rows.length,
  unnamedPhysicalBoundNodes: ['S1:4490', 'S2:400'],
});

const physical = canonicalPhysicalTransfer(preview);
const missingKnownPositiveKeys = missingRequiredTransferKeys(physical.keys, expectedKeys);
const additionalQualifiedKeys = additionalTransferKeys(physical.keys, expectedKeys);
const replacementCount = physical.operations.filter((operation) => operation.action === 'COPY').length;
const structuralCount = physical.operations.filter((operation) => ['CREATE', 'DELETE'].includes(operation.action)).length;
assert.equal(physical.canonical.conflicts.length, 0, 'Transfer must have zero competing exact physical NODENAME proposals');
assert.equal(new Set(physical.keys).size, physical.keys.length, 'canonical physical Transfer APPLY keys must be unique');
assert.deepEqual(missingKnownPositiveKeys, [], 'every T→TEXPECTED known-positive action/target must be recovered');
assert(replacementCount >= 35, 'selected qualified transfer must include all 35 known-positive replacements');
assert(physical.operations.filter((operation) => operation.action === 'CREATE').length >= 1, 'selected qualified transfer must include the known-positive CREATE');
const rawMutationIdentity = validateRawMutationIdentity(physical.operations, sourceTextsById, targetText, bmRows);
assert.equal(rawMutationIdentity.status, 'READY', `every selected mutation must have exact raw source/target identity: ${JSON.stringify(rawMutationIdentity.errors.slice(0, 10))}`);

const exactScope = await createCiiExpectedNodeNameSourceSetSelection(preview.transferPlan, { cryptoRef });
assert.equal(exactScope.authority.rowCount, 329, 'frozen BM-001 authority must remain exactly 329 rows');
assert.equal(exactScope.authority.correspondenceCoverage.status, 'READY', 'every observed BM-001 claim must be an exact frozen-table row');
assert.equal(exactScope.authority.correspondenceCoverage.invalidOperationIds.length, 0, 'no observed BM-001 claim may be invalid');
assert(exactScope.authority.correspondenceCoverage.matchedRowCount > 0, 'retained path must expose observed BM-001 evidence');
assert.deepEqual([...exactScope.appliedOperationIds].sort(), [...physical.canonical.appliedOperationIds].sort(), 'explicit scope APPLY must equal the full canonical physical mutation selection, not the partial benchmark cardinality');
const scopedPreview = bindCiiTransferScopeToPreview(preview, exactScope.selection);
assert.equal(scopedPreview.writerReadiness.ready, true, `mixed Writer1C/Writer2 readiness blocked: ${(scopedPreview.writerReadiness.blockers || []).join(',')}`);
assert.equal(scopedPreview.writerReadiness.familyMutationCounts.nodeNameReplace, replacementCount, 'readiness replacement count must equal canonical selected replacements');
assert.equal(scopedPreview.writerReadiness.familyMutationCounts.nodeNameStructural, structuralCount, 'readiness structural count must equal canonical selected CREATE/DELETE operations');

const applied = await applyCiiWorkspaceTargetWriter2WithVersionBridge(scopedPreview, targetBytes, { cryptoRef });
assert.equal(applied.versionBridgeValidation.status, 'PASS');
const structuralPostimage = evaluatePartialTExpectedPostimage(targetText, applied.byteString, expectedText, physical.operations);
const emittedRawIdentity = validateAppliedRawIdentity(applied.byteString, physical.operations);
const knownPositiveNames = validateKnownPositiveNodeNames(applied.byteString, expectedDelta.rows, physical.operations);
const byteClosure = validateIndependentMixedNodeNameByteClosure(targetText, applied.byteString, {
  expectedDeltas: selectedOperationDeltas(physical.operations),
  selectedOperations: physical.operations,
});
const diagnostics = Object.freeze({
  autoAnchor: automatic.choices.map((choice) => ({
    sourceId: choice.sourceId, status: choice.status, sourceNodeId: choice.sourceNodeId, targetNodeId: choice.targetNodeId,
    confidence: choice.confidence, basisMethod: choice.basisMethod, outcomeSignature: choice.outcomeSignature,
  })),
  correspondence: { status: preview.correspondence.status, nodeRows: preview.correspondence.nodeRows.length, conflicts: preview.correspondence.conflicts.length },
  transfer: {
    knownPositiveLowerBoundCount: expectedKeys.length,
    actualApplyRowCount: physical.keys.length,
    additionalQualifiedCount: additionalQualifiedKeys.length,
    additionalQualifiedKeys,
    replacementCount,
    structuralCount,
    duplicateCorroborationCount: physical.canonical.duplicateOperationIds.length,
    conflictCount: physical.canonical.conflicts.length,
    rawMutationIdentity: rawMutationIdentity.status,
    sourceOnlyCreateOperationIds: rawMutationIdentity.sourceOnlyCreateOperationIds,
  },
  bm001: exactScope.authority.correspondenceCoverage,
  compare: {
    lowerBoundPostimageStatus: structuralPostimage.status,
    structuralEncodingDifferences: structuralPostimage.encoding.differences.length,
    knownPositiveSemanticDifferences: structuralPostimage.semantics.differences.length,
    exactRawEmissionStatus: emittedRawIdentity.status,
    exactRawEmissionDifferences: emittedRawIdentity.errors.length,
    knownPositiveNameStatus: knownPositiveNames.status,
    knownPositiveNameDifferences: knownPositiveNames.differences.length,
    byteClosureStatus: byteClosure.status,
    byteClosureDifferences: byteClosure.differences.length,
    unrelatedTargetDifferences: structuralPostimage.preservation.differences.length,
    unselectedNodeNamePayloadDifferences: structuralPostimage.nodeNamePayloadPreservation.differences.length,
  },
  ownerCheckpointEvidence: checkpointDiagnostics(preview),
  sourceCensus: censusSummary,
});
console.log(JSON.stringify(diagnostics, null, 2));

assert.equal(structuralPostimage.preservation.status, 'READY', 'mixed output must preserve original T outside NodeName mutation authority');
assert.equal(structuralPostimage.nodeNamePayloadPreservation.status, 'READY', 'mixed output must preserve unselected original NODENAME payloads');
assert.equal(structuralPostimage.encoding.differences.length, 0, 'selected output must remain structurally well-formed');
assert.equal(structuralPostimage.semantics.differences.length, 0, 'all partial TEXPECTED known-positive NodeName mutations must be present');
assert.equal(emittedRawIdentity.status, 'READY', `final mixed output must emit every selected raw source name exactly: ${JSON.stringify(emittedRawIdentity.errors.slice(0, 10))}`);
assert.equal(knownPositiveNames.status, 'READY', `all 36 lower-bound positives must be recovered: ${JSON.stringify(knownPositiveNames.differences.slice(0, 10))}`);
assert.equal(byteClosure.status, 'READY', `independent raw-byte closure for the full selected mutation set failed: ${JSON.stringify(byteClosure.differences.slice(0, 10))}`);
assert.equal(structuralPostimage.status, 'READY', 'retained mixed Writer1C/Writer2 output must satisfy the lower-bound oracle and preserve unrelated target state');

console.log('CII opt-in registered terminal continuation -> full canonical Writer2 raw byte closure: PASS');

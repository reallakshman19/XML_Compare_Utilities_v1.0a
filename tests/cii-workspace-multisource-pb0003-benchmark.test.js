import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiWriter2SourceSetPreviewWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import { deriveExpectedNodeNameDelta } from './cii-workspace-multisource-texpected-oracle.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
const sourceNames = ['S1.CII', 'S2.CII', 'S3.CII'];
const sources = sourceNames.map((fileName, index) => ({
  sourceId: `S${index + 1}`,
  fileName,
  bytes: readFileSync(benchmark(fileName)),
}));
const targetBytes = readFileSync(benchmark('T.CII'));
const targetText = targetBytes.toString('latin1');
const expectedText = readFileSync(benchmark('TEXPECTED-PARTIALLLYDONE.CII'), 'latin1');

function autoBaseLoops(inspection) {
  const choices = [];
  const loops = {};
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
      reviewedCorrespondenceIds: rows
        .filter((row) => row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence))
        .map((row) => row.correspondenceId),
      lockedCorrespondenceIds: rows
        .filter((row) => row.decision === 'LOCKED')
        .map((row) => row.correspondenceId),
      rejectedCorrespondenceIds: [],
    }];
  }));
}

function candidateOperations(plan) {
  const byId = new Map();
  for (const operation of [...(plan?.operations || []), ...(plan?.excludedOperations || [])]) {
    const id = String(operation?.operationId || '').trim();
    if (id && !byId.has(id)) byId.set(id, operation);
  }
  return [...byId.values()];
}

function text(value) { return String(value ?? '').trim(); }
function targetNode(operation) {
  return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId);
}
function proposedName(operation) {
  return text(operation?.proposed ?? operation?.sourceEvidence?.value ?? operation?.sourceEvidence?.nodeName);
}
function isNodeName(operation) {
  return operation?.family === 'NODE_NAME'
    && ['Node name / to-name', 'NodeName'].includes(operation?.property);
}
function candidateForExpected(operation, expected) {
  return isNodeName(operation) && targetNode(operation) === expected.nodeId;
}
function readyReplacement(operation) {
  return operation?.action === 'COPY'
    && operation?.status === 'PREVIEW_READY'
    && operation?.policyAuthority === 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD';
}
function readyCreate(operation) {
  return operation?.action === 'CREATE' && operation?.status === 'PREVIEW_READY';
}
function readyDelete(operation) {
  return operation?.action === 'DELETE' && operation?.status === 'PREVIEW_READY';
}
function compactOperation(operation) {
  return Object.freeze({
    operationId: operation?.operationId || null,
    sourceId: operation?.sourceId || null,
    targetNode: targetNode(operation) || null,
    proposed: proposedName(operation) || null,
    action: operation?.action || null,
    status: operation?.status || null,
    policyAuthority: operation?.policyAuthority || null,
    blockers: Object.freeze([...(operation?.blockers || [])]),
  });
}

const expectedDelta = deriveExpectedNodeNameDelta(targetText, expectedText);
const expectedCreates = expectedDelta.rows.filter((row) => row.action === 'CREATE');
const expectedDeletes = expectedDelta.rows.filter((row) => row.action === 'DELETE');
const expectedReplaces = expectedDelta.rows.filter((row) => row.action === 'REPLACE');

assert.equal(expectedDelta.rows.length, 36, 'partial TEXPECTED known-positive census must contain 36 semantic NodeName changes');
assert.equal(expectedCreates.length, 1, 'partial TEXPECTED must contain exactly one known-positive CREATE');
assert.equal(expectedDeletes.length, 0, 'partial TEXPECTED must contain no DELETE');
assert.equal(expectedReplaces.length, 35, 'partial TEXPECTED must contain exactly 35 known-positive REPLACE rows');

const inspection = await inspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
}, { cryptoRef });
const automatic = autoBaseLoops(inspection);
assert.deepEqual(automatic.choices.map((choice) => choice.status), ['READY', 'READY', 'READY'],
  'retained S1/S2/S3 Auto Anchor must independently resolve');

const previewInput = (reviewBySource = undefined) => ({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
  baseLoopsBySource: automatic.loops,
  ...(reviewBySource ? { reviewBySource } : {}),
});
const discoveryPreview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput(), { cryptoRef });
const reviewBySource = automaticReviewBySource(discoveryPreview);
const preview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput(reviewBySource), { cryptoRef });
assert.equal(preview.correspondence.status, 'READY',
  `retained multisource correspondence must be READY: ${(preview.correspondence.blockers || []).join(',')}`);

const operations = candidateOperations(preview.transferPlan);
const knownPositive = expectedDelta.rows.map((expected) => {
  const matches = operations.filter((operation) => candidateForExpected(operation, expected));
  const ready = expected.action === 'REPLACE'
    ? matches.find(readyReplacement)
    : (expected.action === 'CREATE' ? matches.find(readyCreate) : matches.find(readyDelete));
  return Object.freeze({
    ...expected,
    ready: Boolean(ready),
    matches: Object.freeze(matches.map(compactOperation)),
  });
});
const unresolvedKnownPositive = knownPositive.filter((row) => !row.ready);
const replacementBlockers = Object.fromEntries([...new Set(
  knownPositive
    .filter((row) => row.action === 'REPLACE')
    .flatMap((row) => row.matches.flatMap((operation) => operation.blockers)),
)].sort().map((blocker) => [blocker, knownPositive.filter((row) => row.action === 'REPLACE'
  && row.matches.some((operation) => operation.blockers.includes(blocker))).length]));

const diagnostics = Object.freeze({
  expectedCensus: Object.freeze({
    semanticChanges: expectedDelta.rows.length,
    create: expectedCreates.length,
    delete: expectedDeletes.length,
    replace: expectedReplaces.length,
  }),
  correspondence: Object.freeze({
    status: preview.correspondence.status,
    nodeRows: preview.correspondence.nodeRows.length,
    conflicts: preview.correspondence.conflicts.length,
  }),
  candidateNodeNameOperationCount: operations.filter(isNodeName).length,
  readyKnownPositiveCount: knownPositive.length - unresolvedKnownPositive.length,
  unresolvedKnownPositiveCount: unresolvedKnownPositive.length,
  replacementBlockers,
  unresolvedKnownPositive: Object.freeze(unresolvedKnownPositive),
});
console.log(JSON.stringify(diagnostics, null, 2));

assert.equal(unresolvedKnownPositive.length, 0,
  'every TEXPECTED known-positive NodeName delta must be selectable; REPLACE uses Writer1C COPY and CREATE uses Writer2 structural authority');

console.log('PB-0003 retained-real lower-bound NodeName benchmark passed.');

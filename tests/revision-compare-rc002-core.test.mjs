import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { projectCompareRecords } from '../tabs/revision-compare/revision-compare-projection.js';
import { matchExactIdentities, matchBoundedCandidates, DEFAULT_REVISION_COMPARE_CONFIG } from '../tabs/revision-compare/revision-compare-matching.js';
import { runRevisionCompare, RevisionComparisonCancelledError } from '../tabs/revision-compare/revision-compare-engine.js';
import { createInlineRevisionCompareWorkerClient } from '../tabs/revision-compare/revision-compare-worker-client.js';
import { createRevisionCompareService, RevisionCompareSupersededError } from '../tabs/revision-compare/revision-compare-service.js';
import { createRevisionCompareViewerAdapter } from '../tabs/revision-compare/revision-compare-viewer-adapter.js';
import { visibleRevisionDifferenceRows } from '../tabs/revision-compare/revision-compare-review-view.js';

const branch = (name, children) => ({ name, attributes: { OWNER_SITE: 'SITE', OWNER: 'AREA' }, children });
const revA = { schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT', branches: [branch('/COMMON', [
  { id: 'UNCH', type: 'PIPE', position: [0, 0, 0], nominalSize: 100, rating: 150 },
  { id: 'PROP', type: 'VALV', position: [10, 0, 0], rating: 150 },
  { id: 'GEO', type: 'PIPE', start: [0, 10, 0], end: [10, 10, 0] },
  { type: 'PIPE', nominalSize: 80, supportType: 'RUN', position: [30, 0, 0] },
  { type: 'PIPE', nominalSize: 50, supportType: 'RUN', position: [40, 0, 0] },
  { id: 'DUP', type: 'PIPE', nominalSize: 40, position: [50, 0, 0] },
  { id: 'DUP', type: 'PIPE', nominalSize: 40, position: [60, 0, 0] },
  { id: 'REM', type: 'SUPPORT', position: [70, 0, 0] },
  { id: 'NO-GEO', type: 'PIPE', material: 'CS' },
]) ] };
const revB = { schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT', branches: [branch('/COMMON', [
  { id: 'UNCH', type: 'PIPE', position: [0, 0, 0], nominalSize: 100, rating: 150 },
  { id: 'PROP', type: 'VALV', position: [10, 0, 0], rating: 300 },
  { id: 'GEO', type: 'PIPE', start: [0, 10, 0], end: [11, 10, 0] },
  { type: 'PIPE', nominalSize: 80, supportType: 'RUN', position: [30, 0, 0] },
  { type: 'PIPE', nominalSize: 50, supportType: 'RUN', position: [40, 0, 0] },
  { type: 'PIPE', nominalSize: 50, supportType: 'RUN', position: [40, 0, 0] },
  { id: 'DUP', type: 'PIPE', nominalSize: 40, position: [50, 0, 0] },
  { id: 'DUP', type: 'PIPE', nominalSize: 40, position: [60, 0, 0] },
  { id: 'ADD', type: 'SUPPORT', position: [80, 0, 0] },
  { id: 'NO-GEO', type: 'PIPE', material: 'SS' },
]) ] };

const compatibility = (label) => ({ label, status: 'COMPATIBLE', revA: label === 'Units' ? 'mm' : label === 'Vertical axis' ? 'Z' : 'PLANT', revB: label === 'Units' ? 'mm' : label === 'Vertical axis' ? 'Z' : 'PLANT' });
const basis = Object.freeze({
  schema: 'RevisionComparisonBasis.v1', basisId: 'basis:test', sessionId: 'session:test',
  revADocumentId: 'doc:A', revBDocumentId: 'doc:B', revAContentHash: 'hash:A', revBContentHash: 'hash:B',
  revAScopeIdentity: 'scope:A', revBScopeIdentity: 'scope:B', includedBranchesA: ['branch:/COMMON'], includedBranchesB: ['branch:/COMMON'],
  unitCompatibility: compatibility('Units'), coordinateFrameCompatibility: compatibility('Coordinate frame'), verticalAxisCompatibility: compatibility('Vertical axis'),
  validation: { status: 'READY', errors: [] }, scopeSummary: { includedBranchCountA: 1, includedBranchCountB: 1 },
});
const requestA = { basisId: basis.basisId, side: 'A', sourceDocumentId: basis.revADocumentId, sourceHash: basis.revAContentHash, scopedHash: basis.revAScopeIdentity, selectedBranchIds: basis.includedBranchesA };
const requestB = { basisId: basis.basisId, side: 'B', sourceDocumentId: basis.revBDocumentId, sourceHash: basis.revBContentHash, scopedHash: basis.revBScopeIdentity, selectedBranchIds: basis.includedBranchesB };
const projectionA = projectCompareRecords(revA, requestA);
const projectionB = projectCompareRecords(revB, requestB);

assert.equal(projectionA.schema, 'RevisionCompareProjection.v1');
assert.equal(projectionA.records.length, 9);
assert(Object.isFrozen(projectionA.records[0]));
assert(!JSON.stringify(projectionA).includes('inputxml-managed-stage'));
assert.equal(projectionA.records[0].schema, 'RevisionCompareRecord.v1');
assert(projectionA.records.some((record) => record.geometry.availability === 'UNAVAILABLE'));
const reordered = projectCompareRecords({ ...revA, branches: [{ ...revA.branches[0], children: [...revA.branches[0].children].reverse() }] }, requestA);
assert.equal(reordered.records.length, projectionA.records.length);
assert.equal(projectionA.records.find((record) => record.identityEvidence.some((item) => item.value === 'UNCH')).identityEvidence[0].value, 'UNCH');

const exact = matchExactIdentities(projectionA.records, projectionB.records);
assert(exact.matches.some((match) => match.source.identityEvidence.some((item) => item.value === 'UNCH')));
const duplicateExact = exact.matches.filter((match) => match.source.identityEvidence.some((item) => item.value === 'DUP'));
assert.equal(duplicateExact.length, 0);
const inferred = matchBoundedCandidates(exact.unmatchedA, exact.unmatchedB, exact.usedTargets, DEFAULT_REVISION_COMPARE_CONFIG);
assert(inferred.performance.candidatePairsEvaluated < exact.unmatchedA.length * exact.unmatchedB.length);
assert(inferred.performance.maximumCandidatesForOneRecord <= 8);
assert(inferred.matches.some((match) => match.source.engineeringProperties.nominalSize?.value === 80));
assert(inferred.ambiguous.some((entry) => entry.source.engineeringProperties.nominalSize?.value === 50));
assert(inferred.candidateEvidence.every((item) => Object.isFrozen(item)));

const stages = [];
const audit = await runRevisionCompare({ basis, revA: projectionA, revB: projectionB, projectionReceipt: { projectRevAMilliseconds: 1, projectRevBMilliseconds: 2 } }, { cryptoRef: webcrypto, onProgress: (progress) => stages.push(progress.stage) });
assert.deepEqual(stages, ['Building identity indexes', 'Matching exact identities', 'Evaluating bounded candidates', 'Comparing properties', 'Comparing geometry', 'Building visual review']);
assert.equal(audit.schema, 'RevisionCompareAudit.v1');
assert.equal(audit.validation.status, 'READY');
assert(Object.isFrozen(audit));
assert.equal(audit.summary.changed >= 2, true);
assert.equal(audit.summary.added >= 1, true);
assert.equal(audit.summary.removed >= 1, true);
assert.equal(audit.summary.needsDecision >= 1, true);
assert.equal(audit.differenceRows.filter((row) => row.sourceRecordId).length, projectionA.records.length);
assert.equal(audit.differenceRows.filter((row) => row.targetRecordId).length, projectionB.records.length);
assert.equal(new Set(audit.differenceRows.map((row) => row.targetRecordId).filter(Boolean)).size, projectionB.records.length);
assert(!JSON.stringify(audit).includes('inputxml-managed-stage'));
assert(audit.differenceRows.some((row) => row.changedProperties.some((item) => item.propertyKey === 'rating')));
assert(audit.differenceRows.some((row) => row.geometryDelta.changed));
assert(audit.candidateEvidence.some((item) => item.acceptedCandidateId));
assert(audit.candidateEvidence.some((item) => !item.acceptedCandidateId && item.candidateCount > 0));
const secondAudit = await runRevisionCompare({ basis, revA: projectionA, revB: projectionB }, { cryptoRef: webcrypto });
assert.equal(audit.auditId, secondAudit.auditId);
assert.notEqual(audit.performanceReceipt.totalMilliseconds, undefined);

const queueState = { categories: ['CHANGED', 'ADDED', 'REMOVED'], needsDecisionOnly: true, changedReasons: ['GEOMETRY', 'PROPERTIES', 'CONNECTIVITY', 'SUPPORT_HIERARCHY'], search: '' };
assert(visibleRevisionDifferenceRows(audit, queueState).every((row) => row.matchCertainty === 'AMBIGUOUS'));

let cancelFlag = false;
await assert.rejects(() => runRevisionCompare({ basis, revA: projectionA, revB: projectionB }, { cryptoRef: webcrypto, isCancelled: () => cancelFlag, onProgress: () => { cancelFlag = true; } }), RevisionComparisonCancelledError);

const inline = createInlineRevisionCompareWorkerClient({ cryptoRef: webcrypto });
const service = createRevisionCompareService({ client: inline });
const token1 = await service.begin(basis.basisId);
const pending = service.compare(token1, { basis, revA: projectionA, revB: projectionB }, () => {});
await service.begin(basis.basisId);
await assert.rejects(pending, (error) => error instanceof RevisionCompareSupersededError || error.code === 'REVISION_COMPARE_CANCELLED');
service.dispose();

function fakeViewerFactory(log, fail = false) {
  return async (_host, callbacks) => {
    if (fail) throw new Error('Viewer unavailable');
    log.callbacks = callbacks;
    return {
      reattach: () => log.push('reattach'), setModels: (models) => { log.push('models'); log.models = structuredClone(models); },
      setStatuses: () => log.push('statuses'), setMode: (mode) => log.push(`mode:${mode}`), setVerticalAxis: () => {},
      setSelection: (id) => log.push(`select:${id}`), fitSelection: () => log.push('fitSelection'), fitAll: () => log.push('fitAll'),
      getStateSnapshot: () => ({ cameraPosition: [1, 2, 3], cameraTarget: [0, 0, 0] }), dispose: () => log.push('dispose'), callbacks,
    };
  };
}
const host = {};
const log = [];
let picked = 'unset';
const viewerFactory = fakeViewerFactory(log);
const adapter = createRevisionCompareViewerAdapter({
  webglViewerFactory: viewerFactory, svgViewerFactory: viewerFactory,
  onPick: (value) => { picked = value; },
});
await adapter.render(host, audit);
const originalModels = structuredClone(audit.visualModels);
adapter.setPresentationMode('side-by-side');
assert.deepEqual(audit.visualModels, originalModels);
const selected = audit.differenceRows.find((row) => row.visualRefs.sourceObjectId || row.visualRefs.targetObjectId);
adapter.selectDifference(selected.differenceId);
const beforeFit = log.filter((item) => item === 'fitSelection').length;
assert.equal(beforeFit, 0);
adapter.fitSelected();
assert.equal(log.filter((item) => item === 'fitSelection').length, 1);
log.callbacks.onPick(null);
assert.equal(picked, null);
adapter.dispose();
const failedFactory = fakeViewerFactory([], true);
const failed = createRevisionCompareViewerAdapter({
  webglViewerFactory: failedFactory, svgViewerFactory: failedFactory,
});
assert.equal(await failed.render(host, audit), false);
assert.equal(failed.evidence().failed, true);
failed.dispose();

console.log('revision-compare-rc002.test.mjs passed');

import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CII_MS_REVIEW_ONLY_SCHEMA,
  CII_MS_REVIEW_ONLY_WRITE_BLOCKER,
  createCiiMultiSourceReviewOnlyPreviewWithVersionBridge,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-only.js';

const cryptoRef = globalThis.crypto || webcrypto;
const hash = (digit) => String(digit).repeat(64);

function memberPreview(sourceDigit, rowSuffix, targetDigit = 'a') {
  const correspondenceId = `corr-${rowSuffix}`;
  const deltaId = `delta-${rowSuffix}`;
  return Object.freeze({
    sourceDocument: Object.freeze({ fileName: `source-${rowSuffix}.CII`, contentSha256: hash(sourceDigit) }),
    targetDocument: Object.freeze({ fileName: 'target.CII', contentSha256: hash(targetDigit) }),
    versionBridge: Object.freeze({
      source: Object.freeze({
        originalVersion: 14,
        normalizedVersion: 11,
        originalSha256: hash(sourceDigit),
        normalizedSha256: hash(String(Number(sourceDigit) + 3)),
        baselineCanonicalSha256: hash(String(Number(sourceDigit) + 5)),
        exactBaselineRoundTrip: true,
      }),
      target: Object.freeze({
        originalVersion: 14,
        normalizedVersion: 11,
        originalSha256: hash(targetDigit),
        normalizedSha256: hash('b'),
        baselineCanonicalSha256: hash('c'),
      }),
      conversionSource: Object.freeze({ status: 'PASS' }),
    }),
    correspondence: Object.freeze({
      status: 'READY',
      blockers: Object.freeze([]),
      correspondenceIdentity: `member-${rowSuffix}`,
      nodeRows: Object.freeze([Object.freeze({
        correspondenceId,
        kind: 'NODE',
        status: 'MATCHED',
        sourceNodeId: rowSuffix,
        targetNodeId: `10${rowSuffix}`,
      })]),
      elementRows: Object.freeze([]),
      componentRows: Object.freeze([]),
    }),
    review: Object.freeze({
      reviewedCorrespondenceIds: Object.freeze(rowSuffix === '1' ? [correspondenceId] : []),
      lockedCorrespondenceIds: Object.freeze([]),
      rejectedCorrespondenceIds: Object.freeze([]),
    }),
    engineeringDeltas: Object.freeze({
      rows: Object.freeze([Object.freeze({
        deltaId,
        correspondenceId,
        changed: true,
        category: 'NODE_NAME',
        property: 'Node name / to-name',
      })]),
    }),
    compareReview: Object.freeze({
      rows: Object.freeze([Object.freeze({
        correspondenceId,
        kind: 'NODE',
        confidence: 'HIGH',
        identityBound: true,
        decision: rowSuffix === '1' ? 'ACCEPTED' : 'REVIEW',
        workflowStatus: 'MATCHED',
        source: rowSuffix,
        target: `10${rowSuffix}`,
        changeCount: 1,
        changeFamilies: Object.freeze(['NODE_NAME']),
      })]),
    }),
  });
}

const calls = [];
const previewFactory = async (input) => {
  calls.push(input);
  return memberPreview(input.sourceFileName.includes('alpha') ? '1' : '2', input.sourceFileName.includes('alpha') ? '1' : '2');
};
const result = await createCiiMultiSourceReviewOnlyPreviewWithVersionBridge({
  sources: [
    { sourceId: 'A', fileName: 'alpha.CII', bytes: Uint8Array.of(1) },
    { sourceId: 'B', fileName: 'beta.CII', bytes: Uint8Array.of(2) },
  ],
  targetBytes: Uint8Array.of(9),
  targetFileName: 'arbitrary-target.CII',
}, { cryptoRef, previewFactory });

assert.equal(calls.length, 2);
assert.equal(result.schema, CII_MS_REVIEW_ONLY_SCHEMA);
assert.equal(result.mode, 'REVIEW_ONLY');
assert.equal(result.sourceSet.memberCount, 2);
assert.deepEqual(result.sourceSet.members.map((member) => member.sourceId), ['A', 'B']);
assert.match(result.sourceSetSha256, /^[0-9a-f]{64}$/);
assert.equal(result.correspondence.status, 'READY');
assert.equal(result.correspondence.nodeRows.length, 2);
assert.notEqual(result.correspondence.nodeRows[0].correspondenceId, result.correspondence.nodeRows[1].correspondenceId);
assert.equal(result.correspondence.nodeRows[0].memberCorrespondenceId, 'corr-1');
assert.equal(result.compareReview.rows[0].sourceId, 'A');
assert.equal(result.compareReview.rows[1].sourceId, 'B');
assert.equal(result.compareReview.rows[0].memberCorrespondenceId, 'corr-1');
assert.equal(result.engineeringDeltas.changedRows.length, 2);
assert.equal(result.review.reviewedCorrespondenceIds.length, 1);

assert.equal(result.transferPlan.status, 'BLOCKED');
assert.equal(result.transferPlan.mutationAuthority, 'BLOCKED');
assert.deepEqual(result.transferPlan.operations, []);
assert.deepEqual(result.transferPlan.excludedOperations, []);
assert.deepEqual(result.transferPlan.blockers, [CII_MS_REVIEW_ONLY_WRITE_BLOCKER]);
assert.equal(result.writerReadiness.ready, false);
assert.deepEqual(result.writerReadiness.blockers, [CII_MS_REVIEW_ONLY_WRITE_BLOCKER]);
assert.equal(result.versionBridge.v14WritePolicy, 'REVIEW_ONLY_NO_WRITE_AUTHORITY');
assert.equal(result.artifacts.modifiedTargetCii, null);
assert.match(result.artifacts.correspondenceCsv, /corr/);
assert.match(result.artifacts.auditJson, new RegExp(CII_MS_REVIEW_ONLY_WRITE_BLOCKER));

await assert.rejects(
  createCiiMultiSourceReviewOnlyPreviewWithVersionBridge({
    sources: [{ sourceId: 'A', bytes: Uint8Array.of(1) }],
    targetBytes: Uint8Array.of(9),
  }, { cryptoRef, previewFactory }),
  /TWO_OR_MORE_SOURCES_REQUIRED/,
);
await assert.rejects(
  createCiiMultiSourceReviewOnlyPreviewWithVersionBridge({
    sources: [{ sourceId: 'A', bytes: Uint8Array.of(1) }, { sourceId: 'A', bytes: Uint8Array.of(2) }],
    targetBytes: Uint8Array.of(9),
  }, { cryptoRef, previewFactory }),
  /DUPLICATE_SOURCE_ID/,
);
await assert.rejects(
  createCiiMultiSourceReviewOnlyPreviewWithVersionBridge({
    sources: [{ sourceId: 'A', bytes: Uint8Array.of(1) }, { sourceId: 'B', bytes: Uint8Array.of(2) }],
    targetBytes: Uint8Array.of(9),
  }, {
    cryptoRef,
    previewFactory: async (input) => memberPreview(input.sourceFileName.startsWith('A') ? '1' : '2', input.sourceFileName.startsWith('A') ? '1' : '2', input.sourceFileName.startsWith('A') ? 'a' : 'd'),
  }),
  /TARGET_CUSTODY_MISMATCH/,
);

const moduleSource = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only.js', import.meta.url), 'utf8');
assert(moduleSource.split('\n').length < 300, 'new review-only production module must remain below 300 lines');
assert(!moduleSource.includes('assertCiiMsBm001Authority'), 'review-only core must not consume BM-001 write authority');
assert(!moduleSource.includes('applyCiiWorkspaceTargetWriter2'), 'review-only core must not import Writer2 apply');
assert(moduleSource.includes(CII_MS_REVIEW_ONLY_WRITE_BLOCKER));

console.log('CII generic multi-source REVIEW_ONLY core custody checks passed.');

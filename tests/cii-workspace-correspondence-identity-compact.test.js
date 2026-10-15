import assert from 'node:assert/strict';
import { bindCiiCorrespondenceIdentity } from '../tabs/cii-workspace/cii-workspace-identity.js';

const rows = Array.from({ length: 500 }, (_, index) => ({
  correspondenceId: `row-${index}`,
  kind: 'NODE',
  status: 'MATCHED',
  authority: 'TEST_AUTHORITY',
  sourceNodeId: String(index),
  targetNodeId: String(index + 1000),
  evidence: { detail: 'x'.repeat(2048), index },
}));
const correspondence = { status: 'READY', blockers: [], nodeRows: rows, elementRows: [], componentRows: [] };
const sourceDocument = { contentSha256: 'source-sha' };
const targetDocument = { contentSha256: 'target-sha' };
const anchors = [{ sourceNodeId: '1', targetNodeId: '1001', status: 'LOCKED' }];

const first = bindCiiCorrespondenceIdentity(correspondence, sourceDocument, targetDocument, anchors);
const second = bindCiiCorrespondenceIdentity(correspondence, sourceDocument, targetDocument, anchors);
assert.equal(first.correspondenceIdentity, second.correspondenceIdentity, 'same canonical correspondence material must have a deterministic identity');
assert.match(first.correspondenceIdentity, /^correspondence-v1:[0-9a-f]{64}$/);
assert(first.correspondenceIdentity.length < 100, 'identity must stay compact regardless of correspondence payload size');
assert(!first.correspondenceIdentity.includes('nodeRows'), 'identity must not embed the canonical JSON payload');

const changed = bindCiiCorrespondenceIdentity({ ...correspondence, blockers: ['changed'] }, sourceDocument, targetDocument, anchors);
assert.notEqual(changed.correspondenceIdentity, first.correspondenceIdentity, 'changing canonical correspondence material must change the digest identity');
assert.equal(first.nodeRows, correspondence.nodeRows, 'identity binding must preserve correspondence evidence instead of replacing it');

console.log('CII compact correspondence identity checks passed.');

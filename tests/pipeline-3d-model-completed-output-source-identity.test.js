import assert from 'node:assert/strict';
import { createPipelineCompletedOutputSession, _test } from '../tabs/pipeline-3d-model/pipeline-3d-model-completed-output-session.js';
const large = `HEADER\n${'1234567890\t'.repeat(100000)}END`;
const input = { table1Text: 'T1', table2Text: 'generated', table3Text: 'generated',
  profileRaw: { table2a: large, table3a: 'H\n1', table3b: '', table3c: '', vendorRevision: 'R1' },
  branchInfo: { lineNo: 'L1' }, configurationDraft: { revision: 'C1' } };
const parts = _test.inputIdentityParts(input);
const metadata = _test.metadataSignature(parts.metadata);
assert.equal(parts.sourceTexts[1], large);
assert.equal(metadata.includes('1234567890'), false);
assert.equal(metadata.includes('vendorRevision'), true);
let builds = 0;
const session = createPipelineCompletedOutputSession(() => ({ build: ++builds }));
const first = session.resolve(input);
assert.equal(session.resolve({ ...input, table2Text: 'different generated text' }), first);
assert.equal(builds, 1);
assert.notEqual(session.resolve({ ...input, profileRaw: { ...input.profileRaw,
  table2a: `${large.slice(0, -1)}X` } }), first);
assert.equal(builds, 2);
assert.notEqual(session.resolve({ ...input, profileRaw: { ...input.profileRaw,
  table2a: `${large.slice(0, -1)}X`, vendorRevision: 'R2' } }), first);
assert.equal(builds, 3);
assert.throws(() => session.resolve({ ...input, table1Text: 42 }), /must be text/);
console.log('completed output source identity: PASS');

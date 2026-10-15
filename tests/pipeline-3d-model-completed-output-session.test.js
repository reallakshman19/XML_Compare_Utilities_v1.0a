import assert from 'node:assert/strict';
import { createPipelineCompletedOutputSession } from '../tabs/pipeline-3d-model/pipeline-3d-model-completed-output-session.js';
let builds = 0;
const session = createPipelineCompletedOutputSession((input) => {
  builds += 1;
  return Object.freeze({ ancestry: { source: input.branchInfo }, rows: [{ value: builds }] });
});
const base = { table1Text: 'T1', table2Text: 'generated-a', table3Text: 'generated-b',
  profileRaw: { table2a: 'A', table3a: 'B' }, branchInfo: { lineNo: 'L1' },
  configurationDraft: { revision: 'R1' },
  canonicalAnalysisSectionPlan: { sourceReference: 'PLAN-1' } };
const first = session.resolve(base);
assert.equal(builds, 1);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.ancestry), true);
assert.equal(Object.isFrozen(first.rows), true);
assert.equal(Object.isFrozen(first.rows[0]), true);
assert.throws(() => first.rows.push({ value: 2 }), TypeError);
const equal = { ...base, table2Text: 'new generated value', table3Text: 'new generated value',
  branchInfo: { lineNo: 'L1' } };
assert.equal(session.resolve(equal), first);
assert.equal(builds, 1);
assert.notEqual(session.resolve({ ...equal, configurationDraft: { revision: 'R2' } }), first);
assert.equal(builds, 2);
assert.notEqual(session.resolve({ ...equal, configurationDraft: { revision: 'R2' },
  canonicalAnalysisSectionPlan: { sourceReference: 'PLAN-2' } }), first);
assert.equal(builds, 3);
const legacy = createPipelineCompletedOutputSession((input) => ({ value: input.table2Text }));
const legacyFirst = legacy.resolve({ table2Text: 'A', table3Text: 'B', profileRaw: null });
assert.notEqual(legacy.resolve({ table2Text: 'C', table3Text: 'B', profileRaw: null }), legacyFirst);
let attempts = 0;
const failing = createPipelineCompletedOutputSession(() => { attempts += 1; throw new Error('fail'); });
assert.throws(() => failing.resolve({ table1Text: 'A' }), /fail/);
assert.throws(() => failing.resolve({ table1Text: 'A' }), /fail/);
assert.equal(attempts, 2);
session.reset();
assert.notEqual(session.resolve(equal), first);
assert.equal(builds, 4);
console.log('completed output session: PASS');

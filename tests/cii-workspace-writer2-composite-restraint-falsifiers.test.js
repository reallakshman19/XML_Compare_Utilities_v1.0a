import assert from 'node:assert/strict';
import {
  applyCiiWriter2CompositeWithRestraintDelete,
  _test as compositeTest,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation.js';
import { applyCiiWriter2RestraintDeleteCompaction } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-write.js';
import {
  afterDocumentFromByteString, buildFixture, hangerDelete, nodeCreate, restraintDelete, sifDelete, targetGraph, transferPlan,
} from './cii-workspace-writer2-composite-restraint-fixture.js';

function expectThrows(fn, pattern) { assert.throws(fn, pattern); }
function validRun(operations) {
  const fixture = buildFixture(); const graph = targetGraph(); const plan = transferPlan(fixture.targetDocument, operations(fixture));
  const writer = applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: graph, transferPlan: plan });
  const after = afterDocumentFromByteString(writer.byteString);
  assert.equal(validateCiiWriter2CompositeWithRestraintDelete({ before: fixture.targetDocument, after, targetGraph: graph, transferPlan: plan, writerResult: writer }).status, 'PASS');
  return { fixture, graph, plan, writer, after };
}

// R10 RESTRAINT CREATE remains blocked.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const op = restraintDelete(2, 30, spec, { id: 'R10', action: 'CREATE' }); const plan = transferPlan(fixture.targetDocument, [op]);
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: targetGraph(), transferPlan: plan }),
    /WRITER_2_RESTRAINT_BLOCK_CREATE_ALLOCATION_NOT_QUALIFIED/);
}

// R11 SIF CREATE remains blocked before child execution.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const create = Object.freeze({ ...sifDelete(), operationId: 'R11-SIF-CREATE', action: 'CREATE' });
  const plan = transferPlan(fixture.targetDocument, [create, restraintDelete(2, 30, spec, { id: 'R11-RESTRAINT' })]);
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: targetGraph(), transferPlan: plan }),
    /SIF_CREATE|CREATE_PAYLOAD|ITEMS_27_30/);
}

// R12 HANGER CREATE remains blocked.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const plan = transferPlan(fixture.targetDocument, [hangerDelete(20, 'CREATE'), restraintDelete(2, 30, spec, { id: 'R12-RESTRAINT' })]);
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: targetGraph(), transferPlan: plan }),
    /HANGER_CREATE|PAYLOAD_SEMANTICS/);
}

// R13 stale TARGET0 cryptographic custody blocks before composition.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const stale = Object.freeze({ ...fixture.targetDocument, contentSha256: '0'.repeat(64) });
  const plan = transferPlan(stale, [restraintDelete(2, 30, spec, { id: 'R13' })]);
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: stale, targetGraph: targetGraph(), transferPlan: plan }),
    /TARGET0_SHA256_MISMATCH/);
}

// R14 duplicate operation IDs across the parent plan are rejected.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2]; const node = nodeCreate();
  const restraint = restraintDelete(2, 30, spec, { id: node.operationId }); const plan = transferPlan(fixture.targetDocument, [node, restraint]);
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: targetGraph(), transferPlan: plan }),
    /PLAN_OPERATION_DUPLICATE_ID/);
}

// R15 parent transfer-scope APPLY testimony drift is rejected.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const base = transferPlan(fixture.targetDocument, [restraintDelete(2, 30, spec, { id: 'R15' })]);
  const forged = Object.freeze({ ...base, transferScope: Object.freeze({ ...base.transferScope, appliedOperationIds: Object.freeze([]) }) });
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: targetGraph(), transferPlan: forged }),
    /SCOPE_APPLY_SET_MISMATCH/);
}

// R16 canonical child candidate-set drift is independently rejected by the W2.11 component gate.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const parentPlan = transferPlan(fixture.targetDocument, [restraintDelete(2, 30, spec, { id: 'R16' })]);
  const parentCustody = compositeTest.assertBoundScopeCustody(parentPlan, fixture.targetDocument);
  const child = compositeTest.projectCanonicalSubscope(parentPlan, compositeTest.isRestraintDelete, 'WRITER_2_RESTRAINT_BLOCK_DELETE', parentCustody);
  const forged = Object.freeze({ ...child, transferScope: Object.freeze({ ...child.transferScope, candidateOperationIds: Object.freeze(['R16', 'FORGED']) }) });
  expectThrows(() => applyCiiWriter2RestraintDeleteCompaction({ targetDocument: fixture.targetDocument, transferPlan: forged }),
    /CII_WRITER_2_RESTRAINT_DELETE_BLOCKED:.*SCOPE_CANDIDATE_SET_MISMATCH/);
}

// R17 any actual cross-family original-coordinate overlap fails closed before mutation.
{
  const original = 'abcdefghij';
  expectThrows(() => compositeTest.arbitrateClaims([
    { authorityFamily: 'WRITER_2_NODENAME', claim: { kind: 'A', byteStart: 1, byteEnd: 6, beforeField: 'bcdef', afterField: '11111' } },
    { authorityFamily: 'WRITER_2_RESTRAINT_BLOCK_DELETE', claim: { kind: 'B', byteStart: 5, byteEnd: 8, beforeField: 'fgh', afterField: '222' } },
  ], original), /CII_WRITER_2_COMPOSITE_RESTRAINT_ORIGINAL_SPAN_OVERLAP/);
}

// R18 forged top-level restraint mutation testimony is rejected after exact final bytes pass.
{
  const { fixture, graph, plan, writer, after } = validRun((f) => [restraintDelete(2, 30, f.restraintSpecs[2], { id: 'R18' })]);
  const forged = Object.freeze({ ...writer, mutations: Object.freeze(writer.mutations.filter((item) => item.authorityFamily !== 'WRITER_2_RESTRAINT_BLOCK_DELETE')) });
  expectThrows(() => validateCiiWriter2CompositeWithRestraintDelete({ before: fixture.targetDocument, after, targetGraph: graph, transferPlan: plan, writerResult: forged }),
    /WRITER_MUTATION_TESTIMONY_MISMATCH/);
}

// R19 forged existing NODE/SIF/HANGER composite testimony is rejected independently.
{
  const { fixture, graph, plan, writer, after } = validRun((f) => [nodeCreate(), restraintDelete(2, 30, f.restraintSpecs[2], { id: 'R19-RESTRAINT' })]);
  const forgedExisting = Object.freeze({ ...writer.components.existingComposite, mutations: Object.freeze(writer.components.existingComposite.mutations.slice(1)) });
  const forged = Object.freeze({ ...writer, components: Object.freeze({ ...writer.components, existingComposite: forgedExisting }) });
  expectThrows(() => validateCiiWriter2CompositeWithRestraintDelete({ before: fixture.targetDocument, after, targetGraph: graph, transferPlan: plan, writerResult: forged }),
    /EXISTING_COMPONENT_TESTIMONY_MISMATCH/);
}

// R20 unrelated final-byte drift is rejected by the complete-postimage oracle before Writer testimony.
{
  const { fixture, graph, plan, writer } = validRun((f) => [restraintDelete(2, 30, f.restraintSpecs[2], { id: 'R20' })]);
  const drifted = afterDocumentFromByteString(writer.byteString.replace('UNITS-CUSTODY', 'XNITS-CUSTODY'));
  expectThrows(() => validateCiiWriter2CompositeWithRestraintDelete({ before: fixture.targetDocument, after: drifted, targetGraph: graph, transferPlan: plan, writerResult: writer }),
    /EXACT_COMPLETE_POSTIMAGE_MISMATCH/);
}

// R21 forged postimage hash/representation testimony cannot override correct physical bytes.
{
  const { fixture, graph, plan, writer, after } = validRun((f) => [restraintDelete(2, 30, f.restraintSpecs[2], { id: 'R21' })]);
  const forged = Object.freeze({ ...writer, postimageHashCustody: Object.freeze({ ...writer.postimageHashCustody, contentSha256: '0'.repeat(64) }) });
  expectThrows(() => validateCiiWriter2CompositeWithRestraintDelete({ before: fixture.targetDocument, after, targetGraph: graph, transferPlan: plan, writerResult: forged }),
    /POSTIMAGE_HASH_TESTIMONY_MISMATCH/);
}

// R22 unsupported process/topology-style APPLY remains outside W2.12 authority.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const process = Object.freeze({ operationId: 'R22-PROCESS', family: 'PROCESS', property: 'P1', action: 'OVERWRITE', status: 'PREVIEW_READY', scopeDecision: 'APPLY' });
  const plan = transferPlan(fixture.targetDocument, [process, restraintDelete(2, 30, spec, { id: 'R22-RESTRAINT' })]);
  expectThrows(() => applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: targetGraph(), transferPlan: plan }),
    /UNSUPPORTED_APPLY:R22-PROCESS/);
}

console.log('Writer2 W2.12 RESTRAINT composite R10-R22 falsifiers passed.');

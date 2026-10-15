import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation.js';
import {
  afterDocumentFromByteString, buildFixture, hangerDelete, nodeCreate, restraintDelete, sifDelete, targetGraph, transferPlan,
} from './cii-workspace-writer2-composite-restraint-fixture.js';

function run(fixture, operations) {
  const graph = targetGraph(); const plan = transferPlan(fixture.targetDocument, operations);
  const writer = applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: fixture.targetDocument, targetGraph: graph, transferPlan: plan });
  const after = afterDocumentFromByteString(writer.byteString);
  const validation = validateCiiWriter2CompositeWithRestraintDelete({ before: fixture.targetDocument, after, targetGraph: graph, transferPlan: plan, writerResult: writer });
  assert.equal(validation.status, 'PASS');
  return { graph, plan, writer, after, validation };
}
function controlRows(document) {
  const lines = document.physicalFile.lines;
  const marker = lines.findIndex((line) => String(line.text).trim().toUpperCase() === '#$ CONTROL');
  assert(marker >= 0); return [lines[marker + 1].text, lines[marker + 2].text, lines[marker + 3].text, lines[marker + 4].text];
}

// R01 RESTRAINT-only composite adoption.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const { writer, validation } = run(fixture, [restraintDelete(2, 30, spec, { id: 'R01' })]);
  assert.equal(writer.schema, 'CIIWorkspaceWriter2CompositeRestraintResult.v1');
  assert.equal(writer.components.existingComposite, null);
  assert.equal(writer.familyMutationCounts.restraintDeleteOperations, 1);
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_RESTRAINT_BLOCK_DELETE' && item.kind === 'RESTRAINT_SECTION_PAYLOAD'));
  assert.equal(validation.familyOperationCounts.restraintDelete, 1);
}

// R02 NODENAME + RESTRAINT: adjacent CONTROL authority remains globally disjoint.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const { writer } = run(fixture, [nodeCreate(), restraintDelete(2, 30, spec, { id: 'R02-RESTRAINT' })]);
  assert.equal(writer.familyMutationCounts.nodeNameOperations, 1);
  assert.equal(writer.familyMutationCounts.restraintDeleteOperations, 1);
  const controlClaims = writer.mutations.filter((item) => item.kind.startsWith('CONTROL_'));
  assert(controlClaims.some((item) => item.kind === 'CONTROL_NONAM' && item.authorityFamily === 'WRITER_2_NODENAME'));
  assert(controlClaims.some((item) => item.kind === 'CONTROL_RESTRAINT_BLOCK_COUNT' && item.authorityFamily === 'WRITER_2_RESTRAINT_BLOCK_DELETE'));
  const sorted = [...controlClaims].sort((a, b) => a.byteStart - b.byteStart);
  for (let index = 1; index < sorted.length; index += 1) assert(sorted[index].byteStart >= sorted[index - 1].byteEnd);
}

// R03 SIF DELETE + RESTRAINT.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const { writer } = run(fixture, [sifDelete(), restraintDelete(2, 30, spec, { id: 'R03-RESTRAINT' })]);
  assert.equal(writer.familyMutationCounts.sifDeleteOperations, 1);
  assert.equal(writer.familyMutationCounts.restraintDeleteOperations, 1);
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE' && item.kind === 'SIF_TEE_SECTION_PAYLOAD'));
}

// R04 HANGER DELETE-ALL + RESTRAINT.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const { writer } = run(fixture, [hangerDelete(20), restraintDelete(2, 30, spec, { id: 'R04-RESTRAINT' })]);
  assert.equal(writer.familyMutationCounts.hangerDeleteOperations, 1);
  assert.equal(writer.familyMutationCounts.restraintDeleteOperations, 1);
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_HANGER_DELETE_ALL'));
}

// R06 NODE + SIF + HANGER + RESTRAINT in one original-coordinate transaction.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const { writer, validation } = run(fixture, [nodeCreate(), sifDelete(), hangerDelete(20), restraintDelete(2, 30, spec, { id: 'R06-RESTRAINT' })]);
  assert.deepEqual(validation.familyOperationCounts, { nodeName: 1, sifDelete: 1, hangerDelete: 1, restraintDelete: 1 });
  assert.equal(writer.familyMutationCounts.nodeNameOperations, 1);
  assert.equal(writer.familyMutationCounts.sifDeleteOperations, 1);
  assert.equal(writer.familyMutationCounts.hangerDeleteOperations, 1);
  assert.equal(writer.familyMutationCounts.restraintDeleteOperations, 1);
  assert.equal(writer.mode, 'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
}

// R07 delete blocks {1,2} of 3; retained old block 3 becomes pointer 1.
{
  const fixture = buildFixture();
  const operations = [
    restraintDelete(1, 10, fixture.restraintSpecs[1], { id: 'R07-A' }),
    restraintDelete(2, 30, fixture.restraintSpecs[2], { id: 'R07-B' }),
  ];
  const { writer } = run(fixture, operations);
  assert.deepEqual(writer.components.restraintDelete.relocationPlan.oldToNewPointer, { 1: 0, 2: 0, 3: 1 });
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_RESTRAINT_BLOCK_DELETE'
    && item.kind === 'ELEMENT_RESTRAINT_POINTER' && item.parsedElementIndex === 2 && item.oldPointer === 3 && item.newPointer === 1));
}

// R08 physical pointer 0 is not relocated.
{
  const fixture = buildFixture({ restraintPointers: [0, 1, 2, 3] });
  const spec = fixture.restraintSpecs[1];
  const { writer } = run(fixture, [restraintDelete(1, 30, spec, { id: 'R08' })]);
  assert(!writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_RESTRAINT_BLOCK_DELETE'
    && item.kind === 'ELEMENT_RESTRAINT_POINTER' && item.parsedElementIndex === 0));
}

// R09 restraint-only CONTROL regression: row1/NONAM is byte-identical; row2/RESTRAINTS changes.
{
  const fixture = buildFixture(); const spec = fixture.restraintSpecs[2];
  const beforeRows = controlRows(fixture.targetDocument);
  const { after } = run(fixture, [restraintDelete(2, 30, spec, { id: 'R09' })]);
  const afterRows = controlRows(after);
  assert.equal(afterRows[0], beforeRows[0], 'CONTROL row1 including NONAM must remain byte-identical');
  assert.notEqual(afterRows[1], beforeRows[1], 'CONTROL row2 RESTRAINT count must change');
  assert.equal(afterRows[2], beforeRows[2]);
  assert.equal(afterRows[3], beforeRows[3]);
}

// Static W2.12 policy guards: every new production JS stays <300 lines and validator remains independent.
{
  const production = [
    '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js',
    '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-support.js',
    '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation.js',
    '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation-support.js',
  ];
  for (const relative of production) {
    const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert(source.split(/\r?\n/).length < 300, `${relative} must remain below 300 physical lines`);
    assert(!/\bexport\s+default\b/.test(source), `${relative} must use named exports only`);
  }
  const validatorSources = production.slice(2).map((relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8')).join('\n');
  assert(!validatorSources.includes("from './cii-workspace-writer2-composite-restraint.js'"));
  assert(!validatorSources.includes("from './cii-workspace-writer2-composite-restraint-support.js'"));
}

console.log('Writer2 W2.12 RESTRAINT composite R01-R04, R06-R09 passed.');

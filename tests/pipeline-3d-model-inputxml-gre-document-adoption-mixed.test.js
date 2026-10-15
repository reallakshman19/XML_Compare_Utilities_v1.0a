import assert from 'node:assert/strict';
import { buildPipelineInputXmlGreDocumentAdoptionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption.js';
import {
  createB314GreAdoptionFixture,
  createMixedAdoptionFixture,
  createNoGreAdoptionFixture,
  createNormalGreAdoptionFixture,
} from './pipeline-3d-model-inputxml-gre-document-adoption-fixtures.js';

const fixture = createMixedAdoptionFixture();
const plan = buildPipelineInputXmlGreDocumentAdoptionPlan(fixture);
assert.equal(plan.ready, true, plan.blockerCodes.join(', '));
assert.deepEqual(plan.adoptedElements.map((item) => item.profileId),
  ['normal-metallic', 'normal-metallic', 'gre', 'gre', 'gre', 'gre', 'asme-b31.4', 'asme-b31.4']);
assert.deepEqual(plan.adoptedElements.map((item) => item.analysisSectionId),
  ['AS1', 'AS1', 'AS2', 'AS2', 'AS2', 'AS2', 'AS3', 'AS3']);
assert.equal(plan.counts.numBend, 3);
assert.equal(plan.greBendAuthorities.length, 1);

const normalSource = fixture.sourceDocumentPlan.elements[0];
const normalAdopted = plan.adoptedElements[0];
assert.deepEqual(normalAdopted.bend, normalSource.bend);
assert.deepEqual(normalAdopted.emittedProperties, normalSource.emittedProperties);
assert.equal(normalAdopted.fromNode, normalSource.fromNode);
assert.equal(normalAdopted.toNode, normalSource.toNode);
assert.deepEqual(normalAdopted.profileAuthority.sourceProfileAuthority, normalSource.profileAuthority);

const b314Source = fixture.sourceDocumentPlan.elements[4];
const b314Adopted = plan.adoptedElements.find((item) => item.sourceElementIndexes[0] === 4);
assert.equal(b314Adopted.id, 'E7');
assert.deepEqual(b314Adopted.bend, b314Source.bend);
assert.deepEqual(b314Adopted.emittedProperties, b314Source.emittedProperties);
assert.deepEqual(b314Adopted.profileAuthority.sourceProfileAuthority, b314Source.profileAuthority);

const greBend = plan.greBendAuthorities[0];
assert.equal(greBend.vendorId, 'VENDOR-A');
assert.equal(greBend.fittingThicknessMm, 12);
assert.equal(plan.adoptedElements.filter((item) => item.bend?.fittingThicknessMm === 12).length, 1);
assert.equal(plan.adoptedElements.filter((item) => item.profileId !== 'gre')
  .some((item) => item.bend?.vendorId || item.bend?.fittingThicknessMm === 12), false);
assert.equal(plan.adoptedElements.filter((item) => item.profileId === 'gre')
  .every((item) => item.analysisSectionId === 'AS2'), true);
assert.equal(plan.profileAuthorityPlan.ready, true);
assert.equal(plan.profileAuthorityPlan.blockerCodes.length, 0);
assert.equal(plan.profileAuthorityPlan.elementAuthorities.length, plan.adoptedElements.length);

for (const [label, pairFixture, expectedProfiles] of [
  ['Normal + GRE', createNormalGreAdoptionFixture(), ['normal-metallic', 'gre']],
  ['B31.4 + GRE', createB314GreAdoptionFixture(), ['asme-b31.4', 'gre']],
]) {
  const pair = buildPipelineInputXmlGreDocumentAdoptionPlan(pairFixture);
  assert.equal(pair.ready, true, `${label}: ${pair.blockerCodes.join(', ')}`);
  assert.equal(pair.greBendAuthorities.length, 1);
  assert.deepEqual([...new Set(pair.adoptedElements.map((item) => item.profileId))].sort(),
    [...expectedProfiles].sort());
  assert.equal(pair.counts.numBend, 2);
}

for (const profile of ['normal-metallic', 'asme-b31.4', 'gre']) {
  const noBendFixture = createNoGreAdoptionFixture(profile);
  const noBend = buildPipelineInputXmlGreDocumentAdoptionPlan(noBendFixture);
  assert.equal(noBend.ready, true, `${profile}: ${noBend.blockerCodes.join(', ')}`);
  assert.equal(noBend.greBendAuthorities.length, 0);
  assert.equal(noBend.counts.numBend, 0);
  assert.deepEqual(noBend.removedSourceBlockerCodes, []);
  assert.deepEqual(noBend.adoptedElements.map((item) => [item.fromNode, item.toNode]),
    noBendFixture.sourceDocumentPlan.elements.map((item) => [item.fromNode, item.toNode]));
  assert.deepEqual(noBend.adoptedElements.map((item) => item.emittedProperties),
    noBendFixture.sourceDocumentPlan.elements.map((item) => item.emittedProperties));
}

console.log('pipeline-3d-model InputXML GRE document adoption mixed profiles: PASS');

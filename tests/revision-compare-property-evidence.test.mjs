import assert from 'node:assert/strict';
import {
  ENGINEERING_PROPERTY_FIELD_SCHEMA,
  ENGINEERING_PROPERTY_SET_SCHEMA,
  ENGINEERING_REVISION_TOKEN_SCHEMA,
  createEngineeringRevisionToken,
} from '../core/engineering-scene/index.js';
import {
  classifyRevisionChangedProperty,
  createRevisionComparePropertyEvidence,
  rawRevisionDifferenceEvidence,
  revisionComparePropertyAuditKey,
} from '../tabs/revision-compare/revision-compare-property-evidence.js';

function property(propertyKey, revAValue, revBValue, paths = {}) {
  return {
    propertyKey,
    revAValue,
    revBValue,
    revAEvidencePath: Object.hasOwn(paths, 'revA') ? paths.revA : `/revA/${propertyKey}`,
    revBEvidencePath: Object.hasOwn(paths, 'revB') ? paths.revB : `/revB/${propertyKey}`,
    normalizationRule: 'EXACT',
  };
}

function row(index, changedProperties = []) {
  return {
    schema: 'RevisionDifferenceRow.v1',
    differenceId: `difference-${index}`,
    differenceCategory: index % 3 === 0 ? 'ADDED' : index % 3 === 1 ? 'REMOVED' : 'CHANGED',
    matchCertainty: index % 11 === 0 ? 'AMBIGUOUS' : 'EXACT',
    changedProperties,
  };
}

function auditWithRows(differenceRows) {
  return {
    schema: 'RevisionCompareAudit.v1',
    auditId: 'audit-property-evidence',
    basisId: 'basis-property-evidence',
    revADocumentId: 'rev-a-document',
    revBDocumentId: 'rev-b-document',
    engineVersion: 'revision-compare-v1',
    differenceRows,
  };
}

const exactPaths = {
  leading: '  Rev A/leading',
  trailing: 'Rev B/trailing  ',
  backslash: String.raw`C:\Plant\RevA\pressure.xml#value`,
  forward: '/plant/revB/pressure.xml#/value',
  uri: 'urn:revision:a?path=%2Fpressure#value',
};
const tenProperties = [
  property('pressure', 10, 12, { revA: exactPaths.leading, revB: exactPaths.trailing }),
  property('enabled', false, true, { revA: exactPaths.backslash, revB: exactPaths.forward }),
  property('material', 'A106', 'A333', { revA: exactPaths.uri, revB: 'file:///Rev%20B/material.json#/value' }),
  property('previousNullNumber', null, 4),
  property('currentNullNumber', 4, null),
  property('previousNullText', null, 'Ready'),
  property('currentNullText', 'Ready', null),
  property('previousNullBoolean', null, true),
  property('currentNullBoolean', false, null),
  property('unchangedText', 'Same', 'Same'),
];
const selectedIndex = 2500;
const largeRows = Array.from({ length: 5000 }, (_, index) => row(index, index === selectedIndex ? tenProperties : []));
const audit = auditWithRows(largeRows);
const auditBefore = JSON.stringify(audit);
const evidence = createRevisionComparePropertyEvidence(audit);
const repeated = createRevisionComparePropertyEvidence(audit);

assert.equal(evidence.schema, 'RevisionComparePropertyEvidence.v1');
assert.equal(evidence.revision.schema, ENGINEERING_REVISION_TOKEN_SCHEMA);
assert.equal(audit.schema, 'RevisionCompareAudit.v1');
assert(audit.differenceRows.every((item) => item.schema === 'RevisionDifferenceRow.v1'));
assert.deepEqual(evidence.revision, repeated.revision, 'audit revision token must be deterministic');
assert.deepEqual(evidence.revision.value, {
  auditId: audit.auditId,
  basisId: audit.basisId,
  revADocumentId: audit.revADocumentId,
  revBDocumentId: audit.revBDocumentId,
  engineVersion: audit.engineVersion,
});
const sameAuditIdDifferentAuthority = { ...audit, basisId: 'basis-property-evidence-2' };
assert.notEqual(revisionComparePropertyAuditKey(audit), revisionComparePropertyAuditKey(sameAuditIdDifferentAuthority));
assert.equal(JSON.stringify(audit), auditBefore, 'adapter construction must not mutate the audit');

const differenceId = `difference-${selectedIndex}`;
const sets = await evidence.provider.getPropertySets([differenceId], evidence.revision);
assert.equal(sets.length, 1);
assert.equal(sets[0].schema, ENGINEERING_PROPERTY_SET_SCHEMA);
assert.deepEqual(sets[0].ownerIds, [differenceId]);
assert.deepEqual(sets[0].revision, evidence.revision);
assert.equal(sets[0].fields.length, 10);
assert.deepEqual(sets[0].fields.map((field) => field.key), tenProperties.map((item) => item.propertyKey));
assert.deepEqual(sets[0].fields.map((field) => field.label), tenProperties.map((item) => item.propertyKey));
assert(sets[0].fields.every((field) => field.schema === ENGINEERING_PROPERTY_FIELD_SCHEMA));
assert(sets[0].fields.every((field) => field.editable === false));
assert(sets[0].fields.every((field) => field.unit === null));
assert.equal(sets[0].fields[0].previousValue, 10);
assert.equal(sets[0].fields[0].value, 12);
assert.equal(sets[0].fields[0].previousSource, exactPaths.leading);
assert.equal(sets[0].fields[0].source, exactPaths.trailing);
assert.equal(sets[0].fields[1].previousSource, exactPaths.backslash);
assert.equal(sets[0].fields[1].source, exactPaths.forward);
assert.equal(sets[0].fields[2].previousSource, exactPaths.uri);
assert.equal(sets[0].fields[2].source, 'file:///Rev%20B/material.json#/value');
assert.equal(typeof sets[0].fields[0].value, 'number');
assert.equal(typeof sets[0].fields[1].value, 'boolean');
assert.equal(typeof sets[0].fields[2].value, 'string');
assert.equal(Object.hasOwn(sets[0].fields[3], 'previousValue'), true);
assert.equal(sets[0].fields[3].previousValue, null);
assert.equal(sets[0].fields[4].value, null);

const explicitNullA = property('nullRevAPath', 1, 2, { revA: null, revB: '/revB/null-a' });
const explicitNullB = property('nullRevBPath', 1, 2, { revA: '/revA/null-b', revB: null });
const nullAField = classifyRevisionChangedProperty(explicitNullA).field;
const nullBField = classifyRevisionChangedProperty(explicitNullB).field;
assert.equal(Object.hasOwn(nullAField, 'previousSource'), true);
assert.equal(nullAField.previousSource, null);
assert.equal(nullAField.source, '/revB/null-a');
assert.equal(nullBField.previousSource, '/revA/null-b');
assert.equal(nullBField.source, null);

const raw = rawRevisionDifferenceEvidence(audit, differenceId);
assert.deepEqual(raw.map((item) => item.propertyKey), tenProperties.map((item) => item.propertyKey));
assert.equal(raw[0].revAEvidencePath, exactPaths.leading);
assert.equal(raw[0].revBEvidencePath, exactPaths.trailing);
assert.equal(JSON.stringify(audit), auditBefore, 'provider resolution must not mutate the audit');

const stale = createEngineeringRevisionToken({ ...evidence.revision.value, engineVersion: 'stale' });
await assert.rejects(() => evidence.provider.getPropertySets([differenceId], stale), /stale audit revision token/);
await assert.rejects(
  () => evidence.provider.getPropertySets(['unknown-difference'], evidence.revision),
  /Unknown Revision Compare difference ID/,
);
assert.deepEqual(await evidence.provider.getPropertySets(['difference-0'], evidence.revision), []);

const invalidA = property('invalidRevAPath', 1, 2);
invalidA.revAEvidencePath = undefined;
const invalidB = property('invalidRevBPath', 3, 4);
invalidB.revBEvidencePath = { unsafe: true };
const validSibling = property('validSibling', 5, 6, { revA: '  A\\sibling ', revB: ' B/sibling  ' });
const malformedAudit = auditWithRows([row(1, [invalidA, validSibling, invalidB])]);
const malformedBefore = structuredClone(malformedAudit);
const malformedEvidence = createRevisionComparePropertyEvidence(malformedAudit);
const malformedSets = await malformedEvidence.provider.getPropertySets(['difference-1'], malformedEvidence.revision);
assert.deepEqual(malformedSets[0].fields.map((field) => field.key), ['validSibling']);
assert.equal(malformedSets[0].fields[0].previousSource, '  A\\sibling ');
assert.equal(malformedSets[0].fields[0].source, ' B/sibling  ');
assert.deepEqual(malformedEvidence.fallback('difference-1').map((item) => item.propertyKey), [
  'invalidRevAPath', 'invalidRevBPath',
]);
assert(malformedEvidence.fallback('difference-1').every((item) => item.reason === 'INVALID_EVIDENCE_PATH'));
assert.equal(Object.hasOwn(malformedEvidence.fallback('difference-1')[0], 'revAEvidencePath'), true);
assert.equal(malformedEvidence.fallback('difference-1')[0].revAEvidencePath, undefined);
assert.deepEqual(malformedEvidence.fallback('difference-1')[1].revBEvidencePath, { unsafe: true });
assert.deepEqual(malformedAudit, malformedBefore);

const mixedAudit = auditWithRows([
  row(2, [
    property('supported', 1, 2),
    property('crossType', 1, '2'),
    property('objectValue', { exact: true }, { exact: false }),
  ]),
]);
const mixedEvidence = createRevisionComparePropertyEvidence(mixedAudit);
const mixedSets = await mixedEvidence.provider.getPropertySets(['difference-2'], mixedEvidence.revision);
assert.deepEqual(mixedSets[0].fields.map((field) => field.key), ['supported']);
assert.deepEqual(mixedEvidence.fallback('difference-2').map((item) => item.propertyKey), ['crossType', 'objectValue']);
assert.deepEqual(mixedEvidence.rawAuditEvidence('difference-2').map((item) => item.propertyKey), [
  'supported', 'crossType', 'objectValue',
]);
assert.equal(mixedEvidence.fallback('difference-2')[0].reason, 'MISMATCHED_NON_NULL_SCALAR_TYPES');
assert.equal(mixedEvidence.fallback('difference-2')[1].reason, 'UNSUPPORTED_VALUE_TYPE');
assert.deepEqual(mixedEvidence.fallback('difference-2')[1].revAValue, { exact: true });

for (const [item, reason] of [
  [property('bothNull', null, null), 'BOTH_VALUES_NULL'],
  [property('nonFinite', Number.NaN, 1), 'NON_FINITE_NUMBER'],
  [property('array', [], []), 'UNSUPPORTED_VALUE_TYPE'],
  [property('undefined', undefined, 1), 'UNSUPPORTED_VALUE_TYPE'],
  [property('bigint', 1n, 2n), 'UNSUPPORTED_VALUE_TYPE'],
  [property('symbol', Symbol('a'), Symbol('b')), 'UNSUPPORTED_VALUE_TYPE'],
  [property('function', () => 1, () => 2), 'UNSUPPORTED_VALUE_TYPE'],
]) {
  const classified = classifyRevisionChangedProperty(item);
  assert.equal(classified.supported, false);
  assert.equal(classified.fallback.reason, reason);
}

const metrics = evidence.evidence();
assert.equal(metrics.differenceRowCount, 5000);
assert.equal(metrics.indexedLookup, true);
assert.equal(metrics.sourceDocumentLookups, 0);
assert.equal(metrics.comparisonReruns, 0);
assert.equal(evidence.supportedCount(differenceId), 10);
assert.equal(evidence.fallback(differenceId).length, 0);
assert.equal(JSON.stringify(audit), auditBefore);

console.log('revision-compare-property-evidence.test.mjs passed');

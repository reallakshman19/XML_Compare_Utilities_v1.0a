import assert from 'node:assert/strict';
import { _test as previewTest } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import {
  ciiExpectedNodeNameOperation,
  createCiiExpectedNodeNameSourceSetSelection,
} from '../tabs/cii-workspace/cii-workspace-multisource-scope.js';
import { _test as readinessTest } from '../tabs/cii-workspace/cii-workspace-multisource-writer2-readiness.js';
import {
  ciiBm001CorrespondenceCoverage,
  ciiCanonicalWriter2MutationSelection,
  ciiWriter2NodeNameCardinalityOperation,
  ciiWriter2PhysicalMutationConflicts,
  ciiWriter2PhysicalMutationKey,
} from '../tabs/cii-workspace/cii-workspace-multisource-bm001-correspondence.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import {
  CII_MS_SOURCE_SET_SHA256,
  CII_MS_TARGET_SHA256,
  ciiMsBm001AliasSet,
  parseCiiMsBm001,
} from '../tabs/cii-workspace/cii-workspace-multisource-nodename-authority.js';

const aliasSet = ciiMsBm001AliasSet();
function operation(sourceValue, targetValue) {
  return {
    sourceEvidence: { value: sourceValue },
    targetEvidence: { value: targetValue },
  };
}
function correspondenceEvidence(id, sourceNames, targetName) {
  return {
    operationId: id,
    action: 'BLOCKED',
    status: 'BLOCKED',
    bm001Acceptance: { benchmark: 'BM-001', status: 'BOUND', sourceNames, targetName },
  };
}
function cardinalityOperation({ id, sourceId = 'S1', action = 'CREATE', target = '9040', before = '', proposed = 'SL-106.3', status = 'REVIEWED' }) {
  return {
    operationId: id,
    sourceId,
    family: 'NODE_NAME',
    property: 'Node name / to-name',
    action,
    status: 'PREVIEW_READY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    matchAuthority: { status },
    targetEvidence: { identity: target, value: before },
    sourceEvidence: { value: proposed },
    before,
    proposed,
  };
}
function fullBmEvidence() {
  return parseCiiMsBm001().map((row) => correspondenceEvidence(
    `BM-${row.rowNumber}`,
    [String(row.sourceNames[0]).replace(/^\//, '')],
    row.targetName,
  ));
}
function sourceSetPlan(mutations) {
  return {
    status: 'PREVIEW_READY',
    sourceAuthorityKind: 'SOURCE_SET',
    sourceSetSha256: CII_MS_SOURCE_SET_SHA256,
    targetAuthorityKind: 'ORIGINAL_TARGET',
    targetAuthority: { originalSha256: CII_MS_TARGET_SHA256 },
    operations: [...fullBmEvidence(), ...mutations],
    excludedOperations: [],
  };
}

const exact = previewTest.inferredAcceptanceBinding(operation('SL-106.3', 'PS02494.1'), aliasSet);
assert(exact, 'raw CII source name without Owner-table slash must bind its exact BM-001 alias');
assert.deepStrictEqual(exact.sourceNames, ['SL-106.3']);
assert.strictEqual(exact.targetName, 'PS02494.1');

const decorated = previewTest.inferredAcceptanceBinding(operation('/SL-106.3', 'PS02494.1'), aliasSet);
assert(decorated, 'Owner-table slash notation must remain accepted as the same lexical source alias');
assert.strictEqual(previewTest.inferredAcceptanceBinding(operation('SL-106', 'PS02494.1'), aliasSet), null,
  'family-only SL-106 must not bind an exact dotted BM-001 identity');
assert.strictEqual(previewTest.inferredAcceptanceBinding(operation('SL-106.4', 'PS02494.1'), aliasSet), null,
  'a dotted sibling must not bind another sibling target merely because the canonical family matches');

const sibling = previewTest.inferredAcceptanceBinding(operation('SL-106.4', 'PS02482.1'), aliasSet);
assert(sibling, 'the correct dotted sibling must bind its own exact target');
assert.deepStrictEqual(sibling.sourceNames, ['SL-106.4']);
for (const sourceAlias of ['SL-104.8', 'X6']) {
  assert(previewTest.inferredAcceptanceBinding(operation(sourceAlias, 'PS02497.1'), aliasSet),
    `${sourceAlias} must bind as an exact member of its multi-alias BM-001 row`);
}

const authorityRows = [
  { rowNumber: 1, sourceNames: ['/SL-106.3'], targetName: 'PS02494.1' },
  { rowNumber: 2, sourceNames: ['/SL-104.8', '/X6'], targetName: 'PS02497.1' },
];
const covered = ciiBm001CorrespondenceCoverage({ operations: [
  correspondenceEvidence('E1', ['SL-106.3'], 'PS02494.1'),
  correspondenceEvidence('E2', ['X6'], 'PS02497.1'),
] }, authorityRows);
assert.equal(covered.status, 'READY');
assert.equal(covered.observationStatus, 'COMPLETE');
assert.equal(covered.matchedRowCount, 2);
assert.deepStrictEqual(covered.missingRowNumbers, []);

const partialCoverage = ciiBm001CorrespondenceCoverage({ operations: [
  correspondenceEvidence('E1', ['SL-106.3'], 'PS02494.1'),
] }, authorityRows);
assert.equal(partialCoverage.status, 'READY', 'unobserved frozen BM rows are custody metadata, not invalid correspondence evidence');
assert.equal(partialCoverage.observationStatus, 'PARTIAL');
assert.equal(partialCoverage.matchedRowCount, 1);
assert.deepStrictEqual(partialCoverage.missingRowNumbers, [2]);
assert.deepStrictEqual(partialCoverage.invalidOperationIds, []);

const familyOnlyCoverage = ciiBm001CorrespondenceCoverage({ operations: [
  correspondenceEvidence('E1', ['SL-106'], 'PS02494.1'),
  correspondenceEvidence('E2', ['X6'], 'PS02497.1'),
] }, authorityRows);
assert.equal(familyOnlyCoverage.status, 'BLOCKED');
assert.deepStrictEqual(familyOnlyCoverage.missingRowNumbers, [1]);
assert.deepStrictEqual(familyOnlyCoverage.invalidOperationIds, ['E1']);

const wrongSiblingCoverage = ciiBm001CorrespondenceCoverage({ operations: [
  correspondenceEvidence('E1', ['SL-106.4'], 'PS02494.1'),
  correspondenceEvidence('E2', ['SL-104.8'], 'PS02497.1'),
] }, authorityRows);
assert.equal(wrongSiblingCoverage.status, 'BLOCKED');
assert.deepStrictEqual(wrongSiblingCoverage.missingRowNumbers, [1]);
assert.deepStrictEqual(wrongSiblingCoverage.invalidOperationIds, ['E1']);

const create = cardinalityOperation({ id: 'CREATE-S1' });
assert.equal(ciiWriter2NodeNameCardinalityOperation(create), true);
assert.equal(ciiExpectedNodeNameOperation(create), true);
assert.equal(readinessTest.isQualifiedExpectedApply({ ...create, scopeDecision: 'APPLY' }), true);
assert.equal(ciiWriter2PhysicalMutationKey(create), 'NODE_NAME|CREATE|9040||SL-106.3');

const deleteOp = cardinalityOperation({ id: 'DELETE-S1', action: 'DELETE', target: '8870', before: 'PS02494.1', proposed: '' });
assert.equal(ciiWriter2NodeNameCardinalityOperation(deleteOp), true);
assert.equal(ciiWriter2PhysicalMutationKey(deleteOp), 'NODE_NAME|DELETE|8870|PS02494.1|');

const overwrite = cardinalityOperation({ id: 'OVERWRITE', before: 'PS02494.1', proposed: 'SL-106.3' });
assert.equal(ciiWriter2NodeNameCardinalityOperation(overwrite), false, 'same-row overwrite is not Writer2 cardinality authority');

const corroborating = cardinalityOperation({ id: 'CREATE-S2', sourceId: 'S2' });
const canonical = ciiCanonicalWriter2MutationSelection([corroborating, create]);
assert.deepStrictEqual(canonical.appliedOperationIds, ['CREATE-S1']);
assert.deepStrictEqual(canonical.duplicateOperationIds, ['CREATE-S2']);
assert.deepStrictEqual(canonical.corroborationGroups[0].sourceIds, ['S1', 'S2']);
assert.deepStrictEqual(canonical.conflicts, []);

const scopeSelection = await createCiiExpectedNodeNameSourceSetSelection(sourceSetPlan([create, corroborating]), { cryptoRef: globalThis.crypto });
assert.equal(scopeSelection.authority.correspondenceCoverage.status, 'READY');
assert.equal(scopeSelection.authority.correspondenceCoverage.matchedRowCount, 329);
assert.deepStrictEqual(scopeSelection.appliedOperationIds, ['CREATE-S1']);
assert.deepStrictEqual(scopeSelection.duplicateCorroborationOperationIds, ['CREATE-S2']);
assert(scopeSelection.excludedOperationIds.includes('CREATE-S2'));
assert.equal(scopeSelection.selection.decisions.find((row) => row.operationId === 'CREATE-S1')?.decision, 'APPLY');
assert.equal(scopeSelection.selection.decisions.find((row) => row.operationId === 'CREATE-S2')?.decision, 'EXCLUDE');

const wrongSiblingMutation = cardinalityOperation({ id: 'CREATE-S3', sourceId: 'S3', proposed: 'SL-106.4' });
const siblingConflicts = ciiWriter2PhysicalMutationConflicts([create, wrongSiblingMutation]);
assert.equal(siblingConflicts.length, 1);
assert.equal(siblingConflicts[0].physicalTargetKey, 'NODE_NAME|9040');
assert.deepStrictEqual(siblingConflicts[0].operationIds, ['CREATE-S1', 'CREATE-S3']);
const siblingSelection = ciiCanonicalWriter2MutationSelection([create, wrongSiblingMutation]);
assert.deepStrictEqual(siblingSelection.appliedOperationIds, [], 'different dotted siblings for one physical target must block auto-selection');
assert.equal(siblingSelection.conflicts.length, 1);
assert.notEqual(ciiWriter2PhysicalMutationKey(create), ciiWriter2PhysicalMutationKey(wrongSiblingMutation));
assert.match(readinessTest.conflictingPhysicalMutationBlockers([
  { ...create, scopeDecision: 'APPLY' },
  { ...wrongSiblingMutation, scopeDecision: 'APPLY' },
])[0], /CII_MS_WRITER2_PHYSICAL_MUTATION_CONFLICT:NODE_NAME\|9040/);
await assert.rejects(
  createCiiExpectedNodeNameSourceSetSelection(sourceSetPlan([create, wrongSiblingMutation]), { cryptoRef: globalThis.crypto }),
  /CII_MS_WRITER2_PHYSICAL_MUTATION_CONFLICT:NODE_NAME\|9040/,
);

console.log('CII multi-source BM correspondence / exact Writer2 cardinality checks passed.');
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportPrimaryRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-primary-relationship.js';
import { reconcileSupportPrimaryAssemblies } from '../tabs/support-steel-relationship-builder/support-primary-reconciliation.js';

function relationshipBundle(pairs = []) {
  return buildSupportPrimaryRelationshipBundle({
    relationshipRows: pairs.map(([supportA, supportB], index) => ({
      edgeType: 'SupportChain',
      supportA,
      supportB,
      clashName: `Relationship-${index + 1}`,
      sourceInput: 'Clash within Supports',
      relationshipBasis: ['EXPLICIT_SUPPORT_CLASH'],
      relationshipEvidenceId: `REL-${index + 1}`,
    })),
  });
}

function locationGroup(groupId, familyId, memberIds, overrides = {}) {
  return {
    groupId,
    secondarySupportFamilyId: familyId,
    fullLineTag: 'ASIM-1835-2"-P8810320-31441C4-HT-01',
    branchNodes: ['ASIM-1835-2"-P8810320-31441C4-HT-01/B1'],
    primarySupportMemberIds: memberIds,
    representativeClashPointGlobalMm: { x: 100, y: 200, z: 300 },
    ...overrides,
  };
}

test('two geometry groups deduplicate onto one explicit primary-support assembly', () => {
  const bundle = relationshipBundle([
    ['/PS-11167.2', '/PS-11167.11'],
  ]);
  const result = reconcileSupportPrimaryAssemblies({
    relationshipBundle: bundle,
    locationGroups: [
      locationGroup('G-1', 'PS-11167', ['/PS-11167.2']),
      locationGroup('G-2', 'PS-11167', ['/PS-11167.11'], {
        representativeClashPointGlobalMm: { x: 900, y: 700, z: 300 },
      }),
    ],
  });

  assert.equal(result.assignments[0].status, 'EXPLICIT_ASSEMBLY');
  assert.equal(result.assignments[1].status, 'EXPLICIT_ASSEMBLY');
  assert.equal(result.assignments[0].primarySupportAssemblyId, 'PSA::PS-11167::M-2+11');
  assert.equal(result.assignments[1].primarySupportAssemblyId, 'PSA::PS-11167::M-2+11');
  assert.deepEqual(result.familySummaries[0].distinctResolvedAssignmentIds, ['PSA::PS-11167::M-2+11']);
});

test('one geometry group spanning two explicit assemblies fails visible instead of choosing one', () => {
  const bundle = relationshipBundle([
    ['/PS-11167.2', '/PS-11167.11'],
    ['/PS-11167.4', '/PS-11167.5'],
  ]);
  const result = reconcileSupportPrimaryAssemblies({
    relationshipBundle: bundle,
    locationGroups: [locationGroup('G-CONFLICT', 'PS-11167', ['/PS-11167.2', '/PS-11167.4'])],
  });
  const assignment = result.assignments[0];

  assert.equal(assignment.status, 'CONFLICT');
  assert.equal(assignment.countable, false);
  assert.equal(assignment.primarySupportAssemblyId, '');
  assert.deepEqual(assignment.candidateAssemblyIds, [
    'PSA::PS-11167::M-2+11',
    'PSA::PS-11167::M-4+5',
  ]);
  assert.equal(assignment.diagnostics[0].code, 'PRIMARY_ASSEMBLY_RECONCILIATION_CONFLICT');
});

test('partial explicit membership is retained but withheld from countable assignment', () => {
  const bundle = relationshipBundle([
    ['/PS-11167.2', '/PS-11167.11'],
  ]);
  const result = reconcileSupportPrimaryAssemblies({
    relationshipBundle: bundle,
    locationGroups: [locationGroup('G-PARTIAL', 'PS-11167', ['/PS-11167.2', '/PS-11167.99'])],
  });
  const assignment = result.assignments[0];

  assert.equal(assignment.status, 'PARTIAL_EXPLICIT');
  assert.equal(assignment.countable, false);
  assert.equal(assignment.primarySupportAssemblyId, '');
  assert.deepEqual(assignment.candidateAssemblyIds, ['PSA::PS-11167::M-2+11']);
  assert.deepEqual(assignment.unmatchedConcreteMemberIds, ['/PS-11167.99']);
  assert.equal(assignment.diagnostics[0].code, 'PRIMARY_ASSEMBLY_PARTIAL_EXPLICIT_MEMBERSHIP');
});

test('geometry-only fallback receives deterministic provisional identity independent of member/branch order', () => {
  const left = locationGroup('G-A', 'PS-11167', ['/PS-11167.9', '/PS-11167.8'], {
    branchNodes: ['B2', 'B1'],
  });
  const right = locationGroup('G-B', 'PS-11167', ['/PS-11167.8', '/PS-11167.9'], {
    branchNodes: ['B1', 'B2'],
  });
  const result = reconcileSupportPrimaryAssemblies({ locationGroups: [left, right] });

  assert.ok(result.assignments.every((assignment) => assignment.status === 'GEOMETRY_ONLY'));
  assert.ok(result.assignments.every((assignment) => assignment.countable));
  assert.equal(result.assignments[0].primarySupportAssemblyId, result.assignments[1].primarySupportAssemblyId);
  assert.match(result.assignments[0].primarySupportAssemblyId, /^PSA::PS-11167::G-[0-9A-F]{8}$/u);
});

test('DATUM-only location evidence stays non-countable even when it belongs to an explicit assembly', () => {
  const bundle = relationshipBundle([
    ['/PS-11236.4', '/PS-11236/DATUM'],
  ]);
  const result = reconcileSupportPrimaryAssemblies({
    relationshipBundle: bundle,
    locationGroups: [locationGroup('G-DATUM', 'PS-11236', ['/PS-11236/DATUM'])],
  });
  const assignment = result.assignments[0];

  assert.equal(assignment.status, 'SYMBOLIC_ONLY');
  assert.equal(assignment.countable, false);
  assert.equal(assignment.primarySupportAssemblyId, '');
  assert.deepEqual(assignment.observedSymbolicMemberIds, ['/PS-11236/DATUM']);
  assert.deepEqual(assignment.symbolicCandidateAssemblyIds, ['PSA::PS-11236::M-4']);
});

test('unsupported relationship schema cannot acquire explicit assembly authority', () => {
  const valid = relationshipBundle([
    ['/PS-11167.2', '/PS-11167.11'],
  ]);
  const wrongSchema = { ...valid, schema: 'SupportPrimaryRelationshipBundle.v999' };
  const result = reconcileSupportPrimaryAssemblies({
    relationshipBundle: wrongSchema,
    locationGroups: [locationGroup('G-SCHEMA', 'PS-11167', ['/PS-11167.2'])],
  });

  assert.equal(result.relationshipEvidenceAvailable, false);
  assert.equal(result.assignments[0].status, 'GEOMETRY_ONLY');
  assert.equal(result.assignments[0].candidateAssemblyIds.length, 0);
});

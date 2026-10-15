import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPsFamilyOfflineValidationBenchmark } from '../tabs/ps-family-clash-audit/ps-family-offline-validation-benchmark.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';

function matchingBundle() {
  return {
    schema: 'SupportSteelRelationshipBundle.v1',
    supportFamilies: [{
      familyId: '/PS-14396',
      members: [
        { memberId: '/PS-14396.4', semanticRole: 'WEAR_PLATE' },
        { memberId: '/PS-14396.8', semanticRole: 'PIPE_SHOE' },
        { memberId: '/PS-14396.9', semanticRole: 'GUIDE_MEMBER' },
        { memberId: '/PS-14396.10', semanticRole: 'BRACKET_MEMBER' },
      ],
    }],
    relationships: [{
      relationshipId: '/PS-14396::/PS-14396',
      evidenceId: 'SSRB:/PS-14396::/PS-14396',
      supportFamilyId: '/PS-14396',
      steelGroupId: '/PS-14396',
      relationshipStatus: 'RESOLVED_EXPLICIT',
      confidence: 'HIGH',
    }],
    supportMemberChain: {
      supportChainEdges: [
        edge('/PS-14396.4', '/PS-14396.8'),
        edge('/PS-14396.8', '/PS-14396.9'),
        edge('/PS-14396.9', '/PS-14396.10'),
      ],
      structuralTerminalEdges: [],
      referenceEdges: [],
      nearbyCandidateEdges: [],
      familyChains: [],
    },
    diagnostics: [],
  };
}

function edge(left, right) {
  return {
    edgeId: `SSMC:${left}::${right}`,
    evidenceId: `SSMC:${left}::${right}`,
    supportFamilyId: '/PS-14396',
    supportA: left,
    supportB: right,
    contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
  };
}

function benchmark(bundle = matchingBundle(), overrides = {}) {
  return buildPsFamilyOfflineValidationBenchmark({
    relationshipBundle: bundle,
    structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
    supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
    ...overrides,
  });
}

test('reports complete reference agreement for matching graph and XML edges', () => {
  const result = benchmark();
  assert.equal(result.schema, 'PsFamilyOfflineValidationBenchmark.v1');
  assert.equal(result.validationOnly, true);
  assert.equal(result.productionDependency, false);
  assert.equal(result.summary.status, 'MEETS_REFERENCE_THRESHOLDS');
  assert.equal(result.structural.metrics.precision, 1);
  assert.equal(result.structural.metrics.recall, 1);
  assert.equal(result.structural.metrics.matchCount, 1);
  assert.equal(result.chain.metrics.precision, 1);
  assert.equal(result.chain.metrics.recall, 1);
  assert.equal(result.chain.metrics.matchCount, 3);
  assert.equal(result.summary.disagreementCount, 0);
});

test('classifies a conflicting structural target as DIFFERENT_STEEL', () => {
  const bundle = matchingBundle();
  bundle.relationships[0].steelGroupId = '/SL-9999';
  bundle.relationships[0].evidenceId = 'SSRB:/PS-14396::/SL-9999';
  const result = benchmark(bundle);
  assert.equal(result.structural.metrics.precision, 0);
  assert.equal(result.structural.metrics.recall, 0);
  assert.ok(result.structural.disagreements.some((row) => row.classification === 'DIFFERENT_STEEL'));
  const row = result.structural.disagreements.find((item) => item.classification === 'DIFFERENT_STEEL');
  assert.deepEqual(row.graphSteelGroupIds, ['SL-9999']);
  assert.deepEqual(row.xmlSteelGroupIds, ['PS-14396']);
});

test('classifies rejected nearest structural evidence as OUT_OF_TOLERANCE', () => {
  const bundle = matchingBundle();
  bundle.relationships = [{
    relationshipId: '/PS-14396::UNRESOLVED',
    evidenceId: 'SSRB:/PS-14396::UNRESOLVED',
    supportFamilyId: '/PS-14396',
    steelGroupId: null,
    nearestSteelGroupId: '/PS-14396',
    relationshipStatus: 'UNRESOLVED',
    withinProjectionTolerance: false,
    distanceMm: 50,
    projectionToleranceMm: 25,
  }];
  const result = benchmark(bundle);
  const row = result.structural.disagreements.find((item) => item.classification === 'OUT_OF_TOLERANCE');
  assert.ok(row);
  assert.equal(row.distanceMm, 50);
  assert.equal(row.toleranceMm, 25);
});

test('classifies mismatched support-chain topology as DIFFERENT_MEMBER', () => {
  const bundle = matchingBundle();
  bundle.supportMemberChain.supportChainEdges = [
    edge('/PS-14396.4', '/PS-14396.8'),
    edge('/PS-14396.8', '/PS-14396.10'),
    edge('/PS-14396.9', '/PS-14396.10'),
  ];
  const result = benchmark(bundle);
  assert.equal(result.chain.metrics.matchCount, 2);
  assert.ok(result.chain.disagreements.some((row) => row.classification === 'DIFFERENT_MEMBER'));
});

test('reports incomplete reference coverage without making XML a production dependency', () => {
  const result = benchmark(matchingBundle(), { structureXmlText: '', supportXmlText: '' });
  assert.equal(result.summary.status, 'INCOMPLETE_REFERENCE_COVERAGE');
  assert.equal(result.productionDependency, false);
  assert.ok(result.diagnostics.some((row) => row.code === 'NO_STRUCTURAL_XML_REFERENCE'));
  assert.ok(result.diagnostics.some((row) => row.code === 'NO_CHAIN_XML_REFERENCE'));
});

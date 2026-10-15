import { buildPsFamilyNativeAuditPipeline } from './ps-family-native-combined-input.js';
import { PS_FAMILY_INDEPENDENT_TRUTH_FIXTURES } from '../../samples/ps-family-clash-audit/ps-family-independent-truth-fixtures.js';

export const PS_FAMILY_INDEPENDENT_TRUTH_SUITE_SCHEMA = 'PsFamilyIndependentTruthSuite.v1';

export function runPsFamilyIndependentTruthSuite(input = {}) {
  const fixtures = input.fixtures || PS_FAMILY_INDEPENDENT_TRUTH_FIXTURES;
  const results = fixtures.map(runFixture);
  const metrics = {
    supportChain: aggregateMetrics(results, 'chainEdgeKeys'),
    structuralTerminal: aggregateMetrics(results, 'terminalKeys'),
    completeFamilyPath: aggregateMetrics(results, 'completeFamilyIds'),
    ambiguousFamily: aggregateMetrics(results, 'ambiguousFamilyIds'),
  };
  const failures = results.flatMap((row) => row.checks
    .filter((check) => !check.passed)
    .map((check) => ({ fixtureId: row.fixtureId, ...check })));
  return {
    schema: PS_FAMILY_INDEPENDENT_TRUTH_SUITE_SCHEMA,
    sourceClass: 'INDEPENDENT_MODEL_TRUTH',
    xmlRequired: false,
    fixtureCount: results.length,
    results,
    metrics,
    failures,
    summary: {
      status: failures.length ? 'TRUTH_SUITE_FAILURES' : 'TRUTH_SUITE_PASSED',
      passedFixtureCount: results.filter((row) => row.passed).length,
      failedFixtureCount: results.filter((row) => !row.passed).length,
      checkCount: results.reduce((sum, row) => sum + row.checks.length, 0),
      failedCheckCount: failures.length,
      minimumPrecision: minimum(Object.values(metrics).map((row) => row.precision)),
      minimumRecall: minimum(Object.values(metrics).map((row) => row.recall)),
    },
  };
}

function runFixture(fixture) {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    combinedInput: fixture.combinedModel,
    relationshipConfig: fixture.config || {},
  });
  const observed = observePipeline(pipeline);
  const expected = fixture.expected || {};
  const checks = [
    setCheck('CHAIN_EDGES', observed.chainEdgeKeys, expected.chainEdgeKeys || []),
    setCheck('STRUCTURAL_TERMINALS', observed.terminalKeys, expected.terminalKeys || []),
    setCheck('COMPLETE_FAMILY_PATHS', observed.completeFamilyIds, expected.completeFamilyIds || []),
    setCheck('AMBIGUOUS_FAMILIES', observed.ambiguousFamilyIds, expected.ambiguousFamilyIds || []),
    valueCheck('TOPOLOGY_CONNECTION_COUNT', observed.topologyConnectionCount, expected.topologyConnectionCount),
    subsetCheck('PATH_EXCEPTION_CODES', observed.pathExceptionCodes, expected.requiredPathExceptionCodes || []),
  ];
  return {
    fixtureId: fixture.fixtureId,
    sourceClass: fixture.sourceClass,
    passed: checks.every((row) => row.passed),
    expected,
    observed,
    checks,
    pipelineSummary: pipeline.summary,
  };
}

function observePipeline(pipeline) {
  const bundle = pipeline.relationshipBundle || {};
  const chain = bundle.supportMemberChain || {};
  const path = bundle.supportCarrierToStructurePath || {};
  return {
    chainEdgeKeys: unique((chain.supportChainEdges || []).map((row) => pair(row.supportA, row.supportB))),
    terminalKeys: unique((chain.structuralTerminalEdges || [])
      .filter((row) => row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
        && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE')
      .map((row) => terminal(row.supportMemberId, row.steelGroupId))),
    completeFamilyIds: unique((path.familyResults || [])
      .filter((row) => row.pathStatus === 'COMPLETE')
      .map((row) => id(row.supportFamilyId))),
    ambiguousFamilyIds: unique((bundle.relationships || [])
      .filter((row) => row.relationshipStatus === 'AMBIGUOUS')
      .map((row) => id(row.supportFamilyId))),
    topologyConnectionCount: bundle.supportCarrierTopology?.summary?.connectionCount || 0,
    pathExceptionCodes: unique((path.pathExceptions || []).map((row) => row.exceptionCode)),
  };
}

function aggregateMetrics(results, key) {
  const predicted = new Set();
  const reference = new Set();
  results.forEach((result) => {
    (result.observed[key] || []).forEach((value) => predicted.add(`${result.fixtureId}::${value}`));
    (result.expected[key] || []).forEach((value) => reference.add(`${result.fixtureId}::${value}`));
  });
  const matches = [...predicted].filter((value) => reference.has(value));
  return {
    predictedCount: predicted.size,
    referenceCount: reference.size,
    matchCount: matches.length,
    falsePositiveCount: [...predicted].filter((value) => !reference.has(value)).length,
    falseNegativeCount: [...reference].filter((value) => !predicted.has(value)).length,
    precision: predicted.size ? round(matches.length / predicted.size) : reference.size ? 0 : 1,
    recall: reference.size ? round(matches.length / reference.size) : predicted.size ? 0 : 1,
  };
}

function setCheck(checkId, observed, expected) {
  const actual = new Set(observed || []);
  const truth = new Set(expected || []);
  const falsePositives = [...actual].filter((value) => !truth.has(value));
  const falseNegatives = [...truth].filter((value) => !actual.has(value));
  return { checkId, passed: !falsePositives.length && !falseNegatives.length, falsePositives, falseNegatives };
}
function subsetCheck(checkId, observed, required) {
  const actual = new Set(observed || []);
  const missing = (required || []).filter((value) => !actual.has(value));
  return { checkId, passed: !missing.length, missing, observed: [...actual] };
}
function valueCheck(checkId, observed, expected) {
  return { checkId, passed: observed === expected, observed, expected };
}
function pair(left, right) { return [id(left), id(right)].sort().join('::'); }
function terminal(member, steel) { return `${id(member)}::${id(steel)}`; }
function id(value) { const text = String(value || '').replace(/^\/+/, '').toUpperCase(); return text ? `/${text}` : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function round(value) { return Number(value.toFixed(6)); }
function minimum(values) { return values.length ? Math.min(...values) : 1; }

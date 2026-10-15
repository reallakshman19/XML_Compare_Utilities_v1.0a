import assert from 'node:assert/strict';
import test from 'node:test';
import { PS_14396_INDEPENDENT_COMBINED_MODEL } from '../samples/ps-family-clash-audit/ps-14396-independent-combined-model.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';
import { buildPsFamilyIndependentModelBenchmark } from '../tabs/ps-family-clash-audit/ps-family-offline-validation-independent-benchmark.js';

const result = buildPsFamilyIndependentModelBenchmark({
  combinedInput: PS_14396_INDEPENDENT_COMBINED_MODEL,
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  relationshipConfig: { memberContactToleranceMm: 2, carrierTopologyExactToleranceMm: 0.5 },
});

test('independent benchmark', () => {
  assert.equal(result.schema, 'PsFamilyIndependentModelBenchmark.v1');
  assert.equal(result.reference.structural.metrics.recall, 1);
  assert.equal(result.reference.chain.metrics.recall, 1);
  assert.equal(result.memberTerminal.metrics.recall, 1);
  assert.equal(result.memberTerminal.metrics.matchCount, 2);
  const coverage = new Map(result.coverage.map((row) => [row.layer, row]));
  assert.equal(coverage.get('FAMILY_TO_STEEL').coverageStatus, 'REFERENCE_COMPARABLE');
  assert.equal(coverage.get('CARRIER_IDENTITY').coverageStatus, 'MODEL_ONLY');
});

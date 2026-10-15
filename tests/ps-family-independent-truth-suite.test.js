import assert from 'node:assert/strict';
import test from 'node:test';
import { runPsFamilyIndependentTruthSuite } from '../tabs/ps-family-clash-audit/ps-family-independent-truth-suite.js';

const suite = runPsFamilyIndependentTruthSuite();

test('truth suite passes', () => {
  assert.equal(suite.summary.status, 'TRUTH_SUITE_PASSED');
  assert.equal(suite.fixtureCount, 4);
  assert.equal(suite.summary.failedCheckCount, 0);
});

test('truth suite metrics are exact', () => {
  for (const metrics of Object.values(suite.metrics)) {
    assert.equal(metrics.falsePositiveCount, 0);
    assert.equal(metrics.falseNegativeCount, 0);
    assert.equal(metrics.precision, 1);
    assert.equal(metrics.recall, 1);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPsFamilyValidationExports,
  exportPsFamilyValidationDisagreementsCsv,
  exportPsFamilyValidationMetricsCsv,
} from '../tabs/ps-family-clash-audit/ps-family-offline-validation-export.js';
import {
  renderPsFamilyOfflineValidation,
  renderPsFamilyValidationPanel,
} from '../tabs/ps-family-clash-audit/ps-family-offline-validation-view.js';

const panel = renderPsFamilyValidationPanel();
for (const label of [
  'Offline Validation Benchmark', 'Development and QA only',
  'Structural precision threshold', 'Structural recall threshold',
  'Chain precision threshold', 'Chain recall threshold',
  'Run Offline Validation', 'Download Metrics CSV',
  'Download Disagreements CSV', 'Download Validation JSON',
]) assert.ok(panel.includes(label), `missing validation UI label ${label}`);
for (const key of [
  'run-offline-validation', 'download-validation-metrics',
  'download-validation-disagreements', 'download-validation-json',
  'offline-validation-results',
]) assert.ok(panel.includes(`data-psfa="${key}"`), `missing validation control ${key}`);

const benchmark = {
  schema: 'PsFamilyOfflineValidationBenchmark.v1',
  validationOnly: true,
  productionDependency: false,
  referenceCaution: 'Historical clash XML is a comparison reference.',
  summary: { status: 'BELOW_REFERENCE_THRESHOLDS' },
  structural: {
    metrics: {
      status: 'BELOW_REFERENCE_THRESHOLDS', matchCount: 1, graphAcceptedCount: 2,
      xmlReferenceCount: 2, precision: 0.5, recall: 0.5,
      precisionThreshold: 0.98, recallThreshold: 0.95,
      falsePositiveReferenceCount: 1, falseNegativeReferenceCount: 1,
    },
    disagreements: [{
      classification: 'DIFFERENT_STEEL', supportFamilyId: 'PS-100',
      graphSteelGroupIds: ['SL-1'], xmlSteelGroupIds: ['SL-2'],
      evidenceIds: ['SSRB:1'], referenceIds: ['Clash1'],
    }],
  },
  chain: {
    metrics: {
      status: 'MEETS_REFERENCE_THRESHOLDS', matchCount: 2, graphAcceptedCount: 2,
      xmlReferenceCount: 2, precision: 1, recall: 1,
      precisionThreshold: 0.97, recallThreshold: 0.95,
      falsePositiveReferenceCount: 0, falseNegativeReferenceCount: 0,
    },
    disagreements: [],
  },
  diagnostics: [],
};

const view = renderPsFamilyOfflineValidation(benchmark);
assert.match(view, /BELOW_REFERENCE_THRESHOLDS/);
assert.match(view, /Structural relationships/);
assert.match(view, /Support-member chain/);
assert.match(view, /DIFFERENT_STEEL/);
assert.match(view, /50\.00%/);
assert.match(view, /Validation only: Yes/);
assert.match(view, /Production dependency: No/);

const metrics = exportPsFamilyValidationMetricsCsv(benchmark);
assert.match(metrics, /Area,Status,MatchCount/);
assert.match(metrics, /STRUCTURAL_RELATIONSHIPS/);
assert.match(metrics, /SUPPORT_CHAIN/);
const disagreements = exportPsFamilyValidationDisagreementsCsv(benchmark);
assert.match(disagreements, /Classification,SupportFamilyId/);
assert.match(disagreements, /DIFFERENT_STEEL/);
assert.match(disagreements, /SSRB:1/);
const exports = createPsFamilyValidationExports(benchmark);
assert.equal(exports.metricsCsv, metrics);
assert.equal(exports.disagreementsCsv, disagreements);
assert.match(exports.validationJson, /PsFamilyOfflineValidationBenchmark\.v1/);

const addon = readFileSync('tabs/ps-family-clash-audit/ps-family-offline-validation-addon.js', 'utf8');
const viewSource = readFileSync('tabs/ps-family-clash-audit/ps-family-offline-validation-view.js', 'utf8');
const bootstrap = readFileSync('tabs/ps-family-clash-audit/ps-family-evidence-audit-bootstrap.js', 'utf8');
assert.match(addon, /dataset\.psfaWorkspaceTab = TAB_KEY/);
assert.match(addon, /buildPsFamilyOfflineValidationBenchmark/);
assert.match(addon, /saveTextFile/);
assert.match(viewSource, /benchmark\.validationOnly/);
assert.match(viewSource, /benchmark\.productionDependency/);
assert.match(bootstrap, /ps-family-offline-validation-addon\.js/);
assert.match(bootstrap, /restraint-function-v1/);
assert.match(bootstrap, /ps-family-native-audit-pipeline-addon\.js/);
assert.match(bootstrap, /ps-family-restraint-function-addon\.js/);

console.log('ps-family-offline-validation-ui tests passed');

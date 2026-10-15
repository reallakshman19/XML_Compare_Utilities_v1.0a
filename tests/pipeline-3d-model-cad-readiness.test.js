import assert from 'node:assert/strict';
import {
  PIPELINE_CAD_READINESS_SCHEMA,
  PIPELINE_CAD_REQUIRED_SCENARIOS,
  assertPipelineCadReadiness,
  buildPipelineCadReadinessAudit,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-readiness.js';
import { runPipelineCadReadinessBenchmark } from '../scripts/lib/pipeline-cad-readiness-runner.mjs';

const audit = await runPipelineCadReadinessBenchmark({
  generatedAt: '2026-07-13T00:00:00.000Z',
  sourceRevision: 'test-revision',
});

assert.equal(audit.schema, PIPELINE_CAD_READINESS_SCHEMA);
assert.equal(audit.status, 'READY_FOR_GUARDED_SWITCH_PROPOSAL');
assert.equal(audit.passed, true);
assert.equal(audit.summary.requiredScenarioCount, 5);
assert.equal(audit.summary.passedScenarioCount, 5);
assert.deepEqual(audit.summary.failedScenarioIds, []);
assert.deepEqual(audit.summary.failedGateIds, []);
assert.deepEqual(audit.scenarios.map((scenario) => scenario.id), PIPELINE_CAD_REQUIRED_SCENARIOS.map((scenario) => scenario.id));
assert.ok(audit.scenarios.every((scenario) => scenario.status === 'PASS'));
assert.ok(audit.gates.every((gate) => gate.status === 'PASS'));
assert.equal(audit.runtime.featureFlagDefaultOff, true);
assert.equal(audit.runtime.legacySvgFallbackPresent, true);
assert.equal(audit.runtime.canvasModulesPresent, true);
assert.equal(audit.runtime.productionDefaultSwitched, false);
assert.deepEqual(audit.consoleErrors, []);
assert.equal(assertPipelineCadReadiness(audit), audit);

const failed = buildPipelineCadReadinessAudit({
  generatedAt: '2026-07-13T00:00:00.000Z',
  sourceRevision: 'failed-revision',
  scenarios: PIPELINE_CAD_REQUIRED_SCENARIOS.map((scenario, index) => ({
    id: scenario.id,
    passed: index !== 2,
    diagnostics: index === 2 ? ['forced failure'] : [],
  })),
  runtime: {
    featureFlagDefaultOff: true,
    legacySvgFallbackPresent: true,
    canvasModulesPresent: true,
    productionDefaultSwitched: false,
  },
  consoleErrors: [],
});

assert.equal(failed.passed, false);
assert.equal(failed.status, 'NOT_READY');
assert.deepEqual(failed.summary.failedScenarioIds, ['CAD-B03']);
assert.ok(failed.summary.failedGateIds.includes('CAD-G01'));
assert.throws(() => assertPipelineCadReadiness(failed), /CAD-B03/);

console.log('pipeline-3d-model CAD readiness tests passed');

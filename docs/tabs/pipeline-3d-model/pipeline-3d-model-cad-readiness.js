export const PIPELINE_CAD_READINESS_SCHEMA = 'PipelineCadReadinessAudit.v1';

export const PIPELINE_CAD_REQUIRED_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'CAD-B01', title: 'Table 2 vertical drag and delayed graph reload' }),
  Object.freeze({ id: 'CAD-B02', title: 'Table 3 depth and A/G snapping' }),
  Object.freeze({ id: 'CAD-B03', title: 'Table 3 marker inverse coordinate mapping' }),
  Object.freeze({ id: 'CAD-B04', title: 'Range-row identity and dirty highlight stability' }),
  Object.freeze({ id: 'CAD-B05', title: 'Manual raw typing override without Canvas replacement' }),
]);

function normalizeBoolean(value) {
  return value === true;
}

function normalizeScenarioResult(definition, supplied) {
  const result = supplied || {};
  return Object.freeze({
    id: definition.id,
    title: definition.title,
    status: normalizeBoolean(result.passed) ? 'PASS' : 'FAIL',
    passed: normalizeBoolean(result.passed),
    durationMs: Number.isFinite(Number(result.durationMs)) ? Math.max(0, Number(result.durationMs)) : null,
    evidence: Object.freeze({ ...(result.evidence || {}) }),
    diagnostics: Object.freeze((Array.isArray(result.diagnostics) ? result.diagnostics : []).map(String)),
  });
}

function failedGate(id, title, diagnostics = []) {
  return Object.freeze({ id, title, status: 'FAIL', passed: false, diagnostics: Object.freeze(diagnostics.map(String)) });
}

function passedGate(id, title) {
  return Object.freeze({ id, title, status: 'PASS', passed: true, diagnostics: Object.freeze([]) });
}

export function buildPipelineCadReadinessAudit(input = {}) {
  const suppliedScenarios = new Map((input.scenarios || []).map((scenario) => [scenario.id, scenario]));
  const scenarios = PIPELINE_CAD_REQUIRED_SCENARIOS.map((definition) => normalizeScenarioResult(definition, suppliedScenarios.get(definition.id)));
  const consoleErrors = Object.freeze((Array.isArray(input.consoleErrors) ? input.consoleErrors : []).map(String));
  const runtime = Object.freeze({
    featureFlagDefaultOff: normalizeBoolean(input.runtime?.featureFlagDefaultOff),
    legacySvgFallbackPresent: normalizeBoolean(input.runtime?.legacySvgFallbackPresent),
    canvasModulesPresent: normalizeBoolean(input.runtime?.canvasModulesPresent),
    productionDefaultSwitched: normalizeBoolean(input.runtime?.productionDefaultSwitched),
  });

  const gates = Object.freeze([
    scenarios.every((scenario) => scenario.passed)
      ? passedGate('CAD-G01', 'All required CAD benchmark scenarios pass')
      : failedGate('CAD-G01', 'All required CAD benchmark scenarios pass', scenarios.filter((scenario) => !scenario.passed).map((scenario) => `${scenario.id} failed`)),
    consoleErrors.length === 0
      ? passedGate('CAD-G02', 'No console errors during benchmark execution')
      : failedGate('CAD-G02', 'No console errors during benchmark execution', consoleErrors),
    runtime.canvasModulesPresent
      ? passedGate('CAD-G03', 'Canvas runtime modules are present')
      : failedGate('CAD-G03', 'Canvas runtime modules are present', ['Canvas module evidence is missing.']),
    runtime.legacySvgFallbackPresent
      ? passedGate('CAD-G04', 'Legacy SVG fallback remains available')
      : failedGate('CAD-G04', 'Legacy SVG fallback remains available', ['Legacy fallback evidence is missing.']),
    runtime.featureFlagDefaultOff && !runtime.productionDefaultSwitched
      ? passedGate('CAD-G05', 'Production default remains unchanged during readiness proof')
      : failedGate('CAD-G05', 'Production default remains unchanged during readiness proof', ['Canvas must remain opt-in until a separate runtime-switch PR is approved.']),
  ]);

  const passed = gates.every((gate) => gate.passed);
  const failedScenarioIds = Object.freeze(scenarios.filter((scenario) => !scenario.passed).map((scenario) => scenario.id));
  const failedGateIds = Object.freeze(gates.filter((gate) => !gate.passed).map((gate) => gate.id));

  return Object.freeze({
    schema: PIPELINE_CAD_READINESS_SCHEMA,
    generatedAt: input.generatedAt || new Date().toISOString(),
    sourceRevision: String(input.sourceRevision || 'unknown'),
    status: passed ? 'READY_FOR_GUARDED_SWITCH_PROPOSAL' : 'NOT_READY',
    passed,
    recommendation: passed
      ? 'A separate guarded runtime-switch proposal may be opened. Do not remove the legacy SVG fallback in that proposal.'
      : 'Keep Canvas shadow mode opt-in and correct all failed scenarios and gates before proposing a runtime switch.',
    scenarios: Object.freeze(scenarios),
    gates,
    runtime,
    consoleErrors,
    summary: Object.freeze({
      requiredScenarioCount: PIPELINE_CAD_REQUIRED_SCENARIOS.length,
      passedScenarioCount: scenarios.filter((scenario) => scenario.passed).length,
      failedScenarioIds,
      failedGateIds,
    }),
  });
}

export function assertPipelineCadReadiness(audit) {
  if (audit?.schema !== PIPELINE_CAD_READINESS_SCHEMA) {
    throw new Error(`Unexpected readiness schema: ${audit?.schema || 'missing'}`);
  }
  if (audit.passed) return audit;
  const failures = [
    ...(audit.summary?.failedScenarioIds || []),
    ...(audit.summary?.failedGateIds || []),
  ];
  throw new Error(`Pipeline CAD readiness gate failed: ${failures.join(', ') || 'unknown failure'}`);
}

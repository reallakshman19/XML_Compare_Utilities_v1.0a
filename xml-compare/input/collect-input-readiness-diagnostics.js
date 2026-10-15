const SEVERITIES = new Set(['INFO', 'WARNING', 'BLOCKER']);

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeSeverity(value, fallback = 'WARNING') {
  const severity = clean(value || fallback).toUpperCase();
  if (severity === 'ERROR' || severity === 'FAIL') return 'BLOCKER';
  return SEVERITIES.has(severity) ? severity : fallback;
}

function freezeRef(ref) {
  if (!ref || typeof ref !== 'object') return ref ?? '';
  return Object.freeze({ ...ref });
}

function messageOf(input = {}, fallback = 'Input readiness diagnostic.') {
  return clean(input.message || input.error || input.reason || input.code || fallback);
}

export function normalizeInputReadinessDiagnostic(input = {}, defaults = {}) {
  if (input instanceof Error) {
    return Object.freeze({ severity: 'BLOCKER', code: clean(defaults.code || 'parse_error'), message: input.message, ref: freezeRef(defaults.ref || '') });
  }
  if (typeof input === 'string') {
    return Object.freeze({ severity: normalizeSeverity(defaults.severity, 'WARNING'), code: clean(defaults.code || 'input_diagnostic'), message: input, ref: freezeRef(defaults.ref || '') });
  }
  const source = input || {};
  return Object.freeze({
    severity: normalizeSeverity(source.severity || defaults.severity, 'WARNING'),
    code: clean(source.code || source.gate || defaults.code || 'input_diagnostic'),
    message: messageOf(source, defaults.message),
    ref: freezeRef(source.ref || source.sourceRef || source.details || defaults.ref || ''),
  });
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function sideKey(side = 'a') {
  return side === 'b' ? 'B' : 'A';
}

function datasetOf(report = {}, side = 'a') {
  return side === 'b' ? report.datasets?.B || {} : report.datasets?.A || {};
}

function sideMatches(diagnostic = {}, side = 'a') {
  const sideId = sideKey(side), sideName = side === 'b' ? 'target' : 'source';
  const fields = [diagnostic.side, diagnostic.sourceId, diagnostic.datasetId, diagnostic.ref?.side, diagnostic.ref?.sourceId, diagnostic.ref?.datasetId].map(clean).filter(Boolean);
  if (!fields.length) return true;
  return fields.some((value) => [side, sideId, sideName].includes(value));
}

function parserError(message, ref = {}) {
  return normalizeInputReadinessDiagnostic(message, { severity: 'BLOCKER', code: 'parse_error', ref });
}

export function collectInputReadinessDiagnosticsForSide({ state = {}, workspace = {}, model = {}, side = 'a' } = {}) {
  const report = state.report || {}, dataset = datasetOf(report, side), diagnostics = [];
  diagnostics.push(...list(model.diagnostics).map((item) => normalizeInputReadinessDiagnostic(item)));
  diagnostics.push(...list(model.intake?.diagnostics).map((item) => normalizeInputReadinessDiagnostic(item)));
  diagnostics.push(...list(model.adapter?.diagnostics).map((item) => normalizeInputReadinessDiagnostic(item)));
  diagnostics.push(...list(workspace.diagnostics).filter((item) => sideMatches(item, side)).map((item) => normalizeInputReadinessDiagnostic(item)));
  diagnostics.push(...list(report.parseErrors).map((item) => parserError(item, { side })));
  if (dataset.error) diagnostics.push(parserError(dataset.error, { side, datasetId: sideKey(side) }));
  diagnostics.push(...list(dataset.diagnostics).map((item) => normalizeInputReadinessDiagnostic(item, { ref: { side, datasetId: sideKey(side) } })));
  return Object.freeze(diagnostics);
}

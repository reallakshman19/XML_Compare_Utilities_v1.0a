export const XML_INPUT_READINESS_AUDIT_SCHEMA = 'xml-input-readiness-audit/v1';
export const INPUT_READINESS_SOURCE_SCHEMA = 'xml-input-readiness-source/v1';

const SEVERITIES = new Set(['INFO', 'WARNING', 'BLOCKER']);

function clean(value) {
  return String(value ?? '').trim();
}

function freezeList(items) {
  return Object.freeze([...(Array.isArray(items) ? items : [])]);
}

function normalizeSeverity(value) {
  const severity = clean(value).toUpperCase();
  if (severity === 'ERROR' || severity === 'FAIL') return 'BLOCKER';
  return SEVERITIES.has(severity) ? severity : 'INFO';
}

function freezeRef(ref) {
  if (!ref || typeof ref !== 'object') return ref ?? '';
  return Object.freeze({ ...ref });
}

function identitySummaryOf(input = {}) {
  const source = input.identitySummary || {};
  return Object.freeze({
    recordCount: Number(source.recordCount) || 0,
    stableCount: Number(source.stableCount) || 0,
    lowConfidenceCount: Number(source.lowConfidenceCount) || 0,
    syntheticFallbackCount: Number(source.syntheticFallbackCount) || 0,
    unknownCount: Number(source.unknownCount) || 0,
  });
}

function coordinateSummaryOf(input = {}) {
  const source = input.coordinateFrameSummary || {};
  return Object.freeze({
    recordCount: Number(source.recordCount) || 0,
    absoluteCount: Number(source.absoluteCount) || 0,
    relativeCount: Number(source.relativeCount) || 0,
    sideloadGlobalCount: Number(source.sideloadGlobalCount) || 0,
    syntheticLayoutCount: Number(source.syntheticLayoutCount) || 0,
    unknownCount: Number(source.unknownCount) || 0,
    comparableForDeltaCount: Number(source.comparableForDeltaCount) || 0,
    notComparableForDeltaCount: Number(source.notComparableForDeltaCount) || 0,
  });
}

export function createReadinessDiagnostic(input = {}) {
  const source = typeof input === 'string' ? { message: input } : input || {};
  const severity = normalizeSeverity(source.severity);
  const code = clean(source.code || source.gate || severity.toLowerCase());
  return Object.freeze({
    severity,
    code,
    message: clean(source.message || code || severity),
    ref: freezeRef(source.ref || source.sourceRef || source.details || ''),
  });
}

export function summarizeDiagnostics(diagnostics = []) {
  const normalized = diagnostics.map(createReadinessDiagnostic);
  return Object.freeze({
    blockerCount: normalized.filter((item) => item.severity === 'BLOCKER').length,
    warningCount: normalized.filter((item) => item.severity === 'WARNING').length,
  });
}

export function isReadyForConnector(source = {}) {
  const summary = summarizeDiagnostics(source.diagnostics || []);
  const blockerCount = Number(source.blockerCount ?? summary.blockerCount) || 0;
  const recordCount = Number(source.recordCount) || 0;
  return Boolean(source.parseOk) && recordCount > 0 && blockerCount === 0;
}

export function createInputReadinessSource(input = {}) {
  const diagnostics = freezeList((input.diagnostics || []).map(createReadinessDiagnostic));
  const summary = summarizeDiagnostics(diagnostics);
  const source = {
    schema: INPUT_READINESS_SOURCE_SCHEMA,
    sourceId: clean(input.sourceId),
    side: clean(input.side),
    fileName: clean(input.fileName),
    rawTextHash: clean(input.rawTextHash),
    profile: clean(input.profile || 'unknown'),
    parseOk: Boolean(input.parseOk),
    recordCount: Math.max(0, Number(input.recordCount) || 0),
    blockerCount: summary.blockerCount,
    warningCount: summary.warningCount,
    diagnostics,
    identitySummary: identitySummaryOf(input),
    coordinateFrameSummary: coordinateSummaryOf(input),
  };
  return Object.freeze({ ...source, readyForConnector: isReadyForConnector(source) });
}

export function createInputReadinessAudit({ sourceA = {}, targetB = {}, generatedAt = '' } = {}) {
  const a = sourceA.schema === INPUT_READINESS_SOURCE_SCHEMA ? sourceA : createInputReadinessSource(sourceA);
  const b = targetB.schema === INPUT_READINESS_SOURCE_SCHEMA ? targetB : createInputReadinessSource(targetB);
  return Object.freeze({
    schema: XML_INPUT_READINESS_AUDIT_SCHEMA,
    generatedAt: clean(generatedAt) || new Date().toISOString(),
    sourceA: a,
    targetB: b,
    summary: Object.freeze({
      readyForConnector: Boolean(a.readyForConnector && b.readyForConnector),
      blockerCount: (Number(a.blockerCount) || 0) + (Number(b.blockerCount) || 0),
      warningCount: (Number(a.warningCount) || 0) + (Number(b.warningCount) || 0),
    }),
  });
}

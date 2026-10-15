import { dedupeInputReadinessDiagnostics } from './dedupe-input-readiness-diagnostics.js';

const GATE_SCHEMA = 'xml-input-readiness-gate-snapshot/v1';
const PROFILE_BLOCKERS = new Set(['blank_input', 'xml_parse_failed', 'json_parse_failed', 'unsupported_xml_profile', 'unsupported_json_profile', 'unsupported_table_profile', 'unknown_input_profile', 'zero_records']);

function clean(value) {
  return String(value ?? '').trim();
}

function num(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function normalizedDiagnostics(diagnostics = []) {
  return dedupeInputReadinessDiagnostics((Array.isArray(diagnostics) ? diagnostics : []).map((item = {}) => Object.freeze({
    severity: clean(item.severity || 'INFO'),
    code: clean(item.code || 'diagnostic'),
    message: clean(item.message || item.code || 'Readiness diagnostic.'),
    ref: item.ref || '',
  })));
}

function bySeverity(diagnostics = [], severity = 'BLOCKER') {
  return diagnostics.filter((item) => item.severity === severity);
}

function codesOf(diagnostics = []) {
  return Object.freeze([...new Set(diagnostics.map((item) => item.code).filter(Boolean))]);
}

function statusFrom(pass, warn = false) {
  if (!pass) return 'FAIL';
  return warn ? 'WARN' : 'PASS';
}

function profileStatus(side = {}, blockers = [], warnings = []) {
  const blockerCodes = codesOf(blockers.filter((item) => PROFILE_BLOCKERS.has(item.code)));
  const warningCodes = codesOf(warnings);
  const lowConfidence = warningCodes.includes('profile_low_confidence');
  return Object.freeze({
    status: blockerCodes.length ? 'FAIL' : statusFrom(true, lowConfidence),
    profile: clean(side.profile || 'unknown'),
    parseOk: Boolean(side.parseOk),
    blockerCodes,
    warningCodes,
  });
}

function recordStatus(side = {}) {
  const recordCount = num(side.recordCount);
  return Object.freeze({ status: recordCount > 0 ? 'PASS' : 'FAIL', recordCount });
}

function identityStatus(summary = {}) {
  const recordCount = num(summary.recordCount), stableCount = num(summary.stableCount);
  const syntheticFallbackCount = num(summary.syntheticFallbackCount), unknownCount = num(summary.unknownCount);
  const lowConfidenceCount = num(summary.lowConfidenceCount), allSyntheticUnknown = recordCount > 0 && syntheticFallbackCount + unknownCount >= recordCount;
  const pass = stableCount > 0 && !allSyntheticUnknown;
  return Object.freeze({ status: statusFrom(pass, lowConfidenceCount > 0), recordCount, stableCount, lowConfidenceCount, syntheticFallbackCount, unknownCount });
}

function coordinateFrameStatus(summary = {}) {
  const recordCount = num(summary.recordCount), syntheticLayoutCount = num(summary.syntheticLayoutCount), unknownCount = num(summary.unknownCount);
  const allSyntheticUnknown = recordCount > 0 && syntheticLayoutCount + unknownCount >= recordCount;
  const pass = recordCount > 0 && !allSyntheticUnknown, notComparableForDeltaCount = num(summary.notComparableForDeltaCount);
  return Object.freeze({
    status: statusFrom(pass, notComparableForDeltaCount > 0),
    recordCount,
    absoluteCount: num(summary.absoluteCount),
    relativeCount: num(summary.relativeCount),
    sideloadGlobalCount: num(summary.sideloadGlobalCount),
    syntheticLayoutCount,
    unknownCount,
    comparableForDeltaCount: num(summary.comparableForDeltaCount),
    notComparableForDeltaCount,
  });
}

function diagnosticStatus(side = {}, blockers = [], warnings = []) {
  const blockerCount = num(side.blockerCount ?? blockers.length), warningCount = num(side.warningCount ?? warnings.length);
  return Object.freeze({ status: blockerCount > 0 ? 'FAIL' : statusFrom(true, warningCount > 0), blockerCount, warningCount, blockerCodes: codesOf(blockers), warningCodes: codesOf(warnings) });
}

function sidePass(side = {}, statuses = {}) {
  const identity = statuses.identityStatus || {}, coordinates = statuses.coordinateFrameStatus || {};
  return Boolean(side.readyForConnector) && side.parseOk === true && num(side.recordCount) > 0 && num(side.blockerCount) === 0 && identity.status !== 'FAIL' && coordinates.status !== 'FAIL';
}

export function summarizeReadinessGateSide(sideReadiness = {}, options = {}) {
  const diagnostics = normalizedDiagnostics(sideReadiness.diagnostics || []), blockers = bySeverity(diagnostics, 'BLOCKER'), warnings = bySeverity(diagnostics, 'WARNING');
  const statuses = {
    profileStatus: profileStatus(sideReadiness, blockers, warnings),
    recordStatus: recordStatus(sideReadiness),
    identityStatus: identityStatus(sideReadiness.identitySummary || {}),
    coordinateFrameStatus: coordinateFrameStatus(sideReadiness.coordinateFrameSummary || {}),
    diagnosticStatus: diagnosticStatus(sideReadiness, blockers, warnings),
  };
  return Object.freeze({
    sourceId: clean(sideReadiness.sourceId || options.sourceId),
    side: clean(sideReadiness.side || options.side),
    fileName: clean(sideReadiness.fileName),
    status: sidePass(sideReadiness, statuses) ? 'PASS' : 'FAIL',
    readyForConnector: Boolean(sideReadiness.readyForConnector),
    ...statuses,
    blockerCount: statuses.diagnosticStatus.blockerCount,
    warningCount: statuses.diagnosticStatus.warningCount,
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(warnings),
  });
}

function gateReasons(sourceA, targetB) {
  const reasons = [];
  if (sourceA.status !== 'PASS') reasons.push('Source A readiness gate failed.');
  if (targetB.status !== 'PASS') reasons.push('Target B readiness gate failed.');
  return Object.freeze(reasons);
}

export function buildInputReadinessGateSnapshot(audit = {}, options = {}) {
  const sourceA = summarizeReadinessGateSide(audit.sourceA || {}, { sourceId: 'A', side: 'Source A' });
  const targetB = summarizeReadinessGateSide(audit.targetB || {}, { sourceId: 'B', side: 'Target B' });
  const blockerCount = sourceA.blockerCount + targetB.blockerCount, warningCount = sourceA.warningCount + targetB.warningCount;
  const pass = sourceA.status === 'PASS' && targetB.status === 'PASS';
  return Object.freeze({
    schema: GATE_SCHEMA,
    generatedAt: clean(options.generatedAt || audit.generatedAt) || new Date().toISOString(),
    auditSchema: clean(audit.schema),
    gate: Object.freeze({ status: pass ? 'PASS' : 'FAIL', readyForConnector: pass, blockerCount, warningCount, reasons: gateReasons(sourceA, targetB) }),
    sourceA,
    targetB,
  });
}

export function serializeInputReadinessGateSnapshotJson(snapshot = {}) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

import {
  createInputReadinessAudit,
  createInputReadinessSource,
  createReadinessDiagnostic,
} from '../contracts/xml-input-readiness-contracts.js';
import { identityReadyForConnector } from '../contracts/stable-xml-identity-contract.js';
import { buildCoordinateFrameStatusSummary } from './build-coordinate-frame-status.js';
import { buildStableXmlIdentitySummary } from './build-stable-xml-identity.js';
import { dedupeInputReadinessDiagnostics } from './dedupe-input-readiness-diagnostics.js';
import { hashText } from './hash-text.js';

function clean(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function recordsOf(input = {}) {
  const dataset = input.dataset || {};
  const candidates = [input.records, dataset.records, dataset.baseRecords, dataset.components, dataset.parsed?.elements];
  return Object.freeze((candidates.find(Array.isArray) || []).filter(Boolean));
}

function recordCountOf(input = {}) {
  const dataset = input.dataset || {};
  const count = [input.recordCount, recordsOf(input).length, dataset.summary?.recordCount]
    .find((item) => Number.isFinite(Number(item)));
  return Math.max(0, Number(count) || 0);
}

function explicitErrors(input = {}) {
  const dataset = input.dataset || {};
  return [...asArray(input.errors), ...asArray(dataset.errors), ...asArray(dataset.error).filter(Boolean)];
}

function hasParseBlocker(input = {}) {
  const codes = new Set(['parse_error', 'xml_parse_failed', 'json_parse_failed']);
  return asArray(input.diagnostics).some((item) => codes.has(clean(item?.code)) && clean(item?.severity) === 'BLOCKER');
}

function parseOkOf(input = {}) {
  if (!clean(input.rawText)) return false;
  if (input.parseOk === false || input.ok === false || input.dataset?.ok === false) return false;
  if (hasParseBlocker(input)) return false;
  return explicitErrors(input).length === 0;
}

function diagnosticFromUnknown(value, fallbackCode = 'input_diagnostic') {
  if (value instanceof Error) return createReadinessDiagnostic({ severity: 'BLOCKER', code: 'parse_error', message: value.message });
  if (typeof value === 'string') return createReadinessDiagnostic({ severity: 'WARNING', code: fallbackCode, message: value });
  return createReadinessDiagnostic({ severity: value?.severity || 'WARNING', ...value });
}

function parseErrorDiagnostic(error) {
  if (error instanceof Error) return createReadinessDiagnostic({ severity: 'BLOCKER', code: 'parse_error', message: error.message });
  if (typeof error === 'string') return createReadinessDiagnostic({ severity: 'BLOCKER', code: 'parse_error', message: error });
  return createReadinessDiagnostic({ severity: 'BLOCKER', code: 'parse_error', ...error });
}

export function normalizeInputProfile(input = {}) {
  if (!clean(input.rawText)) return 'empty';
  return clean(input.profile || input.dataset?.profile || input.dataset?.type || input.dataset?.profileId || 'unknown');
}

function identityDiagnostics(summary = {}) {
  const diagnostics = [];
  if (summary.recordCount > 0 && !identityReadyForConnector(summary)) {
    diagnostics.push(createReadinessDiagnostic({ severity: 'BLOCKER', code: 'stable_identity_not_ready', message: 'Stable input identity is not sufficient for connector readiness.' }));
  }
  if (summary.lowConfidenceCount > 0) {
    diagnostics.push(createReadinessDiagnostic({ severity: 'WARNING', code: 'low_identity_confidence', message: `${summary.lowConfidenceCount} record(s) use low-confidence identity.` }));
  }
  return diagnostics;
}

function coordinateDiagnostics(summary = {}) {
  const diagnostics = [];
  if (summary.unknownCount > 0) {
    diagnostics.push(createReadinessDiagnostic({ severity: 'WARNING', code: 'coordinate_frame_unknown', message: `${summary.unknownCount} record(s) have unknown coordinate frame.` }));
  }
  if (summary.recordCount > 0 && summary.notComparableForDeltaCount === summary.recordCount) {
    diagnostics.push(createReadinessDiagnostic({ severity: 'WARNING', code: 'coordinate_frame_not_delta_comparable', message: 'No records are engineering-delta comparable.' }));
  }
  return diagnostics;
}

export function collectInputDiagnostics(input = {}) {
  const rawText = clean(input.rawText), profile = normalizeInputProfile(input), diagnostics = [];
  if (!rawText) diagnostics.push(createReadinessDiagnostic({ severity: 'BLOCKER', code: 'blank_input', message: 'Input text is blank.' }));
  for (const error of explicitErrors(input)) diagnostics.push(parseErrorDiagnostic(error));
  for (const item of [...asArray(input.diagnostics), ...asArray(input.dataset?.diagnostics)]) diagnostics.push(diagnosticFromUnknown(item));
  if (rawText && profile === 'unknown') diagnostics.push(createReadinessDiagnostic({ severity: 'WARNING', code: 'profile_unknown', message: 'Input profile is unknown.' }));
  if (rawText && parseOkOf(input) && recordCountOf(input) <= 0) diagnostics.push(createReadinessDiagnostic({ severity: 'BLOCKER', code: 'zero_records', message: 'No records were available after parse or normalization.' }));
  diagnostics.push(...identityDiagnostics(input.identitySummary || {}), ...coordinateDiagnostics(input.coordinateFrameSummary || {}));
  return dedupeInputReadinessDiagnostics(diagnostics.map(createReadinessDiagnostic));
}

function summariesFor(input = {}) {
  const records = recordsOf(input), sourceId = clean(input.sourceId);
  return {
    records,
    identitySummary: buildStableXmlIdentitySummary(records, { sourceId }),
    coordinateFrameSummary: buildCoordinateFrameStatusSummary(records, { sourceId }),
  };
}

export function buildInputReadinessSource(input = {}) {
  const extra = summariesFor(input);
  return createInputReadinessSource({
    sourceId: clean(input.sourceId),
    side: clean(input.side),
    fileName: clean(input.fileName || input.dataset?.fileName),
    rawTextHash: hashText(input.rawText || ''),
    profile: normalizeInputProfile(input),
    parseOk: parseOkOf(input),
    recordCount: recordCountOf({ ...input, records: extra.records }),
    identitySummary: extra.identitySummary,
    coordinateFrameSummary: extra.coordinateFrameSummary,
    diagnostics: collectInputDiagnostics({ ...input, ...extra }),
  });
}

export function buildInputReadinessAudit({ sourceA = {}, targetB = {}, generatedAt = '' } = {}) {
  return createInputReadinessAudit({
    generatedAt,
    sourceA: buildInputReadinessSource({ sourceId: 'A', side: 'Source A', ...sourceA }),
    targetB: buildInputReadinessSource({ sourceId: 'B', side: 'Target B', ...targetB }),
  });
}

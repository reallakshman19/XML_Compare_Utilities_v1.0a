/** Deterministic review-package manifest binding Workbench bend evidence. */

import { stableStringify } from '../adapters/bend-geometry-audit.js';

export const BEND_REVIEW_PACKAGE_CONTRACT = 'WorkbenchBendReviewPackage.v1';
export const BEND_REVIEW_PACKAGE_SIGNATURE_ALGORITHM = 'stable-json-fnv1a32';
export const BEND_REVIEW_PACKAGE_AUTHORITY = 'READ_ONLY_REVIEW_BINDING';

function text(value) { return String(value ?? '').trim(); }
function array(value) { return Array.isArray(value) ? value : []; }
function stableValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(stableValue));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)])));
  }
  return value;
}
function hash(prefix, value) {
  let result = 0x811c9dc5;
  const input = stableStringify(value);
  for (let index = 0; index < input.length; index += 1) {
    result ^= input.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return `${prefix}-${result.toString(16).padStart(8, '0')}`;
}
function utf8Length(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}
function inputIdentity(side, name, xml, schema) {
  const content = String(xml ?? '');
  const contentSignature = hash('wb3d-input', content);
  const payload = stableValue({
    side,
    name: text(name) || (side === 'A' ? '(pasted source)' : '(pasted target)'),
    schema: text(schema) || 'UNKNOWN',
    characters: content.length,
    bytes: utf8Length(content),
    contentSignature,
  });
  return Object.freeze({ ...payload, identitySignature: hash('wb3d-file', payload) });
}
function sortedOverrides(value) {
  return Object.freeze(array(value).map(stableValue)
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))));
}
function compareSettings(state) {
  return stableValue({
    config: state.config ?? {},
    profileOverride: state.profileOverride ?? null,
    ignoredProps: [...array(state.ignoredProps)].map(text).sort(),
    manualOverrides: sortedOverrides(state.manualOverrides),
  });
}
function auditCounts(audit) {
  return Object.freeze({
    sourceObjects: array(audit?.sourceObjectIds).length,
    targetObjects: array(audit?.targetObjectIds).length,
    differences: array(audit?.objectDiff?.rows).length,
    conflicts: array(audit?.conflictLedger?.rows).length,
  });
}
function bendReference(visual) {
  const audit = visual?.bendAudit;
  if (!audit) return Object.freeze({ available: false, contract: '', signature: '', summaryConsistent: false });
  return Object.freeze({
    available: true,
    contract: text(audit.contract),
    signatureAlgorithm: text(audit.signatureAlgorithm),
    signature: text(audit.signature),
    summaryConsistent: audit.payload?.summaryConsistent === true,
    summary: stableValue(audit.payload?.declaredSummary ?? {}),
  });
}
function bendParity(source, target) {
  if (!source.available || !target.available) return 'NOT_AVAILABLE';
  return source.signature === target.signature ? 'MATCH' : 'DIFFERENT';
}
function comparisonReference(state, inputs, settings) {
  const audit = state.audit ?? null;
  const settingsSignature = hash('wb3d-settings', settings);
  const runPayload = stableValue({
    sourceInput: inputs.source.identitySignature,
    targetInput: inputs.target.identitySignature,
    settings,
    compareAudit: audit,
  });
  return Object.freeze({
    available: Boolean(audit),
    contract: text(audit?.contract),
    compareKind: text(audit?.compareKind),
    settingsSignature,
    runSignature: hash('wb3d-run', runPayload),
    counts: auditCounts(audit),
  });
}
function completeness(inputs, comparison, bends) {
  const gates = Object.freeze({
    sourceInput: inputs.source.characters > 0,
    targetInput: inputs.target.characters > 0,
    compareAudit: comparison.available,
    sourceBendAudit: bends.source.available,
    targetBendAudit: bends.target.available,
  });
  return Object.freeze({ gates, complete: Object.values(gates).every(Boolean) });
}

export function computeWorkbenchEvidenceSignature(prefix, payload = {}) {
  return hash(prefix, payload);
}

export function computeBendReviewPackageSignature(payload = {}) {
  return computeWorkbenchEvidenceSignature('wb3d-review', payload);
}

export function buildBendReviewPackageManifest(state = {}) {
  const inputs = Object.freeze({
    source: inputIdentity('A', state.sourceName, state.sourceXml, state.graphs?.sourceSchema),
    target: inputIdentity('B', state.targetName, state.targetXml, state.graphs?.targetSchema),
  });
  const settings = compareSettings(state);
  const bends = Object.freeze({
    source: bendReference(state.visuals?.A),
    target: bendReference(state.visuals?.B),
  });
  const comparison = comparisonReference(state, inputs, settings);
  const readiness = completeness(inputs, comparison, bends);
  const payload = stableValue({
    inputs,
    comparison,
    bends: { ...bends, parity: bendParity(bends.source, bends.target) },
    completeness: readiness,
  });
  return Object.freeze({
    contract: BEND_REVIEW_PACKAGE_CONTRACT,
    signatureAlgorithm: BEND_REVIEW_PACKAGE_SIGNATURE_ALGORITHM,
    packageSignature: computeBendReviewPackageSignature(payload),
    deterministic: true,
    authority: BEND_REVIEW_PACKAGE_AUTHORITY,
    disposition: readiness.complete ? 'COMPLETE' : 'INCOMPLETE',
    payload,
  });
}

export function serializeBendReviewPackageManifest(manifest = {}) {
  return stableStringify(manifest);
}

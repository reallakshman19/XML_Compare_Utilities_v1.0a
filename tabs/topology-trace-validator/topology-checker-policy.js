/** Typed, portable Topology Checker policy with explicit browser persistence. */

import { asArray, cleanText, deepFreeze, objectRecord, semanticHash } from './topology-validator-values.js';

export const TOPOLOGY_CHECKER_POLICY_SCHEMA = 'TopologyCheckerPolicy.v1';
export const TOPOLOGY_CHECKER_POLICY_KEY = 'xml-compare.topology-checker.policy.v1';
export const TOPOLOGY_FIX_MODES = Object.freeze(['AUTO', 'CONFIRM', 'MANUAL', 'AUTO_SUPPRESS']);
const CONFIDENCES = Object.freeze(['HIGH', 'MEDIUM', 'LOW']);
const INLINE_VALUES = Object.freeze(['ANY', 'TRUE', 'FALSE']);

const DEFAULT_RULES = Object.freeze([
  rule('short-false-high', 'SHORT_ELEMENT', 'HIGH', 'AUTO', 'FALSE', 'MOVE_NODE'),
  rule('short-true-high', 'EXPECTED_SHORT_INLINE_COMPONENT', 'HIGH', 'AUTO', 'TRUE', 'MOVE_NODE'),
  rule('junction-degree-high', 'JUNCTION_WITHOUT_MULTIWAY', 'HIGH', 'AUTO_SUPPRESS', 'ANY', 'SUPPRESS'),
]);

/** @returns {Readonly<Record<string,unknown>>} */
export function defaultTopologyCheckerPolicy() {
  return deepFreeze({
    schema: TOPOLOGY_CHECKER_POLICY_SCHEMA,
    thresholds: { shortElementMm: 6, toleranceMm: 0.1, snapToleranceMm: 25, angleToleranceDeg: 5, originToleranceMm: 0.1, clearanceMm: 0 },
    rules: DEFAULT_RULES.map((row) => ({ ...row, conditions: { ...row.conditions } })),
  });
}

/** Reject malformed profiles; callers retain their current valid profile. */
export function normalizeTopologyCheckerPolicy(input) {
  const raw = objectRecord(input);
  if (cleanText(raw.schema) !== TOPOLOGY_CHECKER_POLICY_SCHEMA) throw new TypeError(`Policy schema must be ${TOPOLOGY_CHECKER_POLICY_SCHEMA}.`);
  const thresholds = normalizeThresholds(raw.thresholds);
  const seen = new Set();
  const rules = asArray(raw.rules).map((entry, index) => normalizeRule(entry, index, seen));
  return deepFreeze({ schema: TOPOLOGY_CHECKER_POLICY_SCHEMA, thresholds, rules });
}

/** Missing storage means first-run defaults; corrupt stored JSON is explicit. */
export function loadTopologyCheckerPolicy(storage) {
  const text = storage?.getItem?.(TOPOLOGY_CHECKER_POLICY_KEY);
  return text === null || text === undefined || text === ''
    ? defaultTopologyCheckerPolicy() : parseTopologyCheckerPolicy(text);
}

export function saveTopologyCheckerPolicy(storage, input) {
  const policy = normalizeTopologyCheckerPolicy(input);
  if (typeof storage?.setItem !== 'function') throw new Error('Browser policy storage is unavailable.');
  storage.setItem(TOPOLOGY_CHECKER_POLICY_KEY, JSON.stringify(policy));
  return policy;
}

export function parseTopologyCheckerPolicy(text) {
  try { return normalizeTopologyCheckerPolicy(JSON.parse(String(text))); }
  catch (error) { throw new TypeError(`Topology Checker policy import failed: ${error?.message || String(error)}`); }
}

export function topologyCheckerPolicyJson(policy) {
  return `${JSON.stringify(normalizeTopologyCheckerPolicy(policy), null, 2)}\n`;
}

export function topologyCheckerPolicyHash(policy) {
  return semanticHash(normalizeTopologyCheckerPolicy(policy));
}

/** Exact Issue + Confidence rules override producer fixability when conditions match. */
export function topologyPolicyDecision(issue, suggestion, policy) {
  const normalized = normalizeTopologyCheckerPolicy(policy);
  const match = normalized.rules.find((entry) => entry.enabled && entry.issueCode === cleanText(issue?.code).toUpperCase()
    && entry.confidence === cleanText(issue?.confidence).toUpperCase() && conditionsMatch(issue, entry.conditions));
  const fixMode = match?.fixMode ?? producerFixMode(suggestion?.fixability ?? issue?.fixability);
  return Object.freeze({ fixMode, ruleId: cleanText(match?.id), operation: cleanText(match?.operation) || producerOperation(suggestion) });
}

export function topologyCheckerOptions(canonical, policy) {
  const thresholds = normalizeTopologyCheckerPolicy(policy).thresholds;
  const canonicalTolerance = Number(canonical?.toleranceMm);
  return Object.freeze({ ...thresholds, toleranceMm: Number.isFinite(canonicalTolerance) ? canonicalTolerance : thresholds.toleranceMm });
}

function rule(id, issueCode, confidence, fixMode, expectedInline, operation) {
  return Object.freeze({ id, enabled: true, issueCode, confidence, fixMode, operation,
    conditions: Object.freeze({ requireBelowThreshold: issueCode.includes('SHORT'), expectedInline }) });
}

function normalizeThresholds(input) {
  const defaults = defaultTopologyCheckerPolicy().thresholds, raw = objectRecord(input), result = {};
  for (const [name, fallback] of Object.entries(defaults)) {
    const value = Number(raw[name] ?? fallback);
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`Policy threshold ${name} must be a non-negative finite number.`);
    result[name] = value;
  }
  if (result.shortElementMm <= result.toleranceMm) throw new RangeError('shortElementMm must be greater than toleranceMm.');
  return Object.freeze(result);
}

function normalizeRule(input, index, seen) {
  const raw = objectRecord(input), issueCode = cleanText(raw.issueCode).toUpperCase(), confidence = cleanText(raw.confidence).toUpperCase();
  const fixMode = cleanText(raw.fixMode).toUpperCase(), id = cleanText(raw.id) || `policy-${index + 1}`;
  if (!issueCode) throw new TypeError(`Policy rule ${index + 1} requires issueCode.`);
  if (!CONFIDENCES.includes(confidence)) throw new RangeError(`Policy rule ${id} has unsupported confidence ${confidence}.`);
  if (!TOPOLOGY_FIX_MODES.includes(fixMode)) throw new RangeError(`Policy rule ${id} has unsupported fix mode ${fixMode}.`);
  const key = `${issueCode}:${confidence}`;
  if (seen.has(key)) throw new Error(`Policy contains duplicate rule ${key}.`); seen.add(key);
  const conditions = objectRecord(raw.conditions), expectedInline = cleanText(conditions.expectedInline || 'ANY').toUpperCase();
  if (!INLINE_VALUES.includes(expectedInline)) throw new RangeError(`Policy rule ${id} has unsupported expectedInline ${expectedInline}.`);
  return Object.freeze({ id, enabled: raw.enabled !== false, issueCode, confidence, fixMode,
    operation: cleanText(raw.operation) || 'PRODUCER', conditions: Object.freeze({
      requireBelowThreshold: conditions.requireBelowThreshold === true, expectedInline,
    }) });
}

function conditionsMatch(issue, conditions) {
  const details = objectRecord(issue?.details);
  if (conditions.requireBelowThreshold && !(Number(details.lengthMm) < Number(details.thresholdMm))) return false;
  if (conditions.expectedInline === 'TRUE' && details.expectedInline !== true) return false;
  if (conditions.expectedInline === 'FALSE' && details.expectedInline !== false) return false;
  return true;
}

function producerFixMode(value) {
  const normalized = cleanText(value).toUpperCase();
  if (normalized === 'AUTO_APPROVED') return 'AUTO';
  if (normalized === 'NEEDS_CONFIRMATION') return 'CONFIRM';
  return 'MANUAL';
}

function producerOperation(suggestion) {
  return cleanText(asArray(suggestion?.operations)[0]?.type) || 'NONE';
}

export const _test = Object.freeze({ normalizeThresholds, normalizeRule, conditionsMatch, producerFixMode });


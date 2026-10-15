/** Accessible typed policy editor; executable expressions are intentionally unsupported. */

import {
  TOPOLOGY_FIX_MODES, normalizeTopologyCheckerPolicy, topologyPolicyDecision,
} from './topology-checker-policy.js';
import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';

export function topologyCheckerSettingsMarkup(policy, report, suggestions) {
  const entries = editorEntries(policy, report, suggestions);
  const thresholds = policy.thresholds;
  return `<div class="ttv-checker-settings-head"><div><strong>Topology Checker settings</strong><span>Browser profile · exported with audit evidence</span></div>
    <button type="button" data-ttv-policy-close aria-label="Close settings">×</button></div>
    <div class="ttv-checker-settings-scroll">
      <section><h3>Thresholds</h3><div class="ttv-policy-thresholds">
        ${thresholdInput('shortElementMm', 'Short element mm', thresholds.shortElementMm)}
        ${thresholdInput('toleranceMm', 'Geometry tolerance mm', thresholds.toleranceMm)}
        ${thresholdInput('snapToleranceMm', 'Snap tolerance mm', thresholds.snapToleranceMm)}
        ${thresholdInput('angleToleranceDeg', 'Angle tolerance deg', thresholds.angleToleranceDeg)}
        ${thresholdInput('originToleranceMm', 'Origin tolerance mm', thresholds.originToleranceMm)}
        ${thresholdInput('clearanceMm', 'Clearance mm', thresholds.clearanceMm)}
      </div></section>
      <section><h3>Issue × confidence × fix mode</h3><p>Exact enabled rows override producer classification. Operations and safety gates remain typed.</p>
        <div class="ttv-policy-table"><div class="ttv-policy-row is-head"><span>On</span><span>Bucket</span><span>Issue</span><span>Confidence</span><span>Conditions</span><span>Fix mode</span><span>Operation</span><span>Readiness</span></div>
        ${entries.map(policyRowMarkup).join('')}</div></section>
      <section class="ttv-policy-invariants"><h3>Safety and export invariants</h3>
        <p>Auto fix selects only Open + High + Auto issues. Every move must pass preflight and post-validation. Export is always allowed and includes policy, operations, pending confirmations, failures, and known issues.</p>
      </section><p class="ttv-policy-error" data-ttv-policy-error role="alert"></p>
    </div>
    <footer class="ttv-checker-settings-actions">
      <button type="button" data-ttv-policy-reset>Reset defaults</button><button type="button" data-ttv-policy-import>Import JSON</button>
      <input type="file" accept=".json,application/json" data-ttv-policy-file hidden><button type="button" data-ttv-policy-export>Export JSON</button>
      <span></span><button type="button" data-ttv-policy-close>Cancel</button><button type="button" class="is-primary" data-ttv-policy-save>Save & rerun</button>
    </footer>`;
}

export function readTopologyCheckerPolicyForm(host, currentPolicy) {
  const thresholds = {};
  host.querySelectorAll('[data-ttv-policy-threshold]').forEach((input) => { thresholds[input.dataset.ttvPolicyThreshold] = Number(input.value); });
  const rules = [...host.querySelectorAll('[data-ttv-policy-rule]')].map((row, index) => ({
    id: cleanText(row.dataset.ruleId) || `ui-${index + 1}`, enabled: row.querySelector('[data-policy-enabled]').checked,
    issueCode: row.dataset.issueCode, confidence: row.dataset.confidence,
    fixMode: row.querySelector('[data-policy-fix-mode]').value, operation: row.dataset.operation,
    conditions: { requireBelowThreshold: row.querySelector('[data-policy-below]')?.checked === true,
      expectedInline: row.querySelector('[data-policy-inline]')?.value || 'ANY' },
  }));
  return normalizeTopologyCheckerPolicy({ schema: currentPolicy.schema, thresholds, rules });
}

function editorEntries(policy, report, suggestions) {
  const byIssue = new Map(asArray(suggestions).map((row) => [cleanText(row.issueId), row]));
  const issueRows = new Map();
  for (const issue of asArray(report?.issues)) {
    const key = `${cleanText(issue.code)}:${cleanText(issue.confidence)}`;
    if (!issueRows.has(key)) issueRows.set(key, { issue, suggestion: byIssue.get(cleanText(issue.id)) });
  }
  const ruleRows = new Map(asArray(policy.rules).map((row) => [`${row.issueCode}:${row.confidence}`, row]));
  const keys = [...new Set([...ruleRows.keys(), ...issueRows.keys()])].sort();
  return keys.map((key) => {
    const observed = issueRows.get(key), rule = ruleRows.get(key), issue = observed?.issue ?? syntheticIssue(rule);
    const decision = topologyPolicyDecision(issue, observed?.suggestion, policy);
    return { issue, suggestion: observed?.suggestion, rule, decision };
  });
}

function policyRowMarkup(entry) {
  const issue = objectRecord(entry.issue), suggestion = objectRecord(entry.suggestion), rule = objectRecord(entry.rule);
  const short = ['SHORT_ELEMENT', 'EXPECTED_SHORT_INLINE_COMPONENT'].includes(cleanText(issue.code));
  const conditions = objectRecord(rule.conditions), expected = cleanText(conditions.expectedInline) || (issue.code === 'SHORT_ELEMENT' ? 'FALSE' : issue.code === 'EXPECTED_SHORT_INLINE_COMPONENT' ? 'TRUE' : 'ANY');
  const mode = cleanText(rule.fixMode) || entry.decision.fixMode, operation = cleanText(rule.operation) || entry.decision.operation || 'PRODUCER';
  const readiness = mode === 'AUTO_SUPPRESS' ? 'Review only' : cleanText(suggestion.executionState) || (asArray(suggestion.operations).length ? 'Ready' : 'Producer');
  const conditionMarkup = short ? `<label><input type="checkbox" data-policy-below ${conditions.requireBelowThreshold !== false ? 'checked' : ''}> length &lt; threshold</label>
    <label>expectedInline <select data-policy-inline>${['ANY', 'TRUE', 'FALSE'].map((value) => `<option ${value === expected ? 'selected' : ''}>${value}</option>`).join('')}</select></label>` : '<span>Producer evidence</span>';
  return `<div class="ttv-policy-row" data-ttv-policy-rule data-rule-id="${escapeMarkup(cleanText(rule.id))}" data-issue-code="${escapeMarkup(issue.code)}" data-confidence="${escapeMarkup(issue.confidence)}" data-operation="${escapeMarkup(operation)}">
    <span><input type="checkbox" data-policy-enabled ${rule.enabled !== false ? 'checked' : ''} aria-label="Enable ${escapeMarkup(issue.code)} ${escapeMarkup(issue.confidence)}"></span>
    <span>${escapeMarkup(issue.category || '—')}</span><strong>${escapeMarkup(issue.code)}</strong><span>${escapeMarkup(issue.confidence)}</span><span>${conditionMarkup}</span>
    <span><select data-policy-fix-mode>${TOPOLOGY_FIX_MODES.map((value) => `<option ${value === mode ? 'selected' : ''}>${value}</option>`).join('')}</select></span>
    <span>${escapeMarkup(operation)}</span><span data-readiness="${escapeMarkup(readiness)}">${escapeMarkup(readiness.replaceAll('_', ' '))}</span></div>`;
}

function thresholdInput(name, label, value) {
  return `<label><span>${escapeMarkup(label)}</span><input type="number" min="0" step="any" value="${escapeMarkup(value)}" data-ttv-policy-threshold="${name}"></label>`;
}

function syntheticIssue(rule) {
  return { code: rule.issueCode, confidence: rule.confidence, category: 'NOT CURRENT', fixability: 'MANUAL_ENGINEERING', details: {
    lengthMm: rule.issueCode.includes('SHORT') ? 1 : null, thresholdMm: 6,
    expectedInline: rule.conditions?.expectedInline === 'TRUE' ? true : rule.conditions?.expectedInline === 'FALSE' ? false : null,
  } };
}

export const _test = Object.freeze({ editorEntries, policyRowMarkup, thresholdInput, syntheticIssue });


import { mountCiiWriter2MultiSourceReviewRouter as mountReviewRouter } from './cii-workspace-multisource-review-only-router.js?v=20260909-ms-review-decisions-1';
import {
  setCiiMultiSourceMethodAPhysicalCandidateLimit,
  setCiiMultiSourceMethodAConfidenceThresholds,
  setCiiMultiSourceMethodAConfidenceWeights,
  getCiiMultiSourceMethodAConfidenceOptions,
} from './cii-workspace-source-set.js';

import {
  CII_METHOD_A_WEIGHT_KEYS,
  CII_METHOD_A_WEIGHT_DEFAULTS,
} from './cii-workspace-method-a-weights.js';

function weightPolicyEqual(a, b) {
  return CII_METHOD_A_WEIGHT_KEYS.every((key) => a?.[key] === b?.[key]);
}

// Advanced controls are transactional: editing a text field never modifies the
// effective Inspect/Compare policy until Apply is explicitly selected.
function mountMethodAWeightControls(container) {
  const inspectButton = container.querySelector('[data-ciiw-inspect]');
  const documentRef = container.ownerDocument;
  if (!inspectButton || !documentRef || container.querySelector('[data-ciiw-method-a-apply-weights]')) return () => {};
  const wrapper = documentRef.createElement('div');
  wrapper.className = 'ciiw-ms-anchor-search-limit';
  wrapper.setAttribute('data-ciiw-method-a-weight-config', '1');
  const labels = {
    residualQuality: ['Residual quality', 'Measured rigid-registration residual'],
    conditioning: ['Conditioning', 'Anchor non-collinearity'],
    spatialExtent: ['Spatial extent', 'Geometric span relative to source OD'],
    redundancy: ['Anchor redundancy', 'Additional corroborating anchor pairs'],
    basisConsensus: ['Basis consensus', 'No conflicting admissible registration bases'],
  };
  const fields = CII_METHOD_A_WEIGHT_KEYS.map((key) => {
    const [name, help] = labels[key];
    return '<label><span><b>' + name + '</b><small>' + help + ' · default '
      + CII_METHOD_A_WEIGHT_DEFAULTS[key] + '/100</small></span>'
      + '<input type="number" min="0" max="100" step="1" data-ciiw-method-a-weight-'
      + key + ' aria-label="Method A ' + name + ' weight"></label>';
  }).join('');
  wrapper.innerHTML = '<details><summary><b>Advanced: Method A score weights</b> (100 points total)</summary>'
    + '<p>Weights re-score qualified rigid bases and may change automatic base ranking. Apply requires a fresh Inspect and review; geometry, custody and conflict vetoes still apply.</p>'
    + fields
    + '<small data-ciiw-method-a-weight-total aria-live="polite"></small>'
    + '<button type="button" data-ciiw-method-a-apply-weights>Apply weights</button>'
    + '<button type="button" data-ciiw-method-a-reset-weights>Reset defaults</button>'
    + '<small data-ciiw-method-a-weight-status role="status" aria-live="polite"></small></details>';
  const inputs = Object.fromEntries(CII_METHOD_A_WEIGHT_KEYS.map((key) =>
    [key, wrapper.querySelector('[data-ciiw-method-a-weight-' + key + ']')]));
  const apply = wrapper.querySelector('[data-ciiw-method-a-apply-weights]');
  const reset = wrapper.querySelector('[data-ciiw-method-a-reset-weights]');
  const total = wrapper.querySelector('[data-ciiw-method-a-weight-total]');
  const status = wrapper.querySelector('[data-ciiw-method-a-weight-status]');
  const displayPolicy = (weights) => {
    for (const key of CII_METHOD_A_WEIGHT_KEYS) inputs[key].value = String(weights[key]);
  };
  const readDraft = () => Object.fromEntries(CII_METHOD_A_WEIGHT_KEYS.map((key) =>
    [key, inputs[key].value]));
  const onInput = () => {
    const draft = readDraft();
    const sum = CII_METHOD_A_WEIGHT_KEYS.reduce((value, key) => value + Number(draft[key] || 0), 0);
    if (total) total.textContent = 'Draft total ' + sum.toFixed(2).replace(/\.00$/, '') + '/100';
    if (status) status.textContent = 'Draft not applied. Apply all five weights together.';
  };
  const onApply = () => {
    try {
      const before = getCiiMultiSourceMethodAConfidenceOptions();
      const next = setCiiMultiSourceMethodAConfidenceWeights(readDraft());
      const changed = !weightPolicyEqual(before.methodAConfidenceWeights, next);
      displayPolicy(next); onInput();
      for (const key of CII_METHOD_A_WEIGHT_KEYS) inputs[key].setAttribute('aria-invalid', 'false');
      if (status) status.textContent = changed
        ? 'Weights applied. Previous Inspect/Compare and Writer2 scope invalidated; run Inspect again.'
        : 'Weights unchanged.';
      if (changed) {
        const CustomEventRef = documentRef.defaultView?.CustomEvent || globalThis.CustomEvent;
        container.dispatchEvent(new CustomEventRef('ciiw-method-a-confidence-changed', {
          detail: {
            high: before.methodAHighConfidenceThreshold,
            medium: before.methodAMediumConfidenceThreshold,
            weights: next,
          },
        }));
      }
    } catch (error) {
      for (const key of CII_METHOD_A_WEIGHT_KEYS) inputs[key].setAttribute('aria-invalid', 'true');
      if (status) status.textContent = error?.message || 'Invalid weight configuration.';
    }
  };
  const onReset = () => { displayPolicy(CII_METHOD_A_WEIGHT_DEFAULTS); onApply(); };
  displayPolicy(getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights);
  onInput();
  if (status) status.textContent = 'Applied profile shown. Edit and select Apply weights to recalculate.';
  for (const key of CII_METHOD_A_WEIGHT_KEYS) inputs[key].addEventListener('input', onInput);
  apply.addEventListener('click', onApply); reset.addEventListener('click', onReset);
  inspectButton.parentNode?.insertBefore(wrapper, inspectButton);
  return () => {
    for (const key of CII_METHOD_A_WEIGHT_KEYS) inputs[key].removeEventListener('input', onInput);
    apply.removeEventListener('click', onApply); reset.removeEventListener('click', onReset);
    wrapper.remove();
  };
}

function genericReviewActive(container) {
  return Boolean(container.querySelector('[data-ciiw-ms-review-only-transfer="1"]') && container.querySelector('[data-ciiw-ms-review-table="1"]'));
}
function confidenceForRow(row) {
  if (String(row?.children?.[0]?.textContent || '').toUpperCase().includes('LOCKED')) return 'LOCKED';
  return String(row?.querySelector?.('.ciiw-confidence')?.textContent || '').trim().toUpperCase();
}
function changedRow(row) {
  const cell = row?.children?.[7];
  return Boolean(cell && String(cell.textContent || '').trim() && String(cell.textContent || '').trim() !== '—');
}
function rowMatches(row, filters = {}) {
  const confidence = String(filters.confidence || 'ALL').toUpperCase();
  if (confidence !== 'ALL' && confidenceForRow(row) !== confidence) return false;
  if (filters.changedOnly && !changedRow(row)) return false;
  const search = String(filters.search || '').trim().toLowerCase();
  return !search || String(row?.textContent || '').toLowerCase().includes(search);
}
function mountMethodASearchControl(container, initialValue = 10) {
  const inspectButton = container.querySelector('[data-ciiw-inspect]'); const documentRef = container.ownerDocument;
  if (!inspectButton || !documentRef || container.querySelector('[data-ciiw-method-a-search-limit]')) return () => {};
  const label = documentRef.createElement('label'); label.className = 'ciiw-ms-anchor-search-limit';
  label.innerHTML = '<span><b>Method-A search pairs</b><small>Limits expensive physical candidate search; 10 recommended.</small></span><input type="number" min="3" max="24" step="1" data-ciiw-method-a-search-limit aria-label="Method-A physical candidate search limit">';
  const input = label.querySelector('[data-ciiw-method-a-search-limit]');
  input.value = String(setCiiMultiSourceMethodAPhysicalCandidateLimit(initialValue));
  const onChange = () => { input.value = String(setCiiMultiSourceMethodAPhysicalCandidateLimit(input.value)); };
  input.addEventListener('change', onChange); inspectButton.parentNode?.insertBefore(label, inspectButton);
  return () => { input.removeEventListener('change', onChange); label.remove(); };
}
function mountMethodAConfidenceControls(container, initialOptions = {}) {
  const inspectButton = container.querySelector('[data-ciiw-inspect]');
  const documentRef = container.ownerDocument;
  if (!inspectButton || !documentRef || container.querySelector('[data-ciiw-method-a-high-threshold]')) return () => {};
  const settings = documentRef.createElement('div');
  settings.className = 'ciiw-ms-anchor-search-limit';
  settings.setAttribute('data-ciiw-method-a-confidence-config', '1');
  settings.innerHTML = '<label><span><b>Method A HIGH score</b><small>Default 85 / 100; raise for stricter qualification.</small></span><input type="number" min="1" max="100" step="1" data-ciiw-method-a-high-threshold aria-label="Method A HIGH minimum score"></label>'
    + '<label><span><b>Method A MEDIUM score</b><small>Default 70 / 100; must remain below HIGH.</small></span><input type="number" min="0" max="99" step="1" data-ciiw-method-a-medium-threshold aria-label="Method A MEDIUM minimum score"></label>'
    + '<small>Geometry confidence only. Changing this policy invalidates previous Inspect/Compare and Writer2 scope; it does not override conflicting identity or approve changes.</small>'
    + '<small data-ciiw-method-a-policy-status role="status" aria-live="polite"></small>';
  const high = settings.querySelector('[data-ciiw-method-a-high-threshold]');
  const medium = settings.querySelector('[data-ciiw-method-a-medium-threshold]');
  const initial = setCiiMultiSourceMethodAConfidenceThresholds({
    high: initialOptions.methodAHighConfidenceThreshold ?? getCiiMultiSourceMethodAConfidenceOptions().methodAHighConfidenceThreshold,
    medium: initialOptions.methodAMediumConfidenceThreshold ?? getCiiMultiSourceMethodAConfidenceOptions().methodAMediumConfidenceThreshold,
  });
  high.value = String(initial.high); medium.value = String(initial.medium);
  const status = settings.querySelector('[data-ciiw-method-a-policy-status]');
  const onChange = () => {
    try {
      const before = getCiiMultiSourceMethodAConfidenceOptions();
      const next = setCiiMultiSourceMethodAConfidenceThresholds({ high: high.value, medium: medium.value });
      high.value = String(next.high); medium.value = String(next.medium);
      high.setAttribute('aria-invalid', 'false'); medium.setAttribute('aria-invalid', 'false');
      const changed = next.high !== before.methodAHighConfidenceThreshold
        || next.medium !== before.methodAMediumConfidenceThreshold;
      if (status) status.textContent = changed ? 'Policy updated. Previous correspondence and Writer2 scope invalidated; run Inspect again.' : 'Policy unchanged.';
      if (changed) {
        const CustomEventRef = documentRef.defaultView?.CustomEvent || globalThis.CustomEvent;
        container.dispatchEvent(new CustomEventRef('ciiw-method-a-confidence-changed', {
          detail: { high: next.high, medium: next.medium },
        }));
      }
    } catch (error) {
      high.setAttribute('aria-invalid', 'true'); medium.setAttribute('aria-invalid', 'true');
      if (status) status.textContent = error?.message || 'Invalid confidence thresholds.';
    }
  };
  high.addEventListener('change', onChange);
  medium.addEventListener('change', onChange);
  inspectButton.parentNode?.insertBefore(settings, inspectButton);
  return () => {
    high.removeEventListener('change', onChange); medium.removeEventListener('change', onChange);
    settings.remove();
  };
}
export function applyCiiGenericReviewDomFilters(container) {
  if (!genericReviewActive(container)) return Object.freeze({ active: false, total: 0, visible: 0 });
  const confidence = container.querySelector('[data-ciiw-confidence-filter]')?.value || 'ALL';
  const search = container.querySelector('[data-ciiw-search]')?.value || '';
  const changedOnly = Boolean(container.querySelector('[data-ciiw-changed-only]')?.checked);
  const rows = [...container.querySelectorAll('[data-ciiw-ms-review-table="1"] tbody tr')];
  let visible = 0;
  for (const row of rows) {
    const matches = rowMatches(row, { confidence, search, changedOnly });
    row.hidden = !matches; if (matches) visible += 1;
  }
  return Object.freeze({ active: true, total: rows.length, visible, filters: Object.freeze({ confidence, search, changedOnly }) });
}

export function mountCiiWriter2MultiSourceReviewRouter(container, options = {}) {
  const core = mountReviewRouter(container, options);
  const disposeSearchControl = mountMethodASearchControl(container, options.methodAPhysicalCandidateLimit ?? 10);
  const disposeConfidenceControl = mountMethodAConfidenceControls(container, options);
  const disposeWeightControl = mountMethodAWeightControls(container);
  const confidence = container.querySelector('[data-ciiw-confidence-filter]');
  const search = container.querySelector('[data-ciiw-search]');
  const changedOnly = container.querySelector('[data-ciiw-changed-only]');
  const results = container.querySelector('[data-ciiw-results]');
  let disposed = false; let queued = false;
  const apply = () => {
    if (disposed || !genericReviewActive(container)) return;
    applyCiiGenericReviewDomFilters(container);
  };
  const queueApply = () => {
    if (queued || disposed) return; queued = true;
    queueMicrotask(() => { queued = false; apply(); });
  };
  const onChange = (event) => {
    if (!genericReviewActive(container) || (event.target !== confidence && event.target !== changedOnly)) return;
    event.stopImmediatePropagation(); apply();
  };
  const onInput = (event) => {
    if (!genericReviewActive(container) || event.target !== search) return;
    event.stopImmediatePropagation(); apply();
  };
  container.addEventListener('change', onChange, true);
  container.addEventListener('input', onInput, true);
  const observer = results && typeof MutationObserver !== 'undefined' ? new MutationObserver(queueApply) : null;
  observer?.observe(results, { childList: true, subtree: true });
  return {
    ...core,
    destroy() {
      disposed = true; observer?.disconnect(); disposeSearchControl(); disposeConfidenceControl(); disposeWeightControl();
      container.removeEventListener('change', onChange, true); container.removeEventListener('input', onInput, true);
      core?.destroy?.();
    },
  };
}

export const _test = Object.freeze({ genericReviewActive, confidenceForRow, changedRow, rowMatches, mountMethodASearchControl, mountMethodAConfidenceControls, mountMethodAWeightControls });

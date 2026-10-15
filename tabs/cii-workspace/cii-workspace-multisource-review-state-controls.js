const HOST_TAG = 'cii-ms-review-state-controls';
const contexts = new Map();
let sequence = 0;

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function nextToken() { sequence += 1; return `cii-review-state-${sequence}`; }
function plural(count, word) { return `${count} ${word}${count === 1 ? '' : 's'}`; }

export function ciiReviewControlProjection(state, transferDirty = false) {
  const high = Number(state?.eligible?.HIGH || 0); const medium = Number(state?.eligible?.MEDIUM || 0);
  const changed = Number(state?.changedDecisionCount || 0);
  let applyLabel = 'Review synchronized with Transfer Preview'; let applyDisabled = true;
  if (changed > 0) {
    applyLabel = `Apply ${plural(changed, 'pending decision')} to Transfer Preview`;
    applyDisabled = false;
  } else if (transferDirty) {
    applyLabel = 'Re-apply synchronized review to clear Transfer Preview pending state';
    applyDisabled = false;
  }
  return Object.freeze({
    high: Object.freeze({ label: `Accept eligible HIGH (${high})`, disabled: high === 0 }),
    medium: Object.freeze({ label: `Accept eligible MEDIUM (${medium})`, disabled: medium === 0 }),
    apply: Object.freeze({ label: applyLabel, disabled: applyDisabled }),
  });
}

function workspaceFor(host) { return host.closest?.('.ciiw-backdrop') || host.closest?.('.ciiw-workspace') || host.ownerDocument; }
function reviewOnlyRoute(workspace) { return Boolean(workspace?.querySelector?.('[data-ciiw-ms-review-only-transfer="1"]')); }
function transferDirty(workspace) {
  const transfer = workspace?.querySelector?.('[data-ciiw-ms-transfer="1"]');
  return Boolean(transfer?.textContent?.includes('Correspondence review changed.'));
}
function applyProjection(host) {
  const token = String(host.dataset.ciiwReviewStateToken || ''); const state = contexts.get(token);
  if (!state) return;
  const workspace = workspaceFor(host); if (reviewOnlyRoute(workspace)) return;
  const projection = ciiReviewControlProjection(state, transferDirty(workspace));
  const high = workspace?.querySelector?.('[data-ciiw-accept-high]');
  const medium = workspace?.querySelector?.('[data-ciiw-accept-medium]');
  const apply = workspace?.querySelector?.('[data-ciiw-refresh-review]');
  if (high) { high.textContent = projection.high.label; high.disabled = projection.high.disabled; high.dataset.ciiwEligibleCount = String(state.eligible?.HIGH || 0); }
  if (medium) { medium.textContent = projection.medium.label; medium.disabled = projection.medium.disabled; medium.dataset.ciiwEligibleCount = String(state.eligible?.MEDIUM || 0); }
  if (apply) { apply.textContent = projection.apply.label; apply.disabled = projection.apply.disabled; apply.dataset.ciiwPendingDecisionCount = String(state.changedDecisionCount || 0); }
}

export function ciiMultiSourceReviewStateControlHostMarkup(state) {
  const token = nextToken(); contexts.set(token, state);
  return `<${HOST_TAG} data-ciiw-review-state-token="${h(token)}" hidden></${HOST_TAG}>`;
}

if (typeof globalThis.HTMLElement !== 'undefined' && globalThis.customElements && !globalThis.customElements.get(HOST_TAG)) {
  class CiiMsReviewStateControls extends globalThis.HTMLElement {
    connectedCallback() {
      const schedule = this.ownerDocument?.defaultView?.queueMicrotask || globalThis.queueMicrotask || ((callback) => Promise.resolve().then(callback));
      schedule(() => { if (this.isConnected) applyProjection(this); });
    }
    disconnectedCallback() { contexts.delete(String(this.dataset.ciiwReviewStateToken || '')); }
  }
  globalThis.customElements.define(HOST_TAG, CiiMsReviewStateControls);
}

export const _test = Object.freeze({ HOST_TAG, workspaceFor, reviewOnlyRoute, transferDirty, applyProjection });
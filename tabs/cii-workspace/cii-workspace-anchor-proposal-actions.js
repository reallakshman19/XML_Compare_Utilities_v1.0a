const HOST_TAG = 'cii-anchor-proposal-action-host';
const contexts = new Map();
const rejectedBySession = new Map();
let sequence = 0;

function text(value) { return String(value ?? '').trim(); }
function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
export function ciiAnchorProposalKey(sourceId, sourceNodeId, targetNodeId) {
  return `${text(sourceId)}|${text(sourceNodeId)}=>${text(targetNodeId)}`;
}
function rejectedSet(sessionKey) {
  const key = text(sessionKey) || 'session';
  if (!rejectedBySession.has(key)) rejectedBySession.set(key, new Set());
  return rejectedBySession.get(key);
}
export function ciiAnchorProposalActionCommand(action, pair, state = {}) {
  const normalized = text(action).toUpperCase();
  const proposalKey = ciiAnchorProposalKey(pair?.sourceId, pair?.sourceNodeId, pair?.targetNodeId);
  if (normalized === 'INSPECT') return Object.freeze({ action: 'INSPECT', proposalKey, prefill: true, addReviewedAnchor: false, reject: false });
  if (normalized === 'APPROVE') return Object.freeze({ action: 'APPROVE', proposalKey, prefill: true, addReviewedAnchor: !state.approved, reject: false, clearRejection: true });
  if (normalized === 'REJECT') return Object.freeze({ action: 'REJECT', proposalKey, prefill: false, addReviewedAnchor: false, reject: !state.approved });
  return Object.freeze({ action: 'NONE', proposalKey, prefill: false, addReviewedAnchor: false, reject: false });
}
function nextToken() { sequence += 1; return `cii-anchor-proposals-${sequence}`; }
export function ciiAnchorProposalActionHostMarkup(sessionKey) {
  const token = nextToken(); contexts.set(token, { sessionKey: text(sessionKey) || 'session' });
  return `<${HOST_TAG} data-ciiw-anchor-proposal-token="${h(token)}"></${HOST_TAG}>`;
}
function proposalButtons(row) {
  return [...row.querySelectorAll('[data-ciiw-ms-proposal-action]')];
}
function pairFrom(row) {
  return {
    sourceId: text(row.dataset.ciiwMsProposalSourceId),
    sourceNodeId: text(row.dataset.ciiwMsProposalSourceNode),
    targetNodeId: text(row.dataset.ciiwMsProposalTargetNode),
  };
}
function workspaceFor(host) { return host.closest?.('.ciiw-workspace') || host.ownerDocument; }
function memberSection(workspace, sourceId) {
  return [...(workspace?.querySelectorAll?.('[data-ciiw-ms-member]') || [])]
    .find((item) => text(item.dataset.ciiwMsMember) === text(sourceId)) || null;
}
function lockedManualKeys(workspace) {
  const result = new Set();
  for (const row of workspace?.querySelectorAll?.('[data-ciiw-ms-anchor-ledger-row="manual"]') || []) {
    const sourceId = text(row.querySelector('[data-ciiw-ms-ledger-source]')?.dataset?.ciiwMsLedgerSourceId);
    const sourceNodeId = text(row.querySelector('[data-ciiw-ms-ledger-source]')?.value);
    const targetNodeId = text(row.querySelector('[data-ciiw-ms-ledger-target]')?.value);
    if (sourceId && sourceNodeId && targetNodeId) result.add(ciiAnchorProposalKey(sourceId, sourceNodeId, targetNodeId));
  }
  return result;
}
function dispatchInput(field) {
  const EventRef = field?.ownerDocument?.defaultView?.Event || globalThis.Event;
  if (field && EventRef) field.dispatchEvent(new EventRef('input', { bubbles: true }));
}
function prefillPair(workspace, pair) {
  const member = memberSection(workspace, pair.sourceId); if (!member) return null;
  const source = member.querySelector('[data-ciiw-ms-manual-source]');
  const target = member.querySelector('[data-ciiw-ms-manual-target]');
  if (!source || !target) return null;
  source.value = pair.sourceNodeId; target.value = pair.targetNodeId;
  dispatchInput(source); dispatchInput(target);
  target.focus?.(); member.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  return member;
}
function applyRowState(row, approved, rejected) {
  const state = row.querySelector('[data-ciiw-ms-proposal-state]');
  if (state) state.textContent = approved ? 'APPROVED · USER LOCKED' : (rejected ? 'REJECTED' : 'PENDING REVIEW');
  row.dataset.ciiwMsProposalState = approved ? 'APPROVED' : (rejected ? 'REJECTED' : 'PENDING');
  for (const button of proposalButtons(row)) {
    const action = text(button.dataset.ciiwMsProposalAction).toUpperCase();
    if (action === 'APPROVE') button.disabled = approved;
    if (action === 'REJECT') button.disabled = approved || rejected;
  }
}

if (typeof globalThis.HTMLElement !== 'undefined' && globalThis.customElements && !globalThis.customElements.get(HOST_TAG)) {
  class CiiAnchorProposalActionHost extends globalThis.HTMLElement {
    context() { return contexts.get(text(this.dataset.ciiwAnchorProposalToken)) || null; }
    section() { return this.closest('[data-ciiw-ms-proposal-rationale]'); }
    applyStates() {
      const context = this.context(); const workspace = workspaceFor(this); const locked = lockedManualKeys(workspace);
      const rejected = rejectedSet(context?.sessionKey);
      for (const row of this.section()?.querySelectorAll?.('[data-ciiw-ms-proposal-row]') || []) {
        const key = text(row.dataset.ciiwMsProposalKey); applyRowState(row, locked.has(key), rejected.has(key));
      }
    }
    connectedCallback() {
      const section = this.section(); if (!section || !this.context()) return;
      this.onClick = (event) => {
        const button = event.target?.closest?.('[data-ciiw-ms-proposal-action]'); if (!button || !section.contains(button)) return;
        event.preventDefault();
        const row = button.closest('[data-ciiw-ms-proposal-row]'); if (!row) return;
        const pair = pairFrom(row); const workspace = workspaceFor(this); const locked = lockedManualKeys(workspace);
        const rejected = rejectedSet(this.context().sessionKey); const key = ciiAnchorProposalKey(pair.sourceId, pair.sourceNodeId, pair.targetNodeId);
        const command = ciiAnchorProposalActionCommand(button.dataset.ciiwMsProposalAction, pair, { approved: locked.has(key), rejected: rejected.has(key) });
        if (command.clearRejection) rejected.delete(key);
        if (command.reject) rejected.add(key);
        const member = command.prefill ? prefillPair(workspace, pair) : null;
        if (command.addReviewedAnchor && member) member.querySelector('[data-ciiw-ms-manual-add]')?.click();
        this.applyStates();
      };
      section.addEventListener('click', this.onClick);
      this.applyStates();
    }
    disconnectedCallback() {
      this.section()?.removeEventListener?.('click', this.onClick);
      contexts.delete(text(this.dataset.ciiwAnchorProposalToken));
    }
  }
  globalThis.customElements.define(HOST_TAG, CiiAnchorProposalActionHost);
}

export const _test = Object.freeze({ HOST_TAG, pairFrom, lockedManualKeys, applyRowState, rejectedSet });

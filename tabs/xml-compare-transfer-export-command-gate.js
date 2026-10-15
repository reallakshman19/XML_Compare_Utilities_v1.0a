const clean = (value) => String(value ?? '').trim();

export const TRANSFER_EXPORT_COMMANDS = Object.freeze(new Set([
  'export-patched-target-xml',
  'export-transfer-audit-json',
  'download-transfer-proof-json',
  'copy-patched-target-preview',
  'export-transfer-artifact-bundle',
  'export-transfer-diff-summary-json',
  'export-transfer-change-ledger-json',
  'export-transfer-change-ledger-csv',
  'export-transfer-history-json',
]));

export function isTransferExportCommand(action = '') {
  return TRANSFER_EXPORT_COMMANDS.has(clean(action));
}

function decision(allowed, reason = '', nextAction = '') {
  return Object.freeze({ allowed: Boolean(allowed), reason: clean(reason), nextAction: clean(nextAction) });
}

export function evaluateTransferExportCommandGate(input = {}) {
  const action = clean(input.action);
  if (!isTransferExportCommand(action)) return decision(true);
  if (!input.inTransferReview) return decision(false, 'Transfer export command is outside the Transfer & Compare tab.', 'Open Tab 2: Transfer & Compare and use the visible export action.');
  if (clean(input.transferEvidence) === 'none') return decision(false, 'Transfer output evidence is not available.', 'Stage and apply transfer before exporting output artifacts.');
  if (!input.hasVisibleCommand) return decision(false, 'This export command is not visible for the current transfer state.', 'Apply staged transfer or review Export preflight before exporting.');
  if (input.isDisabled) return decision(false, 'This export command is disabled by the current readiness state.', 'Review Export preflight before exporting.');
  const preflightStatus = clean(input.preflightStatus).toLowerCase();
  if (preflightStatus && preflightStatus !== 'ready') return decision(false, `Export preflight status is ${preflightStatus}.`, 'Resolve the preflight blocker before exporting.');
  return decision(true);
}

function cssEscape(value = '') {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function visibleCommandButtons(review, action) {
  if (!review || !action) return [];
  const selector = `[data-xml-compare-action="${cssEscape(action)}"]`;
  return Array.from(review.querySelectorAll(selector)).filter((button) => !button.hidden && button.getAttribute('aria-hidden') !== 'true');
}

function resolveGateInput(event) {
  const actionButton = event?.target?.closest?.('[data-xml-compare-action]');
  const action = clean(actionButton?.dataset?.xmlCompareAction);
  if (!isTransferExportCommand(action)) return null;
  const modal = actionButton.closest('[data-xml-compare-transfer-modal]');
  const review = actionButton.closest('.xmlc-transfer-review') || modal?.querySelector?.('.xmlc-transfer-review.is-active') || modal?.querySelector?.('.xmlc-transfer-review');
  const visibleButtons = visibleCommandButtons(review, action);
  return {
    action,
    modal,
    actionButton,
    inTransferReview: Boolean(review && review.contains(actionButton)),
    transferEvidence: review?.dataset?.transferEvidence || '',
    hasVisibleCommand: visibleButtons.includes(actionButton),
    isDisabled: Boolean(actionButton.disabled || actionButton.getAttribute('aria-disabled') === 'true'),
    preflightStatus: actionButton.dataset?.xmlComparePreflightStatus || '',
  };
}

function gateMessage(result) {
  return [result.reason, result.nextAction].map(clean).filter(Boolean).join(' ');
}

function announceBlockedCommand(modal, message) {
  if (!modal || !message) return;
  let node = modal.querySelector('[data-xml-compare-transfer-command-gate-warning]');
  if (!node) {
    node = document.createElement('div');
    node.className = 'xml-compare-status xml-compare-status-warn xmlc-transfer-command-gate-warning';
    node.dataset.xmlCompareTransferCommandGateWarning = 'true';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    const body = modal.querySelector('.xml-compare-modal-body') || modal;
    body.prepend(node);
  }
  node.textContent = message;
}

export function handleTransferExportCommandGateEvent(event) {
  const gateInput = resolveGateInput(event);
  if (!gateInput) return true;
  const result = evaluateTransferExportCommandGate(gateInput);
  if (result.allowed) return true;
  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
  announceBlockedCommand(gateInput.modal, gateMessage(result));
  return false;
}

let installed = false;

export function installTransferExportCommandGate(root = globalThis?.document) {
  if (installed || !root?.addEventListener) return false;
  root.addEventListener('click', handleTransferExportCommandGateEvent, true);
  installed = true;
  return true;
}

if (typeof document !== 'undefined') installTransferExportCommandGate(document);

export const _test = Object.freeze({ clean, cssEscape, visibleCommandButtons, resolveGateInput, gateMessage });

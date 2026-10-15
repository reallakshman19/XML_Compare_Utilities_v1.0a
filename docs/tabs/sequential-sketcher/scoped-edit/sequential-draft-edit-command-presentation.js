/** Presentation-only helpers for the supervised Draft Edit command panel. */
function style(element, cssText) { if (element?.style) element.style.cssText = cssText; }
function requiredElement(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Sequential Draft Edit command element missing: ${selector}`);
  return value;
}

export function sequentialDraftEditCommandPanelElements(root) {
  return {
    panel: requiredElement(root, '[data-ssk-draft-edit-command-panel]'),
    status: requiredElement(root, '[data-ssk-draft-edit-command-state]'),
    target: requiredElement(root, '[data-ssk-draft-edit-target]'),
    actor: requiredElement(root, '[data-ssk-draft-edit-actor]'),
    reason: requiredElement(root, '[data-ssk-draft-edit-reason]'),
    evidence: requiredElement(root, '[data-ssk-draft-edit-evidence]'),
    preview: requiredElement(root, '[data-ssk-draft-edit-command-preview]'),
    accept: requiredElement(root, '[data-ssk-draft-edit-command-accept]'),
    cancel: requiredElement(root, '[data-ssk-draft-edit-command-cancel]'),
    commands: [...root.querySelectorAll('[data-ssk-draft-edit-command]')],
  };
}

export function setSequentialDraftEditPanelHidden(element, hidden) {
  element.hidden = hidden;
  element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}

export function installSequentialDraftEditCommandPanelStyle(value) {
  style(value.panel, [
    'position:absolute', 'top:12px', 'right:12px', 'z-index:8',
    'width:min(390px,calc(100% - 24px))', 'max-height:calc(100% - 24px)',
    'overflow:auto', 'box-sizing:border-box', 'padding:12px',
    'border:1px solid rgba(94,234,212,.38)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'box-shadow:0 18px 50px rgba(0,0,0,.38)',
  ].join(';'));
  const field = 'box-sizing:border-box;width:100%;margin-top:4px;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#07101f;color:#e2e8f0';
  [value.actor, value.reason, value.evidence].forEach((element) => style(element, field));
  style(value.evidence, `${field};min-height:54px;resize:vertical`);
  const evidenceStyle = 'white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;border-radius:7px;background:#020617;color:#bae6fd;font:10px ui-monospace,monospace';
  style(value.target, evidenceStyle);
  style(value.preview, evidenceStyle);
  [...value.commands, value.accept, value.cancel].forEach((element) => style(
    element,
    'padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe;cursor:pointer',
  ));
  style(value.status, 'display:block;margin:6px 0 9px;color:#99f6e4;font-size:10px;line-height:1.4');
}

export function sequentialDraftEditPreparedPreview(prepared) {
  const transactions = prepared.candidate.transactionIds.length
    ? prepared.candidate.transactionIds.join(', ') : 'Journal-only accepted command';
  const payload = prepared.nativeCommand.payload || {};
  let target = [];
  if (prepared.nativeCommand.commandType === 'REVERSE_COMPONENT') {
    target = [
      `Decision: ${prepared.targets.decisionId}`,
      `Reversal candidate: ${prepared.targets.candidateId}`,
      `Component: ${prepared.targets.componentId}`,
      `Entry port: ${prepared.targets.entryPortId}`,
      `Scene entity: ${payload.targetEntityId}`,
    ];
  } else if (prepared.targets?.candidateId) {
    target = [
      `Decision: ${prepared.targets.decisionId}`,
      `Candidate: ${prepared.targets.candidateId}`,
      `Scene entity: ${payload.targetEntityId}`,
      ...(prepared.nativeCommand.fromPortId ? [
        `From port: ${prepared.nativeCommand.fromPortId}`,
        `To port: ${prepared.nativeCommand.toPortId}`,
      ] : []),
    ];
  } else if (prepared.targets?.decisionId) {
    target = [
      `Decision: ${prepared.targets.decisionId}`,
      `Decision reason: ${payload.targetDecisionReason}`,
      `Decision scope: ${payload.targetDecisionScope || 'unspecified'}`,
      `Active port: ${payload.targetActivePortId || 'none'}`,
      `Junction: ${payload.targetJunctionId || 'none'}`,
      `Reference: ${payload.targetReference || 'none'}`,
    ];
  }
  return [
    `Command: ${prepared.nativeCommand.commandType}`,
    `Branch: ${prepared.nativeCommand.branchId}`,
    ...target,
    `Issued: ${prepared.envelope.origin.issuedAt}`,
    `Predicted outcome: ${prepared.candidate.outcome}`,
    `Prepared ID: ${prepared.preparedId}`,
    `Authority ID: ${prepared.expectedAuthority.authorityId}`,
    `Transaction mapping: ${transactions}`,
  ].join('\n');
}

export function sequentialDraftEditTargetText({ candidate, decision, reversal, manualPorts }) {
  if (reversal) {
    return `Selected reversal candidate: ${reversal.candidateId}`
      + `\nDecision: ${reversal.decisionId}`
      + `\nComponent: ${reversal.componentId}`
      + `\nEntry port: ${reversal.entryPortId}`
      + `\nScene entity: ${reversal.entityId}`;
  }
  if (candidate) {
    return `Selected candidate: ${candidate.candidateId}\nDecision: ${candidate.decisionId}\nScene entity: ${candidate.entityId}`
      + (manualPorts
        ? `\nFrom port: ${manualPorts.fromPortId}\nTo port: ${manualPorts.toPortId}`
        : '\nManual port pair: unavailable');
  }
  if (decision) {
    return `Boundary decision: ${decision.decisionId}\nReason: ${decision.reason}`
      + `\nScope: ${decision.decisionScope || 'unspecified'}`
      + `\nActive port: ${decision.activePortId || 'none'}`
      + `\nJunction: ${decision.junctionId || 'none'}`
      + `\nReference: ${decision.referenceTarget || 'none'}`;
  }
  return 'No authoritative command target. Pick a blue connection candidate, a purple reversal entry, or open a supported zero-candidate boundary decision.';
}

import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { freezeConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { projectSequentialReversalCandidates } from '../tabs/sequential-sketcher/sequential-engineering-svg-reversal-scene.js';
import { createSequentialDraftEditCommandPanel } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-command-panel.js';

const BRANCH = '/SSK/3G/PANEL';
const DECISION = 'DECISION-3G-PANEL';
const ISSUED_AT = '2026-07-28T04:14:00.000Z';
class Element {
  constructor(dataset = {}) {
    this.dataset = dataset; this.hidden = false; this.disabled = false;
    this.value = ''; this.textContent = ''; this.style = { cssText: '' };
    this.attributes = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  closest(selector) {
    if (selector === '[data-ssk-draft-edit-command]' && this.dataset.sskDraftEditCommand) return this;
    if (selector === '[data-ssk-draft-edit-command-accept]' && this.dataset.accept) return this;
    if (selector === '[data-ssk-draft-edit-command-cancel]' && this.dataset.cancel) return this;
    return null;
  }
}
function dom() {
  const command = new Element({ sskDraftEditCommand: 'REVERSE_COMPONENT' });
  const elements = {
    panel: new Element(), status: new Element(), target: new Element(), actor: new Element(),
    reason: new Element(), evidence: new Element(), preview: new Element(),
    accept: new Element({ accept: '1' }), cancel: new Element({ cancel: '1' }), command,
  };
  const selectors = new Map([
    ['[data-ssk-draft-edit-command-panel]', elements.panel],
    ['[data-ssk-draft-edit-command-state]', elements.status],
    ['[data-ssk-draft-edit-target]', elements.target],
    ['[data-ssk-draft-edit-actor]', elements.actor],
    ['[data-ssk-draft-edit-reason]', elements.reason],
    ['[data-ssk-draft-edit-evidence]', elements.evidence],
    ['[data-ssk-draft-edit-command-preview]', elements.preview],
    ['[data-ssk-draft-edit-command-accept]', elements.accept],
    ['[data-ssk-draft-edit-command-cancel]', elements.cancel],
  ]);
  const listeners = new Map();
  const root = {
    querySelector: (selector) => selectors.get(selector) || null,
    querySelectorAll: (selector) => selector === '[data-ssk-draft-edit-command]' ? [command] : [],
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  return { root, elements, listeners };
}
function authority() {
  const records = [{
    type: 'BRANCH', name: BRANCH,
    attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: { NAME: 'P1', APOS: { x: -100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } },
    }],
  }];
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const component = [...indexes.components.values()][0];
  const initial = createSequentialConstructionSession(BRANCH);
  const session = freezeConstructionSession({
    ...initial, state: 'USER_DECISION_REQUIRED',
    currentDecisionRequest: Object.freeze({
      schema: 'SequentialConnectionDecision.v1', decisionId: DECISION,
      state: 'OPEN', reason: 'AMBIGUOUS_BRANCH_START', candidates: Object.freeze([]),
      resolution: null, branchId: BRANCH, decisionScope: 'COMPONENT_TRAVERSAL',
      componentId: component.componentId, startComponentId: component.componentId,
      entryPortId: null,
    }),
  });
  const candidate = projectSequentialReversalCandidates(session, indexes)[0];
  const target = Object.freeze({
    schema: 'SequentialDraftEditReversalTarget.v1', authorityId: 'SAUTH-3G',
    readAuthorityId: 'READ-3G', branchId: BRANCH, decisionId: DECISION,
    candidateId: candidate.candidateId, componentId: candidate.componentId,
    entryPortId: candidate.entryPortId, entityId: `ssk:reversal:${candidate.candidateId}`,
    sourcePosition: candidate.sourcePosition, reversalTargetId: 'SSK3G-REVERSAL-TARGET',
  });
  return { evidence, indexes, session, candidate, target };
}
function fixture(options = {}) {
  const view = dom();
  const current = authority();
  const model = { session: current.session, indexes: current.indexes };
  let prepares = 0; let accepts = 0; const inputs = [];
  const gateway = {
    getState: () => Object.freeze({ ready: true, branchId: BRANCH, reasonCode: null }),
    prepare: (input) => {
      prepares += 1; inputs.push(input);
      return Object.freeze({
        preparedId: `SPREP-3G-${prepares}`,
        nativeCommand: Object.freeze({ ...input.command }),
        targets: Object.freeze({
          decisionId: input.command.decisionId, candidateId: input.command.candidateId,
          componentId: input.command.componentId, entryPortId: input.command.entryPortId,
        }),
        envelope: Object.freeze({ origin: input.origin }),
        expectedAuthority: Object.freeze({ authorityId: 'SAUTH-3G' }),
        candidate: Object.freeze({
          outcome: 'COMPONENT_TRAVERSAL_REVERSED', transactionIds: Object.freeze(['TXN-3G']),
        }),
      });
    },
    accept: () => {
      accepts += 1;
      return options.stale
        ? Object.freeze({ accepted: false, reasonCode: 'PREPARED_COMMAND_STALE', message: 'Stale.' })
        : Object.freeze({ accepted: true, message: 'Accepted.' });
    },
  };
  const panel = createSequentialDraftEditCommandPanel({
    root: view.root, gateway, readCurrentState: () => model,
    readCurrentAuthorityId: () => 'SAUTH-3G', now: () => ISSUED_AT,
  });
  return {
    ...view, current, model, panel, inputs,
    prepares: () => prepares, accepts: () => accepts,
  };
}
function evidence(test) {
  test.elements.actor.value = 'operator-3g';
  test.elements.reason.value = 'Reverse traversal to match approved flow direction.';
  test.elements.evidence.value = 'Entry port and flow direction verified against approved evidence.';
}

{
  const test = fixture();
  test.panel.setActive(true); test.panel.setReversalTarget(test.current.target);
  assert.equal(test.prepares(), 0); assert.equal(test.accepts(), 0);
  assert.equal(test.elements.command.disabled, false);
  assert.equal(test.panel.getState().reversalComponentId, test.current.candidate.componentId);
  assert.match(test.elements.target.textContent, new RegExp(test.current.candidate.entryPortId));
  assert.throws(() => test.panel.prepare('REVERSE_COMPONENT'), /actor ID/);
  test.elements.actor.value = 'operator-3g';
  assert.throws(() => test.panel.prepare('REVERSE_COMPONENT'), /operator reason/);
  test.elements.reason.value = 'Approved reversal.';
  assert.throws(() => test.panel.prepare('REVERSE_COMPONENT'), /evidence note/);
  evidence(test);
  const prepared = test.panel.prepare('REVERSE_COMPONENT');
  assert.equal(test.prepares(), 1); assert.equal(test.accepts(), 0);
  assert.equal(test.inputs[0].command.decisionId, DECISION);
  assert.equal(test.inputs[0].command.candidateId, test.current.candidate.candidateId);
  assert.equal(test.inputs[0].command.componentId, test.current.candidate.componentId);
  assert.equal(test.inputs[0].command.entryPortId, test.current.candidate.entryPortId);
  assert.equal(test.inputs[0].command.payload.reversalTargetId, 'SSK3G-REVERSAL-TARGET');
  assert.equal(prepared.envelope.origin.issuedAt, ISSUED_AT);
  assert.match(test.elements.preview.textContent, /COMPONENT_TRAVERSAL_REVERSED/);
  assert.match(test.elements.preview.textContent, /Transaction mapping: TXN-3G/);
  assert.equal(test.panel.cancel().preparedId, 'SPREP-3G-1');
  assert.equal(test.accepts(), 0);
}

for (const stale of [false, true]) {
  const test = fixture({ stale });
  test.panel.setActive(true); test.panel.setReversalTarget(test.current.target); evidence(test);
  test.panel.prepare('REVERSE_COMPONENT');
  const result = test.panel.accept();
  assert.equal(result.accepted, !stale); assert.equal(test.accepts(), 1);
  assert.match(test.elements.status.textContent,
    stale ? /PREPARED_COMMAND_STALE/ : /accepted and published/i);
  assert.equal(test.panel.getState().reversalTargetId, null);
}

{
  const test = fixture();
  test.panel.setActive(true); test.panel.setReversalTarget(test.current.target); evidence(test);
  test.panel.prepare('REVERSE_COMPONENT');
  test.model.session = freezeConstructionSession({
    ...test.model.session,
    currentDecisionRequest: Object.freeze({
      ...test.model.session.currentDecisionRequest, decisionId: 'DECISION-CHANGED',
    }),
  });
  test.panel.refresh();
  assert.equal(test.panel.getState().reversalTargetId, null);
  assert.equal(test.panel.getState().pendingPreparedId, null);
}

console.log('Sequential SSK-TS-3G supervised reversal panel: ok');
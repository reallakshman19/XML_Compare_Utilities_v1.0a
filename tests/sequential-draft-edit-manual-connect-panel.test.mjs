import assert from 'node:assert/strict';
import { createSequentialDraftEditCommandPanel } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-command-panel.js';

const BRANCH = '/SSK/3E';
const DECISION = 'DECISION-00001';
const CANDIDATE = 'CANDIDATE-3E';
const FROM = `${BRANCH}/P1:LPOS`;
const TO = `${BRANCH}/C1:APOS`;
const ISSUED_AT = '2026-07-28T01:35:00.000Z';

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
  const command = new Element({ sskDraftEditCommand: 'MANUAL_CONNECT' });
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
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name); },
  };
  return { root, elements, listeners };
}
function session() {
  return {
    state: 'USER_DECISION_REQUIRED', rootBranchId: BRANCH,
    currentDecisionRequest: {
      decisionId: DECISION, state: 'OPEN', reason: 'AMBIGUOUS_CONNECTION',
      candidates: [{ candidateId: CANDIDATE, fromPortId: FROM, toPortId: TO }],
    },
    undoStack: [], redoStack: [],
  };
}
function target() {
  return Object.freeze({
    schema: 'SequentialDraftEditCandidateTarget.v1', authorityId: 'SAUTH-3E',
    readAuthorityId: 'READ-3E', branchId: BRANCH, decisionId: DECISION,
    candidateId: CANDIDATE, entityId: `ssk:candidate:${CANDIDATE}`,
    targetSelectionId: 'SSK3E-TARGET',
  });
}
function fixture(options = {}) {
  const view = dom();
  const model = {
    session: session(),
    indexes: { ports: options.ports || new Map([[FROM, {}], [TO, {}]]) },
  };
  let prepares = 0; let accepts = 0;
  const inputs = [];
  const gateway = {
    getState: () => Object.freeze({ ready: true, branchId: BRANCH, reasonCode: null }),
    prepare: (input) => {
      prepares += 1; inputs.push(input);
      return Object.freeze({
        preparedId: `SPREP-${prepares}`,
        nativeCommand: Object.freeze({ ...input.command }),
        targets: Object.freeze({
          decisionId: input.command.decisionId, candidateId: input.command.candidateId,
          fromPortId: input.command.fromPortId, toPortId: input.command.toPortId,
        }),
        envelope: Object.freeze({ origin: input.origin }),
        expectedAuthority: Object.freeze({ authorityId: 'SAUTH-3E' }),
        candidate: Object.freeze({
          outcome: 'USER_MANUAL_CONNECTION_COMMITTED',
          transactionIds: Object.freeze(['TXN-3E']),
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
    readCurrentAuthorityId: () => 'SAUTH-3E', now: () => ISSUED_AT,
  });
  return { ...view, model, panel, inputs, prepares: () => prepares, accepts: () => accepts };
}
function evidence(test) {
  test.elements.actor.value = 'operator-3e';
  test.elements.reason.value = 'Approved exact candidate-bound ports.';
  test.elements.evidence.value = 'Reviewed candidate and indexed port evidence.';
}

{
  const test = fixture();
  test.panel.setActive(true); test.panel.setCandidateTarget(target());
  assert.equal(test.prepares(), 0); assert.equal(test.accepts(), 0);
  assert.equal(test.elements.command.disabled, false);
  assert.equal(test.panel.getState().fromPortId, FROM);
  assert.equal(test.panel.getState().toPortId, TO);
  assert.match(test.elements.target.textContent, new RegExp(FROM));
  assert.match(test.elements.target.textContent, new RegExp(TO));
  assert.throws(() => test.panel.prepare('MANUAL_CONNECT'), /actor ID/);
  evidence(test);
  const prepared = test.panel.prepare('MANUAL_CONNECT');
  assert.equal(test.prepares(), 1); assert.equal(test.accepts(), 0);
  assert.equal(test.inputs[0].command.fromPortId, FROM);
  assert.equal(test.inputs[0].command.toPortId, TO);
  assert.equal(test.inputs[0].command.decisionId, DECISION);
  assert.equal(test.inputs[0].command.candidateId, CANDIDATE);
  assert.equal(prepared.envelope.origin.issuedAt, ISSUED_AT);
  assert.match(test.elements.preview.textContent, new RegExp(`From port: ${FROM}`));
  assert.match(test.elements.preview.textContent, new RegExp(`To port: ${TO}`));
  const cancelled = test.panel.cancel();
  assert.equal(cancelled.preparedId, 'SPREP-1'); assert.equal(test.accepts(), 0);
}

{
  const test = fixture({ ports: new Map([[FROM, {}]]) });
  test.panel.setActive(true); test.panel.setCandidateTarget(target());
  assert.equal(test.elements.command.disabled, true);
  assert.equal(test.panel.getState().fromPortId, null);
  assert.equal(test.panel.getState().toPortId, null);
  assert.match(test.elements.target.textContent, /unavailable/i);
}

for (const stale of [false, true]) {
  const test = fixture({ stale });
  test.panel.setActive(true); test.panel.setCandidateTarget(target()); evidence(test);
  test.panel.prepare('MANUAL_CONNECT');
  const result = test.panel.accept();
  assert.equal(result.accepted, !stale);
  assert.equal(test.accepts(), 1);
  assert.match(test.elements.status.textContent,
    stale ? /PREPARED_COMMAND_STALE/ : /accepted and published/i);
  assert.equal(test.panel.getState().candidateId, null);
}

console.log('Sequential SSK-TS-3E focused manual-connect panel: ok');

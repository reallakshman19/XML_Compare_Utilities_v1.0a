import assert from 'node:assert/strict';
import { createSequentialDraftEditCommandPanel } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-command-panel.js';

const ISSUED_AT = '2026-07-27T18:55:00.000Z';
const BRANCH_ID = '/BRANCH/A';
const DECISION_ID = 'DECISION-00001';
const CANDIDATE_ID = 'CANDIDATE-001';
const COMMANDS = Object.freeze([
  'CONNECT_CANDIDATE', 'REJECT_CANDIDATE', 'MARK_TERMINAL', 'MARK_EXTERNAL_BOUNDARY',
  'ADVANCE_ONE', 'RUN_UNTIL_BLOCKED', 'DEFER_DECISION', 'RESUME_DECISION',
  'UNDO_LAST_TRANSACTION', 'REDO_LAST_TRANSACTION',
]);

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = { ...dataset }; this.hidden = false; this.disabled = false;
    this.value = ''; this.textContent = ''; this.attributes = new Map();
    this.style = { cssText: '' };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  closest(selector) {
    if (selector === '[data-ssk-draft-edit-command]' && this.dataset.sskDraftEditCommand) return this;
    if (selector === '[data-ssk-draft-edit-command-accept]' && this.dataset.sskDraftEditCommandAccept) return this;
    if (selector === '[data-ssk-draft-edit-command-cancel]' && this.dataset.sskDraftEditCommandCancel) return this;
    return null;
  }
}
function rootFixture() {
  const elements = {
    panel: new FakeElement(), status: new FakeElement(), target: new FakeElement(),
    actor: new FakeElement(), reason: new FakeElement(), evidence: new FakeElement(),
    preview: new FakeElement(), accept: new FakeElement({ sskDraftEditCommandAccept: '1' }),
    cancel: new FakeElement({ sskDraftEditCommandCancel: '1' }),
    commands: COMMANDS.map((commandType) => new FakeElement({ sskDraftEditCommand: commandType })),
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
    querySelectorAll: (selector) => selector === '[data-ssk-draft-edit-command]' ? elements.commands : [],
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  return Object.freeze({ root, elements, listeners });
}
function candidateSession(state = 'OPEN') {
  return {
    state: 'USER_DECISION_REQUIRED', rootBranchId: BRANCH_ID,
    currentDecisionRequest: {
      decisionId: DECISION_ID, state, reason: 'AMBIGUOUS_CONNECTION',
      candidates: [{ candidateId: CANDIDATE_ID }],
    },
    undoStack: [], redoStack: [],
  };
}
function boundarySession(state = 'OPEN', reason = 'REFERENCE_TARGET_MISSING') {
  return {
    state: 'USER_DECISION_REQUIRED', rootBranchId: BRANCH_ID,
    currentDecisionRequest: {
      decisionId: DECISION_ID, state, reason, candidates: [],
      decisionScope: 'HEAD_BOUNDARY', activePortId: null,
      junctionId: 'JUNCTION-3D', referenceTarget: '/MISSING/TARGET',
    },
    undoStack: [], redoStack: [],
  };
}
function candidateTarget() {
  return Object.freeze({
    schema: 'SequentialDraftEditCandidateTarget.v1', authorityId: 'SAUTH-CURRENT',
    readAuthorityId: 'READ-CURRENT', branchId: BRANCH_ID, decisionId: DECISION_ID,
    candidateId: CANDIDATE_ID, entityId: `ssk:candidate:${CANDIDATE_ID}`,
    targetSelectionId: 'fnv1a32-canonical-json-v1:SSK3DTARGET:12345678',
  });
}
function decisionTarget() {
  return Object.freeze({
    schema: 'SequentialDraftEditDecisionTarget.v1', authorityId: 'SAUTH-CURRENT',
    readAuthorityId: 'READ-CURRENT', branchId: BRANCH_ID, decisionId: DECISION_ID,
    decisionScope: 'HEAD_BOUNDARY', reason: 'REFERENCE_TARGET_MISSING',
    activePortId: null, junctionId: 'JUNCTION-3D', referenceTarget: '/MISSING/TARGET',
    decisionTargetId: 'fnv1a32-canonical-json-v1:SSK3DDECISION:12345678',
  });
}
function prepared(input, sequence) {
  const type = input.command.commandType;
  const outcome = type === 'REJECT_CANDIDATE' ? 'CANDIDATE_REJECTED'
    : ['MARK_TERMINAL', 'MARK_EXTERNAL_BOUNDARY'].includes(type)
      ? 'HEAD_BOUNDARY_USER_CLASSIFIED' : 'ADVANCED';
  return Object.freeze({
    schema: 'SequentialPreparedCommand.v1', preparedId: `SPREP-${sequence}`,
    nativeCommand: Object.freeze({
      commandType: type, branchId: input.command.branchId,
      decisionId: input.command.decisionId || null, candidateId: input.command.candidateId || null,
      payload: input.command.payload,
    }),
    targets: Object.freeze({
      decisionId: input.command.decisionId || null, candidateId: input.command.candidateId || null,
    }),
    envelope: Object.freeze({ origin: input.origin }),
    expectedAuthority: Object.freeze({ authorityId: `SAUTH-${sequence}` }),
    candidate: Object.freeze({ outcome, transactionIds: Object.freeze([`TXN-${sequence}`]) }),
  });
}
function fixture(options = {}) {
  const dom = rootFixture();
  const model = { session: options.session || { state: 'READY', rootBranchId: BRANCH_ID,
    currentDecisionRequest: null, undoStack: [], redoStack: [] } };
  let prepareCount = 0; let acceptCount = 0; let nowCount = 0;
  const preparedInputs = [];
  const gateway = {
    getState: () => Object.freeze({ ready: options.ready !== false, branchId: BRANCH_ID,
      reasonCode: options.ready === false ? 'JOURNAL_NOT_ADOPTED' : null }),
    prepare: (input) => { prepareCount += 1; preparedInputs.push(input); return prepared(input, prepareCount); },
    accept: (value) => {
      acceptCount += 1;
      if (options.rejectAcceptance) return Object.freeze({ accepted: false,
        reasonCode: 'PREPARED_COMMAND_STALE', message: 'Prepared command is stale.' });
      return Object.freeze({ accepted: true, preparedId: value.preparedId, message: 'Accepted.' });
    },
  };
  const panel = createSequentialDraftEditCommandPanel({
    root: dom.root, gateway, readCurrentState: () => model,
    readCurrentAuthorityId: options.readCurrentAuthorityId || (() => 'SAUTH-CURRENT'),
    now: options.now || (() => { nowCount += 1; return ISSUED_AT; }),
  });
  return Object.freeze({
    ...dom, model, gateway, panel, preparedInputs,
    prepareCount: () => prepareCount, acceptCount: () => acceptCount, nowCount: () => nowCount,
  });
}
function commandButton(test, commandType) {
  return test.elements.commands.find((button) => button.dataset.sskDraftEditCommand === commandType);
}
function evidence(test, mode = 'candidate') {
  test.elements.actor.value = 'operator-3d';
  test.elements.reason.value = mode === 'boundary'
    ? 'Reviewed unresolved boundary evidence.' : 'Current candidate matches reviewed continuity evidence.';
  test.elements.evidence.value = mode === 'boundary'
    ? 'Zero-candidate decision and reference evidence reviewed.' : 'Candidate scene entity and decision register reviewed.';
}

{
  const test = fixture();
  assert.equal(test.panel.getState().active, false);
  assert.equal(test.elements.panel.hidden, true);
  assert.equal(test.elements.panel.attributes.get('inert'), '');
  assert.match(test.elements.panel.style.cssText, /position:absolute/);
  assert.match(test.elements.target.style.cssText, /white-space:pre-wrap/);
  assert(test.elements.commands.every((button) => button.disabled));
  test.panel.setActive(true);
  assert.equal(commandButton(test, 'ADVANCE_ONE').disabled, false);
  for (const type of ['CONNECT_CANDIDATE', 'REJECT_CANDIDATE', 'MARK_TERMINAL', 'MARK_EXTERNAL_BOUNDARY']) {
    assert.equal(commandButton(test, type).disabled, true);
  }
}

{
  const test = fixture({ session: candidateSession() });
  test.panel.setActive(true); test.panel.setCandidateTarget(candidateTarget());
  assert.equal(test.prepareCount(), 0); assert.equal(test.acceptCount(), 0);
  assert.equal(commandButton(test, 'CONNECT_CANDIDATE').disabled, false);
  assert.equal(commandButton(test, 'REJECT_CANDIDATE').disabled, false);
  assert.equal(commandButton(test, 'MARK_TERMINAL').disabled, true);
  assert.match(test.elements.target.textContent, /CANDIDATE-001/);
  assert.equal(test.panel.getState().candidateId, CANDIDATE_ID);
}

{
  const test = fixture({ session: boundarySession() });
  test.panel.setActive(true); test.panel.setDecisionTarget(decisionTarget());
  assert.equal(test.prepareCount(), 0, 'decision certification must not prepare');
  assert.equal(test.acceptCount(), 0, 'decision certification must not publish');
  assert.equal(commandButton(test, 'MARK_TERMINAL').disabled, false);
  assert.equal(commandButton(test, 'MARK_EXTERNAL_BOUNDARY').disabled, false);
  assert.equal(commandButton(test, 'CONNECT_CANDIDATE').disabled, true);
  assert.match(test.elements.target.textContent, /REFERENCE_TARGET_MISSING/);
  assert.equal(test.panel.getState().decisionId, DECISION_ID);
  assert.equal(test.panel.getState().decisionTargetId, decisionTarget().decisionTargetId);
}

for (const [targetKind, sessionValue, setter] of [
  ['candidate', candidateSession(), (panel) => panel.setCandidateTarget(candidateTarget())],
  ['decision', boundarySession(), (panel) => panel.setDecisionTarget(decisionTarget())],
]) {
  let authorityId = 'SAUTH-CURRENT';
  const test = fixture({ session: sessionValue, readCurrentAuthorityId: () => authorityId });
  test.panel.setActive(true); setter(test.panel); authorityId = 'SAUTH-CHANGED'; test.panel.refresh();
  assert.equal(test.panel.getState().candidateId, null, targetKind);
  assert.equal(test.panel.getState().decisionId, null, targetKind);
  assert.equal(test.panel.getState().pendingPreparedId, null, targetKind);
  assert.match(test.elements.status.textContent, /authority changed/i);
}

for (const commandType of ['CONNECT_CANDIDATE', 'REJECT_CANDIDATE']) {
  const test = fixture({ session: candidateSession() });
  test.panel.setActive(true); test.panel.setCandidateTarget(candidateTarget());
  assert.throws(() => test.panel.prepare(commandType), /Operator actor ID is required/);
  test.elements.actor.value = 'operator-3d';
  assert.throws(() => test.panel.prepare(commandType), /requires an operator reason/);
  test.elements.reason.value = 'Reviewed candidate evidence';
  assert.throws(() => test.panel.prepare(commandType), /requires an evidence note/);
  test.elements.evidence.value = 'Exact candidate entity reviewed';
  const value = test.panel.prepare(commandType);
  assert.equal(test.prepareCount(), 1); assert.equal(test.acceptCount(), 0); assert.equal(test.nowCount(), 1);
  assert.equal(value.nativeCommand.decisionId, DECISION_ID);
  assert.equal(value.nativeCommand.candidateId, CANDIDATE_ID);
  assert.equal(test.preparedInputs[0].command.payload.targetEntityId, `ssk:candidate:${CANDIDATE_ID}`);
  assert.match(test.elements.preview.textContent, new RegExp(`Command: ${commandType}`));
  assert.match(test.elements.preview.textContent, /Scene entity: ssk:candidate:CANDIDATE-001/);
}

for (const commandType of ['MARK_TERMINAL', 'MARK_EXTERNAL_BOUNDARY']) {
  const test = fixture({ session: boundarySession() });
  test.panel.setActive(true); test.panel.setDecisionTarget(decisionTarget());
  assert.throws(() => test.panel.prepare(commandType), /Operator actor ID is required/);
  test.elements.actor.value = 'operator-3d';
  assert.throws(() => test.panel.prepare(commandType), /requires an operator reason/);
  test.elements.reason.value = 'Reviewed unresolved boundary evidence';
  assert.throws(() => test.panel.prepare(commandType), /requires an evidence note/);
  test.elements.evidence.value = 'Current zero-candidate decision reviewed';
  const value = test.panel.prepare(commandType);
  assert.equal(test.prepareCount(), 1); assert.equal(test.acceptCount(), 0); assert.equal(test.nowCount(), 1);
  assert.equal(value.nativeCommand.decisionId, DECISION_ID);
  assert.equal(value.nativeCommand.candidateId, null);
  assert.equal(test.preparedInputs[0].command.payload.decisionTargetId, decisionTarget().decisionTargetId);
  assert.equal(test.preparedInputs[0].command.payload.targetDecisionReason, 'REFERENCE_TARGET_MISSING');
  assert.match(test.elements.preview.textContent, new RegExp(`Command: ${commandType}`));
  assert.match(test.elements.preview.textContent, /Decision reason: REFERENCE_TARGET_MISSING/);
  assert.match(test.elements.preview.textContent, /Reference: \/MISSING\/TARGET/);
}

{
  const test = fixture();
  test.panel.setActive(true);
  assert.throws(() => test.panel.prepare('ADVANCE_ONE'), /Operator actor ID is required/);
  test.elements.actor.value = 'operator';
  const value = test.panel.prepare('ADVANCE_ONE');
  assert.equal(value.envelope.origin.issuedAt, ISSUED_AT);
  assert.equal(test.acceptCount(), 0);
}

{
  const test = fixture({ now: () => 'not-an-iso-time' });
  test.panel.setActive(true); test.elements.actor.value = 'operator';
  assert.throws(() => test.panel.prepare('ADVANCE_ONE'), /exact ISO timestamp/);
  assert.equal(test.prepareCount(), 0);
}

for (const [mode, sessionValue, setter, commandType] of [
  ['candidate', candidateSession(), (panel) => panel.setCandidateTarget(candidateTarget()), 'CONNECT_CANDIDATE'],
  ['boundary', boundarySession(), (panel) => panel.setDecisionTarget(decisionTarget()), 'MARK_EXTERNAL_BOUNDARY'],
]) {
  const test = fixture({ session: sessionValue });
  test.panel.setActive(true); setter(test.panel); evidence(test, mode);
  const before = JSON.stringify(test.model);
  test.panel.prepare(commandType);
  const cancelled = test.panel.cancel();
  assert.equal(cancelled.preparedId, 'SPREP-1');
  assert.equal(test.acceptCount(), 0); assert.equal(JSON.stringify(test.model), before);
  assert.equal(mode === 'candidate' ? test.panel.getState().candidateId : test.panel.getState().decisionId,
    mode === 'candidate' ? CANDIDATE_ID : DECISION_ID);
}

for (const [mode, sessionValue, setter, commandType] of [
  ['candidate', candidateSession(), (panel) => panel.setCandidateTarget(candidateTarget()), 'CONNECT_CANDIDATE'],
  ['boundary', boundarySession(), (panel) => panel.setDecisionTarget(decisionTarget()), 'MARK_TERMINAL'],
]) {
  const test = fixture({ session: sessionValue });
  test.panel.setActive(true); setter(test.panel); evidence(test, mode);
  test.panel.prepare(commandType);
  const acceptance = test.panel.accept();
  assert.equal(acceptance.accepted, true); assert.equal(test.acceptCount(), 1);
  assert.equal(test.panel.getState().candidateId, null); assert.equal(test.panel.getState().decisionId, null);
  assert.match(test.elements.status.textContent, /accepted and published/i);
}

{
  const test = fixture({ session: boundarySession('DEFERRED') });
  test.panel.setActive(true); test.panel.setDecisionTarget(decisionTarget());
  assert.equal(commandButton(test, 'MARK_TERMINAL').disabled, true);
  assert.equal(commandButton(test, 'MARK_EXTERNAL_BOUNDARY').disabled, true);
  assert.equal(commandButton(test, 'RESUME_DECISION').disabled, false);
}

{
  const test = fixture({ session: candidateSession() });
  test.panel.setActive(true); test.panel.setDecisionTarget(decisionTarget());
  assert.equal(commandButton(test, 'MARK_TERMINAL').disabled, true);
  assert.equal(test.panel.getState().decisionId, null, 'candidate-bearing decision cannot retain boundary target');
}

{
  const test = fixture({ ready: false, session: boundarySession() });
  test.panel.setActive(true); test.panel.setDecisionTarget(decisionTarget());
  assert(test.elements.commands.every((button) => button.disabled));
  assert.match(test.elements.status.textContent, /JOURNAL_NOT_ADOPTED/);
}

{
  const test = fixture({ session: { state: 'READY', rootBranchId: BRANCH_ID,
    currentDecisionRequest: null, undoStack: [{ transactionId: 'TXN-1' }], redoStack: [{ transactionId: 'TXN-2' }] } });
  test.panel.setActive(true);
  assert.equal(commandButton(test, 'UNDO_LAST_TRANSACTION').disabled, false);
  assert.equal(commandButton(test, 'REDO_LAST_TRANSACTION').disabled, false);
  test.panel.destroy();
  assert.equal(test.panel.getState().destroyed, true);
  assert.equal(test.elements.panel.hidden, true);
  assert.equal(test.listeners.has('click'), false);
}

console.log('Sequential SSK-TS-3D supervised candidate and boundary command panel: ok');

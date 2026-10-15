import { parseStagedJson } from './sequential-sketcher-source.js';
import { sequentialSketcherMarkup } from './sequential-sketcher-markup.js';
import { createSequentialBranchWorkspaceRegistry } from './sequential-branch-workspace-state.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from './source/sequential-evidence-model.js';
import {
  advanceConstruction, applyConstructionDecision, createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from './construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from './construction/sequential-construction-acceptance.js';
import { DECISION_ACTIONS } from './construction/sequential-construction-contract.js';
import { buildConfirmedConstructionSupportProjection } from './support/sequential-confirmed-support-projection.js';
import { mountSequentialReviewQueueController } from './review/sequential-review-queue-controller.js';
import {
  renderConstructionInspector, renderConstructionMetrics, renderConstructionSequence,
  renderSequentialConstructionCanvas,
} from './canvas/sequential-construction-svg.js';
import { createSequentialEngineeringSvgOwnerBridge } from './sequential-engineering-svg-owner-bridge.js';
import { sequentialCommandJournalHeadFingerprint } from './scoped-edit/sequential-command-journal.js';

function readFile(file) { return file ? file.text() : Promise.resolve(''); }
function required(root, selector) { const element = root.querySelector(selector); if (!element) throw new Error(`Sequential Sketcher element missing: ${selector}`); return element; }
function numberValue(element, fallback) { const value = Number(element.value); return Number.isFinite(value) ? value : fallback; }
function branchStateLabel(state) {
  if (state === 'ROUTE_COMPLETE') return '✓';
  if (state === 'USER_DECISION_REQUIRED') return '⚠';
  if (state === 'FAILED') return '×';
  if (state === 'NOT_OPENED') return '○';
  return '●';
}
function candidatePorts(candidate) {
  return {
    fromPortId: candidate?.fromPortId || candidate?.targetPortId || '',
    toPortId: candidate?.toPortId || candidate?.connectedPortId || '',
  };
}
function restoredDownstream(session, indexes) {
  if (session?.state !== 'ROUTE_COMPLETE') return { confirmedConstruction: null, supportProjection: null };
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {
    projectionToleranceMm: 50, onCenterlineToleranceMm: 0.001, ambiguityToleranceMm: 1,
  });
  return { confirmedConstruction, supportProjection };
}

export function mountSequentialSketcherWorkspace(root, context = {}) {
  root.innerHTML = sequentialSketcherMarkup();
  const elements = {
    source: required(root, '[data-ssk-source]'), branch: required(root, '[data-ssk-branch]'),
    branchPrev: required(root, '[data-ssk-branch-prev]'), branchNext: required(root, '[data-ssk-branch-next]'),
    branchPosition: required(root, '[data-ssk-branch-position]'), activeBranch: required(root, '[data-ssk-active-branch]'),
    activeBranchChip: required(root, '[data-ssk-active-branch-chip]'), savedBranches: required(root, '[data-ssk-saved-branches]'),
    startLabel: required(root, '[data-ssk-start-label]'),
    exactTolerance: required(root, '[data-ssk-exact-tolerance]'), repairTolerance: required(root, '[data-ssk-repair-tolerance]'),
    candidateRadius: required(root, '[data-ssk-candidate-radius]'), status: required(root, '[data-ssk-status]'),
    canvas: required(root, '[data-ssk-canvas]'), metrics: required(root, '[data-ssk-metrics]'),
    sequence: required(root, '[data-ssk-sequence]'), inspector: required(root, '[data-ssk-inspector]'),
    stepLabel: required(root, '[data-ssk-step-label]'),
  };
  const model = {
    records: null,
    evidence: null,
    indexes: null,
    session: null,
    confirmedConstruction: null,
    supportProjection: null,
    restoredDecisionRegister: null,
    journalState: null,
    workspaceApplicationReceipts: Object.freeze([]),
    mode: 'ISO',
    selectedCandidateId: '',
    branchRegistry: createSequentialBranchWorkspaceRegistry(),
  };
  let reviewController = null;
  let publishOwner = () => null;
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      session: model.session,
      evidenceModel: model.evidence,
      indexes: model.indexes,
      confirmedConstruction: model.confirmedConstruction,
      supportProjection: model.supportProjection,
      visibleProjection: model.mode,
      constructionCandidateSelection: model.selectedCandidateId,
      engineeringSceneSelection: null,
      reviewQueueSelection: null,
      inspectorSelection: model.selectedCandidateId,
    }),
    registerPublisher: (publish) => { publishOwner = publish; },
  });
  const setStatus = (message, state = 'info') => { elements.status.textContent = message; elements.status.dataset.state = state; };
  const engineOptions = () => ({
    exactToleranceMm: numberValue(elements.exactTolerance, 1),
    autoRepairToleranceMm: Math.min(25, numberValue(elements.repairTolerance, 25)),
    candidateSearchRadiusMm: numberValue(elements.candidateRadius, 250),
  });

  function clearDownstream() {
    model.confirmedConstruction = null;
    model.supportProjection = null;
  }
  function refreshDownstream() {
    const downstream = restoredDownstream(model.session, model.indexes);
    model.confirmedConstruction = downstream.confirmedConstruction;
    model.supportProjection = downstream.supportProjection;
  }

  function branchSnapshot() {
    return {
      session: model.session,
      confirmedConstruction: model.confirmedConstruction,
      supportProjection: model.supportProjection,
      selectedCandidateId: model.selectedCandidateId,
    };
  }
  function saveActiveBranch() {
    const branchId = model.session?.rootBranchId;
    if (branchId) model.branchRegistry.save(branchId, branchSnapshot());
  }
  function populateBranchOptions(ids) {
    elements.branch.innerHTML = `<option value="">Select authoritative start branch (${ids.length})</option>${ids.map(() => '<option></option>').join('')}`;
    [...elements.branch.options].slice(1).forEach((option, index) => {
      option.value = ids[index];
      option.textContent = ids[index];
    });
  }
  function syncBranchOptions() {
    const ids = model.branchRegistry.ids();
    [...elements.branch.options].slice(1).forEach((option, index) => {
      const branchId = ids[index];
      if (!branchId) return;
      const state = model.branchRegistry.status(branchId);
      option.textContent = `${branchStateLabel(state)} ${branchId}`;
      option.title = `${branchId} · ${state.replaceAll('_', ' ').toLowerCase()}`;
    });
  }
  function syncBranchNavigator() {
    const activeBranchId = model.session?.rootBranchId || '';
    const selectedBranchId = elements.branch.value || activeBranchId;
    const position = model.branchRegistry.position(selectedBranchId);
    elements.branchPosition.textContent = position.index >= 0 ? `${position.index + 1} / ${position.count}` : `0 / ${position.count}`;
    elements.activeBranch.textContent = activeBranchId || 'No active branch';
    elements.activeBranch.title = activeBranchId;
    elements.activeBranchChip.textContent = activeBranchId ? `Active · ${activeBranchId}` : 'No branch open';
    elements.activeBranchChip.title = activeBranchId;
    elements.savedBranches.textContent = `${model.branchRegistry.savedCount()} saved`;
    elements.branchPrev.disabled = position.index <= 0;
    elements.branchNext.disabled = position.index < 0 || position.index >= position.count - 1;
    elements.startLabel.textContent = activeBranchId && selectedBranchId === activeBranchId ? 'Restart branch' : 'Start selected';
    syncBranchOptions();
  }

  function inspect(reason = 'source-inspected') {
    const records = parseStagedJson(elements.source.value);
    const evidence = buildSequentialEvidenceModel(records);
    const indexes = indexSequentialEvidence(evidence);
    const ids = evidence.branches.map((branch) => branch.branchId).sort((a, b) => a.localeCompare(b));
    model.records = records;
    model.evidence = evidence;
    model.indexes = indexes;
    populateBranchOptions(ids);
    model.branchRegistry.reset(ids);
    model.session = null;
    model.selectedCandidateId = '';
    model.restoredDecisionRegister = null;
    model.journalState = null;
    model.workspaceApplicationReceipts = Object.freeze([]);
    clearDownstream();
    reviewController?.reset();
    repaint();
    setStatus(`${ids.length} branches indexed as immutable evidence. Select a branch or explicitly build the blocked review queue.`, 'ok');
    publishOwner(reason);
  }

  function repaint() {
    if (!model.session) {
      elements.canvas.innerHTML = '<div class="ssk-empty"><strong>No branch open</strong><span>Select a branch to open an isolated construction workspace.</span></div>';
      elements.metrics.innerHTML = '';
      elements.sequence.innerHTML = '';
      elements.inspector.innerHTML = '<section><h3>Core rule</h3><p>Branch selection never commits geometry. Open a branch, then advance only through proven or explicitly approved connections.</p></section>';
      elements.stepLabel.textContent = '0 committed operations';
      syncBranchNavigator();
      return;
    }
    renderSequentialConstructionCanvas(elements.canvas, model.session, {
      mode: model.mode,
      selectedCandidateId: model.selectedCandidateId,
      supportProjection: model.supportProjection,
    });
    renderConstructionMetrics(elements.metrics, model.session, model.supportProjection);
    renderConstructionSequence(elements.sequence, model.session);
    renderConstructionInspector(elements.inspector, model.session, model.indexes, model.selectedCandidateId, model.supportProjection);
    elements.stepLabel.textContent = `${model.session.strokeLedger.length} committed operations · ${model.session.transactionLedger.length} transactions`;
    syncBranchNavigator();
  }

  function reportOutcome(outcome) {
    const session = model.session;
    if (!session) return;
    const explicitMessages = {
      MANUAL_EVIDENCE_REQUIRED: ['Manual connection requires both a reason and an evidence note.', 'error'],
      MANUAL_PORT_PAIR_NOT_CANDIDATE: ['The selected port pair is not an eligible candidate.', 'error'],
      MANUAL_PORT_PAIR_MISMATCH: ['The manual port pair no longer matches the selected candidate.', 'error'],
      REVERSAL_REASON_REQUIRED: ['Component reversal requires an engineering reason.', 'error'],
      REVERSAL_ENTRY_PORT_INVALID: ['The selected component entry is not reversible.', 'error'],
      REVERSAL_REFERENCED_HEAD_REQUIRES_REVIEW: ['Reversal cannot bypass a referenced head boundary; resolve the boundary evidence first.', 'warning'],
      NOTHING_TO_UNDO: ['No supervised transaction is available to undo.', 'info'],
      TRANSACTION_UNDONE: ['Last supervised transaction was undone atomically.', 'ok'],
    };
    if (explicitMessages[outcome]) {
      setStatus(...explicitMessages[outcome]);
      return;
    }
    if (session.state === 'USER_DECISION_REQUIRED') {
      const count = session.currentDecisionRequest?.candidates?.length || 0;
      if (session.currentDecisionRequest?.state === 'DEFERRED') {
        setStatus(`Decision deferred on ${session.activeBranchId}. The branch workspace preserves the open evidence for later review.`, 'warning');
      } else {
        setStatus(`Construction stopped: ${session.currentDecisionRequest?.reason || 'decision required'}. ${count} candidate${count === 1 ? '' : 's'} shown in dotted lines.`, 'warning');
      }
    } else if (session.state === 'ROUTE_COMPLETE') {
      const supports = model.supportProjection;
      setStatus(`Route accepted: ${session.confirmedComponentIds.length} components, ${session.committedConnections.length} connections, ${session.repairLedger.length} repairs, ${supports?.supportGlyphs.length || 0} supports projected${supports?.unresolvedSupportFamilies.length ? `, ${supports.unresolvedSupportFamilies.length} unresolved` : ''}.`, supports?.unresolvedSupportFamilies.length ? 'warning' : 'ok');
    } else if (session.state === 'FAILED') {
      setStatus(`Construction failed: ${session.diagnostics.at(-1)?.code || outcome}.`, 'error');
    } else {
      setStatus(`${outcome}: active branch ${session.activeBranchId}; ${session.confirmedComponentIds.length} components confirmed.`, 'ok');
    }
  }

  function applyResult(result, reason = 'construction-advanced') {
    model.session = result.session;
    model.selectedCandidateId = '';
    refreshDownstream();
    saveActiveBranch();
    reviewController?.refresh();
    repaint();
    reportOutcome(result.outcome);
    const settledReason = model.session.state === 'ROUTE_COMPLETE'
      ? 'route-complete'
      : model.session.state === 'USER_DECISION_REQUIRED' ? 'decision-required' : reason;
    publishOwner(settledReason);
  }
  function ensureEvidence() { if (!model.evidence || !model.indexes) inspect(); }
  function openBranch(branchId) {
    ensureEvidence();
    if (!branchId) return;
    saveActiveBranch();
    const opened = model.branchRegistry.open(branchId, createSequentialConstructionSession);
    model.session = opened.snapshot.session;
    model.confirmedConstruction = opened.snapshot.confirmedConstruction;
    model.supportProjection = opened.snapshot.supportProjection;
    model.selectedCandidateId = opened.snapshot.selectedCandidateId;
    if (model.session?.state === 'ROUTE_COMPLETE' && !model.confirmedConstruction) {
      refreshDownstream();
      saveActiveBranch();
    }
    elements.branch.value = branchId;
    reviewController?.selectBranch(branchId);
    repaint();
    const detail = opened.restored
      ? `Restored ${model.session.strokeLedger.length} committed operations, ${model.session.transactionLedger.length} transactions; state ${model.session.state}.`
      : 'Opened a clean workspace. No construction was committed by the branch switch.';
    setStatus(`Branch ${opened.index + 1} of ${opened.count}: ${branchId}. ${detail}`, opened.restored ? 'ok' : 'info');
    publishOwner(opened.restored ? 'branch-restored' : 'branch-opened');
  }
  function navigateBranch(delta) {
    ensureEvidence();
    const current = elements.branch.value || model.session?.rootBranchId || model.branchRegistry.ids()[0];
    const branchId = model.branchRegistry.adjacent(current, delta);
    if (branchId) openBranch(branchId);
  }
  function start() {
    ensureEvidence();
    const branchId = elements.branch.value || model.session?.rootBranchId;
    if (!branchId) throw new Error('Select one authoritative start branch.');
    model.session = createSequentialConstructionSession(branchId);
    model.selectedCandidateId = '';
    clearDownstream();
    applyResult(advanceConstruction(model.session, model.evidence, model.indexes, engineOptions()));
  }
  function advance() {
    if (!model.session) {
      const branchId = elements.branch.value;
      if (!branchId) return start();
      openBranch(branchId);
    }
    applyResult(advanceConstruction(model.session, model.evidence, model.indexes, engineOptions()));
  }
  function run() {
    if (!model.session) {
      const branchId = elements.branch.value;
      if (!branchId) return start();
      openBranch(branchId);
    }
    if (!model.session || model.session.state === 'USER_DECISION_REQUIRED') { repaint(); return; }
    const result = runConstructionUntilBlocked(model.session, model.evidence, model.indexes, engineOptions());
    applyResult({ session: result.session, outcome: result.outcomes.at(-1) || 'NO_CHANGE' });
  }
  function decisionPayload(extra = {}) {
    return {
      reason: root.querySelector('[data-ssk-decision-reason]')?.value || '',
      evidenceNote: root.querySelector('[data-ssk-decision-evidence]')?.value || '',
      ...extra,
    };
  }
  function decide(action, candidateId = '', extra = {}) {
    if (!model.session) return;
    applyResult(applyConstructionDecision(
      model.session,
      model.evidence,
      model.indexes,
      action,
      decisionPayload({ candidateId, ...extra }),
      engineOptions(),
    ), 'decision-applied');
  }
  function journalIdentity(state) {
    if (state === null || state === undefined) return null;
    try {
      return `${state.schema}|${state.adoptionCheckpoint?.checkpointId}|${sequentialCommandJournalHeadFingerprint(state)}`;
    } catch { throw new Error('WORKSPACE_RESTORE_JOURNAL_IDENTITY_INVALID'); }
  }
  function journalImpactAllowed(current, incoming, expected) {
    const currentId = journalIdentity(current), incomingId = journalIdentity(incoming);
    if (!incomingId && currentId && expected !== 'REMOVE') throw new Error('WORKSPACE_RESTORE_JOURNAL_DOWNGRADE_UNAPPROVED');
    const actual = !currentId && !incomingId ? 'ABSENT' : !currentId ? 'INSTALL'
      : !incomingId ? 'REMOVE' : currentId === incomingId ? 'UNCHANGED' : 'REPLACE';
    if (actual !== expected) throw new Error('WORKSPACE_RESTORE_JOURNAL_IMPACT_MISMATCH');
  }
  function preparedRegistry(restoration) {
    const rows = (restoration.workspaces || []).map(({ branchId, snapshot }) => ({
      branchId,
      snapshot: { ...snapshot, ...restoredDownstream(snapshot?.session, restoration.indexes) },
    }));
    const registry = createSequentialBranchWorkspaceRegistry();
    registry.replace(restoration.branchIds, rows);
    return registry;
  }
  function restorePackage(restoration, options = {}) {
    if (!['SequentialWorkspaceRestoration.v1', 'SequentialWorkspaceRestoration.v2'].includes(restoration?.schema)) {
      throw new Error('WORKSPACE_RESTORE_SCHEMA_INVALID');
    }
    const incomingJournal = restoration.journalState ?? null;
    journalImpactAllowed(model.journalState, incomingJournal, options.expectedJournalImpact);
    const registry = preparedRegistry(restoration);
    const active = restoration.activeBranchId ? registry.get(restoration.activeBranchId) : null;
    const receipts = Object.freeze([...(options.applicationReceipts || restoration.applicationReceipts || [])]);
    const sourceText = JSON.stringify(restoration.records, null, 2);
    const nextState = {
      records: restoration.records, evidence: restoration.evidence, indexes: restoration.indexes,
      branchRegistry: registry, session: active?.session || null,
      confirmedConstruction: active?.confirmedConstruction || null,
      supportProjection: active?.supportProjection || null,
      selectedCandidateId: active?.selectedCandidateId || '',
      restoredDecisionRegister: restoration.decisionRegister || null,
      journalState: incomingJournal, workspaceApplicationReceipts: receipts,
    };
    Object.assign(model, nextState);
    try {
      elements.source.value = sourceText;
      populateBranchOptions(restoration.branchIds);
      if (restoration.activeBranchId) elements.branch.value = restoration.activeBranchId;
      reviewController?.reset(); repaint();
      setStatus(`Verified ${restoration.packageSchema || restoration.schema} restored with journal authority ${model.journalState ? 'present' : 'absent'}.`, 'ok');
    } catch (error) {
      try { context.showToast?.(`Workspace restored; UI synchronization blocked: ${error.message || String(error)}`, 'warning'); } catch {}
    }
    return restoration;
  }

  async function onChange(event) {
    if (event.target === elements.branch) {
      if (elements.branch.value) openBranch(elements.branch.value);
      else syncBranchNavigator();
      return;
    }
    if (event.target?.dataset?.sskFile !== 'source') return;
    elements.source.value = await readFile(event.target.files?.[0]);
    inspect('source-reloaded');
  }

  function onClick(event) {
    if (event.target?.closest?.('[data-ssk-branch-prev]')) { navigateBranch(-1); return; }
    if (event.target?.closest?.('[data-ssk-branch-next]')) { navigateBranch(1); return; }
    const view = event.target?.closest?.('[data-ssk-view]')?.dataset?.sskView;
    if (view) {
      model.mode = view;
      root.querySelectorAll('[data-ssk-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.sskView === view));
      repaint();
      if (model.session) publishOwner('projection-changed');
      return;
    }
    const canvasCandidate = event.target?.closest?.('[data-ssk-candidate-id]')?.dataset?.sskCandidateId;
    const selected = event.target?.closest?.('[data-ssk-select-candidate]')?.dataset?.sskSelectCandidate;
    if (canvasCandidate || selected) {
      model.selectedCandidateId = canvasCandidate || selected;
      saveActiveBranch();
      repaint();
      if (model.session) publishOwner('selection-changed');
      return;
    }
    const connect = event.target?.closest?.('[data-ssk-connect-candidate]')?.dataset?.sskConnectCandidate;
    if (connect) { decide(DECISION_ACTIONS.CONNECT, connect); return; }
    const manualButton = event.target?.closest?.('[data-ssk-manual-connect]');
    if (manualButton) {
      const candidateId = manualButton.dataset.sskManualConnect;
      const candidate = model.session?.currentDecisionRequest?.candidates?.find((row) => row.candidateId === candidateId);
      const ports = candidatePorts(candidate);
      decide(DECISION_ACTIONS.MANUAL_CONNECT, candidateId, ports);
      return;
    }
    const reverseButton = event.target?.closest?.('[data-ssk-reverse-component]');
    if (reverseButton) {
      decide(DECISION_ACTIONS.REVERSE_COMPONENT, reverseButton.dataset.sskReverseComponent, {
        componentId: reverseButton.dataset.sskComponentId,
        entryPortId: reverseButton.dataset.sskEntryPort,
      });
      return;
    }
    const reject = event.target?.closest?.('[data-ssk-reject-candidate]')?.dataset?.sskRejectCandidate;
    if (reject) { decide(DECISION_ACTIONS.REJECT_CANDIDATE, reject); return; }
    const decisionAction = event.target?.closest?.('[data-ssk-decision-action]')?.dataset?.sskDecisionAction;
    if (decisionAction) { decide(decisionAction); return; }
    const action = event.target?.closest?.('[data-ssk-action]')?.dataset?.sskAction;
    if (!action) return;
    try {
      if (action === 'inspect') inspect();
      if (action === 'start') start();
      if (action === 'advance') advance();
      if (action === 'run') run();
      if (action === 'undo') decide(DECISION_ACTIONS.UNDO_LAST_TRANSACTION);
      if (action === 'close') context.close?.();
    } catch (error) { setStatus(error.message || String(error), 'error'); context.showToast?.(error.message || String(error), 'error'); }
  }
  function onKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      decide(DECISION_ACTIONS.UNDO_LAST_TRANSACTION);
      return;
    }
    if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    navigateBranch(event.key === 'ArrowLeft' ? -1 : 1);
  }

  reviewController = mountSequentialReviewQueueController(root, {
    ensureEvidence,
    getEvidence: () => model.evidence,
    getIndexes: () => model.indexes,
    getEngineOptions: engineOptions,
    getBranchRegistry: () => model.branchRegistry,
    saveActiveBranch,
    openBranch,
    setStatus,
    showToast: context.showToast,
  });
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('keydown', onKeyDown);
  syncBranchNavigator();
  return Object.freeze({
    getModel: () => model,
    getReviewQueue: () => reviewController?.getQueue() || null,
    getEngineeringSvgOwnerSnapshot: ownerBridge.getSnapshot,
    subscribeEngineeringSvgOwnerState: ownerBridge.subscribe,
    saveActiveBranch,
    restorePackage,
    destroy: () => {
      ownerBridge.destroy();
      reviewController?.destroy();
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('keydown', onKeyDown);
      root.innerHTML = '';
    },
  });
}

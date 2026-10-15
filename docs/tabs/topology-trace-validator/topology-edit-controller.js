/** Edit Draft workspace controller. */
import { loadTopologyProducerCore } from './topology-producer-loader.js';
import { createTopologyEditCanvasRuntime } from './topology-edit-3d-canvas.js?v=20260717-phase1-runtime';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { EDIT_KINDS, downloadText, objectForSelection, outputStem, producerOptions, producerSourceText,
  selectionForObjectId, shortestPathSelection, uniqueContextEdges, uniqueSelection } from './topology-edit-controller-helpers.js';
import { createTopologyPlatformContext } from './topology-platform-adapter.js';
import { createTopologyDraftRecovery, releaseTopologyDraftAuthority } from './topology-draft-recovery.js';
import { createTopologyEditJournalService } from './topology-edit-journal-service.js';
import { buildTopologyEditBundle, saveTopologySessionDraft } from './topology-edit-persistence-actions.js';
import { parseTopologyEditSessionDraft, TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA } from './topology-edit-session-draft.js';
import { dispatchTopologyEditOperation } from './topology-edit-operation-dispatch.js';
import { createTopologyEditUiState, normalizeTopologyEditUiState, syncTopologyEditUiControls } from './topology-edit-ui-state.js';
import { createTopologyExportPlanService } from './topology-export-plan-service.js';
import { syncTopologyEditCapabilityControls } from './topology-edit-capability-registry.js';
import { renderTopologyEditCanvas } from './topology-edit-canvas-renderer.js';
import { pointerSelection } from './topology-edit-selection-model.js';
import { applyReviewedTopologyFixes, applySafeTopologyAutoFixes } from './topology-edit-autofix-service.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE, createTopologyScopedEditCommandScope } from './topology-scoped-edit-command-scope.js';
import {
  createTopologySequentialMoveNodeRequest,
  topologySequentialMoveNodeRequestFileName,
} from './topology-sequential-move-node-request.js';
import { buildTopologyEditInspectorMarkup, buildTopologyEditMetricsMarkup, buildTopologyEditTimelineMarkup, buildTopologyEditValidationMarkup } from './topology-edit-panel.js?v=20260717-ttv-components-v1';
export function createTopologyEditController(elements, dependencies) {
  if (typeof dependencies?.onSelectionChange !== 'function') throw new TypeError('Edit controller requires onSelectionChange().');
  const canvasRuntime = createTopologyEditCanvasRuntime();
  const exportPlanService = createTopologyExportPlanService({ host: elements.exportPlan, exportButton: elements.exportBundle });
  const autoFixAuthorityCapability = Object.freeze({ mission: 'TWO-SURFACE-P3.1A' });
  let core = null, sourceText = '', options = null, baseArtifacts = null, editedArtifacts = null, draft = null, sourceBranches = [];
  let platformContext = null, baseDraft = null, journalService = null, recoveryStore = null, editScope = null;
  let attributeLedger = null, remarks = Object.freeze({}), selection = Object.freeze([]), projection = 'XY', tool = 'SELECT';
  let contextEdgeId = '', ghostModel = null, supportScale = 2.5, selectionFilters = new Set(EDIT_KINDS);
  let basisKey = '', busy = false, lastRegenerationMs = 0;
  const navigation = canvasRuntime.navigation();
  function persistentUiState() { return createTopologyEditUiState({ projection, tool, contextEdgeId, supportScale, selection }); }
  function applyPersistentUiState(state) { const next = normalizeTopologyEditUiState(state); ({ projection, tool, contextEdgeId, supportScale, selection } = next); syncTopologyEditUiControls(elements.root, next, canvasRuntime.setMeasurementActive); }
  function applyJournalState(state) { draft = state.draft; attributeLedger = state.attributeLedger; remarks = state.remarks; }
  async function releaseJournalAuthority() {
    const service = journalService, recovery = recoveryStore;
    journalService = null; recoveryStore = null;
    await releaseTopologyDraftAuthority(service, recovery);
  }
  function clearAcceptedEditState() {
    draft = null; editedArtifacts = null; attributeLedger = null; remarks = Object.freeze({});
    basisKey = '';
  }
  function exportPlanInput(createdAt) { return { core, built: editedArtifacts, options, context: platformContext, draft,
    commandJournal: journalService.evidence().journal, createdAt, cryptoRef: elements.root.ownerDocument.defaultView?.crypto,
    checkerEvidence: dependencies.reviewEvidence?.() ?? null, modelMode: dependencies.modeEvidence?.() ?? null,
    editScope, attributeLedger, remarks }; }
  function queueExportPlan() { if (busy || !core || !editedArtifacts || !journalService) return Promise.resolve(null); return exportPlanService.refresh(exportPlanInput(new Date().toISOString())).catch((error) => setStatus(`Export plan failed: ${error?.message || String(error)}`, 'error')); }
  function setStatus(message, status) { elements.status.textContent = message; elements.status.setAttribute('data-status', status); elements.live.textContent = message; }
  function canonical() { return editedArtifacts?.canonicalTopology ?? baseArtifacts?.canonicalTopology ?? null; }
  function commandScope(request = {}) {
    const inferred = dependencies.modeEvidence?.()?.kind === 'LARGE_SCOPED' || editScope ? TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED : TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL;
    return createTopologyScopedEditCommandScope({ canonical: canonical(), editScope,
      authorityMode: request.authorityMode ?? inferred, originKind: request.origin?.kind,
      modelWideGrant: request.modelWideGrant });
  }
  function setSelection(next, notify) { selection = Object.freeze(uniqueSelection(next).filter((row) => selectionFilters.has(row.kind))); const activeEdge = [...selection].reverse().find((row) => row.kind === 'edge'); if (activeEdge) contextEdgeId = activeEdge.id; renderInspector(); canvasRuntime.selectObjects(selection.map((row) => row.id)); syncTopologyEditCapabilityControls(elements.root, evidence()); if (notify) dependencies.onSelectionChange(selection); }
  function setExternalSelection(next) { setSelection(next, false); }
  function selectFromPointer(row, event) { if (!selectionFilters.has(row.kind)) return; setSelection(pointerSelection(canonical(), selection, row, { shiftKey: event.shiftKey, toggle: event.ctrlKey || event.metaKey }), true); }
  async function initialize(traceEvidence) {
    const artifacts = objectRecord(traceEvidence?.artifacts), source = objectRecord(artifacts.source);
    if (!source.raw) throw new Error('Load a managed source JSON before opening Edit Draft.');
    const nextBasis = `${objectRecord(traceEvidence.hashes).source}:${objectRecord(traceEvidence.hashes).canonical}`;
    if (nextBasis && nextBasis === basisKey && baseArtifacts && journalService) { render(); return; }
    busy = true; setStatus('Building immutable edit basis with the pinned topology core…', 'ready');
    try {
      const nextCore = await loadTopologyProducerCore();
      const nextSourceText = producerSourceText(source.raw), nextOptions = producerOptions(traceEvidence);
      const nextSourceBranches = Array.isArray(source.raw) ? source.raw : (source.raw.hierarchy ?? source.raw.branches ?? source.raw.objects ?? []);
      const started = performance.now();
      const nextBaseArtifacts = await nextCore.buildComponentTopologyArtifacts(nextSourceText, nextOptions);
      lastRegenerationMs = performance.now() - started;
      const createdAt = new Date().toISOString(), verticalAxis = elements.root.querySelector('[data-ttv-vertical-axis]')?.value || 'Z';
      const nextPlatformContext = await createTopologyPlatformContext({ sourceText: nextSourceText, sourceName: nextOptions.sourceName,
        sourceBranches: nextSourceBranches, verticalAxis, createdAt, cryptoRef: elements.root.ownerDocument.defaultView?.crypto });
      const loadedHash = cleanText(objectRecord(artifacts.canonical).canonicalTopologyHash);
      if (loadedHash && loadedHash !== nextBaseArtifacts.canonicalTopology.canonicalTopologyHash) throw new Error(`Loaded canonical hash ${loadedHash} does not match pinned producer hash ${nextBaseArtifacts.canonicalTopology.canonicalTopologyHash}. Rebuild topology before editing.`);
      const nextBaseDraft = nextCore.createTopologyEditDraft(nextBaseArtifacts.canonicalTopology,
        { projection: 'XY', snapToleranceMm: Number(nextOptions.toleranceMm), showOriginal: true });
      await releaseJournalAuthority(); clearAcceptedEditState();
      core = nextCore; sourceText = nextSourceText; options = nextOptions; sourceBranches = nextSourceBranches;
      baseArtifacts = nextBaseArtifacts; platformContext = nextPlatformContext; baseDraft = nextBaseDraft;
      const windowRef = elements.root.ownerDocument.defaultView;
      recoveryStore = createTopologyDraftRecovery(windowRef?.localStorage, { lockManager: windowRef?.navigator?.locks });
      await recoveryStore.acquireWriter(platformContext.document.documentId);
      journalService = createTopologyEditJournalService({ core, context: platformContext, baseDraft, recovery: recoveryStore,
        createdAt, canonicalProvider: canonical, scopeProvider: commandScope,
        reviewAuthorityProvider: () => dependencies.reviewEvidence?.() ?? null,
        autoFixCapability: autoFixAuthorityCapability });
      const recovered = journalService.restore(); if (recovered) applyPersistentUiState(recovered.uiState);
      applyJournalState(recovered?.state ?? journalService.evidence().state);
      if (draft.commands.length) editedArtifacts = await core.buildEditedComponentTopologyArtifacts(sourceText, draft, options);
      else { const materialized = core.materializeTopologyEditDraft(baseArtifacts.canonicalTopology, draft); editedArtifacts = Object.freeze({ ...baseArtifacts, editDraft: draft, editLedger: materialized.editLedger, editValidation: materialized.validation }); }
      basisKey = nextBasis; selection = recovered ? selection : Object.freeze([]); contextEdgeId = recovered ? contextEdgeId : '';
      canvasRuntime.clearMeasurement(); render();
      setStatus(recovered ? `Recovered ${recovered.commandCount} journal command(s) from the exact source basis.` : `Edit Draft ready: ${baseArtifacts.canonicalTopology.edges.length} immutable base elements; no commands applied.`, 'pass');
    } catch (error) { await releaseJournalAuthority(); clearAcceptedEditState(); throw error; }
    finally { busy = false; renderBottom(); }
  }
  function acceptanceState(acceptance) { if (!acceptance.accepted) { const error = new Error(acceptance.message); error.code = acceptance.reasonCode; throw error; } return acceptance.state; }
  function acceptBuilt(prepared, built) { const regeneration = journalService.certifyRegeneration(prepared, built); return acceptanceState(journalService.acceptPrepared(prepared, regeneration)); }
  async function executeCommand(type, payload) {
    if (busy) return; if (!core || !draft || !sourceText || !options) throw new Error('Edit Draft has not been initialized.');
    busy = true; setStatus(`${type}: regenerating canonical topology and parity evidence…`, 'ready');
    try {
      const issuedAt = new Date().toISOString(), current = journalService.currentAuthority();
      const candidate = core.appendTopologyEditCommand(draft, type, payload), started = performance.now();
      const built = await core.buildEditedComponentTopologyArtifacts(sourceText, candidate, options); lastRegenerationMs = performance.now() - started;
      const prepared = journalService.prepareNative({ expectedAuthorityId: current.authorityId,
        nativeCommand: candidate.commands.at(-1), origin: { kind: 'USER', actorId: 'LOCAL_USER', issuedAt },
        uiState: persistentUiState(), updatedAt: issuedAt, expectedDraftHash: candidate.topologyEditDraftHash });
      applyJournalState(acceptBuilt(prepared, built)); editedArtifacts = built;
      const ids = new Set([...asArray(canonical().nodes), ...asArray(canonical().edges), ...asArray(canonical().supports)].map((row) => cleanText(objectRecord(row).id)));
      selection = Object.freeze(selection.filter((row) => ids.has(row.id) || row.kind === 'issue' || row.kind === 'bend'));
      render(); dependencies.onSelectionChange(selection);
      const findings = asArray(built.editValidation.findings).length;
      setStatus(`${type} committed. ${findings} validation finding(s) documented; export remains available. Regeneration ${lastRegenerationMs.toFixed(0)} ms.`, 'pass');
    } catch (error) { setStatus(`${type} rejected: ${error?.message || String(error)}`, 'error'); throw error; }
    finally { busy = false; renderBottom(); }
  }
  async function acceptPreparedTransition(prepared, label, nextUiState = null) {
    if (!core || !sourceText || !options) throw new Error('Edit Draft has not been initialized.');
    busy = true; setStatus(`${label}: regenerating before acceptance…`, 'ready');
    try {
      const started = performance.now(), built = await core.buildEditedComponentTopologyArtifacts(sourceText, prepared.candidateReplayState.draft, options);
      lastRegenerationMs = performance.now() - started; const state = acceptBuilt(prepared, built);
      if (nextUiState) applyPersistentUiState(nextUiState); applyJournalState(state); editedArtifacts = built; render();
      setStatus(`${label} complete. Topology hash ${built.canonicalTopology.canonicalTopologyHash}.`, 'pass'); return state;
    } finally { busy = false; renderBottom(); }
  }
  async function undo() { if (!journalService?.evidence().journal.activeCommandIds.length) return; const at = new Date().toISOString(), expected = journalService.currentAuthority().authorityId; await acceptPreparedTransition(journalService.prepareUndo(persistentUiState(), at, expected), 'Undo'); }
  async function redo() { if (!journalService?.evidence().journal.redoCommandIds.length) return; const at = new Date().toISOString(), expected = journalService.currentAuthority().authorityId; await acceptPreparedTransition(journalService.prepareRedo(persistentUiState(), at, expected), 'Redo'); }
  async function applyTopologyFixSuggestions(selectedSuggestions, approvedOnly) {
    if (busy) throw new Error('Another Edit Draft transaction is in progress.'); if (!core || !draft) throw new Error('Edit Draft has not been initialized.');
    const label = approvedOnly ? 'Apply approved topology fixes' : 'Apply topology fix', issuedAt = new Date().toISOString();
    busy = true; setStatus(`${label}: validating one atomic journal transaction…`, 'ready');
    try { const result = await applyReviewedTopologyFixes({ core, draft, canonical: canonical(), selectedSuggestions, approvedOnly, sourceText, options, journalService, authorityCapability: autoFixAuthorityCapability, origin: { kind: 'AUTOFIX', actorId: 'TOPOLOGY_CHECKER', issuedAt }, uiState: persistentUiState() }); applyJournalState(result.state); editedArtifacts = result.built; render(); setStatus(`${label} complete.`, 'pass'); return evidence(); }
    finally { busy = false; renderBottom(); }
  }
  async function applyTopologyAutoFixes(request) {
    if (busy) throw new Error('Another Edit Draft transaction is in progress.'); if (!core || !draft || !baseArtifacts) throw new Error('Edit Draft has not been initialized.');
    const issuedAt = new Date().toISOString(); busy = true; setStatus('Auto fix: preflighting candidates…', 'ready');
    try { const result = await applySafeTopologyAutoFixes({ ...request, core, draft, baseCanonical: baseArtifacts.canonicalTopology, canonical: canonical(), sourceText, options, journalService, authorityCapability: autoFixAuthorityCapability, issuedAt, origin: { kind: 'AUTOFIX', actorId: 'TOPOLOGY_CHECKER', issuedAt }, uiState: persistentUiState() }); if (result.state) { applyJournalState(result.state); editedArtifacts = result.built; render(); } setStatus(`Auto fix complete: ${result.run.applied.length} applied, ${result.run.related.length} related, ${result.run.rejected.length} rejected.`, 'pass'); return result.run; }
    finally { busy = false; renderBottom(); }
  }
  function appendAttributeEditCommand(edit, origin) { if (!journalService || !baseDraft) throw new Error('Edit Draft has not been initialized.'); const state = journalService.appendAttribute(edit, origin, persistentUiState(), origin.issuedAt, { expectedAuthorityId: journalService.currentAuthority().authorityId }); applyJournalState(state); renderBottom(); return asArray(attributeLedger.edits).at(-1); }
  function setCommandRemark(targetId, value) { if (!journalService || !baseDraft) throw new Error('Edit Draft has not been initialized.'); const issuedAt = new Date().toISOString(); const state = journalService.setRemark(targetId, value, { kind: 'USER', actorId: 'LOCAL_USER', issuedAt }, persistentUiState(), issuedAt, { expectedAuthorityId: journalService.currentAuthority().authorityId }); applyJournalState(state); renderBottom(); }
  function setTool(nextTool) { if (!['SELECT', 'MOVE', 'CONNECT', 'ADD', 'SPLIT', 'MEASURE'].includes(nextTool)) throw new RangeError(`Unsupported edit tool ${nextTool}.`); tool = nextTool; elements.root.querySelectorAll('[data-ttv-edit-tool]').forEach((button) => button.classList.toggle('is-active', button.getAttribute('data-ttv-edit-tool') === tool)); canvasRuntime.setMeasurementActive(tool === 'MEASURE'); const hints = { SELECT: 'Select tool active.', MOVE: 'Move tool: drag a node (X/Y/Z locks an axis; drop on a node to merge).', CONNECT: 'Connect tool: drag from one node to another to bridge.', ADD: 'Add tool: drag from a node to place a straight element.', SPLIT: 'Break tool: click an edge to split it at the picked point.', MEASURE: 'Measure tool: click component surfaces to add polyline points; choose Select to finish.' }; setStatus(hints[tool], 'ready'); }
  function setSupportScale(nextScale) { const parsed = Number(nextScale); if (!Number.isFinite(parsed) || parsed < 0.25 || parsed > 6) throw new RangeError(`Support render scale must be between 0.25 and 6; received ${nextScale}.`); supportScale = parsed; renderCanvas(); }
  function setProjection(nextProjection) { if (!['XY', 'XZ', 'YZ'].includes(nextProjection)) throw new RangeError(`Unsupported edit projection ${nextProjection}.`); projection = nextProjection; elements.root.querySelectorAll('[data-ttv-edit-projection]').forEach((button) => button.classList.toggle('is-active', button.getAttribute('data-ttv-edit-projection') === projection)); navigation.setStandardView?.({ XY: 'top', XZ: 'front', YZ: 'side' }[projection]); }
  function syncProjectionFromView(view) { projection = { top: 'XY', bottom: 'XY', front: 'XZ', back: 'XZ', left: 'YZ', right: 'YZ' }[view] ?? projection; }
  function toggleCameraType() { const type = navigation.toggleCameraType?.() ?? 'Perspective'; const button = elements.root.querySelector('[data-ttv-edit-camera]'); if (button) button.textContent = type === 'Orthographic' ? 'Ortho' : 'Persp'; }
  function setPivotToSelection() { navigation.setPivotToSelection?.(); }
  function setSelectionFilter(kind, enabled) { if (!EDIT_KINDS.includes(kind)) throw new RangeError(`Unsupported selection filter ${kind}.`); const next = new Set(selectionFilters); if (enabled) next.add(kind); else next.delete(kind); selectionFilters = next; setSelection(selection, true); }
  function set3dVisible() {}
  function setGhostModel(model) { ghostModel = model ?? null; canvasRuntime.setGhostModel(ghostModel); }
  function setEditScope(nextScope) { editScope = nextScope?.schema === 'TopologyEditScope.v1' ? nextScope : null; if (baseArtifacts) render(); }
  function renderCanvas() { renderTopologyEditCanvas({ canvasRuntime, elements, baseArtifacts, canonical: canonical(), editScope, validation: editedArtifacts?.editValidation, selection, verticalAxis: elements.root.querySelector('[data-ttv-vertical-axis]')?.value || 'Z', supportScale, ghostModel, sourceBranches, platformDocument: platformContext?.document, callbacks: { getTool: () => tool, setTool, getSelection: () => selection, getContextEdgeId: () => contextEdgeId, setSelection, selectFromPointer, executeCommand, runOperation, undo, redo, onGestureError: (error) => setStatus(error?.message || String(error), 'error'), onHint: (message) => setStatus(message, 'ready'), onViewSelected: syncProjectionFromView, onGhostPick: (objectId) => dependencies.onGhostPick?.(objectId) }, onError: (error) => setStatus(`3D canvas failed: ${error?.message || String(error)}`, 'error') }); }
  function renderInspector() { elements.inspector.innerHTML = buildTopologyEditInspectorMarkup({ canonical: canonical(), validation: objectRecord(editedArtifacts?.editValidation), selection, contextEdgeId }); }
  function renderBottom() { if (!draft || !editedArtifacts) { elements.timeline.innerHTML = ''; elements.validation.innerHTML = ''; return; } elements.timeline.innerHTML = buildTopologyEditTimelineMarkup(draft); elements.validation.innerHTML = buildTopologyEditValidationMarkup(editedArtifacts.editValidation); const journal = journalService?.evidence().journal; elements.undo.disabled = !journal?.activeCommandIds.length || busy; elements.redo.disabled = !journal?.redoCommandIds.length || busy; syncTopologyEditCapabilityControls(elements.root, { initialized: Boolean(editedArtifacts), busy, selection, tool, canUndo: Boolean(journal?.activeCommandIds.length), canRedo: Boolean(journal?.redoCommandIds.length) }); if (busy) elements.exportBundle.disabled = true; else queueExportPlan(); dependencies.onRender?.(evidence()); }
  function renderMetrics() { elements.metrics.innerHTML = buildTopologyEditMetricsMarkup({ baseArtifacts, canonical: canonical(), draft, validation: objectRecord(editedArtifacts?.editValidation), lastRegenerationMs }); }
  function render() { renderCanvas(); renderInspector(); renderBottom(); renderMetrics(); }
  function exportSequentialMoveNodeRequest(intent) {
    if (!draft || !journalService || !platformContext?.document || !options) {
      throw new Error('Edit Draft authority is unavailable for Sequential request export.');
    }
    const request = createTopologySequentialMoveNodeRequest({
      canonical: canonical(), draft, commandAuthority: journalService.currentAuthority(),
      projectDocument: platformContext.document, nodeId: intent.nodeId,
      targetPosition: intent.targetPosition, createdAt: new Date().toISOString(),
    });
    const fileName = topologySequentialMoveNodeRequestFileName(
      request, outputStem(options.sourceName),
    );
    downloadText(elements.root.ownerDocument, fileName,
      `${JSON.stringify(request, null, 2)}\n`, 'application/json;charset=utf-8');
    setStatus(`Sequential stretch request exported for node ${request.sourceNode.nodeId}; no edit was published.`, 'pass');
    return request;
  }
  async function runOperation(operation) {
    await dispatchTopologyEditOperation({
      operation, selection, contextEdgeId, inspector: elements.inspector,
      execute: executeCommand, exportSequentialMoveNodeRequest,
    });
  }
  function saveDraft() { if (!journalService || !options) throw new Error('No edit draft is available.'); return saveTopologySessionDraft({ service: journalService, uiState: persistentUiState(), savedAt: new Date().toISOString(), documentRef: elements.root.ownerDocument, sourceName: options.sourceName }); }
  async function loadDraftFile(file) {
    if (!file) throw new TypeError('A topology edit draft file is required.');
    const parsed = JSON.parse(await file.text()), expected = journalService.currentAuthority().authorityId;
    let prepared, nextUiState = persistentUiState();
    if (parsed?.schema === TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA) {
      const snapshot = parseTopologyEditSessionDraft(JSON.stringify(parsed));
      prepared = journalService.prepareLoad(snapshot, expected); nextUiState = snapshot.uiState;
    } else if (parsed?.schema === 'TopologyEditDraft.v1') {
      const updatedAt = new Date().toISOString();
      prepared = journalService.prepareLegacyImport(parsed,
        { kind: 'LEGACY_IMPORT', actorId: 'TOPOLOGY_DRAFT_IMPORT', issuedAt: null },
        nextUiState, updatedAt, { expectedAuthorityId: expected });
    } else throw new TypeError(`${file.name} is not ${TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA} or TopologyEditDraft.v1.`);
    await acceptPreparedTransition(prepared, `Load ${file.name}`, nextUiState);
  }
  async function exportBundle() { if (busy) throw new Error('Wait for the active Edit Draft transaction to complete.'); if (!core || !draft || !options || !journalService) throw new Error('No edit draft is available.'); const commandJournal = journalService.evidence().journal; const snapshot = await exportPlanService.prepare(exportPlanInput(new Date().toISOString())); const result = await buildTopologyEditBundle({ snapshot, draft, commandJournal, cryptoRef: elements.root.ownerDocument.defaultView?.crypto }); downloadText(elements.root.ownerDocument, `${result.stem}.topology-edit-bundle.json`, `${JSON.stringify(result.bundle, null, 2)}\n`, 'application/json;charset=utf-8'); const logOutput = result.outputs.find((row) => row.name.endsWith('.topology-export-log.json')); if (logOutput) downloadText(elements.root.ownerDocument, logOutput.name, logOutput.text, logOutput.mime); setStatus(`Exported the immutable edit bundle and separate topology audit log (${result.outputs.length} documented files).`, 'pass'); }
  function setContextEdge(edgeId) { contextEdgeId = cleanText(edgeId); renderInspector(); }
  function evidence() { const journalEvidence = journalService?.evidence(); return Object.freeze({ baseArtifacts, editedArtifacts, draft, selection, projection, tool, contextEdgeId, busy, supportScale, lastRegenerationMs, projectSession: platformContext?.session ?? null, projectDocument: platformContext?.document ?? null, commandJournal: journalEvidence?.journal ?? null, commandEnvelopes: journalEvidence?.commandEnvelopes ?? Object.freeze([]), commandAuthority: journalEvidence?.authority ?? null, attributeLedger, remarks, editScope, exportPlan: exportPlanService.evidence().plan, canvas: canvasRuntime.evidence() }); }
  function destroy() { const released = releaseJournalAuthority(); clearAcceptedEditState(); navigation.destroy(); canvasRuntime.dispose(); exportPlanService.destroy(); return released; }
  return Object.freeze({ initialize, executeCommand, undo, redo, setTool, setProjection, setSelectionFilter, set3dVisible, setGhostModel, setSupportScale, setExternalSelection, runOperation, saveDraft, loadDraftFile, exportBundle, exportSequentialMoveNodeRequest, setContextEdge, applyTopologyFixSuggestions, applyTopologyAutoFixes, appendAttributeEditCommand, setCommandRemark, setEditScope, refreshExportPlan: queueExportPlan, addMeasurementPoint: canvasRuntime.addMeasurementPoint, focusSelection: () => { const row = selection.at(-1); if (row) navigation.fitObjectKey(`edit:${row.kind}:${row.id}`, true); }, fit: () => navigation.fit(), zoomIn: () => navigation.zoomIn(), zoomOut: () => navigation.zoomOut(), toggleCameraType, setPivotToSelection, render, evidence, destroy });
}
export const _test = Object.freeze({ producerSourceText, producerOptions, outputStem, uniqueSelection, shortestPathSelection, selectionForObjectId, objectForSelection, uniqueContextEdges });

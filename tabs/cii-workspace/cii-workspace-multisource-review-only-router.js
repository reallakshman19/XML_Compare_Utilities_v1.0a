import { ciiAutomaticBaseSelection } from './cii-workspace-base-loop-selection.js';
import {
  CII_MS_REVIEW_ONLY_WRITE_BLOCKER,
  createCiiMultiSourceReviewOnlyPreviewFromPreparedSession,
} from './cii-workspace-multisource-review-only.js';
import {
  ciiMultiSourceBulkAcceptOutcome,
  ciiMultiSourceReviewBySource,
  ciiMultiSourceReviewMarkup,
  ciiMultiSourceReviewSummaryMarkup,
  seedCiiMultiSourceReviewDecisions,
} from './cii-workspace-multisource-review-ui.js';
import { CII_MS_SOURCE_SET_SHA256, CII_MS_TARGET_SHA256 } from './cii-workspace-multisource-nodename-authority.js';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge, ciiSourceSetSha256, getCiiMultiSourceMethodAConfidenceOptions } from './cii-workspace-source-set.js';
import { createCiiCommonAnalysisCache } from './cii-workspace-multisource-preview.js';
import { ciiSha256 } from './cii-workspace-v11-v14-converter.js';
import { ciiSourceSetCustodyMarkup, mountCiiWriter2MultiSourceShell } from './cii-workspace-multisource-writer2-ui.js?v=20260909-ms-custody-auto-1';

const ROUTER_MODE = 'GENERIC_REVIEW_ONLY';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function selectedFiles(input) { return Array.from(input?.files || []); }
async function bytesForFile(file) { return new Uint8Array(await file.arrayBuffer()); }
function sourceSetMembersForHashes(hashes) { return hashes.map((originalSha256, index) => ({ sourceId: `S${index + 1}`, originalSha256 })); }
function threePermutations(values) {
  if (values.length !== 3) return [];
  return [[values[0], values[1], values[2]], [values[0], values[2], values[1]], [values[1], values[0], values[2]],
    [values[1], values[2], values[0]], [values[2], values[0], values[1]], [values[2], values[1], values[0]]];
}
async function retainedSourceHashSet(hashes, cryptoRef = globalThis.crypto) {
  for (const permutation of threePermutations(hashes)) if (await ciiSourceSetSha256(sourceSetMembersForHashes(permutation), cryptoRef) === CII_MS_SOURCE_SET_SHA256) return true;
  return false;
}
async function classifyMultiSourceFiles(sourceFiles, targetFile, cryptoRef = globalThis.crypto) {
  const sourceBytes = await Promise.all(sourceFiles.map(bytesForFile)); const targetBytes = await bytesForFile(targetFile);
  const sourceHashes = await Promise.all(sourceBytes.map((bytes) => ciiSha256(bytes, cryptoRef))); const targetSha256 = await ciiSha256(targetBytes, cryptoRef);
  const retained = sourceFiles.length === 3 && targetSha256 === CII_MS_TARGET_SHA256 && await retainedSourceHashSet(sourceHashes, cryptoRef);
  return Object.freeze({ retained, sourceBytes: Object.freeze(sourceBytes), targetBytes, sourceHashes: Object.freeze(sourceHashes), targetSha256 });
}
function genericSources(files, bytes) {
  return Object.freeze(files.map((file, index) => Object.freeze({ sourceId: `S${index + 1}`, fileName: file.name || `SOURCE-${index + 1}.CII`, bytes: bytes[index] })));
}
function autoAnchorState(inspection) {
  const choices = []; const baseLoopsBySource = {}; const unresolved = [];
  for (const member of inspection?.memberInspections || []) {
    const choice = ciiAutomaticBaseSelection(member?.inspection?.baseAnchorSuggestions || []); const sourceId = String(member?.sourceId || '');
    choices.push(Object.freeze({ sourceId, fileName: member?.fileName || '', ...choice }));
    if (choice.status === 'READY' && (choice.baseLoops || []).length) baseLoopsBySource[sourceId] = choice.baseLoops; else unresolved.push(sourceId);
  }
  return Object.freeze({ choices: Object.freeze(choices), baseLoopsBySource: Object.freeze(baseLoopsBySource), unresolved: Object.freeze(unresolved), ready: choices.length > 1 && unresolved.length === 0 });
}
function validManualNode(value) { const raw = String(value ?? '').trim(); const number = Number(raw); return raw && Number.isSafeInteger(number) ? String(number) : null; }
function manualRows(manualBySource, sourceId) { return [...(manualBySource?.[sourceId] || [])]; }
function baseAuthorityState(auto, manualBySource = {}) {
  const unresolved = (auto?.choices || []).filter((choice) => !(auto?.baseLoopsBySource?.[choice.sourceId] || []).length && !manualRows(manualBySource, choice.sourceId).length).map((choice) => choice.sourceId);
  return Object.freeze({ ready: (auto?.choices || []).length > 1 && unresolved.length === 0, unresolved: Object.freeze(unresolved) });
}
function manualAnchorPairsBySource(auto, manualBySource = {}) {
  return Object.freeze(Object.fromEntries((auto?.choices || []).flatMap((choice) => {
    if ((auto?.baseLoopsBySource?.[choice.sourceId] || []).length) return [];
    const pairs = manualRows(manualBySource, choice.sourceId); return pairs.length ? [[choice.sourceId, Object.freeze(pairs)]] : [];
  })));
}
function manualEditorsMarkup(state) {
  return state.auto.choices.filter((choice) => !(state.auto.baseLoopsBySource?.[choice.sourceId] || []).length).map((choice) => {
    const pairs = manualRows(state.manualBySource, choice.sourceId);
    const list = pairs.length ? `<ol>${pairs.map((pair, index) => `<li><b>${h(pair.sourceNodeId)} ↔ ${h(pair.targetNodeId)}</b> <button type="button" data-ciiw-ms-review-only-manual-remove="${index}">Remove</button></li>`).join('')}</ol>` : '<p>No reviewed manual anchor is locked.</p>';
    return `<section class="ciiw-base-set" data-ciiw-ms-review-only-manual-editor="1" data-ciiw-source-id="${h(choice.sourceId)}"><header><div><b>${h(choice.sourceId)} manual fallback</b><span>Engineer-reviewed physical-point identity</span></div><span class="ciiw-corroboration">USER LOCKED</span></header>${list}<div class="ciiw-detail-grid"><label><b>SOURCE node</b><input type="text" inputmode="numeric" data-ciiw-ms-review-only-manual-source></label><label><b>TARGET node</b><input type="text" inputmode="numeric" data-ciiw-ms-review-only-manual-target></label></div><div class="ciiw-transfer-scope-actions"><button type="button" data-ciiw-ms-review-only-manual-add>Add reviewed anchor</button>${pairs.length ? '<button type="button" data-ciiw-ms-review-only-manual-clear>Clear</button>' : ''}</div><small>Manual anchors are correspondence authority only. They cannot create BM-001 scope or Writer2 write authority.</small></section>`;
  }).join('');
}
function inspectionMarkup(state) {
  const authority = baseAuthorityState(state.auto, state.manualBySource);
  const rows = state.auto.choices.map((choice) => `<tr><td><b>${h(choice.sourceId)}</b><small>${h(choice.fileName)}</small></td><td>${h(choice.status || 'REVIEW')}</td><td>${h(choice.sourceNodeId || '—')} ↔ ${h(choice.targetNodeId || '—')}</td><td>${h(choice.confidence || '—')}</td><td>${h(choice.basisMethod || choice.reason || '—')}</td></tr>`).join('');
  const compare = authority.ready ? '<div class="ciiw-transfer-scope-actions"><button type="button" data-ciiw-ms-review-only-compare>Compare review →</button></div>' : '';
  return `${ciiSourceSetCustodyMarkup(state.inspection)}<section class="ciiw-base-set" data-ciiw-ms-review-only-inspection="1"><header><div><b>Generic multi-source review only</b><span>${h(state.sources.length)} independent SOURCE members · no Writer2 write authority</span></div><span class="ciiw-corroboration">REVIEW ONLY</span></header><p>Each source is normalized independently against the same TARGET. Deterministic READY Auto Anchor is used when available; unresolved members require an engineer-reviewed manual anchor fallback.</p><table class="ciiw-mini-grid"><thead><tr><th>Source</th><th>Auto Anchor</th><th>Base pair</th><th>Confidence</th><th>Basis</th></tr></thead><tbody>${rows}</tbody></table><p><b>${authority.ready ? 'READY FOR REVIEW' : 'REVIEW BLOCKED'}</b>${authority.unresolved.length ? ` · base authority required for ${h(authority.unresolved.join(', '))}` : ''}</p>${manualEditorsMarkup(state)}${compare}</section>`;
}
function waitingMarkup(state) {
  const authority = baseAuthorityState(state.auto, state.manualBySource);
  return `<section class="ciiw-transfer-scope" data-ciiw-ms-transfer="1" data-ciiw-ms-review-only-transfer="1"><header><div><h3>Multi-source review-only boundary</h3><p>Correspondence review is allowed; target mutation is blocked by design.</p></div><div class="ciiw-transfer-scope-status">${authority.ready ? 'READY FOR REVIEW' : 'BLOCKED'}</div></header><p><b>Writer2 blocker:</b> ${h(CII_MS_REVIEW_ONLY_WRITE_BLOCKER)}</p></section>`;
}
function transferMarkup(preview) {
  return `<section class="ciiw-transfer-scope" data-ciiw-ms-transfer="1" data-ciiw-ms-review-only-transfer="1"><header><div><h3>Multi-source review-only result</h3><p>Review/audit evidence exists, but no target mutation operation is authorized.</p></div><div class="ciiw-transfer-scope-status">REVIEW ONLY</div></header><p><b>Source-set:</b> <code>${h(preview?.sourceSetSha256 || '—')}</code><br><b>Original TARGET:</b> <code>${h(preview?.targetAuthority?.originalSha256 || '—')}</code></p><p><b>Correspondence:</b> ${h(preview?.correspondence?.status || '—')} · <b>review rows:</b> ${h(preview?.compareReview?.rows?.length || 0)} · <b>Writer2 operations:</b> 0</p><p><b>Writer2 blocker:</b> ${h(CII_MS_REVIEW_ONLY_WRITE_BLOCKER)}</p></section>`;
}
function setStatus(container, message) { const status = container.querySelector('[data-ciiw-status]'); if (status) status.textContent = message; }
function downloadPayload(documentRef, fileName, payload, type) {
  const blob = new Blob([payload], { type }); const url = URL.createObjectURL(blob); const anchor = documentRef.createElement('a');
  anchor.href = url; anchor.download = fileName; anchor.style.display = 'none'; documentRef.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }

export function mountCiiWriter2MultiSourceReviewRouter(container, options = {}) {
  const retained = mountCiiWriter2MultiSourceShell(container, options);
  const sourceInput = container.querySelector('[data-ciiw-source]'); const targetInput = container.querySelector('[data-ciiw-target]');
  const inspectButton = container.querySelector('[data-ciiw-inspect]'); const analyzeButton = container.querySelector('[data-ciiw-analyze]');
  const evidence = container.querySelector('[data-ciiw-method-evidence]') || container.querySelector('[data-ciiw-landmarks]');
  const executive = container.querySelector('[data-ciiw-executive]'); const results = container.querySelector('[data-ciiw-results]');
  const deltas = container.querySelector('[data-ciiw-deltas]'); const transfer = container.querySelector('[data-ciiw-transfer]');
  const reviewButton = container.querySelector('[data-ciiw-refresh-review]'); const acceptHigh = container.querySelector('[data-ciiw-accept-high]');
  const acceptMedium = container.querySelector('[data-ciiw-accept-medium]'); const csvButton = container.querySelector('[data-ciiw-export-csv]'); const jsonButton = container.querySelector('[data-ciiw-export-json]');
  if (!sourceInput || !targetInput || !inspectButton || !analyzeButton) return retained;

  let disposed = false; let state = null; let bypassRetainedInspect = false; let policyEpoch = 0; const reviewButtonLabel = reviewButton?.textContent || '';
  const resetReviewControls = () => {
    if (reviewButton) { reviewButton.disabled = true; reviewButton.textContent = reviewButtonLabel; }
    if (acceptHigh) acceptHigh.disabled = true; if (acceptMedium) acceptMedium.disabled = true;
  };
  const resetGeneric = () => { state = null; resetReviewControls(); if (csvButton) csvButton.disabled = true; if (jsonButton) jsonButton.disabled = true; };
  const refreshAnchorUi = (message = null) => {
    if (!state) return; state = { ...state, preview: null, reviewDecisions: new Map(), reviewDirty: false }; const authority = baseAuthorityState(state.auto, state.manualBySource);
    if (evidence) evidence.innerHTML = inspectionMarkup(state);
    if (results) results.innerHTML = `<p>${authority.ready ? 'Base authority is ready. Click Compare review for read-only correspondence review.' : `Add a reviewed manual anchor for ${h(authority.unresolved.join(', '))}. No Writer2 authority is available.`}</p>`;
    if (executive) executive.innerHTML = ''; if (deltas) deltas.innerHTML = '<p>Engineering deltas will appear after read-only Compare.</p>'; if (transfer) transfer.innerHTML = waitingMarkup(state);
    analyzeButton.disabled = !authority.ready; resetReviewControls(); if (csvButton) csvButton.disabled = true; if (jsonButton) jsonButton.disabled = true;
    setStatus(container, message || (authority.ready ? 'Generic multi-source base authority READY. REVIEW ONLY Compare is enabled.' : `Generic multi-source base authority required for ${authority.unresolved.join(', ')}.`));
  };
  const inspectGeneric = async (classified, sourceFiles, targetFile, runEpoch = policyEpoch) => {
    const sources = genericSources(sourceFiles, classified.sourceBytes); setStatus(container, `Inspecting ${sources.length} SOURCE members in REVIEW ONLY mode…`);
    const methodAConfidenceOptions = getCiiMultiSourceMethodAConfidenceOptions();
    const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({ sources, targetBytes: classified.targetBytes, targetFileName: targetFile.name || 'TARGET.CII' }, { cryptoRef: options.cryptoRef, ...methodAConfidenceOptions });
    if (disposed || runEpoch !== policyEpoch) return; const inspection = prepared.inspection; const auto = autoAnchorState(inspection);
    state = { mode: ROUTER_MODE, sources, targetFileName: targetFile.name || 'TARGET.CII', inspection, preparedSession: prepared.preparedSession,
      commonAnalysisCache: createCiiCommonAnalysisCache(), methodAConfidenceOptions, auto, manualBySource: {}, preview: null, reviewDecisions: new Map(), reviewDirty: false };
    refreshAnchorUi(auto.ready ? `Generic multi-source custody READY for ${sources.length} members. REVIEW ONLY: Compare is enabled; Writer2 Apply remains unavailable.` : `Generic multi-source custody READY. Auto Anchor is unresolved for ${auto.unresolved.join(', ')}; add reviewed manual fallback authority.`);
  };
  const previewInput = (reviewBySource = undefined) => ({
    baseLoopsBySource: state.auto.baseLoopsBySource, anchorPairsBySource: manualAnchorPairsBySource(state.auto, state.manualBySource),
    ...(reviewBySource ? { reviewBySource } : {}),
  });
  const renderGenericReview = () => {
    const preview = state?.preview; if (!preview) return;
    if (executive) executive.innerHTML = ciiMultiSourceReviewSummaryMarkup(preview, state.reviewDecisions);
    if (results) results.innerHTML = ciiMultiSourceReviewMarkup(preview, state.reviewDecisions);
    if (deltas) deltas.innerHTML = `<p><b>${h(preview.engineeringDeltas?.summary?.engineeringChangeCount || 0)}</b> engineering change rows are available for review/audit only.</p>`;
    if (transfer) transfer.innerHTML = transferMarkup(preview);
    if (reviewButton) { reviewButton.textContent = 'Bind review decisions'; reviewButton.disabled = !state.reviewDirty; }
    if (acceptHigh) acceptHigh.disabled = false; if (acceptMedium) acceptMedium.disabled = false;
    if (csvButton) csvButton.disabled = state.reviewDirty; if (jsonButton) jsonButton.disabled = state.reviewDirty;
  };
  const buildGenericPreview = async (reviewBySource = undefined) => {
    const runEpoch = policyEpoch;
    const preview = await createCiiMultiSourceReviewOnlyPreviewFromPreparedSession(state.preparedSession, previewInput(reviewBySource), {
      cryptoRef: options.cryptoRef, commonAnalysisCache: state.commonAnalysisCache, ...state.methodAConfidenceOptions,
    });
    if (disposed || runEpoch !== policyEpoch || !state) return null;
    const reviewDecisions = new Map(); seedCiiMultiSourceReviewDecisions(preview, reviewDecisions);
    state = { ...state, preview, reviewDecisions, reviewDirty: false }; renderGenericReview(); return preview;
  };
  const compareGeneric = async () => {
    const authority = state ? baseAuthorityState(state.auto, state.manualBySource) : { ready: false }; if (!authority.ready) return;
    try {
      setStatus(container, 'Building generic multi-source correspondence in REVIEW ONLY mode…'); const preview = await buildGenericPreview(); if (disposed || !preview) return;
      // The rendered Compare Review table lives in the compare panel. Keep
      // generic REVIEW_ONLY navigation in parity with the retained Writer2 path;
      // a hidden review table is not an actionable result for the engineer.
      container.querySelector('[data-ciiw-tab="compare"]')?.click();
      setStatus(container, `Generic multi-source correspondence ${preview.correspondence.status}. REVIEW ONLY: review decisions may be bound to audit; Writer2 operations 0.`);
    } catch (error) { setStatus(container, error?.message || String(error)); }
  };
  const bindGenericReview = async () => {
    if (!state?.preview || !state.reviewDirty) return;
    try {
      const reviewBySource = ciiMultiSourceReviewBySource(state.preview, state.reviewDecisions);
      setStatus(container, 'Binding generic correspondence decisions to REVIEW ONLY audit…'); const preview = await buildGenericPreview(reviewBySource); if (disposed || !preview) return;
      setStatus(container, `Generic multi-source review bound to audit. Correspondence ${preview.correspondence.status}; Writer2 operations 0; write authority remains blocked.`);
    } catch (error) { setStatus(container, error?.message || String(error)); }
  };
  const markReviewDirty = (message) => { state = { ...state, reviewDirty: true }; renderGenericReview(); setStatus(container, message); };
  const routeInspect = async () => {
    const runEpoch = policyEpoch;
    const sourceFiles = selectedFiles(sourceInput); const targetFile = selectedFiles(targetInput)[0]; if (!targetFile) { setStatus(container, 'TARGET CII file is required.'); return; }
    try {
      setStatus(container, 'Classifying multi-source custody…'); const classified = await classifyMultiSourceFiles(sourceFiles, targetFile, options.cryptoRef); if (disposed || runEpoch !== policyEpoch) return;
      if (classified.retained) { state = null; bypassRetainedInspect = true; inspectButton.click(); return; } await inspectGeneric(classified, sourceFiles, targetFile, runEpoch);
    } catch (error) { setStatus(container, error?.message || String(error)); }
  };
  const mutateManual = (target) => {
    const section = target.closest('[data-ciiw-ms-review-only-manual-editor]'); const sourceId = section?.dataset?.ciiwSourceId; if (!section || !sourceId || !state) return false;
    const pairs = manualRows(state.manualBySource, sourceId);
    if (target.matches('[data-ciiw-ms-review-only-manual-add]')) {
      const sourceNodeId = validManualNode(section.querySelector('[data-ciiw-ms-review-only-manual-source]')?.value); const targetNodeId = validManualNode(section.querySelector('[data-ciiw-ms-review-only-manual-target]')?.value);
      if (!sourceNodeId || !targetNodeId) { setStatus(container, `${sourceId}: enter integer SOURCE and TARGET node IDs before adding the reviewed anchor.`); return true; }
      const key = `${sourceNodeId}=>${targetNodeId}`; if (!pairs.some((pair) => `${pair.sourceNodeId}=>${pair.targetNodeId}` === key)) pairs.push({ sourceNodeId, targetNodeId });
      state = { ...state, manualBySource: { ...state.manualBySource, [sourceId]: pairs } }; refreshAnchorUi(`${sourceId}: reviewed manual anchor ${sourceNodeId} ↔ ${targetNodeId} locked for REVIEW ONLY correspondence.`); return true;
    }
    if (target.matches('[data-ciiw-ms-review-only-manual-remove]')) { pairs.splice(Number(target.dataset.ciiwMsReviewOnlyManualRemove), 1); state = { ...state, manualBySource: { ...state.manualBySource, [sourceId]: pairs } }; refreshAnchorUi(`${sourceId}: manual anchor removed.`); return true; }
    if (target.matches('[data-ciiw-ms-review-only-manual-clear]')) { state = { ...state, manualBySource: { ...state.manualBySource, [sourceId]: [] } }; refreshAnchorUi(`${sourceId}: manual anchors cleared.`); return true; } return false;
  };
  const onClickCapture = (event) => {
    const target = event.target?.closest?.('button,select,a'); if (!target) return;
    if (target === inspectButton && selectedFiles(sourceInput).length >= 2) { if (bypassRetainedInspect) { bypassRetainedInspect = false; return; } stop(event); void routeInspect(); return; }
    if (state?.mode !== ROUTER_MODE) return;
    if (target.matches('[data-ciiw-ms-review-only-manual-add],[data-ciiw-ms-review-only-manual-remove],[data-ciiw-ms-review-only-manual-clear]')) { stop(event); mutateManual(target); return; }
    if (target === analyzeButton || target.matches('[data-ciiw-ms-compare-now],[data-ciiw-ms-review-only-compare]')) { stop(event); void compareGeneric(); return; }
    if (target === acceptHigh || target === acceptMedium) {
      stop(event); if (!state.preview) return; const confidence = target === acceptHigh ? 'HIGH' : 'MEDIUM'; const outcome = ciiMultiSourceBulkAcceptOutcome(state.preview, state.reviewDecisions, confidence);
      if (outcome.changed) markReviewDirty(`${outcome.message.replace('Apply approvals to Transfer Preview.', 'Bind review decisions to audit.')}`); else setStatus(container, outcome.message); return;
    }
    if (target === reviewButton) { stop(event); void bindGenericReview(); return; }
    if (target === csvButton && state.preview && !state.reviewDirty) { stop(event); downloadPayload(container.ownerDocument, 'cii-multisource-review-only-correspondence.csv', state.preview.artifacts.correspondenceCsv, 'text/csv'); return; }
    if (target === jsonButton && state.preview && !state.reviewDirty) { stop(event); downloadPayload(container.ownerDocument, 'cii-multisource-review-only-audit.json', state.preview.artifacts.auditJson, 'application/json'); return; }
    if (target.matches('[data-ciiw-ms-bind-expected],[data-ciiw-ms-apply]')) { stop(event); setStatus(container, `REVIEW ONLY: ${CII_MS_REVIEW_ONLY_WRITE_BLOCKER}. Exact retained BM-001 custody is required for Writer2 transfer.`); }
  };
  const onChangeCapture = (event) => {
    if (state?.mode === ROUTER_MODE && state.preview && event.target?.matches?.('[data-ciiw-ms-decision]')) {
      event.stopImmediatePropagation(); const id = event.target.dataset.ciiwMsDecision; const decision = event.target.value;
      if (decision) state.reviewDecisions.set(id, decision); else state.reviewDecisions.delete(id);
      markReviewDirty('Generic correspondence decision changed. Bind review decisions to audit before exporting.'); return;
    }
    if (event.target !== sourceInput && event.target !== targetInput) return; resetGeneric(); queueMicrotask(() => {
      const count = selectedFiles(sourceInput).length; if (disposed || count < 2 || count === 3) return;
      setStatus(container, `${count} SOURCE files selected. Inspect opens REVIEW ONLY because exact retained Writer2 write custody requires three members.`);
    });
  };
  const onConfidencePolicyChange = () => {
    policyEpoch += 1;
    if (state?.mode !== ROUTER_MODE) return;
    resetGeneric();
    if (evidence) evidence.innerHTML = '';
    if (results) results.innerHTML = '<p>Method A policy changed. Run Inspect again before comparing or exporting.</p>';
    if (executive) executive.innerHTML = '';
    if (deltas) deltas.innerHTML = '';
    if (transfer) transfer.innerHTML = '';
    if (analyzeButton) analyzeButton.disabled = true;
    setStatus(container, 'Confidence policy changed; generic review and old approval evidence invalidated. Run Inspect.');
  };
  container.addEventListener('ciiw-method-a-confidence-changed', onConfidencePolicyChange);
  container.addEventListener('click', onClickCapture, true); container.addEventListener('change', onChangeCapture, true);
  const retainedDestroy = retained?.destroy?.bind(retained);
  return { ...retained, destroy() { disposed = true; container.removeEventListener('ciiw-method-a-confidence-changed', onConfidencePolicyChange); container.removeEventListener('click', onClickCapture, true); container.removeEventListener('change', onChangeCapture, true); resetGeneric(); retainedDestroy?.(); } };
}

export const _test = Object.freeze({ selectedFiles, sourceSetMembersForHashes, threePermutations, retainedSourceHashSet, classifyMultiSourceFiles,
  genericSources, autoAnchorState, validManualNode, baseAuthorityState, manualAnchorPairsBySource, manualEditorsMarkup, inspectionMarkup, waitingMarkup, transferMarkup });

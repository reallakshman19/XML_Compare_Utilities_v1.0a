import { mountCiiWorkspaceScopedEngineeringShell } from './cii-workspace-transfer-scope-ui.js';
import { baseAnchorEvidenceMarkup } from './cii-workspace-engineering-ui.js';
import { ciiMultiSourceAnchorLedgerMarkup } from './cii-workspace-multisource-anchor-ledger-ui.js';
import {buildCiiMultiSourceActiveAuthorityPlan} from './cii-workspace-multisource-anchor-mode.js';
import {CII_A217_DEFAULT_DRAFT,renderCiiGeometryDiscrepancyReviewPanel} from './cii-workspace-geometry-discrepancy-ui.js';
import {
  buildCiiSelectedBaseLoops,
  ciiAutomaticBaseSelection,
  ciiQualifiedLoopsForSuggestion,
  ciiSuggestionSelectionKey,
} from './cii-workspace-base-loop-selection.js';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge, getCiiMultiSourceMethodAConfidenceOptions } from './cii-workspace-source-set.js';
import { createCiiCommonAnalysisCache, createCiiWriter2SourceSetPreviewFromPreparedSession } from './cii-workspace-multisource-preview.js';
import { createCiiExpectedNodeNameSourceSetSelection } from './cii-workspace-multisource-scope.js';
import { CII_MS_TARGET_SHA256 } from './cii-workspace-multisource-nodename-authority.js';
import {
  ciiBm001CorrespondenceCoverage,
  ciiCanonicalWriter2MutationSelection,
} from './cii-workspace-multisource-bm001-correspondence.js';
import { bindCiiTransferScopeToPreview } from './cii-workspace-transfer-scope.js';
import { applyCiiWorkspaceTargetWriter2WithVersionBridge } from './cii-workspace-writer-version-bridge.js';
import { ciiSha256 } from './cii-workspace-v11-v14-converter.js';
import {
  ciiMultiSourceBulkAcceptOutcome,
  ciiMultiSourceLockedReviewCount,
  ciiMultiSourceReviewBySource,
  ciiMultiSourceReviewMarkup,
  ciiMultiSourceReviewState,
  ciiMultiSourceReviewSummaryMarkup,
  seedCiiMultiSourceReviewDecisions,
} from './cii-workspace-multisource-review-ui.js';
import {
  ciiWriter2SessionCustody,
  ciiWriter2SessionPolicyMatches,
  ciiWriter2SessionStorage,
  createCiiWriter2SessionSnapshot,
  loadCiiWriter2Session,
  restoreCiiWriter2AnchorSession,
  restoreCiiWriter2ReviewDecisions,
  saveCiiWriter2Session,
} from './cii-workspace-multisource-session-persistence.js';

const CII_MS_SOURCE_SHA_TO_ID = Object.freeze({
  '9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b': 'S1',
  '7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd': 'S2',
  'c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa': 'S3',
});
const CII_MS_CANONICAL_SOURCE_IDS = Object.freeze(['S1', 'S2', 'S3']);

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function selectedFiles(input) { return [...(input?.files || [])]; }
function sourceRows(files) { return files.map((file, index) => ({ sourceId: `S${index + 1}`, fileName: file.name, file })); }
function canonicalSourceIdForSha256(value) { return CII_MS_SOURCE_SHA_TO_ID[String(value || '').toLowerCase()] || null; }
async function sourceInputs(files, cryptoRef = globalThis.crypto) {
  const byId = new Map();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await ciiSha256(bytes, cryptoRef);
    const sourceId = canonicalSourceIdForSha256(sha256);
    if (!sourceId) throw new Error(`Unrecognized SOURCE file ${file.name}. This retained Writer2 route requires the exact S1/S2/S3 files.`);
    if (byId.has(sourceId)) throw new Error(`Duplicate retained SOURCE identity ${sourceId}. Select S1, S2 and S3 exactly once.`);
    byId.set(sourceId, { sourceId, fileName: file.name, bytes, originalSha256: sha256 });
  }
  const missing = CII_MS_CANONICAL_SOURCE_IDS.filter((id) => !byId.has(id));
  if (missing.length || byId.size !== CII_MS_CANONICAL_SOURCE_IDS.length) {
    throw new Error(`Writer2 multi-source requires exact S1/S2/S3 custody. Missing: ${missing.join(', ') || 'none'}.`);
  }
  return CII_MS_CANONICAL_SOURCE_IDS.map((id) => byId.get(id));
}
async function retainedTargetInput(file, cryptoRef = globalThis.crypto) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await ciiSha256(bytes, cryptoRef);
  if (sha256 !== CII_MS_TARGET_SHA256) {
    throw new Error(`Unrecognized TARGET file ${file.name}. This retained Writer2 route requires the exact retained T.CII target.`);
  }
  return Object.freeze({ fileName: file.name, bytes, originalSha256: sha256 });
}
function shortSha(value) {
  const text = String(value || '');
  return text.length > 20 ? `${text.slice(0, 12)}…${text.slice(-8)}` : text || '—';
}
function binaryBytes(value) {
  const raw = String(value ?? ''); const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index) & 0xff;
  return bytes;
}
function downloadPayload(documentRef, name, payload, type) {
  const url = URL.createObjectURL(new Blob([payload], { type }));
  const link = documentRef.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function downloadApplied(documentRef, applied) {
  if (applied?.versionBridgeValidation?.status !== 'PASS' || typeof applied?.byteString !== 'string') {
    throw new Error('CII_MS_WRITER2_VERSION_BRIDGE_OUTPUT_REQUIRED');
  }
  downloadPayload(documentRef, applied.fileName, binaryBytes(applied.byteString), 'text/plain');
}
function writer2PersistenceStorage(container, options = {}) {
  if (options.sessionPersistence === false) return null;
  if (options.sessionStorage) return options.sessionStorage;
  return ciiWriter2SessionStorage(container?.ownerDocument?.defaultView || globalThis);
}
export function ciiSourceSetCustodyMarkup(inspection) {
  const sourceSet = inspection?.sourceSet; const rows = sourceSet?.members || [];
  if (!sourceSet || !rows.length) return '<div class="ciiw-method-empty"><b>Source-set custody unavailable.</b></div>';
  return `<section class="ciiw-base-set" data-ciiw-source-set-custody="1"><header><div><b>Writer 2 multi-source custody</b><span>${h(rows.length)} independent SOURCE members</span></div><span class="ciiw-corroboration">SOURCE SET</span></header><p><b>Source-set SHA-256:</b> <code>${h(sourceSet.sourceSetSha256)}</code></p><table class="ciiw-mini-grid"><thead><tr><th>ID</th><th>File</th><th>Version</th><th>Original SHA</th><th>Normalized SHA</th></tr></thead><tbody>${rows.map((row) => `<tr><td><b>${h(row.sourceId)}</b></td><td>${h(row.fileName)}</td><td>${h(row.originalVersion)} → ${h(row.normalizedVersion)}</td><td><code>${h(shortSha(row.originalSha256))}</code></td><td><code>${h(shortSha(row.normalizedSha256))}</code></td></tr>`).join('')}</tbody></table><p><b>TARGET original SHA:</b> <code>${h(inspection.versionBridge?.target?.originalSha256 || '—')}</code></p></section>`;
}
function setManualDisabled(container, disabled) {
  const source = container.querySelector('[data-ciiw-source-anchors]'); const target = container.querySelector('[data-ciiw-target-anchors]');
  if (source) source.disabled = disabled; if (target) target.disabled = disabled;
}
function setMultiSourceStatus(container, message) {
  const status = container.querySelector('[data-ciiw-status]'); if (status) status.textContent = message;
}
function multiSource(container) { return selectedFiles(container.querySelector('[data-ciiw-source]')).length > 1; }
function manualRows(manualBySource, sourceId) { return [...(manualBySource.get(sourceId) || [])]; }
function manualDraft(manualDraftBySource, sourceId) {
  return manualDraftBySource.get(sourceId) || { sourceNodeId: '', targetNodeId: '' };
}
function manualAnchorMarkup(item, manualBySource, manualDraftBySource, activeMode = 'AUTO', automaticCount = 0) {
  const pairs = manualRows(manualBySource, item.sourceId); const draft = manualDraft(manualDraftBySource, item.sourceId);
  const pairList = pairs.length
    ? `<ol class="ciiw-ms-manual-list">${pairs.map((pair, index) => `<li><b>${h(pair.sourceNodeId)} ↔ ${h(pair.targetNodeId)}</b><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-manual-remove="${index}">Remove</button></li>`).join('')}</ol>`
    : '<p>No reviewed manual anchor is locked for this SOURCE.</p>';
  return `<section class="ciiw-base-set" data-ciiw-ms-manual-editor="1"><header><div><b>Manual / reviewed anchor fallback</b><span>${h(pairs.length)} locked pair${pairs.length === 1 ? '' : 's'}</span></div><span class="ciiw-corroboration">USER LOCKED</span>${pairs.length ? '<button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-manual-clear>Clear manual anchors</button>' : ''}</header><p>Use this when Method A/B cannot qualify a base. Enter nodes that you have reviewed as the same physical point. Manual claims and qualified automatic bases are retained separately. Only the ACTIVE mode enters the existing Compare engine; retained evidence never becomes physical certification.</p>${pairList}${automaticCount && pairs.length ? `<p>ACTIVE: ${h(activeMode)} · ${h(automaticCount)} automatic loop(s) and ${h(pairs.length)} manual pair(s) retained. The inactive lane is evidence-only, never Writer authority.</p><button type="button" class="ciiw-ms-inline-action" data-ciiw-ms-authority-switch="${activeMode === 'AUTO' ? 'MANUAL' : 'AUTO'}">Use ${activeMode === 'AUTO' ? 'reviewed manual anchors' : 'retained automatic bases'}</button>` : ''}<div class="ciiw-detail-grid"><label><b>SOURCE node</b><input type="text" inputmode="numeric" data-ciiw-ms-manual-source value="${h(draft.sourceNodeId)}" placeholder="e.g. 1360"></label><label><b>TARGET node</b><input type="text" inputmode="numeric" data-ciiw-ms-manual-target value="${h(draft.targetNodeId)}" placeholder="reviewed target node"></label></div><div class="ciiw-transfer-scope-actions"><button type="button" data-ciiw-ms-manual-add>Add reviewed anchor</button></div><small>Tip: clicking “Use manual anchor” above only prefills these fields. Edit either node before adding if the review-only suggestion is not the physical point you intend to lock.</small></section>`;
}
function renderMemberAnchors(inspection, selectedBySource, manualBySource = new Map(), manualDraftBySource = new Map(), modeBySource = new Map()) {
  const members = inspection?.memberInspections || [];
  const ledger = ciiMultiSourceAnchorLedgerMarkup(inspection, selectedBySource, manualBySource, modeBySource);
  const effective = buildCiiMultiSourceActiveAuthorityPlan(inspection, selectedBySource, manualBySource, modeBySource);
  return `${ciiSourceSetCustodyMarkup(inspection)}${ledger}<div data-ciiw-geometry-review-host="1"></div>${members.map((item) => {
    const selected = selectedBySource.get(item.sourceId) || new Set();
    const authority = effective.rows.find((row) => row.sourceId === item.sourceId);
    const warning = authority?.contradictoryManualPairs.length
      ? `<p data-ciiw-ms-authority-conflict="1"><b>Evidence disagreement — not a certified match.</b> ${authority.contradictoryManualPairs.map((pair) =>
        `${h(pair.sourceNodeId)}: manual ${h(pair.manualTargetNodeId)}, automatic ${h(pair.automaticTargetNodeIds.join(', '))}`).join('; ')}. Only ${h(authority.activeMode)} is routed to Compare.</p>`
      : '';
    return `<section class="ciiw-method-evidence" data-ciiw-ms-member="${h(item.sourceId)}"><h3>${h(item.sourceId)} · ${h(item.fileName)}</h3>${warning}${baseAnchorEvidenceMarkup(item.inspection, selected)}${manualAnchorMarkup(item, manualBySource, manualDraftBySource, authority?.activeMode || 'AUTO', authority?.retainedAutomaticBaseLoopCount || 0)}</section>`;
  }).join('')}`;
}
function selectedBaseLoopsBySource(inspection, selectedBySource) {
  const rows = [];
  for (const item of inspection?.memberInspections || []) {
    const loops = buildCiiSelectedBaseLoops(item.inspection?.baseAnchorSuggestions || [], selectedBySource.get(item.sourceId) || new Set());
    if (loops.length) rows.push([item.sourceId, loops]);
  }
  return Object.fromEntries(rows);
}
function manualAnchorPairsBySource(inspection, manualBySource) {
  const rows = [];
  for (const item of inspection?.memberInspections || []) {
    const pairs = manualRows(manualBySource, item.sourceId);
    if (pairs.length) rows.push([item.sourceId, pairs]);
  }
  return Object.fromEntries(rows);
}
function allMembersHaveBase(inspection, selectedBySource, manualBySource = new Map(), modeBySource = new Map()) {
  return buildCiiMultiSourceActiveAuthorityPlan(inspection, selectedBySource, manualBySource, modeBySource).ready;
}
function buildAutomaticBaseSeed(inspection) {
  const choicesBySource = {}; const selectionKeysBySource = {}; const readySourceIds = []; const unresolvedSourceIds = [];
  for (const item of inspection?.memberInspections || []) {
    const sourceId = String(item?.sourceId || '').trim(); if (!sourceId) continue;
    const choice = ciiAutomaticBaseSelection(item.inspection?.baseAnchorSuggestions || []);
    choicesBySource[sourceId] = choice;
    const selectionKeys = choice.status === 'READY' ? [...(choice.selectionKeys || [])] : [];
    selectionKeysBySource[sourceId] = Object.freeze(selectionKeys);
    if (selectionKeys.length) readySourceIds.push(sourceId); else unresolvedSourceIds.push(sourceId);
  }
  return Object.freeze({
    choicesBySource: Object.freeze(choicesBySource),
    selectionKeysBySource: Object.freeze(selectionKeysBySource),
    readySourceIds: Object.freeze(readySourceIds),
    unresolvedSourceIds: Object.freeze(unresolvedSourceIds),
  });
}
function validManualNode(value) {
  const text = String(value ?? '').trim(); const number = Number(text);
  return text && Number.isSafeInteger(number) ? String(number) : null;
}
function reviewConfidenceCount(preview, confidence) {
  return (preview?.compareReview?.rows || []).filter((row) => row?.confidence === confidence).length;
}
function buildAutomaticReview(preview) {
  return Object.fromEntries((preview?.memberPreviews || []).map(({ sourceId, preview: member }) => {
    const rows = member?.compareReview?.rows || [];
    return [sourceId, {
      reviewedCorrespondenceIds: rows.filter((row) => row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence)).map((row) => row.correspondenceId),
      lockedCorrespondenceIds: rows.filter((row) => row.decision === 'LOCKED').map((row) => row.correspondenceId),
      rejectedCorrespondenceIds: [],
    }];
  }));
}
function nodeNameChangeRows(preview) {
  return (preview?.engineeringDeltas?.changedRows || []).filter((row) => row.category === 'NODE_NAME' && row.property === 'Node name / to-name');
}
function nodeNameChangesMarkup(preview) {
  const rows = nodeNameChangeRows(preview); const operations = new Map((preview?.transferPlan?.operations || [])
    .filter((operation) => operation?.engineeringDeltaId).map((operation) => [operation.engineeringDeltaId, operation]));
  if (!rows.length) return '<p>No qualified multi-source Node Name changes are currently available.</p>';
  return `<table class="ciiw-grid"><thead><tr><th>Source</th><th>Correspondence</th><th>SOURCE candidate</th><th>Current TARGET</th><th>Writer2</th><th>BM-001 correspondence</th></tr></thead><tbody>${rows.map((row) => {
    const operation = operations.get(row.deltaId); const acceptance = operation?.bm001Acceptance;
    return `<tr><td><b>${h(row.sourceId)}</b></td><td>${h(row.sourceIdentity)} → ${h(row.targetIdentity)}</td><td>${h(row.sourceValue || '—')}</td><td>${h(row.targetValue || '—')}</td><td>${h(operation?.action || '—')}<small>${h(operation?.status || '—')}</small></td><td>${acceptance?.status === 'BOUND' ? `<b>BOUND</b><small>${h(acceptance.groupedKey)}</small>` : '—'}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function transferMutationSummary(raw, scoped = null) {
  const candidates = [...(raw?.transferPlan?.operations || []), ...(raw?.transferPlan?.excludedOperations || [])];
  const canonical = ciiCanonicalWriter2MutationSelection(candidates);
  const correspondence = scoped?.writerReadiness?.bm001CorrespondenceCoverage
    || ciiBm001CorrespondenceCoverage(raw?.transferPlan || {});
  const boundApplyCount = scoped?.transferPlan?.transferScope?.status === 'BOUND'
    ? Number(scoped.transferPlan.transferScope.appliedOperationCount || 0) : null;
  return Object.freeze({
    physicalCandidateCount: canonical.appliedOperationIds.length,
    duplicateCorroborationCount: canonical.duplicateOperationIds.length,
    applyCount: boundApplyCount,
    correspondence,
  });
}
function transferMarkup(raw, scoped, reviewDirty = false) {
  const view = scoped || raw; const plan = view?.transferPlan; if (!plan) return '';
  const scope = plan.transferScope; const summary = transferMutationSummary(raw, scoped);
  const ready = !reviewDirty && scope?.status === 'BOUND' && view?.writerReadiness?.ready === true;
  const excluded = plan.excludedOperations?.length || 0;
  const coverage = `${summary.correspondence.matchedRowCount}/${summary.correspondence.expectedRowCount}`;
  const applyText = summary.applyCount == null ? 'unbound' : String(summary.applyCount);
  return `<section class="ciiw-transfer-scope" data-ciiw-ms-transfer="1"><header><div><h3>Multi-source Writer2 exact scope</h3><p>BM-001 proves reviewed source↔target correspondence. Writer2 CREATE/DELETE eligibility is derived separately from exact physical target cardinality. Identical corroborating writes collapse to one APPLY; different dotted siblings remain conflicts.</p></div><div class="ciiw-transfer-scope-status">${h(scope?.status || 'UNBOUND')}</div></header><p><b>Source-set:</b> <code>${h(raw.sourceSetSha256)}</code><br><b>Original TARGET:</b> <code>${h(raw.targetAuthority?.originalSha256 || '—')}</code></p><p><b>BM-001 correspondence:</b> ${h(coverage)} rows · <b>physical Writer2 candidates:</b> ${h(summary.physicalCandidateCount)} · <b>duplicate corroborations:</b> ${h(summary.duplicateCorroborationCount)} · <b>APPLY:</b> ${h(applyText)} · <b>EXCLUDE:</b> ${h(excluded)}</p>${reviewDirty ? '<p><b>Correspondence review changed.</b> Apply approvals to Transfer Preview before binding Writer2 scope.</p>' : ''}<div class="ciiw-transfer-scope-actions"><button type="button" data-ciiw-ms-bind-expected ${!reviewDirty && raw.transferPlan?.status === 'PREVIEW_READY' ? '' : 'disabled'}>Bind BM-correspondence-qualified Node Name changes</button><button type="button" data-ciiw-ms-apply ${ready ? '' : 'disabled'}>Apply scoped Writer2 to TARGET copy</button></div>${scope?.scopeId ? `<small>Scope ID: ${h(scope.scopeId)}</small>` : ''}${view?.writerReadiness?.blockers?.length ? `<p><b>Writer blockers:</b> ${h(view.writerReadiness.blockers.join(' · '))}</p>` : ''}</section>`;
}
function switchTab(container, name) { container.querySelector(`[data-ciiw-tab="${name}"]`)?.click(); }

export function mountCiiWriter2MultiSourceShell(container, options = {}) {
  const legacy = mountCiiWorkspaceScopedEngineeringShell(container, options);
  const sourceInput = container.querySelector('[data-ciiw-source]'); const targetInput = container.querySelector('[data-ciiw-target]');
  const inspectButton = container.querySelector('[data-ciiw-inspect]'); const analyzeButton = container.querySelector('[data-ciiw-analyze]');
  const evidence = container.querySelector('[data-ciiw-method-evidence]') || container.querySelector('[data-ciiw-landmarks]');
  const results = container.querySelector('[data-ciiw-results]'); const transfer = container.querySelector('[data-ciiw-transfer]');
  const executive = container.querySelector('[data-ciiw-executive]'); const deltas = container.querySelector('[data-ciiw-deltas]');
  const reviewButton = container.querySelector('[data-ciiw-refresh-review]'); const acceptHigh = container.querySelector('[data-ciiw-accept-high]');
  const acceptMedium = container.querySelector('[data-ciiw-accept-medium]'); const confidenceFilter = container.querySelector('[data-ciiw-confidence-filter]');
  const searchInput = container.querySelector('[data-ciiw-search]'); const changedOnly = container.querySelector('[data-ciiw-changed-only]');
  const csvButton = container.querySelector('[data-ciiw-export-csv]'); const jsonButton = container.querySelector('[data-ciiw-export-json]');
  if (!sourceInput || !targetInput || !inspectButton || !analyzeButton) return legacy;
  sourceInput.multiple = true;
  const persistenceStorage = writer2PersistenceStorage(container, options);
  let disposed = false; let inspection = null; let preparedSession = null; let commonAnalysisCache = null;
  const geometryReviewState = {draft:{...CII_A217_DEFAULT_DRAFT},receipt:null};
  let cachedSources = null; let cachedTargetBytes = null; let cachedTargetName = null;
  let activeMethodAConfidenceOptions = getCiiMultiSourceMethodAConfidenceOptions();
  let confidenceEpoch = 0;
  let preview = null; let scopedPreview = null; let reviewDirty = false;
  let sessionCustody = null; let loadedSession = null; let reviewRestoreAllowed = false; let restoredScopeIntent = null;
  const selectedBySource = new Map(); const manualBySource = new Map(); const manualDraftBySource = new Map(); const authorityModeBySource = new Map(); const reviewDecisions = new Map();
  const reviewFilters = { confidence: 'ALL', search: '', changedOnly: false };

  const syncFilterControls = () => {
    if (confidenceFilter) confidenceFilter.value = reviewFilters.confidence || 'ALL';
    if (searchInput) searchInput.value = reviewFilters.search || '';
    if (changedOnly) changedOnly.checked = Boolean(reviewFilters.changedOnly);
  };
  const sessionScopeIntent = () => scopedPreview?.transferPlan?.transferScope?.status === 'BOUND' ? 'BOUND_EXPECTED_NODENAME' : null;
  const persistSession = ({ invalidateReview = false } = {}) => {
    if (!sessionCustody || !persistenceStorage) return false;
    let correspondenceIdentity = ''; let decisions = {}; let scopeIntent = null;
    if (!invalidateReview && preview) {
      correspondenceIdentity = String(preview?.correspondence?.correspondenceIdentity || '');
      decisions = reviewDecisions;
      scopeIntent = sessionScopeIntent();
    } else if (!invalidateReview && loadedSession) {
      correspondenceIdentity = String(loadedSession?.review?.correspondenceIdentity || '');
      decisions = loadedSession?.review?.decisions || {};
      scopeIntent = loadedSession?.scopeIntent || null;
    }
    const snapshot = createCiiWriter2SessionSnapshot({
      sourceSetSha256: sessionCustody.sourceSetSha256,
      targetOriginalSha256: sessionCustody.targetOriginalSha256,
      selectedBySource, manualBySource, manualDraftBySource, authorityModeBySource,
      reviewFilters, scopeIntent, correspondenceIdentity, reviewDecisions: decisions,
      confidencePolicy: activeMethodAConfidenceOptions,
    });
    if (!snapshot) return false;
    const saved = saveCiiWriter2Session(persistenceStorage, sessionCustody.storageKey, snapshot);
    if (saved) loadedSession = snapshot;
    return saved;
  };
  const invalidatePersistedReview = () => {
    // Any authority/evidence change invalidates both displayed and saved review.
    // In-flight compare/inspect from the previous authority epoch must not land.
    confidenceEpoch += 1;
    preview = null; scopedPreview = null; reviewDirty = false;
    reviewDecisions.clear(); commonAnalysisCache = createCiiCommonAnalysisCache();
    reviewRestoreAllowed = false; restoredScopeIntent = null;
    if (executive) executive.innerHTML = '';
    if (results) results.innerHTML = '<p>Anchor authority changed. Compare models again before reviewing or applying any transfer.</p>';
    if (deltas) deltas.innerHTML = '';
    if (transfer) transfer.innerHTML = '<p>Previous transfer scope invalidated. Compare models again.</p>';
    if (reviewButton) reviewButton.disabled = true;
    if (csvButton) csvButton.disabled = true;
    if (jsonButton) jsonButton.disabled = true;
    persistSession({ invalidateReview: true });
  };
  const activeAnchorPlan = () => buildCiiMultiSourceActiveAuthorityPlan(inspection, selectedBySource, manualBySource, authorityModeBySource);
  const authorityReady = () => activeAnchorPlan().ready;
  const refreshAnchorEvidence = () => {
    if (evidence && inspection) {
      evidence.innerHTML = renderMemberAnchors(inspection, selectedBySource, manualBySource, manualDraftBySource, authorityModeBySource);
      if (preparedSession) renderCiiGeometryDiscrepancyReviewPanel(evidence.querySelector('[data-ciiw-geometry-review-host]'),preparedSession,geometryReviewState);
      bindAnchorActions();
    }
    analyzeButton.disabled = !authorityReady();
  };
  const renderTransfer = () => {
    if (transfer && preview) { transfer.innerHTML = transferMarkup(preview, scopedPreview, reviewDirty); bindTransferActions(); }
  };
  const renderMultiReview = () => {
    if (!preview) return;
    if (executive) executive.innerHTML = ciiMultiSourceReviewSummaryMarkup(preview, reviewDecisions);
    if (results) results.innerHTML = ciiMultiSourceReviewMarkup(preview, reviewDecisions, reviewFilters);
    if (deltas) deltas.innerHTML = nodeNameChangesMarkup(preview);
    if (reviewButton) reviewButton.disabled = !(preview?.compareReview?.rows || []).length;
    if (csvButton) csvButton.disabled = false; if (jsonButton) jsonButton.disabled = false;
    syncFilterControls();
  };
  const markReviewDirty = (message) => {
    reviewDirty = true; scopedPreview = null; restoredScopeIntent = null; renderMultiReview(); renderTransfer(); persistSession(); setMultiSourceStatus(container, message);
  };
  const resetMulti = () => {
    Object.assign(geometryReviewState.draft,CII_A217_DEFAULT_DRAFT);
    geometryReviewState.receipt=null;
    if(evidence)evidence.innerHTML='';
    inspection = null; preparedSession = null; commonAnalysisCache = null;
    cachedSources = null; cachedTargetBytes = null; cachedTargetName = null; preview = null; scopedPreview = null; reviewDirty = false;
    sessionCustody = null; loadedSession = null; reviewRestoreAllowed = false; restoredScopeIntent = null;
    selectedBySource.clear(); manualBySource.clear(); manualDraftBySource.clear(); authorityModeBySource.clear(); reviewDecisions.clear();
    reviewFilters.confidence = 'ALL'; reviewFilters.search = ''; reviewFilters.changedOnly = false; syncFilterControls();
    if (multiSource(container)) {
      analyzeButton.disabled = true; setManualDisabled(container, true);
      if (reviewButton) reviewButton.disabled = true; if (csvButton) csvButton.disabled = true; if (jsonButton) jsonButton.disabled = true;
      setMultiSourceStatus(container, `${selectedFiles(sourceInput).length} SOURCE CII files selected. Inspect exact retained S1/S2/S3 custody; deterministic READY Auto Anchor bases will be seeded automatically.`);
    } else {
      analyzeButton.disabled = false; setManualDisabled(container, false);
    }
  };
  function bindAnchorActions() {
    if (!evidence || !inspection) return;
    evidence.querySelectorAll('[data-ciiw-ms-ledger-update]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault(); const id = button.dataset.ciiwMsLedgerSourceId; const index = Number(button.dataset.ciiwMsLedgerIndex);
      const sourceField = evidence.querySelector(`[data-ciiw-ms-ledger-source][data-ciiw-ms-ledger-source-id="${id}"][data-ciiw-ms-ledger-index="${index}"]`);
      const targetField = evidence.querySelector(`[data-ciiw-ms-ledger-target][data-ciiw-ms-ledger-source-id="${id}"][data-ciiw-ms-ledger-index="${index}"]`);
      const sourceNodeId = validManualNode(sourceField?.value); const targetNodeId = validManualNode(targetField?.value);
      if (!sourceNodeId || !targetNodeId) { setMultiSourceStatus(container, `${id}: master ledger requires integer SOURCE and TARGET node IDs.`); return; }
      const pairs = manualRows(manualBySource, id); const duplicate = pairs.some((pair, rowIndex) => rowIndex !== index && pair.sourceNodeId === sourceNodeId && pair.targetNodeId === targetNodeId);
      if (duplicate) { setMultiSourceStatus(container, `${id}: ${sourceNodeId} ↔ ${targetNodeId} is already locked.`); return; }
      pairs[index] = { sourceNodeId, targetNodeId }; manualBySource.set(id, pairs); authorityModeBySource.set(id, 'MANUAL'); invalidatePersistedReview(); refreshAnchorEvidence();
      setMultiSourceStatus(container, `${id}: master anchor updated to ${sourceNodeId} ↔ ${targetNodeId}. Click Compare models to rebuild correspondence from this authority.`);
    }));
    evidence.querySelectorAll('[data-ciiw-ms-ledger-remove]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault(); const id = button.dataset.ciiwMsLedgerSourceId; const index = Number(button.dataset.ciiwMsLedgerIndex);
      const pairs = manualRows(manualBySource, id); pairs.splice(index, 1); manualBySource.set(id, pairs); if (!pairs.length) authorityModeBySource.set(id, 'AUTO'); invalidatePersistedReview(); refreshAnchorEvidence();
      setMultiSourceStatus(container, `${id}: manual anchor removed from the master ledger.`);
    }));
    evidence.querySelectorAll('[data-ciiw-ms-ledger-auto-remove]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault(); const id = button.dataset.ciiwMsLedgerSourceId; const key = button.dataset.ciiwMsLedgerSelectionKey;
      const selected = selectedBySource.get(id) || new Set(); selected.delete(key); selectedBySource.set(id, selected); invalidatePersistedReview(); refreshAnchorEvidence();
      setMultiSourceStatus(container, `${id}: method-qualified base removed from the master ledger.`);
    }));
    evidence.querySelectorAll('[data-ciiw-ms-member]').forEach((section) => {
      const id = section.dataset.ciiwMsMember; const member = inspection.memberInspections.find((item) => item.sourceId === id);
      section.querySelector('[data-ciiw-ms-authority-switch]')?.addEventListener('click', (event) => {
        event.preventDefault();
        const requested = event.currentTarget?.dataset?.ciiwMsAuthoritySwitch;
        if (!['AUTO','MANUAL'].includes(requested)) return;
        const availability = buildCiiMultiSourceActiveAuthorityPlan(inspection, selectedBySource, manualBySource, new Map([[id, requested]]))
          .rows.find((row) => row.sourceId === id);
        if (!availability?.activeReady) {
          setMultiSourceStatus(container, `${id}: the requested ${requested} authority lane is empty; no switch made.`);
          return;
        }
        authorityModeBySource.set(id, requested);
        invalidatePersistedReview(); refreshAnchorEvidence();
        setMultiSourceStatus(container, `${id}: ${requested} is ACTIVE for legacy Compare; inactive evidence is retained, not applied. Compare models again before scope review.`);
      });
      section.querySelectorAll('[data-ciiw-base-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault(); event.stopImmediatePropagation();
          const key = button.dataset.ciiwSelectionKey; const suggestion = (member?.inspection?.baseAnchorSuggestions || []).find((row) => ciiSuggestionSelectionKey(row) === key);
          if (!suggestion) return;
          if (!ciiQualifiedLoopsForSuggestion(suggestion).length) {
            manualDraftBySource.set(id, { sourceNodeId: String(suggestion.sourceNodeId), targetNodeId: String(suggestion.targetNodeId) });
            persistSession(); refreshAnchorEvidence();
            setMultiSourceStatus(container, `${id}: review-only manual fallback prefilled ${suggestion.sourceNodeId} ↔ ${suggestion.targetNodeId}. Review/edit both node IDs, then click Add reviewed anchor.`);
            return;
          }
          authorityModeBySource.set(id, 'AUTO'); manualDraftBySource.set(id, { sourceNodeId: '', targetNodeId: '' });
          const selected = selectedBySource.get(id) || new Set(); if (selected.has(key)) selected.delete(key); else selected.add(key); selectedBySource.set(id, selected);
          invalidatePersistedReview(); refreshAnchorEvidence();
          setMultiSourceStatus(container, authorityReady() ? 'All SOURCE members have base authority. Compare multi-source models.' : 'For every SOURCE, select a qualified base or add at least one reviewed manual anchor.');
        }, true);
      });
      const sourceField = section.querySelector('[data-ciiw-ms-manual-source]'); const targetField = section.querySelector('[data-ciiw-ms-manual-target]');
      const updateDraft = () => { manualDraftBySource.set(id, { sourceNodeId: sourceField?.value || '', targetNodeId: targetField?.value || '' }); persistSession(); };
      sourceField?.addEventListener('input', updateDraft); targetField?.addEventListener('input', updateDraft);
      section.querySelector('[data-ciiw-ms-manual-add]')?.addEventListener('click', (event) => {
        event.preventDefault(); updateDraft();
        const draft = manualDraft(manualDraftBySource, id); const sourceNodeId = validManualNode(draft.sourceNodeId); const targetNodeId = validManualNode(draft.targetNodeId);
        if (!sourceNodeId || !targetNodeId) { setMultiSourceStatus(container, `${id}: enter integer SOURCE and TARGET node IDs before adding the reviewed anchor.`); return; }
        const pairs = manualRows(manualBySource, id); const key = `${sourceNodeId}=>${targetNodeId}`;
        if (!pairs.some((pair) => `${pair.sourceNodeId}=>${pair.targetNodeId}` === key)) pairs.push({ sourceNodeId, targetNodeId });
        manualBySource.set(id, pairs); authorityModeBySource.set(id, 'MANUAL'); manualDraftBySource.set(id, { sourceNodeId: '', targetNodeId: '' });
        invalidatePersistedReview(); refreshAnchorEvidence();
        setMultiSourceStatus(container, `${id}: reviewed manual anchor ${sourceNodeId} ↔ ${targetNodeId} locked. ${authorityReady() ? 'All SOURCE members now have base authority; click Compare models.' : 'Add/select base authority for the remaining SOURCE members.'}`);
      });
      section.querySelectorAll('[data-ciiw-ms-manual-remove]').forEach((button) => button.addEventListener('click', (event) => {
        event.preventDefault(); const index = Number(button.dataset.ciiwMsManualRemove); const pairs = manualRows(manualBySource, id); pairs.splice(index, 1); manualBySource.set(id, pairs); if (!pairs.length) authorityModeBySource.set(id, 'AUTO'); invalidatePersistedReview(); refreshAnchorEvidence();
        setMultiSourceStatus(container, `${id}: manual anchor removed.`);
      }));
      section.querySelector('[data-ciiw-ms-manual-clear]')?.addEventListener('click', (event) => {
        event.preventDefault(); manualBySource.set(id, []); authorityModeBySource.set(id, 'AUTO'); invalidatePersistedReview(); refreshAnchorEvidence(); setMultiSourceStatus(container, `${id}: manual anchors cleared.`);
      });
    });
  }
  const inspectMultiSource = async (event) => {
    if (!multiSource(container)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const runEpoch = confidenceEpoch;
    try {
      const targetFile = selectedFiles(targetInput)[0]; if (!targetFile) throw new Error('TARGET CII file is required.');
      cachedSources = await sourceInputs(selectedFiles(sourceInput), options.cryptoRef);
      const retainedTarget = await retainedTargetInput(targetFile, options.cryptoRef);
      cachedTargetBytes = retainedTarget.bytes; cachedTargetName = retainedTarget.fileName;
      setMultiSourceStatus(container, `Inspecting ${cachedSources.length} canonical SOURCE members S1/S2/S3 through the frozen V11↔V14 bridge…`);
      activeMethodAConfidenceOptions = getCiiMultiSourceMethodAConfidenceOptions();
      const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({ sources: cachedSources, targetBytes: cachedTargetBytes, targetFileName: cachedTargetName }, { cryptoRef: options.cryptoRef, ...activeMethodAConfidenceOptions });
      if (disposed || runEpoch !== confidenceEpoch) return;
      inspection = prepared.inspection; preparedSession = prepared.preparedSession; commonAnalysisCache = createCiiCommonAnalysisCache();
      if (disposed) return; selectedBySource.clear(); manualBySource.clear(); manualDraftBySource.clear(); authorityModeBySource.clear(); reviewDecisions.clear(); preview = null; scopedPreview = null; reviewDirty = false;
      sessionCustody = ciiWriter2SessionCustody(inspection);
      loadedSession = sessionCustody ? loadCiiWriter2Session(persistenceStorage, sessionCustody.storageKey) : null;
      if (!ciiWriter2SessionPolicyMatches(loadedSession, activeMethodAConfidenceOptions)) loadedSession = null;
      const restored = loadedSession ? restoreCiiWriter2AnchorSession(loadedSession, inspection) : null;
      const automaticSeed = buildAutomaticBaseSeed(inspection);
      reviewRestoreAllowed = Boolean(restored && !restored.staleSelectionSourceIds.length);
      restoredScopeIntent = restored?.scopeIntent || null;
      if (restored) {
        reviewFilters.confidence = restored.reviewFilters?.confidence || 'ALL';
        reviewFilters.search = restored.reviewFilters?.search || '';
        reviewFilters.changedOnly = Boolean(restored.reviewFilters?.changedOnly);
        for (const item of inspection.memberInspections) {
          const sourceId = item.sourceId;
          selectedBySource.set(sourceId, new Set(restored.selectedBySource?.[sourceId] || []));
          manualBySource.set(sourceId, [...(restored.manualBySource?.[sourceId] || [])].map((row) => ({ ...row }))); authorityModeBySource.set(sourceId, restored.authorityModeBySource?.[sourceId] || (restored.manualBySource?.[sourceId]?.length ? 'MANUAL' : 'AUTO'));
          manualDraftBySource.set(sourceId, { ...(restored.manualDraftBySource?.[sourceId] || { sourceNodeId: '', targetNodeId: '' }) });
        }
      } else {
        reviewFilters.confidence = 'ALL'; reviewFilters.search = ''; reviewFilters.changedOnly = false;
        for (const item of inspection.memberInspections) {
          selectedBySource.set(item.sourceId, new Set(automaticSeed.selectionKeysBySource[item.sourceId] || []));
          manualBySource.set(item.sourceId, []); authorityModeBySource.set(item.sourceId, 'AUTO');
          manualDraftBySource.set(item.sourceId, { sourceNodeId: '', targetNodeId: '' });
        }
      }
      syncFilterControls(); refreshAnchorEvidence();
      const unresolved = activeAnchorPlan().rows.filter((row) => !row.activeReady).map((row) => row.sourceId);
      if (restored) {
        const stale = restored.staleSelectionSourceIds.length ? ` Stale selection keys were discarded for ${restored.staleSelectionSourceIds.join(', ')}; saved review decisions will not be restored.` : '';
        setMultiSourceStatus(container, `Source-set custody READY. Restored hash-bound Writer2 session for ${inspection.sourceSet.memberCount} canonical members.${stale}${unresolved.length ? ` Base authority still required for ${unresolved.join(', ')}.` : ' Anchor authority is ready; click Compare models.'}`);
        if (results) results.innerHTML = `<p>Hash-bound Writer2 session restored.${unresolved.length ? ` Base authority is still required for ${h(unresolved.join(', '))}.` : ' Compare models to rebuild correspondence; saved review decisions restore only if correspondence identity matches exactly.'}</p>`;
      } else if (automaticSeed.unresolvedSourceIds.length) {
        if (results) results.innerHTML = `<p>Auto Anchor seeded ${automaticSeed.readySourceIds.length}/${inspection.sourceSet.memberCount} SOURCE members. Review and select a qualified base or add a reviewed manual anchor for ${h(automaticSeed.unresolvedSourceIds.join(', '))}, then click Compare models.</p>`;
        setMultiSourceStatus(container, `Source-set custody READY. Auto Anchor seeded ${automaticSeed.readySourceIds.length}/${inspection.sourceSet.memberCount}; explicit base review is still required for ${automaticSeed.unresolvedSourceIds.join(', ')}.`);
      } else {
        if (results) results.innerHTML = '<p>Auto Anchor seeded deterministic qualified bases for S1/S2/S3. Review the selected base evidence, then click Compare models to populate multi-source correspondence review.</p>';
        setMultiSourceStatus(container, `Source-set custody READY: ${inspection.sourceSet.memberCount} canonical S1/S2/S3 members. Auto Anchor seeded deterministic qualified bases for all sources; correspondence approval remains a separate review step.`);
      }
    } catch (error) {
      if (!disposed) { if (evidence) evidence.innerHTML = `<div class="ciiw-method-empty"><b>Multi-source intake blocked</b><p>${h(error?.message || error)}</p></div>`; setMultiSourceStatus(container, error?.message || String(error)); }
    }
  };
  const previewInput = (reviewBySource = undefined) => ({
    baseLoopsBySource: activeAnchorPlan().baseLoopsBySource,
    anchorPairsBySource: activeAnchorPlan().anchorPairsBySource,
    ...(reviewBySource ? { reviewBySource } : {}),
    acceptanceIdentityResolver: options.acceptanceIdentityResolver,
  });
  const analyzeMultiSource = async (event) => {
    if (!multiSource(container)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const runEpoch = confidenceEpoch;
    try {
      if (!inspection || !preparedSession || !commonAnalysisCache) throw new Error('Inspect the source set before Compare.');
      if (!authorityReady()) throw new Error('Each SOURCE requires either a qualified Method A/B base or at least one reviewed manual anchor.');
      setMultiSourceStatus(container, 'Building per-source correspondence with reviewed base authority and target conflict veto…');
      const nextPreview = await createCiiWriter2SourceSetPreviewFromPreparedSession(preparedSession, previewInput(), {
        cryptoRef: options.cryptoRef, commonAnalysisCache, ...activeMethodAConfidenceOptions,
      });
      if (disposed || runEpoch !== confidenceEpoch) return;
      preview = nextPreview; scopedPreview = null; reviewDirty = false; seedCiiMultiSourceReviewDecisions(preview, reviewDecisions);
      let restoredDecisionCount = 0; let restoredMatched = false;
      if (reviewRestoreAllowed && loadedSession) {
        const validIds = (preview?.compareReview?.rows || []).map((row) => row?.correspondenceId).filter(Boolean);
        const restored = restoreCiiWriter2ReviewDecisions(loadedSession, preview?.correspondence?.correspondenceIdentity, validIds);
        restoredMatched = restored.matched;
        if (restored.matched) {
          for (const [id, decision] of Object.entries(restored.decisions || {})) reviewDecisions.set(id, decision);
          restoredDecisionCount = Object.keys(restored.decisions || {}).length;
          reviewDirty = ciiMultiSourceReviewState(preview, reviewDecisions).changedDecisionCount > 0;
        }
      }
      renderMultiReview(); renderTransfer(); switchTab(container, 'compare'); persistSession();
      const locked = ciiMultiSourceLockedReviewCount(preview); const review = reviewConfidenceCount(preview, 'REVIEW');
      const restoredMessage = restoredMatched
        ? ` Restored ${restoredDecisionCount} review decision${restoredDecisionCount === 1 ? '' : 's'} against the exact correspondence identity${reviewDirty ? '; unapplied changes remain pending.' : '.'}`
        : '';
      const scopeMessage = restoredMatched && restoredScopeIntent === 'BOUND_EXPECTED_NODENAME' && !reviewDirty
        ? ' A prior bound-scope intent was recovered as advisory state only; rebind the exact scope explicitly before Writer2 Apply.' : '';
      setMultiSourceStatus(container, `Multi-source correspondence ${preview.correspondence.status}: ${locked} reviewed anchor row${locked === 1 ? '' : 's'} already LOCKED; ${review} REVIEW row${review === 1 ? '' : 's'} need explicit engineering review. HIGH/MEDIUM bulk actions affect only rows with those confidences}.${restoredMessage}${scopeMessage}`);
    } catch (error) { if (!disposed) setMultiSourceStatus(container, error?.message || String(error)); }
  };
  const applyMultiSourceReview = async (event) => {
    if (!multiSource(container) || !preview) return;
    event?.preventDefault?.(); event?.stopImmediatePropagation?.();
    const runEpoch = confidenceEpoch;
    try {
      const reviewBySource = ciiMultiSourceReviewBySource(preview, reviewDecisions);
      setMultiSourceStatus(container, 'Applying multi-source correspondence decisions and rebuilding Writer2 Transfer Preview…');
      const nextPreview = await createCiiWriter2SourceSetPreviewFromPreparedSession(preparedSession, previewInput(reviewBySource), {
        cryptoRef: options.cryptoRef, commonAnalysisCache, ...activeMethodAConfidenceOptions,
      });
      if (disposed || runEpoch !== confidenceEpoch) return;
      preview = nextPreview; scopedPreview = null; reviewDirty = false; restoredScopeIntent = null; seedCiiMultiSourceReviewDecisions(preview, reviewDecisions);
      renderMultiReview(); renderTransfer(); persistSession();
      setMultiSourceStatus(container, `Multi-source review bound. Correspondence ${preview.correspondence.status}; transfer ${preview.transferPlan.status}; Node Name changes ${nodeNameChangeRows(preview).length}.`);
    } catch (error) { setMultiSourceStatus(container, error?.message || String(error)); }
  };
  const bindExpectedScope = async () => {
    if (!preview) return;
    const runEpoch = confidenceEpoch;
    try {
      if (reviewDirty) throw new Error('Apply correspondence approvals to Transfer Preview before binding Writer2 scope.');
      const exact = await createCiiExpectedNodeNameSourceSetSelection(preview.transferPlan, { cryptoRef: options.cryptoRef });
      if (disposed || runEpoch !== confidenceEpoch) return;
      scopedPreview = bindCiiTransferScopeToPreview(preview, exact.selection); restoredScopeIntent = 'BOUND_EXPECTED_NODENAME';
      renderTransfer(); switchTab(container, 'transfer'); persistSession();
      setMultiSourceStatus(container, `BM-correspondence-qualified scope bound: ${exact.appliedOperationIds.length} physical APPLY; ${exact.duplicateCorroborationOperationIds.length} duplicate corroborations collapsed; ${exact.excludedOperationIds.length} EXCLUDE. Writer2 ${scopedPreview.writerReadiness.status}.`);
    } catch (error) { setMultiSourceStatus(container, error?.message || String(error)); }
  };
  const applyScoped = async () => {
    if (reviewDirty || !scopedPreview?.writerReadiness?.ready) return;
    const runEpoch = confidenceEpoch;
    try {
      setMultiSourceStatus(container, 'Applying BM-correspondence-qualified Writer2 NODENAME scope to one TARGET copy through the frozen V11↔V14 bridge…');
      const applied = await applyCiiWorkspaceTargetWriter2WithVersionBridge(scopedPreview, cachedTargetBytes, { cryptoRef: options.cryptoRef });
      if (disposed || runEpoch !== confidenceEpoch) return;
      downloadApplied(container.ownerDocument, applied);
      setMultiSourceStatus(container, `Modified TARGET exported: ${applied.mutationCount} Writer2 field changes; version bridge ${applied.versionBridgeValidation.status}.`);
    } catch (error) { setMultiSourceStatus(container, error?.message || String(error)); }
  };
  function bindTransferActions() {
    transfer?.querySelector('[data-ciiw-ms-bind-expected]')?.addEventListener('click', () => { void bindExpectedScope(); });
    transfer?.querySelector('[data-ciiw-ms-apply]')?.addEventListener('click', () => { void applyScoped(); });
  }
  const onMultiReviewDecision = (event) => {
    if (!multiSource(container) || !preview || !event.target?.matches?.('[data-ciiw-ms-decision]')) return;
    event.stopImmediatePropagation(); const id = event.target.dataset.ciiwMsDecision; const decision = event.target.value;
    if (decision) reviewDecisions.set(id, decision); else reviewDecisions.delete(id);
    markReviewDirty('Multi-source correspondence decision changed. Apply approvals to Transfer Preview to bind the review ledger.');
  };
  const onBulkHigh = (event) => {
    if (!multiSource(container) || !preview) return; event.preventDefault(); event.stopImmediatePropagation();
    const outcome = ciiMultiSourceBulkAcceptOutcome(preview, reviewDecisions, 'HIGH');
    if (outcome.changed) markReviewDirty(outcome.message); else setMultiSourceStatus(container, outcome.message);
  };
  const onBulkMedium = (event) => {
    if (!multiSource(container) || !preview) return; event.preventDefault(); event.stopImmediatePropagation();
    const outcome = ciiMultiSourceBulkAcceptOutcome(preview, reviewDecisions, 'MEDIUM');
    if (outcome.changed) markReviewDirty(outcome.message); else setMultiSourceStatus(container, outcome.message);
  };
  const onConfidenceFilter = (event) => {
    if (!multiSource(container) || !preview) return; event.stopImmediatePropagation(); reviewFilters.confidence = event.target.value || 'ALL'; persistSession(); renderMultiReview();
  };
  const onSearchFilter = (event) => {
    if (!multiSource(container) || !preview) return; event.stopImmediatePropagation(); reviewFilters.search = event.target.value || ''; persistSession(); renderMultiReview();
  };
  const onChangedFilter = (event) => {
    if (!multiSource(container) || !preview) return; event.stopImmediatePropagation(); reviewFilters.changedOnly = Boolean(event.target.checked); persistSession(); renderMultiReview();
  };
  const onCsvExport = (event) => {
    if (!multiSource(container) || !preview) return; event.preventDefault(); event.stopImmediatePropagation();
    downloadPayload(container.ownerDocument, 'cii-multisource-correspondence.csv', preview.artifacts.correspondenceCsv, 'text/csv');
  };
  const onJsonExport = (event) => {
    if (!multiSource(container) || !preview) return; event.preventDefault(); event.stopImmediatePropagation();
    downloadPayload(container.ownerDocument, 'cii-multisource-audit.json', preview.artifacts.auditJson, 'application/json');
  };
  const onConfidencePolicyChange = () => {
    confidenceEpoch += 1;
    if (!multiSource(container)) return;
    resetMulti();
    if (evidence) evidence.innerHTML = '';
    if (results) results.innerHTML = '<p>Method A confidence policy changed. Run Inspect again before comparing or exporting correspondence.</p>';
    if (executive) executive.innerHTML = '';
    if (deltas) deltas.innerHTML = '';
    if (transfer) transfer.innerHTML = '';
    setMultiSourceStatus(container, 'Method A confidence policy changed. Stale correspondence, review approvals and Writer2 scope are invalid; run Inspect again.');
  };
  const blockLegacyAnalyze = (event) => { if (multiSource(container)) { event.preventDefault(); event.stopImmediatePropagation(); } };
  sourceInput.addEventListener('change', resetMulti); targetInput.addEventListener('change', resetMulti);
  container.addEventListener('ciiw-method-a-confidence-changed', onConfidencePolicyChange);
  inspectButton.addEventListener('click', inspectMultiSource, true);
  analyzeButton.addEventListener('click', analyzeMultiSource, true);
  analyzeButton.addEventListener('click', blockLegacyAnalyze, true);
  container.addEventListener('change', onMultiReviewDecision, true);
  reviewButton?.addEventListener('click', applyMultiSourceReview, true); acceptHigh?.addEventListener('click', onBulkHigh, true); acceptMedium?.addEventListener('click', onBulkMedium, true);
  confidenceFilter?.addEventListener('change', onConfidenceFilter, true); searchInput?.addEventListener('input', onSearchFilter, true); changedOnly?.addEventListener('change', onChangedFilter, true);
  csvButton?.addEventListener('click', onCsvExport, true); jsonButton?.addEventListener('click', onJsonExport, true);
  resetMulti();
  return {
    ...legacy,
    getMultiSourcePreview() { return scopedPreview || preview; },
    destroy() {
      disposed = true; inspection = null; preparedSession = null; commonAnalysisCache = null;
      cachedSources = null; cachedTargetBytes = null; cachedTargetName = null; preview = null; scopedPreview = null;
      sourceInput.removeEventListener('change', resetMulti); targetInput.removeEventListener('change', resetMulti);
      container.removeEventListener('ciiw-method-a-confidence-changed', onConfidencePolicyChange);
      inspectButton.removeEventListener('click', inspectMultiSource, true); analyzeButton.removeEventListener('click', analyzeMultiSource, true);
      analyzeButton.removeEventListener('click', blockLegacyAnalyze, true); container.removeEventListener('change', onMultiReviewDecision, true);
      reviewButton?.removeEventListener('click', applyMultiSourceReview, true); acceptHigh?.removeEventListener('click', onBulkHigh, true); acceptMedium?.removeEventListener('click', onBulkMedium, true);
      confidenceFilter?.removeEventListener('change', onConfidenceFilter, true); searchInput?.removeEventListener('input', onSearchFilter, true); changedOnly?.removeEventListener('change', onChangedFilter, true);
      csvButton?.removeEventListener('click', onCsvExport, true); jsonButton?.removeEventListener('click', onJsonExport, true); legacy.destroy();
    },
  };
}

export const _test = Object.freeze({
  selectedFiles, sourceRows, sourceInputs, retainedTargetInput, canonicalSourceIdForSha256, shortSha, writer2PersistenceStorage,
  selectedBaseLoopsBySource, manualAnchorPairsBySource, allMembersHaveBase, buildAutomaticBaseSeed, validManualNode,
  buildAutomaticReview, nodeNameChangeRows, reviewConfidenceCount, transferMutationSummary, transferMarkup,
});
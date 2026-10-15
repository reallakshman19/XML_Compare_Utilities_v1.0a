import {
  applyCiiWorkspaceTargetWriter1A, applyCiiWorkspaceTargetWriter1B, applyCiiWorkspaceTargetWriter1C,
  createCiiWorkspacePreview, inspectCiiWorkspaceModels,
} from './cii-workspace-core.js';
import {
  applyCiiWorkspaceTargetWriter2WithVersionBridge,
  createCiiWorkspacePreviewWithVersionBridge,
  inspectCiiWorkspaceModelsWithVersionBridge,
} from './cii-workspace-writer-version-bridge.js';
import { createCiiWorkspaceStageModel } from './cii-workspace-placeholders.js';
import { stableStringify } from './cii-workspace-contracts.js';
import { updateCiiReviewDecisions } from './cii-workspace-review.js';
import { ciiApplyBaseSelection } from './cii-workspace-base-loop-selection.js';
import { ciiEngineeringChangesMarkup, ciiEngineeringDeltaMarkup, ciiTransferPreviewMarkup } from './cii-workspace-review-presentation.js';

function h(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function parseNodes(value) { return String(value || '').split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean); }
function anchorPairs(source, target) {
  const left = parseNodes(source); const right = parseNodes(target);
  if (left.length !== right.length || left.length < 1) throw new Error('Provide at least one SOURCE and TARGET anchor node in corresponding order.');
  return left.map((sourceNodeId, index) => ({ sourceNodeId, targetNodeId: right[index] }));
}
function binaryBytes(value) {
  const raw = String(value ?? ''); const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index) & 0xff;
  return bytes;
}
function download(documentRef, name, payload, type) {
  const url = URL.createObjectURL(new Blob([payload], { type }));
  const link = documentRef.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function downloadApplied(documentRef, applied) {
  if (applied?.writer === 'WRITER_2') {
    if (applied?.versionBridgeValidation?.status !== 'PASS') throw new Error('CII_WRITER_2_VERSION_BRIDGE_VALIDATION_REQUIRED');
    if (typeof applied?.byteString !== 'string') throw new Error('CII_WRITER_2_BYTE_STRING_REQUIRED');
    download(documentRef, applied.fileName, binaryBytes(applied.byteString), 'text/plain');
    return;
  }
  const byteAuthoritative = applied?.writer === 'WRITER_1C' && typeof applied?.byteString === 'string';
  const payload = byteAuthoritative ? binaryBytes(applied.byteString) : applied?.text;
  download(documentRef, applied.fileName, payload, 'text/plain');
}
function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '—';
  if (typeof value === 'object') return stableStringify(value);
  return String(value);
}
function passText(evidence) {
  if (!evidence || evidence.available === false) return '—';
  return evidence.pass ? 'PASS' : 'FAIL';
}
function stageMarkup(readiness = null) {
  return createCiiWorkspaceStageModel(readiness).map((stage) => `<section class="ciiw-stage" data-ciiw-stage="${stage.id}">
<h3>${h(stage.id)} ${h(stage.label)}</h3><p>Status: <b>${h(stage.status)}</b></p>
${stage.id === '06' && stage.blockers?.length ? `<p>${h(stage.blockers[0])}</p>` : ''}
</section>`).join('');
}
function componentText(summary) {
  const rows = Object.entries(summary?.componentCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  return rows.length ? rows.map(([kind, count]) => `${kind}:${count}`).join(', ') : 'none';
}
function landmarkSide(label, side) {
  const rows = side?.landmarks || [];
  const items = rows.length ? rows.map((row) => `<li><b>${h(row.nodeId)}</b> — ${h(row.reasons.join(', '))} <small>SUGGESTED · unpaired evidence</small></li>`).join('') : '<li>No distinctive landmark evidence.</li>';
  const summary = side?.summary || {};
  return `<div class="ciiw-model-card"><h4>${h(label)} model</h4><p><b>${h(side?.fileName || '')}</b></p><p>Version: ${h(summary.version || 'unspecified')}</p><p>${h(summary.elementCount ?? '—')} elements · ${h(summary.nodeCount ?? '—')} nodes · ${h(summary.terminalCount ?? '—')} terminals · ${h(summary.branchCount ?? '—')} branches</p><p>Components: ${h(componentText(summary))} · ${h(summary.bendCount ?? '—')} bends · ${h(summary.rigidRecordCount ?? '—')} rigid records</p><h5>Landmark evidence (unpaired)</h5><ul>${items}</ul></div>`;
}
function baseAnchorMarkup(inspection) {
  const rows = inspection?.baseAnchorSuggestions || [];
  if (!rows.length) return '<section class="ciiw-anchor-suggestions"><h4>Base Anchor suggestions</h4><p>No sufficiently distinctive pair was found. Enter a reviewed SOURCE/TARGET anchor manually.</p></section>';
  return `<section class="ciiw-anchor-suggestions"><h4>Base Anchor suggestions</h4><p>Method-qualified evidence. Node-number offsets and wall are not identity authority; SOURCE OD is used only as the configured physical tolerance scale. Every pair requires engineer acceptance.</p><table class="ciiw-grid"><thead><tr><th>Suggested pair</th><th>Basis</th><th>Confidence</th><th>Review</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `<tr data-ciiw-anchor-row="${h(row.sourceNodeId)}:${h(row.targetNodeId)}"><td><b>${h(row.sourceNodeId)} ↔ ${h(row.targetNodeId)}</b></td><td>${h(row.basis.join(' · '))}</td><td><b>${h(row.confidence)}</b><small>score ${h(formatValue(row.score))} · winner gap ${h(formatValue(row.winnerGap))}/${h(formatValue(row.requiredWinnerGap))}</small></td><td>REQUIRED</td><td><button type="button" data-ciiw-accept-anchor data-source-node="${h(row.sourceNodeId)}" data-target-node="${h(row.targetNodeId)}">Use manual anchor</button></td></tr>`).join('')}</tbody></table></section>`;
}
function landmarkMarkup(inspection) { return `${baseAnchorMarkup(inspection)}<div class="ciiw-landmark-grid">${landmarkSide('SOURCE', inspection?.source)}${landmarkSide('TARGET', inspection?.target)}</div>`; }
function pendingDecision(row, decisions) {
  const explicit = decisions.get(row.correspondenceId); if (explicit) return explicit;
  if (row.decision === 'ACCEPTED') return 'ACCEPT'; if (row.decision === 'REJECTED') return 'REJECT'; if (row.decision === 'LOCKED') return 'LOCK'; return '';
}
function approvalText(row, decisions) {
  const value = pendingDecision(row, decisions);
  return value === 'ACCEPT' ? 'APPROVED' : value === 'LOCK' ? 'LOCKED' : value === 'REJECT' ? 'REJECTED' : 'PENDING';
}
function decisionControl(row, decisions) {
  const current = pendingDecision(row, decisions);
  if (row.workflowStatus === 'LOCKED' || row.decision === 'LOCKED') return '<span class="ciiw-pill">LOCKED</span>';
  return `<select data-ciiw-decision="${h(row.correspondenceId)}"><option value="">Review…</option><option value="LOCK" ${current === 'LOCK' ? 'selected' : ''}>Lock</option><option value="ACCEPT" ${current === 'ACCEPT' ? 'selected' : ''}>Accept</option><option value="REJECT" ${current === 'REJECT' ? 'selected' : ''}>Reject</option></select>`;
}
function correspondenceMarkup(current, decisions, filter = {}) {
  const rows = current?.compareReview?.rows || [];
  const confidence = String(filter.confidence || 'ALL'); const search = String(filter.search || '').trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (confidence !== 'ALL' && row.confidence !== confidence) return false;
    if (filter.changedOnly && !row.changeCount) return false;
    const haystack = [row.source, row.target, row.kind, row.confidence, ...(row.changeFamilies || [])].join(' ').toLowerCase();
    return !search || haystack.includes(search);
  });
  if (!visible.length) return '<p>No correspondence rows match the current filters.</p>';
  return `<table class="ciiw-grid"><thead><tr><th>Decision</th><th>Kind</th><th>Confidence</th><th>Source</th><th>Target</th><th>M1 Spatial</th><th>M2 Gang</th><th>OD</th><th>WT</th><th>Winner gap</th><th>Engineering changes</th><th>Evidence</th></tr></thead><tbody>${visible.map((row) => `<tr><td>${decisionControl(row, decisions)}</td><td>${h(row.kind)}</td><td><b>${h(row.confidence)}</b><small>${h(row.workflowStatus)}</small></td><td>${h(row.source)}</td><td>${h(row.target)}</td><td>${h(passText(row.methodA))}${row.methodA?.distanceMm != null ? `<small>${h(formatValue(row.methodA.distanceMm))} mm / ${h(formatValue(row.methodA.toleranceMm))}</small>` : ''}</td><td>${h(passText(row.methodB))}${row.methodB ? `<small>score ${h(formatValue(row.methodB.score))}</small>` : ''}</td><td>${h(passText(row.od))}</td><td>${h(passText(row.wall))}</td><td>${h(row.winnerGap ?? '—')} / ${h(row.requiredWinnerGap ?? '—')}</td><td>${row.changeCount ? `<b>${h(row.changeCount)}</b><small>${h(row.changeFamilies.join(', '))}</small>` : '—'}</td><td><button type="button" data-ciiw-inspect-row="${h(row.correspondenceId)}">Inspect</button></td></tr>`).join('')}</tbody></table>`;
}
function executiveMarkup(current) {
  const model = current?.compareReview; if (!model) return '<p>Run Compare models to build the executive summary.</p>';
  const c = model.summary?.correspondence || {}; const confidence = c.confidence || {}; const engineering = model.summary?.engineering || {}; const review = model.summary?.review || {};
  const families = Object.entries(engineering.changeFamilyCounts || {}).map(([key, value]) => `${key} ${value}`).join(' · ') || 'No qualified engineering changes';
  return `<div class="ciiw-exec-head"><div><b>${h(model.source.fileName)}</b><span> SOURCE</span></div><div class="ciiw-arrow">→</div><div><b>${h(model.target.fileName)}</b><span> TARGET</span></div></div><div class="ciiw-kpis"><div><b>${h(confidence.HIGH || 0)}</b><span>HIGH</span></div><div><b>${h(confidence.MEDIUM || 0)}</b><span>MEDIUM</span></div><div><b>${h(confidence.REVIEW || 0)}</b><span>REVIEW</span></div><div><b>${h(confidence.UNRESOLVED || 0)}</b><span>UNRESOLVED</span></div><div><b>${h(engineering.engineeringChangeCount || 0)}</b><span>Engineering changes</span></div><div><b>${h(review.locked || 0)}</b><span>Locked</span></div></div><p class="ciiw-family-summary">${h(families)}</p>`;
}
function inspectorMarkup(row) {
  if (!row) return '<p>Select a correspondence row to inspect its evidence.</p>';
  const alternatives = row.alternatives?.length ? `<table><thead><tr><th>Target</th><th>Confidence</th><th>Score</th><th>Rank</th><th>M1</th><th>M2</th></tr></thead><tbody>${row.alternatives.map((item) => `<tr><td>${h(item.target)}</td><td>${h(item.confidence)}</td><td>${h(formatValue(item.score))}</td><td>${h(formatValue(item.rankingScore))}</td><td>${h(item.m1Pass == null ? '—' : item.m1Pass ? 'PASS' : 'FAIL')} ${h(formatValue(item.m1Score))}</td><td>${h(item.m2Pass == null ? '—' : item.m2Pass ? 'PASS' : 'FAIL')} ${h(formatValue(item.m2Score))}</td></tr>`).join('')}</tbody></table>` : '<p>No alternative candidate list is available for this identity kind.</p>';
  const changes = ciiEngineeringChangesMarkup(row.changes || []);
  return `<div class="ciiw-inspector-head"><div><b>${h(row.source)}</b> → <b>${h(row.target)}</b></div><span class="ciiw-pill">${h(row.confidence)}</span></div><div class="ciiw-evidence-cards"><div><b>M1 Spatial</b><span>${h(passText(row.methodA))}</span><small>${row.methodA?.distanceMm != null ? `${h(formatValue(row.methodA.distanceMm))} mm / ${h(formatValue(row.methodA.toleranceMm))} mm · ${h(row.methodA.basis)}` : 'Unavailable'}</small></div><div><b>M2 Network</b><span>${h(passText(row.methodB))}</span><small>${row.methodB ? `score ${h(formatValue(row.methodB.score))} / ${h(formatValue(row.methodB.threshold))}` : 'Unavailable'}</small></div><div><b>OD</b><span>${h(passText(row.od))}</span></div><div><b>Wall</b><span>${h(passText(row.wall))}</span></div><div><b>Winner gap</b><span>${h(row.winnerGap ?? '—')} / ${h(row.requiredWinnerGap ?? '—')}</span></div></div>${row.reasons?.length ? `<p><b>Identity notes:</b> ${h(row.reasons.join(', '))}</p>` : ''}<h4>Alternative candidates</h4>${alternatives}<h4>Engineering changes</h4>${changes}`;
}
function deltaMarkup(current, decisions) { return ciiEngineeringDeltaMarkup(current, (row) => approvalText(row, decisions)); }
function limitationMarkup(current) {
  const rows = current?.engineeringDeltas?.limitations || []; if (!rows.length) return '';
  return `<div class="ciiw-limitations"><h4>Capability limits</h4>${rows.map((item) => `<div><b>${h(item.label)}</b><span>${h(item.comparisonState)}</span><small>SOURCE ${h(item.sourceState)} / TARGET ${h(item.targetState)} · ${h(item.reason)}</small></div>`).join('')}</div>`;
}
function transferMarkup(current) { return ciiTransferPreviewMarkup(current); }
function reviewFrom(decisions) {
  const reviewedCorrespondenceIds = []; const lockedCorrespondenceIds = []; const rejectedCorrespondenceIds = [];
  for (const [id, decision] of decisions.entries()) {
    if (decision === 'LOCK') lockedCorrespondenceIds.push(id); if (decision === 'ACCEPT') reviewedCorrespondenceIds.push(id); if (decision === 'REJECT') rejectedCorrespondenceIds.push(id);
  }
  return { reviewedCorrespondenceIds, lockedCorrespondenceIds, rejectedCorrespondenceIds };
}
function bulkAccept(current, decisions, confidence) {
  let count = 0;
  for (const row of current?.compareReview?.rows || []) {
    if (row.confidence !== confidence || !row.identityBound || row.decision === 'LOCKED') continue;
    decisions.set(row.correspondenceId, 'ACCEPT'); count += 1;
  }
  return count;
}
function writer2BridgeSelected(options) { return options?.writerVersion === '2'; }
function inspectFunction(options) {
  return writer2BridgeSelected(options) ? inspectCiiWorkspaceModelsWithVersionBridge : inspectCiiWorkspaceModels;
}
function previewFunction(options) {
  return writer2BridgeSelected(options) ? createCiiWorkspacePreviewWithVersionBridge : createCiiWorkspacePreview;
}
function applyFunction(version) {
  if (version === '1A') return applyCiiWorkspaceTargetWriter1A;
  if (version === '1C') return applyCiiWorkspaceTargetWriter1C;
  if (version === '2') return applyCiiWorkspaceTargetWriter2WithVersionBridge;
  return applyCiiWorkspaceTargetWriter1B;
}

export function mountCiiWorkspaceShell(container, options = {}) {
  container.innerHTML = `<div class="ciiw-workspace"><header><div><h2>CII Workspace</h2><p>Compare CAESAR II neutral models and review engineering changes</p></div><button type="button" data-ciiw-close>Close</button></header><nav class="ciiw-tabs"><button type="button" data-ciiw-tab="inputs">1 Inputs &amp; Match Basis</button><button type="button" data-ciiw-tab="compare">2 Compare Review</button><button type="button" data-ciiw-tab="transfer">3 Transfer Preview</button></nav><section data-ciiw-panel="inputs"><div class="ciiw-intake"><label>SOURCE CII <input type="file" accept=".cii,.accdb" data-ciiw-source></label><label>TARGET CII <input type="file" accept=".cii,.accdb" data-ciiw-target></label><button type="button" data-ciiw-inspect>Inspect models &amp; suggest base anchors</button><div data-ciiw-landmarks></div><label>Manual SOURCE anchor(s) <input type="text" placeholder="Legacy/manual mode: 10 or 10, 200" data-ciiw-source-anchors></label><label>Manual TARGET anchor(s) <input type="text" placeholder="Legacy/manual mode: 20010 or 20010, 20200" data-ciiw-target-anchors></label><button type="button" data-ciiw-analyze>Compare models →</button></div><div class="ciiw-status" data-ciiw-status>Load two neutral CII files, inspect method-qualified Base Anchor suggestions, then add independent bases or use manual anchors.</div></section><section data-ciiw-panel="compare"><div class="ciiw-results"><h3>1. Executive Summary</h3><div data-ciiw-executive></div><h3>2. Correspondence Review</h3><div class="ciiw-bulk-accept"><b>Bulk Accept</b><button type="button" data-ciiw-accept-high>Accept all HIGH</button><button type="button" data-ciiw-accept-medium>Accept all MEDIUM</button><small>REVIEW and UNRESOLVED rows are never bulk accepted.</small></div><div class="ciiw-toolbar"><label>Confidence <select data-ciiw-confidence-filter><option>ALL</option><option>HIGH</option><option>MEDIUM</option><option>REVIEW</option><option>UNRESOLVED</option><option>LOCKED</option></select></label><label>Search <input type="search" data-ciiw-search placeholder="Node, element, family"></label><label><input type="checkbox" data-ciiw-changed-only> Changed only</label></div><div data-ciiw-results></div><aside class="ciiw-inspector" data-ciiw-inspector></aside><h3>3. Engineering Delta Grid</h3><p>SOURCE candidate, current TARGET and effective TARGET after apply are shown separately. Pending decisions must be bound to Transfer Preview before they can alter effective TARGET.</p><div data-ciiw-deltas></div><div data-ciiw-limitations></div><button type="button" data-ciiw-refresh-review disabled>Apply approvals to Transfer Preview</button><button type="button" data-ciiw-export-csv disabled>Export correspondence CSV</button><button type="button" data-ciiw-export-json disabled>Export audit JSON</button></div></section><section data-ciiw-panel="transfer"><div data-ciiw-transfer></div><div class="ciiw-stages" data-ciiw-stages>${stageMarkup()}</div></section></div>`;
  let current = null; let baseInput = null; let disposed = false; const decisions = new Map(); const filters = { confidence: 'ALL', search: '', changedOnly: false };
  const query = (selector) => container.querySelector(selector); const status = query('[data-ciiw-status]'); const results = query('[data-ciiw-results]'); const landmarkBox = query('[data-ciiw-landmarks]');
  const executive = query('[data-ciiw-executive]'); const inspector = query('[data-ciiw-inspector]'); const deltas = query('[data-ciiw-deltas]'); const limits = query('[data-ciiw-limitations]'); const transfer = query('[data-ciiw-transfer]'); const stagesBox = query('[data-ciiw-stages]');
  const reviewButton = query('[data-ciiw-refresh-review]'); const csvButton = query('[data-ciiw-export-csv]'); const jsonButton = query('[data-ciiw-export-json]');
  const switchTab = (name) => { container.querySelectorAll('[data-ciiw-panel]').forEach((panel) => { panel.hidden = panel.dataset.ciiwPanel !== name; }); container.querySelectorAll('[data-ciiw-tab]').forEach((button) => { button.setAttribute('aria-current', button.dataset.ciiwTab === name ? 'page' : 'false'); }); };
  const renderCorrespondence = () => {
    results.innerHTML = correspondenceMarkup(current, decisions, filters);
    results.querySelectorAll('[data-ciiw-decision]').forEach((select) => select.addEventListener('change', () => { if (select.value) decisions.set(select.dataset.ciiwDecision, select.value); else decisions.delete(select.dataset.ciiwDecision); deltas.innerHTML = deltaMarkup(current, decisions); }));
    results.querySelectorAll('[data-ciiw-inspect-row]').forEach((button) => button.addEventListener('click', () => { const row = current?.compareReview?.rows?.find((item) => item.correspondenceId === button.dataset.ciiwInspectRow); inspector.innerHTML = inspectorMarkup(row); switchTab('compare'); }));
  };
  const bindApply = () => {
    const button = transfer.querySelector('[data-ciiw-apply-target]'); if (!button || button.disabled) return;
    button.addEventListener('click', async () => {
      try {
        const targetInput = baseInput?.targetBytes ?? baseInput?.targetText;
        if (!current || !targetInput) throw new Error('Rebuild the approved transfer preview before target mutation.');
        const version = current.writerVersion || '1B'; button.disabled = true;
        status.textContent = `Applying Writer ${version} fields and reparsing modified TARGET CII…`;
        const applied = await applyFunction(version)(current, targetInput, { cryptoRef: options.cryptoRef });
        downloadApplied(container.ownerDocument, applied);
        status.textContent = `Modified TARGET CII exported: ${applied.mutationCount} approved field changes; unexpected semantic deltas ${applied.validation.unexpectedSemanticDeltaCount}.`;
      } catch (error) { status.textContent = error.message || String(error); button.disabled = current?.writerReadiness?.ready !== true; }
    });
  };
  const render = () => {
    executive.innerHTML = executiveMarkup(current); renderCorrespondence(); deltas.innerHTML = deltaMarkup(current, decisions); limits.innerHTML = limitationMarkup(current);
    transfer.innerHTML = transferMarkup(current); stagesBox.innerHTML = stageMarkup(current?.writerReadiness); bindApply();
    inspector.innerHTML = inspectorMarkup(current?.compareReview?.rows?.[0] || null);
  };
  const invalidate = (message, clearLandmarks = false) => { current = null; baseInput = null; decisions.clear(); results.innerHTML = ''; executive.innerHTML = ''; inspector.innerHTML = ''; deltas.innerHTML = ''; limits.innerHTML = ''; transfer.innerHTML = ''; stagesBox.innerHTML = stageMarkup(); reviewButton.disabled = true; csvButton.disabled = true; jsonButton.disabled = true; if (clearLandmarks) landmarkBox.innerHTML = ''; status.textContent = message; switchTab('inputs'); };
  const readFiles = async () => {
    const sourceFile = query('[data-ciiw-source]').files?.[0]; const targetFile = query('[data-ciiw-target]').files?.[0];
    if (!sourceFile || !targetFile) throw new Error('SOURCE and TARGET CII files are required.');
    return { sourceBytes: new Uint8Array(await sourceFile.arrayBuffer()), sourceFileName: sourceFile.name,
      targetBytes: new Uint8Array(await targetFile.arrayBuffer()), targetFileName: targetFile.name };
  };
  const run = async (review = undefined) => {
    const createPreview = previewFunction(options);
    current = await createPreview({ ...baseInput, ...(review ? { review } : {}) }, options); if (disposed) return;
    status.textContent = `Correspondence ${current.correspondence.status}; transfer preview ${current.transferPlan.status}; Writer ${current.writerVersion} ${current.writerReadiness.status}.`;
    render(); reviewButton.disabled = false; csvButton.disabled = false; jsonButton.disabled = false; switchTab('compare');
  };
  const inspect = async () => {
    try {
      status.textContent = 'Inspecting model summaries and method-qualified Base Anchor evidence…'; decisions.clear(); current = null; baseInput = await readFiles();
      const inspectModels = inspectFunction(options);
      const inspection = await inspectModels(baseInput, options); if (disposed) return;
      landmarkBox.innerHTML = landmarkMarkup(inspection);
      landmarkBox.querySelectorAll('[data-ciiw-accept-anchor]').forEach((button) => button.addEventListener('click', () => { query('[data-ciiw-source-anchors]').value = button.dataset.sourceNode; query('[data-ciiw-target-anchors]').value = button.dataset.targetNode; landmarkBox.querySelectorAll('[data-ciiw-anchor-row]').forEach((row) => row.setAttribute('data-selected', 'false')); landmarkBox.querySelector(`[data-ciiw-anchor-row="${button.dataset.sourceNode}:${button.dataset.targetNode}"]`)?.setAttribute('data-selected', 'true'); status.textContent = `Manual anchor ${button.dataset.sourceNode} ↔ ${button.dataset.targetNode} selected by engineer. Run Compare models to use legacy/manual anchor mode.`; }));
      status.textContent = 'Base Anchor suggestions are evidence only. Add one or more qualified independent bases, or use manual anchors as a separate fallback mode.'; reviewButton.disabled = true; csvButton.disabled = true; jsonButton.disabled = true;
    } catch (error) { if (!disposed) { status.textContent = error.message || String(error); landmarkBox.innerHTML = ''; } }
  };
  const analyze = async () => { try {
    status.textContent = 'Building correspondence and engineering delta review…'; decisions.clear();
    const selectedBaseLoops = typeof options.getBaseLoops === 'function' ? options.getBaseLoops() : [];
    const legacyPairs = Array.isArray(selectedBaseLoops) && selectedBaseLoops.length ? []
      : anchorPairs(query('[data-ciiw-source-anchors]').value, query('[data-ciiw-target-anchors]').value);
    baseInput = ciiApplyBaseSelection(await readFiles(), selectedBaseLoops, legacyPairs); await run();
  } catch (error) { if (!disposed) { current = null; status.textContent = error.message || String(error); results.innerHTML = ''; reviewButton.disabled = true; csvButton.disabled = true; jsonButton.disabled = true; } } };
  const applyBulk = (confidence) => { const count = bulkAccept(current, decisions, confidence); renderCorrespondence(); deltas.innerHTML = deltaMarkup(current, decisions); status.textContent = `${count} ${confidence} correspondence rows marked Accept. Apply approvals to Transfer Preview to bind this review ledger.`; };
  query('[data-ciiw-close]').addEventListener('click', () => options.close?.()); query('[data-ciiw-inspect]').addEventListener('click', inspect); query('[data-ciiw-analyze]').addEventListener('click', analyze); query('[data-ciiw-accept-high]').addEventListener('click', () => applyBulk('HIGH')); query('[data-ciiw-accept-medium]').addEventListener('click', () => applyBulk('MEDIUM'));
  container.querySelectorAll('[data-ciiw-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.ciiwTab)));
  for (const selector of ['[data-ciiw-source]', '[data-ciiw-target]']) query(selector).addEventListener('change', () => invalidate('CII files changed. Inspect the models again before using prior correspondence.', true));
  for (const selector of ['[data-ciiw-source-anchors]', '[data-ciiw-target-anchors]']) query(selector).addEventListener('input', () => invalidate('Manual anchors changed. Rebuild correspondence before review or export.'));
  query('[data-ciiw-confidence-filter]').addEventListener('change', (event) => { filters.confidence = event.target.value || 'ALL'; renderCorrespondence(); }); query('[data-ciiw-search]').addEventListener('input', (event) => { filters.search = event.target.value || ''; renderCorrespondence(); }); query('[data-ciiw-changed-only]').addEventListener('change', (event) => { filters.changedOnly = Boolean(event.target.checked); renderCorrespondence(); });
  reviewButton.addEventListener('click', async () => { try { if (!current?.review) throw new Error('Bound review ledger is unavailable. Rebuild correspondence.'); status.textContent = 'Applying correspondence approvals and rebuilding Transfer Preview…'; await run(updateCiiReviewDecisions(current.review, reviewFrom(decisions))); } catch (error) { status.textContent = error.message || String(error); } });
  csvButton.addEventListener('click', () => current && download(container.ownerDocument, 'cii-correspondence.csv', current.artifacts.correspondenceCsv, 'text/csv')); jsonButton.addEventListener('click', () => current && download(container.ownerDocument, 'cii-workspace-audit.json', current.artifacts.auditJson, 'application/json'));
  switchTab('inputs');
  return {
    destroy() { disposed = true; container.innerHTML = ''; },
    getCurrentResult() { return current; },
    invalidateExternal(message = 'Independent Base Anchor selection changed. Rebuild correspondence before review or export.') { invalidate(message); },
  };
}

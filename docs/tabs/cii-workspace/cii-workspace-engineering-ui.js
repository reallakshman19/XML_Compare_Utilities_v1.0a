import { inspectCiiWorkspaceModels } from './cii-workspace-core.js';
import { inspectCiiWorkspaceModelsWithVersionBridge } from './cii-workspace-writer-version-bridge.js';
import { mountCiiWorkspaceShell } from './cii-workspace-shell.js';
import {
  buildCiiSelectedBaseLoops, ciiBaseSelectionSummary, ciiQualifiedLoopsForSuggestion, ciiSuggestionSelectionKey,
} from './cii-workspace-base-loop-selection.js';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function fmt(value, digits = 3) {
  const number = finite(value); return number == null ? '—' : Number(number.toFixed(digits)).toString();
}
function methodLabel(method) {
  return ({
    METHOD_A_SPATIAL: 'METHOD A — Spatial',
    METHOD_B_NETWORK: 'METHOD B — Network',
    METHOD_A_AND_B: 'METHOD A + METHOD B',
    LANDMARK_ONLY: 'LANDMARK ONLY',
  })[method] || String(method || 'UNQUALIFIED');
}
function methodClass(method) {
  return ({
    METHOD_A_SPATIAL: 'method-a', METHOD_B_NETWORK: 'method-b',
    METHOD_A_AND_B: 'method-ab', LANDMARK_ONLY: 'landmark',
  })[method] || 'review';
}
function confidenceClass(confidence) {
  return ({ HIGH: 'high', MEDIUM: 'medium', REVIEW: 'review' })[confidence] || 'review';
}
function toleranceRange(policy) {
  const values = (policy?.anchorTolerances || []).map((row) => finite(row.toleranceMm)).filter((value) => value != null);
  if (!values.length) return policy?.basisAgreementToleranceMm == null ? '—' : `${fmt(policy.basisAgreementToleranceMm)} mm`;
  const minimum = Math.min(...values); const maximum = Math.max(...values);
  return Math.abs(maximum - minimum) < 1e-9 ? `${fmt(minimum)} mm` : `${fmt(minimum)}–${fmt(maximum)} mm`;
}
function matrixMarkup(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 3) return '<span>Unavailable</span>';
  return `<div class="ciiw-matrix">${matrix.map((row) => `<code>${(row || []).map((value) => fmt(value, 6).padStart(10, ' ')).join(' ')}</code>`).join('')}</div>`;
}
function translationMarkup(vector) {
  if (!Array.isArray(vector) || vector.length !== 3) return 'Unavailable';
  return `(${vector.map((value) => fmt(value, 6)).join(', ')}) mm`;
}
function methodAMarkup(row) {
  const evidence = row?.methodA; const base = evidence?.bestBase;
  if (evidence?.status !== 'READY' || !base) {
    return `<section class="ciiw-method-card is-review"><div class="ciiw-method-title"><b>Method A — Spatial</b><span>UNAVAILABLE</span></div><p>No qualified non-collinear local rigid-registration base contains this pair.</p></section>`;
  }
  const diagnostics = base.expansionDiagnostics || {};
  const ambiguous = [...(diagnostics.ambiguousSourceNodeIds || []).map((id) => `SOURCE ${id}`),
    ...(diagnostics.ambiguousTargetNodeIds || []).map((id) => `TARGET ${id}`)];
  const cap = base.automaticConfidenceCap
    ? `<div class="ciiw-method-warning">Automatic confidence capped at ${h(base.automaticConfidenceCap)} until ${h(base.automaticConfidenceMinimumAnchorCount)} anchors validate the transform.</div>` : '';
  const ambiguity = ambiguous.length
    ? `<div class="ciiw-method-warning">Equal-residual spatial candidates excluded: ${h(ambiguous.join(', '))}</div>` : '';
  return `<section class="ciiw-method-card"><div class="ciiw-method-title"><b>Method A — Spatial</b><span>${h(evidence.confidence || 'REVIEW')}</span></div>
<div class="ciiw-method-kpis"><div><b>${h(base.anchorCount)}</b><span>anchors</span></div><div><b>${h(base.validationAnchorCount)}</b><span>validation</span></div><div><b>${h(fmt(base.rmsResidualMm))} mm</b><span>RMS residual</span></div><div><b>${h(fmt(base.maxResidualMm))} mm</b><span>max residual</span></div><div><b>${h(toleranceRange(base.tolerancePolicy))}</b><span>OD-scaled tolerance</span></div><div><b>${h(fmt(base.weight?.total, 1))}/100</b><span>weight</span></div></div>
<p><b>Base:</b> ${h(base.baseId)} · <b>basis:</b> ${h(base.selectedBasisId)} · <b>minimum sin θ:</b> ${h(fmt(base.minimumAnchorSinAngle, 6))} · <b>max normalized residual:</b> ${h(fmt(base.maxNormalizedResidual, 4))}</p>${cap}${ambiguity}
<details><summary>Inspect transform evidence</summary><div class="ciiw-detail-grid"><div><b>Rotation matrix</b>${matrixMarkup(base.rotation)}</div><div><b>Translation</b><code>${h(translationMarkup(base.translation))}</code><p>Establishment anchors: ${h(base.establishmentAnchorCount)} · validation anchors: ${h(base.validationAnchorCount)}</p><p>Tolerance: ${h(base.tolerancePolicy?.factor ?? 2)} × SOURCE OD; OD is tolerance scale only.</p></div></div></details></section>`;
}
function runSummary(run) {
  const terminators = (run?.terminatorClasses || []).map((value) => String(value).split(':')[0]).filter(Boolean);
  return `${run?.axisLabel || 'SKEW'} · ${fmt(run?.totalLengthMm)} mm · ${run?.elementCount ?? '—'} element${Number(run?.elementCount) === 1 ? '' : 's'} · ${terminators.join('+') || 'terminator —'}`;
}
function runList(label, side) {
  const runs = side?.runs || [];
  if (!runs.length) return `<div><b>${h(label)}</b><p>No qualified PIPE run evidence.</p></div>`;
  return `<div><b>${h(label)}</b><ol class="ciiw-run-list">${runs.map((run) => `<li><span>${h(run.runId)}</span>${h(runSummary(run))}</li>`).join('')}</ol></div>`;
}
function mappingMarkup(selected) {
  const rows = selected?.mapping?.rows || [];
  if (!rows.length) return '<p>No selected compatible run mapping.</p>';
  return `<table class="ciiw-mini-grid"><thead><tr><th>SOURCE run</th><th>TARGET run</th><th>Length Δ</th><th>Terminator</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${h(item.sourceRunId)}</td><td>${h(item.targetRunId)}</td><td>${h(fmt(item.lengthDeltaMm))} mm</td><td>${item.terminatorsCompatible ? 'PASS' : 'REVIEW'}</td></tr>`).join('')}</tbody></table>`;
}
function methodBQualified(row) { return row?.basisMethod === 'METHOD_B_NETWORK' || row?.basisMethod === 'METHOD_A_AND_B'; }
function methodBMarkup(row) {
  const evidence = row?.methodB; const qualified = methodBQualified(row);
  if (!evidence) return `<section class="ciiw-method-card is-review"><div class="ciiw-method-title"><b>Method B — Network</b><span>UNAVAILABLE</span></div><p>No local pipe-run evidence is available.</p></section>`;
  const sourceRuns = evidence.source?.independentAxisRunCount ?? 0; const targetRuns = evidence.target?.independentAxisRunCount ?? 0;
  const gapPass = Number(row.winnerGap) >= Number(row.requiredWinnerGap);
  const mutualBest = Boolean(row.candidateGeneration?.mutualBest);
  const authorityStatus = qualified ? 'QUALIFIED' : 'REVIEW';
  const reason = evidence.status !== 'READY' ? evidence.reason
    : (!mutualBest ? 'STRUCTURAL_CANDIDATE_NOT_MUTUAL_BEST' : (!gapPass ? 'WINNER_GAP_GATE_NOT_MET' : 'QUALIFIED'));
  return `<section class="ciiw-method-card ${qualified ? '' : 'is-review'}"><div class="ciiw-method-title"><b>Method B — Network</b><span>${h(authorityStatus)}</span></div>
<div class="ciiw-method-kpis"><div><b>${h(sourceRuns)} / ${h(targetRuns)}</b><span>independent runs S/T</span></div><div><b>${h(evidence.weight?.compatibleDimension || '—')}</b><span>compatible dimension</span></div><div><b>${h(fmt(evidence.tolerancePolicy?.toleranceMm))} mm</b><span>OD-scaled tolerance</span></div><div><b>${h(fmt(row.methodBWeight?.total, 1))}/100</b><span>display weight</span></div><div><b>${h(fmt(row.winnerGap, 1))} / ${h(fmt(row.requiredWinnerGap, 1))}</b><span>winner gap</span></div><div><b>${mutualBest ? 'PASS' : 'REVIEW'}</b><span>mutual best</span></div></div>
<p><b>Run basis:</b> ${h(evidence.status)} · <b>authority:</b> ${h(authorityStatus)} · <b>reason:</b> ${h(reason)} · <b>candidate rank:</b> ${h(row.candidateGeneration?.sourceRank ?? '—')}/${h(row.candidateGeneration?.targetRank ?? '—')}</p>
<div class="ciiw-run-grid">${runList('SOURCE runs', evidence.source)}${runList('TARGET runs', evidence.target)}</div>
<details><summary>Inspect network evidence</summary><p>Compatible basis count: ${h(evidence.compatibleBasisCount ?? 0)} · compatible independent runs: ${h(evidence.weight?.compatibleIndependentRunCount ?? 0)} · maximum normalized geometric error: ${h(fmt(evidence.selectedBasis?.maxNormalizedGeometricError, 4))}</p>${mappingMarkup(evidence.selectedBasis)}</details></section>`;
}
function candidateMarkup(row, index, selectedKeys = new Set()) {
  const method = row?.basisMethod || 'LANDMARK_ONLY'; const key = ciiSuggestionSelectionKey(row);
  const qualifiedLoops = ciiQualifiedLoopsForSuggestion(row); const selected = selectedKeys.has(key);
  const exclusions = (row?.identityExclusions || []).map((item) => String(item).replace(/_/g, ' ').toLowerCase()).join(' · ');
  const corroboration = method === 'METHOD_A_AND_B' ? '<span class="ciiw-corroboration">A + B corroborated</span>' : '';
  const action = qualifiedLoops.length ? (selected ? 'Remove from base set' : `Add ${qualifiedLoops.length > 1 ? `${qualifiedLoops.length} OR bases` : 'base'}`) : 'Use manual anchor';
  return `<article class="ciiw-anchor-card ${h(methodClass(method))}" data-ciiw-evidence-card="${h(key)}" data-selected="${selected ? 'true' : 'false'}">
<header><div><span class="ciiw-anchor-index">B${index + 1}</span><h4>${h(row.sourceNodeId)} <span>↔</span> ${h(row.targetNodeId)}</h4></div><div class="ciiw-anchor-badges"><span class="ciiw-basis-badge">${h(methodLabel(method))}</span><span class="ciiw-confidence ${h(confidenceClass(row.confidence))}">${h(row.confidence || 'REVIEW')}</span>${corroboration}</div></header>
<p class="ciiw-candidate-line">Structural candidate score ${h(fmt(row.score, 1))} · rank ${h(row.candidateGeneration?.sourceRank ?? '—')}/${h(row.candidateGeneration?.targetRank ?? '—')} · winner gap ${h(fmt(row.winnerGap, 1))}/${h(fmt(row.requiredWinnerGap, 1))} · engineer review required${qualifiedLoops.length > 1 ? ' · A+B acceptance creates two independent OR loops' : ''}</p>
<div class="ciiw-method-grid">${methodAMarkup(row)}${methodBMarkup(row)}</div>
<footer><small>Identity exclusions: ${h(exclusions || 'node-number offset, OD identity and wall identity remain excluded')}</small><button type="button" data-ciiw-evidence-accept data-ciiw-base-action data-ciiw-selection-key="${h(key)}" data-source-node="${h(row.sourceNodeId)}" data-target-node="${h(row.targetNodeId)}">${h(action)}</button></footer></article>`;
}
function loopText(loop) {
  if (loop.method === 'METHOD_A_SPATIAL') return `METHOD A · ${loop.anchorPairs?.length || 0} anchor pairs · ${loop.baseId}`;
  const anchor = loop.anchorPairs?.[0]; return `METHOD B · ${anchor?.sourceNodeId || '—'} ↔ ${anchor?.targetNodeId || '—'}`;
}
function selectedBaseSetMarkup(inspection, selectedKeys) {
  const loops = buildCiiSelectedBaseLoops(inspection?.baseAnchorSuggestions || [], selectedKeys); const summary = ciiBaseSelectionSummary(loops);
  if (!loops.length) return `<section class="ciiw-base-set"><div><b>Accepted independent base set</b><span>None selected</span></div><p>Add one or more Method A / Method B candidates. Manual/Landmark anchors remain a separate fallback mode.</p></section>`;
  return `<section class="ciiw-base-set"><header><div><b>Accepted independent base set</b><span>${h(summary.loopCount)} loop${summary.loopCount === 1 ? '' : 's'} · A ${h(summary.methodA)} · B ${h(summary.methodB)}</span></div><span class="ciiw-corroboration">OR + conflict veto</span><button type="button" data-ciiw-clear-bases>Clear base set</button></header><ol>${loops.map((loop) => `<li><b>${h(loop.method === 'METHOD_A_SPATIAL' ? 'A' : 'B')}</b><span>${h(loopText(loop))}</span></li>`).join('')}</ol><p>Every READY loop contributes independently. Compatible duplicate identity corroborates; contradictory READY identity remains AMBIGUOUS.</p></section>`;
}
export function baseAnchorEvidenceMarkup(inspection, rawSelectedKeys = []) {
  const rows = inspection?.baseAnchorSuggestions || []; const selectedKeys = rawSelectedKeys instanceof Set ? rawSelectedKeys : new Set(rawSelectedKeys);
  if (!rows.length) return '<div class="ciiw-method-empty"><h3>Match Basis</h3><p>No method-qualified Base Anchor suggestion is available. Enter reviewed anchors manually.</p></div>';
  const high = rows.filter((row) => row.confidence === 'HIGH').length;
  const medium = rows.filter((row) => row.confidence === 'MEDIUM').length;
  const review = rows.length - high - medium;
  return `<div class="ciiw-method-head"><div><span class="ciiw-eyebrow">INPUTS &amp; MATCH BASIS</span><h3>Method-qualified Base Anchor review</h3><p>Method A and Method B remain independent OR evidence. Select several local bases when separate piping regions retained different correspondence geometry.</p></div><div class="ciiw-method-counts"><span><b>${high}</b> HIGH</span><span><b>${medium}</b> MEDIUM</span><span><b>${review}</b> REVIEW</span></div></div>${selectedBaseSetMarkup(inspection, selectedKeys)}<div class="ciiw-anchor-card-list">${rows.map((row, index) => candidateMarkup(row, index, selectedKeys)).join('')}</div>`;
}

function fileIdentity(input) { return input?.files?.[0]?.name || 'Not loaded'; }
function inspectionFunction(options) {
  return options?.writerVersion === '2' ? inspectCiiWorkspaceModelsWithVersionBridge : inspectCiiWorkspaceModels;
}
function addEngineeringChrome(container, legacy, options, selection) {
  const documentRef = container.ownerDocument; const sourceInput = container.querySelector('[data-ciiw-source]');
  const targetInput = container.querySelector('[data-ciiw-target]'); const inspectButton = container.querySelector('[data-ciiw-inspect]');
  const sourceManual = container.querySelector('[data-ciiw-source-anchors]'); const targetManual = container.querySelector('[data-ciiw-target-anchors]');
  const inputsPanel = container.querySelector('[data-ciiw-panel="inputs"]'); const closeButton = container.querySelector('[data-ciiw-close]');
  const status = container.querySelector('[data-ciiw-status]'); if (!sourceInput || !targetInput || !inspectButton || !inputsPanel) return () => {};
  container.setAttribute('data-ciiw-layout', 'full');
  const identity = documentRef.createElement('div'); identity.className = 'ciiw-identity-strip'; identity.setAttribute('data-ciiw-identity-strip', '1');
  const toggle = documentRef.createElement('button'); toggle.type = 'button'; toggle.className = 'ciiw-layout-toggle'; toggle.setAttribute('data-ciiw-layout-toggle', '1');
  const evidence = documentRef.createElement('section'); evidence.className = 'ciiw-method-evidence'; evidence.setAttribute('data-ciiw-method-evidence', '1');
  inputsPanel.appendChild(evidence); (closeButton?.parentNode || container).appendChild(identity); (closeButton?.parentNode || container).appendChild(toggle);
  let disposed = false; let layout = 'full';
  const getBaseLoops = () => buildCiiSelectedBaseLoops(selection.inspection?.baseAnchorSuggestions || [], selection.selectedKeys);
  const updateIdentity = () => {
    const current = legacy.getCurrentResult?.(); const summary = ciiBaseSelectionSummary(getBaseLoops());
    const writer = current?.writerVersion || options?.writerVersion || '1B';
    const readiness = current ? `Correspondence ${current.correspondence?.status || '—'} · Writer ${writer} ${current.writerReadiness?.status || '—'}`
      : (summary.loopCount ? `${summary.loopCount} independent base loop${summary.loopCount === 1 ? '' : 's'} selected · OR conflict veto`
        : (selection.inspection ? 'Match basis review' : 'Input required'));
    identity.innerHTML = `<div><span>SOURCE</span><b>${h(fileIdentity(sourceInput))}</b></div><span class="ciiw-identity-arrow">→</span><div><span>TARGET</span><b>${h(fileIdentity(targetInput))}</b></div><span class="ciiw-readiness">${h(readiness)}</span>`;
    toggle.textContent = layout === 'full' ? 'Compact view' : 'Full view';
  };
  const setLayout = (next) => { layout = next; container.setAttribute('data-ciiw-layout', layout); updateIdentity(); };
  const renderEvidence = () => {
    evidence.innerHTML = selection.inspection ? baseAnchorEvidenceMarkup(selection.inspection, selection.selectedKeys) : '';
    bindActions(); updateIdentity();
  };
  const clearSelection = (message, invalidate = true) => {
    if (!selection.selectedKeys.size) return; selection.selectedKeys.clear();
    if (invalidate) legacy.invalidateExternal?.(message); renderEvidence();
  };
  const findSuggestion = (key) => (selection.inspection?.baseAnchorSuggestions || []).find((row) => ciiSuggestionSelectionKey(row) === key);
  const useManualAnchor = async (row) => {
    selection.selectedKeys.clear(); legacy.invalidateExternal?.('Switched from independent qualified bases to legacy/manual anchor mode. Rebuild correspondence.');
    const legacyButton = [...container.querySelectorAll('[data-ciiw-accept-anchor]')]
      .find((item) => item.dataset.sourceNode === String(row.sourceNodeId) && item.dataset.targetNode === String(row.targetNodeId));
    if (legacyButton) await legacyButton.click(); renderEvidence();
  };
  function bindActions() {
    evidence.querySelectorAll('[data-ciiw-base-action]').forEach((button) => button.addEventListener('click', async () => {
      const key = button.dataset.ciiwSelectionKey; const row = findSuggestion(key); if (!row) return;
      const qualified = ciiQualifiedLoopsForSuggestion(row);
      if (!qualified.length) { await useManualAnchor(row); return; }
      if (selection.selectedKeys.has(key)) selection.selectedKeys.delete(key); else selection.selectedKeys.add(key);
      if (sourceManual) sourceManual.value = ''; if (targetManual) targetManual.value = '';
      legacy.invalidateExternal?.('Independent Base Anchor set changed. Rebuild correspondence using OR_WITH_CONFLICT_VETO.'); renderEvidence();
    }));
    evidence.querySelector('[data-ciiw-clear-bases]')?.addEventListener('click', () => {
      clearSelection('Independent Base Anchor set cleared. Select qualified bases or enter manual anchors before compare.');
    });
  }
  const inspectEvidence = async () => {
    try {
      selection.selectedKeys.clear(); selection.inspection = null; updateIdentity();
      const sourceFile = sourceInput.files?.[0]; const targetFile = targetInput.files?.[0]; if (!sourceFile || !targetFile) return;
      evidence.innerHTML = '<div class="ciiw-method-loading">Building Method A / Method B evidence…</div>';
      const inspectModels = inspectionFunction(options);
      const inspection = await inspectModels({
        sourceBytes: new Uint8Array(await sourceFile.arrayBuffer()), sourceFileName: sourceFile.name,
        targetBytes: new Uint8Array(await targetFile.arrayBuffer()), targetFileName: targetFile.name,
      }, { cryptoRef: options.cryptoRef });
      if (disposed) return; selection.inspection = inspection; renderEvidence();
    } catch (error) {
      if (!disposed) evidence.innerHTML = `<div class="ciiw-method-empty"><b>Evidence view unavailable</b><p>${h(error?.message || error)}</p></div>`;
    }
  };
  const clearForFileChange = () => { selection.inspection = null; selection.selectedKeys.clear(); evidence.innerHTML = ''; updateIdentity(); };
  const onInspect = () => { void inspectEvidence(); }; const onToggle = () => setLayout(layout === 'full' ? 'compact' : 'full');
  const onManual = () => { if (selection.selectedKeys.size) { selection.selectedKeys.clear(); renderEvidence(); } };
  sourceInput.addEventListener('change', clearForFileChange); targetInput.addEventListener('change', clearForFileChange);
  inspectButton.addEventListener('click', onInspect); toggle.addEventListener('click', onToggle);
  sourceManual?.addEventListener('input', onManual); targetManual?.addEventListener('input', onManual);
  const MutationObserverRef = documentRef.defaultView?.MutationObserver || globalThis.MutationObserver;
  const observer = status && MutationObserverRef ? new MutationObserverRef(updateIdentity) : null;
  observer?.observe(status, { childList: true, subtree: true, characterData: true }); updateIdentity();
  return () => {
    disposed = true; observer?.disconnect(); sourceInput.removeEventListener('change', clearForFileChange); targetInput.removeEventListener('change', clearForFileChange);
    inspectButton.removeEventListener('click', onInspect); toggle.removeEventListener('click', onToggle);
    sourceManual?.removeEventListener('input', onManual); targetManual?.removeEventListener('input', onManual);
  };
}

export function mountCiiWorkspaceEngineeringShell(container, options = {}) {
  const selection = { inspection: null, selectedKeys: new Set() };
  const getBaseLoops = () => buildCiiSelectedBaseLoops(selection.inspection?.baseAnchorSuggestions || [], selection.selectedKeys);
  const legacy = mountCiiWorkspaceShell(container, { ...options, getBaseLoops });
  const disposeChrome = addEngineeringChrome(container, legacy, options, selection);
  return {
    destroy() { disposeChrome(); legacy.destroy(); },
    getCurrentResult() { return legacy.getCurrentResult?.(); },
    getSelectedBaseLoops() { return getBaseLoops(); },
  };
}

export const _test = Object.freeze({
  methodLabel, methodClass, confidenceClass, toleranceRange, methodAMarkup, methodBMarkup, candidateMarkup, selectedBaseSetMarkup,
  inspectionFunction,
});
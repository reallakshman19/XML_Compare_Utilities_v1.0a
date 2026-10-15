/**
 * workbench3d-tab.js — "3D Compare Workbench" tab shell.
 *
 * Wires the contract pipeline together:
 *   file/paste → adapters → CanonicalObjectGraph.v1 → compare engine →
 *   CompareAudit.v1 → viewer/dashboard/tables → TransferPlan.v1 →
 *   approved apply → downloads.
 *
 * The tab renders view models only; all engine logic lives in workbench3d/
 * compare + adapters + apply modules.
 */

import { parseInputXmlRecords, XML_SCHEMA_KINDS } from '../adapters/inputxml-adapter.js';
import {
  closeImportedInputXmlReviewRuntime, createImportedInputXmlReviewCollection,
  importedInputXmlReviewReceiptJson, importedInputXmlReviewText, scheduleImportedInputXmlReview,
} from './imported-inputxml-review.js';
import { buildCanonicalGraph } from '../adapters/canonical-graph-builder.js';
import { buildVisualModel } from '../adapters/visual-model-builder.js';
import { runCompare } from '../compare/compare-engine.js';
import { DEFAULT_COMPARE_CONFIG } from '../compare/evidence-scorer.js';
import { buildTransferPlan, batchApprove, refreshTransferSummary, DEFAULT_TRANSFER_CONFIG } from '../compare/transfer-planner.js';
import { applyTransferPlan } from '../apply/transfer-apply.js';
import { applyTransferPlanToPsi } from '../apply/psi-transfer-apply.js';
import { dropPairProperty, dropPropertyGlobally } from './transfer-overlay-models.js';
import { canvasPivotHeaderHtml } from './canvas-pivot-header.js';
import { canvasHierarchyHtml } from './canvas-hierarchy-panel.js';
import { renderArrowLayer } from './transfer-arrow-layer.js';
import { updateArrowPopup } from './transfer-arrow-popup.js';
import { previewOverlayHtml, updateTransferPreviewLabels } from './transfer-preview-overlay.js';
import { downloadFile, rowsToCsv, DIFF_CSV_COLUMNS, CONFLICT_CSV_COLUMNS, TRANSFER_CSV_COLUMNS, PATH_CSV_COLUMNS } from '../apply/exporters.js';
import { compareWorkbenchProjectArtifacts } from '../project/compare-workbench-project-adapter.js';
import { createWorkbenchViewer, STATUS_STYLES } from '../viewer/workbench-viewer.js';
import { buildConnectorModel } from '../viewer/connector-model.js';
import {
  loadSettings, saveSettings, normalizeSettings, discoverPacketKinds, effectiveStatusStyles, packetKindVisible,
} from '../core/wb3d-settings.js';
import { settingsButtonHtml, settingsPanelHtml } from './settings-panel.js';
import { blockInspectorHtml, nodeInfoPanelHtml } from './block-inspector.js';
import { buildNodeInfoIndex } from '../adapters/node-resolver.js';
import {
  objectDiffPanelRows, conflictPanelRows, approvalPanelRows, applyPanelFilters, objectHoverTooltipLines,
} from './panel-view-models.js';
import { floatingPanelsHtml, panelToggleButtonsHtml, attachFloatingPanelDrag } from './floating-panels.js';
import { buildNodeSetGraph } from '../adapters/nodeset-adapter.js';
import { runNodeCompare } from '../compare/node-compare-engine.js';
import { buildHeatmapOverrides } from '../viewer/heatmap.js';
import {
  tableToXmlSection, handleTableToXmlClick, handleTableToXmlInput, handleTableToXmlFile,
  ensureTablexmlState, autoParseActiveTable, generateRevisionPair,
} from './table-to-xml-tab.js';
import { createDrilldownContext, resolveDrilldownRows, drilldownDomainFor, DRILLDOWN_CSV_COLUMNS } from './drilldown.js';
import { previewDrawerHtml } from './preview-drawer.js';
import { buildDashboardModels, dashboardViewHtml } from './dashboard-panel.js';
import { nodeWorkspaceHtml } from './node-workspace-panel.js';
import { evidencePanelHtml, connectorLedgerHtml } from './evidence-panel.js';
import { buildEvidenceModel, connectorLedgerModel, CONNECTOR_LEDGER_CSV_COLUMNS } from './evidence-view-models.js';
import { setupBannerHtml, setupWizardModel } from './setup-wizard.js';
import { detectProfile } from '../core/profiles.js';
import { validateCompareAudit, DIFF_STATUS, APPROVAL_STATUS, TRANSFER_RULES, CONFIDENCE } from '../contracts/contracts.js';

const STATE_KEY = '__workbench3dState';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function hexColor(int) { return `#${int.toString(16).padStart(6, '0')}`; }

function ensureState(container) {
  if (!container[STATE_KEY]) {
    container[STATE_KEY] = {
      sourceXml: '', targetXml: '', sourceName: '', targetName: '',
      importedInputXmlReview: createImportedInputXmlReviewCollection(),
      config: { ...DEFAULT_COMPARE_CONFIG, canonicalNormalization: true },
      transferConfig: { ...DEFAULT_TRANSFER_CONFIG },
      manualOverrides: [],
      graphs: null, visuals: null, audit: null, plan: null, applyResult: null,
      viewer: null, viewerError: null,
      selection: null, statusFilter: new Set(),
      settings: loadSettings(globalThis.localStorage),
      settingsOpen: false,
      panelColumnPicker: null,
      activeView: 'compare',
      nodeInfo: null,
      drilldown: null,
      dashboardGroupBy: 'line',
      dashboardModels: null,
      nodeVizMode: 'map',
      evidenceDiffId: null,
      profileOverride: null,
      wizardDismissed: false,
      wizardPinned: false,
      ignoredProps: [],
      status: 'Load a source and target XML/InputXML, then run compare.',
    };
  }
  return container[STATE_KEY];
}

function importedInputXmlReviewSource(state, side) {
  const sourceSide = side === 'target' ? 'target' : 'source';
  return Object.freeze({
    side: sourceSide,
    text: String(sourceSide === 'source' ? state.sourceXml : state.targetXml),
    filename: String(sourceSide === 'source' ? state.sourceName : state.targetName)
      || `${sourceSide}-pasted.input.xml`,
  });
}

function importedInputXmlReviewDownloadName(state, side, suffix) {
  const source = importedInputXmlReviewSource(state, side);
  const stem = source.filename.replace(/\.(xml|txt)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_')
    || `${source.side}-imported`;
  return `${stem}.${suffix}`;
}

function importedInputXmlReviewControlsHtml(state, side) {
  const source = importedInputXmlReviewSource(state, side);
  const review = state.importedInputXmlReview?.[side]
    ?? createImportedInputXmlReviewCollection()[side];
  const reviewText = importedInputXmlReviewText(source, review);
  const cls = review.status === 'PASS' ? 'is-ok' : review.status === 'FAILED' ? 'is-bad' : '';
  const message = review.status === 'PASS'
    ? `Validated companion: ${Number(review.result?.summary?.categorizedElements || 0)} categorized element(s).`
    : review.diagnostic?.message || (review.status === 'RUNNING'
      ? 'Generating read-only categorized review companion…'
      : 'Load or paste genuine CAESAR InputXML to generate a categorized review companion.');
  const receiptDisabled = review.status === 'IDLE' ? 'disabled' : '';
  const reviewDisabled = reviewText ? '' : 'disabled';
  return `<div class="wb3d-import-review" data-wb3d-import-review="${side}">
    <div><span class="wb3d-badge ${cls}">Categorized Review: ${esc(review.status)}</span>
      <span class="wb3d-muted">${esc(message)}</span></div>
    <div class="wb3d-toolbar">
      <button class="wb3d-btn" data-action="download-imported-inputxml-review" data-side="${side}" ${reviewDisabled}>Download review</button>
      <button class="wb3d-btn" data-action="download-imported-inputxml-review-receipt" data-side="${side}" ${receiptDisabled}>Download receipt</button>
    </div>
  </div>`;
}

function refreshImportedInputXmlReviewControls(container, state, side) {
  const host = container.querySelector(`[data-wb3d-import-review="${side}"]`);
  if (host) host.outerHTML = importedInputXmlReviewControlsHtml(state, side);
}

function scheduleWorkbenchImportedInputXmlReview(container, state, side, delayMs = 450) {
  const source = importedInputXmlReviewSource(state, side);
  return scheduleImportedInputXmlReview({
    container,
    state,
    side,
    text: source.text,
    filename: source.filename,
    delayMs,
    onChange: () => refreshImportedInputXmlReviewControls(container, state, side),
  });
}

function markerOptionsFromSettings(settings) {
  return {
    markerPlacement: settings.markerPlacement,
    packetMarkerKinds: Array.isArray(settings.tooltipPacketKinds) ? settings.tooltipPacketKinds : null,
    showAllNodes: settings.showAllNodes,
    nodeMarkerSizeMm: settings.nodeMarkerSizeMm,
  };
}

// ── pipeline actions ───────────────────────────────────────────────────────

function rebuildGraphs(state) {
  const tolerance = state.config.canonicalNormalization ? state.config.shortElementToleranceMm : 0;
  const src = parseInputXmlRecords(state.sourceXml);
  const tgt = parseInputXmlRecords(state.targetXml);
  if (src.schema === XML_SCHEMA_KINDS.UNKNOWN) throw new Error(`Source: ${src.warnings.join(' ')}`);
  if (tgt.schema === XML_SCHEMA_KINDS.UNKNOWN) throw new Error(`Target: ${tgt.warnings.join(' ')}`);
  const srcIsNodeset = src.schema === XML_SCHEMA_KINDS.NODESET_XML;
  const tgtIsNodeset = tgt.schema === XML_SCHEMA_KINDS.NODESET_XML;
  if (srcIsNodeset !== tgtIsNodeset) throw new Error('Source and target schemas mix piping and node-set XML — both sides must be the same kind.');
  const graphA = srcIsNodeset ? buildNodeSetGraph('source', state.sourceXml) : buildCanonicalGraph('source', src.records, { shortElementToleranceMm: tolerance });
  const graphB = tgtIsNodeset ? buildNodeSetGraph('target', state.targetXml) : buildCanonicalGraph('target', tgt.records, { shortElementToleranceMm: tolerance });
  state.graphs = { A: graphA, B: graphB, sourceSchema: src.schema, targetSchema: tgt.schema, warnings: [...src.warnings, ...tgt.warnings] };
  rebuildVisuals(state);
}

function rebuildVisuals(state) {
  if (!state.graphs) return;
  const options = markerOptionsFromSettings(state.settings);
  state.visuals = { A: buildVisualModel(state.graphs.A, options), B: buildVisualModel(state.graphs.B, options) };
  state.nodeInfo = { A: buildNodeInfoIndex(state.graphs.A), B: buildNodeInfoIndex(state.graphs.B) };
}

function isNodeCompare(state) {
  return state.graphs?.A?.graphKind === 'nodeset' && state.graphs?.B?.graphKind === 'nodeset';
}

function runComparePipeline(state) {
  rebuildGraphs(state);
  const profileId = state.profileOverride
    ?? detectProfile({ schema: state.graphs.sourceSchema, headers: state.tablexml?.tables?.[state.tablexml.active]?.parsed?.headers ?? [] });
  const ignoredProps = state.ignoredProps ?? [];
  state.audit = isNodeCompare(state)
    ? runNodeCompare(state.graphs.A, state.graphs.B, { ...(state.config.nodeCompare ?? {}), profileId, ignoredProps }, state.manualOverrides)
    : runCompare(state.graphs.A, state.graphs.B, { ...state.config, ignoredProps }, state.manualOverrides);
  const contractErrors = validateCompareAudit(state.audit);
  if (contractErrors.length) throw new Error(`CompareAudit contract violation: ${contractErrors[0]}`);
  state.plan = null;
  state.applyResult = null;
  state.selection = null;
  state.evidenceDiffId = null;
  state.drilldown = null;
  state.status = `Compared ${state.audit.summary.sourceCanonicalElements} source vs ${state.audit.summary.targetCanonicalElements} target canonical element(s): ${state.audit.summary.matchedElements} matched, ${state.audit.summary.ambiguousElements} ambiguous, ${state.audit.summary.conflictCount} conflict row(s).`;
}

function statusMapForViewer(state) {
  const map = new Map();
  if (!state.audit) return map;
  for (const row of state.audit.objectDiff.rows) {
    if (row.sourceObjectId) map.set(row.sourceObjectId, row.status);
    if (row.targetObjectId) map.set(row.targetObjectId, row.status);
  }
  return map;
}

function connectorModelFor(state) {
  if (!state.audit || !state.visuals) return { connectors: [] };
  return buildConnectorModel({
    compareAudit: state.audit,
    transferPlan: state.plan,
    sourceVisual: state.visuals.A,
    targetVisual: state.visuals.B,
    sourceGraph: state.graphs.A,
    targetGraph: state.graphs.B,
  });
}

function pushConnectors(state) {
  state.connectorModel = connectorModelFor(state);
  state.viewer?.setConnectors(state.connectorModel);
}

/** Matched counterpart / candidates / transfer receivers for an object. */
function relatedIdsFor(state, objectId) {
  const related = new Set();
  for (const row of state.audit?.objectDiff.rows ?? []) {
    if (row.sourceObjectId === objectId) {
      if (row.targetObjectId) related.add(row.targetObjectId);
      for (const cid of row.candidateTargetIds ?? []) related.add(cid);
    }
    if (row.targetObjectId === objectId && row.sourceObjectId) related.add(row.sourceObjectId);
  }
  return [...related];
}

function transferReadiness(state) {
  if (!state.plan) return { ready: 0, blocked: 0 };
  const byApproval = (statuses) => new Set(state.plan.rows.filter((r) => statuses.includes(r.approval)).map((r) => r.targetObjectId)).size;
  return {
    ready: byApproval([APPROVAL_STATUS.PENDING, APPROVAL_STATUS.APPROVED]),
    blocked: byApproval([APPROVAL_STATUS.BLOCKED]),
  };
}

// ── section renderers ─────────────────────────────────────────────────────

function importSection(state) {
  // Schema detection is a full parse; cache per side so re-renders don't
  // re-parse multi-MB documents just to draw the badge.
  const detectedSchema = (side, xml) => {
    const cache = state._schemaCache ?? (state._schemaCache = {});
    if (!cache[side] || cache[side].xml !== xml) cache[side] = { xml, kind: parseInputXmlRecords(xml).schema };
    return cache[side].kind;
  };
  const schemaBadge = (label, side, xml) => {
    if (!xml) return `<span class="wb3d-badge">${label}: none</span>`;
    const kind = detectedSchema(side, xml);
    const cls = kind === XML_SCHEMA_KINDS.UNKNOWN ? 'is-bad' : 'is-ok';
    return `<span class="wb3d-badge ${cls}">${label}: ${kind}</span>`;
  };
  return `
  <section class="wb3d-card">
    <h3>Import <span class="wb3d-muted">source (property donor) and target (receiver)</span></h3>
    <div class="wb3d-import-grid">
      <div>
        <label class="wb3d-file">Source XML/InputXML <input type="file" data-action="load-file" data-side="source" accept=".xml,.txt,text/xml,application/xml,text/plain"></label>
        ${schemaBadge('Detected', 'source', state.sourceXml)} ${state.sourceName ? `<span class="wb3d-muted">${esc(state.sourceName)}</span>` : ''}
        ${importedInputXmlReviewControlsHtml(state, 'source')}
        <textarea data-field="sourceXml" spellcheck="false" placeholder="…or paste source XML here">${esc(state.sourceXml.length > 400000 ? '' : state.sourceXml)}</textarea>
      </div>
      <div>
        <label class="wb3d-file">Target XML/InputXML <input type="file" data-action="load-file" data-side="target" accept=".xml,.txt,text/xml,application/xml,text/plain"></label>
        ${schemaBadge('Detected', 'target', state.targetXml)} ${state.targetName ? `<span class="wb3d-muted">${esc(state.targetName)}</span>` : ''}
        ${importedInputXmlReviewControlsHtml(state, 'target')}
        <textarea data-field="targetXml" spellcheck="false" placeholder="…or paste target XML here">${esc(state.targetXml.length > 400000 ? '' : state.targetXml)}</textarea>
      </div>
    </div>
    <div class="wb3d-toolbar">
      <label>Short/consume tol mm <input type="number" data-config="shortElementToleranceMm" value="${state.config.shortElementToleranceMm}" step="1"></label>
      <label>Length tol mm <input type="number" data-config="lengthToleranceMm" value="${state.config.lengthToleranceMm}" step="1"></label>
      <label>Min score <input type="number" data-config="minCandidateScore" value="${state.config.minCandidateScore}" step="1"></label>
      <label>Ambiguity gap <input type="number" data-config="ambiguityGap" value="${state.config.ambiguityGap}" step="1"></label>
      <label class="wb3d-check"><input type="checkbox" data-config="canonicalNormalization" ${state.config.canonicalNormalization ? 'checked' : ''}> canonical normalization (raw when off)</label>
      <button class="wb3d-btn wb3d-btn-primary" data-action="run-compare">Run Compare</button>
    </div>
  </section>`;
}

function dashboardSection(state) {
  if (!state.audit) return '<section class="wb3d-card"><h3>Variance dashboard</h3><p class="wb3d-muted">Run a compare to populate the dashboard.</p></section>';
  const s = state.audit.summary;
  const readiness = transferReadiness(state);
  const clickable = (label, value, status) => `
    <button class="wb3d-tile ${status ? `wb3d-tile-${status}` : ''} ${status && state.statusFilter.has(status) ? 'is-active' : ''}" ${status ? `data-action="toggle-status-filter" data-status="${status}"` : 'disabled'}>
      <strong>${value ?? 0}</strong><span>${label}</span>
    </button>`;
  const plain = (label, value) => `<div class="wb3d-tile"><strong>${value ?? 0}</strong><span>${label}</span></div>`;
  const warnings = state.audit.registration.warnings ?? [];
  return `
  <section class="wb3d-card">
    <h3>Variance dashboard <span class="wb3d-muted">tiles with a colored bar filter the 3D view + tables</span></h3>
    ${warnings.length ? `<div class="wb3d-alert">⚠ ${warnings.map(esc).join('<br>⚠ ')}</div>` : ''}
    <div class="wb3d-tiles">
      ${plain('Source raw', s.sourceRawElements)}
      ${plain('Target raw', s.targetRawElements)}
      ${plain('Source canonical', s.sourceCanonicalElements)}
      ${plain('Target canonical', s.targetCanonicalElements)}
      ${plain('Consumed src', s.consumedSourceElements)}
      ${plain('Consumed tgt', s.consumedTargetElements)}
      ${plain('Paths src/tgt', `${s.sourcePaths}/${s.targetPaths}`)}
      ${plain('Matched paths', s.matchedPaths)}
      ${plain('Matched elements', s.matchedElements)}
      ${clickable('Unchanged', s.unchangedElements, DIFF_STATUS.MATCHED_UNCHANGED)}
      ${clickable('Property changed', s.propertyChangedElements, DIFF_STATUS.PROPERTY_CHANGED)}
      ${clickable('Geometry changed', s.geometryChangedElements, DIFF_STATUS.GEOMETRY_CHANGED)}
      ${clickable('Missing in target', s.missingInTarget, DIFF_STATUS.MISSING_IN_TARGET)}
      ${clickable('New in target', s.newInTarget, DIFF_STATUS.NEW_IN_TARGET)}
      ${clickable('Ambiguous', s.ambiguousElements, DIFF_STATUS.AMBIGUOUS)}
      ${clickable('Split', s.splitElements, DIFF_STATUS.SPLIT)}
      ${clickable('Merge', s.mergeElements, DIFF_STATUS.MERGE)}
      ${plain('High conf', s.highConfidenceElements)}
      ${plain('Medium conf', s.mediumConfidenceElements)}
      ${plain('Low conf', s.lowConfidenceElements)}
      ${plain('Evidence conflicts', s.evidenceConflictElements)}
      ${plain('Conflict rows', s.conflictCount)}
      ${plain('Avg score', s.averageMatchScore)}
      ${plain('Reg anchors', s.registrationAnchorCount)}
      ${plain('Reg residual max', s.registrationResidualMaxMm ?? 'n/a')}
      ${plain('Transfer-ready elems', readiness.ready)}
      ${plain('Transfer-blocked elems', readiness.blocked)}
      ${s.keyMatchedElements !== undefined ? plain('Key-matched (ref/id)', s.keyMatchedElements) : ''}
      ${s.loadChangedElements !== undefined ? plain('Load changed', s.loadChangedElements) : ''}
      ${s.maxLoadDeltaPct !== undefined ? plain('Max load Δ %', s.maxLoadDeltaPct) : ''}
      ${s.measureChangedElements ? plain('Measure changed', s.measureChangedElements) : ''}
      ${s.maxMeasureDeltaPct ? plain('Max measure Δ %', s.maxMeasureDeltaPct) : ''}
      ${s.remarkFlaggedElements !== undefined ? plain('Remark flagged', s.remarkFlaggedElements) : ''}
    </div>
  </section>`;
}

/** Rule-based alerts derived from CompareAudit + TransferPlan (function 12). */
function buildAlerts(state) {
  if (!state.audit) return [];
  const s = state.audit.summary;
  const rows = state.audit.objectDiff.rows;
  const idsWhere = (predicate) => rows.flatMap((r) => [r.sourceObjectId, r.targetObjectId].filter(Boolean).filter(() => predicate(r)));
  const alerts = [];
  for (const warning of state.audit.registration.warnings ?? []) {
    alerts.push({ severity: 'HIGH', rule: 'REGISTRATION_RESIDUAL', message: warning, isolateIds: [] });
  }
  if (s.ambiguousElements > 0) alerts.push({ severity: 'HIGH', rule: 'AMBIGUOUS_MATCH', message: `${s.ambiguousElements} ambiguous element(s) — transfer blocked until resolved.`, isolateIds: idsWhere((r) => r.status === DIFF_STATUS.AMBIGUOUS) });
  if (s.geometryChangedElements > 0) alerts.push({ severity: 'MEDIUM', rule: 'GEOMETRY_CONFLICT', message: `${s.geometryChangedElements} matched element(s) have geometry differences.`, isolateIds: idsWhere((r) => r.status === DIFF_STATUS.GEOMETRY_CHANGED) });
  if (s.lowConfidenceElements > 0) alerts.push({ severity: 'MEDIUM', rule: 'WEAK_MATCH', message: `${s.lowConfidenceElements} match(es) at LOW confidence.`, isolateIds: idsWhere((r) => r.confidence === 'LOW') });
  if (s.evidenceConflictElements > 0) alerts.push({ severity: 'MEDIUM', rule: 'EVIDENCE_CONFLICT', message: `${s.evidenceConflictElements} match(es) carry conflicting evidence.`, isolateIds: [] });
  if (s.missingInTarget > 0) alerts.push({ severity: 'MEDIUM', rule: 'MISSING_IN_TARGET', message: `${s.missingInTarget} source element(s) have no target counterpart.`, isolateIds: idsWhere((r) => r.status === DIFF_STATUS.MISSING_IN_TARGET) });
  if ((s.loadChangedElements ?? 0) > 0) {
    alerts.push({
      severity: (s.maxLoadDeltaPct ?? 0) >= 25 ? 'HIGH' : 'MEDIUM',
      rule: 'LOAD_CHANGED',
      message: `${s.loadChangedElements} node(s) have load changes (max Δ ${s.maxLoadDeltaPct?.toFixed?.(0) ?? '?'}%).`,
      isolateIds: idsWhere((r) => (r.loadDeltaPct ?? 0) > 0.01),
    });
  }
  if ((s.remarkFlaggedElements ?? 0) > 0) {
    alerts.push({
      severity: 'MEDIUM',
      rule: 'REMARK_FLAGS',
      message: `${s.remarkFlaggedElements} node(s) carry remark flags (line/PS change, hold removed, …).`,
      isolateIds: idsWhere((r) => r.remarkFlags?.length),
    });
  }
  if ((s.measureChangedElements ?? 0) > 0) {
    alerts.push({
      severity: (s.maxMeasureDeltaPct ?? 0) >= 25 ? 'HIGH' : 'MEDIUM',
      rule: 'MEASURE_CHANGED',
      message: `${s.measureChangedElements} node(s) have measure changes (max Δ ${s.maxMeasureDeltaPct?.toFixed?.(0) ?? '?'}%).`,
      isolateIds: idsWhere((r) => (r.measureDeltaPct ?? 0) > 0.01),
    });
  }
  const blockedRows = (state.plan?.rows ?? []).filter((r) => r.approval === APPROVAL_STATUS.BLOCKED);
  if (blockedRows.length) alerts.push({ severity: 'MEDIUM', rule: 'TRANSFER_BLOCKED', message: `${blockedRows.length} transfer row(s) blocked by rule/confidence gates.`, isolateIds: [...new Set(blockedRows.map((r) => r.targetObjectId))] });
  if (state.audit.pathAudit.unmatchedSourcePaths.length || state.audit.pathAudit.unmatchedTargetPaths.length) {
    alerts.push({ severity: 'LOW', rule: 'UNMATCHED_PATHS', message: `Unmatched paths — source: ${state.audit.pathAudit.unmatchedSourcePaths.length}, target: ${state.audit.pathAudit.unmatchedTargetPaths.length}.`, isolateIds: [] });
  }
  return alerts;
}

function alertsSection(state) {
  if (!state.audit) return '';
  const alerts = buildAlerts(state);
  if (!alerts.length) return '<section class="wb3d-card"><h3>Rule alerts</h3><p class="wb3d-muted">No rule alerts — clean compare.</p></section>';
  const rows = alerts.map((a, i) => `
    <li class="wb3d-alert-row wb3d-alert-${a.severity}">
      <span class="wb3d-badge">${esc(a.severity)}</span>
      <span class="wb3d-badge">${esc(a.rule)}</span>
      <span>${esc(a.message)}</span>
      ${a.isolateIds.length ? `<button class="wb3d-btn wb3d-btn-mini" data-action="isolate-ids" data-alert-index="${i}">Show in 3D (${a.isolateIds.length})</button>` : ''}
    </li>`).join('');
  return `<section class="wb3d-card"><h3>Rule alerts <span class="wb3d-muted">${alerts.length} active rule(s)</span></h3><ul class="wb3d-alerts">${rows}</ul></section>`;
}

function legendHtml(state) {
  const styles = effectiveStatusStyles(state.settings, STATUS_STYLES);
  return Object.values(styles)
    .map((style) => `<span class="wb3d-legend-item"><i style="background:${style.colorHex};opacity:${style.alpha}"></i>${esc(style.label)}</span>`)
    .join('');
}

function viewerSection(state) {
  return `
  <section class="wb3d-card">
    <h3>3D visual compare</h3>
    <div class="wb3d-toolbar">
      <div class="wb3d-seg" role="group">
        <button class="wb3d-btn" data-action="set-mode" data-mode="overlay">Overlay</button>
        <button class="wb3d-btn" data-action="set-mode" data-mode="side-by-side">Side-by-side</button>
        <button class="wb3d-btn" data-action="set-mode" data-mode="diff-only">Diff-only</button>
      </div>
      <div class="wb3d-seg" role="group">
        <button class="wb3d-btn" data-action="set-view" data-view="iso">Iso</button>
        <button class="wb3d-btn" data-action="set-view" data-view="top">Top</button>
        <button class="wb3d-btn" data-action="set-view" data-view="front">Front</button>
        <button class="wb3d-btn" data-action="set-view" data-view="side">Side</button>
      </div>
      <button class="wb3d-btn" data-action="fit-all">Fit all</button>
      <button class="wb3d-btn" data-action="clear-isolation">Clear isolation</button>
      <label>Connectors <select data-action="connector-mode">
        <option value="selection" selected>On selection</option>
        <option value="matches">All matches</option>
        <option value="candidates">All candidates</option>
        <option value="conflicts">Conflicts</option>
        <option value="transfer">Transfer</option>
        <option value="registration">Registration anchors</option>
        <option value="hidden">Hidden</option>
      </select></label>
      <label>Ghost opacity <input type="range" min="5" max="100" value="32" data-action="set-opacity"></label>
      ${settingsButtonHtml()}
      <span class="wb3d-seg" role="group" data-wb3d-panel-toggles>${panelToggleButtonsHtml(state)}</span>
    </div>
    <div data-wb3d-settings-host>${settingsPanelHtml(state, discoverPacketKinds(state.graphs?.A, state.graphs?.B), effectiveStatusStyles(state.settings, STATUS_STYLES))}</div>
    <div class="wb3d-viewer-row">
      <div class="wb3d-canvas-host" data-wb3d-canvas>
        <div class="wb3d-connector-tip" data-wb3d-connector-tip hidden></div>
        <div class="wb3d-connector-tip wb3d-hover-tip" data-wb3d-hover-tip hidden></div>
        <div class="wb3d-approval-overlay" data-wb3d-approval-overlay hidden></div>
        <svg class="wb3d-arrow-layer" data-wb3d-arrow-layer style="display:none"></svg>
        <div class="wb3d-preview-labels" data-wb3d-preview-labels></div>
        <div class="wb3d-arrow-popup" data-wb3d-arrow-popup hidden></div>
        <div class="wb3d-canvas-pivot" data-wb3d-canvas-pivot>${canvasPivotHeaderHtml(state)}</div>
        <div class="wb3d-canvas-tree ${state.canvasTreeOpen === false ? 'is-closed' : ''}" data-wb3d-canvas-tree>${canvasHierarchyHtml(state)}</div>
        <div class="wb3d-preview-overlay" data-wb3d-preview-overlay></div>
        ${state.viewerError ? `<div class="wb3d-viewer-fallback">3D viewer unavailable: ${esc(state.viewerError)}<br>All compare data remains available in the tables below.</div>` : ''}
      </div>
      <aside class="wb3d-selection" data-wb3d-selection>${selectionPanelHtml(state)}</aside>
    </div>
    <div class="wb3d-legend">${legendHtml(state)}</div>
  </section>`;
}

function selectionPanelHtml(state) {
  if (!state.selection || !state.graphs) return '<p class="wb3d-muted">Click an element or node in the 3D view (or a table row) to inspect it.</p>';
  // Node selection: show the node-wise resolver panel.
  if (!state.selection.objectId && state.selection.nodeId) {
    const preferred = state.selection.modelId === 'target' ? ['B', 'A'] : ['A', 'B'];
    for (const side of preferred) {
      const info = state.nodeInfo?.[side]?.get(state.selection.nodeId);
      if (info) return `<div class="wb3d-badge">${side === 'A' ? 'source' : 'target'} node</div>${nodeInfoPanelHtml(info)}`;
    }
    return nodeInfoPanelHtml(null);
  }
  const { objectId } = state.selection;
  const graph = objectId.startsWith('source:') ? state.graphs.A : state.graphs.B;
  const object = graph.objects.find((o) => o.objectId === objectId);
  if (!object) return '<p class="wb3d-muted">Selection no longer exists (re-run compare?).</p>';
  const diffRow = state.audit?.objectDiff.rows.find((r) => r.sourceObjectId === objectId || r.targetObjectId === objectId);
  const counterpartId = diffRow ? (diffRow.sourceObjectId === objectId ? diffRow.targetObjectId : diffRow.sourceObjectId) : null;
  const breakdown = (diffRow?.breakdown ?? []).map((b) => `<li>${esc(b.evidence)}: ${b.earned}/${b.weight} <em>${esc(b.detail)}</em></li>`).join('');
  const candidates = (diffRow?.candidateTargetIds ?? []).map((tid) => `
    <li>${esc(tid)} <button class="wb3d-btn wb3d-btn-mini" data-action="manual-link" data-source="${esc(diffRow.sourceObjectId)}" data-target="${esc(tid)}">Link</button></li>`).join('');
  const transferRows = (state.plan?.rows ?? []).filter((r) => r.sourceObjectId === objectId || r.targetObjectId === objectId);
  const transferHtml = transferRows.map((r) => `
    <li class="${r.approval === APPROVAL_STATUS.BLOCKED ? 'is-blocked' : ''}">${esc(r.property)}: "${esc(r.oldValue)}" → "${esc(r.newValue)}" <em>${esc(r.approval)}${r.blockedReason ? ` — ${esc(r.blockedReason)}` : ''}</em></li>`).join('');
  return `
    <h4>${esc(objectId)} <span class="wb3d-badge">${esc(object.kind)}</span> ${diffRow ? `<span class="wb3d-badge" style="background:${hexColor((STATUS_STYLES[diffRow.status] ?? STATUS_STYLES.GHOST).color)}33">${esc(diffRow.status)}</span>` : ''}</h4>
    <div class="wb3d-kv">
      <div>FROM→TO</div><div>${esc(object.canonicalFromTo)}</div>
      <div>Length</div><div>${object.lengthMm} mm</div>
      <div>Diameter</div><div>${object.diameterMm ?? '—'} mm</div>
      <div>Path</div><div>${esc(object.pathId)} @ ${object.stationMm} mm</div>
      ${object.lineId ? `<div>Line</div><div>${esc(object.lineId)}</div>` : ''}
      ${diffRow?.score != null ? `<div>Score / gap</div><div>${diffRow.score} / ${diffRow.scoreGap ?? '—'} (${esc(diffRow.confidence)})</div>` : ''}
      ${diffRow?.geometryIssue ? `<div>Geometry</div><div>${esc(diffRow.geometryIssue)}</div>` : ''}
    </div>
    ${counterpartId ? `<button class="wb3d-btn wb3d-btn-mini" data-action="select-object" data-object="${esc(counterpartId)}">Go to matched ${esc(counterpartId)}</button>
      <button class="wb3d-btn wb3d-btn-mini" data-action="manual-reject" data-source="${esc(diffRow.sourceObjectId)}" data-target="${esc(diffRow.targetObjectId)}">Reject match</button>` : ''}
    ${candidates ? `<h5>Ambiguous candidates</h5><ul class="wb3d-list">${candidates}</ul>` : ''}
    ${breakdown ? `<h5>Evidence</h5><ul class="wb3d-list">${breakdown}</ul>` : ''}
    ${(diffRow?.changedProperties ?? []).length ? `<h5>Changed properties</h5><ul class="wb3d-list">${diffRow.changedProperties.map((c) => `<li>${esc(c.property)}: "${esc(c.sourceValue)}" vs "${esc(c.targetValue)}"</li>`).join('')}</ul>` : ''}
    <h5>Blocks</h5>${blockInspectorHtml(object)}
    ${transferHtml ? `<h5>Transfer rows (before → after)</h5><ul class="wb3d-list">${transferHtml}</ul>` : ''}`;
}

/** Filtered rows for the three floating panels (+ unfiltered for chip rows). */
function floatingPanelRows(state) {
  const diffAll = objectDiffPanelRows(state.audit);
  const confAll = conflictPanelRows(state.audit);
  const approvalAll = approvalPanelRows(state.plan);
  const panels = state.settings.panels;
  return {
    objectDiff: applyPanelFilters(diffAll, panels.objectDiff),
    objectDiffUnfiltered: diffAll,
    conflicts: applyPanelFilters(confAll, panels.conflicts),
    conflictsUnfiltered: confAll,
    approval: approvalAll,
    approvalUnfiltered: approvalAll,
  };
}

/** ✓/✗ approval overlay over the canvas for the selected node object. */
function updateApprovalOverlay(container, state) {
  const overlay = container.querySelector('[data-wb3d-approval-overlay]');
  if (!overlay) return;
  const objectId = state.selection?.objectId;
  const eligible = objectId && state.viewer && state.audit && state.plan
    && state.plan.rows.some((r) => r.targetObjectId === objectId || r.sourceObjectId === objectId);
  if (!eligible) { overlay.hidden = true; return; }
  const diffRow = state.audit.objectDiff.rows.find((r) => r.sourceObjectId === objectId || r.targetObjectId === objectId);
  const targetId = diffRow?.targetObjectId;
  if (!targetId) { overlay.hidden = true; return; }
  const graph = targetId.startsWith('source:') ? state.graphs.A : state.graphs.B;
  const object = graph.objects.find((o) => o.objectId === targetId);
  const node = graph.nodes.find((n) => n.nodeId === object?.fromNode);
  if (!node) { overlay.hidden = true; return; }
  const screen = state.viewer.worldToScreen(node.coordMm);
  if (!screen) { overlay.hidden = true; return; }
  overlay.hidden = false;
  overlay.style.left = `${Math.round(screen.x)}px`;
  overlay.style.top = `${Math.round(screen.y - 34)}px`;
  overlay.innerHTML = `
    <button class="wb3d-btn wb3d-btn-mini" data-action="approve-element" data-object="${esc(targetId)}" data-approval="APPROVED" title="Approve all transfer rows for ${esc(stripModelPrefixLocal(targetId))}">✔</button>
    <button class="wb3d-btn wb3d-btn-mini" data-action="approve-element" data-object="${esc(targetId)}" data-approval="REJECTED" title="Reject all transfer rows">✖</button>`;
}

function stripModelPrefixLocal(id) {
  return String(id ?? '').replace(/^(source|target):/, '');
}

function tableHtml(columns, rows, { rowAttrs = () => '', limit = 300 } = {}) {
  if (!rows?.length) return '<p class="wb3d-muted">No rows.</p>';
  const shown = rows.slice(0, limit);
  const cell = (value) => esc(Array.isArray(value) ? value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)).join('; ') : (typeof value === 'object' && value !== null ? JSON.stringify(value) : value));
  return `<div class="wb3d-table-wrap"><table><thead><tr>${columns.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${shown.map((row) => `<tr ${rowAttrs(row)}>${columns.map(([k]) => `<td>${cell(row?.[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${rows.length > limit ? `<p class="wb3d-muted">Showing ${limit} of ${rows.length} rows — full data in exports.</p>` : ''}</div>`;
}

function filteredDiffRows(state) {
  const rows = state.audit?.objectDiff.rows ?? [];
  if (!state.statusFilter.size) return rows;
  return rows.filter((r) => state.statusFilter.has(r.status));
}

function tablesSection(state) {
  if (!state.audit) return '';
  const diffRows = filteredDiffRows(state);
  const conflictRows = state.audit.conflictLedger.rows;
  const conflictActions = (row) => row.kind === 'AMBIGUOUS_MATCH'
    ? `data-action="select-object" data-object="${esc(row.sourceObjectId)}" class="wb3d-row-click"`
    : (row.sourceObjectId ? `data-action="select-object" data-object="${esc(row.sourceObjectId)}" class="wb3d-row-click"` : '');
  return `
  <details class="wb3d-card" open>
    <summary><h3>Object diff <span class="wb3d-muted">${diffRows.length} row(s)${state.statusFilter.size ? ' (filtered)' : ''} — click a row to inspect</span></h3></summary>
    ${tableHtml(DIFF_CSV_COLUMNS, diffRows, { rowAttrs: (r) => `data-action="select-object" data-object="${esc(r.sourceObjectId || r.targetObjectId)}" class="wb3d-row-click"` })}
  </details>
  <details class="wb3d-card">
    <summary><h3>Path alignment audit <span class="wb3d-muted">${state.audit.pathAudit.alignmentRows.length} operation(s)</span></h3></summary>
    ${tableHtml(PATH_CSV_COLUMNS, state.audit.pathAudit.alignmentRows)}
  </details>
  <details class="wb3d-card" ${conflictRows.length ? 'open' : ''}>
    <summary><h3>Conflicts <span class="wb3d-muted">${conflictRows.length} row(s) — click ambiguous rows to resolve in the panel</span></h3></summary>
    ${tableHtml(CONFLICT_CSV_COLUMNS, conflictRows, { rowAttrs: conflictActions })}
  </details>
  <details class="wb3d-card">
    <summary><h3>Normalization audit <span class="wb3d-muted">consumed short/zero elements</span></h3></summary>
    <h4>Source</h4>${tableHtml([['elementName', 'Element'], ['fromTo', 'FROM→TO'], ['retainedNode', 'Retained'], ['droppedNode', 'Dropped'], ['lengthMm', 'Len mm'], ['packetEvidence', 'Packets'], ['action', 'Action']], state.audit.normalization.source.consumedRows)}
    <h4>Target</h4>${tableHtml([['elementName', 'Element'], ['fromTo', 'FROM→TO'], ['retainedNode', 'Retained'], ['droppedNode', 'Dropped'], ['lengthMm', 'Len mm'], ['packetEvidence', 'Packets'], ['action', 'Action']], state.audit.normalization.target.consumedRows)}
  </details>
  ${connectorLedgerHtml(state)}`;
}

function transferSection(state) {
  if (!state.audit) return '';
  const plan = state.plan;
  const approveButtons = (row) => row.approval === APPROVAL_STATUS.BLOCKED
    ? `<span class="wb3d-muted">${esc(row.blockedReason)}</span>`
    : `<button class="wb3d-btn wb3d-btn-mini" data-action="approve-row" data-row="${esc(row.rowId)}" ${row.approval === APPROVAL_STATUS.APPROVED ? 'disabled' : ''}>Approve</button>
       <button class="wb3d-btn wb3d-btn-mini" data-action="reject-row" data-row="${esc(row.rowId)}" ${row.approval === APPROVAL_STATUS.REJECTED ? 'disabled' : ''}>Reject</button>`;
  const columns = [...TRANSFER_CSV_COLUMNS.filter(([k]) => k !== 'blockedReason'), ['__actions', 'Actions']];
  const rows = (plan?.rows ?? []).map((r) => ({ ...r, __actions: approveButtons(r) }));
  return `
  <section class="wb3d-card">
    <h3>Transfer preview &amp; approval <span class="wb3d-muted">planner never edits XML; apply exports a modified copy</span></h3>
    <div class="wb3d-toolbar">
      <label>Rule <select data-transfer-config="rule">${Object.values(TRANSFER_RULES).map((r) => `<option ${state.transferConfig.rule === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>Min confidence <select data-transfer-config="minConfidence">${[CONFIDENCE.HIGH, CONFIDENCE.MEDIUM, CONFIDENCE.LOW].map((c) => `<option ${state.transferConfig.minConfidence === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <button class="wb3d-btn wb3d-btn-primary" data-action="build-plan">Build transfer plan</button>
      ${plan ? `<button class="wb3d-btn" data-action="batch-approve">Batch approve ≥ ${esc(state.transferConfig.minConfidence)}</button>` : ''}
      ${plan ? `<button class="wb3d-btn ${state.transferPreview ? 'is-active' : ''}" data-action="transfer-preview-toggle" title="Show approved transfers as labelled arrows on the 3D view">Graphical preview</button>` : ''}
    </div>
    ${plan ? `<p>${plan.summary.totalRows} row(s): <strong>${plan.summary.approvedRows ?? 0} approved</strong>, ${plan.summary.pendingRows} pending, ${plan.summary.blockedRows} blocked.</p>` : '<p class="wb3d-muted">No plan yet.</p>'}
    ${plan ? `<div data-wb3d-transfer-table>${tableHtml(columns, rows)}</div>` : ''}
  </section>`;
}

function exportSection(state) {
  if (!state.audit) return '';
  const applied = state.applyResult;
  return `
  <section class="wb3d-card">
    <h3>Apply &amp; export <span class="wb3d-muted">approved rows only; original files are never modified</span></h3>
    <div class="wb3d-toolbar">
      <button class="wb3d-btn" data-action="export" data-file="compare-audit.json">compare-audit.json</button>
      <button class="wb3d-btn" data-action="export" data-file="object-diff.csv">object-diff.csv</button>
      <button class="wb3d-btn" data-action="export" data-file="path-alignment.csv">path-alignment.csv</button>
      <button class="wb3d-btn" data-action="export" data-file="conflicts.csv">conflicts.csv</button>
      ${state.plan ? `<button class="wb3d-btn" data-action="export" data-file="transfer-plan.json">transfer-plan.json</button>
      <button class="wb3d-btn" data-action="export" data-file="transfer-preview.csv">transfer-preview.csv</button>
      <button class="wb3d-btn wb3d-btn-primary" data-action="apply-plan">Apply approved → download transferred target XML</button>` : ''}
      ${applied ? `<button class="wb3d-btn" data-action="export" data-file="rollback-ledger.json">rollback-ledger.json</button>` : ''}
    </div>
    ${applied ? `<p>Applied <strong>${applied.appliedCount}</strong> change(s); ${applied.skippedRows.length} skipped; geometry violations: ${applied.geometryViolations.length}. Rollback ledger has ${applied.rollbackLedger.rows.length} row(s).</p>` : ''}
  </section>`;
}

// ── main render ────────────────────────────────────────────────────────────

function fullHtml(state) {
  const compareView = `
    ${importSection(state)}
    <div data-wb3d-dashboard>${dashboardSection(state)}</div>
    <div data-wb3d-alerts>${alertsSection(state)}</div>
    ${viewerSection(state)}
    <div data-wb3d-tables>${tablesSection(state)}</div>
    <div data-wb3d-transfer>${transferSection(state)}</div>
    <div data-wb3d-export>${exportSection(state)}</div>`;
  return `
  <div class="wb3d-root">
    <header class="wb3d-header">
      <div>
        <h2>3D Data Compare Workbench</h2>
        <p class="wb3d-muted">Variance-first structured compare: canonical graph → match engine → 3D diff → conflict resolution → approved transfer → audited export.</p>
      </div>
      <div class="wb3d-seg" role="group">
        <button class="wb3d-btn ${state.activeView === 'compare' ? 'is-active' : ''}" data-action="set-active-view" data-view="compare">Compare</button>
        <button class="wb3d-btn ${state.activeView === 'dashboard' ? 'is-active' : ''}" data-action="set-active-view" data-view="dashboard">Dashboard</button>
        <button class="wb3d-btn ${state.activeView === 'table-to-xml' ? 'is-active' : ''}" data-action="set-active-view" data-view="table-to-xml">Table to XML</button>
      </div>
    </header>
    <div class="wb3d-status" data-wb3d-status>${esc(state.status)}</div>
    <div data-wb3d-wizard>${state.wizardDismissed ? '' : setupBannerHtml(state)}</div>
    ${state.activeView === 'table-to-xml' ? tableToXmlSection(state, state.settings.tablexml.customRules)
    : state.activeView === 'dashboard' ? `<div data-wb3d-dashview>${renderDashboardView(state)}</div>`
      : compareView}
    <div class="wb3d-panels-layer" data-wb3d-panels>${state.audit ? floatingPanelsHtml(state, floatingPanelRows(state)) : ''}</div>
    <div data-wb3d-drawer>${previewDrawerHtml(state)}</div>
    <div data-wb3d-evidence-host>${evidencePanelHtml(state)}</div>
  </div>`;
}

/** Build + cache dashboard models, return the view HTML (+ node board). */
function renderDashboardView(state) {
  state.dashboardModels = state.audit ? buildDashboardModels(state) : null;
  const styles = effectiveStatusStyles(state.settings, STATUS_STYLES);
  return dashboardViewHtml(state, state.dashboardModels ?? {}, styles) + nodeWorkspaceHtml(state, styles);
}

/** Every widget click funnels through here (vision doc D2/D5). */
function openDrilldown(container, state, { widgetType, title, filter, sourceWidgetId }) {
  if (!state.audit) return;
  const context = createDrilldownContext({
    widgetType,
    domain: drilldownDomainFor(state.audit),
    title,
    filter,
    sourceWidgetId,
  });
  state.drilldown = { context, rows: resolveDrilldownRows(context, state.audit, state.graphs) };
  const host = container.querySelector('[data-wb3d-drawer]');
  if (host) host.innerHTML = previewDrawerHtml(state);
}

function setStatus(container, state, message) {
  state.status = message;
  const el = container.querySelector('[data-wb3d-status]');
  if (el) el.textContent = message;
}

function refreshDerivedSections(container, state) {
  const set = (selector, html) => {
    const el = container.querySelector(selector);
    if (el) el.innerHTML = html;
  };
  set('[data-wb3d-dashboard]', dashboardSection(state));
  set('[data-wb3d-alerts]', alertsSection(state));
  set('[data-wb3d-canvas-pivot]', canvasPivotHeaderHtml(state));
  set('[data-wb3d-canvas-tree]', canvasHierarchyHtml(state));
  container.querySelector('[data-wb3d-canvas-tree]')?.classList.toggle('is-closed', state.canvasTreeOpen === false);
  set('[data-wb3d-tables]', tablesSection(state));
  set('[data-wb3d-transfer]', transferSection(state));
  set('[data-wb3d-export]', exportSection(state));
  set('[data-wb3d-selection]', selectionPanelHtml(state));
  set('[data-wb3d-preview-overlay]', previewOverlayHtml(state));
  set('[data-wb3d-settings-host]', settingsPanelHtml(state, discoverPacketKinds(state.graphs?.A, state.graphs?.B), effectiveStatusStyles(state.settings, STATUS_STYLES)));
  set('[data-wb3d-panels]', state.audit ? floatingPanelsHtml(state, floatingPanelRows(state)) : '');
  set('[data-wb3d-drawer]', previewDrawerHtml(state));
  set('[data-wb3d-evidence-host]', evidencePanelHtml(state));
  set('[data-wb3d-wizard]', state.wizardDismissed ? '' : setupBannerHtml(state));
  const toggles = container.querySelector('[data-wb3d-panel-toggles]');
  if (toggles) toggles.innerHTML = panelToggleButtonsHtml(state);
  const legend = container.querySelector('.wb3d-legend');
  if (legend) legend.innerHTML = legendHtml(state);
  updateApprovalOverlay(container, state);
  refreshTransferOverlays(container, state);
}

/** Redraw the screen-space transfer overlays (arrows, edit popup, labels). */
function refreshTransferOverlays(container, state) {
  const drawn = renderArrowLayer(container, state);
  updateArrowPopup(container, state, drawn);
  updateTransferPreviewLabels(container, state, drawn);
}

function refreshTablexmlSection(container, state) {
  const host = container.querySelector('[data-wb3d-tablexml]');
  if (!host) return;
  host.outerHTML = tableToXmlSection(state, state.settings.tablexml.customRules);
}

async function ensureViewer(container, state) {
  const host = container.querySelector('[data-wb3d-canvas]');
  if (!host) return;
  if (state.viewer) {
    // Tab HTML was re-rendered — move the existing canvas into the new host.
    state.viewer.reattach(host);
    return;
  }
  if (state.viewerError) return;
  const placeTip = (tip, event) => {
    const hostRect = tip.parentElement.getBoundingClientRect();
    tip.style.left = `${Math.min(event.clientX - hostRect.left + 12, hostRect.width - 260)}px`;
    tip.style.top = `${event.clientY - hostRect.top + 12}px`;
  };
  try {
    state.viewer = await createWorkbenchViewer(host, {
      onPick: (pick) => {
        state.selection = pick ?? null;
        if (pick?.objectId) state.viewer?.setSelection(pick.objectId, relatedIdsFor(state, pick.objectId));
        else state.viewer?.setSelection(null);
        const panel = container.querySelector('[data-wb3d-selection]');
        if (panel) panel.innerHTML = selectionPanelHtml(state);
        updateApprovalOverlay(container, state);
      },
      onHoverConnector: (connector, event) => {
        const tip = container.querySelector('[data-wb3d-connector-tip]');
        if (!tip) return;
        if (!connector) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.textContent = `${connector.type} · ${connector.status ?? ''} · ${connector.reason} · audit ${connector.auditRowId}`;
        placeTip(tip, event);
      },
      onHoverObject: (hover, event) => {
        const tip = container.querySelector('[data-wb3d-hover-tip]');
        if (!tip) return;
        if (!hover || (!hover.objectId && !hover.nodeId)) { tip.hidden = true; return; }
        let lines = [];
        if (hover.objectId) {
          lines = objectHoverTooltipLines(state.audit, state.graphs, hover.objectId, state.settings);
          if (hover.fallback) lines.push('⚠ marker placement fell back to midpoint (unknown NODE)');
        } else {
          const info = state.nodeInfo?.[hover.modelId === 'target' ? 'B' : 'A']?.get(hover.nodeId);
          lines = info
            ? [`Node ${info.nodeId} (${info.anchorType})`, `[${info.coordMm.map((v) => Number(v).toFixed(0)).join(', ')}] mm`, ...info.packets.filter((p) => packetKindVisible(state.settings, p.kind)).map((p) => `${p.kind} via ${p.resolvedBy}`)]
            : [`Node ${hover.nodeId}`];
        }
        if (!lines.length) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.innerHTML = lines.map((l) => `<div>${esc(l)}</div>`).join('');
        placeTip(tip, event);
      },
      onCameraChange: () => {
        updateApprovalOverlay(container, state);
        refreshTransferOverlays(container, state);
      },
    });
  } catch (error) {
    state.viewerError = String(error?.message || error);
    host.innerHTML = `<div class="wb3d-viewer-fallback">3D viewer unavailable: ${esc(state.viewerError)}<br>All compare data remains available in the tables below.</div>`;
  }
}

function pushModelsToViewer(state, { fit = true } = {}) {
  if (!state.viewer || !state.visuals) return;
  state.viewer.setStatusStyles(effectiveStatusStyles(state.settings, STATUS_STYLES));
  state.viewer.setModels({
    source: state.visuals.A,
    target: state.visuals.B,
    registrationTranslation: state.audit?.registration.translationMm ?? [0, 0, 0],
  });
  state.viewer.setStatuses(statusMapForViewer(state));
  state.viewer.setColorOverrides(buildHeatmapOverrides(state.audit, state.settings));
  state.viewer.setStatusFilter(state.statusFilter);
  pushConnectors(state);
  if (fit) state.viewer.fitAll();
}

/** Single funnel for every settings change: persist → viewer → sections. */
function applySettings(container, state) {
  state.settings = normalizeSettings(state.settings);
  saveSettings(globalThis.localStorage, state.settings);
  if (state.graphs) rebuildVisuals(state);
  pushModelsToViewer(state, { fit: false });
  refreshDerivedSections(container, state);
}

function exportBundleFile(state, filename) {
  const files = compareWorkbenchProjectArtifacts({
    compareAudit: state.audit,
    transferPlan: state.plan,
    rollbackLedger: state.applyResult?.rollbackLedger,
    outputXml: state.applyResult?.outputXml,
  });
  const file = files.find((candidate) => candidate.name === filename);
  if (file) downloadFile(file.name, file.text, file.mime);
}

function renderView(container, state) {
  container.innerHTML = fullHtml(state);
  ensureViewer(container, state).then(() => pushModelsToViewer(state, { fit: false }));
}

/** Settings changes are debounced (color/range inputs fire rapidly). */
function queueApplySettings(container, state) {
  clearTimeout(state.__settingsTimer);
  state.__settingsTimer = setTimeout(() => applySettings(container, state), 150);
}

function bindHandlers(container) {
  const state = () => ensureState(container);

  const rerunCompare = () => {
    const s = state();
    try {
      runComparePipeline(s);
      refreshDerivedSections(container, s);
      setStatus(container, s, s.status);
      pushModelsToViewer(s);
    } catch (error) {
      setStatus(container, s, `Compare failed: ${error?.message || error}`);
    }
  };

  attachFloatingPanelDrag(container, (panelId, x, y) => {
    const s = state();
    s.settings.panels[panelId].x = x;
    s.settings.panels[panelId].y = y;
    saveSettings(globalThis.localStorage, s.settings);
  });

  container.addEventListener('input', (event) => {
    const s = state();
    const field = event.target.dataset?.field;
    if (field) {
      s[field] = event.target.value;
      if (field === 'sourceXml' || field === 'targetXml') {
        const side = field === 'sourceXml' ? 'source' : 'target';
        void scheduleWorkbenchImportedInputXmlReview(container, s, side);
      }
    }
    const config = event.target.dataset?.config;
    if (config) {
      s.config[config] = event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value);
    }
    const transferConfig = event.target.dataset?.transferConfig;
    if (transferConfig) s.transferConfig[transferConfig] = event.target.value;
    if (event.target.dataset?.action === 'connector-mode') {
      s.connectorMode = event.target.value;
      s.viewer?.setConnectorMode(event.target.value);
      refreshTransferOverlays(container, s);
    }
    if (event.target.dataset?.action === 'dash-groupby') {
      s.dashboardGroupBy = event.target.value;
      const host = container.querySelector('[data-wb3d-dashview]');
      if (host) host.innerHTML = renderDashboardView(s);
    }
    if (event.target.dataset?.action === 'wizard-profile') {
      s.profileOverride = event.target.value;
      // profile changes role hints for the table wizard; re-suggest if parsed.
      const table = s.tablexml?.tables?.[s.tablexml.active];
      if (table?.parsed && s.activeView === 'table-to-xml') refreshTablexmlSection(container, s);
      const host = container.querySelector('[data-wb3d-wizard]');
      if (host) host.innerHTML = s.wizardDismissed ? '' : setupBannerHtml(s);
    }

    // ── settings panel inputs ──────────────────────────────────────────
    const el = event.target;
    if (el.dataset?.settingColor) {
      const status = el.dataset.settingColor;
      s.settings.statusStyles[status] = { ...s.settings.statusStyles[status], color: el.value };
      queueApplySettings(container, s);
    }
    if (el.dataset?.settingAlpha) {
      const status = el.dataset.settingAlpha;
      s.settings.statusStyles[status] = { ...s.settings.statusStyles[status], alpha: Number(el.value) / 100 };
      queueApplySettings(container, s);
    }
    if (el.dataset?.settingPacketKind) {
      const kind = el.dataset.settingPacketKind;
      const current = Array.isArray(s.settings.tooltipPacketKinds) ? s.settings.tooltipPacketKinds : discoverPacketKinds(s.graphs?.A, s.graphs?.B);
      s.settings.tooltipPacketKinds = el.checked ? [...new Set([...current, kind])] : current.filter((k) => k !== kind);
      queueApplySettings(container, s);
    }
    const setting = el.dataset?.setting;
    if (setting === 'packetKindsAll') {
      s.settings.tooltipPacketKinds = el.checked ? null : discoverPacketKinds(s.graphs?.A, s.graphs?.B);
      queueApplySettings(container, s);
    } else if (setting === 'markerPlacement') {
      s.settings.markerPlacement = el.value;
      queueApplySettings(container, s);
    } else if (setting === 'showAllNodes') {
      s.settings.showAllNodes = el.checked;
      queueApplySettings(container, s);
    } else if (setting === 'nodeMarkerSizeMm') {
      s.settings.nodeMarkerSizeMm = Number(el.value);
      queueApplySettings(container, s);
    } else if (setting === 'heatmapEnabled') {
      s.settings.heatmap.enabled = el.checked;
      queueApplySettings(container, s);
    } else if (setting === 'heatmapMaxDeltaMm') {
      s.settings.heatmap.maxDeltaMm = Number(el.value);
      queueApplySettings(container, s);
    }

    // ── table-to-xml inputs ────────────────────────────────────────────
    if (s.activeView === 'table-to-xml') {
      if (handleTableToXmlInput(s, el)) {
        refreshTablexmlSection(container, s);
      } else if (el.matches?.('[data-txml-text]')) {
        // Auto-parse after paste (debounced; only on paste-sized changes so
        // hand-editing doesn't lose focus to a re-render).
        clearTimeout(s.__txmlParseTimer);
        s.__txmlParseTimer = setTimeout(() => {
          try {
            if (autoParseActiveTable(s)) refreshTablexmlSection(container, s);
          } catch (error) {
            setStatus(container, s, `Table parse failed: ${error?.message || error}`);
          }
        }, 600);
      }
    }
  });

  container.addEventListener('change', async (event) => {
    const s = state();
    if (event.target.matches?.('[data-txml-file]')) {
      if (await handleTableToXmlFile(s, event.target)) refreshTablexmlSection(container, s);
      return;
    }
    if (event.target.dataset?.action !== 'load-file') return;
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const side = event.target.dataset.side === 'source' ? 'source' : 'target';
    if (side === 'source') { s.sourceXml = text; s.sourceName = file.name; }
    else { s.targetXml = text; s.targetName = file.name; }
    s.status = `Loaded ${file.name} (${Math.round(text.length / 1024)} KB) as ${side}.`;
    renderView(container, s);
    void scheduleWorkbenchImportedInputXmlReview(container, s, side, 0);
  });

  // Double-click a transfer arrow (SVG overlay) → per-pair edit popup.
  container.addEventListener('dblclick', (event) => {
    const path = event.target.closest?.('.wb3d-arrow[data-pair-key]');
    if (!path) return;
    const s = ensureState(container);
    s.arrowPopup = { pairKey: path.dataset.pairKey };
    refreshTransferOverlays(container, s);
    event.preventDefault();
  });

  container.addEventListener('click', (event) => {
    const state = ensureState(container);
    const btn = event.target.closest('[data-action]');
    if (!btn || btn.dataset.action === 'load-file') return;
    const action = btn.dataset.action;

    if (action === 'download-imported-inputxml-review') {
      const side = btn.dataset.side === 'target' ? 'target' : 'source';
      const source = importedInputXmlReviewSource(state, side);
      const text = importedInputXmlReviewText(source, state.importedInputXmlReview?.[side]);
      if (text) downloadFile(importedInputXmlReviewDownloadName(state, side, 'categorized-review.xml'), text, 'application/xml;charset=utf-8');
      return;
    }
    if (action === 'download-imported-inputxml-review-receipt') {
      const side = btn.dataset.side === 'target' ? 'target' : 'source';
      const source = importedInputXmlReviewSource(state, side);
      const receipt = importedInputXmlReviewReceiptJson(source, state.importedInputXmlReview?.[side]);
      downloadFile(importedInputXmlReviewDownloadName(state, side, 'categorized-review-receipt.json'), receipt, 'application/json;charset=utf-8');
      return;
    }

    if (action === 'run-compare') rerunCompare();

    // ── transfer arrow editing ─────────────────────────────────────────
    if (action === 'panel-roleaudit') {
      state.roleAuditOpen = !state.roleAuditOpen;
      const panels = container.querySelector('[data-wb3d-panels]');
      if (panels && state.audit) panels.innerHTML = floatingPanelsHtml(state, floatingPanelRows(state));
    }
    if (action === 'arrow-popup-close') {
      state.arrowPopup = null;
      refreshTransferOverlays(container, state);
    }
    if (action === 'arrow-drop-prop' && state.plan) {
      dropPairProperty(state.plan, { sourceObjectId: btn.dataset.source, targetObjectId: btn.dataset.target, property: btn.dataset.prop });
      pushConnectors(state);
      refreshDerivedSections(container, state);
    }
    if (action === 'arrow-smartdrop-prop' && state.plan) {
      dropPropertyGlobally(state.plan, state.transferConfig, btn.dataset.prop, true);
      pushConnectors(state);
      refreshDerivedSections(container, state);
    }
    if (action === 'global-drop-prop' && state.plan) {
      dropPropertyGlobally(state.plan, state.transferConfig, btn.dataset.prop, btn.checked === false);
      pushConnectors(state);
      refreshDerivedSections(container, state);
    }
    if (action === 'transfer-preview-toggle') {
      state.transferPreview = !state.transferPreview;
      if (state.transferPreview) {
        state.connectorMode = 'transfer';
        state.viewer?.setConnectorMode('transfer');
        const select = container.querySelector('select[data-action="connector-mode"]');
        if (select) select.value = 'transfer';
      }
      refreshDerivedSections(container, state);
    }

    if (action === 'set-mode' && state.viewer) {
      state.viewer.setMode(btn.dataset.mode);
      container.querySelectorAll('[data-action="set-mode"]').forEach((b) => b.classList.toggle('is-active', b === btn));
      refreshTransferOverlays(container, state);
    }
    if (action === 'set-view' && state.viewer) state.viewer.setStandardView(btn.dataset.view);

    // ── canvas hierarchy tree ──────────────────────────────────────────
    const refreshTree = () => {
      const host = container.querySelector('[data-wb3d-canvas-tree]');
      if (host) {
        host.innerHTML = canvasHierarchyHtml(state);
        host.classList.toggle('is-closed', state.canvasTreeOpen === false);
      }
    };
    const isolateChecked = () => {
      const checked = state.treeChecked ?? new Set();
      if (!checked.size) { state.viewer?.isolate(null); return; }
      const ids = new Set(checked);
      for (const id of checked) for (const related of relatedIdsFor(state, id)) ids.add(related);
      state.viewer?.isolate([...ids]);
    };
    if (action === 'tree-toggle') {
      state.canvasTreeOpen = state.canvasTreeOpen === false;
      refreshTree();
    }
    if (action === 'tree-clear') {
      state.treeChecked = new Set();
      state.viewer?.isolate(null);
      refreshTree();
    }
    if (action === 'tree-check') {
      const ids = String(btn.dataset.ids || '').split(',').filter(Boolean);
      const checked = state.treeChecked ?? (state.treeChecked = new Set());
      for (const id of ids) { if (btn.checked) checked.add(id); else checked.delete(id); }
      isolateChecked();
      refreshTree();
    }
    if (action === 'fit-all' && state.viewer) state.viewer.fitAll();
    if (action === 'clear-isolation' && state.viewer) state.viewer.isolate(null);
    if (action === 'set-opacity' && state.viewer) state.viewer.setSourceOpacity(Number(btn.value) / 100);

    if (action === 'toggle-status-filter') {
      const status = btn.dataset.status;
      const turningOn = !state.statusFilter.has(status);
      if (turningOn) state.statusFilter.add(status);
      else state.statusFilter.delete(status);
      state.viewer?.setStatusFilter(state.statusFilter);
      if (turningOn) {
        openDrilldown(container, state, {
          widgetType: 'KPI_CARD',
          title: `${status.replaceAll('_', ' ')} elements`,
          filter: { status: [status] },
          sourceWidgetId: `kpi:${status}`,
        });
      } else if (state.drilldown?.context.sourceWidgetId === `kpi:${status}`) {
        state.drilldown = null;
      }
      refreshDerivedSections(container, state);
    }

    if (action === 'select-object') {
      const objectId = btn.dataset.object;
      if (!objectId) return;
      state.selection = { objectId };
      const panel = container.querySelector('[data-wb3d-selection]');
      if (panel) panel.innerHTML = selectionPanelHtml(state);
      state.viewer?.setSelection(objectId, relatedIdsFor(state, objectId));
      state.viewer?.fitObject(objectId);
      updateApprovalOverlay(container, state);
    }

    if (action === 'isolate-ids') {
      const alert = buildAlerts(state)[Number(btn.dataset.alertIndex)];
      if (alert?.isolateIds.length) {
        state.viewer?.isolate(new Set(alert.isolateIds));
        openDrilldown(container, state, {
          widgetType: 'ALERT',
          title: alert.message,
          filter: { objectIds: alert.isolateIds },
          sourceWidgetId: `alert:${alert.rule}`,
        });
      }
    }

    if (action === 'isolate-pivot') {
      const line = btn.dataset.line;
      const status = btn.dataset.status;
      const lineOf = new Map();
      for (const graph of [state.graphs.A, state.graphs.B]) {
        for (const object of graph.objects) lineOf.set(object.objectId, object.lineId || '(model)');
      }
      const ids = new Set();
      for (const row of state.audit.objectDiff.rows) {
        if (row.status !== status) continue;
        for (const id of [row.sourceObjectId, row.targetObjectId]) {
          if (id && lineOf.get(id) === line) ids.add(id);
        }
      }
      if (ids.size) {
        state.viewer?.isolate(ids);
        openDrilldown(container, state, {
          widgetType: 'PIVOT_CELL',
          title: `${line} · ${status.replaceAll('_', ' ')}`,
          filter: { status: [status], groupBy: 'line', groupValue: line },
          sourceWidgetId: `pivot:${line}:${status}`,
        });
      }
    }

    // ── dashboard widgets (W2) — all emit DrilldownContext ─────────────
    if (action === 'dash-kpi' && state.dashboardModels) {
      const kpi = state.dashboardModels.kpis[Number(btn.dataset.index)];
      if (kpi) openDrilldown(container, state, { widgetType: 'KPI_CARD', title: `${kpi.label} (${kpi.value})`, filter: kpi.filter, sourceWidgetId: `dash-kpi:${kpi.id}` });
    }
    if (action === 'dash-queue' && state.dashboardModels) {
      const entry = state.dashboardModels.queue[Number(btn.dataset.index)];
      if (entry) openDrilldown(container, state, { widgetType: 'KPI_CARD', title: entry.label, filter: entry.filter, sourceWidgetId: `dash-queue:${entry.id}` });
    }
    if (action === 'dash-cell' && state.dashboardModels) {
      const cell = state.dashboardModels.heatmap.cells.get(`${btn.dataset.group}|${btn.dataset.status}`);
      if (cell) {
        openDrilldown(container, state, {
          widgetType: 'HEATMAP_CELL',
          title: `${btn.dataset.group} · ${btn.dataset.status.replaceAll('_', ' ')}`,
          filter: { diffIds: cell.diffIds },
          sourceWidgetId: `dash-cell:${btn.dataset.group}`,
        });
      }
    }
    if (action === 'dash-card') {
      openDrilldown(container, state, {
        widgetType: 'EXCEPTION_CARD',
        title: `Exception ${btn.dataset.diff}`,
        filter: { diffIds: [btn.dataset.diff] },
        sourceWidgetId: `dash-card:${btn.dataset.diff}`,
      });
    }

    // ── node visual board (W4) ─────────────────────────────────────────
    if (action === 'nodeviz-mode') {
      state.nodeVizMode = btn.dataset.mode;
      const host = container.querySelector('[data-wb3d-dashview]');
      if (host) host.innerHTML = renderDashboardView(state);
    }
    if (action === 'nodeviz-pick') {
      try {
        const { title, filter } = JSON.parse(decodeURIComponent(btn.dataset.pick));
        openDrilldown(container, state, { widgetType: 'NODE_MARKER', title, filter, sourceWidgetId: 'nodeviz' });
        if (btn.dataset.object) state.viewer?.isolate(new Set([btn.dataset.object]));
      } catch { /* malformed pick payload — ignore */ }
    }

    // ── setup wizard + role-map audit (W6 / W5) ────────────────────────
    if (action === 'wizard-goto') {
      state.activeView = btn.dataset.view;
      renderView(container, state);
      if (btn.dataset.run === 'run-compare') rerunCompare();
      return;
    }
    if (action === 'wizard-dismiss') {
      state.wizardDismissed = true;
      const host = container.querySelector('[data-wb3d-wizard]');
      if (host) host.innerHTML = '';
    }
    if (action === 'role-ignore') {
      const field = btn.dataset.field;
      const set = new Set(state.ignoredProps);
      if (btn.checked) set.add(field); else set.delete(field);
      state.ignoredProps = [...set];
      if (state.audit) rerunCompare();
    }

    // ── full evidence overlay (W5) ─────────────────────────────────────
    if (action === 'open-evidence') {
      state.evidenceDiffId = btn.dataset.diff;
      const host = container.querySelector('[data-wb3d-evidence-host]');
      if (host) host.innerHTML = evidencePanelHtml(state);
    }
    if (action === 'evidence-close') {
      state.evidenceDiffId = null;
      const host = container.querySelector('[data-wb3d-evidence-host]');
      if (host) host.innerHTML = '';
    }
    if (action === 'evidence-export' && state.audit) {
      const model = buildEvidenceModel(state.audit, state.graphs, btn.dataset.diff);
      if (model) {
        const lines = [
          `Evidence,${model.title}`,
          `Status,${model.status}`,
          `Confidence,${model.confidence}`,
          '',
          'Field,Source A,Target B,Changed',
          ...model.fields.map((f) => rowsToCsv([f], [['label', ''], ['a', ''], ['b', ''], ['changed', '']]).split('\n')[1]),
          '',
          'Delta,Value',
          ...model.delta.map(([k, v]) => rowsToCsv([{ k, v }], [['k', ''], ['v', '']]).split('\n')[1]),
          '',
          'Traceability,Value',
          ...model.traceability.map(([k, v]) => rowsToCsv([{ k, v }], [['k', ''], ['v', '']]).split('\n')[1]),
        ];
        downloadFile(`evidence-${model.diffId}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
      }
    }
    if (action === 'export-connector-ledger' && state.audit) {
      downloadFile('connector-ledger.csv', rowsToCsv(connectorLedgerModel(state.audit, state.graphs), CONNECTOR_LEDGER_CSV_COLUMNS), 'text/csv;charset=utf-8');
    }

    // ── drill-down drawer actions (W1) ─────────────────────────────────
    if (action === 'drilldown-close') {
      state.drilldown = null;
      const host = container.querySelector('[data-wb3d-drawer]');
      if (host) host.innerHTML = '';
    }
    if (action === 'drilldown-isolate' && state.drilldown) {
      const ids = new Set(state.drilldown.rows.flatMap((r) => r.relatedIds));
      if (ids.size) state.viewer?.isolate(ids);
    }
    if (action === 'drilldown-export' && state.drilldown) {
      const slug = state.drilldown.context.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'drilldown';
      downloadFile(`drilldown-${slug}.csv`, rowsToCsv(state.drilldown.rows, DRILLDOWN_CSV_COLUMNS), 'text/csv;charset=utf-8');
    }

    if (action === 'isolate-path') {
      const graph = btn.dataset.model === 'source' ? state.graphs?.A : state.graphs?.B;
      const path = graph?.paths.find((p) => p.pathId === btn.dataset.path);
      if (path) {
        const ids = new Set(path.elementIds);
        // include matched counterparts so the isolation shows both sides
        for (const row of state.audit?.objectDiff.rows ?? []) {
          if (row.sourceObjectId && ids.has(row.sourceObjectId) && row.targetObjectId) ids.add(row.targetObjectId);
          if (row.targetObjectId && ids.has(row.targetObjectId) && row.sourceObjectId) ids.add(row.sourceObjectId);
        }
        state.viewer?.isolate(ids);
      }
    }

    if (action === 'manual-link' || action === 'manual-reject') {
      state.manualOverrides.push({
        type: action === 'manual-link' ? 'LINK' : 'REJECT',
        sourceObjectId: btn.dataset.source,
        targetObjectId: btn.dataset.target,
        at: new Date().toISOString(),
      });
      rerunCompare();
    }

    if (action === 'build-plan') {
      if (!state.audit || !state.graphs) return;
      state.plan = buildTransferPlan(state.audit, state.graphs.A, state.graphs.B, state.transferConfig);
      state.applyResult = null;
      refreshDerivedSections(container, state);
      pushConnectors(state);
      setStatus(container, state, `Transfer plan: ${state.plan.summary.totalRows} row(s), ${state.plan.summary.blockedRows} blocked.`);
    }
    if (action === 'batch-approve' && state.plan) {
      batchApprove(state.plan, state.transferConfig.minConfidence);
      refreshDerivedSections(container, state);
      pushConnectors(state);
      setStatus(container, state, `Batch approved: ${state.plan.summary.approvedRows} row(s) now approved.`);
    }
    if ((action === 'approve-row' || action === 'reject-row') && state.plan) {
      const row = state.plan.rows.find((r) => r.rowId === btn.dataset.row);
      if (row && row.approval !== APPROVAL_STATUS.BLOCKED) {
        row.approval = action === 'approve-row' ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;
        refreshTransferSummary(state.plan);
        refreshDerivedSections(container, state);
        pushConnectors(state);
      }
    }

    if (action === 'apply-plan' && state.plan) {
      try {
        refreshTransferSummary(state.plan);
        if (!state.plan.summary.approvedRows) {
          setStatus(container, state, 'Nothing approved yet — approve rows (or batch approve) before applying.');
          return;
        }
        if (state.graphs?.targetSchema === XML_SCHEMA_KINDS.PSI_XML) {
          // PSI targets are written back per <Node> by node number.
          const targetTopo = { edges: state.graphs.B.objects.map((o) => ({ id: o.objectId, nodeNumbers: [o.fromNode, o.toNode] })) };
          const psiResult = applyTransferPlanToPsi(state.targetXml, state.plan, targetTopo);
          state.applyResult = {
            outputXml: psiResult.xmlText,
            appliedCount: psiResult.applied,
            skippedRows: psiResult.skipped,
            geometryViolations: [],
            rollbackLedger: { contract: 'RollbackLedger.v1', rows: psiResult.rollbackRows },
          };
          downloadFile('transferred-target-pipestress.xml', psiResult.xmlText, 'application/xml;charset=utf-8');
          refreshDerivedSections(container, state);
          setStatus(container, state, `Applied ${psiResult.applied} approved change(s) to the PSI target; ${psiResult.skipped.length} skipped. Transferred XML downloaded.`);
          return;
        }
        state.applyResult = applyTransferPlan(state.targetXml, state.plan);
        downloadFile('transferred-target-inputxml.xml', state.applyResult.outputXml, 'application/xml;charset=utf-8');
        refreshDerivedSections(container, state);
        setStatus(container, state, `Applied ${state.applyResult.appliedCount} approved change(s); transferred XML downloaded. Geometry violations: ${state.applyResult.geometryViolations.length}.`);
      } catch (error) {
        setStatus(container, state, `Apply failed: ${error?.message || error}`);
      }
    }

    if (action === 'export') exportBundleFile(state, btn.dataset.file);

    // ── view switcher ──────────────────────────────────────────────────
    if (action === 'set-active-view') {
      state.activeView = btn.dataset.view;
      renderView(container, state);
    }

    // ── settings panel ─────────────────────────────────────────────────
    if (action === 'toggle-settings') {
      state.settingsOpen = !state.settingsOpen;
      refreshDerivedSections(container, state);
    }
    if (action === 'reset-settings') {
      state.settings = normalizeSettings(null);
      applySettings(container, state);
    }

    // ── floating panels ────────────────────────────────────────────────
    if (action === 'toggle-panel') {
      const cfg = state.settings.panels[btn.dataset.panel];
      cfg.open = !cfg.open;
      saveSettings(globalThis.localStorage, state.settings);
      refreshDerivedSections(container, state);
    }
    if (action === 'panel-collapse') {
      const cfg = state.settings.panels[btn.dataset.panel];
      cfg.collapsed = !cfg.collapsed;
      saveSettings(globalThis.localStorage, state.settings);
      refreshDerivedSections(container, state);
    }
    if (action === 'panel-colpicker') {
      state.panelColumnPicker = state.panelColumnPicker === btn.dataset.panel ? null : btn.dataset.panel;
      refreshDerivedSections(container, state);
    }
    if (action === 'panel-column') {
      const cfg = state.settings.panels[btn.dataset.panel];
      const column = btn.dataset.column;
      cfg.columns = cfg.columns.includes(column) ? cfg.columns.filter((c) => c !== column) : [...cfg.columns, column];
      if (!cfg.columns.length) cfg.columns = [column];
      saveSettings(globalThis.localStorage, state.settings);
      refreshDerivedSections(container, state);
    }
    if (action === 'panel-filter') {
      const cfg = state.settings.panels[btn.dataset.panel];
      const key = btn.dataset.filter;
      const value = btn.dataset.value;
      cfg[key] = cfg[key].includes(value) ? cfg[key].filter((v) => v !== value) : [...cfg[key], value];
      saveSettings(globalThis.localStorage, state.settings);
      refreshDerivedSections(container, state);
    }

    // ── element-level approval override (panel 3 + canvas ✓/✗ overlay) ──
    if (action === 'approve-element' && state.plan) {
      const targetId = btn.dataset.object;
      const approval = btn.dataset.approval === 'REJECTED' ? APPROVAL_STATUS.REJECTED : APPROVAL_STATUS.APPROVED;
      let touched = 0;
      for (const row of state.plan.rows) {
        if (row.targetObjectId !== targetId || row.approval === APPROVAL_STATUS.BLOCKED) continue;
        row.approval = approval;
        touched += 1;
      }
      refreshTransferSummary(state.plan);
      refreshDerivedSections(container, state);
      pushConnectors(state);
      setStatus(container, state, `Approval override: ${touched} row(s) for ${stripModelPrefixLocal(targetId)} set to ${approval}.`);
    }

    // ── table-to-xml actions ───────────────────────────────────────────
    if (action?.startsWith('txml-')) {
      if (action === 'txml-revpair-load') {
        try {
          const pair = generateRevisionPair(state, state.settings.tablexml.customRules);
          state.sourceXml = pair.sourceXml;
          state.sourceName = `rev-${pair.revA}-nodeset.xml`;
          state.targetXml = pair.targetXml;
          state.targetName = `rev-${pair.revB}-nodeset.xml`;
          state.activeView = 'compare';
          state.status = `Generated Rev ${pair.revA} (${pair.sourceNodes} node(s)) vs Rev ${pair.revB} (${pair.targetNodes} node(s)) — running node compare…`;
          renderView(container, state);
          void scheduleWorkbenchImportedInputXmlReview(container, state, 'source', 0);
          void scheduleWorkbenchImportedInputXmlReview(container, state, 'target', 0);
          rerunCompare();
        } catch (error) {
          setStatus(container, state, `Revision pair failed: ${error?.message || error}`);
        }
        return;
      }
      if (action === 'txml-load-compare') {
        const tx = ensureTablexmlState(state);
        const table = tx.tables[tx.active];
        if (!table.xml) return;
        if (tx.active === 'source') { state.sourceXml = table.xml; state.sourceName = 'table-1-nodeset.xml'; }
        else { state.targetXml = table.xml; state.targetName = 'table-2-nodeset.xml'; }
        const bothLoaded = /nodeset\/v1/.test(state.sourceXml) && /nodeset\/v1/.test(state.targetXml);
        state.activeView = 'compare';
        state.status = `Loaded generated NodeSet XML as ${tx.active}.${bothLoaded ? ' Both sides ready — running node compare…' : ' Generate/load the other side, then run compare.'}`;
        renderView(container, state);
        void scheduleWorkbenchImportedInputXmlReview(container, state, tx.active, 0);
        if (bothLoaded) rerunCompare();
        return;
      }
      try {
        if (handleTableToXmlClick(state, btn, state.settings.tablexml.customRules)) {
          refreshTablexmlSection(container, state);
        }
      } catch (error) {
        setStatus(container, state, `Table to XML failed: ${error?.message || error}`);
      }
    }
  });
}

export function renderWorkbench3dTab(container) {
  const state = ensureState(container);
  renderView(container, state);
  if (!container.__wb3dBound) {
    bindHandlers(container);
    container.__wb3dBound = true;
  }
  return () => {
    closeImportedInputXmlReviewRuntime(container);
    state.viewer?.dispose();
    state.viewer = null;
  };
}

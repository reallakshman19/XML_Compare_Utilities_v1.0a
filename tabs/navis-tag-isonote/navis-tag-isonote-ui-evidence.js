import {
  decisionAuditRemark,
  identitySelectionAuditRemark,
  propagationAuditRemark,
} from './navis-tag-audit-remarks.js';
import { renderFilterBar } from './navis-tag-isonote-ui-view.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function badge(status) {
  const value = String(status || '');
  const css = /RESOLVED|READY|HIGH|MEDIUM|VALID|SELECTED_MATCH|WITHIN_TOLERANCE|CURRENT|APPLIED|DIRECT|PROPAGATED|HYPOTHESES/.test(value) && !/UNRESOLVED|INVALID|NOT_SELECTED|OUTSIDE|REBUILD_REQUIRED|REJECTED|NONE/.test(value)
    ? 'nti-ok'
    : /AMBIGUOUS|WARN|PENDING|PARTIAL|NOT_SELECTED|RUNNER_UP|NEAREST_REJECTED|OUTSIDE|REBUILD_REQUIRED|STALE|REJECTED/.test(value) ? 'nti-warn' : 'nti-error';
  return `<span class="nti-badge ${css}">${esc(value)}</span>`;
}
function compactNumber(value, digits = 3) {
  if (value == null || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : '';
}
function renderTable(headers, rows, tableClass, emptyMessage) {
  if (!rows.length) return `<div class="nti-help">${esc(emptyMessage)}</div>`;
  return `<div class="nti-table-wrap"><table class="nti-table ${esc(tableClass)}"><thead><tr>${headers.map((header) => `<th title="${esc(header.help || '')}">${esc(header.label)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 5000).map((row) => `<tr>${headers.map((header) => {
    const value = row[header.key];
    const display = Array.isArray(value) ? value.join(' → ') : typeof value === 'object' && value ? JSON.stringify(value) : value;
    return `<td title="${esc(display)}">${header.badge ? badge(display) : esc(display)}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function stageIntro(number, title, description) { return `<div class="nti-help"><b>Stage ${number} of 3 — ${esc(title)}</b><br>${esc(description)}</div>`; }
function pointColumns(point, prefix) {
  return { [`${prefix}E`]: compactNumber(point?.x), [`${prefix}N`]: compactNumber(point?.y), [`${prefix}EL`]: compactNumber(point?.z) };
}
function axisFormula(rawValue, scaleValue, offsetValue, resultValue) {
  const raw = Number(rawValue);
  const scale = Number(scaleValue);
  const offset = Number(offsetValue);
  const result = Number(resultValue);
  if (![raw, scale, offset, result].every(Number.isFinite)) return '';
  return `${compactNumber(raw, 6)} × ${compactNumber(scale, 6)} ${offset < 0 ? '−' : '+'} ${compactNumber(Math.abs(offset))} = ${compactNumber(result)} mm`;
}
function configuredDatum(state, axis) {
  const key = axis === 'x' ? 'navisEastingDatumMm' : axis === 'y' ? 'navisNorthingDatumMm' : 'navisElevationDatumMm';
  const value = Number(state.config?.[key]);
  return Number.isFinite(value) ? value : 0;
}
function sameNumber(left, right) {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
}
function joined(values) { return (Array.isArray(values) ? values : []).join(' | '); }

export function jsonTraceRows(state) {
  return (state.identityTrace?.rows || []).map((row) => ({
    resolutionRow: row.tableRowIndex, groupedIdentityRaw: row.tableIdentityRaw, canonicalIdentity: row.canonicalIdentity,
    supportRoot: row.supportRoot, identityStatus: row.status, selectionReason: row.selectionReason,
    selectionRemark: identitySelectionAuditRemark(row),
    candidateCount: row.candidateCount, jsonNodeId: row.selectedNodeId, jsonSourceFile: row.selectedSourceFile,
    jsonPath: row.selectedJsonPath, rawType: row.selectedRawType, rawName: row.selectedRawName,
    identityPath: row.selectedIdentityPath, referenceRaw: row.selectedReferenceRaw,
    referencePath: row.selectedReferencePath, positionPath: row.positionSourcePath,
    ...pointColumns(row.position, 'json'), sourceUnit: row.position?.sourceUnit || '',
    unitScale: compactNumber(row.position?.unitScale, 6), datumOffsets: row.position?.datumOffsetMm || '',
    coordinateProfile: row.position?.profileName || '', resolvedBranch: row.resolvedBranch,
    resolvedPipe: row.resolvedPipe, resolvedZone: row.resolvedZone, identityConfidence: row.identityConfidence,
  }));
}
export function navisCoordinateRows(state) {
  const configured = { x: configuredDatum(state, 'x'), y: configuredDatum(state, 'y'), z: configuredDatum(state, 'z') };
  const multiAnchor = state.navisParse?.anchor?.active && Number(state.navisParse?.anchor?.validCount) > 1;
  return (state.navisParse?.tags || []).map((tag) => {
    const raw = tag.rawPosition || {};
    const transformed = tag.position || {};
    const applied = transformed.datumOffsetMm || {};
    const valid = Boolean(tag.rawPosition && tag.commentBody);
    const datumStatus = multiAnchor ? 'MULTI_ANCHOR_HYPOTHESES'
      : state.navisParse?.anchor?.active ? 'SINGLE_ANCHOR_APPLIED'
        : !state.inputsDirty && sameNumber(applied.x, configured.x) && sameNumber(applied.y, configured.y) && sameNumber(applied.z, configured.z)
          ? 'CURRENT' : 'REBUILD_REQUIRED';
    return {
      viewIndex: tag.viewIndex, viewName: tag.viewName, viewGuid: tag.viewGuid, tagId: tag.tagId,
      commentId: tag.commentId, commentBody: tag.commentBody, commentUser: tag.commentUser,
      positionSource: tag.positionSource, xmlX: compactNumber(raw.x, 6), xmlY: compactNumber(raw.y, 6),
      xmlZ: compactNumber(raw.z, 6), sourceUnit: transformed.sourceUnit || tag.units || '',
      unitScaleToMm: compactNumber(transformed.unitScale, 6), configuredDatumE: compactNumber(configured.x),
      configuredDatumN: compactNumber(configured.y), configuredDatumEL: compactNumber(configured.z),
      appliedDatumE: compactNumber(applied.x), appliedDatumN: compactNumber(applied.y), appliedDatumEL: compactNumber(applied.z),
      datumStatus, navisToJsonE: compactNumber(transformed.x), navisToJsonN: compactNumber(transformed.y),
      navisToJsonEL: compactNumber(transformed.z), eFormula: axisFormula(raw.x, transformed.unitScale, applied.x, transformed.x),
      nFormula: axisFormula(raw.y, transformed.unitScale, applied.y, transformed.y),
      elFormula: axisFormula(raw.z, transformed.unitScale, applied.z, transformed.z),
      coordinateProfile: transformed.profileName || tag.coordinateProfileName || '', axisBasis: transformed.axisBasis || '',
      transform: multiAnchor ? `${state.navisParse.anchor.validCount} equal-authority transforms evaluated during Stage 3` : tag.transformBasis || (tag.position ? `raw XYZ × ${transformed.unitScale} + applied datum offsets` : ''),
      coordinateStatus: valid ? (multiAnchor ? 'VALID_FOR_MULTI_ANCHOR_MATCHING' : 'VALID_FOR_MATCHING') : tag.position ? 'COORDINATE_ONLY' : 'INVALID',
      diagnostics: (tag.diagnostics || []).join(' | '),
    };
  });
}
export function matchRows(state) {
  const decisions = new Map((state.audit?.decisions || []).map((decision) => [decision.tableRowId, decision]));
  return (state.identityTrace?.rows || []).map((row) => {
    const decision = decisions.get(row.tableRowId);
    const selected = decision?.selectedCandidate || null;
    const nearest = decision?.nearestRejectedCandidate || null;
    const rowSelected = row.selectedNavisTagId ? {
      tagId: row.selectedNavisTagId, viewName: row.selectedNavisViewName, commentId: row.selectedNavisCommentId,
      commentBody: row.selectedNavisCommentBody, tagPosition: row.selectedNavisPosition, deltaEMm: row.deltaEMm,
      deltaNMm: row.deltaNMm, deltaElMm: row.deltaElMm, verticalBasis: row.verticalBasis,
      verticalResidualMm: row.verticalResidualMm,
    } : null;
    const displayed = selected || nearest || rowSelected;
    const propagated = decision?.propagatedIsonotes || row.propagatedIsonotes || [];
    const displayedRole = selected || rowSelected ? 'SELECTED_MATCH' : nearest ? 'NEAREST_REJECTED' : propagated.length ? 'PROPAGATED_NOTE_ONLY' : '';
    const displayedPoint = displayed?.tagPosition || null;
    const comparisonPoint = decision?.supportPosition || row.position || null;
    const failedAxes = nearest?.failedAxes || decision?.nearestRejectedAxes || [];
    return {
      resolutionRow: row.tableRowIndex, groupedJsonIdentities: row.tableIdentityRaw,
      jsonAnchorIdentity: row.canonicalIdentity, jsonNodeId: row.selectedNodeId, jsonPath: row.selectedJsonPath,
      ...pointColumns(row.position, 'json'), comparisonSource: decision?.supportPositionSource || (row.position ? 'STAGED_JSON' : ''),
      comparisonPath: decision?.supportPositionPath || row.positionSourcePath || '', ...pointColumns(comparisonPoint, 'comparison'),
      tableJsonCoordinateDelta: compactNumber(decision?.tableJsonCoordinateDeltaMm), navisStatus: decision?.status || row.navisResolutionStatus,
      displayedNavisRole: displayedRole, toleranceResult: selected || rowSelected ? 'WITHIN_TOLERANCE' : nearest ? 'OUTSIDE_TOLERANCE' : '',
      navisTagId: displayed?.tagId || decision?.selectedTagId || decision?.nearestRejectedTagId || '',
      navisView: displayed?.viewName || decision?.selectedViewName || decision?.nearestRejectedViewName || '',
      navisCommentId: displayed?.commentId || decision?.selectedCommentId || decision?.nearestRejectedCommentId || '',
      navisComment: displayed?.commentBody || decision?.nearestRejectedCommentBody || '', ...pointColumns(displayedPoint, 'navis'),
      anchorPairBasis: displayed?.anchorBasisLabel || decision?.selectedAnchorBasis || decision?.nearestRejectedAnchorBasis || '',
      anchorSelectionReason: displayed?.anchorSelectionReason || '',
      eligibleAnchorCount: displayed?.eligibleAnchorCount ?? '', equivalentAnchorCount: displayed?.equivalentAnchorCount ?? '',
      anchorDeltaE: compactNumber(displayed?.anchorTransformDeltaEMm, 6),
      anchorDeltaN: compactNumber(displayed?.anchorTransformDeltaNMm, 6),
      anchorDeltaEL: compactNumber(displayed?.anchorTransformDeltaElMm, 6),
      deltaE: compactNumber(displayed?.deltaEMm ?? decision?.nearestRejectedDeltaEMm),
      deltaN: compactNumber(displayed?.deltaNMm ?? decision?.nearestRejectedDeltaNMm),
      deltaEL: compactNumber(displayed?.deltaElMm ?? decision?.nearestRejectedDeltaElMm),
      verticalBasis: displayed?.verticalBasis || '', verticalResidual: compactNumber(displayed?.verticalResidualMm ?? decision?.nearestRejectedVerticalResidualMm),
      failedAxes: failedAxes.join(' | '), candidateCount: decision?.candidateCount ?? row.navisProximityEvidence?.candidateCount ?? '',
      decisionReason: decision?.decisionReason || '',
      auditRemark: decision?.auditRemark || (decision ? decisionAuditRemark(decision, state.audit?.config || state.config || {}) : 'Run Stage 3 to generate a direct-match conclusion.'),
      scoringModel: decision?.scoringModel || '',
      topCandidateTagId: decision?.topCandidateTagId || '', topCandidateScore: compactNumber(decision?.topCandidateScore, 6),
      topCandidateAnchorBasis: decision?.topCandidateAnchorBasis || '',
      runnerUpTagId: decision?.runnerUpTagId || '', runnerUpScore: compactNumber(decision?.runnerUpScore, 6),
      runnerUpCandidateAnchorBasis: decision?.runnerUpCandidateAnchorBasis || '',
      scoreGap: compactNumber(decision?.scoreGap, 6), requiredScoreGap: compactNumber(decision?.requiredScoreGap, 6),
      distinctCommentCount: decision?.distinctCommentCount ?? '', ambiguity: decision?.ambiguity || row.navisAmbiguity,
      confidence: decision?.confidence || row.navisConfidence, isonoteSource: decision?.isonoteSource || row.isonoteSource || '',
      directIsonote: decision?.directSupportIsonote ?? row.directSupportIsonote ?? '',
      propagatedFromTagIds: joined(decision?.propagatedFromTagIds || row.propagatedFromTagIds), propagatedCount: propagated.length,
      appliesToTargets: joined(decision?.appliesToDirective?.targets || row.appliesToDirective?.targets),
      selectedIsonote: decision?.supportIsonote ?? row.supportIsonote ?? '',
    };
  });
}
function candidateRows(state) {
  return (state.audit?.candidateLedger || []).map((row) => ({
    ...row, ...pointColumns(row.supportPosition, 'comparison'), candidateRank: row.candidateRank,
    normalizedResidualE: compactNumber(row.normalizedResidualE, 6), normalizedResidualN: compactNumber(row.normalizedResidualN, 6),
    normalizedResidualEL: compactNumber(row.normalizedResidualEL, 6), normalizedGeometryRms: compactNumber(row.normalizedGeometryRms, 6),
    score: compactNumber(row.score, 6), topCandidateScore: compactNumber(row.topCandidateScore, 6),
    runnerUpScore: compactNumber(row.runnerUpScore, 6), scoreGap: compactNumber(row.scoreGap, 6),
    requiredScoreGap: compactNumber(row.requiredScoreGap, 6), failedAxesDisplay: (row.failedAxes || []).join(' | '),
    rejectionReasonsDisplay: (row.rejectionReasons || []).join(' | '),
    auditRemark: row.auditRemark || '', confidenceReasonCodesDisplay: joined(row.confidenceReasons),
    anchorTransformDeltaE: compactNumber(row.anchorTransformDeltaEMm, 6),
    anchorTransformDeltaN: compactNumber(row.anchorTransformDeltaNMm, 6),
    anchorTransformDeltaEL: compactNumber(row.anchorTransformDeltaElMm, 6),
    anchorEvaluationsDisplay: (row.anchorEvaluations || []).map((item) => `${item.anchorBasisLabel}: ${item.withinTolerance ? 'IN' : 'OUT'} RMS=${item.normalizedGeometryRms ?? ''}`).join(' | '),
    comparisonOutcome: row.accepted ? 'SELECTED_MATCH'
      : row.ledgerKind === 'NEAREST_REJECTED' ? 'NEAREST_REJECTED'
        : row.decisionStatus === 'AMBIGUOUS' ? 'IN_TOLERANCE_AMBIGUOUS' : 'IN_TOLERANCE_RUNNER_UP',
  }));
}
export function propagationRows(state) {
  return (state.audit?.propagationLedger || []).map((row) => ({
    ...row, ...pointColumns(row.sourcePosition, 'source'), ...pointColumns(row.targetPosition, 'target'),
    deltaE: compactNumber(row.deltaE), deltaN: compactNumber(row.deltaN), deltaEL: compactNumber(row.deltaEl),
    alongAxisDelta: compactNumber(row.alongAxisDeltaMm), parallelOffset: compactNumber(row.parallelOffsetMm),
    elevationDelta: compactNumber(row.elevationDeltaMm), alongAxisTolerance: compactNumber(row.alongAxisToleranceMm),
    parallelOffsetTolerance: compactNumber(row.parallelOffsetToleranceMm), elevationTolerance: compactNumber(row.elevationToleranceMm),
    rejectionReasonsDisplay: joined(row.rejectionReasons), auditRemark: propagationAuditRemark(row),
    propagationResult: row.applied ? 'APPLIED' : row.outcome || 'REJECTED',
  }));
}
function renderJsonTrace(state) {
  const headers = [
    ['resolutionRow','Resolution row'], ['groupedIdentityRaw','Grouped source identities'], ['canonicalIdentity','Resolver anchor identity'], ['supportRoot','Support root'],
    ['identityStatus','JSON identity result',true], ['selectionReason','JSON selection reason code'], ['selectionRemark','JSON selection audit remark'], ['candidateCount','JSON candidates'], ['jsonNodeId','Selected JSON node ID'],
    ['jsonSourceFile','JSON source file'], ['jsonPath','Selected JSON object path'], ['rawType','JSON node type'], ['rawName','JSON node name'],
    ['identityPath','Identity attribute path'], ['referenceRaw','JSON reference value'], ['referencePath','JSON reference path'], ['positionPath','Coordinate attribute path'],
    ['jsonE','JSON E (comparison mm)'], ['jsonN','JSON N (comparison mm)'], ['jsonEL','JSON EL (comparison mm)'], ['sourceUnit','JSON source unit'],
    ['unitScale','JSON unit scale → mm'], ['datumOffsets','JSON datum offsets mm'], ['coordinateProfile','JSON coordinate profile'],
    ['resolvedBranch','Resolved branch'], ['resolvedPipe','Resolved pipe'], ['resolvedZone','Resolved zone'], ['identityConfidence','JSON identity confidence',true],
  ].map(([key,label,isBadge]) => ({ key, label, badge: Boolean(isBadge) }));
  return `<section class="nti-card"><div class="nti-section-head"><div><h3>JSON Trace — selected support nodes</h3></div><div class="nti-actions" style="margin-top:0"><button class="nti-btn" data-nti-action="download-trace" ${state.identityTrace?.rows?.length ? '' : 'disabled'}>Download full trace CSV</button><button class="nti-btn nti-btn-primary" data-nti-action="run">Run ISONOTE resolution</button></div></div>${stageIntro(1, 'JSON Trace', 'One row is one coordinate-grouped support target. It explains which staged JSON node supplies identity, reference, hierarchy and comparison-frame coordinates.')}${renderFilterBar('json-trace', 'Filter identity, node ID, JSON path, pipe, branch, zone or status...')}${renderTable(headers, jsonTraceRows(state), 'nti-filter-table-json-trace', 'Parse the staged JSON source to create the JSON trace.')}</section>`;
}
function renderNavisCoordinates(state) {
  const headers = [
    ['viewIndex','View #'], ['viewName','Navis view'], ['viewGuid','View GUID'], ['tagId','Navis Tag ID'], ['commentId','Comment ID'],
    ['commentBody','Comment / candidate ISONOTE'], ['commentUser','Comment author'], ['positionSource','XML coordinate source'],
    ['xmlX','XML X raw'], ['xmlY','XML Y raw'], ['xmlZ','XML Z raw'], ['sourceUnit','XML source unit'], ['unitScaleToMm','Unit scale → mm'],
    ['configuredDatumE','Configured E offset mm'], ['configuredDatumN','Configured N offset mm'], ['configuredDatumEL','Configured EL offset mm'],
    ['appliedDatumE','Displayed E offset mm'], ['appliedDatumN','Displayed N offset mm'], ['appliedDatumEL','Displayed EL offset mm'], ['datumStatus','Anchor transform mode',true],
    ['navisToJsonE','Displayed E mm'], ['navisToJsonN','Displayed N mm'], ['navisToJsonEL','Displayed EL mm'],
    ['eFormula','Displayed E formula'], ['nFormula','Displayed N formula'], ['elFormula','Displayed EL formula'],
    ['coordinateProfile','Navis coordinate profile'], ['axisBasis','Axis interpretation'], ['transform','Transformation basis'], ['coordinateStatus','Ready for Stage 3?',true], ['diagnostics','Coordinate / comment issues'],
  ].map(([key,label,isBadge]) => ({ key, label, badge: Boolean(isBadge) }));
  const cfg = state.config || {};
  const multiAnchor = state.navisParse?.anchor?.active && Number(state.navisParse?.anchor?.validCount) > 1;
  const modeHelp = multiAnchor
    ? `<div class="nti-help"><b>${esc(state.navisParse.anchor.validCount)} equal-authority anchor transforms are active.</b> The displayed coordinate is only the base/configured frame. Stage 3 evaluates every Tag under every anchor and records the winning Anchor pair basis.</div>`
    : `<div class="nti-help">Transformation: raw XML XYZ × unit scale + displayed datum offsets. Current configured offsets: E ${esc(cfg.navisEastingDatumMm ?? 0)} mm; N ${esc(cfg.navisNorthingDatumMm ?? 0)} mm; EL ${esc(cfg.navisElevationDatumMm ?? 0)} mm.</div>`;
  const freshness = state.inputsDirty
    ? '<div class="nti-help"><b>Configuration/source changes are pending.</b> Run resolution to rebuild the anchor hypotheses and candidate evidence.</div>'
    : '<div class="nti-help">The displayed source coordinates and current anchor-hypothesis set are up to date.</div>';
  return `<section class="nti-card"><div class="nti-section-head"><div><h3>Navis Tag Coordinate Resolution — one row per Tag ID</h3></div><div class="nti-actions" style="margin-top:0"><button class="nti-btn nti-btn-primary" data-nti-action="run">Run ISONOTE resolution</button></div></div>${stageIntro(2, 'Navis Tag Coordinate Resolution', 'Shows raw XML coordinates and whether matching uses one applied anchor or multiple independent anchor hypotheses.')}${modeHelp}${freshness}${renderFilterBar('navis-coordinate', 'Filter Tag ID, view, comment, anchor mode, formula or coordinate...')}${renderTable(headers, navisCoordinateRows(state), 'nti-filter-table-navis-coordinate', 'Parse Navis Tag XML to list Tag coordinates.')}</section>`;
}
function renderMatch(state) {
  const matchHeaders = [
    ['resolutionRow','Resolution row'], ['groupedJsonIdentities','Grouped JSON identities'], ['jsonAnchorIdentity','JSON resolver anchor'], ['jsonNodeId','JSON node ID'], ['jsonPath','JSON path'],
    ['jsonE','Resolved JSON E mm'], ['jsonN','Resolved JSON N mm'], ['jsonEL','Resolved JSON EL mm'], ['comparisonSource','Actual comparison source',true], ['comparisonPath','Actual comparison coordinate path'],
    ['comparisonE','Actual comparison E mm'], ['comparisonN','Actual comparison N mm'], ['comparisonEL','Actual comparison EL mm'], ['tableJsonCoordinateDelta','Table ↔ JSON distance mm'],
    ['navisStatus','Direct match result',true], ['decisionReason','Decision reason code',true], ['auditRemark','Direct-match audit remark'], ['scoringModel','Candidate score model'],
    ['topCandidateTagId','Top candidate Tag ID'], ['topCandidateScore','Top score'], ['topCandidateAnchorBasis','Top candidate anchor basis'],
    ['runnerUpTagId','Runner-up Tag ID'], ['runnerUpScore','Runner-up score'], ['runnerUpCandidateAnchorBasis','Runner-up anchor basis'],
    ['scoreGap','Score gap'], ['requiredScoreGap','Required gap'], ['distinctCommentCount','Distinct comments'], ['displayedNavisRole','Displayed Navis evidence',true],
    ['toleranceResult','Direct tolerance result',true], ['navisTagId','Direct / nearest Navis Tag ID'], ['navisView','Navis view'], ['navisCommentId','Comment ID'], ['navisComment','Navis comment'],
    ['anchorPairBasis','Anchor pair basis'], ['anchorSelectionReason','Anchor selection reason'], ['eligibleAnchorCount','In-tolerance anchors'], ['equivalentAnchorCount','Equivalent best anchors'],
    ['anchorDeltaE','Anchor transform ΔE mm'], ['anchorDeltaN','Anchor transform ΔN mm'], ['anchorDeltaEL','Anchor transform ΔEL mm'],
    ['navisE','Navis transformed E mm'], ['navisN','Navis transformed N mm'], ['navisEL','Navis transformed EL mm'], ['deltaE','ΔE mm'], ['deltaN','ΔN mm'], ['deltaEL','ΔEL mm'],
    ['verticalBasis','Vertical comparison basis'], ['verticalResidual','Vertical residual mm'], ['failedAxes','Failed tolerance axes (direct)'], ['candidateCount','Direct candidates within tolerance'],
    ['ambiguity','Direct decision / rejection code'], ['confidence','Direct match confidence',true], ['isonoteSource','Final ISONOTE source',true], ['directIsonote','Direct ISONOTE'],
    ['propagatedFromTagIds','Propagated from Tag IDs'], ['propagatedCount','Propagation count'], ['appliesToTargets','Source directive target pipes'], ['selectedIsonote','Final Support ISONOTE'],
  ].map(([key,label,isBadge]) => ({ key, label, badge: Boolean(isBadge) }));
  const candidateHeaders = [
    ['tableRowIndex','Resolution row'], ['canonicalIdentity','JSON identity'], ['jsonSourceFile','JSON source'], ['jsonPath','JSON path'], ['ledgerKind','Comparison type'],
    ['supportPositionSource','Actual comparison source'], ['supportPositionPath','Actual comparison path'], ['comparisonE','Comparison E mm'], ['comparisonN','Comparison N mm'], ['comparisonEL','Comparison EL mm'],
    ['candidateRank','Candidate rank'], ['tagId','Navis Tag ID'], ['viewName','Navis view'], ['commentBody','Navis comment'], ['withinTolerance','Within tolerance?'],
    ['anchorBasisLabel','Anchor pair basis'], ['anchorSelectionReason','Anchor selection reason'], ['eligibleAnchorCount','In-tolerance anchors'], ['equivalentAnchorCount','Equivalent best anchors'],
    ['anchorTransformDeltaE','Anchor ΔE mm'], ['anchorTransformDeltaN','Anchor ΔN mm'], ['anchorTransformDeltaEL','Anchor ΔEL mm'], ['anchorEvaluationsDisplay','All anchor evaluations'],
    ['failedAxesDisplay','Failed axes'], ['rejectionReasonsDisplay','Rejection reason codes'], ['deltaEMm','ΔE mm'], ['deltaNMm','ΔN mm'], ['deltaElMm','ΔEL mm'],
    ['verticalResidualMm','Vertical residual mm'], ['normalizedResidualE','E / tolerance'], ['normalizedResidualN','N / tolerance'], ['normalizedResidualEL','EL / tolerance'],
    ['normalizedGeometryRms','Normalized geometry RMS'], ['scoringModel','Score model'], ['score','Candidate score (0–100, not percentage)'],
    ['decisionStatus','Decision status',true], ['decisionReason','Decision reason code',true], ['topCandidateTagId','Top candidate Tag ID'], ['topCandidateScore','Top score'], ['topCandidateAnchorBasis','Top anchor basis'],
    ['runnerUpTagId','Runner-up Tag ID'], ['runnerUpScore','Runner-up score'], ['runnerUpCandidateAnchorBasis','Runner-up anchor basis'], ['scoreGap','Score gap'], ['requiredScoreGap','Required score gap'],
    ['distinctCommentCount','Distinct comments'], ['auditRemark','Audit remark'], ['confidenceReasonCodesDisplay','Machine scoring codes'], ['comparisonOutcome','Outcome',true],
  ].map(([key,label,isBadge]) => ({ key, label, badge: Boolean(isBadge) }));
  const propagationHeaders = [
    ['sourceTagId','Source Tag ID'], ['sourceTableRowId','Source resolution row'], ['sourcePipe','Source pipe'], ['sourceAxis','Source pipe axis'], ['sourceAxisBasis','Source axis basis'],
    ['requestedTargetPipe','Requested target pipe'], ['requestedLineKey','Extracted line key'], ['matchedTargetPipe','Matched staged pipe'], ['pipeMatchBasis','Pipe match basis'],
    ['targetPipeAxis','Target pipe axis'], ['targetAxisBasis','Target axis basis'], ['targetTableRowIndex','Target resolution row'], ['targetIdentity','Target support identity'], ['targetSupportRoot','Target support root'],
    ['sourceE','Source E mm'], ['sourceN','Source N mm'], ['sourceEL','Source EL mm'], ['targetE','Target E mm'], ['targetN','Target N mm'], ['targetEL','Target EL mm'],
    ['deltaE','ΔE mm'], ['deltaN','ΔN mm'], ['deltaEL','ΔEL mm'], ['alongAxisDelta','Along-axis delta mm'], ['alongAxisTolerance','Along-axis tolerance mm'],
    ['parallelOffset','Parallel offset mm'], ['parallelOffsetTolerance','Parallel offset mm'], ['elevationDelta','Elevation delta mm'], ['elevationTolerance','Elevation tolerance mm'],
    ['baseIsonote','Base ISONOTE'], ['derivedIsonote','Derived target ISONOTE'], ['propagationResult','Propagation result',true], ['auditRemark','Propagation audit remark'], ['rejectionReasonsDisplay','Rejection reason codes'],
  ].map(([key,label,isBadge]) => ({ key, label, badge: Boolean(isBadge) }));
  const scoreHelp = '<div class="nti-help"><b>Candidate score is not a percentage.</b> Each Tag is first evaluated under every valid equal-authority anchor. Only its mathematically best anchor evaluation enters normal Tag ranking. Hard E/N/EL tolerances and comment ambiguity remain unchanged.</div>';
  return `<section class="nti-card"><div class="nti-section-head"><div><h3>Navis Tag ↔ JSON Node Match — final decisions</h3></div><div class="nti-actions" style="margin-top:0"><button class="nti-btn nti-btn-primary" data-nti-action="run">Run ISONOTE resolution</button></div></div>${stageIntro(3, 'Navis Tag vs JSON Node Match', 'Each Tag candidate records the anchor pair that produced its best tolerance-normalized comparison. Anchor entry order has no engineering effect.')} ${renderFilterBar('json-navis-match', 'Filter JSON identity, Tag ID, anchor pair, comment, status, failed axis or delta...')}${renderTable(matchHeaders, matchRows(state), 'nti-filter-table-json-navis-match', 'Run proximity resolution to generate final JSON ↔ Navis decisions.')}</section><section class="nti-card"><h3>Applies-to pipe propagation</h3><div class="nti-help">Propagation retains the selected source Tag and its anchor pair basis through the final output. The target-pipe, axis and coordinate-window rules are unchanged.</div>${renderFilterBar('pipe-propagation', 'Filter source Tag, requested or matched pipe, line key, support, axis, result or rejection reason...')}${renderTable(propagationHeaders, propagationRows(state), 'nti-filter-table-pipe-propagation', 'No applies-to directives were resolved or no propagation candidates were produced.')}</section><section class="nti-card"><h3>Candidate and nearest-rejected coordinate comparisons</h3>${scoreHelp}${renderFilterBar('candidate-comparison', 'Filter Tag ID, JSON identity, anchor pair, decision reason, score gap or delta...')}${renderTable(candidateHeaders, candidateRows(state), 'nti-filter-table-candidate-comparison', 'Run proximity resolution to create candidate and nearest-rejected comparisons.')}</section>`;
}
export function renderNavisTagIsonoteEvidencePane(state) {
  if (state.activeTab === 'hierarchy') return renderJsonTrace(state);
  if (state.activeTab === 'identity') return renderNavisCoordinates(state);
  if (state.activeTab === 'candidates') return renderMatch(state);
  return null;
}
export const _test = Object.freeze({ jsonTraceRows, navisCoordinateRows, matchRows, candidateRows, propagationRows, axisFormula });

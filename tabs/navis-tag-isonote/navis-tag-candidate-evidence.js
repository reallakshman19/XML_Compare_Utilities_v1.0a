import { candidateAuditRemark, decisionAuditRemark } from './navis-tag-audit-remarks.js';

function positionLabel(point) { return point ? `E=${point.x};N=${point.y};EL=${point.z}` : ''; }

function nearestRejectedMessage(candidate, config) {
  const label = candidate?.tagId ? `Tag ${candidate.tagId}` : candidate?.evidenceId || 'Nearest Navis tag';
  const anchor = candidate?.anchorBasisLabel ? ` Anchor basis: ${candidate.anchorBasisLabel}.` : '';
  return `${label} (${candidate?.viewName || 'unnamed view'}) is the nearest rejected tag: ΔE ${candidate.deltaEMm.toFixed(3)} mm, ΔN ${candidate.deltaNMm.toFixed(3)} mm, ΔEL ${candidate.deltaElMm.toFixed(3)} mm, vertical residual ${candidate.verticalResidualMm.toFixed(3)} mm. Failed axes: ${candidate.failedAxes.join(', ') || '(none)'}. Tolerances: E ${config.eastingToleranceMm} mm, N ${config.northingToleranceMm} mm, EL ${config.elevationToleranceMm} mm.${anchor}`;
}

function ledgerBase(record, trace, positionChoice) {
  return {
    tableRowId: record.rowId, tableRowIndex: record.rowIndex, canonicalIdentity: record.identity,
    tableIdentityRaw: record.identityRaw, groupedIdentities: record.groupedIdentities || [record.identity].filter(Boolean),
    groupMemberCount: record.groupMemberCount || 1, supportRoot: record.supportRoot, inputPipe: record.inputPipe,
    jsonNodeId: trace?.selectedNodeId || '', jsonSourceFile: trace?.selectedSourceFile || '', jsonPath: trace?.selectedJsonPath || '',
    jsonAncestorIds: trace?.selectedAncestorIds || [], jsonIdentityPath: trace?.selectedIdentityPath || '',
    jsonPositionPath: trace?.positionSourcePath || '', resolvedBranch: trace?.resolvedBranch || '', resolvedPipe: trace?.resolvedPipe || '',
    resolvedZone: trace?.resolvedZone || '', odMm: trace?.odMm ?? null, odSource: trace?.odSource || 'NONE',
    boreNominalMm: trace?.boreNominalMm ?? null, supportPositionSource: positionChoice.source,
    supportPositionPath: positionChoice.sourcePath, supportPosition: positionChoice.point,
    tableJsonCoordinateDeltaMm: positionChoice.comparison,
  };
}

function resultEvidence(result) {
  return {
    scoringModel: result.scoringModel,
    decisionPolicy: result.decisionPolicy || '',
    decisionStatus: result.status,
    decisionReason: result.decisionReason,
    topCandidateTagId: result.topCandidateTagId,
    topCandidateScore: result.topCandidateScore,
    topCandidateAnchorBasis: result.topCandidateAnchorBasis || '',
    runnerUpTagId: result.runnerUpTagId,
    runnerUpScore: result.runnerUpScore,
    runnerUpCandidateAnchorBasis: result.runnerUpCandidateAnchorBasis || '',
    scoreGap: result.scoreGap,
    requiredScoreGap: result.requiredScoreGap,
    distinctCommentCount: result.distinctCommentCount,
    crossLoopWinnerCount: result.crossLoopWinnerCount ?? '',
    equivalentCrossLoopWinnerCount: result.equivalentCrossLoopWinnerCount ?? '',
    crossLoopGeometryGapMm: result.crossLoopGeometryGapMm ?? '',
  };
}

function readableCandidate(row, config = {}) {
  return { ...row, auditRemark: candidateAuditRemark(row, config) };
}

function selectedCandidateMatches(selected, candidate) {
  if (!selected || !candidate) return false;
  if (selected.candidateKey || candidate.candidateKey) return selected.candidateKey === candidate.candidateKey;
  return selected.evidenceId === candidate.evidenceId;
}

export function appendCandidateLedger(candidateLedger, base, candidates, result) {
  candidates.forEach((candidate, index) => {
    const row = {
      ledgerId: `${base.tableRowId}:C${index + 1}`,
      ledgerKind: 'ACCEPTED_CANDIDATE',
      ...base,
      candidateRank: index + 1,
      accepted: selectedCandidateMatches(result.selected, candidate),
      ...resultEvidence(result),
      ...candidate,
    };
    candidateLedger.push(readableCandidate(row));
  });
}

export function appendNearestRejected(candidateLedger, diagnostics, base, result, config) {
  if (result.selected || !result.nearestRejected || result.topCandidateTagId) return;
  const row = {
    ledgerId: `${base.tableRowId}:NEAREST-REJECTED`, ledgerKind: 'NEAREST_REJECTED', ...base,
    candidateRank: 1, accepted: false, ...resultEvidence(result), ...result.nearestRejected,
  };
  candidateLedger.push(readableCandidate(row, config));
  diagnostics.push({
    severity: 'WARN', code: 'NAVIS_NEAREST_TAG_OUTSIDE_TOLERANCE', rowId: base.tableRowId,
    identity: base.canonicalIdentity, evidenceId: result.nearestRejected.evidenceId,
    tagId: result.nearestRejected.tagId, viewName: result.nearestRejected.viewName,
    failedAxes: result.nearestRejected.failedAxes, deltaEMm: result.nearestRejected.deltaEMm,
    deltaNMm: result.nearestRejected.deltaNMm, deltaElMm: result.nearestRejected.deltaElMm,
    verticalResidualMm: result.nearestRejected.verticalResidualMm,
    anchorBasis: result.nearestRejected.anchorBasisLabel || '',
    message: nearestRejectedMessage(result.nearestRejected, config),
  });
}

export function createLedgerBase(record, trace, positionChoice) {
  return ledgerBase(record, trace, positionChoice);
}

export function buildDecisionRow(record, trace, positionChoice, candidates, result, config) {
  const selected = result.selected || null;
  const nearest = result.nearestRejected || null;
  const auditRemark = decisionAuditRemark({
    ...result,
    canonicalIdentity: record.identity,
    selectedTagId: selected?.tagId || '',
    selectedAnchorBasis: selected?.anchorBasisLabel || '',
    confidenceScore: result.score,
    nearestRejectedCandidate: nearest,
  }, config);
  return {
    decisionId: `DECISION-${record.rowId}`, ...ledgerBase(record, trace, positionChoice),
    identityStatus: trace?.status || 'UNRESOLVED', identityTraceId: trace?.traceId || '',
    odPath: trace?.odPath || '', odLookupName: trace?.odLookupName || '', borePath: trace?.borePath || '',
    boreUnits: trace?.boreUnits || config.jsonBoreUnits, candidateCount: candidates.length,
    status: result.status, ambiguity: result.ambiguity, confidence: result.confidence,
    confidenceScore: result.score, confidenceReasons: result.confidenceReasons, auditRemark, ...resultEvidence(result),
    supportIsonote: selected?.commentBody || '', selectedEvidenceId: selected?.evidenceId || '',
    selectedCandidateKey: selected?.candidateKey || '',
    selectedViewName: selected?.viewName || '', selectedViewGuid: selected?.viewGuid || '',
    selectedTagId: selected?.tagId || '', selectedCommentId: selected?.commentId || '',
    selectedNavisPosition: selected?.tagPosition || null,
    selectedNavisPositionSource: selected?.positionSource || '', selectedCandidate: selected,
    selectedAnchorBasis: selected?.anchorBasisLabel || '', selectedAnchorBasisId: selected?.anchorBasisId || '',
    selectedAnchorTagId: selected?.anchorBasisTagId || '', selectedAnchorSupportIdentity: selected?.anchorBasisSupportIdentity || '',
    selectedAnchorDeltaEMm: selected?.anchorTransformDeltaEMm ?? null,
    selectedAnchorDeltaNMm: selected?.anchorTransformDeltaNMm ?? null,
    selectedAnchorDeltaElMm: selected?.anchorTransformDeltaElMm ?? null,
    selectedAnchorLoopRank: selected?.anchorLoopRank ?? null,
    selectedCrossLoopRank: selected?.crossLoopRank ?? null,
    nearestRejectedEvidenceId: nearest?.evidenceId || '', nearestRejectedViewName: nearest?.viewName || '',
    nearestRejectedViewGuid: nearest?.viewGuid || '', nearestRejectedTagId: nearest?.tagId || '',
    nearestRejectedCommentId: nearest?.commentId || '', nearestRejectedCommentBody: nearest?.commentBody || '',
    nearestRejectedNavisPosition: nearest?.tagPosition || null, nearestRejectedAxes: nearest?.failedAxes || [],
    nearestRejectedDeltaEMm: nearest?.deltaEMm ?? null, nearestRejectedDeltaNMm: nearest?.deltaNMm ?? null,
    nearestRejectedDeltaElMm: nearest?.deltaElMm ?? null,
    nearestRejectedVerticalResidualMm: nearest?.verticalResidualMm ?? null,
    nearestRejectedAnchorBasis: nearest?.anchorBasisLabel || '', nearestRejectedCandidate: nearest,
  };
}

export function buildAugmentedRow(record, decisionRow, result, candidates) {
  return {
    ...record.rawRow, 'Support ISONOTE': decisionRow.supportIsonote, 'Proximity PS/SL': record.supportRoot,
    'Resolved Branch Name': decisionRow.resolvedBranch, 'Resolved Pipe Name': decisionRow.resolvedPipe,
    'Resolved Zone Name': decisionRow.resolvedZone, 'Resolved Support POS': positionLabel(decisionRow.supportPosition),
    'Support Position Path': decisionRow.supportPositionPath, 'Navis Tag POS': positionLabel(result.selected?.tagPosition),
    'Navis Position Source': result.selected?.positionSource || '', 'Delta E mm': result.selected?.deltaEMm ?? '',
    'Delta N mm': result.selected?.deltaNMm ?? '', 'Delta EL mm': result.selected?.deltaElMm ?? '',
    'Anchor pair basis': decisionRow.selectedAnchorBasis || decisionRow.nearestRejectedAnchorBasis || '',
    'Anchor Selection Reason': result.selected?.anchorSelectionReason || result.nearestRejected?.anchorSelectionReason || '',
    'Anchor Loop Rank': result.selected?.anchorLoopRank ?? result.nearestRejected?.anchorLoopRank ?? '',
    'Cross-loop Rank': result.selected?.crossLoopRank ?? '',
    'Cross-loop Winner Count': result.crossLoopWinnerCount ?? '',
    'Cross-loop Geometry Gap mm': result.crossLoopGeometryGapMm ?? '',
    'Bore Nominal mm': decisionRow.boreNominalMm ?? '', 'Bore Source Path': decisionRow.borePath,
    'OD mm': decisionRow.odMm ?? '', 'OD Source Path': decisionRow.odPath, 'OD Source': decisionRow.odSource,
    'OD Lookup Name': decisionRow.odLookupName, 'Vertical Basis': result.selected?.verticalBasis || '',
    'Vertical Residual mm': result.selected?.verticalResidualMm ?? '', 'Candidate Count': candidates.length,
    'Candidate Score Model': decisionRow.scoringModel, 'Decision Policy': decisionRow.decisionPolicy,
    'Decision Reason': decisionRow.decisionReason, 'Audit Remark': decisionRow.auditRemark,
    'Top Candidate Tag ID': decisionRow.topCandidateTagId, 'Top Candidate Score': decisionRow.topCandidateScore ?? '',
    'Top Candidate Anchor Basis': decisionRow.topCandidateAnchorBasis,
    'Runner-up Tag ID': decisionRow.runnerUpTagId, 'Runner-up Score': decisionRow.runnerUpScore ?? '',
    'Runner-up Anchor Basis': decisionRow.runnerUpCandidateAnchorBasis,
    'Score Gap': decisionRow.scoreGap ?? '', 'Required Score Gap': decisionRow.requiredScoreGap,
    'Distinct Comment Count': decisionRow.distinctCommentCount, Ambiguities: decisionRow.ambiguity,
    Confidence: decisionRow.confidence, 'Confidence Score': decisionRow.confidenceScore,
    'Confidence Reasons': decisionRow.confidenceReasons.join('|'), 'Match Source': decisionRow.supportPositionSource,
    'Evidence ID': decisionRow.selectedEvidenceId, 'Navis View Name': decisionRow.selectedViewName,
    'Navis View GUID': decisionRow.selectedViewGuid, 'Navis Tag ID': decisionRow.selectedTagId,
    'Navis Comment ID': decisionRow.selectedCommentId, 'Nearest Rejected Navis Tag ID': decisionRow.nearestRejectedTagId,
    'Nearest Rejected Navis View': decisionRow.nearestRejectedViewName,
    'Nearest Rejected Axes': decisionRow.nearestRejectedAxes.join('|'),
    'Nearest Rejected Delta E mm': decisionRow.nearestRejectedDeltaEMm ?? '',
    'Nearest Rejected Delta N mm': decisionRow.nearestRejectedDeltaNMm ?? '',
    'Nearest Rejected Delta EL mm': decisionRow.nearestRejectedDeltaElMm ?? '',
    'Nearest Rejected Vertical Residual mm': decisionRow.nearestRejectedVerticalResidualMm ?? '',
    'Identity Trace ID': decisionRow.identityTraceId,
  };
}

export const _test = Object.freeze({ selectedCandidateMatches });

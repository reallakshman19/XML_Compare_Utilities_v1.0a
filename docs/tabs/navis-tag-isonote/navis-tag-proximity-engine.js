import { NAVIS_TAG_ISONOTE_AUDIT_SCHEMA, normalizeConfig } from './navis-tag-isonote-contracts.js';
import { applyAppliesToPropagation } from './navis-tag-applies-to.js';
import { buildAnchorConsistencyDiagnostics } from './navis-tag-anchor-diagnostics.js';
import {
  NAVIS_CANDIDATE_SCORE_MODEL,
  axisFailures,
  candidateFromTag,
  candidateScore,
  decision,
  evaluateCandidates,
  unresolvedDecision,
  verticalResidual,
} from './navis-tag-candidate-ranking.js';
import {
  appendCandidateLedger,
  appendNearestRejected,
  buildAugmentedRow,
  buildDecisionRow,
  createLedgerBase,
} from './navis-tag-candidate-evidence.js';
import {
  decisionAcrossAnchorLoops,
  evaluateCandidatesAcrossAnchors,
} from './navis-tag-multi-anchor-ranking.js';
import { applyAnchorTransformation } from './navis-tag-xml-parser.js';

export { NAVIS_CANDIDATE_SCORE_MODEL } from './navis-tag-candidate-ranking.js';

function chooseSupportPosition(trace, config) {
  const tablePoint = trace.tableRecord?.position || null;
  const jsonPoint = trace.position || null;
  const mode = config.supportCoordinateSource;
  const comparison = tablePoint && jsonPoint ? Math.hypot(tablePoint.x - jsonPoint.x, tablePoint.y - jsonPoint.y, tablePoint.z - jsonPoint.z) : null;
  if (mode === 'table-only') return { point: tablePoint, source: tablePoint ? 'TABLE' : 'NONE', comparison, sourcePath: trace.tableRecord?.positionColumn || '' };
  if (mode === 'json-only') return { point: jsonPoint, source: jsonPoint ? 'STAGED_JSON' : 'NONE', comparison, sourcePath: trace.positionSourcePath || '' };
  if (mode === 'prefer-json-fallback-table') return { point: jsonPoint || tablePoint, source: jsonPoint ? 'STAGED_JSON' : tablePoint ? 'TABLE' : 'NONE', comparison, sourcePath: jsonPoint ? trace.positionSourcePath || '' : trace.tableRecord?.positionColumn || '' };
  if (mode === 'compare-table-json') return { point: tablePoint || jsonPoint, source: tablePoint && jsonPoint ? 'TABLE_AND_STAGED_JSON' : tablePoint ? 'TABLE' : jsonPoint ? 'STAGED_JSON' : 'NONE', comparison, sourcePath: tablePoint ? trace.tableRecord?.positionColumn || '' : trace.positionSourcePath || '' };
  return { point: tablePoint || jsonPoint, source: tablePoint ? 'TABLE' : jsonPoint ? 'STAGED_JSON' : 'NONE', comparison, sourcePath: tablePoint ? trace.tableRecord?.positionColumn || '' : trace.positionSourcePath || '' };
}

function effectiveConfig(tableBuild, identityTrace, navisParse, inputConfig) {
  let config = normalizeConfig({ ...(tableBuild?.config || {}), ...(identityTrace?.config || {}), ...inputConfig });
  const configuredSupportCoordinateSource = config.supportCoordinateSource;
  if (navisParse && identityTrace) {
    applyAnchorTransformation(navisParse, identityTrace, config);
    if (navisParse.anchor?.active) {
      config = { ...config, supportCoordinateSource: 'prefer-json-fallback-table' };
      if (navisParse.anchor.globalTransformApplied) config = {
        ...config,
        navisEastingDatumMm: navisParse.anchor.deltaEMm,
        navisNorthingDatumMm: navisParse.anchor.deltaNMm,
        navisElevationDatumMm: navisParse.anchor.deltaElMm,
      };
    }
  }
  return { config, configuredSupportCoordinateSource };
}

function appendCoordinateSourceDiagnostic(diagnostics, navisParse, configuredSource, appliedSource) {
  if (!navisParse?.anchor?.active || configuredSource === appliedSource) return;
  diagnostics.push({
    severity: 'INFO',
    code: 'ANCHOR_JSON_COORDINATE_SOURCE_OVERRIDE',
    anchorPolicy: navisParse.anchor.policy,
    validAnchorCount: navisParse.anchor.validCount,
    configuredSupportCoordinateSource: configuredSource,
    appliedSupportCoordinateSource: appliedSource,
    message: `Equal-authority anchor mode changed the Stage 3 support coordinate source from ${configuredSource} to ${appliedSource}; one complete matching loop is executed per valid anchor and only each loop's closest in-tolerance candidate enters cross-loop selection.`,
  });
}

function appendAnchorConsistencyDiagnostic(diagnostics, anchorDiagnostics) {
  if (!anchorDiagnostics?.summary?.validAnchorCount) return;
  diagnostics.push({
    severity: 'INFO',
    code: 'ANCHOR_CONSISTENCY_SUMMARY',
    authorityEffect: anchorDiagnostics.authorityEffect,
    diagnosticCodes: anchorDiagnostics.diagnosticCodes,
    validAnchorCount: anchorDiagnostics.summary.validAnchorCount,
    usedAsBestBasisCount: anchorDiagnostics.summary.usedAsBestBasisCount,
    equivalentBestCandidateCount: anchorDiagnostics.summary.equivalentBestCandidateCount,
    maxPairwiseSeparationMm: anchorDiagnostics.summary.maxPairwiseSeparationMm,
    message: `${anchorDiagnostics.summary.summaryText} This diagnostic is evidence-only and does not change matching authority.`,
  });
}

function positionChoiceFor(record, trace, config) {
  if (trace) return chooseSupportPosition(trace, config);
  return {
    point: record.position,
    source: record.position ? 'TABLE' : 'NONE',
    comparison: null,
    sourcePath: record.positionColumn || '',
  };
}

function appendCoordinateDisagreement(diagnostics, record, positionChoice, config) {
  if (!Number.isFinite(positionChoice.comparison) || positionChoice.comparison <= config.coordinateDisagreementToleranceMm) return;
  diagnostics.push({
    severity: 'WARN',
    code: 'TABLE_JSON_COORDINATE_DISAGREEMENT',
    rowId: record.rowId,
    identity: record.identity,
    distanceMm: positionChoice.comparison,
    message: `Table and staged coordinates differ by ${positionChoice.comparison.toFixed(3)} mm.`,
  });
}

function candidateEvaluation(trace, positionChoice, navisParse, config) {
  if (!positionChoice.point) return { mode: 'DIRECT', candidates: [], nearestRejected: null, anchorLoopLedger: [] };
  const anchors = navisParse?.anchor?.hypotheses || [];
  if (anchors.length) return evaluateCandidatesAcrossAnchors(trace || {}, positionChoice.point, navisParse?.tags || [], anchors, config);
  return { mode: 'DIRECT', ...evaluateCandidates(trace || {}, positionChoice.point, navisParse?.tags || [], config), anchorLoopLedger: [] };
}

function appendAnchorLoopLedger(target, base, evaluation, result) {
  for (const row of evaluation.anchorLoopLedger || []) {
    target.push({
      ledgerId: `${base.tableRowId}:LOOP:${row.anchorBasisId}:${row.anchorLoopCandidateKind}:${row.anchorLoopRank}:${row.tagId}`,
      ledgerKind: 'ANCHOR_LOOP_CANDIDATE',
      ...base,
      decisionStatus: result.status,
      decisionReason: result.decisionReason,
      selectedCandidateKey: result.selected?.candidateKey || '',
      topCandidateTagId: result.topCandidateTagId || '',
      runnerUpTagId: result.runnerUpTagId || '',
      ...row,
    });
  }
}

function resolveRecord(record, trace, navisParse, config, candidateLedger, anchorLoopLedger, diagnostics) {
  const positionChoice = positionChoiceFor(record, trace, config);
  appendCoordinateDisagreement(diagnostics, record, positionChoice, config);
  const evaluation = candidateEvaluation(trace, positionChoice, navisParse, config);
  const result = positionChoice.point
    ? evaluation.mode === 'ANCHOR_LOOPS'
      ? decisionAcrossAnchorLoops(evaluation.candidates, config, evaluation.nearestRejected)
      : decision(evaluation.candidates, config, evaluation.nearestRejected)
    : {
      ...unresolvedDecision(null, config),
      ambiguity: trace?.status || 'SUPPORT_POSITION_UNAVAILABLE',
      decisionReason: 'SUPPORT_POSITION_UNAVAILABLE',
      confidenceReasons: ['SUPPORT_POSITION_UNAVAILABLE'],
    };
  const base = createLedgerBase(record, trace, positionChoice);
  appendAnchorLoopLedger(anchorLoopLedger, base, evaluation, result);
  appendCandidateLedger(candidateLedger, base, evaluation.candidates, result);
  appendNearestRejected(candidateLedger, diagnostics, base, result, config);
  const decisionRow = buildDecisionRow(record, trace, positionChoice, evaluation.candidates, result, config);
  return { decisionRow, augmentedRow: buildAugmentedRow(record, decisionRow, result, evaluation.candidates) };
}

function anchorUsage(candidateLedger) {
  const byAnchor = {};
  for (const row of candidateLedger) {
    if (!row.anchorBasisId) continue;
    if (!byAnchor[row.anchorBasisId]) byAnchor[row.anchorBasisId] = { anchorBasisId: row.anchorBasisId, anchorBasisLabel: row.anchorBasisLabel, candidateCount: 0, selectedCount: 0 };
    byAnchor[row.anchorBasisId].candidateCount += 1;
    if (row.accepted) byAnchor[row.anchorBasisId].selectedCount += 1;
  }
  return Object.values(byAnchor).sort((a, b) => a.anchorBasisId.localeCompare(b.anchorBasisId));
}

function auditSummary(tableBuild, identityTrace, navisParse, decisions, candidateLedger, anchorLoopLedger, anchorDiagnostics) {
  return {
    tableRowCount: tableBuild?.records?.length || 0,
    identityResolvedCount: identityTrace?.summary?.resolvedCount || 0,
    navisTagCount: navisParse?.summary?.tagCount || 0,
    resolvedCount: decisions.filter((row) => row.status === 'RESOLVED').length,
    ambiguousCount: decisions.filter((row) => row.status === 'AMBIGUOUS').length,
    unresolvedCount: decisions.filter((row) => row.status === 'UNRESOLVED').length,
    nearestRejectedCount: decisions.filter((row) => row.nearestRejectedTagId).length,
    candidateLedgerCount: candidateLedger.length,
    anchorLoopLedgerCount: anchorLoopLedger.length,
    anchorPolicy: navisParse?.anchor?.policy || 'NONE',
    configuredAnchorCount: navisParse?.anchor?.configuredCount || 0,
    validAnchorCount: navisParse?.anchor?.validCount || 0,
    anchorUsedAsBestBasisCount: anchorDiagnostics.summary.usedAsBestBasisCount,
    anchorEquivalentBestCandidateCount: anchorDiagnostics.summary.equivalentBestCandidateCount,
    maxAnchorTranslationSeparationMm: anchorDiagnostics.summary.maxPairwiseSeparationMm,
    scoringModel: NAVIS_CANDIDATE_SCORE_MODEL,
  };
}

export function resolveNavisTagIsonotes(tableBuild, identityTrace, navisParse, inputConfig = {}) {
  const resolvedConfig = effectiveConfig(tableBuild, identityTrace, navisParse, inputConfig);
  const config = resolvedConfig.config;
  const traceByRow = new Map((identityTrace?.rows || []).map((row) => [row.tableRowId, row]));
  const candidateLedger = [];
  const anchorLoopLedger = [];
  const decisions = [];
  const augmentedRows = [];
  const diagnostics = [...(tableBuild?.diagnostics || []), ...(identityTrace?.diagnostics || []), ...(navisParse?.diagnostics || [])];
  appendCoordinateSourceDiagnostic(diagnostics, navisParse, resolvedConfig.configuredSupportCoordinateSource, config.supportCoordinateSource);
  for (const record of tableBuild?.records || []) {
    const resolved = resolveRecord(record, traceByRow.get(record.rowId), navisParse, config, candidateLedger, anchorLoopLedger, diagnostics);
    decisions.push(resolved.decisionRow);
    augmentedRows.push(resolved.augmentedRow);
  }
  const anchorDiagnostics = buildAnchorConsistencyDiagnostics(navisParse?.anchor || {}, candidateLedger, anchorLoopLedger);
  appendAnchorConsistencyDiagnostic(diagnostics, anchorDiagnostics);
  const matchedRows = decisions.filter((row) => row.status === 'RESOLVED');
  const ambiguousRows = decisions.filter((row) => row.status === 'AMBIGUOUS');
  const rejectedRows = decisions.filter((row) => row.status === 'UNRESOLVED');
  const directAudit = {
    schema: NAVIS_TAG_ISONOTE_AUDIT_SCHEMA,
    config,
    anchor: navisParse?.anchor || null,
    anchorUsage: anchorUsage(candidateLedger),
    anchorDiagnostics,
    summary: auditSummary(tableBuild, identityTrace, navisParse, decisions, candidateLedger, anchorLoopLedger, anchorDiagnostics),
    augmentedRows,
    decisions,
    matchedRows,
    ambiguousRows,
    rejectedRows,
    candidateLedger,
    anchorLoopLedger,
    diagnostics,
  };
  return applyAppliesToPropagation(directAudit, inputConfig);
}

export const _test = Object.freeze({
  axisFailures,
  candidateFromTag,
  candidateScore,
  chooseSupportPosition,
  decision,
  decisionAcrossAnchorLoops,
  evaluateCandidates,
  evaluateCandidatesAcrossAnchors,
  verticalResidual,
});

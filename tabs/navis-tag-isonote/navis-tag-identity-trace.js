import { IDENTITY_NODE_TRACE_SCHEMA, normalizeConfig, text } from './navis-tag-isonote-contracts.js';

function branchMatches(record, entry) {
  const pipe = text(record.inputPipe).toUpperCase();
  const branch = text(entry.resolvedBranch || entry.resolvedPipe).toUpperCase();
  return Boolean(pipe && branch && branch.includes(pipe));
}
function referenceMatches(record, entry) {
  return Boolean(record.inputReference && entry.reference && record.inputReference === entry.reference);
}
function candidateScore(record, entry, matchType) {
  let score = matchType === 'EXACT_FULL_IDENTITY' ? 100 : 60;
  if (referenceMatches(record, entry)) score += 70;
  if (branchMatches(record, entry)) score += 20;
  if (entry.position) score += 10;
  if (Number.isFinite(entry.odMm)) score += 5;
  return score;
}
function candidateSummary(record, entry, matchType) {
  return {
    nodeId: entry.nodeId,
    sourceFile: entry.sourceFile,
    jsonPath: entry.jsonPath,
    ancestorIds: entry.ancestorIds,
    hierarchyPath: entry.hierarchyPath,
    rawType: entry.rawType,
    rawName: entry.rawName,
    identity: entry.identity,
    identityRaw: entry.identityRaw,
    identityPath: entry.identityPath,
    supportRoot: entry.supportRoot,
    reference: entry.reference,
    referenceRaw: entry.referenceRaw,
    referencePath: entry.referencePath,
    referenceMatch: referenceMatches(record, entry),
    resolvedBranch: entry.resolvedBranch,
    resolvedBranchPath: entry.resolvedBranchPath,
    resolvedPipe: entry.resolvedPipe,
    resolvedPipePath: entry.resolvedPipePath,
    resolvedPipeBasis: entry.resolvedPipeBasis,
    resolvedZone: entry.resolvedZone,
    resolvedZonePath: entry.resolvedZonePath,
    branchMatch: branchMatches(record, entry),
    positionPath: entry.positionPath,
    positionRaw: entry.positionRaw,
    position: entry.position,
    odMm: entry.odMm,
    odPath: entry.odPath,
    odSource: entry.odSource,
    odLookupName: entry.odLookupName,
    boreNominalMm: entry.boreNominalMm,
    borePath: entry.borePath,
    boreUnits: entry.boreUnits,
    score: candidateScore(record, entry, matchType),
  };
}
function rankCandidates(record, candidates, matchType) {
  return candidates.map((entry) => ({ entry, summary: candidateSummary(record, entry, matchType) })).sort((a, b) => b.summary.score - a.summary.score || Number(Boolean(b.entry.position)) - Number(Boolean(a.entry.position)) || a.entry.jsonPath.localeCompare(b.entry.jsonPath));
}
function resolvedStatus(matchType, summary) {
  if (matchType === 'EXACT_FULL_IDENTITY') {
    if (summary.referenceMatch) return 'RESOLVED_EXACT_REFERENCE';
    if (summary.branchMatch) return 'RESOLVED_EXACT_PIPE';
    return 'RESOLVED_EXACT';
  }
  if (summary.referenceMatch) return 'RESOLVED_ROOT_REFERENCE';
  if (summary.branchMatch) return 'RESOLVED_ROOT_PIPE';
  return 'RESOLVED_ROOT';
}
function selectCandidate(ranked, matchType, config) {
  if (!ranked.length) return { status: 'UNRESOLVED', selected: null, reason: 'NO_JSON_IDENTITY_CANDIDATE' };
  if (ranked.length === 1) return { status: resolvedStatus(matchType, ranked[0].summary), selected: ranked[0].entry, reason: matchType };
  const top = ranked[0];
  const second = ranked[1];
  const gap = top.summary.score - second.summary.score;
  if (gap >= config.ambiguityScoreGap) {
    const evidence = top.summary.referenceMatch ? 'UNIQUE_REFERENCE' : top.summary.branchMatch ? 'UNIQUE_BRANCH' : 'SCORE_GAP';
    return { status: resolvedStatus(matchType, top.summary), selected: top.entry, reason: `${matchType}_${evidence}`, scoreGap: gap };
  }
  return { status: matchType === 'EXACT_FULL_IDENTITY' ? 'AMBIGUOUS_EXACT_IDENTITY' : 'AMBIGUOUS_ROOT_MATCH', selected: null, reason: 'CANDIDATE_SCORE_GAP_INSUFFICIENT', scoreGap: gap };
}
function pendingNavisFields() {
  return {
    navisResolutionStatus: 'PENDING_NAVIS_RESOLUTION',
    navisAmbiguity: '', navisConfidence: '', navisConfidenceScore: 0, navisConfidenceReasons: [],
    selectedNavisEvidenceId: '', selectedNavisViewName: '', selectedNavisViewGuid: '', selectedNavisTagId: '', selectedNavisCommentId: '', selectedNavisCommentBody: '',
    selectedNavisPosition: null, selectedNavisPositionSource: '', deltaEMm: null, deltaNMm: null, deltaElMm: null, verticalBasis: '', verticalResidualMm: null, supportIsonote: '',
  };
}

export function buildIdentityNodeTrace(tableRecords = [], stagedIndex, inputConfig = {}) {
  const config = normalizeConfig({ ...(stagedIndex?.config || {}), ...inputConfig });
  const rows = [];
  const diagnostics = [];
  for (const record of tableRecords) {
    const exact = stagedIndex?.byIdentity?.get(record.identity) || [];
    const root = stagedIndex?.byRoot?.get(record.supportRoot) || [];
    let matchType = 'NONE';
    let candidates = [];
    if (exact.length) { matchType = 'EXACT_FULL_IDENTITY'; candidates = exact; }
    else if (root.length) { matchType = 'SUPPORT_ROOT'; candidates = root; }
    const ranked = rankCandidates(record, candidates, matchType);
    const selection = selectCandidate(ranked, matchType, config);
    const selected = selection.selected;
    if (!record.identity) diagnostics.push({ severity: 'ERROR', code: 'TABLE_IDENTITY_UNAVAILABLE', rowId: record.rowId, message: 'No canonical table identity is available.' });
    else if (!ranked.length) diagnostics.push({ severity: 'WARN', code: 'JSON_IDENTITY_NOT_FOUND', rowId: record.rowId, identity: record.identity, message: `No staged JSON node matches ${record.identity}.` });
    else if (!selected) diagnostics.push({ severity: 'WARN', code: selection.status, rowId: record.rowId, identity: record.identity, candidateCount: ranked.length, scoreGap: selection.scoreGap, message: `${ranked.length} staged JSON nodes match ${record.identity}; no dominant candidate was proven.` });
    rows.push({
      schema: IDENTITY_NODE_TRACE_SCHEMA,
      traceId: `IDENTITY-${record.rowId}`,
      tableRowId: record.rowId,
      tableRowIndex: record.rowIndex,
      tableIdentityRaw: record.identityRaw,
      canonicalIdentity: record.identity,
      supportRoot: record.supportRoot,
      tableIdentityColumn: record.identityColumn,
      inputReferenceRaw: record.inputReferenceRaw,
      inputReference: record.inputReference,
      inputReferenceColumn: record.inputReferenceColumn,
      tablePositionMode: config.tablePositionMode,
      tablePositionSourceColumn: record.positionColumn,
      tablePositionRaw: record.positionRaw,
      tablePosition: record.position,
      tablePositionUnits: config.tableUnits,
      inputPipe: record.inputPipe,
      inputPipeColumn: record.inputPipeColumn,
      identitySelectionEvidence: {
        candidatePool: matchType,
        tableIdentityRaw: record.identityRaw,
        canonicalIdentity: record.identity,
        supportRoot: record.supportRoot,
        tableReference: record.inputReference,
        tablePipe: record.inputPipe,
        candidateCount: ranked.length,
        selectionStatus: selection.status,
        selectionReason: selection.reason,
        scoreGap: selection.scoreGap ?? null,
        selectedNodeId: selected?.nodeId || '',
        selectedIdentity: selected?.identity || '',
        selectedReference: selected?.reference || '',
        selectedBranch: selected?.resolvedBranch || selected?.resolvedPipe || '',
        referenceMatch: selected ? referenceMatches(record, selected) : false,
        pipeBranchMatch: selected ? branchMatches(record, selected) : false,
        positionAvailable: Boolean(selected?.position),
        physicalOdAvailable: Number.isFinite(selected?.odMm),
      },
      traceOnlyEvidence: {
        sourceFile: selected?.sourceFile || '',
        nodeId: selected?.nodeId || '',
        jsonPath: selected?.jsonPath || '',
        ancestorIds: selected?.ancestorIds || [],
        hierarchyPath: selected?.hierarchyPath || [],
        rawType: selected?.rawType || '',
        rawName: selected?.rawName || '',
        identityPath: selected?.identityPath || '',
        referencePath: selected?.referencePath || '',
        branchPath: selected?.resolvedBranchPath || '',
        pipePath: selected?.resolvedPipePath || '',
        zonePath: selected?.resolvedZonePath || '',
      },
      navisProximityEvidence: {
        positionRaw: selected?.positionRaw ?? '',
        canonicalPosition: selected?.position || null,
        positionSourcePath: selected?.positionPath || '',
        positionSourceUnit: selected?.positionSourceUnit || selected?.position?.sourceUnit || '',
        positionUnitScale: selected?.positionUnitScale ?? selected?.position?.unitScale ?? null,
        positionRawPoint: selected?.positionRawPoint || selected?.position?.rawPoint || null,
        positionDatumOffsetMm: selected?.positionDatumOffsetMm || selected?.position?.datumOffsetMm || null,
        positionProfileName: selected?.positionProfileName || selected?.position?.profileName || config.jsonCoordinateProfileName,
        positionAxisBasis: selected?.positionAxisBasis || selected?.position?.axisBasis || '',
        boreNominalMm: selected?.boreNominalMm ?? null,
        borePath: selected?.borePath || '',
        physicalOdMm: selected?.odMm ?? null,
        odPath: selected?.odPath || '',
        odSource: selected?.odSource || 'NONE',
        navisStatus: 'PENDING_NAVIS_RESOLUTION',
      },
      matchType,
      candidateCount: ranked.length,
      status: selection.status,
      selectionReason: selection.reason,
      selectionScoreGap: selection.scoreGap ?? null,
      selectedNodeId: selected?.nodeId || '',
      selectedSourceFile: selected?.sourceFile || '',
      selectedJsonPath: selected?.jsonPath || '',
      selectedAncestorIds: selected?.ancestorIds || [],
      selectedRawType: selected?.rawType || '',
      selectedRawName: selected?.rawName || '',
      selectedIdentityRaw: text(selected?.identityRaw),
      selectedIdentityPath: selected?.identityPath || '',
      selectedReferenceRaw: selected?.referenceRaw || '',
      selectedReference: selected?.reference || '',
      selectedReferencePath: selected?.referencePath || '',
      hierarchyPath: selected?.hierarchyPath || [],
      resolvedBranch: selected?.resolvedBranch || '',
      resolvedBranchPath: selected?.resolvedBranchPath || '',
      resolvedPipe: selected?.resolvedPipe || '',
      resolvedPipePath: selected?.resolvedPipePath || '',
      resolvedPipeBasis: selected?.resolvedPipeBasis || '',
      resolvedZone: selected?.resolvedZone || '',
      resolvedZonePath: selected?.resolvedZonePath || '',
      positionSourcePath: selected?.positionPath || '',
      positionRaw: selected?.positionRaw ?? '',
      position: selected?.position || null,
      jsonPositionUnits: config.jsonUnits,
      odMm: selected?.odMm ?? null,
      odPath: selected?.odPath || '',
      odSource: selected?.odSource || 'NONE',
      odLookupName: selected?.odLookupName || '',
      boreNominalMm: selected?.boreNominalMm ?? null,
      borePath: selected?.borePath || '',
      boreUnits: selected?.boreUnits || config.jsonBoreUnits,
      identityConfidence: selected ? selection.status.includes('EXACT') || selection.status.includes('REFERENCE') ? 'HIGH' : 'MEDIUM' : ranked.length ? 'AMBIGUOUS' : 'UNRESOLVED',
      candidates: ranked.map((item) => item.summary),
      selectedEntry: selected || null,
      tableRecord: record,
      config,
      ...pendingNavisFields(),
    });
  }
  return partitionIdentityRows({ config, rows, diagnostics });
}
function partitionIdentityRows(trace) {
  const rows = trace.rows || [];
  return {
    ...trace,
    matchedRows: rows.filter((row) => row.selectedNodeId),
    ambiguousRows: rows.filter((row) => row.status.startsWith('AMBIGUOUS')),
    rejectedRows: rows.filter((row) => row.status === 'UNRESOLVED'),
    summary: {
      rowCount: rows.length,
      resolvedCount: rows.filter((row) => row.selectedNodeId).length,
      exactResolvedCount: rows.filter((row) => row.status.includes('EXACT') && row.selectedNodeId).length,
      rootResolvedCount: rows.filter((row) => row.status.includes('ROOT') && row.selectedNodeId).length,
      referenceResolvedCount: rows.filter((row) => row.status.includes('REFERENCE') && row.selectedNodeId).length,
      ambiguousCount: rows.filter((row) => row.status.startsWith('AMBIGUOUS')).length,
      unresolvedCount: rows.filter((row) => row.status === 'UNRESOLVED').length,
      navisResolvedCount: rows.filter((row) => row.navisResolutionStatus === 'RESOLVED').length,
      navisAmbiguousCount: rows.filter((row) => row.navisResolutionStatus === 'AMBIGUOUS').length,
      navisUnresolvedCount: rows.filter((row) => row.navisResolutionStatus === 'UNRESOLVED').length,
    },
  };
}
export function attachNavisResolutionToIdentityTrace(identityTrace, audit) {
  const decisions = new Map((audit?.decisions || []).map((row) => [row.tableRowId, row]));
  const rows = (identityTrace?.rows || []).map((row) => {
    const decision = decisions.get(row.tableRowId);
    if (!decision) return { ...row, ...pendingNavisFields(), navisResolutionStatus: 'UNRESOLVED' };
    const selected = decision.selectedCandidate || null;
    return {
      ...row,
      navisResolutionStatus: decision.status,
      navisAmbiguity: decision.ambiguity || '',
      navisConfidence: decision.confidence || '',
      navisConfidenceScore: decision.confidenceScore || 0,
      navisConfidenceReasons: decision.confidenceReasons || [],
      selectedNavisEvidenceId: decision.selectedEvidenceId || '',
      selectedNavisViewName: selected?.viewName || '',
      selectedNavisViewGuid: selected?.viewGuid || decision.selectedViewGuid || '',
      selectedNavisTagId: selected?.tagId || decision.selectedTagId || '',
      selectedNavisCommentId: selected?.commentId || decision.selectedCommentId || '',
      selectedNavisCommentBody: selected?.commentBody || '',
      selectedNavisPosition: selected?.tagPosition || null,
      selectedNavisPositionSource: selected?.positionSource || '',
      deltaEMm: selected?.deltaEMm ?? null,
      deltaNMm: selected?.deltaNMm ?? null,
      deltaElMm: selected?.deltaElMm ?? null,
      verticalBasis: selected?.verticalBasis || '',
      verticalResidualMm: selected?.verticalResidualMm ?? null,
      supportIsonote: decision.supportIsonote || '',
      navisProximityEvidence: {
        ...(row.navisProximityEvidence || {}),
        navisStatus: decision.status,
        selectedEvidenceId: decision.selectedEvidenceId || '',
        selectedViewName: selected?.viewName || '',
        selectedViewGuid: selected?.viewGuid || decision.selectedViewGuid || '',
        selectedTagId: selected?.tagId || decision.selectedTagId || '',
        selectedCommentId: selected?.commentId || decision.selectedCommentId || '',
        selectedCommentBody: selected?.commentBody || '',
        selectedNavisPosition: selected?.tagPosition || null,
        selectedNavisPositionSource: selected?.positionSource || '',
        deltaEMm: selected?.deltaEMm ?? null,
        deltaNMm: selected?.deltaNMm ?? null,
        deltaElMm: selected?.deltaElMm ?? null,
        verticalBasis: selected?.verticalBasis || '',
        verticalResidualMm: selected?.verticalResidualMm ?? null,
      },
    };
  });
  return partitionIdentityRows({ ...identityTrace, rows });
}

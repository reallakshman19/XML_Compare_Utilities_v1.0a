function text(value) { return String(value ?? '').trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function compact(value, digits = 3) {
  const parsed = number(value);
  return parsed == null ? '' : String(Number(parsed.toFixed(digits)));
}
function signed(value, digits = 3) {
  const parsed = number(value);
  if (parsed == null) return '';
  return `${parsed > 0 ? '+' : ''}${compact(parsed, digits)}`;
}
function identity(row = {}) {
  const value = text(row.canonicalIdentity || row.identity || row.targetIdentity || row.supportRoot);
  return value ? `/${value.replace(/^\/+/, '')}` : 'the support';
}
function tag(row = {}) { return text(row.tagId || row.sourceTagId || row.topCandidateTagId) || 'the Navis Tag'; }
function anchorPhrase(row = {}) {
  const basis = text(row.anchorBasisLabel || row.selectedAnchorBasis || row.nearestRejectedAnchorBasis);
  return basis ? ` using anchor basis ${basis}` : '';
}
function loopPhrase(row = {}) {
  const loopRank = number(row.anchorLoopRank);
  const crossRank = number(row.crossLoopRank);
  const parts = [];
  if (loopRank != null) parts.push(`anchor-loop rank ${loopRank}`);
  if (crossRank != null) parts.push(`cross-loop rank ${crossRank}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}
function list(values) { return (Array.isArray(values) ? values : []).filter(Boolean); }
function codeSuffix(codes) {
  const values = list(codes).map(text).filter(Boolean);
  return values.length ? ` [Audit codes: ${values.join('; ')}]` : '';
}
function axisName(axis) { return ({ E: 'easting', N: 'northing', EL: 'vertical' })[axis] || axis; }
function verticalDescription(row = {}) {
  const basis = text(row.verticalBasis);
  if (basis === 'OD_HALF_ABOVE') return 'OD-half-above vertical residual';
  if (basis === 'OD_HALF_BELOW') return 'OD-half-below vertical residual';
  return 'centreline vertical residual';
}
function toleranceText(axis, value, tolerance) {
  const delta = signed(value);
  const limit = compact(tolerance);
  return `${axisName(axis)} ${delta || value} mm${limit ? ` versus ±${limit} mm` : ''}`;
}
function rejectionPhrase(code) {
  return ({
    E_OUTSIDE_TOLERANCE: 'easting exceeded tolerance',
    N_OUTSIDE_TOLERANCE: 'northing exceeded tolerance',
    EL_OUTSIDE_TOLERANCE: 'vertical residual exceeded tolerance',
    TARGET_PIPE_NOT_PARALLEL: 'source and target pipe axes are not parallel',
    SOURCE_ROW_EXCLUDED: 'the source support row cannot receive its own propagated note',
    TARGET_PIPE_NOT_FOUND: 'the requested target pipe was not found',
    SOURCE_PIPE_AXIS_UNPROVEN: 'the source pipe axis could not be proven',
    APPLIES_TO_ALL_DISABLED: 'all-pipe propagation is disabled',
    ALL_SCOPE_LIMIT_EXCEEDED: 'the all-pipe target-row limit was exceeded',
    ALONG_AXIS_OUTSIDE_TOLERANCE: 'along-axis station exceeded tolerance',
    PARALLEL_OFFSET_OUTSIDE_TOLERANCE: 'parallel offset exceeded tolerance',
    ELEVATION_OUTSIDE_TOLERANCE: 'elevation difference exceeded tolerance',
  })[text(code)] || text(code).toLowerCase().replace(/_/g, ' ');
}

export function identitySelectionAuditRemark(row = {}) {
  const status = text(row.status);
  const reason = text(row.selectionReason);
  const count = Number(row.candidateCount) || 0;
  if (row.selectedNodeId) {
    const exact = reason.startsWith('EXACT_FULL_IDENTITY');
    const pipe = status.includes('PIPE');
    const reference = status.includes('REFERENCE');
    const evidence = [exact ? 'the complete support identity matched exactly' : 'the support root matched', reference ? 'the reference value also matched' : '', pipe ? 'the selected node belongs to the resolved source pipe' : ''].filter(Boolean).join(', and ');
    return `Selected JSON node ${text(row.selectedNodeId)} because ${evidence || 'it was the highest-ranked staged candidate'}. ${count} candidate${count === 1 ? '' : 's'} were evaluated.${codeSuffix([status, reason])}`;
  }
  if (status.startsWith('AMBIGUOUS')) {
    return `No JSON node was selected because ${count} staged candidates remained too close in rank to prove one authority.${codeSuffix([status, reason])}`;
  }
  return `No staged JSON node matched the configured support identity or support root.${codeSuffix([status || 'UNRESOLVED', reason || 'NO_JSON_IDENTITY_CANDIDATE'])}`;
}

export function candidateAuditRemark(row = {}, config = {}) {
  const rank = Number(row.candidateRank) || 0;
  const score = compact(row.score, 6);
  const top = text(row.topCandidateTagId);
  const runner = text(row.runnerUpTagId);
  const gap = compact(row.scoreGap, 6);
  const required = compact(row.requiredScoreGap, 6);
  const passed = row.withinTolerance === true;
  const status = text(row.decisionStatus);
  const reason = text(row.decisionReason);
  const selected = row.accepted === true;
  const anchor = anchorPhrase(row);
  const loop = loopPhrase(row);
  if (row.ledgerKind === 'NEAREST_REJECTED' || !passed) {
    const failed = list(row.failedAxes).map(axisName);
    const checks = [
      toleranceText('E', row.deltaEMm, config.eastingToleranceMm),
      toleranceText('N', row.deltaNMm, config.northingToleranceMm),
      `${verticalDescription(row)} ${compact(row.verticalResidualMm)} mm${number(config.elevationToleranceMm) != null ? ` versus ${compact(config.elevationToleranceMm)} mm` : ''}`,
    ].join('; ');
    return `Not matched. Tag ${tag(row)} is the closest recorded candidate for ${identity(row)}${anchor}${loop}, but ${failed.length ? `${failed.join(' and ')} exceeded the configured tolerance` : 'one or more coordinate checks failed'}. ${checks}.`;
  }
  if (selected) {
    return `Selected. Tag ${tag(row)} was the closest in-tolerance candidate in its anchor loop and then ranked first across the anchor-loop winners for ${identity(row)}${anchor}${loop}. Evidence score ${score}.`;
  }
  if (status === 'AMBIGUOUS' && reason === 'EQUIVALENT_CROSS_LOOP_WINNERS_CONFLICT') {
    const competingTag = rank === 1 ? runner : top;
    return `Review required. Tag ${tag(row)} is an anchor-loop winner for ${identity(row)}${anchor}${loop}. ${competingTag ? `Tag ${competingTag} is a geometrically equivalent winner from another anchor loop with a different comment.` : 'Another anchor loop produced geometrically equivalent evidence with a different comment.'} No Support ISONOTE was issued.`;
  }
  if (status === 'AMBIGUOUS') {
    const role = rank === 1 ? 'is the best coordinate candidate' : `ranks ${rank} behind Tag ${top || 'the leading candidate'}`;
    const competingTag = rank === 1 ? runner : top;
    return `Review required. Tag ${tag(row)} ${role} for ${identity(row)}${anchor}${loop} and passed all coordinate tolerances with score ${score}. No Support ISONOTE was issued because ${competingTag ? `Tag ${competingTag} carries a different comment and ` : 'another in-tolerance Tag carries a different comment and '}the score lead ${gap || '0'} is below the required ${required || 'configured'} gap.`;
  }
  return `Not selected. Tag ${tag(row)} won its own anchor loop for ${identity(row)}${anchor}${loop}, but another anchor-loop winner was geometrically closer.`;
}

export function decisionAuditRemark(row = {}, config = {}) {
  const status = text(row.status || row.decisionStatus);
  const reason = text(row.decisionReason);
  if (status === 'AMBIGUOUS' && reason === 'EQUIVALENT_CROSS_LOOP_WINNERS_CONFLICT') {
    const topBasis = text(row.topCandidateAnchorBasis);
    const runnerBasis = text(row.runnerUpCandidateAnchorBasis);
    return `No Support ISONOTE was issued. Tag ${text(row.topCandidateTagId) || 'the top winner'}${topBasis ? ` using ${topBasis}` : ''} and Tag ${text(row.runnerUpTagId) || 'another winner'}${runnerBasis ? ` using ${runnerBasis}` : ''} are geometrically equivalent winners from independent anchor loops but carry different comments.`;
  }
  if (status === 'AMBIGUOUS') {
    const topBasis = text(row.topCandidateAnchorBasis);
    const runnerBasis = text(row.runnerUpCandidateAnchorBasis);
    const topAnchor = topBasis ? ` using ${topBasis}` : '';
    const runnerAnchor = runnerBasis ? ` using ${runnerBasis}` : '';
    return `No Support ISONOTE was issued. Tag ${text(row.topCandidateTagId) || 'the top candidate'}${topAnchor} scored ${compact(row.topCandidateScore, 6)}, but Tag ${text(row.runnerUpTagId) || 'the runner-up'}${runnerAnchor} has a different comment and the score lead ${compact(row.scoreGap, 6) || '0'} is below the required ${compact(row.requiredScoreGap, 6) || 'configured'} gap.`;
  }
  if (status === 'RESOLVED' && text(row.decisionPolicy) === 'INDEPENDENT_ANCHOR_LOOPS_V1') {
    return `Resolved to Tag ${text(row.selectedTagId || row.topCandidateTagId) || 'the selected candidate'}${anchorPhrase(row)} because it was the closest winner produced by the independent anchor matching loops. Confidence ${text(row.confidence) || 'recorded'}; score ${compact(row.confidenceScore ?? row.topCandidateScore, 6)}.`;
  }
  if (status === 'RESOLVED') {
    return `Resolved to Tag ${text(row.selectedTagId || row.topCandidateTagId) || 'the selected candidate'}${anchorPhrase(row)} with confidence ${text(row.confidence) || 'recorded'} and score ${compact(row.confidenceScore ?? row.topCandidateScore, 6)}.`;
  }
  const nearest = row.nearestRejectedCandidate || row;
  return candidateAuditRemark({ ...nearest, ledgerKind: 'NEAREST_REJECTED', canonicalIdentity: row.canonicalIdentity || nearest.canonicalIdentity }, config);
}

export function propagationAuditRemark(row = {}) {
  const codes = row.rejectionReasons || [];
  if (row.applied) {
    return `Propagation accepted from Tag ${tag(row)} to ${identity(row)} because the target pipe matched by ${text(row.pipeMatchBasis) || 'the configured rule'}, the pipe axes were compatible, and all coordinate-window checks passed.${codeSuffix(['APPLIED', row.pipeMatchBasis])}`;
  }
  const reasons = list(codes).map(rejectionPhrase);
  return `Propagation not applied from Tag ${tag(row)} to ${identity(row)} because ${reasons.join('; ') || text(row.outcome) || 'the configured propagation checks failed'}.${codeSuffix([row.outcome || 'REJECTED', ...codes])}`;
}

export function candidateFinalBasis(row = {}, config = {}) {
  const gapOperator = Number(row.scoreGap) < Number(row.requiredScoreGap) ? '<' : '>=';
  const codes = [
    row.decisionStatus === 'AMBIGUOUS' ? 'IN_TOLERANCE_AMBIGUOUS' : 'IN_TOLERANCE_RUNNER_UP',
    row.decisionReason,
    `CANDIDATE_RANK=${row.candidateRank}`,
    `SCORE=${compact(row.score, 6)}`,
    row.anchorBasisId ? `ANCHOR_BASIS=${row.anchorBasisId}` : '',
    row.anchorLoopRank ? `ANCHOR_LOOP_RANK=${row.anchorLoopRank}` : '',
    row.crossLoopRank ? `CROSS_LOOP_RANK=${row.crossLoopRank}` : '',
    row.topCandidateTagId ? `TOP_TAG=${row.topCandidateTagId}` : '',
    row.runnerUpTagId ? `RUNNER_UP_TAG=${row.runnerUpTagId}` : '',
    row.scoreGap == null ? '' : `SCORE_GAP=${compact(row.scoreGap, 6)}${gapOperator}${compact(row.requiredScoreGap, 6)}`,
  ];
  return `${candidateAuditRemark(row, config)}${codeSuffix(codes)}`;
}

export function nearestRejectedFinalBasis(row = {}, config = {}) {
  return `${candidateAuditRemark({ ...row, ledgerKind: 'NEAREST_REJECTED' }, config)}${codeSuffix(['NEAREST_REJECTED', row.anchorBasisId ? `ANCHOR_BASIS=${row.anchorBasisId}` : '', row.anchorLoopRank ? `ANCHOR_LOOP_RANK=${row.anchorLoopRank}` : '', ...(row.rejectionReasons || [])])}`;
}

export function unmatchedFinalBasis() {
  return `No accepted, in-tolerance or nearest-rejected support relationship was recorded for this Tag. Locate it in the Navis model and review the source evidence.${codeSuffix(['NO_PS_MATCH', 'REFER_NAVIS_FILE_TO_LOCATE_TAG'])}`;
}

export function resolvedFinalBasis({ direct = false, decision = {}, propagationRows = [] } = {}) {
  const parts = [];
  const codes = [];
  if (direct) {
    const loopPolicy = text(decision.decisionPolicy) === 'INDEPENDENT_ANCHOR_LOOPS_V1';
    parts.push(loopPolicy
      ? `Direct match accepted from Tag ${text(decision.selectedTagId) || 'unknown'} for ${identity(decision)}${anchorPhrase(decision)} after it won its anchor loop and was the closest cross-loop winner.`
      : `Direct match accepted from Tag ${text(decision.selectedTagId) || 'unknown'} for ${identity(decision)}${anchorPhrase(decision)}.`);
    codes.push(
      'DIRECT_TAG_PROXIMITY',
      decision.selectedAnchorBasisId ? `ANCHOR_BASIS=${decision.selectedAnchorBasisId}` : '',
      loopPolicy ? 'INDEPENDENT_ANCHOR_LOOPS_V1' : '',
      decision.selectedAnchorLoopRank ? `ANCHOR_LOOP_RANK=${decision.selectedAnchorLoopRank}` : '',
      decision.selectedCrossLoopRank ? `CROSS_LOOP_RANK=${decision.selectedCrossLoopRank}` : '',
    );
  }
  if (propagationRows.length) {
    const sourceTags = [...new Set(propagationRows.map((row) => text(row.sourceTagId)).filter(Boolean))];
    parts.push(`ISONOTE propagation was accepted from Tag${sourceTags.length > 1 ? 's' : ''} ${sourceTags.join(', ') || 'unknown'} because the target pipe, axis and coordinate-window checks passed.`);
    for (const row of propagationRows) {
      codes.push(
        `APPLIES_TO_TAG_${text(row.sourceTagId) || 'UNKNOWN'}`,
        text(row.pipeMatchBasis),
        row.sourceAxis ? `SOURCE_AXIS=${row.sourceAxis}` : '',
        row.targetPipeAxis ? `TARGET_AXIS=${row.targetPipeAxis}` : '',
        Number.isFinite(Number(row.alongAxisDeltaMm)) ? `STATION=${compact(row.alongAxisDeltaMm)}mm` : '',
        Number.isFinite(Number(row.parallelOffsetMm)) ? `OFFSET=${compact(row.parallelOffsetMm)}mm` : '',
        Number.isFinite(Number(row.elevationDeltaMm)) ? `EL=${compact(row.elevationDeltaMm)}mm` : '',
      );
    }
  }
  return `${parts.join(' ')}${codeSuffix(codes)}`.trim();
}

export const _test = Object.freeze({ compact, signed, codeSuffix, identity, anchorPhrase, loopPhrase, verticalDescription, rejectionPhrase });

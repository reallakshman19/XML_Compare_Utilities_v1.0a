import {
  APPLIES_TO_ALL_MODE,
  APPLIES_TO_AMBIGUOUS_MODE,
  DEFAULT_APPLIES_TO_CONFIG,
  derivedNote,
  extractLineKey,
  normalizeAppliesToConfig,
  normalizePipeName,
  parseAppliesToDirective,
  unique,
} from './navis-tag-applies-to-directive.js';
import {
  buildPipeGroups,
  coordinateWindow,
  inferPipeAxis,
  resolveAllTargetGroups,
  resolveTargetGroups,
} from './navis-tag-applies-to-geometry.js';

export {
  DEFAULT_APPLIES_TO_CONFIG,
  extractLineKey,
  inferPipeAxis,
  normalizeAppliesToConfig,
  parseAppliesToDirective,
};

function addDiagnostic(diagnostics, severity, code, message, context = {}) {
  diagnostics.push({ severity, code, message, ...context });
}
function sourcePoint(decision) {
  return decision.selectedNavisPosition || decision.selectedCandidate?.tagPosition || decision.supportPosition;
}
function cloneDecision(decision) {
  return {
    ...decision,
    directSupportIsonote: decision.supportIsonote || '',
    propagatedIsonotes: [],
    propagatedFromTagIds: [],
    appliesToDirective: null,
    isonoteSource: decision.supportIsonote ? 'DIRECT' : 'NONE',
  };
}
function collectSourceDirectives(decisions, config, diagnostics) {
  const sources = [];
  for (const decision of decisions) {
    if (decision.status !== 'RESOLVED' || !decision.selectedCandidate?.commentBody) continue;
    const directive = parseAppliesToDirective(decision.selectedCandidate.commentBody, config);
    if (directive.regexError) addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_REGEX_INVALID_FALLBACK_USED', directive.regexError, { tableRowId: decision.tableRowId, tagId: decision.selectedTagId });
    if (!directive.matched) continue;
    decision.appliesToDirective = directive;
    decision.directSupportIsonote = directive.note;
    decision.supportIsonote = directive.note;
    decision.isonoteSource = 'DIRECT';
    sources.push({ sourceDecision: decision, directive });
  }
  return sources;
}
function directiveContext(sourceDecision, directive, sourceAxis) {
  return {
    directiveMode: directive.mode,
    rawDirectiveText: directive.rawDirectiveText,
    normalizedDirective: directive.normalizedDirective,
    sourceTableRowId: sourceDecision.tableRowId,
    sourceTagId: sourceDecision.selectedTagId,
    sourceCommentId: sourceDecision.selectedCommentId,
    sourcePipe: sourceDecision.resolvedPipe,
    sourceAxis: sourceAxis.axis,
    sourceAxisBasis: sourceAxis.basis,
  };
}
function rejectedScopeRow(context, outcome, reasons, extra = {}) {
  return { ...context, ...extra, applied: false, outcome, rejectionReasons: reasons };
}
function addAppliedEvidence(target, sourceDecision, directive, scope, targetAxis, window, note) {
  target.propagatedIsonotes.push({
    directiveMode: directive.mode,
    sourceTagId: sourceDecision.selectedTagId,
    sourceCommentId: sourceDecision.selectedCommentId,
    sourceTableRowId: sourceDecision.tableRowId,
    sourcePipe: sourceDecision.resolvedPipe,
    requestedTargetPipe: scope.requestedTargetPipe,
    matchedTargetPipe: scope.targetGroup.pipeName,
    pipeMatchBasis: scope.pipeMatchBasis,
    targetSelectionBasis: scope.targetSelectionBasis,
    sourceAxis: scope.sourceAxis.axis,
    targetPipeAxis: targetAxis.axis,
    note,
    baseIsonote: directive.note,
    deltaEMm: window.deltaE,
    deltaNMm: window.deltaN,
    deltaElMm: window.deltaEl,
    alongAxisDeltaMm: window.alongAxisDeltaMm,
    parallelOffsetMm: window.parallelOffsetMm,
  });
}
function evaluateTargetGroup(scope, sourceDecision, directive, config, decisionById, ledger) {
  const targetAxis = inferPipeAxis(scope.targetGroup.decisions, scope.sourcePoint, config);
  const axesParallel = ['N-S', 'E-W'].includes(scope.sourceAxis.axis) && targetAxis.axis === scope.sourceAxis.axis;
  let appliedCount = 0;
  for (const targetDecision of scope.targetGroup.decisions) {
    const window = coordinateWindow(scope.sourceAxis.axis === 'N-S' ? 'N-S' : 'E-W', scope.sourcePoint, targetDecision.supportPosition, config);
    const rejectionReasons = [...window.rejectionReasons];
    if (!axesParallel) rejectionReasons.unshift('TARGET_PIPE_NOT_PARALLEL');
    if (targetDecision.tableRowId === sourceDecision.tableRowId) rejectionReasons.push('SOURCE_ROW_EXCLUDED');
    const applied = rejectionReasons.length === 0;
    const note = derivedNote(directive.note, sourceDecision.selectedTagId, config.appliesToDerivedNoteTemplate);
    ledger.push({
      ...scope.context,
      requestedTargetPipe: scope.requestedTargetPipe,
      requestedLineKey: scope.requestedLineKey,
      matchedTargetPipe: scope.targetGroup.pipeName,
      pipeMatchBasis: scope.pipeMatchBasis,
      targetSelectionBasis: scope.targetSelectionBasis,
      sourcePipeExcluded: scope.sourcePipeExcluded,
      allScopeCandidatePipeCount: scope.allScopeCandidatePipeCount,
      allScopeCandidateRowCount: scope.allScopeCandidateRowCount,
      targetPipeAxis: targetAxis.axis,
      targetAxisBasis: targetAxis.basis,
      targetTableRowId: targetDecision.tableRowId,
      targetTableRowIndex: targetDecision.tableRowIndex,
      targetIdentity: targetDecision.canonicalIdentity,
      targetSupportRoot: targetDecision.supportRoot,
      sourcePosition: scope.sourcePoint,
      targetPosition: targetDecision.supportPosition,
      ...window,
      alongAxisToleranceMm: config.appliesToAlongAxisToleranceMm,
      parallelOffsetToleranceMm: config.appliesToParallelOffsetToleranceMm,
      elevationToleranceMm: config.appliesToElevationToleranceMm,
      baseIsonote: directive.note,
      derivedIsonote: note,
      applied,
      outcome: applied ? 'APPLIED' : 'REJECTED',
      rejectionReasons,
    });
    if (!applied) continue;
    appliedCount += 1;
    addAppliedEvidence(decisionById.get(targetDecision.tableRowId), sourceDecision, directive, scope, targetAxis, window, note);
  }
  return appliedCount;
}
function namedScopes(sourceDecision, directive, sourceAxis, sourcePointValue, groups, config, diagnostics, ledger) {
  const scopes = [];
  const context = directiveContext(sourceDecision, directive, sourceAxis);
  for (const requestedPipe of directive.targets) {
    const resolved = resolveTargetGroups(requestedPipe, groups, config);
    if (resolved.regexError) addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_LINE_KEY_REGEX_INVALID_FALLBACK_USED', resolved.regexError, { requestedPipe });
    if (!resolved.groups.length) {
      ledger.push(rejectedScopeRow(context, 'TARGET_PIPE_NOT_FOUND', ['TARGET_PIPE_NOT_FOUND'], { requestedTargetPipe: requestedPipe, requestedLineKey: resolved.requestedLineKey, pipeMatchBasis: resolved.basis }));
      addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_TARGET_PIPE_NOT_FOUND', `No staged pipe matched ${requestedPipe}; exact full-name matching and line-key fallback were both exhausted.`, { tableRowId: sourceDecision.tableRowId, tagId: sourceDecision.selectedTagId, requestedPipe, requestedLineKey: resolved.requestedLineKey });
      continue;
    }
    if (resolved.basis === 'LINE_KEY_FALLBACK' && resolved.groups.length > 1) addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_LINE_KEY_MATCHED_MULTIPLE_PIPES', `Line key ${resolved.requestedLineKey} matched ${resolved.groups.length} staged pipe names.`, { requestedPipe, matchedPipes: resolved.groups.map((group) => group.pipeName) });
    for (const targetGroup of resolved.groups) scopes.push({ context, sourceAxis, sourcePoint: sourcePointValue, requestedTargetPipe: requestedPipe, requestedLineKey: resolved.requestedLineKey, pipeMatchBasis: resolved.basis, targetSelectionBasis: 'NAMED_TARGET_PIPE', sourcePipeExcluded: false, allScopeCandidatePipeCount: 0, allScopeCandidateRowCount: 0, targetGroup });
  }
  return scopes;
}
function allScopes(sourceDecision, directive, sourceAxis, sourcePointValue, groups, config, diagnostics, ledger, metrics) {
  const context = directiveContext(sourceDecision, directive, sourceAxis);
  if (!config.appliesToAllEnabled) {
    ledger.push(rejectedScopeRow(context, 'APPLIES_TO_ALL_DISABLED', ['APPLIES_TO_ALL_DISABLED'], { requestedTargetPipe: '*' }));
    addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_ALL_DISABLED', `Tag ${sourceDecision.selectedTagId || '(unknown)'} used an all-scope directive while all-scope propagation is disabled.`, { tableRowId: sourceDecision.tableRowId });
    return [];
  }
  if (!['N-S', 'E-W'].includes(sourceAxis.axis)) {
    ledger.push(rejectedScopeRow(context, 'SOURCE_PIPE_AXIS_UNPROVEN', ['SOURCE_PIPE_AXIS_UNPROVEN'], { requestedTargetPipe: '*' }));
    addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_ALL_SOURCE_AXIS_UNPROVEN', `Tag ${sourceDecision.selectedTagId || '(unknown)'} could not prove the source-pipe axis; broad propagation was not attempted.`, { tableRowId: sourceDecision.tableRowId, sourcePipe: sourceDecision.resolvedPipe, sourceAxis });
    return [];
  }
  const resolved = resolveAllTargetGroups(sourceDecision, groups, config);
  metrics.candidatePipeCount += resolved.candidatePipeCount;
  metrics.candidateRowCount += resolved.candidateRowCount;
  if (resolved.limitExceeded) {
    ledger.push(rejectedScopeRow(context, 'ALL_SCOPE_LIMIT_EXCEEDED', ['ALL_SCOPE_LIMIT_EXCEEDED'], { requestedTargetPipe: '*', pipeMatchBasis: resolved.basis, allScopeCandidatePipeCount: resolved.candidatePipeCount, allScopeCandidateRowCount: resolved.candidateRowCount }));
    addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_ALL_TARGET_ROW_LIMIT_REACHED', `All-scope propagation found ${resolved.candidateRowCount} target rows, exceeding the configured limit of ${config.appliesToAllMaxTargetRows}.`, { tableRowId: sourceDecision.tableRowId, tagId: sourceDecision.selectedTagId });
    return [];
  }
  if (!resolved.groups.length) addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_ALL_NO_ELIGIBLE_PIPE_GROUPS', `No other resolved pipe group was available for Tag ${sourceDecision.selectedTagId || '(unknown)'}.`, { tableRowId: sourceDecision.tableRowId, sourcePipe: sourceDecision.resolvedPipe });
  return resolved.groups.map((targetGroup) => ({ context, sourceAxis, sourcePoint: sourcePointValue, requestedTargetPipe: '*', requestedLineKey: '', pipeMatchBasis: resolved.basis, targetSelectionBasis: 'ALL_RESOLVED_PIPES_EXCEPT_SOURCE', sourcePipeExcluded: resolved.sourcePipeExcluded, allScopeCandidatePipeCount: resolved.candidatePipeCount, allScopeCandidateRowCount: resolved.candidateRowCount, targetGroup }));
}
function propagateSource(source, groups, config, decisionById, diagnostics, ledger, metrics) {
  const { sourceDecision, directive } = source;
  if (directive.mode === APPLIES_TO_AMBIGUOUS_MODE) {
    addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_ALL_DIRECTIVE_AMBIGUOUS', `Directive "${directive.rawDirectiveText}" was not propagated: ${directive.ambiguity}.`, { tableRowId: sourceDecision.tableRowId, tagId: sourceDecision.selectedTagId });
    return;
  }
  const point = sourcePoint(sourceDecision);
  const sourceGroup = groups.find((group) => group.key === normalizePipeName(sourceDecision.resolvedPipe));
  const axis = inferPipeAxis(sourceGroup?.decisions || [], point, config);
  if (!['N-S', 'E-W'].includes(axis.axis) && directive.mode !== APPLIES_TO_ALL_MODE) addDiagnostic(diagnostics, 'WARN', 'APPLIES_TO_SOURCE_PIPE_AXIS_UNPROVEN', `Tag ${sourceDecision.selectedTagId || '(unknown)'} could not prove the axis of ${sourceDecision.resolvedPipe || '(unknown pipe)'}.`, { tableRowId: sourceDecision.tableRowId, sourceAxis: axis });
  const scopes = directive.mode === APPLIES_TO_ALL_MODE
    ? allScopes(sourceDecision, directive, axis, point, groups, config, diagnostics, ledger, metrics)
    : namedScopes(sourceDecision, directive, axis, point, groups, config, diagnostics, ledger);
  let applied = 0;
  for (const scope of scopes) applied += evaluateTargetGroup(scope, sourceDecision, directive, config, decisionById, ledger);
  if (applied || !scopes.length) return;
  const code = directive.mode === APPLIES_TO_ALL_MODE ? 'APPLIES_TO_ALL_NO_SUPPORT_IN_WINDOW' : 'APPLIES_TO_NO_PARALLEL_SUPPORT_IN_WINDOW';
  addDiagnostic(diagnostics, 'WARN', code, `No parallel support was inside the configured coordinate window for Tag ${sourceDecision.selectedTagId || '(unknown)'}.`, { tableRowId: sourceDecision.tableRowId, tagId: sourceDecision.selectedTagId, sourceAxis: axis.axis });
}
function finalizeDecisions(decisions) {
  for (const decision of decisions) {
    const propagated = [];
    const seen = new Set();
    for (const evidence of decision.propagatedIsonotes || []) {
      const key = `${evidence.sourceTagId}|${evidence.note}`;
      if (seen.has(key)) continue;
      seen.add(key);
      propagated.push(evidence);
    }
    decision.propagatedIsonotes = propagated;
    decision.propagatedFromTagIds = unique(propagated.map((item) => item.sourceTagId));
    decision.supportIsonote = unique([decision.directSupportIsonote, ...propagated.map((item) => item.note)]).join(' | ');
    decision.isonoteSource = decision.directSupportIsonote && propagated.length ? 'DIRECT_AND_PROPAGATED' : decision.directSupportIsonote ? 'DIRECT' : propagated.length ? 'PROPAGATED' : 'NONE';
  }
}

export function applyAppliesToPropagation(inputAudit, inputConfig = {}) {
  const audit = inputAudit || {};
  const config = normalizeAppliesToConfig({ ...(audit.config || {}), ...inputConfig });
  const decisions = (audit.decisions || []).map(cloneDecision);
  const decisionById = new Map(decisions.map((decision) => [decision.tableRowId, decision]));
  const groups = buildPipeGroups(decisions);
  const propagationLedger = [];
  const diagnostics = [];
  const metrics = { candidatePipeCount: 0, candidateRowCount: 0 };
  const sourceDirectives = config.appliesToEnabled ? collectSourceDirectives(decisions, config, diagnostics) : [];
  for (const source of sourceDirectives) propagateSource(source, groups, config, decisionById, diagnostics, propagationLedger, metrics);
  finalizeDecisions(decisions);
  const augmentedRows = (audit.augmentedRows || []).map((row, index) => {
    const decision = decisions[index];
    if (!decision) return { ...row };
    return { ...row, 'Support ISONOTE': decision.supportIsonote, 'ISONOTE Source': decision.isonoteSource, 'Direct Support ISONOTE': decision.directSupportIsonote, 'Propagated From Tag IDs': decision.propagatedFromTagIds.join('|'), 'Propagated ISONOTE Count': decision.propagatedIsonotes.length, 'Applies-To Mode': decision.appliesToDirective?.mode || '', 'Applies-To Target Pipes': decision.appliesToDirective?.appliesToAll ? 'ALL' : decision.appliesToDirective?.targets?.join('|') || '' };
  });
  const appliedRows = propagationLedger.filter((row) => row.applied);
  const allAppliedRows = appliedRows.filter((row) => row.directiveMode === APPLIES_TO_ALL_MODE);
  return {
    ...audit,
    config: { ...(audit.config || {}), ...config },
    decisions,
    augmentedRows,
    matchedRows: decisions.filter((row) => row.status === 'RESOLVED'),
    ambiguousRows: decisions.filter((row) => row.status === 'AMBIGUOUS'),
    rejectedRows: decisions.filter((row) => row.status === 'UNRESOLVED'),
    propagationLedger,
    diagnostics: [...(audit.diagnostics || []), ...diagnostics],
    summary: {
      ...(audit.summary || {}),
      appliesToDirectiveCount: sourceDirectives.length,
      appliesToTargetListDirectiveCount: sourceDirectives.filter((item) => item.directive.mode !== APPLIES_TO_ALL_MODE).length,
      appliesToAllDirectiveCount: sourceDirectives.filter((item) => item.directive.mode === APPLIES_TO_ALL_MODE).length,
      appliesToAllCandidatePipeCount: metrics.candidatePipeCount,
      appliesToAllCandidateRowCount: metrics.candidateRowCount,
      appliesToAllApplicationCount: allAppliedRows.length,
      propagationLedgerCount: propagationLedger.length,
      propagatedApplicationCount: appliedRows.length,
      propagatedTargetRowCount: new Set(appliedRows.map((row) => row.targetTableRowId)).size,
      exactTargetPipeMatchCount: new Set(appliedRows.filter((row) => row.pipeMatchBasis === 'FULL_PIPE_NAME_EXACT').map((row) => row.requestedTargetPipe)).size,
      lineKeyFallbackTargetPipeMatchCount: new Set(appliedRows.filter((row) => row.pipeMatchBasis === 'LINE_KEY_FALLBACK').map((row) => row.requestedTargetPipe)).size,
    },
  };
}

export const _test = Object.freeze({
  buildPipeGroups,
  coordinateWindow,
  derivedNote,
  normalizePipeName,
  resolveAllTargetGroups,
  resolveTargetGroups,
});

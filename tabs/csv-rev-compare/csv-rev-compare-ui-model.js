import { SUPPORT_REVISION_WORKFLOW_STAGES } from './support-revision-engine.js';

export const CSV_REV_COMPARE_UI_SCHEMA = 'csv-rev-compare-ui/v2-review-evidence';

export function buildWorkflowState({ rev1Loaded = false, rev2Loaded = false, result = null } = {}) {
  const states = SUPPORT_REVISION_WORKFLOW_STAGES.map((label, index) => ({
    number: index + 1,
    label,
    status: 'PENDING',
    detail: '',
  }));
  states[0] = state(states[0], rev1Loaded ? 'COMPLETE' : 'WAITING', rev1Loaded ? 'Earlier revision loaded.' : 'Load or paste Revision 1.');
  states[1] = state(states[1], rev2Loaded ? 'COMPLETE' : 'WAITING', rev2Loaded ? 'Later revision loaded.' : 'Load or paste Revision 2.');
  if (!result) return Object.freeze(states.map(Object.freeze));
  if (result.stage === 'CONVERSION_BLOCKED') return conversionBlockedStates(states, result);

  for (let index = 2; index <= 6; index += 1) states[index] = state(states[index], 'COMPLETE');
  const reviewCount = Number(result.unresolvedReviews?.count || 0);
  const reviewBlockers = (result.lineage?.reviewDiagnostics || []).filter((item) => item.severity === 'blocker').length;
  const reviewBlocked = reviewCount > 0 || reviewBlockers > 0;
  const reviewDetail = reviewCount ? `${reviewCount} lineage review item(s) unresolved.` : reviewBlockers ? `${reviewBlockers} review decision error(s) must be corrected.` : 'No unresolved lineage review.';
  states[7] = state(states[7], reviewBlocked ? 'ACTION_REQUIRED' : 'COMPLETE', reviewDetail);
  if (reviewBlocked) {
    for (let index = 8; index < states.length; index += 1) states[index] = state(states[index], 'BLOCKED', 'Resolve ambiguous lineage first.');
    return Object.freeze(states.map(Object.freeze));
  }
  for (let index = 8; index < states.length - 1; index += 1) states[index] = state(states[index], 'COMPLETE');
  states.at(-1).status = result.exportReady ? 'READY' : 'BLOCKED';
  states.at(-1).detail = result.exportReady ? 'CSV/XLSX and audit artifacts are ready.' : 'Export remains blocked.';
  return Object.freeze(states.map(Object.freeze));
}

function conversionBlockedStates(states, result) {
  const rev1Ok = Boolean(result.pair?.rev1?.ok);
  const rev2Ok = Boolean(result.pair?.rev2?.ok);
  states[2] = state(states[2], 'BLOCKED', 'Schema validation failed.');
  states[3] = state(states[3], rev1Ok ? 'COMPLETE' : 'BLOCKED');
  states[4] = state(states[4], rev2Ok ? 'COMPLETE' : 'BLOCKED');
  states[5] = state(states[5], 'ACTION_REQUIRED', 'Inspect conversion diagnostics.');
  for (let index = 6; index < states.length; index += 1) states[index] = state(states[index], 'BLOCKED', 'Conversion must succeed first.');
  return Object.freeze(states.map(Object.freeze));
}

function state(item, status, detail = '') {
  return { ...item, status, detail };
}

export function unresolvedReviewRows(result) {
  if (!result?.lineage) return Object.freeze([]);
  const structuralEdges = (result.lineage.edges || []).filter((edge) => edge.outcome === 'AMBIGUOUS');
  const structuralCandidateIds = new Set(structuralEdges.flatMap((edge) => edge.candidateIds || []));
  const candidates = (result.lineage.candidates || [])
    .filter((item) => item.outcome === 'AMBIGUOUS' && !structuralCandidateIds.has(item.candidateId))
    .map((item) => Object.freeze({
      kind: 'candidate',
      id: item.candidateId,
      sourceNodeId: item.sourceNodeId,
      targetNodeId: item.targetNodeId,
      score: item.score,
      matchingMethod: item.matchingMethod,
      reasonCodes: Object.freeze([...(item.reasonCodes || [])]),
      source: reviewLocation(result.sourceModel?.locationByNodeId?.get(item.sourceNodeId)),
      target: reviewLocation(result.targetModel?.locationByNodeId?.get(item.targetNodeId)),
      activeSignals: Object.freeze((item.weightBreakdown || []).filter((signal) => signal.active).map((signal) => Object.freeze({ signal: signal.signal, contribution: signal.contribution, reasonCode: signal.reasonCode }))),
    }));
  const structural = structuralEdges.map((edge) => Object.freeze({
    kind: 'structural',
    id: edge.edgeId,
    cardinality: edge.cardinality,
    sourceNodeIds: Object.freeze([...(edge.sourceNodeIds || [])]),
    targetNodeIds: Object.freeze([...(edge.targetNodeIds || [])]),
    matchingMethod: edge.matchingMethod,
    reasonCodes: Object.freeze([...(edge.reasonCodes || [])]),
    sources: Object.freeze((edge.sourceNodeIds || []).map((id) => reviewLocation(result.sourceModel?.locationByNodeId?.get(id)))),
    targets: Object.freeze((edge.targetNodeIds || []).map((id) => reviewLocation(result.targetModel?.locationByNodeId?.get(id)))),
  }));
  return Object.freeze([...candidates, ...structural]);
}

function reviewLocation(location) {
  if (!location) return Object.freeze({ nodeId: '', family: '', pipe: '', size: '', references: Object.freeze([]), position: Object.freeze({}) });
  return Object.freeze({
    nodeId: location.nodeId,
    family: location.family,
    prevName: location.legacyIdentity,
    pipe: location.pipe?.raw || '',
    size: location.size || location.pipe?.nps || '',
    references: Object.freeze([...(location.persistentReferences || [])]),
    position: Object.freeze(Object.fromEntries(['x','y','z'].map((axis) => [axis, location.position?.[axis]?.raw || '']))),
  });
}

export function artifactDescriptor(result, kind) {
  const artifacts = result?.artifacts || {};
  const definitions = {
    csv: ['support-revision-compare.csv', artifacts.outputCsv, 'text/csv'],
    audit: ['support-revision-comparison-audit.json', artifacts.comparisonAuditJson, 'application/json'],
    rev1xml: ['support-revision-rev1.xml', artifacts.rev1Xml, 'application/xml'],
    rev2xml: ['support-revision-rev2.xml', artifacts.rev2Xml, 'application/xml'],
    rev1graph: ['support-revision-rev1-graph.json', artifacts.rev1GraphJson, 'application/json'],
    rev2graph: ['support-revision-rev2-graph.json', artifacts.rev2GraphJson, 'application/json'],
    profile: ['support-revision-csv-xml-v1.json', artifacts.profileJson, 'application/json'],
  };
  const row = definitions[kind];
  return row && row[1] != null ? Object.freeze({ name: row[0], content: row[1], type: row[2] }) : null;
}

export function comparisonSummary(result) {
  if (!result) return Object.freeze({ stage: 'WAITING', message: 'Load both revisions to begin.' });
  if (result.stage === 'CONVERSION_BLOCKED') return Object.freeze({ stage: result.stage, message: 'Conversion blocked. Inspect table schema and conversion diagnostics.' });
  if (!result.exportReady) {
    const count = Number(result.unresolvedReviews?.count || 0);
    const blockers = (result.lineage?.reviewDiagnostics || []).filter((item) => item.severity === 'blocker').length;
    const message = count ? `${count} lineage review item(s) require an explicit decision.` : `${blockers} review decision error(s) block export.`;
    return Object.freeze({ stage: result.stage, message });
  }
  return Object.freeze({ stage: result.stage, message: `${result.ledger?.events?.length || 0} structured event(s); revision output is ready.` });
}

export const _test = Object.freeze({ conversionBlockedStates, state, reviewLocation });

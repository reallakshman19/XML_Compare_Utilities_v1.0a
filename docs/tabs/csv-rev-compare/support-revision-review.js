import {
  coordinateDelta,
  solveRevisionCoordinateFrame,
  SUPPORT_REV_COMPARE_POLICY_V1,
} from './support-revision-normalization.js';
import { buildTrustedCoordinateAnchors } from './support-revision-candidate-scoring.js';

export const SUPPORT_REVISION_REVIEW_SCHEMA = 'support-revision-lineage-review/v2-frame-consistent';
const clean = (value) => String(value ?? '').trim();

/** Apply explicit candidate and structural decisions without auto-selecting ambiguity. */
export function resolveReviewedLineage(lineage, sourceModel, targetModel, decisions = [], options = {}) {
  const normalized = normalizeReviewDecisions(decisions);
  if (!normalized.length) return Object.freeze({ ...lineage, reviewDecisions: Object.freeze([]), reviewDiagnostics: Object.freeze([]) });
  const policy = options.policy || SUPPORT_REV_COMPARE_POLICY_V1;
  const diagnostics = validateReviewDecisions(lineage, normalized);
  const usable = normalized.filter((decision) => !diagnostics.some((item) => item.decisionId === decision.decisionId && item.severity === 'blocker'));
  const structural = reviewStructuralEdges(lineage.edges, lineage.candidates, usable);
  const candidates = reviewCandidates(structural.candidates, usable);
  const edges = addApprovedEdges(structural.edges, candidates, usable);
  const coordinateFrame = reviewedCoordinateFrame(lineage, sourceModel, targetModel, edges, policy);
  const enrichedEdges = Object.freeze(edges.map((edge) => enrichCoordinates(edge, sourceModel, targetModel, coordinateFrame, policy)));
  const matchedSource = new Set(enrichedEdges.flatMap((edge) => edge.sourceNodeIds));
  const matchedTarget = new Set(enrichedEdges.flatMap((edge) => edge.targetNodeIds));
  return Object.freeze({
    ...lineage,
    candidates,
    edges: enrichedEdges,
    removed: Object.freeze(sourceModel.locations.filter((item) => !matchedSource.has(item.nodeId)).map((item) => item.nodeId)),
    added: Object.freeze(targetModel.locations.filter((item) => !matchedTarget.has(item.nodeId)).map((item) => item.nodeId)),
    ambiguous: Object.freeze(candidates.filter((item) => item.outcome === 'AMBIGUOUS')),
    coordinateFrame,
    reviewDecisions: Object.freeze(normalized),
    reviewDiagnostics: Object.freeze(diagnostics),
  });
}

export function unresolvedLineageReviews(lineage) {
  const structural = (lineage?.edges || []).filter((edge) => edge.outcome === 'AMBIGUOUS');
  const coveredCandidateIds = new Set(structural.flatMap((edge) => edge.candidateIds || []));
  const candidateSources = new Set((lineage?.candidates || [])
    .filter((item) => item.outcome === 'AMBIGUOUS' && !coveredCandidateIds.has(item.candidateId))
    .map((item) => item.sourceNodeId));
  const structuralEdgeIds = structural.map((edge) => edge.edgeId);
  return Object.freeze({
    candidateSourceNodeIds: Object.freeze([...candidateSources]),
    structuralEdgeIds: Object.freeze(structuralEdgeIds),
    count: candidateSources.size + structuralEdgeIds.length,
  });
}

function normalizeReviewDecisions(decisions) {
  return Object.freeze((decisions || []).map((decision, index) => Object.freeze({
    decisionId: clean(decision?.decisionId) || `review:${String(index + 1).padStart(4, '0')}`,
    kind: clean(decision?.kind || (decision?.edgeId ? 'structural' : 'candidate')).toLowerCase(),
    edgeId: clean(decision?.edgeId),
    sourceNodeId: clean(decision?.sourceNodeId),
    targetNodeId: clean(decision?.targetNodeId),
    action: clean(decision?.action).toLowerCase(),
    reason: clean(decision?.reason),
  })));
}

function validateReviewDecisions(lineage, decisions) {
  const ambiguousPairs = new Set((lineage?.candidates || []).filter((item) => item.outcome === 'AMBIGUOUS').map((item) => decisionKey(item.sourceNodeId, item.targetNodeId)));
  const ambiguousEdges = new Set((lineage?.edges || []).filter((edge) => edge.outcome === 'AMBIGUOUS').map((edge) => edge.edgeId));
  const approvedSources = new Set();
  const approvedTargets = new Set();
  const structuralEdges = new Set();
  const diagnostics = [];
  for (const decision of decisions) {
    if (decision.kind === 'structural') validateStructuralDecision(decision, ambiguousEdges, structuralEdges, diagnostics);
    else validateCandidateDecision(decision, ambiguousPairs, approvedSources, approvedTargets, diagnostics);
  }
  return diagnostics;
}

function validateCandidateDecision(decision, ambiguousPairs, approvedSources, approvedTargets, diagnostics) {
  if (!['approve', 'reject'].includes(decision.action)) diagnostics.push(blocker(decision, 'review_action_invalid'));
  else if (!ambiguousPairs.has(decisionKey(decision.sourceNodeId, decision.targetNodeId))) diagnostics.push(blocker(decision, 'review_candidate_not_ambiguous'));
  else if (decision.action === 'approve' && approvedSources.has(decision.sourceNodeId)) diagnostics.push(blocker(decision, 'multiple_targets_approved_for_source'));
  else if (decision.action === 'approve' && approvedTargets.has(decision.targetNodeId)) diagnostics.push(blocker(decision, 'multiple_sources_approved_for_target'));
  else if (decision.action === 'approve') {
    approvedSources.add(decision.sourceNodeId);
    approvedTargets.add(decision.targetNodeId);
  }
}

function validateStructuralDecision(decision, ambiguousEdges, seenEdges, diagnostics) {
  if (!['accept', 'reject'].includes(decision.action)) diagnostics.push(blocker(decision, 'structural_review_action_invalid'));
  else if (!ambiguousEdges.has(decision.edgeId)) diagnostics.push(blocker(decision, 'structural_edge_not_ambiguous'));
  else if (seenEdges.has(decision.edgeId)) diagnostics.push(blocker(decision, 'multiple_structural_decisions_for_edge'));
  else seenEdges.add(decision.edgeId);
}

function reviewStructuralEdges(edges, candidates, decisions) {
  const byEdge = new Map(decisions.filter((item) => item.kind === 'structural').map((item) => [item.edgeId, item]));
  const acceptedCandidateIds = new Set();
  const rejectedCandidateIds = new Set();
  const reviewedEdges = edges.flatMap((edge) => {
    const decision = byEdge.get(edge.edgeId);
    if (!decision || edge.outcome !== 'AMBIGUOUS') return [edge];
    const bucket = decision.action === 'accept' ? acceptedCandidateIds : rejectedCandidateIds;
    (edge.candidateIds || []).forEach((id) => bucket.add(id));
    if (decision.action === 'reject') return [];
    return [Object.freeze({
      ...edge,
      outcome: 'LIKELY',
      matchingMethod: 'manual-review:common-support-graph',
      reviewDecision: 'ACCEPTED',
      reasonCodes: Object.freeze(['AMBIGUOUS_STRUCTURAL_LINEAGE_REVIEW_ACCEPTED', ...(edge.reasonCodes || [])]),
    })];
  });
  const reviewedCandidates = candidates.map((candidate) => {
    if (rejectedCandidateIds.has(candidate.candidateId)) return Object.freeze({ ...candidate, outcome: 'NO_MATCH', reviewRequired: false, reviewDecision: 'STRUCTURAL_REJECTED' });
    if (acceptedCandidateIds.has(candidate.candidateId)) return Object.freeze({ ...candidate, outcome: candidate.outcome === 'AMBIGUOUS' ? 'LIKELY' : candidate.outcome, reviewRequired: false, reviewDecision: 'STRUCTURAL_ACCEPTED' });
    return candidate;
  });
  return Object.freeze({ edges: Object.freeze(reviewedEdges), candidates: Object.freeze(reviewedCandidates) });
}

function reviewCandidates(candidates, decisions) {
  const candidateDecisions = decisions.filter((item) => item.kind !== 'structural');
  const byPair = new Map(candidateDecisions.map((item) => [decisionKey(item.sourceNodeId, item.targetNodeId), item]));
  const approvedBySource = new Map(candidateDecisions.filter((item) => item.action === 'approve').map((item) => [item.sourceNodeId, item.targetNodeId]));
  return Object.freeze(candidates.map((candidate) => {
    if (candidate.outcome !== 'AMBIGUOUS') return candidate;
    const direct = byPair.get(decisionKey(candidate.sourceNodeId, candidate.targetNodeId));
    const approvedTarget = approvedBySource.get(candidate.sourceNodeId);
    if (direct?.action === 'approve') return Object.freeze({ ...candidate, outcome: 'DETERMINISTIC', reviewRequired: false, reviewDecision: 'APPROVED' });
    if (direct?.action === 'reject' || (approvedTarget && approvedTarget !== candidate.targetNodeId)) return Object.freeze({ ...candidate, outcome: 'NO_MATCH', reviewRequired: false, reviewDecision: 'REJECTED' });
    return candidate;
  }));
}

function addApprovedEdges(existingEdges, candidates, decisions) {
  const edges = [...existingEdges];
  const usedSource = new Set(edges.flatMap((edge) => edge.sourceNodeIds));
  const usedTarget = new Set(edges.flatMap((edge) => edge.targetNodeIds));
  let index = 0;
  for (const decision of decisions.filter((item) => item.kind !== 'structural' && item.action === 'approve')) {
    if (usedSource.has(decision.sourceNodeId) || usedTarget.has(decision.targetNodeId)) continue;
    const candidate = candidates.find((item) => item.sourceNodeId === decision.sourceNodeId && item.targetNodeId === decision.targetNodeId && item.reviewDecision === 'APPROVED');
    if (!candidate) continue;
    usedSource.add(decision.sourceNodeId);
    usedTarget.add(decision.targetNodeId);
    edges.push(Object.freeze({
      edgeId: `lineage:review:${String(++index).padStart(4, '0')}`,
      cardinality: '1->1',
      sourceNodeIds: Object.freeze([decision.sourceNodeId]),
      targetNodeIds: Object.freeze([decision.targetNodeId]),
      outcome: 'DETERMINISTIC',
      matchingMethod: 'manual-review',
      reasonCodes: Object.freeze(['AMBIGUOUS_LINEAGE_REVIEW_APPROVED', ...candidate.reasonCodes]),
      persistentReferences: candidate.persistentReferences,
      candidateIds: Object.freeze([candidate.candidateId]),
      reviewDecision: 'APPROVED',
    }));
  }
  return edges;
}

function reviewedCoordinateFrame(lineage, sourceModel, targetModel, edges, policy) {
  const anchors = mergeCoordinateAnchors(buildTrustedCoordinateAnchors(sourceModel, targetModel), anchorPairs(edges, sourceModel, targetModel));
  const solved = solveRevisionCoordinateFrame(anchors, policy);
  const minimumAnchors = Number(lineage?.coordinateFrame?.scoreMinimumAnchors || 3);
  return Object.freeze({
    ...solved,
    anchorBasis: coordinateAnchorBasis(anchors),
    scoreMinimumAnchors: minimumAnchors,
    scoreFrameUsable: solved.status === 'SOLVED' && solved.anchorCount >= minimumAnchors,
  });
}

function anchorPairs(edges, sourceModel, targetModel) {
  return edges.flatMap((edge) => edge.cardinality === '1->1' && edge.outcome === 'DETERMINISTIC' && edge.persistentReferences?.length
    ? [{ source: sourceModel.locationByNodeId.get(edge.sourceNodeIds[0]), target: targetModel.locationByNodeId.get(edge.targetNodeIds[0]), basis: 'REVIEWED_PERSISTENT_REFERENCE_LINEAGE' }]
    : []);
}

function mergeCoordinateAnchors(...groups) {
  const byPair = new Map();
  for (const anchor of groups.flat()) {
    if (!anchor?.source?.nodeId || !anchor?.target?.nodeId) continue;
    const key = `${anchor.source.nodeId}=>${anchor.target.nodeId}`;
    if (!byPair.has(key)) byPair.set(key, anchor);
    else if (!String(byPair.get(key).basis || '').includes(anchor.basis || '')) byPair.set(key, Object.freeze({ ...byPair.get(key), basis: `${byPair.get(key).basis}+${anchor.basis}` }));
  }
  return Object.freeze([...byPair.values()]);
}
function coordinateAnchorBasis(anchors) {
  const basis = [...new Set((anchors || []).flatMap((anchor) => String(anchor.basis || '').split('+')).filter(Boolean))];
  return basis.length ? basis.join('+') : 'NONE';
}

function enrichCoordinates(edge, sourceModel, targetModel, frame, policy) {
  const evidence = [];
  for (const sourceNodeId of edge.sourceNodeIds || []) for (const targetNodeId of edge.targetNodeIds || []) {
    const source = sourceModel.locationByNodeId.get(sourceNodeId);
    const target = targetModel.locationByNodeId.get(targetNodeId);
    if (source && target) evidence.push(Object.freeze({ sourceNodeId, targetNodeId, ...coordinateDelta(source.position, target.position, frame, policy) }));
  }
  return Object.freeze({ ...edge, coordinateEvidence: Object.freeze(evidence) });
}

function blocker(decision, code) {
  return Object.freeze({ severity: 'blocker', code, decisionId: decision.decisionId, kind: decision.kind, edgeId: decision.edgeId, sourceNodeId: decision.sourceNodeId, targetNodeId: decision.targetNodeId });
}
function decisionKey(sourceNodeId, targetNodeId) { return `${clean(sourceNodeId)}=>${clean(targetNodeId)}`; }

export const _test = Object.freeze({ decisionKey, normalizeReviewDecisions, validateReviewDecisions, reviewStructuralEdges, reviewCandidates, mergeCoordinateAnchors, coordinateAnchorBasis });

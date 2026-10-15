// Test-only evidence projection. Automatic baseLoops are invocation descriptors,
// not geometry qualification records. Join them back to source suggestions by
// the exact selected suggestion pair and selected base ID; never invent a score.
function id(value) { return String(value ?? ''); }
function samePair(left, right) {
  return id(left?.sourceNodeId) === id(right?.sourceNodeId)
    && id(left?.targetNodeId) === id(right?.targetNodeId);
}

export function ciiForensicSelectedBaseEvidence(suggestions = [], choice = {}) {
  const selected = (suggestions || []).filter((row) =>
    samePair(row, { sourceNodeId: choice.sourceNodeId, targetNodeId: choice.targetNodeId }));
  const source = selected.length === 1 ? selected[0] : null;
  return Object.freeze((choice.baseLoops || []).map((loop) => {
    const descriptor = Object.freeze({
      method: id(loop.method), baseId: id(loop.baseId),
      sourceNodeId: id(choice.sourceNodeId), targetNodeId: id(choice.targetNodeId),
      anchorCount: loop.anchorPairs?.length || 0,
    });
    if (loop.method !== 'METHOD_A_SPATIAL') {
      return Object.freeze({ ...descriptor, evidenceStatus: 'NON_METHOD_A_BASE',
        confidence: source?.confidence || null, score: null });
    }
    const evidence = source?.methodA;
    const bases = evidence?.bases || (evidence?.bestBase ? [evidence.bestBase] : []);
    const matches = bases.filter((base) => id(base?.baseId) === id(loop.baseId));
    const base = matches.length === 1 ? matches[0] : null;
    if (!base?.weight || !Number.isFinite(Number(base.weight.total))) {
      return Object.freeze({ ...descriptor, evidenceStatus: 'MISSING_SELECTED_QUALIFICATION',
        candidateMatchCount: matches.length, score: null });
    }
    const weight = base.weight;
    return Object.freeze({
      ...descriptor, evidenceStatus: 'READY', confidence: base.confidence || null,
      score: Number(weight.total), anchorCount: base.anchorPairs?.length || 0,
      components: Object.freeze({
        residualQuality: weight.residualQuality, conditioning: weight.conditioning,
        spatialExtent: weight.spatialExtent, redundancy: weight.redundancy,
        basisConsensus: weight.basisConsensus,
      }),
      thresholds: weight.confidenceThresholds || null,
      weights: weight.confidenceWeights || null,
      maxResidualMm: base.maxResidualMm ?? null,
      maxNormalizedResidual: base.maxNormalizedResidual ?? null,
      rmsNormalizedResidual: base.rmsNormalizedResidual ?? null,
      selectedBasisId: base.selectedBasisId ?? null,
      minimumAnchorSinAngle: base.minimumAnchorSinAngle ?? null,
      automaticConfidenceCap: base.automaticConfidenceCap ?? null,
      qualifiedAnchorCount: base.anchorCount ?? null,
    });
  }));
}

export function ciiForensicRowObservations(preview, requested = []) {
  return Object.freeze(requested.map(([sourceId, sourceNodeId, targetNodeId, intendedGrade]) => {
    const member = (preview?.memberPreviews || []).find((item) => item.sourceId === sourceId)?.preview;
    const selected = (member?.correspondence?.nodeRows || []).filter((row) =>
      id(row.sourceNodeId) === id(sourceNodeId) && id(row.targetNodeId) === id(targetNodeId));
    const aggregate = (preview?.correspondence?.nodeRows || []).filter((row) =>
      id(row.sourceId) === id(sourceId)
      && id(row.sourceNodeId) === id(sourceNodeId) && id(row.targetNodeId) === id(targetNodeId));
    const matching = selected.length ? selected : aggregate;
    const review = (member?.compareReview?.rows || []).filter((row) =>
      row?.kind === 'NODE' && id(row.source) === id(sourceNodeId) && id(row.target) === id(targetNodeId));
    return Object.freeze({
      sourceId, sourceNodeId, targetNodeId, ownerIntendedGrade: intendedGrade,
      status: matching.length ? 'EMITTED' : 'NOT_EMITTED',
      emittedRowCount: matching.length, reviewRowCount: review.length,
      review: Object.freeze(review.map((row) => Object.freeze({
        correspondenceId: row.correspondenceId,
        identityBound: row.identityBound,
        confidence: row.confidence,
        authority: row.authority,
        workflowStatus: row.workflowStatus,
        decision: row.decision,
      }))),
      observed: Object.freeze(matching.map((row) => Object.freeze({
        correspondenceId: row.correspondenceId,
        status: row.status, authority: row.authority, basisMethod: row.basisMethod,
        identitySupported: row.evidence?.identitySupported ?? null,
        confidence: row.evidence?.identityConfidence || row.confidence || 'REVIEW',
        evidenceBasis: row.evidence?.identityEvidenceBasis || null,
        methodAQualification: row.evidence?.methodAQualification || null,
        multiBaseProvenance: row.evidence?.multiBaseProvenance || [],
        nodeCustodyGate: row.evidence?.nodeCustodyGate || null,
      }))),
    });
  }));
}

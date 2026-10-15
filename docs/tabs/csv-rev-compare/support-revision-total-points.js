const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();

export const SUPPORT_REV_TOTAL_POINTS_EVENT = 'TOTAL_SUPPORT_POINTS_CHANGED';
export const SUPPORT_REV_TOTAL_POINTS_FIELD = 'TOTAL SUPPORT POINTS ON SECONDARY';

export function augmentTotalSupportPointEvents(ledger, sourceModel, targetModel, lineage) {
  const additions = [];
  const graphChangedPairs = localGraphChangedPairs(ledger);
  let nextIndex = ledger?.events?.length || 0;
  for (const edge of lineage?.edges || []) {
    if (edge.outcome === 'AMBIGUOUS') continue;
    for (const [source, target] of continuingPairs(edge, sourceModel, targetModel)) {
      const before = normalizeSupportPointCount(source?.sourceFields?.totalSupportPoints);
      const after = normalizeSupportPointCount(target?.sourceFields?.totalSupportPoints);
      if (sameSupportPointCount(before, after)) continue;
      // TOTAL SUPPORT POINTS ON SECONDARY can be repeated family-level metadata. A raw
      // field delta is attributable to a Civil+PIPE item only when the already-built XML
      // event ledger proves a local component-graph change on this exact lineage pair.
      if (!graphChangedPairs.has(pairKey(source.nodeId, target.nodeId))) continue;
      additions.push(Object.freeze({
        eventId: `support-event:${String(++nextIndex).padStart(5, '0')}`,
        type: SUPPORT_REV_TOTAL_POINTS_EVENT,
        sourceXmlNode: source.nodeId,
        targetXmlNode: target.nodeId,
        sourceCsvRowId: source.sourceRowId || null,
        targetCsvRowId: target.sourceRowId || null,
        beforeRawState: Object.freeze({ field: SUPPORT_REV_TOTAL_POINTS_FIELD, value: before.raw }),
        afterRawState: Object.freeze({ field: SUPPORT_REV_TOTAL_POINTS_FIELD, value: after.raw }),
        normalizedState: Object.freeze({ before: before.value, after: after.value, delta: before.value != null && after.value != null ? after.value - before.value : null }),
        matchingMethod: edge.matchingMethod || 'lineage-edge',
        reasonCodes: Object.freeze(['TOTAL_SUPPORT_POINTS_DELTA', 'LOCAL_SUPPORT_GRAPH_CHANGED']),
        persistentReferences: Object.freeze(sharedReferences(source, target, edge)),
        coordinateResidual: null,
        loadDeltas: Object.freeze([]),
        profileId: ledger.profileId,
        profileVersion: ledger.profileVersion,
        policyId: ledger.policyId,
        policyVersion: ledger.policyVersion,
        loadPolicyId: null,
        loadPolicyVersion: null,
        auditStatus: 'AUTO',
        remarkEligible: true,
        lineageEdgeId: edge.edgeId || null,
        candidateIds: Object.freeze([...(edge.candidateIds || [])]),
        trace: Object.freeze({
          sourceNodeId: source.nodeId,
          targetNodeId: target.nodeId,
          sourceRowId: source.sourceRowId || null,
          targetRowId: target.sourceRowId || null,
          sourceCells: source.provenance?.cells || {},
          targetCells: target.provenance?.cells || {},
        }),
      }));
    }
  }
  if (!additions.length) return ledger;
  const events = Object.freeze([...(ledger?.events || []), ...additions]);
  return Object.freeze({
    ...ledger,
    schema: 'support-revision-event-ledger/v5-local-total-support-points',
    events,
    summary: summarize(events),
  });
}

export function normalizeSupportPointCount(value) {
  const raw = clean(value);
  if (!raw) return Object.freeze({ raw, value: null, comparable: true });
  const numeric = Number(raw);
  return Object.freeze({ raw, value: Number.isFinite(numeric) ? numeric : upper(raw), comparable: true });
}

export function sameSupportPointCount(before, after) {
  return before?.value === after?.value;
}

function localGraphChangedPairs(ledger) {
  return new Set((ledger?.events || []).flatMap((event) => (
    event.type === 'SUPPORT_COMPONENT_SET_CHANGED' && event.sourceXmlNode && event.targetXmlNode
      ? [pairKey(event.sourceXmlNode, event.targetXmlNode)]
      : []
  )));
}

function pairKey(sourceNodeId, targetNodeId) {
  return `${clean(sourceNodeId)}\u0000${clean(targetNodeId)}`;
}

function continuingPairs(edge, sourceModel, targetModel) {
  const sources = (edge.sourceNodeIds || []).map((id) => sourceModel.locationByNodeId.get(id)).filter(Boolean);
  const targets = (edge.targetNodeIds || []).map((id) => targetModel.locationByNodeId.get(id)).filter(Boolean);
  if (edge.cardinality === '1->1') return sources[0] && targets[0] ? [[sources[0], targets[0]]] : [];
  if (edge.cardinality === '1->N') {
    const target = selectContinuingPeer(sources[0], targets);
    return sources[0] && target ? [[sources[0], target]] : [];
  }
  if (edge.cardinality === 'N->1') {
    const source = selectContinuingPeer(targets[0], sources);
    return source && targets[0] ? [[source, targets[0]]] : [];
  }
  if (edge.cardinality === 'N->M' && edge.reviewDecision !== 'ACCEPTED') return [];
  return pairStructuralContinuations(sources, targets);
}

function selectContinuingPeer(anchor, peers) {
  if (!anchor || !peers?.length) return null;
  const exactIdentity = peers.filter((peer) => upper(peer.supportLocationIdentity) === upper(anchor.supportLocationIdentity));
  if (exactIdentity.length === 1) return exactIdentity[0];
  const exactRefs = peers.filter((peer) => anchor.referenceMultiplicityKey && peer.referenceMultiplicityKey === anchor.referenceMultiplicityKey);
  if (exactRefs.length === 1) return exactRefs[0];
  const ranked = peers.map((peer) => ({ peer, overlap: anchor.persistentReferences.filter((ref) => peer.persistentReferences.includes(ref)).length }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.peer.nodeId.localeCompare(b.peer.nodeId));
  return ranked.length === 1 || (ranked[0] && ranked[0].overlap > ranked[1]?.overlap) ? ranked[0]?.peer || null : null;
}

function pairStructuralContinuations(sources, targets) {
  const available = new Set(targets.map((target) => target.nodeId));
  const pairs = [];
  for (const source of sources) {
    const target = selectContinuingPeer(source, targets.filter((item) => available.has(item.nodeId)));
    if (!target) continue;
    available.delete(target.nodeId);
    pairs.push([source, target]);
  }
  return pairs;
}

function sharedReferences(source, target, edge) {
  const shared = source.persistentReferences.filter((ref) => target.persistentReferences.includes(ref));
  return [...new Set([...(shared.length ? shared : edge.persistentReferences || [])])];
}

function summarize(events) {
  const byType = {};
  for (const event of events) byType[event.type] = (byType[event.type] || 0) + 1;
  return Object.freeze({
    total: events.length,
    remarkEligible: events.filter((event) => event.remarkEligible).length,
    reviewRequired: events.filter((event) => event.auditStatus === 'REVIEW_REQUIRED').length,
    byType: Object.freeze(byType),
  });
}

export const _test = Object.freeze({ localGraphChangedPairs, pairKey, continuingPairs, selectContinuingPeer, pairStructuralContinuations, summarize });

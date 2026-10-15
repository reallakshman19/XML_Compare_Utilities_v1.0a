import { classifySupportLocationEvidence } from './support-revision-lineage-eligibility.js';
import { projectSupportRevisionRemarkEvent } from './support-revision-remarks.js';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase().replace(/\s+/g, ' ');
const RECIPIENT_AUDIT_ONLY_EVENT_TYPES = Object.freeze(new Set([
  'PRIMARY_MEMBER_RENUMBERED',
  'SUPPRESSED_FIELD_CHANGED',
]));

export const COMMON_SUPPORT_REMARK_REPLICATED = 'COMMON_SUPPORT_REMARK_REPLICATED';

export function augmentCommonSupportRemarkReplicationEvents(ledger, sourceModel, targetModel, lineage) {
  const groups = commonSupportSiblingGroups(targetModel);
  if (!groups.length) return ledger;

  const directRemarks = directTargetRemarkEvidence(ledger, sourceModel, targetModel);
  const blockingEvents = recipientBlockingEventEvidence(ledger);
  const additions = [];
  let nextIndex = ledger?.events?.length || 0;

  for (const group of groups) {
    const triggers = group.locations.flatMap((location) => directRemarks.get(location.nodeId) || []);
    if (!triggers.length) continue;

    const triggerNodeIds = [...new Set(triggers.map((item) => item.targetNodeId).filter(Boolean))].sort();
    const triggerRowIds = [...new Set(triggers.map((item) => item.rowId).filter(Boolean))].sort();
    const triggerEventIds = [...new Set(triggers.map((item) => item.eventId).filter(Boolean))].sort();

    for (const target of group.locations) {
      // A sibling that already has its own visible remark is the cause, not a
      // replication recipient. Internal audit-only bookkeeping (member renumbering
      // and suppressed fields) does not make an otherwise unchanged row ineligible.
      if (directRemarks.has(target.nodeId)) continue;
      if ((blockingEvents.get(target.nodeId) || []).length) continue;

      // A component-only retained row can still carry persistent-reference evidence,
      // but it is not a complete continuing sibling row. Require independent active
      // payload beyond components before inheriting a sibling's visible remark.
      const targetEvidence = classifySupportLocationEvidence(target);
      if (!hasIndependentActivePayload(targetEvidence)) continue;

      const predecessor = exactIdentityPredecessor(target, sourceModel, lineage);
      if (!predecessor) continue;

      const sharedReferences = predecessor.source.persistentReferences.filter((ref) => target.persistentReferences.includes(ref));
      additions.push(Object.freeze({
        eventId: `support-event:${String(++nextIndex).padStart(5, '0')}`,
        type: COMMON_SUPPORT_REMARK_REPLICATED,
        sourceXmlNode: predecessor.source.nodeId,
        targetXmlNode: target.nodeId,
        sourceCsvRowId: predecessor.source.sourceRowId || null,
        targetCsvRowId: target.sourceRowId || null,
        beforeRawState: Object.freeze({
          family: predecessor.source.family,
          pipe: predecessor.source.pipe?.raw || '',
          supportLocationIdentity: predecessor.source.supportLocationIdentity,
        }),
        afterRawState: Object.freeze({
          family: target.family,
          pipe: target.pipe?.raw || '',
          supportLocationIdentity: target.supportLocationIdentity,
        }),
        normalizedState: Object.freeze({
          commonSupportFamily: group.family,
          triggerSiblingNodeIds: Object.freeze(triggerNodeIds),
          triggerSiblingRowIds: Object.freeze(triggerRowIds),
          triggerRemarkEventIds: Object.freeze(triggerEventIds),
          recipientEvidence: targetEvidence.evidence,
        }),
        matchingMethod: 'common-support-sibling-remark-propagation',
        reasonCodes: Object.freeze([
          'COMMON_CIVIL_SUPPORT_FAMILY',
          'DISTINCT_PIPE_SIBLINGS',
          'SIBLING_HAS_GENERATED_REMARK',
          'RECIPIENT_HAS_NO_MATERIAL_LOCAL_CHANGE',
          'RECIPIENT_ACTIVE_NONCOMPONENT_PAYLOAD',
          'EXACT_CIVIL_PIPE_PREDECESSOR',
        ]),
        persistentReferences: Object.freeze([...sharedReferences]),
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
        lineageEdgeId: predecessor.edge.edgeId || null,
        candidateIds: Object.freeze([...(predecessor.edge.candidateIds || [])]),
        trace: Object.freeze({
          sourceNodeId: predecessor.source.nodeId,
          targetNodeId: target.nodeId,
          sourceRowId: predecessor.source.sourceRowId || null,
          targetRowId: target.sourceRowId || null,
          commonSupportFamily: group.family,
          siblingNodeIds: Object.freeze(group.locations.map((item) => item.nodeId).sort()),
          triggerSiblingNodeIds: Object.freeze(triggerNodeIds),
          triggerSiblingRowIds: Object.freeze(triggerRowIds),
          triggerRemarkEventIds: Object.freeze(triggerEventIds),
          ignoredAuditEventIds: Object.freeze(auditOnlyEventIdsForTarget(ledger, target.nodeId)),
          recipientEvidence: targetEvidence.evidence,
          sourceCells: predecessor.source.provenance?.cells || {},
          targetCells: target.provenance?.cells || {},
        }),
      }));
    }
  }

  if (!additions.length) return ledger;
  const events = Object.freeze([...(ledger?.events || []), ...additions]);
  return Object.freeze({
    ...ledger,
    schema: 'support-revision-event-ledger/v6-common-support-remark-replication',
    events,
    summary: summarize(events),
  });
}

export function commonSupportSiblingGroups(model) {
  const groups = new Map();
  for (const location of model?.locations || []) {
    const family = upper(location.family);
    if (!family) continue;
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(location);
  }

  return Object.freeze([...groups.entries()].flatMap(([family, locations]) => {
    const members = [...locations].sort((a, b) => clean(a.nodeId).localeCompare(clean(b.nodeId)));
    const distinctPipes = new Set(members.map(pipeSiblingKey).filter(Boolean));
    if (members.length < 2 || distinctPipes.size < 2) return [];
    return [Object.freeze({ family, locations: Object.freeze(members), distinctPipeCount: distinctPipes.size })];
  }));
}

function directTargetRemarkEvidence(ledger, sourceModel, targetModel) {
  const byNode = new Map();
  for (const event of ledger?.events || []) {
    if (!event.remarkEligible || event.type === COMMON_SUPPORT_REMARK_REPLICATED) continue;
    const projections = projectSupportRevisionRemarkEvent(event, sourceModel, targetModel)
      .filter((item) => item.side === 'target');
    if (!projections.length || !event.targetXmlNode) continue;
    if (!byNode.has(event.targetXmlNode)) byNode.set(event.targetXmlNode, []);
    for (const projection of projections) {
      byNode.get(event.targetXmlNode).push(Object.freeze({
        eventId: event.eventId,
        eventType: event.type,
        targetNodeId: event.targetXmlNode,
        rowId: projection.rowId,
        tokenKey: projection.key,
        token: projection.text,
      }));
    }
  }
  return byNode;
}

function recipientBlockingEventEvidence(ledger) {
  const byNode = new Map();
  for (const event of ledger?.events || []) {
    if (!event.targetXmlNode || event.type === COMMON_SUPPORT_REMARK_REPLICATED) continue;
    if (RECIPIENT_AUDIT_ONLY_EVENT_TYPES.has(event.type)) continue;
    if (!byNode.has(event.targetXmlNode)) byNode.set(event.targetXmlNode, []);
    byNode.get(event.targetXmlNode).push(event.eventId || event.type);
  }
  return byNode;
}

function auditOnlyEventIdsForTarget(ledger, targetNodeId) {
  return (ledger?.events || [])
    .filter((event) => event.targetXmlNode === targetNodeId && RECIPIENT_AUDIT_ONLY_EVENT_TYPES.has(event.type))
    .map((event) => event.eventId || event.type)
    .sort();
}

function hasIndependentActivePayload(assessment) {
  const evidence = assessment?.evidence || {};
  return Boolean(
    evidence.hasCoordinateEvidence
    || evidence.hasLoadEvidence
    || evidence.hasSupportCountEvidence
    || evidence.hasDescriptionEvidence
  );
}

function exactIdentityPredecessor(target, sourceModel, lineage) {
  if (!target?.nodeId || !target.supportLocationIdentity) return null;
  const matches = [];
  for (const edge of lineage?.edges || []) {
    if (edge.outcome === 'AMBIGUOUS' || !(edge.targetNodeIds || []).includes(target.nodeId)) continue;
    for (const sourceId of edge.sourceNodeIds || []) {
      const source = sourceModel?.locationByNodeId?.get(sourceId) || null;
      if (!source) continue;
      if (upper(source.supportLocationIdentity) !== upper(target.supportLocationIdentity)) continue;
      matches.push({ source, edge });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function pipeSiblingKey(location) {
  return upper(location?.pipe?.normalizedCore || location?.pipe?.raw);
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

export const _test = Object.freeze({
  directTargetRemarkEvidence,
  recipientBlockingEventEvidence,
  auditOnlyEventIdsForTarget,
  hasIndependentActivePayload,
  exactIdentityPredecessor,
  pipeSiblingKey,
  summarize,
});

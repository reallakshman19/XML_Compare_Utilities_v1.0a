export const SUPPORT_REV_REMARKS_V1 = Object.freeze({
  policyId: 'SUPPORT_REV_REMARKS_V1',
  version: '1.4.0',
  precedence: Object.freeze([
    'REMOVED_REPLACED',
    'REMOVED_UNSUPPORTED',
    'PREVIOUS_FAMILY_LINE',
    'LINE_NUMBER_INVALID',
    'LINE_NUMBER_CHANGE',
    'COMMON_REPLICATED',
    'LOCATION_RELOCATED',
    'COMMON_RELOCATED',
    'SUPPORT_TYPE_CHANGES',
    'TOTAL_SUPPORT_POINTS_CHANGED',
    'LOAD_STANDARDISED',
    'LOAD_CHANGE',
  ]),
});

export function renderSupportRevisionRemarks(ledger, sourceModel, targetModel, policy = SUPPORT_REV_REMARKS_V1) {
  const sourceTokens = new Map();
  const targetTokens = new Map();
  const trace = [];
  for (const event of ledger?.events || []) {
    if (!event.remarkEligible) continue;
    for (const projection of projectSupportRevisionRemarkEvent(event, sourceModel, targetModel)) {
      addToken(projection.side === 'source' ? sourceTokens : targetTokens, projection);
      trace.push(Object.freeze({ eventId: event.eventId, side: projection.side, rowId: projection.rowId, tokenKey: projection.key, token: projection.text, sourceXmlNode: event.sourceXmlNode, targetXmlNode: event.targetXmlNode, lineageEdgeId: event.lineageEdgeId, candidateIds: event.candidateIds, eventTrace: event.trace }));
    }
  }
  return Object.freeze({ schema: 'support-revision-remark-render/v1', policyId: policy.policyId, sourceRemarks: freezeRemarkMap(sourceTokens, policy), targetRemarks: freezeRemarkMap(targetTokens, policy), trace: Object.freeze(trace) });
}

export function projectSupportRevisionRemarkEvent(event, sourceModel, targetModel) {
  const source = sourceModel?.locationByNodeId?.get(event.sourceXmlNode) || null;
  const target = targetModel?.locationByNodeId?.get(event.targetXmlNode) || null;
  if (event.type === 'PIPE_IDENTITY_SHELL_INVALIDATED' && target) return [token('target', target.sourceRowId, 'LINE_NUMBER_INVALID', 'Invalid (Line No. Changed)')];
  if (event.type === 'COMMON_SUPPORT_REMARK_REPLICATED' && target) return [token('target', target.sourceRowId, 'COMMON_REPLICATED', 'Replicated due to Common support')];
  if (event.type === 'SUPPORT_LOCATION_RELOCATED' && target) return [token('target', target.sourceRowId, 'LOCATION_RELOCATED', 'Support Relocated')];
  if (event.type === 'COMMON_SUPPORT_ANCHOR_RELOCATED' && target) return [token('target', target.sourceRowId, 'COMMON_RELOCATED', 'Support Relocated')];
  // Component-set churn is structural graph evidence, not proof that a surviving
  // primary support changed type. Only a same-reference type mutation is projected
  // as the Owner-visible Support Type Changes remark.
  if (event.type === 'SUPPORT_COMPONENT_TYPE_CHANGED' && target) return [token('target', target.sourceRowId, 'SUPPORT_TYPE_CHANGES', 'Support Type Changes')];
  if (event.type === 'TOTAL_SUPPORT_POINTS_CHANGED' && target) return [token('target', target.sourceRowId, 'TOTAL_SUPPORT_POINTS_CHANGED', 'Total No. of support changes')];
  if (event.type === 'LOAD_BECAME_NUMERIC' && target) return [token('target', target.sourceRowId, 'LOAD_STANDARDISED', 'load standardised')];
  if (event.type === 'LOAD_SIGNATURE_CHANGED' && target) return [token('target', target.sourceRowId, 'LOAD_CHANGE', 'Minor Load change')];
  if (event.type === 'SUPPORT_LOCATION_REMOVED' && source) return [token('source', source.sourceRowId, 'REMOVED_UNSUPPORTED', 'Invalid Support?, This pipe no longer reported in latest report')];
  if (event.type === 'SECONDARY_SUPPORT_FAMILY_CHANGED' && source && target) return familyChangeTokens(event, source, target);
  if (event.type === 'PIPE_IDENTITY_CHANGED' && event.normalizedState?.projection === 'LINE_NUMBER_CHANGE' && source && target) {
    return [token('target', target.sourceRowId, 'LINE_NUMBER_CHANGE', `Line No. Change(Old Line No. ${source.pipe.raw})`)];
  }
  return [];
}

function familyChangeTokens(event, source, target) {
  const reference = event.persistentReferences?.[0] || source.persistentReferences?.[0] || '';
  const previous = reference ? `${source.family}(${reference})` : source.family;
  return [
    token('source', source.sourceRowId, 'REMOVED_REPLACED', `Invalid Support, replaced by ${target.family}`),
    token('target', target.sourceRowId, 'PREVIOUS_FAMILY_LINE', `PS No./Line No. Change Earlier:${previous}`),
  ];
}

function addToken(map, projection) {
  if (!map.has(projection.rowId)) map.set(projection.rowId, []);
  const tokens = map.get(projection.rowId);
  if (!tokens.some((item) => item.key === projection.key)) tokens.push(projection);
}
function token(side, rowId, key, text) { return Object.freeze({ side, rowId, key, text }); }
function freezeRemarkMap(map, policy) {
  const rank = new Map(policy.precedence.map((key, index) => [key, index]));
  return Object.freeze(Object.fromEntries([...map.entries()].map(([rowId, tokens]) => {
    const ordered = [...tokens].sort((a,b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999) || a.key.localeCompare(b.key));
    return [rowId, Object.freeze({ remark: ordered.map((item) => item.text).join(', '), tokens: Object.freeze(ordered) })];
  })));
}

export const _test = Object.freeze({ projectEvent: projectSupportRevisionRemarkEvent, freezeRemarkMap, familyChangeTokens });
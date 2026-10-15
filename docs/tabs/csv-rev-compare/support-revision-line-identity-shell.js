const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();

export const SUPPORT_REV_LINE_IDENTITY_SHELL_EVENT = 'PIPE_IDENTITY_SHELL_INVALIDATED';
export const SUPPORT_REV_LINE_IDENTITY_SHELL_SCHEMA = 'support-revision-line-identity-shell/v1';

/**
 * Retained identity-only rows remain outside active-support lineage. When an
 * active successor is already proven to continue the same Civil support on a
 * changed PIPE, the retained old Civil+PIPE shell can be classified as the
 * invalid old-line presentation row without consulting target remarks.
 */
export function augmentLineIdentityShellEvents(ledger, sourceModel, targetModel, lineage) {
  const detections = detectLineIdentityShells(ledger, sourceModel, targetModel, lineage);
  if (!detections.length) return ledger;

  let nextIndex = ledger?.events?.length || 0;
  const additions = detections.map(({ pipeEvent, source, activeTarget, shell, sharedReferences }) => Object.freeze({
    eventId: `support-event:${String(++nextIndex).padStart(5, '0')}`,
    type: SUPPORT_REV_LINE_IDENTITY_SHELL_EVENT,
    sourceXmlNode: source.nodeId,
    targetXmlNode: shell.nodeId,
    sourceCsvRowId: source.sourceRowId || null,
    targetCsvRowId: shell.sourceRowId || null,
    beforeRawState: Object.freeze({ family: source.family, pipe: source.pipe?.raw || '' }),
    afterRawState: Object.freeze({ family: shell.family, pipe: shell.pipe?.raw || '' }),
    normalizedState: Object.freeze({
      schema: SUPPORT_REV_LINE_IDENTITY_SHELL_SCHEMA,
      projection: 'INVALID_LINE_NUMBER_CHANGED',
      oldPipe: source.pipe?.raw || '',
      newPipe: activeTarget.pipe?.raw || '',
      activeSuccessorTargetXmlNode: activeTarget.nodeId,
      activeSuccessorTargetCsvRowId: activeTarget.sourceRowId || null,
    }),
    matchingMethod: 'identity-shell-of-proven-line-change',
    reasonCodes: Object.freeze([
      'TARGET_IDENTITY_ONLY_SHELL',
      'EXACT_OLD_CIVIL_PIPE_IDENTITY',
      'PROVEN_ACTIVE_SUCCESSOR_PIPE_IDENTITY_CHANGED',
      'PERSISTENT_REFERENCE_CONTINUITY',
    ]),
    persistentReferences: Object.freeze(sharedReferences),
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
    lineageEdgeId: pipeEvent.lineageEdgeId || null,
    candidateIds: Object.freeze([...(pipeEvent.candidateIds || [])]),
    trace: Object.freeze({
      sourceNodeId: source.nodeId,
      shellTargetNodeId: shell.nodeId,
      activeSuccessorTargetNodeId: activeTarget.nodeId,
      sourceRowId: source.sourceRowId || null,
      shellTargetRowId: shell.sourceRowId || null,
      activeSuccessorTargetRowId: activeTarget.sourceRowId || null,
      sourceCells: source.provenance?.cells || {},
      shellTargetCells: shell.provenance?.cells || {},
      activeSuccessorTargetCells: activeTarget.provenance?.cells || {},
    }),
  }));

  const events = Object.freeze([...(ledger?.events || []), ...additions]);
  return Object.freeze({
    ...ledger,
    schema: 'support-revision-event-ledger/v6-line-identity-shell',
    events,
    summary: summarize(events),
  });
}

export function detectLineIdentityShells(ledger, sourceModel, targetModel, lineage) {
  const ignored = lineage?.comparisonEligibility?.ignoredTargetLocations || [];
  const detections = [];
  const consumedShells = new Set();

  for (const pipeEvent of ledger?.events || []) {
    if (!isProvenLineChange(pipeEvent)) continue;
    const source = sourceModel?.locationByNodeId?.get(pipeEvent.sourceXmlNode) || null;
    const activeTarget = targetModel?.locationByNodeId?.get(pipeEvent.targetXmlNode) || null;
    if (!source || !activeTarget || upper(source.family) !== upper(activeTarget.family)) continue;

    const sharedReferences = source.persistentReferences
      .filter((reference) => activeTarget.persistentReferences.includes(reference))
      .sort();
    if (!sharedReferences.length) continue;

    const shells = ignored
      .map((item) => targetModel?.locationByNodeId?.get(item.nodeId) || null)
      .filter((shell) => shell && shell.nodeId !== activeTarget.nodeId)
      .filter((shell) => upper(shell.supportLocationIdentity) === upper(source.supportLocationIdentity));
    if (shells.length !== 1 || consumedShells.has(shells[0].nodeId)) continue;

    consumedShells.add(shells[0].nodeId);
    detections.push(Object.freeze({ pipeEvent, source, activeTarget, shell: shells[0], sharedReferences: Object.freeze(sharedReferences) }));
  }
  return Object.freeze(detections);
}

function isProvenLineChange(event) {
  return event?.type === 'PIPE_IDENTITY_CHANGED'
    && event?.remarkEligible === true
    && event?.normalizedState?.projection === 'LINE_NUMBER_CHANGE';
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

export const _test = Object.freeze({ isProvenLineChange, summarize });
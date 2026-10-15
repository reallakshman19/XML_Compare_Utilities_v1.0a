import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId, stableStringify } from './cii-workspace-contracts.js';
import { ciiIdentityBound } from './cii-workspace-engineering-delta.js';
import { pairCiiRestraintRecords } from './cii-workspace-restraint-pairing.js';

function capability(document) { return document?.capabilities?.families?.restraints || null; }
function qualified(document) {
  const item = capability(document);
  return item?.state !== 'PARSE_ERROR'
    && item?.details?.gapFrictionQualified === true
    && String(item?.authority || '').includes('#RESTRANT')
    && document?.auxiliaryEvidence?.restraints?.byNode;
}
function transferableNodeRows(correspondence) {
  return (correspondence?.nodeRows || []).filter((row) => row?.sourceNodeId && row?.targetNodeId
    && ciiIdentityBound(row) && !['CONFLICT', 'UNRESOLVED', 'INSERTED', 'DELETED'].includes(row.status));
}
function nodeCorrespondenceMap(correspondence) {
  return new Map(transferableNodeRows(correspondence).map((row) => [String(row.sourceNodeId), String(row.targetNodeId)]));
}
function recordSemantic(record, nodeMap, targetNode = null) {
  const sourceConnecting = Number(record?.connectingNode || 0);
  const mappedConnecting = Math.abs(sourceConnecting) <= 1e-12 ? 0 : Number(nodeMap.get(String(Math.round(sourceConnecting))));
  return {
    node: targetNode ?? String(record?.node || ''), typeCode: Number(record?.typeCode), stiffness: Number(record?.stiffness),
    gap: Number(record?.gap), friction: Number(record?.friction),
    connectingNode: Number.isFinite(mappedConnecting) ? mappedConnecting : `UNMAPPED:${sourceConnecting}`,
    directionCosines: { x: Number(record?.directionCosines?.x), y: Number(record?.directionCosines?.y), z: Number(record?.directionCosines?.z) },
  };
}
function projectedChanged(sourceRecords, targetRecords, row, nodeMap) {
  if (sourceRecords.length !== targetRecords.length) return true;
  const source = sourceRecords.map((record) => recordSemantic(record, nodeMap, String(row.targetNodeId)))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), undefined, { numeric: true }));
  const target = targetRecords.map((record) => recordSemantic(record, new Map(), String(row.targetNodeId)))
    .map((record) => ({ ...record, connectingNode: typeof record.connectingNode === 'string'
      ? Number(String(record.connectingNode).replace('UNMAPPED:', '')) : record.connectingNode }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), undefined, { numeric: true }));
  return stableStringify(source) !== stableStringify(target);
}
function pairingDelta(row, sourceRecords, targetRecords, pairing, nodeMap) {
  const changed = pairing.status === 'QUALIFIED' ? pairing.pairs.some((pair) => pair.changed) : projectedChanged(sourceRecords, targetRecords, row, nodeMap);
  const authority = pairing.status === 'QUALIFIED'
    ? `PROTECTED_WRITER_RESTRANT_POINTER_SLOT_PAIRING:${pairing.authority}` : 'RESTRAINT_POINTER_SLOT_PAIRING_UNRESOLVED';
  return deepFreeze({
    deltaId: stableId('delta', row.correspondenceId, 'RESTRAINT', 'Qualified restraint record pairing'),
    correspondenceId: row.correspondenceId, identityKind: row.kind, sourceIdentity: row.sourceNodeId, targetIdentity: row.targetNodeId,
    identityConfidence: row.status === 'LOCKED' ? 'LOCKED' : row.status, category: 'RESTRAINT', property: 'Qualified restraint record pairing',
    sourceValue: pairing, targetValue: null, delta: null,
    semanticChange: pairing.status === 'QUALIFIED' ? (changed ? 'PAIRED_RESTRAINT_RECORDS_CHANGED' : 'PAIRED_RESTRAINT_RECORDS_UNCHANGED') : 'RESTRAINT_PAIRING_BLOCKED',
    changed, evidenceStatus: pairing.status === 'QUALIFIED' ? 'QUALIFIED' : 'BLOCKED', authority,
    limitations: Object.freeze(pairing.blockers || []),
  });
}

export function augmentCiiEngineeringDeltasWithRestraintPairing(deltaSet, sourceDocument, targetDocument, correspondence, options = {}) {
  if (!deltaSet || deltaSet.schema !== CII_WORKSPACE_SCHEMAS.engineeringDeltaSet) return deltaSet;
  if (!qualified(sourceDocument) || !qualified(targetDocument)) return deltaSet;
  const rows = [...(deltaSet.rows || [])]; const nodeMap = nodeCorrespondenceMap(correspondence);
  for (const row of transferableNodeRows(correspondence)) {
    const sourceRecords = [...(sourceDocument.auxiliaryEvidence.restraints.byNode?.[String(row.sourceNodeId)] || [])];
    const targetRecords = [...(targetDocument.auxiliaryEvidence.restraints.byNode?.[String(row.targetNodeId)] || [])];
    if (!sourceRecords.length && !targetRecords.length) continue;
    // Equal-cardinality records stay under Writer 1A pairing. Any +1/-1 or
    // larger cardinality change is represented exclusively by the Writer 1B
    // slot-mutation augmentation, avoiding a second contradictory blocked row.
    if (sourceRecords.length !== targetRecords.length) continue;
    const pairing = pairCiiRestraintRecords(sourceRecords, targetRecords, nodeMap, options);
    rows.push(pairingDelta(row, sourceRecords, targetRecords, pairing, nodeMap));
  }
  rows.sort((a, b) => `${a.sourceIdentity}|${a.category}|${a.property}`.localeCompare(`${b.sourceIdentity}|${b.category}|${b.property}`, undefined, { numeric: true }));
  const changedRows = rows.filter((row) => row.changed); const familyCounts = {};
  for (const row of changedRows) familyCounts[row.category] = (familyCounts[row.category] || 0) + 1;
  return deepFreeze({ ...deltaSet, rows: Object.freeze(rows), changedRows: Object.freeze(changedRows), summary: Object.freeze({
    ...deltaSet.summary, comparedPropertyCount: rows.length, engineeringChangeCount: changedRows.length,
    unchangedPropertyCount: rows.length - changedRows.length, changeFamilyCounts: Object.freeze(familyCounts),
  }) });
}

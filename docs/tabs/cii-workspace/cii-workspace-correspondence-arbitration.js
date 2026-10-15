import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId, stableStringify } from './cii-workspace-contracts.js';

const STATUS_RANK = Object.freeze({ LOCKED: 5, HIGH: 4, READY: 4, REVIEW: 3, INSERTED: 2, UNRESOLVED: 1, CONFLICT: 0 });

function ids(values) {
  return [...new Set((values || []).map((value) => String(value ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sourceElementIds(row) {
  return ids(row?.sourceElementId ? [row.sourceElementId] : row?.sourceElementIds);
}
function targetElementIds(row) { return ids(row?.targetElementIds); }
function rowStatusRank(row) { return STATUS_RANK[row?.status] ?? 0; }
function provenance(loopResult, row) {
  const loop = loopResult.loop || {};
  return deepFreeze({
    loopId: String(loop.loopId || ''), method: String(loop.method || ''), baseConfidence: loop.confidence || null,
    baseWeight: loop.weight || null, rowStatus: row.status || null, rowAuthority: row.authority || null,
  });
}
function methodBasis(rows) {
  const methods = new Set(rows.map((item) => item.loop?.method).filter(Boolean));
  if (methods.has('METHOD_A_SPATIAL') && methods.has('METHOD_B_NETWORK')) return 'METHOD_A_AND_B';
  if (methods.has('METHOD_A_SPATIAL')) return 'METHOD_A_SPATIAL';
  if (methods.has('METHOD_B_NETWORK')) return 'METHOD_B_NETWORK';
  if (methods.has('USER_LOCKED_LEGACY')) return 'USER_LOCKED_LEGACY';
  return 'MULTI_BASE';
}
function claimKey(row) {
  if (row?.kind === 'NODE' && row.sourceNodeId != null && row.targetNodeId != null) {
    return `NODE|${String(row.sourceNodeId)}=>${String(row.targetNodeId)}`;
  }
  const sourceIds = sourceElementIds(row); const targetIds = targetElementIds(row);
  if (sourceIds.length && targetIds.length) return `${row.kind || 'ELEMENT'}|${sourceIds.join(',')}=>${targetIds.join(',')}`;
  if (row?.kind === 'NODE' && row.sourceNodeId == null && row.targetNodeId != null) return `NODE_INSERTED|${String(row.targetNodeId)}`;
  return `NONCLAIM|${row?.correspondenceId || stableStringify(row)}`;
}
function canonicalId(row) {
  if (row?.kind === 'NODE') return stableId('multi-base-node', row.sourceNodeId || '', row.targetNodeId || '');
  const sourceIds = sourceElementIds(row); const targetIds = targetElementIds(row);
  if (sourceIds.length || targetIds.length) return stableId('multi-base-element', sourceIds.join(','), targetIds.join(','));
  return stableId('multi-base-row', row?.correspondenceId || stableStringify(row));
}
function canonicalizeGroup(group) {
  const ordered = [...group].sort((a, b) => rowStatusRank(b.row) - rowStatusRank(a.row)
    || String(a.loop?.loopId || '').localeCompare(String(b.loop?.loopId || ''), undefined, { numeric: true }));
  const winner = ordered[0].row; const provenanceRows = ordered.map((item) => provenance(item, item.row));
  const evidence = deepFreeze({ ...(winner.evidence || {}), multiBaseProvenance: deepFreeze(provenanceRows) });
  return deepFreeze({ ...winner, correspondenceId: canonicalId(winner),
    authority: ordered.length > 1 ? 'MULTI_BASE_CORROBORATED' : 'MULTI_BASE_LOOP', basisMethod: methodBasis(ordered), evidence });
}
function groupedClaims(loopResults, field) {
  const grouped = new Map();
  for (const loopResult of loopResults) {
    for (const row of loopResult.correspondence?.[field] || []) {
      const key = claimKey(row); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push({ loop: loopResult.loop, row });
    }
  }
  return grouped;
}
function canonicalRows(loopResults, field) {
  return [...groupedClaims(loopResults, field).values()].map(canonicalizeGroup).sort((a, b) => canonicalId(a).localeCompare(canonicalId(b), undefined, { numeric: true }));
}
function conflictRows(claims, keyField, valueField, kind) {
  const grouped = new Map();
  for (const claim of claims) {
    const key = claim[keyField]; if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(claim);
  }
  const conflicts = [];
  for (const [key, rows] of grouped.entries()) {
    const values = [...new Set(rows.map((row) => row[valueField]))].sort();
    if (values.length > 1) conflicts.push(deepFreeze({ kind, key, values: deepFreeze(values), claims: deepFreeze(rows) }));
  }
  return conflicts;
}
function nodeClaims(loopResults) {
  return loopResults.flatMap((loopResult) => (loopResult.correspondence?.nodeRows || []).flatMap((row) => {
    if (row.sourceNodeId == null || row.targetNodeId == null || row.status === 'UNRESOLVED' || row.status === 'CONFLICT') return [];
    return [{ loopId: loopResult.loop.loopId, method: loopResult.loop.method,
      sourceNodeId: String(row.sourceNodeId), targetNodeId: String(row.targetNodeId) }];
  }));
}
function elementClaims(loopResults) {
  return loopResults.flatMap((loopResult) => (loopResult.correspondence?.elementRows || []).flatMap((row) => {
    if (row.status === 'UNRESOLVED' || row.status === 'CONFLICT') return [];
    const sources = sourceElementIds(row); const targets = targetElementIds(row); if (!sources.length || !targets.length) return [];
    const sourceSignature = sources.join(','); const targetSignature = targets.join(',');
    return targets.flatMap((targetElementId) => sources.map((sourceElementId) => ({
      loopId: loopResult.loop.loopId, method: loopResult.loop.method, sourceElementId, targetElementId,
      sourceSignature, targetSignature,
    })));
  }));
}
function correspondenceConflicts(loopResults) {
  const nodes = nodeClaims(loopResults); const elements = elementClaims(loopResults);
  return [
    ...conflictRows(nodes, 'sourceNodeId', 'targetNodeId', 'SOURCE_NODE_TO_MULTIPLE_TARGETS'),
    ...conflictRows(nodes, 'targetNodeId', 'sourceNodeId', 'TARGET_NODE_TO_MULTIPLE_SOURCES'),
    ...conflictRows(elements, 'sourceElementId', 'targetSignature', 'SOURCE_ELEMENT_TO_MULTIPLE_TARGETS'),
    ...conflictRows(elements, 'targetElementId', 'sourceSignature', 'TARGET_ELEMENT_TO_MULTIPLE_SOURCES'),
  ];
}

export function arbitrateCiiLoopCorrespondences(loopResults = []) {
  const ready = (loopResults || []).filter((item) => item?.loop?.status === 'READY' && item?.correspondence?.status === 'READY');
  const conflicts = correspondenceConflicts(ready);
  const unresolved = (loopResults || []).filter((item) => item?.loop?.status === 'READY' && item?.correspondence?.status !== 'READY');
  const blockers = conflicts.length ? ['CROSS_LOOP_CORRESPONDENCE_CONFLICT'] : (!ready.length ? ['NO_READY_LOOP_CORRESPONDENCE'] : []);
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.correspondence, status: conflicts.length ? 'AMBIGUOUS' : (ready.length ? 'READY' : 'UNRESOLVED'),
    combination: 'OR_WITH_CONFLICT_VETO', blockers: deepFreeze(blockers), ambiguityRetained: Boolean(conflicts.length),
    conflicts: deepFreeze(conflicts), readyLoopCount: ready.length, unresolvedReadyBaseLoopCount: unresolved.length,
    contributingLoopIds: deepFreeze(ready.map((item) => String(item.loop.loopId))),
    loopResults: deepFreeze(loopResults), targetCustodyConflicts: deepFreeze([]),
    nodeRows: deepFreeze(canonicalRows(ready, 'nodeRows')), elementRows: deepFreeze(canonicalRows(ready, 'elementRows')),
  });
}

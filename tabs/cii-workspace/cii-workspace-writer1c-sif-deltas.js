import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId } from './cii-workspace-contracts.js';
import { ciiIdentityBound } from './cii-workspace-engineering-delta.js';

const AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
const FIELD_ROWS = Object.freeze([
  Object.freeze({ key: 'ii', item: 3, label: 'In-Plane SIF (ii)' }),
  Object.freeze({ key: 'io', item: 4, label: 'Out-Plane SIF (io)' }),
]);

function sourceIds(row) { return row?.sourceElementIds || (row?.sourceElementId ? [row.sourceElementId] : []); }
function targetIds(row) { return row?.targetElementIds || (row?.targetElementId ? [row.targetElementId] : []); }
function edgeMap(graph) { return new Map((graph?.edges || []).map((edge) => [String(edge.elementId), edge])); }
function explicitFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function sameNumber(left, right, tolerance = 1e-9) {
  if (!explicitFiniteNumber(left) || !explicitFiniteNumber(right)) return left === right;
  return Math.abs(left - right) <= Math.max(tolerance, Math.abs(right) * 1e-12);
}
function numericDelta(sourceValue, targetValue) {
  return explicitFiniteNumber(sourceValue) && explicitFiniteNumber(targetValue) ? targetValue - sourceValue : null;
}
function nodeCorrespondenceMap(correspondence) {
  const out = new Map();
  for (const row of correspondence?.nodeRows || []) {
    if (!row?.sourceNodeId || !row?.targetNodeId || !ciiIdentityBound(row)) continue;
    const source = String(row.sourceNodeId); const target = String(row.targetNodeId);
    if (!out.has(source)) out.set(source, new Set());
    out.get(source).add(target);
  }
  return out;
}
function exactNodeMapping(nodeMap, sourceNode, targetNode) {
  const targets = nodeMap.get(String(sourceNode));
  return Boolean(targets && targets.size === 1 && targets.has(String(targetNode)));
}
function elementEvidence(document, edge) {
  return document?.sifWriter1CEvidence?.byParsedElementIndex?.[String(edge?.parsedElementIndex)] || null;
}
function pointerBlock(document, binding) {
  const pointer = Number(binding?.pointer);
  return pointer > 0 ? document?.sifWriter1CEvidence?.byPointer?.[String(pointer)] || null : null;
}
function deltaRow(row, sourceValue, targetValue, property, sifField) {
  const changed = !sameNumber(sourceValue, targetValue);
  return deepFreeze({
    deltaId: stableId('delta', row.correspondenceId, 'SIF_TEE', property),
    correspondenceId: row.correspondenceId, identityKind: row.kind,
    sourceIdentity: sourceIds(row)[0] || null, targetIdentity: targetIds(row)[0] || null,
    identityConfidence: row.status === 'LOCKED' ? 'LOCKED' : row.status === 'HIGH' ? 'HIGH' : 'REVIEW',
    category: 'SIF_TEE', property, sourceValue, targetValue,
    delta: numericDelta(sourceValue, targetValue),
    semanticChange: changed ? 'CHANGED' : 'UNCHANGED', changed,
    evidenceStatus: 'QUALIFIED', authority: AUTHORITY,
    limitations: Object.freeze([
      'Writer 1C Phase-2B is limited to canonical neutral Version 11 item3/item4 existing-block explicit SIF values.',
      'Blank/non-numeric fields are not equivalent to numeric zero and are outside the production mutation slice.',
      'Production mutation additionally requires equal finite tee Type context and an explicit same-active-piping-code context attestation.',
    ]),
    sifField: deepFreeze(sifField),
  });
}
function writerSifRows(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence) {
  const sourceCustody = sourceDocument?.sifWriter1CEvidence; const targetCustody = targetDocument?.sifWriter1CEvidence;
  if (sourceCustody?.semanticStatus !== 'QUALIFIED' || targetCustody?.semanticStatus !== 'QUALIFIED') return [];
  if (Number(sourceCustody?.neutralVersion?.major) !== 11 || Number(targetCustody?.neutralVersion?.major) !== 11) return [];
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph); const nodeMap = nodeCorrespondenceMap(correspondence);
  const rows = [];
  for (const row of correspondence?.elementRows || []) {
    if (row?.kind !== 'ELEMENT' || !ciiIdentityBound(row)) continue;
    const sourceIdList = sourceIds(row); const targetIdList = targetIds(row);
    if (sourceIdList.length !== 1 || targetIdList.length !== 1) continue;
    const sourceEdge = sourceEdges.get(String(sourceIdList[0])); const targetEdge = targetEdges.get(String(targetIdList[0]));
    if (!sourceEdge || !targetEdge) continue;
    const sourceBinding = elementEvidence(sourceDocument, sourceEdge); const targetBinding = elementEvidence(targetDocument, targetEdge);
    if (!sourceBinding || !targetBinding || Number(sourceBinding.pointer) <= 0 || Number(targetBinding.pointer) <= 0) continue;
    const sourceBlock = pointerBlock(sourceDocument, sourceBinding); const targetBlock = pointerBlock(targetDocument, targetBinding);
    if (!sourceBlock || !targetBlock) continue;
    for (const slot of [1, 2]) {
      const sourceSlot = sourceBlock.slots?.[slot]; const targetSlot = targetBlock.slots?.[slot];
      if (!sourceSlot || !targetSlot || !sourceSlot.node || !targetSlot.node || Number(sourceSlot.node) <= 0 || Number(targetSlot.node) <= 0) continue;
      const sourceType = sourceSlot.type; const targetType = targetSlot.type;
      if (!explicitFiniteNumber(sourceType) || !explicitFiniteNumber(targetType) || sourceType !== targetType) continue;
      const nodeMappingQualified = exactNodeMapping(nodeMap, sourceSlot.node, targetSlot.node);
      for (const field of FIELD_ROWS) {
        const sourceField = sourceSlot[field.key]; const targetField = targetSlot[field.key];
        if (!sourceField?.qualified || !targetField?.qualified) continue;
        const property = `SIF/Tee slot ${slot} ${field.label}`;
        rows.push(deltaRow(row, sourceField.numericValue, targetField.numericValue, property, {
          slot, item: field.item, fieldKey: field.key,
          sourceParsedElementIndex: Number(sourceEdge.parsedElementIndex), targetParsedElementIndex: Number(targetEdge.parsedElementIndex),
          sourcePointer: Number(sourceBinding.pointer), targetPointer: Number(targetBinding.pointer),
          sourceNode: sourceSlot.node, targetNode: targetSlot.node,
          sourceType, targetType, nodeMappingQualified,
          sourceNeutralVersion: Number(sourceCustody.neutralVersion.major), targetNeutralVersion: Number(targetCustody.neutralVersion.major),
          sourceSpan: sourceField, targetSpan: targetField,
        }));
      }
    }
  }
  return rows;
}
function familyCounts(rows) {
  const counts = {};
  for (const row of rows.filter((item) => item.changed)) counts[row.category] = (counts[row.category] || 0) + 1;
  return Object.freeze(counts);
}

export function augmentCiiEngineeringDeltasWithWriter1CSifFields(base, sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence) {
  if (!base || base.schema !== CII_WORKSPACE_SCHEMAS.engineeringDeltaSet) return base;
  const extra = writerSifRows(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence);
  if (!extra.length) return base;
  const existing = new Set((base.rows || []).map((row) => row.deltaId));
  const rows = [...(base.rows || []), ...extra.filter((row) => !existing.has(row.deltaId))];
  rows.sort((a, b) => `${a.sourceIdentity}|${a.category}|${a.property}`.localeCompare(`${b.sourceIdentity}|${b.category}|${b.property}`, undefined, { numeric: true }));
  const changedRows = rows.filter((row) => row.changed);
  return deepFreeze({
    ...base, rows: Object.freeze(rows), changedRows: Object.freeze(changedRows),
    summary: Object.freeze({
      ...(base.summary || {}), comparedPropertyCount: rows.length, engineeringChangeCount: changedRows.length,
      unchangedPropertyCount: rows.length - changedRows.length, changeFamilyCounts: familyCounts(rows),
      writer1CSifFieldCount: extra.length,
    }),
  });
}

export const CII_WRITER_1C_SIF_DELTA_AUTHORITY = AUTHORITY;
export const _test = Object.freeze({ explicitFiniteNumber, sameSifValue: sameNumber, numericDelta });

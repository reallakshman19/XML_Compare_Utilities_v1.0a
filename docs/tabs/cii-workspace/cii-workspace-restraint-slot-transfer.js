import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId } from './cii-workspace-contracts.js';
import { ciiIdentityBound } from './cii-workspace-engineering-delta.js';
import { pairCiiRestraintRecords } from './cii-workspace-restraint-pairing.js';

const SLOTS = 6;
const ROWS_PER_SLOT = 4;
const ROWS_PER_BLOCK = SLOTS * ROWS_PER_SLOT;

function capability(document) { return document?.capabilities?.families?.restraints || null; }
function qualified(document) {
  const item = capability(document);
  return item?.state !== 'PARSE_ERROR' && item?.details?.gapFrictionQualified === true
    && String(item?.authority || '').includes('#RESTRANT') && document?.auxiliaryEvidence?.restraints?.byNode;
}
function textValue(value) { return typeof value === 'string' ? value.trim() : String(value?.text || '').trim(); }
function metadataEmpty(record) { return !textValue(record?.tag) && !textValue(record?.guid); }
function transferableRows(correspondence) {
  return (correspondence?.nodeRows || []).filter((row) => row?.sourceNodeId && row?.targetNodeId && ciiIdentityBound(row)
    && !['CONFLICT', 'UNRESOLVED', 'INSERTED', 'DELETED'].includes(row.status));
}
function nodeMap(correspondence) {
  return new Map(transferableRows(correspondence).map((row) => [String(row.sourceNodeId), String(row.targetNodeId)]));
}
function ownerPointers(document, node) {
  const set = new Set();
  for (const item of Object.values(document?.auxiliaryEvidence?.elements || {})) {
    if (String(item?.from) !== String(node) && String(item?.to) !== String(node)) continue;
    const pointer = Number(item?.pointers?.restraint || 0);
    if (Number.isSafeInteger(pointer) && pointer > 0) set.add(pointer);
  }
  return [...set].sort((a, b) => a - b);
}
function sectionRows(text) {
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*#\$\s*RESTRANT\s*$/i.test(line));
  if (start < 0) return [];
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*#\$/.test(lines[index])) break;
    if (lines[index].trim()) rows.push(lines[index]);
  }
  return rows;
}
function prefixedText(row) {
  const match = String(row || '').match(/^\s*(\d+)\s?(.*)$/);
  if (!match) return null;
  const length = Number(match[1]);
  return String(match[2] || '').slice(0, length);
}
function slotState(text, pointer, slot) {
  const rows = sectionRows(text);
  const base = (Number(pointer) - 1) * ROWS_PER_BLOCK + (Number(slot) - 1) * ROWS_PER_SLOT;
  if (base < 0 || base + 3 >= rows.length) return null;
  const line1 = decodeCiiNumericRow(rows[base]);
  const line2 = decodeCiiNumericRow(rows[base + 1]);
  if (!Array.isArray(line1) || line1.length < 6 || !Array.isArray(line2) || line2.length < 3) return null;
  const first = line1.slice(0, 6).map(Number); const second = line2.slice(0, 3).map(Number);
  if (![...first, ...second].every(Number.isFinite)) return null;
  const tag = prefixedText(rows[base + 2]); const guid = prefixedText(rows[base + 3]);
  if (tag == null || guid == null) return null;
  const occupied = !(Math.abs(first[0]) <= 1e-12 && Math.abs(first[1]) <= 1e-12);
  return deepFreeze({ pointer: Number(pointer), slot: Number(slot), line1: Object.freeze(first), line2: Object.freeze(second), tag, guid, occupied });
}
function cleanEmptySlots(text, pointer) {
  const out = [];
  for (let slot = 1; slot <= SLOTS; slot += 1) {
    const state = slotState(text, pointer, slot);
    if (state && !state.occupied && !state.tag && !state.guid) out.push(state);
  }
  return out;
}
function mappedConnecting(record, mapping) {
  const value = Number(record?.connectingNode || 0);
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) <= 1e-12) return 0;
  const target = Number(mapping.get(String(Math.round(value))));
  return Number.isFinite(target) ? target : null;
}
function proposedRecord(record, targetNode, pointer, slot, mapping) {
  const connectingNode = mappedConnecting(record, mapping);
  if (connectingNode == null) return null;
  return deepFreeze({
    pointer, slot, node: Number(targetNode), typeCode: Number(record.typeCode), stiffness: Number(record.stiffness),
    gap: Number(record.gap), friction: Number(record.friction), connectingNode,
    directionCosines: deepFreeze({ x: Number(record.directionCosines?.x), y: Number(record.directionCosines?.y), z: Number(record.directionCosines?.z) }),
  });
}
function pairingWithoutSource(sourceRecords, targetRecords, mapping, candidate, options) {
  return pairCiiRestraintRecords(sourceRecords.filter((item) => item !== candidate), targetRecords, mapping, options);
}
function pairingWithoutTarget(sourceRecords, targetRecords, mapping, candidate, options) {
  return pairCiiRestraintRecords(sourceRecords, targetRecords.filter((item) => item !== candidate), mapping, options);
}
function uniqueCandidate(candidates) {
  return candidates.length === 1 ? candidates[0] : null;
}
function blockedPlan(mode, blockers, details = {}) {
  return deepFreeze({ schema: 'CIIWorkspaceRestraintSlotMutation.v1', status: 'BLOCKED', mode, blockers: Object.freeze([...new Set(blockers)]), ...details });
}
function createPlan(row, sourceRecords, targetRecords, sourceDocument, targetDocument, sourceText, targetText, mapping, options) {
  const targetPointers = ownerPointers(targetDocument, row.targetNodeId);
  if (targetPointers.length !== 1) return blockedPlan('CREATE', ['RESTRAINT_TARGET_EXISTING_BLOCK_UNIQUE_POINTER_REQUIRED']);
  const pointer = targetPointers[0];
  const emptySlots = cleanEmptySlots(targetText, pointer);
  if (!emptySlots.length) return blockedPlan('CREATE', ['RESTRAINT_TARGET_FREE_SLOT_REQUIRED'], { pointer });
  const candidates = sourceRecords.flatMap((record) => {
    if (!metadataEmpty(record)) return [];
    const pairing = pairingWithoutSource(sourceRecords, targetRecords, mapping, record, options);
    return pairing.status === 'QUALIFIED' ? [{ record, pairing }] : [];
  });
  const selected = uniqueCandidate(candidates);
  if (!selected) return blockedPlan('CREATE', [candidates.length ? 'RESTRAINT_SLOT_CREATE_SOURCE_RECORD_AMBIGUOUS' : 'RESTRAINT_SLOT_CREATE_SOURCE_RECORD_NOT_QUALIFIED'], { pointer });
  const slot = emptySlots[0].slot;
  const proposed = proposedRecord(selected.record, row.targetNodeId, pointer, slot, mapping);
  if (!proposed) return blockedPlan('CREATE', ['RESTRAINT_CONNECTING_NODE_CORRESPONDENCE_REQUIRED'], { pointer, slot });
  return deepFreeze({
    schema: 'CIIWorkspaceRestraintSlotMutation.v1', status: 'QUALIFIED', mode: 'CREATE',
    authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT', blockers: Object.freeze([]), pointer, slot,
    targetNode: String(row.targetNodeId), existingPairs: selected.pairing.pairs,
    beforeSlot: emptySlots[0], proposedSlot: proposed,
    metadataPolicy: 'TARGET_EMPTY_AND_SOURCE_EMPTY_NO_STRING_WRITE',
  });
}
function clearPlan(row, sourceRecords, targetRecords, sourceDocument, targetDocument, sourceText, targetText, mapping, options) {
  const targetPointers = ownerPointers(targetDocument, row.targetNodeId);
  if (targetPointers.length !== 1) return blockedPlan('CLEAR', ['RESTRAINT_TARGET_EXISTING_BLOCK_UNIQUE_POINTER_REQUIRED']);
  const pointer = targetPointers[0];
  const candidates = targetRecords.flatMap((record) => {
    if (!metadataEmpty(record)) return [];
    const pairing = pairingWithoutTarget(sourceRecords, targetRecords, mapping, record, options);
    return pairing.status === 'QUALIFIED' ? [{ record, pairing }] : [];
  });
  const selected = uniqueCandidate(candidates);
  if (!selected) return blockedPlan('CLEAR', [candidates.length ? 'RESTRAINT_SLOT_CLEAR_TARGET_RECORD_AMBIGUOUS' : 'RESTRAINT_SLOT_CLEAR_TARGET_RECORD_NOT_QUALIFIED'], { pointer });
  const beforeSlot = slotState(targetText, pointer, selected.record.slot);
  if (!beforeSlot?.occupied || beforeSlot.tag || beforeSlot.guid) return blockedPlan('CLEAR', ['RESTRAINT_SLOT_CLEAR_METADATA_OR_CUSTODY_INVALID'], { pointer, slot: selected.record.slot });
  let template = cleanEmptySlots(targetText, pointer)[0] || null;
  if (!template) {
    const sourcePointers = ownerPointers(sourceDocument, row.sourceNodeId);
    if (sourcePointers.length === 1) template = cleanEmptySlots(sourceText, sourcePointers[0])[0] || null;
  }
  if (!template) return blockedPlan('CLEAR', ['RESTRAINT_EMPTY_SLOT_NUMERIC_TEMPLATE_REQUIRED'], { pointer, slot: selected.record.slot });
  return deepFreeze({
    schema: 'CIIWorkspaceRestraintSlotMutation.v1', status: 'QUALIFIED', mode: 'CLEAR',
    authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE', blockers: Object.freeze([]), pointer, slot: Number(selected.record.slot),
    targetNode: String(row.targetNodeId), existingPairs: selected.pairing.pairs,
    beforeSlot, proposedSlot: deepFreeze({ line1: template.line1, line2: template.line2 }),
    metadataPolicy: 'TARGET_EMPTY_METADATA_NO_STRING_WRITE',
  });
}
function slotDelta(row, plan) {
  const qualifiedPlan = plan.status === 'QUALIFIED';
  return deepFreeze({
    deltaId: stableId('delta', row.correspondenceId, 'RESTRAINT', 'Qualified restraint slot mutation'),
    correspondenceId: row.correspondenceId, identityKind: row.kind,
    sourceIdentity: row.sourceNodeId, targetIdentity: row.targetNodeId,
    identityConfidence: row.status === 'LOCKED' ? 'LOCKED' : row.status,
    category: 'RESTRAINT', property: 'Qualified restraint slot mutation', sourceValue: plan, targetValue: null, delta: null,
    semanticChange: qualifiedPlan ? `RESTRAINT_SLOT_${plan.mode}` : 'RESTRAINT_SLOT_MUTATION_BLOCKED', changed: true,
    evidenceStatus: qualifiedPlan ? 'QUALIFIED' : 'BLOCKED',
    authority: qualifiedPlan ? `PROTECTED_WRITER_RESTRANT_SLOT_MUTATION:${plan.authority}` : 'RESTRAINT_SLOT_MUTATION_UNRESOLVED',
    limitations: Object.freeze(plan.blockers || []),
  });
}

export function augmentCiiEngineeringDeltasWithRestraintSlots(deltaSet, sourceDocument, targetDocument, correspondence, sourceText, targetText, options = {}) {
  if (!deltaSet || deltaSet.schema !== CII_WORKSPACE_SCHEMAS.engineeringDeltaSet) return deltaSet;
  if (!qualified(sourceDocument) || !qualified(targetDocument)) return deltaSet;
  const rows = [...(deltaSet.rows || [])]; const mapping = nodeMap(correspondence);
  for (const row of transferableRows(correspondence)) {
    const sourceRecords = [...(sourceDocument.auxiliaryEvidence.restraints.byNode?.[String(row.sourceNodeId)] || [])];
    const targetRecords = [...(targetDocument.auxiliaryEvidence.restraints.byNode?.[String(row.targetNodeId)] || [])];
    const difference = sourceRecords.length - targetRecords.length;
    if (difference === 0) continue;
    const plan = difference === 1
      ? createPlan(row, sourceRecords, targetRecords, sourceDocument, targetDocument, sourceText, targetText, mapping, options)
      : difference === -1
        ? clearPlan(row, sourceRecords, targetRecords, sourceDocument, targetDocument, sourceText, targetText, mapping, options)
        : blockedPlan('UNSUPPORTED', ['RESTRAINT_SLOT_MUTATION_EXACTLY_ONE_CARDINALITY_STEP_REQUIRED'], { sourceCount: sourceRecords.length, targetCount: targetRecords.length });
    rows.push(slotDelta(row, plan));
  }
  rows.sort((a, b) => `${a.sourceIdentity}|${a.category}|${a.property}`.localeCompare(`${b.sourceIdentity}|${b.category}|${b.property}`, undefined, { numeric: true }));
  const changedRows = rows.filter((row) => row.changed); const counts = {};
  for (const row of changedRows) counts[row.category] = (counts[row.category] || 0) + 1;
  return deepFreeze({ ...deltaSet, rows: Object.freeze(rows), changedRows: Object.freeze(changedRows), summary: Object.freeze({
    ...deltaSet.summary, comparedPropertyCount: rows.length, engineeringChangeCount: changedRows.length,
    unchangedPropertyCount: rows.length - changedRows.length, changeFamilyCounts: Object.freeze(counts),
  }) });
}

/**
 * Strict, read-only InputXML → CII projection evidence for the topology parity
 * workspace. This module never parses CII bytes, reconstructs topology, or
 * repairs identities. It validates the producer ledger and compares only
 * explicit InputXML, scene, and CII identities.
 */
import { asArray, cleanText, deepFreeze, objectRecord, uniqueText } from './topology-validator-values.js';

const HASH_RE = /^[0-9a-f]{64}$/;
const TARGET_BASES = new Set(['GLOBAL_SECTION', 'ELEMENT_ORDINAL', 'NODE_RECORD_ORDINAL', 'ELEMENT_AUX_POINTER', 'MATERIAL_ELEMENT_ORDINAL']);

function requireText(record, field, owner) {
  const value = cleanText(record[field]);
  if (!value) throw new TypeError(`${owner}.${field} is required.`);
  return value;
}

function requireHash(record, field, owner, nullable = false) {
  const value = record[field];
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const text = cleanText(value);
  if (!HASH_RE.test(text)) throw new TypeError(`${owner}.${field} must be a lowercase SHA-256 hash.`);
  return text;
}

function integer(value, minimum, owner) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new TypeError(`${owner} must be an integer >= ${minimum}.`);
  return parsed;
}

function validateTarget(target, owner) {
  const row = objectRecord(target);
  requireText(row, 'section', owner);
  integer(row.index, 1, `${owner}.index`);
  if (!TARGET_BASES.has(cleanText(row.indexBasis))) throw new TypeError(`${owner}.indexBasis is invalid.`);
  if (row.ownerElementId !== undefined) requireText(row, 'ownerElementId', owner);
  if (row.nodeRole !== undefined && !['FROM', 'TO'].includes(cleanText(row.nodeRole))) throw new TypeError(`${owner}.nodeRole is invalid.`);
  if (row.payloadLine !== undefined) integer(row.payloadLine, 1, `${owner}.payloadLine`);
  if (row.payloadSlot !== undefined) {
    const slot = integer(row.payloadSlot, 1, `${owner}.payloadSlot`);
    if (slot > 6) throw new TypeError(`${owner}.payloadSlot must be <= 6.`);
  }
}

function validateLedger(ledger) {
  if (cleanText(ledger.schema) !== 'InputXmlCiiProjectionLedger.v1') throw new TypeError(`Expected InputXmlCiiProjectionLedger.v1; received ${cleanText(ledger.schema) || '(missing schema)'}.`);
  if (!['PASS', 'BLOCKED'].includes(cleanText(ledger.status))) throw new TypeError('InputXmlCiiProjectionLedger.v1.status must be PASS or BLOCKED.');
  requireHash(objectRecord(ledger.chain), 'canonicalHashSha256', 'InputXmlCiiProjectionLedger.v1.chain');
  requireHash(objectRecord(ledger.chain), 'ciiHashSha256', 'InputXmlCiiProjectionLedger.v1.chain', true);
  requireHash(ledger, 'projectionHashSha256', 'InputXmlCiiProjectionLedger.v1');

  const elementIds = new Set(), elementIndexes = new Set();
  for (const [index, value] of asArray(ledger.elements).entries()) {
    const row = objectRecord(value), owner = `InputXmlCiiProjectionLedger.v1.elements[${index}]`;
    const id = requireText(row, 'inputXmlElementId', owner);
    const elementIndex = integer(row.elementIndex, 1, `${owner}.elementIndex`);
    requireText(row, 'fromNode', owner); requireText(row, 'toNode', owner);
    if (elementIds.has(id)) throw new TypeError(`Duplicate CII projection InputXML element ID: ${id}.`);
    if (elementIndexes.has(elementIndex)) throw new TypeError(`Duplicate CII ELEMENTS index: ${elementIndex}.`);
    elementIds.add(id); elementIndexes.add(elementIndex);
    for (const [key, pointer] of Object.entries(objectRecord(row.pointers))) integer(pointer, 0, `${owner}.pointers.${key}`);
  }

  const projectionIds = new Set();
  for (const [index, value] of asArray(ledger.records).entries()) {
    const row = objectRecord(value), owner = `InputXmlCiiProjectionLedger.v1.records[${index}]`;
    const id = requireText(row, 'projectionRecordId', owner);
    if (!/^IXPL-[0-9]{7}$/.test(id)) throw new TypeError(`${owner}.projectionRecordId is invalid.`);
    if (projectionIds.has(id)) throw new TypeError(`Duplicate CII projection record ID: ${id}.`);
    projectionIds.add(id);
    if (!['PASS', 'EVIDENCE_ONLY', 'BLOCKED'].includes(cleanText(row.status))) throw new TypeError(`${owner}.status is invalid.`);
    for (const [targetIndex, target] of asArray(row.targets).entries()) validateTarget(target, `${owner}.targets[${targetIndex}]`);
  }
}

export function readInputXmlCiiProjectionLedger(value) {
  const ledger = objectRecord(value);
  validateLedger(ledger);
  return deepFreeze(ledger);
}

function inputXmlIds(value) {
  const row = objectRecord(value);
  return uniqueText([row.inputXmlElementId, ...asArray(row.inputXmlElementIds)].map(cleanText).filter(Boolean));
}

function mismatch(id, category, expected, actual, identities = {}) {
  return deepFreeze({
    id, severity: 'ERROR', category,
    canonicalIdentity: identities.canonicalIdentity || '',
    inputXmlIdentity: identities.inputXmlIdentity || '',
    svgIdentity: identities.svgIdentity || '',
    ciiIdentity: identities.ciiIdentity || '',
    expected, actual, sourcePaths: [], status: 'OPEN', recommendedOwnerModule: 'InputXmlCiiProjectionLedger.v1 producer or topology parity companion set',
  });
}

function targetKey(target) {
  const row = objectRecord(target);
  return `cii:${cleanText(row.section)}:${Number(row.index)}`;
}

function ciiElementView(row) {
  const element = objectRecord(row), index = Number(element.elementIndex);
  return deepFreeze({
    ...element,
    id: `CII-ELEMENT-${index}`,
    objectKey: `cii:ELEMENTS:${index}`,
    section: 'ELEMENTS',
    ciiIndex: index,
    ciiIdentity: `ELEMENTS:${index}`,
    linkedObjectKeys: Object.freeze([`inputxml:edge:${cleanText(element.inputXmlElementId)}`]),
  });
}

function ciiRecordView(row) {
  const record = objectRecord(row);
  const links = [
    ...asArray(record.inputXmlElementIds).map((id) => `inputxml:edge:${cleanText(id)}`),
    ...asArray(record.targets).map(targetKey),
  ];
  return deepFreeze({
    ...record,
    id: cleanText(record.projectionRecordId),
    objectKey: `cii:projection:${cleanText(record.projectionRecordId)}`,
    linkedObjectKeys: Object.freeze(uniqueText(links)),
  });
}

export function buildCiiSvgIdentityParity(input = {}) {
  const projection = input.projection ? objectRecord(input.projection) : null;
  if (!projection) return deepFreeze({ status: 'NOT_RUN', ok: false, mismatches: [], elements: [], records: [], summary: { ciiElementCount: 0, projectionRecordCount: 0, ciiIdentityMismatchCount: 0, unownedCiiTargetCount: 0 } });
  const parsed = objectRecord(input.parsed), scene = objectRecord(input.scene);
  const projectionElements = asArray(projection.elements).map(objectRecord);
  const parsedElements = asArray(parsed.elements).map(objectRecord);
  const sceneEdges = asArray(scene.edges).map(objectRecord);
  const projectionById = new Map(projectionElements.map((row) => [cleanText(row.inputXmlElementId), row]));
  const parsedById = new Map(parsedElements.map((row) => [cleanText(row.id), row]));
  const mismatches = [];
  let mismatchIndex = 1;
  const add = (category, expected, actual, identities) => mismatches.push(mismatch(`CII-SVG-${String(mismatchIndex++).padStart(5, '0')}`, category, expected, actual, identities));

  if (cleanText(projection.status) !== 'PASS') add('CII_PROJECTION_LEDGER_BLOCKED', 'PASS', projection.status || '(missing)', {});

  for (const row of parsedElements) {
    const id = cleanText(row.id);
    if (id && !projectionById.has(id)) add('INPUTXML_ELEMENT_MISSING_CII_PROJECTION', 'CII ELEMENTS owner', 'missing', { inputXmlIdentity: id, canonicalIdentity: cleanText(row.canonicalEdgeId) });
  }
  for (const row of projectionElements) {
    const id = cleanText(row.inputXmlElementId);
    if (id && !parsedById.has(id)) add('CII_PROJECTION_ORPHAN_INPUTXML_ELEMENT', 'ParsedInputXmlTopology.v1 element', 'missing', { inputXmlIdentity: id, ciiIdentity: `ELEMENTS:${row.elementIndex}` });
  }
  for (const edge of sceneEdges) {
    const ids = inputXmlIds(edge);
    for (const id of ids) if (!projectionById.has(id)) add('SVG_EDGE_WITHOUT_CII_OWNER', 'CII ELEMENTS owner', 'missing', { inputXmlIdentity: id, canonicalIdentity: cleanText(edge.canonicalEdgeId), svgIdentity: cleanText(edge.id || edge.canonicalEdgeId) });
  }

  let unownedTargets = 0;
  for (const record of asArray(projection.records).map(objectRecord)) {
    for (const id of asArray(record.inputXmlElementIds).map(cleanText).filter(Boolean)) {
      if (!projectionById.has(id)) add('PROJECTION_RECORD_UNKNOWN_INPUTXML_ELEMENT', 'Projection element entry', 'missing', { inputXmlIdentity: id, ciiIdentity: cleanText(record.projectionRecordId) });
    }
    for (const target of asArray(record.targets).map(objectRecord)) {
      const ownerId = cleanText(target.ownerElementId);
      if (ownerId && !projectionById.has(ownerId)) {
        unownedTargets += 1;
        add('UNOWNED_CII_TARGET', 'Known InputXML ownerElementId', ownerId, { inputXmlIdentity: ownerId, ciiIdentity: `${target.section}:${target.index}` });
      }
    }
  }

  const elements = projectionElements.map(ciiElementView);
  const records = asArray(projection.records).map(objectRecord).map(ciiRecordView);
  const ok = mismatches.length === 0;
  return deepFreeze({
    schema: 'CiiSvgIdentityParity.v1', status: ok ? 'PASS' : 'FAIL', ok,
    projectionHashSha256: cleanText(projection.projectionHashSha256), ciiHashSha256: cleanText(objectRecord(projection.chain).ciiHashSha256),
    mismatches, elements, records,
    summary: {
      ciiElementCount: elements.length,
      projectionRecordCount: records.length,
      ciiIdentityMismatchCount: mismatches.length,
      unownedCiiTargetCount: unownedTargets,
    },
  });
}

export const _test = Object.freeze({ requireText, requireHash, integer, validateTarget, validateLedger, inputXmlIds, targetKey, ciiElementView, ciiRecordView });

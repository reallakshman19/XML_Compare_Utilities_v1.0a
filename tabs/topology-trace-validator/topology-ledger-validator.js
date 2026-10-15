/**
 * Functionality: validates trace-ledger record completeness and disposition
 * semantics without rebuilding topology. Inputs are normalized ledger records
 * and a finding callback. Output is void. Fallback: incomplete or unexplained
 * records become explicit findings and are never repaired or inferred.
 */

import { PROJECTION_CARDINALITIES, asArray, cleanText, objectRecord, uniqueText } from './topology-validator-values.js';

const REQUIRED_OUTPUTS = Object.freeze({
  EMIT_ROUTE_EDGE: ['canonicalEdgeIds', 1],
  EMIT_INLINE_COMPONENT_EDGE: ['canonicalEdgeIds', 1],
  EMIT_BEND_EDGE_SET: ['canonicalEdgeIds', 1],
  EMIT_POINT_FEATURE: ['pointFeatureIds', 1],
  EMIT_TEE_JUNCTION: ['junctionIds', 1],
  EMIT_OLET_JUNCTION: ['junctionIds', 1],
  SPLIT_HEADER_AT_JUNCTION: ['affectedEdgeIds', 2],
  EXTERNAL_BOUNDARY: ['boundaryIds', 1],
});

const REQUIRED_LEDGER_FIELDS = Object.freeze([
  'sourceEntityId', 'sourcePath', 'sourceType', 'sourceRef', 'primaryDisposition',
  'canonicalNodeIds', 'canonicalEdgeIds', 'pointFeatureIds', 'junctionIds',
  'affectedSourceEntityIds', 'inputXmlElementIds', 'projectionCardinality',
  'deferredProperties', 'lossClassification', 'status',
]);

/** @param {Record<string, unknown>} record @returns {string} */
function mergeTarget(record) {
  return [...uniqueText(asArray(record.inputXmlElementIds))].sort().join('|');
}

/** @param {Record<string, unknown>} record @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {void} */
function validateRecordCompleteness(record, addFinding) {
  const label = cleanText(record.recordId) || cleanText(record.viewKey);
  const context = { sourcePath: cleanText(record.sourcePath), sourceEntityIds: [cleanText(record.sourceEntityId)] };
  if (!cleanText(record.recordId)) addFinding('LEDGER_RECORD_ID_MISSING', `${label} has no stable ledger record ID.`, context);
  for (const field of REQUIRED_LEDGER_FIELDS) if (objectRecord(record.declaredFields)[field] !== true) addFinding('LEDGER_CONTRACT_FIELD_MISSING', `${label} does not declare required field ${field}.`, { ...context, details: { field } });
  if (!cleanText(record.sourcePath)) addFinding('LEDGER_SOURCE_PATH_MISSING', `${label} has no source path.`, context);
  if (!cleanText(record.sourceType)) addFinding('LEDGER_SOURCE_TYPE_MISSING', `${label} has no retained source type.`, context);
  if (!cleanText(record.operation)) addFinding('LEDGER_OPERATION_MISSING', `${label} has no topology/projection operation.`, context);
  if (!cleanText(record.status)) addFinding('LEDGER_STATUS_MISSING', `${label} has no warning/error status.`, context);
  if (!cleanText(record.classification)) addFinding('LEDGER_CLASSIFICATION_MISSING', `${label} has no loss/deferred classification.`, context);
  if (!Object.keys(objectRecord(record.evidence)).length) addFinding('LEDGER_EVIDENCE_MISSING', `${label} has no machine-verifiable decision evidence.`, context);
  if (!PROJECTION_CARDINALITIES.includes(cleanText(record.projectionCardinality))) addFinding('PROJECTION_CARDINALITY_INVALID', `${label} projection cardinality ${record.projectionCardinality || '(empty)'} is not allowed.`, context);
}

/** @param {Record<string, unknown>} record @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {void} */
function validateDispositionOutput(record, addFinding) {
  const disposition = cleanText(record.disposition), required = REQUIRED_OUTPUTS[disposition];
  const label = cleanText(record.recordId) || cleanText(record.viewKey);
  const context = { sourcePath: cleanText(record.sourcePath), sourceEntityIds: [cleanText(record.sourceEntityId)] };
  if (required && uniqueText(asArray(record[required[0]])).length < required[1]) {
    const code = disposition === 'SPLIT_HEADER_AT_JUNCTION' ? 'UNEXPLAINED_SPLIT' : 'DISPOSITION_OUTPUT_MISSING';
    addFinding(code, `${label} disposition ${disposition} requires at least ${required[1]} ${required[0]}.`, context);
  }
  const edgeCount = uniqueText([...asArray(record.canonicalEdgeIds), ...asArray(record.affectedEdgeIds)]).length;
  const cardinality = cleanText(record.projectionCardinality);
  if (edgeCount > 1 && cardinality !== 'ONE_TO_MANY') addFinding('UNEXPLAINED_ONE_TO_MANY', `${label} references ${edgeCount} canonical edges without ONE_TO_MANY cardinality.`, context);
  if (cardinality === 'ONE_TO_MANY' && edgeCount < 2) addFinding('UNEXPLAINED_ONE_TO_MANY', `${label} declares ONE_TO_MANY but references fewer than two canonical edges.`, context);
  if (disposition === 'MERGE_IN_CII_PROJECTION' && cardinality !== 'MANY_TO_ONE') addFinding('UNEXPLAINED_MERGE', `${label} merge disposition must declare MANY_TO_ONE cardinality.`, context);
  if (disposition === 'SPLIT_HEADER_AT_JUNCTION' && !asArray(record.junctionIds).length) addFinding('SPLIT_JUNCTION_MISSING', `${label} header split has no canonical junction.`, context);
  if (disposition === 'BLOCK_AMBIGUOUS') addFinding('AMBIGUOUS_MATCH', `${label} is blocked by an ambiguous topology decision.`, context);
}

/** @param {Record<string, unknown>[]} records @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {void} */
function validateMerges(records, addFinding) {
  const mergeRecords = records.filter((record) => cleanText(record.disposition) === 'MERGE_IN_CII_PROJECTION' || cleanText(record.projectionCardinality) === 'MANY_TO_ONE');
  for (const record of mergeRecords) {
    const target = mergeTarget(record);
    const participants = uniqueText(mergeRecords.filter((candidate) => target && mergeTarget(candidate) === target).map((candidate) => candidate.sourceEntityId));
    if (participants.length >= 2) continue;
    addFinding('UNEXPLAINED_MERGE', `${record.recordId || record.viewKey} merge has ${participants.length} source participant; expected at least two.`, {
      sourcePath: cleanText(record.sourcePath), sourceEntityIds: [cleanText(record.sourceEntityId)],
    });
  }
}

/** @param {Record<string, unknown>} ledger @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {void} */
export function validateLedgerSemantics(ledger, addFinding) {
  const records = asArray(ledger.records).map(objectRecord), seenIds = new Set();
  for (const record of records) {
    const recordId = cleanText(record.recordId);
    if (recordId && seenIds.has(recordId)) addFinding('LEDGER_RECORD_ID_DUPLICATE', `Ledger record ID ${recordId} is duplicated.`, { sourcePath: cleanText(record.sourcePath) });
    if (recordId) seenIds.add(recordId);
    validateRecordCompleteness(record, addFinding);
    validateDispositionOutput(record, addFinding);
  }
  validateMerges(records, addFinding);
}

export const _test = Object.freeze({ mergeTarget, validateDispositionOutput, validateMerges });

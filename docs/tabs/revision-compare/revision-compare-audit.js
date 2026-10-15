/** Immutable RevisionCompareAudit.v1 assembly and reconciliation. */
import { assertJsonSafe, deepFreeze, deterministicId } from './revision-contract-utils.js';

export const REVISION_COMPARE_AUDIT_SCHEMA = 'RevisionCompareAudit.v1';
function primitiveCollections(records) {
  const segments = []; const markers = [];
  for (const record of records) {
    const primitive = record.visualPrimitive; if (!primitive) continue;
    if (primitive.kind === 'SEGMENT') segments.push(deepFreeze({ primitiveId: `segment:${primitive.objectId}`, objectId: primitive.objectId, start: primitive.start, end: primitive.end }));
    else markers.push(deepFreeze({ primitiveId: `marker:${primitive.objectId}`, objectId: primitive.objectId, position: primitive.position, kind: 'NODE' }));
  }
  return { segments: Object.freeze(segments), markers: Object.freeze(markers) };
}
function boundsOf(records) {
  const points = records.flatMap((record) => record.geometry?.points ?? []);
  if (!points.length) return deepFreeze({ min: [0, 0, 0], max: [1, 1, 1] });
  return deepFreeze({
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  });
}
function visualModel(side, projection, basis) {
  const primitives = primitiveCollections(projection.records); const revisionKey = side === 'A' ? 'revA' : 'revB';
  return deepFreeze({
    contract: 'VisualGeometryModel.v2', schema: 'VisualGeometryModel.v2',
    modelId: `revision-compare:${basis.basisId}:${side}`,
    documentId: projection.sourceDocumentId, revisionId: `${basis.basisId}:${side}`,
    unit: basis.unitCompatibility[revisionKey], coordinateFrame: basis.coordinateFrameCompatibility[revisionKey],
    verticalAxis: basis.verticalAxisCompatibility[revisionKey], origin: [0, 0, 0],
    segments: primitives.segments, markers: primitives.markers, bounds: boundsOf(projection.records),
  });
}
function statusFor(row) {
  if (row.matchCertainty === 'AMBIGUOUS') return 'AMBIGUOUS';
  if (row.differenceCategory === 'ADDED') return 'NEW_IN_TARGET';
  if (row.differenceCategory === 'REMOVED') return 'MISSING_IN_TARGET';
  if (row.changeReasons.includes('GEOMETRY')) return 'GEOMETRY_CHANGED';
  if (row.differenceCategory === 'CHANGED') return 'PROPERTY_CHANGED';
  return 'MATCHED_UNCHANGED';
}
function statusMap(rows) {
  const output = {};
  for (const row of rows) {
    if (row.visualRefs.sourceObjectId) output[row.visualRefs.sourceObjectId] = statusFor(row);
    if (row.visualRefs.targetObjectId) output[row.visualRefs.targetObjectId] = statusFor(row);
  }
  return deepFreeze(output);
}
function summary(rows) {
  const count = (category) => rows.filter((row) => row.differenceCategory === category).length;
  return deepFreeze({
    unchanged: count('UNCHANGED'), changed: count('CHANGED'), added: count('ADDED'), removed: count('REMOVED'),
    needsDecision: rows.filter((row) => row.matchCertainty === 'AMBIGUOUS').length,
    exact: rows.filter((row) => row.matchCertainty === 'EXACT').length,
    inferred: rows.filter((row) => row.matchCertainty === 'INFERRED').length,
  });
}
function exactRecordErrors(records, rowIds, label) {
  const expected = new Set(records.map((record) => record.recordId)); const actual = new Set(rowIds); const errors = [];
  for (const id of actual) if (!expected.has(id)) errors.push(`${label} row references unknown record ${id}.`);
  for (const id of expected) if (!actual.has(id)) errors.push(`${label} record ${id} is not accounted for.`);
  return errors;
}
function validateAccounting(aRecords, bRecords, rows) {
  const sourceIds = rows.map((row) => row.sourceRecordId).filter(Boolean);
  const targetIds = rows.map((row) => row.targetRecordId).filter(Boolean); const errors = [];
  if (new Set(sourceIds).size !== sourceIds.length) errors.push('A source record appears in more than one final row.');
  if (new Set(targetIds).size !== targetIds.length) errors.push('A target record appears in more than one final row.');
  errors.push(...exactRecordErrors(aRecords, sourceIds, 'Rev A'));
  errors.push(...exactRecordErrors(bRecords, targetIds, 'Rev B'));
  return errors;
}
function validateReferences(rows, candidateEvidence, visualModels) {
  const errors = []; const evidenceIds = new Set(candidateEvidence.map((item) => item.candidateEvidenceId));
  const visualIds = new Set([...visualModels.revA.segments, ...visualModels.revA.markers, ...visualModels.revB.segments, ...visualModels.revB.markers].map((item) => item.objectId));
  for (const row of rows) {
    if (row.matchCertainty === 'AMBIGUOUS' && row.targetRecordId) errors.push(`${row.differenceId} ambiguous row claims a target.`);
    if (row.candidateEvidenceId && !evidenceIds.has(row.candidateEvidenceId)) errors.push(`${row.differenceId} candidate evidence is missing.`);
    for (const value of Object.values(row.visualRefs)) if (value && !visualIds.has(value)) errors.push(`${row.differenceId} visual reference is missing.`);
  }
  return errors;
}
export function validateRevisionCompareAudit(audit, projections) {
  const errors = [];
  if (audit?.schema !== REVISION_COMPARE_AUDIT_SCHEMA) errors.push(`schema must be ${REVISION_COMPARE_AUDIT_SCHEMA}`);
  errors.push(...validateAccounting(projections.revA.records, projections.revB.records, audit.differenceRows));
  errors.push(...validateReferences(audit.differenceRows, audit.candidateEvidence, audit.visualModels));
  const visibleTotal = audit.summary.unchanged + audit.summary.changed + audit.summary.added + audit.summary.removed;
  if (visibleTotal !== audit.differenceRows.length) errors.push('Summary categories do not reconcile with rows.');
  return Object.freeze(errors);
}
function identityPayload(input, rows, evidence, models) {
  return {
    schema: REVISION_COMPARE_AUDIT_SCHEMA, basisId: input.basis.basisId,
    revADocumentId: input.revA.sourceDocumentId, revBDocumentId: input.revB.sourceDocumentId,
    engineVersion: input.configuration.engineVersion, configuration: input.configuration,
    summary: summary(rows), differenceRows: rows, candidateEvidence: evidence,
    visualModels: models, visualReadiness: input.visualReadiness, warnings: input.warnings ?? [],
  };
}
export async function createRevisionCompareAudit(input, rows, candidateEvidence, performanceReceipt, cryptoRef) {
  const models = deepFreeze({ revA: visualModel('A', input.revA, input.basis), revB: visualModel('B', input.revB, input.basis), statusByObjectId: statusMap(rows) });
  const identity = identityPayload(input, rows, candidateEvidence, models);
  const draft = deepFreeze({ ...identity, auditId: await deterministicId('revision-audit', identity, cryptoRef), performanceReceipt, validation: { status: 'PENDING', errors: [] } });
  const errors = validateRevisionCompareAudit(draft, { revA: input.revA, revB: input.revB });
  const audit = deepFreeze({ ...draft, validation: deepFreeze({ status: errors.length ? 'INVALID' : 'READY', errors }) });
  if (errors.length) throw new TypeError(`Invalid RevisionCompareAudit: ${errors.join('; ')}`);
  assertJsonSafe(audit, REVISION_COMPARE_AUDIT_SCHEMA); return audit;
}

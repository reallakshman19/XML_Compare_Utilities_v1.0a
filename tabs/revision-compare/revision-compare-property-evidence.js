import {
  createEngineeringPropertyField,
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
} from '../../core/engineering-scene/index.js';
import { createEngineeringSvgPropertyProvider } from '../../core/engineering-svg/engineering-svg-property-provider.js';

export const REVISION_COMPARE_PROPERTY_EVIDENCE_SCHEMA = 'RevisionComparePropertyEvidence.v1';

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required.`);
  return value;
}

function auditIdentity(audit) {
  return Object.freeze({
    auditId: requiredText(audit?.auditId, 'Audit ID'),
    basisId: requiredText(audit?.basisId, 'Audit basis ID'),
    revADocumentId: requiredText(audit?.revADocumentId, 'Rev A document ID'),
    revBDocumentId: requiredText(audit?.revBDocumentId, 'Rev B document ID'),
    engineVersion: requiredText(audit?.engineVersion, 'Audit engine version'),
  });
}

function revisionIdentity(value) {
  return JSON.stringify({
    auditId: value?.auditId,
    basisId: value?.basisId,
    revADocumentId: value?.revADocumentId,
    revBDocumentId: value?.revBDocumentId,
    engineVersion: value?.engineVersion,
  });
}

export function revisionComparePropertyAuditIdentity(audit) {
  return auditIdentity(audit);
}

export function revisionComparePropertyAuditKey(audit) {
  return revisionIdentity(auditIdentity(audit));
}

function valueKind(value) {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'non-finite-number';
  if (typeof value === 'string') return 'text';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function unsupportedReason(previousKind, currentKind) {
  if (previousKind === 'null' && currentKind === 'null') return 'BOTH_VALUES_NULL';
  if (previousKind === 'non-finite-number' || currentKind === 'non-finite-number') return 'NON_FINITE_NUMBER';
  const unsupported = new Set(['array', 'object', 'undefined', 'bigint', 'symbol', 'function']);
  if (unsupported.has(previousKind) || unsupported.has(currentKind)) return 'UNSUPPORTED_VALUE_TYPE';
  return 'MISMATCHED_NON_NULL_SCALAR_TYPES';
}

function pairType(previousValue, currentValue) {
  const previousKind = valueKind(previousValue);
  const currentKind = valueKind(currentValue);
  if (previousKind === 'null' && ['number', 'text', 'boolean'].includes(currentKind)) return currentKind;
  if (currentKind === 'null' && ['number', 'text', 'boolean'].includes(previousKind)) return previousKind;
  if (previousKind === currentKind && ['number', 'text', 'boolean'].includes(previousKind)) return previousKind;
  return null;
}

function rawEvidence(property, reason) {
  return Object.freeze({
    propertyKey: property?.propertyKey,
    revAValue: property?.revAValue,
    revBValue: property?.revBValue,
    revAEvidencePath: property?.revAEvidencePath,
    revBEvidencePath: property?.revBEvidencePath,
    normalizationRule: property?.normalizationRule ?? null,
    reason,
  });
}

function validEvidencePath(value) {
  return value === null || typeof value === 'string';
}

function hasValidEvidencePaths(property) {
  return validEvidencePath(property?.revAEvidencePath)
    && validEvidencePath(property?.revBEvidencePath);
}

export function classifyRevisionChangedProperty(property) {
  const propertyKey = property?.propertyKey;
  if (typeof propertyKey !== 'string' || !propertyKey || propertyKey.trim() !== propertyKey) {
    return Object.freeze({ supported: false, fallback: rawEvidence(property, 'INVALID_PROPERTY_KEY') });
  }
  if (!hasValidEvidencePaths(property)) {
    return Object.freeze({ supported: false, fallback: rawEvidence(property, 'INVALID_EVIDENCE_PATH') });
  }
  const type = pairType(property.revAValue, property.revBValue);
  if (!type) {
    return Object.freeze({
      supported: false,
      fallback: rawEvidence(property, unsupportedReason(valueKind(property.revAValue), valueKind(property.revBValue))),
    });
  }
  const field = createEngineeringPropertyField({
    key: propertyKey,
    label: propertyKey,
    type,
    previousValue: property.revAValue,
    value: property.revBValue,
    previousSource: property.revAEvidencePath,
    source: property.revBEvidencePath,
    editable: false,
  });
  return Object.freeze({ supported: true, field });
}

function rowIndex(audit) {
  if (!Array.isArray(audit?.differenceRows)) throw new TypeError('Revision Compare audit difference rows are required.');
  const index = new Map();
  audit.differenceRows.forEach((row) => {
    const differenceId = requiredText(row?.differenceId, 'Difference ID');
    if (index.has(differenceId)) throw new TypeError(`Duplicate difference ID "${differenceId}".`);
    if (!Array.isArray(row.changedProperties)) throw new TypeError(`Difference "${differenceId}" changedProperties must be an array.`);
    index.set(differenceId, row);
  });
  return index;
}

function classificationFor(row) {
  const classified = row.changedProperties.map(classifyRevisionChangedProperty);
  return Object.freeze({
    supported: Object.freeze(classified.filter((item) => item.supported).map((item) => item.field)),
    fallback: Object.freeze(classified.filter((item) => !item.supported).map((item) => item.fallback)),
    allRaw: Object.freeze(row.changedProperties.map((property, index) => rawEvidence(
      property,
      classified[index].supported ? 'SHARED_SCALAR_PAIR' : classified[index].fallback.reason,
    ))),
  });
}

export function rawRevisionDifferenceEvidence(audit, differenceId) {
  const id = String(differenceId ?? '').trim();
  if (!id || !Array.isArray(audit?.differenceRows)) return Object.freeze([]);
  const row = audit.differenceRows.find((entry) => entry?.differenceId === id);
  if (!row || !Array.isArray(row.changedProperties)) return Object.freeze([]);
  return classificationFor(row).allRaw;
}

function propertySet(differenceId, revision, fields) {
  return createEngineeringPropertySet({
    id: `revision-compare-properties:${differenceId}`,
    revision,
    ownerIds: [differenceId],
    fields,
    metadata: { source: 'RevisionDifferenceRow.v1.changedProperties' },
  });
}

export function createRevisionComparePropertyEvidence(audit) {
  const identity = auditIdentity(audit);
  const revision = createEngineeringRevisionToken(identity);
  const expectedRevision = revisionIdentity(identity);
  const rows = rowIndex(audit);
  const classifications = new Map();
  const rowFor = (differenceId) => {
    const row = rows.get(String(differenceId));
    if (!row) throw new TypeError(`Unknown Revision Compare difference ID "${differenceId}".`);
    return row;
  };
  const classification = (differenceId) => {
    const id = String(differenceId);
    if (!classifications.has(id)) classifications.set(id, classificationFor(rowFor(id)));
    return classifications.get(id);
  };
  const provider = createEngineeringSvgPropertyProvider({
    async getPropertySets(request) {
      if (revisionIdentity(request.revision.value) !== expectedRevision) {
        throw new TypeError('Revision Compare property request uses a stale audit revision token.');
      }
      return request.selectedIds.flatMap((differenceId) => {
        const fields = classification(differenceId).supported;
        return fields.length ? [propertySet(differenceId, revision, fields)] : [];
      });
    },
  });
  return Object.freeze({
    schema: REVISION_COMPARE_PROPERTY_EVIDENCE_SCHEMA,
    revision,
    provider,
    row: rowFor,
    fallback: (differenceId) => classification(differenceId).fallback,
    rawAuditEvidence: (differenceId) => classification(differenceId).allRaw,
    supportedCount: (differenceId) => classification(differenceId).supported.length,
    evidence: () => Object.freeze({
      auditIdentity: identity,
      differenceRowCount: rows.size,
      indexedLookup: true,
      sourceDocumentLookups: 0,
      comparisonReruns: 0,
    }),
  });
}

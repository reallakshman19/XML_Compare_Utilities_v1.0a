import { contentFingerprint } from '../categorized-inputxml-api/categorized-inputxml-api-contracts.js';

export const INPUTXML_CHANGESET_SERVICE_VERSION = '1.0.0';
export const INPUTXML_CHANGESET_SCHEMA = 'InputXmlChangeSet.v1';
export const INPUTXML_CHANGE_SCHEMA = 'InputXmlChange.v1';
export const INPUTXML_CHANGE_CONFLICT_SCHEMA = 'InputXmlChangeConflict.v1';
export const INPUTXML_CHANGESET_DERIVE_RESULT_SCHEMA = 'InputXmlChangeSetDeriveResult.v1';
export const INPUTXML_CHANGESET_VALIDATION_SCHEMA = 'InputXmlChangeSetValidationResult.v1';
export const INPUTXML_CHANGESET_APPLY_RESULT_SCHEMA = 'InputXmlChangeSetApplyResult.v1';
export const INPUTXML_CHANGESET_CAPABILITIES_SCHEMA = 'InputXmlChangeSetCapabilities.v1';

export const RECONCILABLE_FIELDS = Object.freeze({
  LINE_ID: Object.freeze({ risk: 'line-identity', allowAdd: true }),
  FROM_NAME: Object.freeze({ risk: 'standard', allowAdd: true }),
  TO_NAME: Object.freeze({ risk: 'standard', allowAdd: true }),
  NAME: Object.freeze({ risk: 'standard', allowAdd: false }),
  DELTA_X: Object.freeze({ risk: 'geometry', allowAdd: true }),
  DELTA_Y: Object.freeze({ risk: 'geometry', allowAdd: true }),
  DELTA_Z: Object.freeze({ risk: 'geometry', allowAdd: true }),
  DIAMETER: Object.freeze({ risk: 'section', allowAdd: true }),
  WALL_THICK: Object.freeze({ risk: 'section', allowAdd: true }),
  INSUL_THICK: Object.freeze({ risk: 'section', allowAdd: true }),
});

const clean = (value) => String(value ?? '').trim();

export function stableId(prefix = 'id', parts = []) {
  const text = parts.map((part) => String(part ?? '')).join('\u001f');
  const left = contentFingerprint(`left:${text}`).slice(-8);
  const right = contentFingerprint(`right:${text}`).slice(-8);
  return `${prefix}-${left}${right}`;
}

export function normalizeApprovalIds(values = []) {
  return Object.freeze([...new Set((values || []).map(clean).filter(Boolean))].sort());
}

export function normalizeDeriveRequest(request = {}) {
  const source = request.source || {};
  const content = String(source.content ?? request.content ?? '');
  const filename = clean(source.filename || request.filename || 'categorized.xml');
  return Object.freeze({
    requestId: clean(request.requestId) || stableId('derive', [filename, contentFingerprint(content)]),
    source: Object.freeze({ filename, content, fingerprint: contentFingerprint(content) }),
  });
}

export function normalizeApplyRequest(request = {}) {
  const source = request.source || {};
  const content = String(source.content ?? request.content ?? '');
  const filename = clean(source.filename || request.filename || 'categorized.xml');
  return Object.freeze({
    requestId: clean(request.requestId) || stableId('apply', [filename, contentFingerprint(content)]),
    source: Object.freeze({ filename, content, fingerprint: contentFingerprint(content) }),
    changeSet: request.changeSet || null,
    approvedChangeIds: normalizeApprovalIds(request.approvedChangeIds),
  });
}

export function createCapabilities() {
  return Object.freeze({
    schema: INPUTXML_CHANGESET_CAPABILITIES_SCHEMA,
    serviceVersion: INPUTXML_CHANGESET_SERVICE_VERSION,
    operations: Object.freeze(['derive', 'validateChangeSet', 'apply']),
    supportedFields: Object.freeze(Object.keys(RECONCILABLE_FIELDS)),
    approval: Object.freeze({ explicitIdsRequired: true, automaticApproval: false }),
    outputArtifacts: Object.freeze(['reconciled-categorized-xml', 'reconciled-inputxml', 'application-receipt']),
    unsupported: Object.freeze([
      'node-renumbering', 'restraint-reconciliation', 'sif-reconciliation',
      'displacement-reconciliation', 'force-moment-reconciliation', 'cii-conversion',
    ]),
  });
}

export function changeSetSummary(changes = [], conflicts = []) {
  return Object.freeze({
    proposed: changes.filter((item) => item.status === 'proposed').length,
    additions: changes.filter((item) => item.operation === 'add').length,
    replacements: changes.filter((item) => item.operation === 'replace').length,
    conflicts: conflicts.length,
    blockingConflicts: conflicts.filter((item) => item.blocking).length,
  });
}

export function isSupportedField(field = '') {
  return Object.hasOwn(RECONCILABLE_FIELDS, clean(field));
}

export const _test = Object.freeze({ clean });

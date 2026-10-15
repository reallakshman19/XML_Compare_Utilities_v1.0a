/** ExportPlan is the serializable authority shared by inspectors and writers. */

import { immutableJson, isIsoTimestamp, requiredContractText } from './contract-values.js';

export const EXPORT_PLAN_SCHEMA = 'ExportPlan.v1';
export const EXPORT_GATE_STATUSES = Object.freeze(['READY', 'BLOCKED']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function normalizeFile(file, index) {
  if (!file || typeof file !== 'object') throw new TypeError(`Export file ${index + 1} is required.`);
  return Object.freeze({
    fileId: requiredContractText(file.fileId, `Export file ${index + 1} fileId`),
    name: requiredContractText(file.name, `Export file ${index + 1} name`),
    mime: requiredContractText(file.mime, `Export file ${index + 1} mime`),
    role: requiredContractText(file.role, `Export file ${index + 1} role`),
    sourceSchema: requiredContractText(file.sourceSchema, `Export file ${index + 1} sourceSchema`),
    contentHash: requiredContractText(file.contentHash, `Export file ${index + 1} contentHash`).toLowerCase(),
    byteLength: Number(file.byteLength), order: Number(file.order),
  });
}

function normalizeGate(value) {
  const source = value && typeof value === 'object' ? value : {};
  const blockers = Array.isArray(source.blockers) ? source.blockers.map(String) : [];
  return Object.freeze({ status: requiredContractText(source.status, 'Export gate status').toUpperCase(), blockers: Object.freeze(blockers) });
}

/** Validate an ExportPlan without reading output bytes. */
export function validateExportPlan(plan) {
  const errors = [];
  if (plan?.schema !== EXPORT_PLAN_SCHEMA) errors.push(`schema must be ${EXPORT_PLAN_SCHEMA}`);
  for (const key of ['planId', 'sessionId', 'documentId', 'writerId']) if (!String(plan?.[key] ?? '').trim()) errors.push(`${key} is required`);
  if (!isIsoTimestamp(plan?.createdAt)) errors.push('createdAt must be an exact ISO timestamp');
  if (!Array.isArray(plan?.files) || !plan.files.length) errors.push('files must contain at least one output');
  const fileIds = new Set();
  for (const file of plan?.files ?? []) {
    if (fileIds.has(file.fileId)) errors.push(`duplicate fileId ${file.fileId}`); else fileIds.add(file.fileId);
    if (!SHA256_PATTERN.test(file.contentHash)) errors.push(`${file.fileId} contentHash must be SHA-256`);
    if (!Number.isInteger(file.byteLength) || file.byteLength < 0) errors.push(`${file.fileId} byteLength must be a non-negative integer`);
    if (!Number.isInteger(file.order) || file.order < 0) errors.push(`${file.fileId} order must be a non-negative integer`);
  }
  if (!EXPORT_GATE_STATUSES.includes(plan?.gate?.status)) errors.push(`gate.status must be ${EXPORT_GATE_STATUSES.join(' or ')}`);
  if (plan?.gate?.status === 'READY' && plan.gate.blockers.length) errors.push('READY export gate cannot contain blockers');
  if (plan?.gate?.status === 'BLOCKED' && !plan.gate.blockers.length) errors.push('BLOCKED export gate requires blockers');
  try { immutableJson(plan?.hierarchy, 'Export hierarchy'); } catch (error) { errors.push(error.message); }
  try { immutableJson(plan?.calculations, 'Export calculations'); } catch (error) { errors.push(error.message); }
  return Object.freeze(errors);
}

/** Create an immutable export authority containing metadata, never output bytes. */
export function createExportPlan(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Export plan input is required.');
  if (!Array.isArray(input.files)) throw new TypeError('Export plan files must be an array.');
  const plan = Object.freeze({
    schema: EXPORT_PLAN_SCHEMA, planId: requiredContractText(input.planId, 'planId'),
    sessionId: requiredContractText(input.sessionId, 'sessionId'),
    documentId: requiredContractText(input.documentId, 'documentId'),
    writerId: requiredContractText(input.writerId, 'writerId'), createdAt: requiredContractText(input.createdAt, 'createdAt'),
    hierarchy: immutableJson(input.hierarchy, 'Export hierarchy'),
    calculations: immutableJson(input.calculations, 'Export calculations'),
    files: Object.freeze(input.files.map(normalizeFile)), gate: normalizeGate(input.gate),
  });
  const errors = validateExportPlan(plan);
  if (errors.length) throw new TypeError(`Invalid ExportPlan: ${errors.join('; ')}`);
  return plan;
}

/** Deterministically serialize the plan for inspection or persistence. */
export function serializeExportPlan(plan) {
  const errors = validateExportPlan(plan);
  if (errors.length) throw new TypeError(`Cannot serialize ExportPlan: ${errors.join('; ')}`);
  return `${JSON.stringify(plan, null, 2)}\n`;
}

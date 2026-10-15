import { stableHash } from './contracts/phase2-validation-transfer-orchestrator.js';

export const XML_COMPARE_TRANSFER_PROOF_SCHEMA = 'xml-compare-transfer-proof/v1';
const clean = (value) => String(value ?? '').trim();
const asArray = (items) => Object.freeze([...(Array.isArray(items) ? items : [])]);
const countRows = (rows = [], status = '') => rows.filter((row) => row.status === status).length;

export function snippet(xml = '', max = 240) {
  const text = clean(xml).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

function changedBlockRows(transferAudit = {}) {
  const rows = [];
  for (const auditRow of transferAudit.changedBlocks || []) {
    for (const block of auditRow.changedBlocks || []) rows.push(blockRow(auditRow, block));
  }
  return Object.freeze(rows);
}

function blockRow(auditRow = {}, block = {}) {
  return Object.freeze({
    pairId: clean(auditRow.pairId),
    scope: clean(auditRow.scope),
    sourceLine: clean(auditRow.sourceLine),
    targetLine: clean(auditRow.targetLine),
    sourceElement: clean(auditRow.sourceElement),
    targetElement: clean(auditRow.targetElement),
    sourceNode: clean(auditRow.sourceNode),
    targetNode: clean(auditRow.targetNode),
    blockName: clean(block.blockName),
    status: clean(block.status || auditRow.status),
    beforeXml: snippet(block.before?.xml || ''),
    afterXml: snippet(block.after?.xml || ''),
  });
}

function diagnostics(transferAudit = {}, postTransferValidation = {}) {
  return Object.freeze([...(transferAudit.diagnostics || []), ...(postTransferValidation.diagnostics || [])]);
}

export function createTransferProof({ transferAudit = null, postTransferValidation = null, transferLastResult = null, generatedAt = null } = {}) {
  const changedBlocks = changedBlockRows(transferAudit || {});
  const skippedBlocks = asArray(transferAudit?.skippedBlocks || []);
  const allDiagnostics = diagnostics(transferAudit || {}, postTransferValidation || {});
  const blockedCount = Number(transferAudit?.blockerCount || 0) + countRows(transferAudit?.changedBlocks || [], 'blocked');
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_PROOF_SCHEMA,
    generatedAt: clean(generatedAt || new Date(0).toISOString()),
    ok: Boolean(transferLastResult?.ok) && blockedCount === 0,
    scope: clean(transferLastResult?.scope || transferAudit?.transferCases?.[0]?.scope || 'node'),
    transferPlanHash: clean(transferAudit?.transferPlanHash),
    sourceHash: clean(transferAudit?.sourceHash),
    targetHash: clean(transferAudit?.targetHash),
    resultHash: clean(transferLastResult?.resultHash || transferAudit?.resultHash || stableHash(transferLastResult?.patchedTargetText || '')),
    updatedCount: Number(transferLastResult?.updatedCount ?? countRows(transferAudit?.changedBlocks || [], 'updated')),
    skippedCount: Number(transferLastResult?.skippedCount ?? skippedBlocks.length),
    blockedCount,
    changedBlocks,
    diagnostics: allDiagnostics,
  });
}

export function serializeTransferProofJson(proof = {}) {
  return `${JSON.stringify(proof, null, 2)}\n`;
}

export const _test = Object.freeze({ clean, asArray, countRows, changedBlockRows, blockRow, diagnostics });

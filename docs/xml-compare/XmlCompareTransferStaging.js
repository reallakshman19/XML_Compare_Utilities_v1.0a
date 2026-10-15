import { applyCategorizedTransferPlan } from './XmlCompareCategorizedTransferApplier.js';

export const XML_COMPARE_TRANSFER_STAGING_SCHEMA = 'xml-compare-transfer-stage/v1';

const clean = (value) => String(value ?? '').trim();

function readField(record = {}, field = '') {
  return record?.[field] ?? record?.fields?.[field] ?? record?.attributes?.[field] ?? '';
}

function changeForField(sourceRecord, targetRecord, field) {
  const sourceValue = readField(sourceRecord, field);
  const targetValue = readField(targetRecord, field);
  return Object.freeze({
    path: clean(field),
    field: clean(field),
    sourceValue,
    targetValue,
    action: clean(sourceValue) && clean(sourceValue) !== clean(targetValue) ? 'replace' : 'skip',
    reason: clean(sourceValue) ? '' : 'source-value-blank',
  });
}

export function createTransferStage({
  sourceRecord = null,
  targetRecord = null,
  scope = 'selected-field',
  selectedFields = [],
  nodeOwnedBlocks = [],
} = {}) {
  const fields = selectedFields.length ? selectedFields : Object.keys(sourceRecord || {}).filter((field) => typeof sourceRecord[field] !== 'object');
  const fieldChanges = scope === 'selected-field' ? fields.map((field) => changeForField(sourceRecord || {}, targetRecord || {}, field)) : [];
  const blockChanges = scope === 'node-owned-blocks' ? nodeOwnedBlocks.map((block) => Object.freeze({
    path: clean(block.blockName),
    field: clean(block.blockName),
    sourceValue: block.sourceBlock?.xml || block.sourceBlock?.value || '',
    targetValue: block.targetBlock?.xml || block.targetBlock?.value || '',
    action: block.sourceBlock ? (block.targetBlock ? 'replace' : 'add') : 'skip',
    reason: block.sourceBlock ? '' : 'source-block-missing',
  })) : [];
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_STAGING_SCHEMA,
    scope,
    sourceUid: clean(sourceRecord?.uid),
    targetUid: clean(targetRecord?.uid),
    changes: Object.freeze([...fieldChanges, ...blockChanges]),
    diagnostics: Object.freeze([]),
  });
}

export function createTransferPatchPlan({ targetXml = '', stage = null, previewPlan = null } = {}) {
  if (!stage) return blockedPlan('transfer_stage_missing', 'Stage Transfer before applying.');
  if (!clean(targetXml)) return blockedPlan('target_xml_missing', 'Target XML is required.');
  if (previewPlan) return Object.freeze({ ok: true, target: 'target', targetXml, stage, previewPlan, diagnostics: Object.freeze([]) });
  return Object.freeze({ ok: true, target: 'target', targetXml, stage, previewPlan: null, diagnostics: Object.freeze([]) });
}

export function applyTransferPatchPlan({ targetXml = '', sourceXml = '', patchPlan = null } = {}) {
  if (!patchPlan?.ok) return { ok: false, xmlText: targetXml, diagnostics: patchPlan?.diagnostics || [] };
  if (patchPlan.target !== 'target') return { ok: false, xmlText: targetXml, diagnostics: [diag('BLOCKER', 'source_apply_blocked', 'Applying transfer to source XML is blocked.')] };
  if (!patchPlan.previewPlan) return { ok: false, xmlText: targetXml, diagnostics: [diag('BLOCKER', 'target_path_unresolved', 'No target patch path was resolved.')] };
  const result = applyCategorizedTransferPlan(targetXml, sourceXml, patchPlan.previewPlan, { policy: 'replace' });
  return Object.freeze({ ok: true, xmlText: result.xml, auditRows: Object.freeze(result.audit || []), diagnostics: Object.freeze([]) });
}

export function createTransferAudit({ stage = null, patchPlan = null, result = null } = {}) {
  return Object.freeze({
    schema: 'xml-compare-transfer-audit/v1',
    stageSchema: stage?.schema || '',
    scope: clean(stage?.scope),
    sourceUid: clean(stage?.sourceUid),
    targetUid: clean(stage?.targetUid),
    changes: Object.freeze([...(stage?.changes || [])]),
    patchOk: Boolean(patchPlan?.ok),
    resultOk: Boolean(result?.ok),
    auditRows: Object.freeze([...(result?.auditRows || [])]),
    diagnostics: Object.freeze([...(stage?.diagnostics || []), ...(patchPlan?.diagnostics || []), ...(result?.diagnostics || [])]),
  });
}

function blockedPlan(code, message) {
  return Object.freeze({ ok: false, target: 'target', diagnostics: Object.freeze([diag('BLOCKER', code, message)]) });
}

function diag(severity, code, message) {
  return Object.freeze({ severity, code, message });
}

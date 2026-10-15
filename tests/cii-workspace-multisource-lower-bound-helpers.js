import { structuralTransferKey } from './cii-workspace-multisource-partial-texpected-oracle.js';

function text(value) { return String(value ?? '').trim(); }
function targetId(operation) { return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId); }
function beforeValue(operation) { return text(operation?.before ?? operation?.targetEvidence?.value); }
function proposedValue(operation) { return text(operation?.proposed ?? operation?.sourceEvidence?.value); }

export function selectedOperationDeltas(operations = []) {
  return Object.freeze((operations || []).flatMap((operation) => {
    const action = text(operation?.action); const nodeId = targetId(operation);
    if (!nodeId || !['COPY', 'CREATE', 'DELETE'].includes(action)) return [];
    return [Object.freeze({
      nodeId,
      action: action === 'COPY' ? 'REPLACE' : action,
      oldValue: beforeValue(operation),
      newValue: action === 'DELETE' ? '' : proposedValue(operation),
      operationId: text(operation?.operationId),
    })];
  }));
}

export function physicalTransferKeys(operations = []) {
  return Object.freeze((operations || []).map((operation) => structuralTransferKey(
    text(operation?.action),
    targetId(operation),
  )).sort());
}

export function missingRequiredTransferKeys(actualKeys = [], requiredKeys = []) {
  const actual = new Set(actualKeys || []);
  return Object.freeze((requiredKeys || []).filter((key) => !actual.has(key)).sort());
}

export function additionalTransferKeys(actualKeys = [], requiredKeys = []) {
  const required = new Set(requiredKeys || []);
  return Object.freeze((actualKeys || []).filter((key) => !required.has(key)).sort());
}

export const _test = Object.freeze({ text, targetId, beforeValue, proposedValue });

import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';
import { ciiPhysicalFileBytes, ciiPhysicalSectionRows, createCiiPhysicalFile } from './cii-workspace-physical-file.js';

const SIF_ROWS_PER_TEE_V14 = 7;
const TEES_PER_RECORD = 2;
const SIF_ROWS_PER_RECORD_V14 = SIF_ROWS_PER_TEE_V14 * TEES_PER_RECORD;
const SIF_FIELDS_PER_ROW = 6;
const SIF_ROW_WIDTH = CII_SIX_FIELD_WIDTHS.reduce((sum, width) => sum + width, 0);
const V14_UNREPRESENTABLE_SIF_FIELDS = Object.freeze([
  19, 20, 21, 22,
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
]);
const V14_UNREPRESENTABLE_SIF_FIELD_SET = new Set(V14_UNREPRESENTABLE_SIF_FIELDS);
const ZERO_TOKEN = '0.000000E+00';

function fieldOffset(fieldIndex) {
  return CII_SIX_FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
}
function zeroField(width) {
  if (ZERO_TOKEN.length > width) throw new Error(`CII_WRITER2_V14_SHADOW_ZERO_FIELD_WIDTH_INVALID:${width}`);
  return ZERO_TOKEN.padStart(width, ' ');
}
function asciiBytes(value) {
  const text = String(value ?? '');
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0x7f) throw new Error('CII_WRITER2_V14_SHADOW_NON_ASCII_FIXED_FIELD');
    bytes[index] = code;
  }
  return bytes;
}
function maskIdentity(ledger) {
  return (ledger || []).map((item) => [
    item.record, item.tee, item.item, item.originalField,
  ].join(':')).join('|');
}
function parseSifRow(row, rowIndex) {
  if (String(row?.text ?? '').length !== SIF_ROW_WIDTH) {
    throw new Error(`CII_WRITER2_V14_SHADOW_SIF_ROW_WIDTH_INVALID:${rowIndex + 1}:${String(row?.text ?? '').length}:${SIF_ROW_WIDTH}`);
  }
  const fields = decodeFixedFields(row.text, CII_SIX_FIELD_WIDTHS);
  if (fields.length !== SIF_FIELDS_PER_ROW) throw new Error(`CII_WRITER2_V14_SHADOW_SIF_FIELD_COUNT_INVALID:${rowIndex + 1}`);
  const values = fields.map((field, fieldIndex) => {
    const value = parseFortranNumber(field);
    if (!field.trim() || !Number.isFinite(value)) {
      throw new Error(`CII_WRITER2_V14_SHADOW_SIF_FIELD_INVALID:${rowIndex + 1}:${fieldIndex + 1}`);
    }
    return value;
  });
  return { fields, values };
}

export function createCiiWriter2V14LosslessShadow(input) {
  const physicalFile = createCiiPhysicalFile(input);
  if (physicalFile.byteAuthority !== 'ORIGINAL_BYTES') throw new Error('CII_WRITER2_V14_SHADOW_ORIGINAL_BYTES_REQUIRED');
  const outputBytes = ciiPhysicalFileBytes(physicalFile);
  const rows = ciiPhysicalSectionRows(physicalFile, 'SIF&TEES');
  if (!rows.length) {
    const audit = Object.freeze({
      schema: 'CIIWorkspaceWriter2V14LosslessShadow.v1', status: 'PASS', policy: 'CONVERSION_SHADOW_ONLY',
      section: 'SIF&TEES', rowCount: 0, recordCount: 0, maskedFieldCount: 0,
      unsupportedFieldItems: V14_UNREPRESENTABLE_SIF_FIELDS, ledger: Object.freeze([]), maskIdentity: '',
    });
    return Object.freeze({ outputBytes, audit });
  }
  if (rows.length % SIF_ROWS_PER_RECORD_V14 !== 0) {
    throw new Error(`CII_WRITER2_V14_SHADOW_SIF_ROW_COUNT_INVALID:${rows.length}:${SIF_ROWS_PER_RECORD_V14}`);
  }

  const ledger = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const { fields, values } = parseSifRow(row, rowIndex);
    const rowWithinRecord = rowIndex % SIF_ROWS_PER_RECORD_V14;
    const tee = Math.floor(rowWithinRecord / SIF_ROWS_PER_TEE_V14) + 1;
    const rowWithinTee = rowWithinRecord % SIF_ROWS_PER_TEE_V14;
    const record = Math.floor(rowIndex / SIF_ROWS_PER_RECORD_V14) + 1;
    for (let fieldIndex = 0; fieldIndex < SIF_FIELDS_PER_ROW; fieldIndex += 1) {
      const item = rowWithinTee * SIF_FIELDS_PER_ROW + fieldIndex + 1;
      if (!V14_UNREPRESENTABLE_SIF_FIELD_SET.has(item) || Math.abs(values[fieldIndex]) < 1e-12) continue;
      const width = CII_SIX_FIELD_WIDTHS[fieldIndex];
      const start = row.byteStart + fieldOffset(fieldIndex);
      const end = start + width;
      const replacement = zeroField(width);
      outputBytes.set(asciiBytes(replacement), start);
      ledger.push(Object.freeze({
        section: 'SIF&TEES', record, tee, item, lineNumber: row.lineNumber,
        byteStart: start, byteEnd: end, originalField: fields[fieldIndex], shadowField: replacement,
      }));
    }
  }
  const frozenLedger = Object.freeze(ledger);
  const audit = Object.freeze({
    schema: 'CIIWorkspaceWriter2V14LosslessShadow.v1', status: 'PASS',
    policy: 'MASK_ONLY_V14_SIF_FIELDS_WITHOUT_QUALIFIED_V11_SEMANTIC_SLOT_IN_CONVERSION_SHADOW',
    section: 'SIF&TEES', rowCount: rows.length, recordCount: rows.length / SIF_ROWS_PER_RECORD_V14,
    maskedFieldCount: ledger.length, unsupportedFieldItems: V14_UNREPRESENTABLE_SIF_FIELDS,
    ledger: frozenLedger, maskIdentity: maskIdentity(frozenLedger),
  });
  return Object.freeze({ outputBytes, audit });
}

export function assertCiiWriter2V14ShadowIdentity(expectedAudit, actualAudit) {
  if (expectedAudit?.schema !== 'CIIWorkspaceWriter2V14LosslessShadow.v1'
    || actualAudit?.schema !== 'CIIWorkspaceWriter2V14LosslessShadow.v1') {
    throw new Error('CII_WRITER2_V14_SHADOW_AUDIT_REQUIRED');
  }
  if (expectedAudit.maskIdentity !== actualAudit.maskIdentity) {
    throw new Error('CII_WRITER2_V14_SHADOW_PROTECTED_DATA_CHANGED');
  }
  return Object.freeze({
    status: 'PASS', maskedFieldCount: actualAudit.maskedFieldCount,
    maskIdentity: actualAudit.maskIdentity,
  });
}

export const _test = Object.freeze({
  fieldOffset, zeroField, maskIdentity, V14_UNREPRESENTABLE_SIF_FIELDS,
  SIF_ROWS_PER_RECORD_V14, SIF_ROW_WIDTH,
});

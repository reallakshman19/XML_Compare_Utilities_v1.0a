/**
 * Update-ledger rows: one row per applied mutation (geometry command or
 * attribute edit). This table is the human-auditable basis of the staged
 * JSON export; remarks are editable and survive into the provenance block.
 */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const UPDATE_LEDGER_COLUMNS = Object.freeze([
  { key: 'seq', label: '#', width: '48px' },
  { key: 'id', label: 'Id', width: '110px' },
  { key: 'kind', label: 'Kind', width: '170px' },
  { key: 'target', label: 'Target', width: '220px' },
  { key: 'before', label: 'Before', width: '190px' },
  { key: 'after', label: 'After', width: '190px' },
  { key: 'origin', label: 'Origin', width: '150px' },
  { key: 'remark', label: 'Remark', width: '220px', editable: true },
]);

const compact = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function commandTarget(payload) {
  const record = objectRecord(payload);
  return cleanText(record.nodeId ?? record.edgeId ?? record.sourceNodeId ?? record.fromNodeId ?? '')
    || asArray(record.edgeIds).map(cleanText).join(', ');
}

function remarkValue(remarks, id) { return cleanText(objectRecord(remarks)[id]); }

function commandRows(command, sequenceStart, remarks, origin) {
  const record = objectRecord(command);
  const type = cleanText(record.type);
  if (type === 'TRANSACTION') {
    const payload = objectRecord(record.payload), metadata = objectRecord(payload.metadata);
    const nestedOrigin = asArray(metadata.suggestionIds).length ? `AUTOFIX:${asArray(metadata.suggestionIds).map(cleanText).join(',')}` : origin;
    return asArray(payload.operations).flatMap((operation, index) => commandRows(
      { ...objectRecord(operation), id: `${cleanText(record.id)}.${index + 1}` }, sequenceStart + index, remarks, nestedOrigin,
    ));
  }
  const payload = objectRecord(record.payload);
  const id = cleanText(record.id) || `${type}-${sequenceStart}`;
  // For MOVE_NODE, shortInlineStretchSuggestion embeds fromPosition so the
  // Before column shows the original node coordinates for auditability.
  const beforeValue = type === 'MOVE_NODE' && payload.fromPosition ? compact(payload.fromPosition) : '';
  return [{
    seq: sequenceStart,
    id,
    kind: type,
    target: commandTarget(payload),
    before: beforeValue,
    after: compact(payload.position ?? payload.toPosition ?? payload.fraction ?? payload.endpoint ?? payload.targetNodeId ?? payload.toNodeId ?? payload.kind ?? payload.radiusMm ?? ''),
    origin,
    remark: remarkValue(remarks, id),
    source: 'COMMAND',
    detail: payload,
  }];
}


/**
 * @param {{ draft: Record<string, unknown>|null, attributeLedger: Record<string, unknown>|null,
 *           remarks: Record<string, string> }} input
 * @returns {ReadonlyArray<Record<string, unknown>>}
 */
export function buildUpdateLedgerRows(input) {
  const { draft, attributeLedger, remarks } = input;
  const rows = [];
  let sequence = 1;
  for (const command of asArray(draft?.commands)) {
    const produced = commandRows(command, sequence, remarks, 'MANUAL');
    rows.push(...produced);
    sequence += produced.length;
  }
  for (const edit of asArray(attributeLedger?.edits).map(objectRecord)) {
    rows.push({
      seq: sequence,
      id: cleanText(edit.id),
      kind: `ATTRIBUTE_EDIT · ${cleanText(edit.fixCode) || cleanText(edit.field)}`,
      target: cleanText(edit.sourcePath),
      before: compact(edit.before),
      after: compact(edit.after),
      origin: cleanText(edit.origin) || 'MANUAL',
      remark: remarkValue(remarks, cleanText(edit.id)) || cleanText(edit.reason),
      source: 'ATTRIBUTE',
      detail: edit,
    });
    sequence += 1;
  }
  return Object.freeze(rows);
}

/** Rows → CSV text (excel-paste friendly). */
export function updateLedgerCsv(rows) {
  const cell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = UPDATE_LEDGER_COLUMNS.map((column) => column.label).join(',');
  const body = rows.map((row) => UPDATE_LEDGER_COLUMNS.map((column) => cell(row[column.key])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

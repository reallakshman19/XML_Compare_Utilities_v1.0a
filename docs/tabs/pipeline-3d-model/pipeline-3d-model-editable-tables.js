// Editable Table 2/Table 3 helpers for Pipeline 3D Model.
// Inputs: existing raw textarea text or DOM table controls. Outputs: normalized
// TSV text consumed by pipeline-3d-model-geometry.js. Fallback: incomplete rows
// remain visible in the editor but are not serialized until numeric fields exist.

const NUMBER_RE = /-?\d+(?:[.,]\d+)?/g;

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function decimalText(value) {
  const clean = String(value ?? '').trim().replace(',', '.');
  if (!clean) return '';
  const number = Number(clean);
  if (!Number.isFinite(number)) return '';
  return String(Math.round(number * 1000) / 1000);
}

function numbersFromLine(line) {
  return (String(line || '').match(NUMBER_RE) || [])
    .map((token) => Number(token.replace(',', '.')))
    .filter((number) => Number.isFinite(number));
}

function labelFromLine(line) {
  return String(line || '')
    .replace(NUMBER_RE, ' ')
    .replace(/[,\t|;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function delimitedParts(line) {
  return String(line || '').split(/\t|[|;]/).map((part) => part.trim()).filter(Boolean);
}

function rowFromDelimitedTable3(line, currentCumulative) {
  const parts = delimitedParts(line);
  if (parts.length < 2) return null;
  const numericIndexes = parts
    .map((part, index) => ({ index, numbers: numbersFromLine(part) }))
    .filter((entry) => entry.numbers.length === 1);
  if (!numericIndexes.length) return null;
  const last = numericIndexes[numericIndexes.length - 1];
  const previous = numericIndexes.length > 1 ? numericIndexes[numericIndexes.length - 2] : null;
  const length = previous ? previous.numbers[0] : last.numbers[0];
  const cumulative = previous ? last.numbers[0] : currentCumulative + length;
  const markerParts = parts.slice(0, previous ? previous.index : last.index);
  return { marker: markerParts.join(' '), length, cumulative };
}

function isHeaderLine(line) {
  return /horizontal|elevation|marker|segment|length/i.test(String(line || '')) && numbersFromLine(line).length === 0;
}

function nonEmptyLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !isHeaderLine(line));
}

export function table2TextToRows(text) {
  return nonEmptyLines(text)
    .map((line) => numbersFromLine(line))
    .filter((numbers) => numbers.length >= 2)
    .map((numbers) => ({ horizontal: decimalText(numbers[0]), elevation: decimalText(numbers[1]) }));
}

export function table3TextToRows(text) {
  const rows = [];
  let cumulative = 0;
  for (const line of nonEmptyLines(text)) {
    const delimited = rowFromDelimitedTable3(line, cumulative);
    if (delimited) {
      cumulative = delimited.cumulative;
      rows.push({ marker: delimited.marker, length: decimalText(delimited.length), cumulative: decimalText(cumulative) });
      continue;
    }
    const numbers = numbersFromLine(line);
    if (!numbers.length) continue;
    const marker = labelFromLine(line);
    const length = numbers.length === 1 ? numbers[0] : numbers[numbers.length - 2];
    cumulative = numbers.length === 1 ? cumulative + length : numbers[numbers.length - 1];
    rows.push({ marker, length: decimalText(length), cumulative: decimalText(cumulative) });
  }
  return rows;
}

function isCompleteTable2Row(row) {
  return decimalText(row.horizontal) !== '' && decimalText(row.elevation) !== '';
}

function isCompleteTable3Row(row) {
  return decimalText(row.length) !== '' || decimalText(row.cumulative) !== '';
}

export function table2RowsToText(rows) {
  const lines = (Array.isArray(rows) ? rows : [])
    .filter(isCompleteTable2Row)
    .map((row) => `${decimalText(row.horizontal)}\t${decimalText(row.elevation)}`);
  return ['Horizontal (m)\tGrade Elevation (m)', ...lines].join('\n');
}

export function table3RowsToText(rows) {
  const lines = (Array.isArray(rows) ? rows : [])
    .filter(isCompleteTable3Row)
    .map((row) => `${row.marker || ''}\t${decimalText(row.length)}\t${decimalText(row.cumulative)}`.trim());
  return ['Marker\tSegment Length (m)\tHorizontal Distance (m)', ...lines].join('\n');
}

function inputCell(field, value, label) {
  return `<input aria-label="${h(label)}" data-p3d-edit-field="${h(field)}" value="${h(value)}" spellcheck="false">`;
}

function actionCell(index) {
  return `<button type="button" class="p3d-row-delete" data-p3d-edit-delete="${index}" aria-label="Delete row ${index + 1}">-</button>`;
}

function tableShell(title, headerHtml, bodyHtml) {
  return `<div class="p3d-editable-table" role="group" aria-label="${h(title)}">
<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>
<button type="button" class="p3d-row-add" data-p3d-edit-add="1">+ Add row</button>
</div>`;
}

export function renderTable2Editor(container, rows) {
  if (!container) return;
  const sourceRows = Array.isArray(rows) && rows.length ? rows : [{ horizontal: '', elevation: '' }];
  const body = sourceRows.map((row, index) => `<tr data-p3d-edit-row="${index}">
<td>${index + 1}</td>
<td>${inputCell('horizontal', row.horizontal, `Table 2 row ${index + 1} horizontal`)}</td>
<td>${inputCell('elevation', row.elevation, `Table 2 row ${index + 1} grade elevation`)}</td>
<td>${actionCell(index)}</td>
</tr>`).join('');
  const head = '<tr><th>#</th><th>Horizontal (m)</th><th>Grade Elevation (m)</th><th></th></tr>';
  container.innerHTML = tableShell('Table 2 editor', head, body);
}

export function renderTable3Editor(container, rows) {
  if (!container) return;
  const sourceRows = Array.isArray(rows) && rows.length ? rows : [{ marker: '', length: '', cumulative: '' }];
  const body = sourceRows.map((row, index) => `<tr data-p3d-edit-row="${index}">
<td>${index + 1}</td>
<td>${inputCell('marker', row.marker, `Table 3 row ${index + 1} marker name`)}</td>
<td>${inputCell('length', row.length, `Table 3 row ${index + 1} segment length`)}</td>
<td>${inputCell('cumulative', row.cumulative, `Table 3 row ${index + 1} horizontal distance`)}</td>
<td>${actionCell(index)}</td>
</tr>`).join('');
  const head = '<tr><th>#</th><th>Marker / Node Name</th><th>Segment Length (m)</th><th>Horizontal Distance (m)</th><th></th></tr>';
  container.innerHTML = tableShell('Table 3 editor', head, body);
}

function readEditorRows(container, fields) {
  return Array.from(container?.querySelectorAll('[data-p3d-edit-row]') || []).map((row) => {
    const entry = {};
    for (const field of fields) {
      entry[field] = row.querySelector(`[data-p3d-edit-field="${field}"]`)?.value?.trim() || '';
    }
    return entry;
  });
}

export function readTable2EditorRows(container) {
  return readEditorRows(container, ['horizontal', 'elevation']);
}

export function readTable3EditorRows(container) {
  return readEditorRows(container, ['marker', 'length', 'cumulative']);
}

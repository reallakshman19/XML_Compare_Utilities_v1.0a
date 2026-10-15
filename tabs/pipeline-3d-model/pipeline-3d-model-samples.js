// Sample table text loaded by the "New" (Load Sample) button.
import { createTable2XSVG, createTable3XSVG } from './pipeline-3d-model-preview.js?v=2';

export const SAMPLE_TABLE_1 = `Point\tX\tY\tZ\tOriginGlobalX\tOriginGlobalY\tOriginGlobalZ\tAngleDeg
IP3-IP Start\t0\t0\t0\t301614.82\t2038115\t0\t0
IP3-IP-01\t384\t0\t0\t301614.82\t2038115\t0\t0
IP3-IP-02\t428\t44\t0\t301614.82\t2038115\t0\t0
Match line\t464\t98\t0\t301614.82\t2038115\t0\t0
Match line\t0\t0\t0\t301614.82\t2038115\t0\t329.84
IP-02AA\t303\t-176.5\t0\t301614.82\t2038115\t0\t329.84`;

export const SAMPLE_TABLE_2 = `Horizontal (m)\tGrade Elevation (m)
0.0\t231.32
6.7\t230.95
19.0\t230.82
31.9\t230.82
42.6\t231.38
54.1\t231.79
66.3\t232.28
77.8\t231.92
88.9\t231.08
98.5\t231.08
105.1\t231.66
118.7\t231.57
132.2\t231.81
141.3\t231.44
153.0\t232.33
164.0\t231.77
176.2\t231.31
187.4\t230.89
194.6\t230.87
207.7\t230.83
219.2\t230.83
225.5\t231.12
240.2\t231.52
249.4\t232.14
259.4\t231.74
275.8\t231.10
276.9\t231.04
289.0\t230.89
302.7\t230.85
312.6\t231.18
328.9\t231.33
342.3\t231.38
352.9\t231.33
365.1\t231.42
376.9\t231.85
386.0\t232.08
393.2\t232.75
404.3\t232.91
417.4\t232.83
429.9\t232.99
441.1\t232.11
446.4\t232.06
458.6\t232.98
467.3\t232.84
478.1\t232.95
487.7\t232.62
495.3\t232.59
503.3\t232.87
511.1\t233.17`;

export const SAMPLE_TABLE_3 = `Marker\tSegment Length (m)\tHorizontal Distance (m)
Marker 1\t20.5\t20.5
Marker 2\t34.3\t54.8
Marker 3\t16.0\t70.8
Marker 4\t111.5\t182.3
Marker 5\t48.1\t230.4
Marker 6\t154.5\t384.9
Marker 7\t56.0\t440.9
Marker 8\t12.5\t453.4
Marker 9\t18.7\t472.1
Marker 10\t38.9\t511.0`;

// Multi-sheet alt-format Table 1 sample: two blank-line-separated
// "Constant width / area / length / at point X= Y= Z=" blocks. Sheet 2's
// Angle is auto-derived from sheet 1's on Run — nothing here specifies it.
export const SAMPLE_TABLE_1_MULTISHEET = `    Constant width     0.300
              area   19179.305
            length   511.100
          at point  X=  661.549  Y= -160.249  Z=    0.000
          at point  X= 1045.626  Y= -160.249  Z=    0.000
          at point  X= 1089.468  Y= -116.407  Z=    0.000
          at point  X= 1125.687  Y=  -62.406  Z=    0.000

    Constant width    0.3000
              area   112231.6379
            length   1271.0677
          at point  X= 620.6918  Y=-241.5160  Z=   0.0000
          at point  X= 622.5026  Y=-243.1093  Z=   0.0000
          at point  X= 981.9652  Y=-452.2784  Z=   0.0000
          at point  X=1180.0855  Y=-557.5981  Z=   0.0000
          at point  X=1282.7178  Y=-554.6324  Z=   0.0000
          at point  X=1807.3639  Y=-521.1176  Z=   0.0000`;

export const SAMPLE_TABLE_2A_RAW = `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
661.791 → 682.337\t—\t—\t—\t—
665.621\t—\t—\t—\t—
668.540\t-715.825 → -650.258\t65.567\t0+006.7\t230.95
680.803\t-715.825 → -650.258\t65.567\t0+019.0\t230.82
682.337 → 716.683\t—\t—\t—\t—
682.337 → 732.683\t—\t—\t—\t—
688.135\t—\t—\t—\t—
693.658\t-715.825 → -650.258\t65.567\t0+031.9\t230.82
704.382\t-715.825 → -650.258\t65.567\t0+042.6\t231.38
715.911\t-715.825 → -650.258\t65.567\t0+054.1\t231.79
716.683 → 732.683\t—\t—\t—\t—
728.077\t-715.825 → -650.258\t65.567\t0+066.3\t232.28
739.546\t-715.825 → -650.258\t65.567\t0+077.8\t231.92`;

export const SAMPLE_TABLE_3A_RAW = `From H(coor)\tTo H(coor)\tText Position X\tHLength Text
661.791\t682.337\t671.704\t20.5
682.337\t716.683\t700.435\t34.3
716.683\t732.683\t723.927\t16.0`;

export const SAMPLE_TABLE_3B_RAW = `From H(coor)\tTo H(coor)\tText Position X\tZ Text
—\t—\t665.621\tA/G
682.337\t732.683\t708.374\t1.5M`;

export const SAMPLE_TABLE_3C_RAW = `Text Position X\tMarker Text
688.135\tPM-001`;

const DASH = '—';
const SPLIT_STYLE_ID = 'pipeline-3d-split-table-style';
const SPLIT_TABLES_PATCHED = new WeakSet();
const SPLIT_DEFS = Object.freeze({
  'table2a-raw': ['H(coor)', 'V(coor)', '[H vs V] Length', 'Station Text', 'Elevation Text'],
  'table3a-raw': ['From H(coor)', 'To H(coor)', 'Text Position X', 'HLength Text'],
  'table3b-raw': ['From H(coor)', 'To H(coor)', 'Text Position X', 'Z Text'],
  'table3c-raw': ['Text Position X', 'Marker Text'],
});

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function splitCells(line) {
  return String(line || '').split(/\t|\s{2,}|\|/).map((part) => part.trim());
}

function lines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function numberFrom(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function numbersFrom(value) {
  return (String(value ?? '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

function fmt(value, places = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DASH;
  return number.toFixed(places).replace(/\.0$/, '.0');
}

function fmt3(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DASH;
  return String(Math.round(number * 1000) / 1000);
}

function stationValue(text) {
  const match = String(text || '').match(/(\d+)\s*\+\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return (Number(match[1]) * 1000) + Number(match[2]);
}

function parseTable2A(rawText) {
  return lines(rawText).slice(1).map((line, index) => {
    const [hCoor = DASH, vCoor = DASH, length = DASH, station = DASH, elevation = DASH] = splitCells(line);
    return {
      row: index + 1,
      hCoor,
      vCoor,
      length,
      station,
      elevation,
      h: stationValue(station),
      v: numberFrom(elevation),
    };
  });
}

function interpolateByRow(rows, field) {
  const anchors = rows.filter((row) => Number.isFinite(row[field]));
  return rows.map((row) => {
    if (Number.isFinite(row[field])) return row[field];
    const prev = [...anchors].reverse().find((anchor) => anchor.row < row.row);
    const next = anchors.find((anchor) => anchor.row > row.row);
    const a = prev || anchors[0];
    const b = next || anchors[anchors.length - 1];
    if (!a || !b || a.row === b.row) return a?.[field] ?? b?.[field] ?? null;
    return a[field] + ((row.row - a.row) / (b.row - a.row)) * (b[field] - a[field]);
  });
}

function buildTable2XRows(rawText) {
  const rows = parseTable2A(rawText);
  const hInt = interpolateByRow(rows, 'h');
  const vInt = interpolateByRow(rows, 'v');
  return rows.map((row, index) => ({
    ...row,
    hInt: hInt[index],
    vInt: vInt[index],
  }));
}

function buildTable2X(rawText) {
  const header = ['Row', 'H(coor)', 'V(coor)', '[H vs V] Length', 'Station Text', 'Elevation Text', 'H', 'V', 'H_Int', 'V_Int'];
  const body = buildTable2XRows(rawText).map((row) => [
    row.row,
    row.hCoor,
    row.vCoor,
    row.length,
    row.station,
    row.elevation,
    Number.isFinite(row.h) ? fmt(row.h, 1) : DASH,
    Number.isFinite(row.v) ? fmt(row.v, 2) : DASH,
    fmt(row.hInt, 1),
    fmt(row.vInt, 2),
  ]);
  return [header, ...body].map((row) => row.join('\t')).join('\n');
}

function buildTable2ModelInput(rawText) {
  const rows = buildTable2XRows(rawText).filter((row) => Number.isFinite(row.hInt) && Number.isFinite(row.vInt));
  return ['Horizontal (m)\tGrade Elevation (m)', ...rows.map((row) => `${fmt(row.hInt, 1)}\t${fmt(row.vInt, 2)}`)].join('\n');
}

function parseLengthRows(rawText) {
  return lines(rawText).slice(1).map((line) => {
    const [from = '', to = '', textX = '', length = ''] = splitCells(line);
    return { from, to, textX, length: numberFrom(length) };
  }).filter((row) => Number.isFinite(row.length));
}

function parseZRows(rawText) {
  return lines(rawText).slice(1).map((line) => {
    const [from = '', to = '', textX = '', zText = ''] = splitCells(line);
    return { from, to, textX, zText };
  }).filter((row) => row.zText && row.zText !== DASH);
}

function parseMarkerRows(rawText) {
  return lines(rawText).slice(1).map((line) => {
    const [textX = '', markerText = ''] = splitCells(line);
    return { textX, markerText };
  }).filter((row) => row.markerText && row.markerText !== DASH);
}

function hBasisFromHCoor(hCoor) {
  const nums = numbersFrom(hCoor);
  return nums.length ? nums[nums.length - 1] : null;
}

function rangeLabel(from, to, fallback) {
  const start = numberFrom(from);
  const end = numberFrom(to);
  if (Number.isFinite(start) && Number.isFinite(end)) return `${fmt3(start)} → ${fmt3(end)}`;
  return fallback || DASH;
}

function makeTable3Skeleton(table2Rows) {
  return table2Rows.map((row) => ({
    row: row.row,
    basis: hBasisFromHCoor(row.hCoor),
    hlengthRef: DASH,
    hlengthText: DASH,
    zRef: DASH,
    zText: DASH,
    markerRef: DASH,
    markerText: DASH,
    hlength: null,
    hlengthCum: null,
  }));
}

function findRowByBasis(rows, target, used = new Set()) {
  let best = null;
  let bestDelta = Infinity;
  rows.forEach((row, index) => {
    if (used.has(index) || !Number.isFinite(row.basis) || !Number.isFinite(target)) return;
    const delta = Math.abs(row.basis - target);
    if (delta < bestDelta) {
      best = { row, index };
      bestDelta = delta;
    }
  });
  return bestDelta < 0.01 ? best : null;
}

function applyLengthRows(table3Rows, lengthRows) {
  let cumulative = 0;
  const used = new Set();
  lengthRows.forEach((lengthRow) => {
    cumulative += lengthRow.length;
    const target = numberFrom(lengthRow.to);
    const match = findRowByBasis(table3Rows, target, used);
    if (!match) return;
    used.add(match.index);
    match.row.hlengthRef = rangeLabel(lengthRow.from, lengthRow.to, lengthRow.textX);
    match.row.hlengthText = fmt(lengthRow.length, 1);
    match.row.hlength = lengthRow.length;
    match.row.hlengthCum = Number(fmt(cumulative, 1));
  });
}

function applyZRows(table3Rows, zRows) {
  zRows.forEach((zRow) => {
    const target = numberFrom(zRow.to) ?? numberFrom(zRow.textX);
    const match = findRowByBasis(table3Rows, target);
    if (!match) return;
    match.row.zRef = rangeLabel(zRow.from, zRow.to, zRow.textX);
    match.row.zText = zRow.zText;
  });
}

function applyMarkerRows(table3Rows, markerRows) {
  markerRows.forEach((markerRow) => {
    const target = numberFrom(markerRow.textX);
    const match = findRowByBasis(table3Rows, target);
    if (!match) return;
    match.row.markerRef = markerRow.textX;
    match.row.markerText = markerRow.markerText;
  });
}

function interpolateCumByRow(rows) {
  const anchors = rows
    .filter((row) => Number.isFinite(row.hlengthCum))
    .map((row) => ({ row: row.row, value: row.hlengthCum }));
  if (!anchors.find((anchor) => anchor.row === 1)) anchors.unshift({ row: 1, value: 0 });
  return rows.map((row) => {
    const exact = anchors.find((anchor) => anchor.row === row.row);
    if (exact) return exact.value;
    const prev = [...anchors].reverse().find((anchor) => anchor.row < row.row);
    const next = anchors.find((anchor) => anchor.row > row.row);
    const a = prev || anchors[0];
    const b = next || anchors[anchors.length - 1];
    if (!a || !b || a.row === b.row) return a?.value ?? b?.value ?? null;
    return a.value + ((row.row - a.row) / (b.row - a.row)) * (b.value - a.value);
  });
}

function buildTable3X(table2Raw, table3ARaw, table3BRaw, table3CRaw) {
  const rows = makeTable3Skeleton(parseTable2A(table2Raw));
  applyLengthRows(rows, parseLengthRows(table3ARaw));
  applyZRows(rows, parseZRows(table3BRaw));
  applyMarkerRows(rows, parseMarkerRows(table3CRaw));
  const cumInt = interpolateCumByRow(rows);
  const header = [
    'Row',
    'H(coor basis used)',
    '[H vs HLength] Text Position X',
    'HLength Text',
    '[H vs Z] Text Position X',
    'Z Text',
    '[H vs Markers] Text Position X',
    'Marker Text',
    'Hlength',
    'Hlength_Cum',
    'Hlength_Cum_Int',
    'Z',
    'MarkerText',
  ];
  const body = rows.map((row, index) => [
    row.row,
    fmt3(row.basis),
    row.hlengthRef,
    row.hlengthText,
    row.zRef,
    row.zText || DASH,
    row.markerRef,
    row.markerText || DASH,
    Number.isFinite(row.hlength) ? fmt(row.hlength, 1) : DASH,
    Number.isFinite(row.hlengthCum) ? fmt(row.hlengthCum, 1) : DASH,
    fmt(cumInt[index], 1),
    row.zText || DASH,
    row.markerText || DASH,
  ]);
  return { rows, cumInt, text: [header, ...body].map((row) => row.join('\t')).join('\n') };
}

function addMarkerModelRow(rows, seen, marker, cumulative) {
  if (!marker || marker === DASH || !Number.isFinite(cumulative)) return;
  const key = `${fmt(cumulative, 1)}\u0000${marker}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ marker, cumulative });
}

function buildTable3ModelInput(table3X, table2Raw) {
  const rows = [];
  const seen = new Set();
  buildTable2XRows(table2Raw).forEach((row) => {
    addMarkerModelRow(rows, seen, `EL ${fmt(row.hInt, 1)}`, row.hInt);
  });
  table3X.rows.forEach((row, index) => {
    const cumulative = table3X.cumInt[index];
    if (Number.isFinite(row.hlengthCum)) addMarkerModelRow(rows, seen, `HL ${fmt(row.hlengthCum, 1)}`, row.hlengthCum);
    if (row.zText && row.zText !== DASH) addMarkerModelRow(rows, seen, row.zText, cumulative);
    if (row.markerText && row.markerText !== DASH) addMarkerModelRow(rows, seen, row.markerText, cumulative);
  });
  return ['Marker\tSegment Length (m)\tHorizontal Distance (m)', ...rows.map((row) => `${row.marker}\t0\t${fmt(row.cumulative, 1)}`)].join('\n');
}

function findSlot(dialog, name) {
  return dialog.querySelector(`[data-p3d-split="${name}"]`);
}

function setTextAndInput(element, value) {
  if (!element) return;
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function ensureSplitStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(SPLIT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = SPLIT_STYLE_ID;
  style.textContent = `
.pipeline-3d-model-dialog{height:calc(100vh - 24px)!important;width:min(1680px,calc(100vw - 24px))!important}
.pipeline-3d-model-dialog .psmap-card-body{height:100%;min-height:0}
.pipeline-3d-model-dialog .p3d-workspace{height:100%;grid-template-columns:minmax(360px,.86fr) minmax(620px,1.14fr)!important}
.pipeline-3d-model-dialog .p3d-output{height:100%;grid-template-rows:auto auto minmax(220px, 45vh) auto minmax(0,1fr)!important}
.pipeline-3d-model-dialog .p3d-keyplan-frame{height:100%;min-height:220px;max-height:45vh;aspect-ratio:auto!important}
.pipeline-3d-model-dialog .p3d-output-scroll{height:100%;min-height:0;max-height:none!important;overflow:auto}
.pipeline-3d-model-dialog .p3d-output pre{max-height:30vh;min-height:100px}
.pipeline-3d-model-dialog .p3d-output pre[data-p3d="coordinate-output"]{max-height:36vh}
.pipeline-3d-model-dialog .p3d-input-grid textarea{min-height:86px;max-height:150px;resize:vertical}
.pipeline-3d-model-dialog .p3d-raw-details textarea{min-height:62px!important;max-height:108px!important}
.p3d-split-grid{border:1px solid rgba(148,163,184,.28);border-radius:10px;overflow:auto;background:#0b1220}
.p3d-split-grid table{width:100%;min-width:620px;border-collapse:collapse;color:#e2e8f0;font-size:12px}
.p3d-split-grid th,.p3d-split-grid td{border-bottom:1px solid rgba(148,163,184,.16);padding:5px;text-align:left;vertical-align:middle}
.p3d-split-grid th{position:sticky;top:0;background:#111c2f;color:#bfdbfe;z-index:1}
.p3d-split-grid input{width:100%;box-sizing:border-box;background:#020617;color:#e2e8f0;border:1px solid rgba(148,163,184,.32);border-radius:6px;padding:5px;font-family:monospace;font-size:12px}
.p3d-split-grid .p3d-row-add{margin:8px;padding:6px 10px}
.p3d-split-grid .p3d-row-add{margin:8px;padding:6px 10px}
.p3d-derived-grid{border:1px solid rgba(148,163,184,.28);border-radius:10px;overflow:auto;background:#0b1220;max-height:600px;height:100%;}
.p3d-derived-grid table{width:100%;min-width:720px;border-collapse:collapse;color:#e2e8f0;font-size:11px}
.p3d-derived-grid th,.p3d-derived-grid td{border-bottom:1px solid rgba(148,163,184,.16);padding:5px;text-align:left;white-space:nowrap}
.p3d-derived-grid th{position:sticky;top:0;background:#111c2f;color:#bfdbfe;z-index:1}
.p3d-x-modal{position:fixed;inset:0;background:rgba(2,6,23,0.9);z-index:100;display:none;flex-direction:column;padding:24px;box-sizing:border-box;color:#e2e8f0;}
.p3d-x-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.p3d-x-tabs{display:flex;gap:8px;margin-bottom:12px;}
.p3d-x-tab{background:#1e293b;border:1px solid rgba(148,163,184,0.3);color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap;}
.p3d-x-tab[data-active="true"]{background:#38bdf8;color:#0f172a;border-color:#38bdf8;font-weight:bold;}
.p3d-x-content{flex:1;min-height:0;overflow:hidden;display:none;}
.p3d-x-content[data-active="true"]{display:block;}
`;
  doc.head?.appendChild(style);
}

function parseRawRows(text, headers) {
  const source = lines(text);
  const body = source.length && source[0].toLowerCase().includes(headers[0].toLowerCase()) ? source.slice(1) : source;
  const rows = body.map((line) => {
    const cells = splitCells(line);
    return headers.map((_, index) => cells[index] ?? '');
  });
  return rows.length ? rows : [headers.map(() => '')];
}

function rowsToRawText(headers, rows) {
  const body = rows
    .map((row) => headers.map((_, index) => row[index] || '').join('\t'));
  return [headers.join('\t'), ...body].join('\n');
}

function inputHtml(value, rowIndex, cellIndex) {
  return `<input data-p3d-split-cell="${rowIndex}:${cellIndex}" value="${h(value)}" spellcheck="false">`;
}

function renderEditablePreview(dialog, name) {
  const textarea = findSlot(dialog, name);
  const holder = dialog.querySelector(`[data-p3d-split-preview="${name}"]`);
  const headers = SPLIT_DEFS[name];
  if (!textarea || !holder || !headers) return;
  const rows = parseRawRows(textarea.value, headers);
  const head = `<tr><th>#</th>${headers.map((header) => `<th>${h(header)}</th>`).join('')}<th></th></tr>`;
  const body = rows.map((row, rowIndex) => `<tr data-p3d-split-row="${rowIndex}">
<td>${rowIndex + 1}</td>
${row.map((cell, cellIndex) => `<td>${inputHtml(cell, rowIndex, cellIndex)}</td>`).join('')}
<td style="white-space:nowrap;">
  <button type="button" class="p3d-row-insert" data-p3d-split-insert="${rowIndex}" style="margin-right:4px;padding:2px 6px;cursor:pointer;" title="Insert row below">+</button>
  <button type="button" class="p3d-row-delete" data-p3d-split-delete="${rowIndex}" style="padding:2px 6px;cursor:pointer;" title="Delete row">-</button>
</td>
</tr>`).join('');
  holder.innerHTML = `<div class="p3d-split-grid"><table><thead>${head}</thead><tbody>${body}</tbody></table>
<button type="button" class="p3d-row-add" data-p3d-split-add="${name}">+ Add row</button></div>`;
}

function readEditablePreviewRows(holder, columnCount) {
  return Array.from(holder.querySelectorAll('[data-p3d-split-row]')).map((row) =>
    Array.from({ length: columnCount }, (_, index) =>
      row.querySelector(`[data-p3d-split-cell$=":${index}"]`)?.value?.trim() || '',
    ),
  );
}

function writePreviewRowsToRaw(dialog, name) {
  const textarea = findSlot(dialog, name);
  const holder = dialog.querySelector(`[data-p3d-split-preview="${name}"]`);
  const headers = SPLIT_DEFS[name];
  if (!textarea || !holder || !headers) return;
  textarea.value = rowsToRawText(headers, readEditablePreviewRows(holder, headers.length));
}

function renderAllEditablePreviews(dialog) {
  Object.keys(SPLIT_DEFS).forEach((name) => renderEditablePreview(dialog, name));
}

const _highlightedKeys = new Set();

function renderTsvGrid(text, highlightColIndex) {
  const [headerLine, ...bodyLines] = lines(text);
  const headers = splitCells(headerLine || '');
  const rows = bodyLines.map(splitCells);
  if (!headers.length) return '<div class="p3d-derived-grid">No rows.</div>';
  const head = `<tr>${headers.map((header) => `<th>${h(header)}</th>`).join('')}</tr>`;
  const body = rows.map((row) => {
    let isHighlighted = false;
    if (highlightColIndex != null) {
      const val = row[highlightColIndex];
      if (val) {
        const num = parseFloat(val.split('→').pop().trim()); // handle range labels
        if (_highlightedKeys.has(num) || _highlightedKeys.has(val)) isHighlighted = true;
      }
    }
    const style = isHighlighted ? 'background:rgba(234,179,8,.2);' : '';
    return `<tr style="${style}">${headers.map((_, index) => `<td>${h(row[index] ?? '')}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="p3d-derived-grid"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

function syncSplitTables(dialog, forceSvgUpdate = false) {
  const table2Raw = findSlot(dialog, 'table2a-raw')?.value || '';
  const table3ARaw = findSlot(dialog, 'table3a-raw')?.value || '';
  const table3BRaw = findSlot(dialog, 'table3b-raw')?.value || '';
  const table3CRaw = findSlot(dialog, 'table3c-raw')?.value || '';
  const table2X = buildTable2X(table2Raw);
  const table3X = buildTable3X(table2Raw, table3ARaw, table3BRaw, table3CRaw);
  const table2Preview = findSlot(dialog, 'table2x-preview');
  const table3Preview = findSlot(dialog, 'table3x-preview');
  const table2Output = dialog.querySelector('[data-p3d="table2x-output"]');
  const table3Output = dialog.querySelector('[data-p3d="table3x-output"]');
  
  if (forceSvgUpdate || !table2Preview?.querySelector('svg')) {
    const table2Html = createTable2XSVG(table2X);
    if (table2Preview) table2Preview.innerHTML = table2Html;
  }
  if (forceSvgUpdate || !table3Preview?.querySelector('svg')) {
    const table3Html = createTable3XSVG(table3X.text);
    if (table3Preview) table3Preview.innerHTML = table3Html;
  }
  
  if (table2Output) table2Output.innerHTML = renderTsvGrid(table2X, 1);
  if (table3Output) table3Output.innerHTML = renderTsvGrid(table3X.text, 4);
  setTextAndInput(dialog.querySelector('[data-p3d="table2"]'), buildTable2ModelInput(table2Raw));
  setTextAndInput(dialog.querySelector('[data-p3d="table3"]'), buildTable3ModelInput(table3X, table2Raw));
  
  if (forceSvgUpdate || !table2Preview?.dataset.boundListeners) {
    if (table2Preview) table2Preview.dataset.boundListeners = "true";
    bindDraggableSVGNodes(dialog);
  }
}

function updateRawTable(dialog, rawName, matchCol, matchVal, updateCol, newVal) {
  const textarea = findSlot(dialog, rawName);
  if (!textarea) return;
  const tLines = textarea.value.split('\n');
  let changed = false;
  for (let i = 0; i < tLines.length; i++) {
    const cells = tLines[i].split('\t');
    if (cells.length < 2) continue;
    let isMatch = false;
    
    if (rawName === 'table3b-raw' || rawName === 'table3a-raw') {
      const from = cells[0]?.trim();
      const to = cells[1]?.trim();
      const textX = cells[2]?.trim();
      let label = '';
      if (from && to) label = `${from} → ${to}`;
      else label = textX || '';
      
      if (label === matchVal || label === matchVal.replace('→', '->')) {
        isMatch = true;
        while (cells.length <= updateCol) cells.push('');
      }
    } else {
      if (cells.length > Math.max(matchCol, updateCol)) {
        if (parseFloat(cells[matchCol]) === parseFloat(matchVal) || cells[matchCol].trim() === String(matchVal)) {
          isMatch = true;
        }
      }
    }
    
    if (isMatch) {
      cells[updateCol] = newVal;
      tLines[i] = cells.join('\t');
      changed = true;
    }
  }
  if (changed) {
    textarea.value = tLines.join('\n');
    _highlightedKeys.add(parseFloat(matchVal));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function bindDraggableSVGNodes(dialog) {
  const svgs = dialog.querySelectorAll('svg[data-svg-type]');
  svgs.forEach(svg => {
    // We already attach this once, but just to be safe:
    if (svg.dataset.bound) return;
    svg.dataset.bound = "true";

    let draggingNode = null;
    let type = svg.dataset.svgType;
    let minY = parseFloat(svg.dataset.minY);
    let maxY = parseFloat(svg.dataset.maxY);
    let pad = parseFloat(svg.dataset.pad);
    let h = parseFloat(svg.dataset.h);
    let isDepth = type === 'table3x';

    svg.addEventListener('pointerdown', (e) => {
      const target = e.target.closest('.p3d-draggable-node');
      if (!target) return;
      e.preventDefault();
      draggingNode = target;
      svg.setPointerCapture(e.pointerId);
    });

    svg.addEventListener('pointermove', (e) => {
      if (!draggingNode) return;
      e.preventDefault();
      
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      
      const dragType = draggingNode.dataset.dragType;
      const basis = draggingNode.dataset.hBasis;

      if (dragType === 'table3x-marker') {
        let newX = svgP.x;
        const w = parseFloat(svg.dataset.w);
        if (newX < pad) newX = pad;
        if (newX > w - pad) newX = w - pad;
        
        draggingNode.setAttribute('cx', newX);
        const line = svg.querySelector(`.p3d-drag-marker-line[data-h-basis="${basis}"]`);
        if (line) { line.setAttribute('x1', newX); line.setAttribute('x2', newX); }
        const textNode = svg.querySelector(`.p3d-drag-marker-text[data-h-basis="${basis}"]`);
        if (textNode) { textNode.setAttribute('x', newX); }
        const xNode = svg.querySelector(`.p3d-drag-marker-x[data-h-basis="${basis}"]`);
        if (xNode) { 
          const minX = parseFloat(svg.dataset.minX);
          const maxX = parseFloat(svg.dataset.maxX);
          const valX = minX + ((newX - pad) / (w - pad * 2)) * (maxX - minX);
          xNode.textContent = `X: ${valX.toFixed(1)}`; 
        }
        return;
      }

      let newY = svgP.y;
      if (newY < pad) newY = pad;
      if (newY > h - pad) newY = h - pad;
      
      draggingNode.setAttribute('cy', newY);
      
      const label = svg.querySelector(`.p3d-drag-label[data-h-basis="${basis}"]`);
      if (label) {
        label.setAttribute('y', newY + (isDepth ? 18 : -12));
        const unscaled = minY + ((h - pad - newY) / (h - pad * 2)) * (maxY - minY);
        let textVal;
        if (isDepth) {
          if (unscaled > 0.5) textVal = 'A/G';
          else textVal = (-unscaled).toFixed(1) + 'M';
        } else {
          textVal = unscaled.toFixed(2);
        }
        label.textContent = textVal;
      }
    });

    svg.addEventListener('pointerup', (e) => {
      if (!draggingNode) return;
      e.preventDefault();
      svg.releasePointerCapture(e.pointerId);
      
      const dragType = draggingNode.dataset.dragType;
      const hBasis = draggingNode.dataset.hBasis;

      if (dragType === 'table3x-marker') {
        const cx = parseFloat(draggingNode.getAttribute('cx'));
        const w = parseFloat(svg.dataset.w);
        const minX = parseFloat(svg.dataset.minX);
        const maxX = parseFloat(svg.dataset.maxX);
        const newCum = minX + ((cx - pad) / (w - pad * 2)) * (maxX - minX);
        
        const hMap = svg.dataset.hMap.split(',').map(pair => {
          const [cum, h] = pair.split(':');
          return { cum: parseFloat(cum), h: parseFloat(h) };
        }).filter(p => !isNaN(p.cum) && !isNaN(p.h));
        
        hMap.sort((a,b) => a.cum - b.cum);
        let newH = hMap[0]?.h || 0;
        if (hMap.length > 0) {
          if (newCum <= hMap[0].cum) newH = hMap[0].h;
          else if (newCum >= hMap[hMap.length-1].cum) newH = hMap[hMap.length-1].h;
          else {
            for (let i = 0; i < hMap.length - 1; i++) {
              const p1 = hMap[i];
              const p2 = hMap[i+1];
              if (newCum >= p1.cum && newCum <= p2.cum) {
                const t = (newCum - p1.cum) / (p2.cum - p1.cum);
                newH = p1.h + t * (p2.h - p1.h);
                break;
              }
            }
          }
        }
        
        const originalText = draggingNode.dataset.originalText;
        updateRawTable(dialog, 'table3c-raw', 1, originalText, 0, newH.toFixed(3));
        draggingNode = null;
        return;
      }

      const cy = parseFloat(draggingNode.getAttribute('cy'));
      const unscaled = minY + ((h - pad - cy) / (h - pad * 2)) * (maxY - minY);
      
      let textVal;
      if (isDepth) {
        if (unscaled > 0.5) textVal = 'A/G';
        else textVal = (-unscaled).toFixed(1) + 'M';
      } else {
        textVal = unscaled.toFixed(2);
      }

      if (type === 'table2x') {
        updateRawTable(dialog, 'table2a-raw', 0, hBasis, 2, textVal);
      } else if (type === 'table3x') {
        updateRawTable(dialog, 'table3b-raw', 2, hBasis, 3, textVal);
      }
      draggingNode = null;
    });
  });
}

function applyMultiSheetSplitSample(dialog) {
  const defaults = {
    'table2a-raw': SAMPLE_TABLE_2A_RAW,
    'table3a-raw': SAMPLE_TABLE_3A_RAW,
    'table3b-raw': SAMPLE_TABLE_3B_RAW,
    'table3c-raw': SAMPLE_TABLE_3C_RAW,
  };
  Object.entries(defaults).forEach(([name, value]) => {
    const slot = findSlot(dialog, name);
    if (slot) slot.value = value;
  });
  renderAllEditablePreviews(dialog);
  syncSplitTables(dialog);
}

function rawPanel(title, name, placeholder) {
  return `<div class="p3d-input-panel" data-p3d-split-panel="${name}">
<label class="p3d-input-title">${title}</label>
<textarea data-p3d-split="${name}" placeholder="${placeholder}"></textarea>
<details class="p3d-raw-details" open><summary>Editable preview</summary><div data-p3d-split-preview="${name}"></div></details>
</div>`;
}

function markerRawPanel() {
  return rawPanel('Table 3C Raw — H vs Markers', 'table3c-raw', 'Text Position X&#9;Marker Text');
}

function patchPipelineDialog(dialog) {
  if (!dialog || SPLIT_TABLES_PATCHED.has(dialog)) return;
  SPLIT_TABLES_PATCHED.add(dialog);
  ensureSplitStyle(dialog.ownerDocument || globalThis.document);
  const table3Panel = dialog.querySelector('[data-p3d="table3-panel"]');
  if (table3Panel) {
    table3Panel.insertAdjacentHTML('afterend', `
${rawPanel('Table 2A Raw — H vs V', 'table2a-raw', 'H(coor)&#9;Station Text&#9;Elevation Text')}
${rawPanel('Table 3A Raw — H vs HLength', 'table3a-raw', 'From H&#9;To H&#9;Text Position X&#9;HLength Text')}
${rawPanel('Table 3B Raw — H vs Z', 'table3b-raw', 'From H&#9;To H&#9;Text Position X&#9;Z Text')}
${markerRawPanel()}
<div class="p3d-x-modal" data-p3d-split="x-modal">
  <div class="p3d-x-modal-head" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(148,163,184,.16);">
    <div style="display:flex;align-items:center;gap:16px;">
      <h3 style="margin:0;color:#e0f2fe;font-size:18px;">Table 2X & 3X Previews</h3>
      <button type="button" data-p3d-split="x-reload" style="background:#1e293b;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);border-radius:4px;padding:4px 12px;font-size:12px;cursor:pointer;">Reload Graph</button>
    </div>
    <button type="button" class="p3d-close" data-p3d-split="x-close" aria-label="Close Preview" style="position:static;">Close</button>
  </div>
  <div class="p3d-x-tabs">
    <button type="button" class="p3d-x-tab" data-x-tab="table2x" data-active="true">Table 2X</button>
    <button type="button" class="p3d-x-tab" data-x-tab="table3x">Table 3X</button>
  </div>
  <div class="p3d-x-content" data-x-content="table2x" data-active="true">
    <div data-p3d-split="table2x-preview" style="height:100%;">Paste Table 2A raw data to preview.</div>
  </div>
  <div class="p3d-x-content" data-x-content="table3x">
    <div data-p3d-split="table3x-preview" style="height:100%;">Paste Table 3A/3B/3C raw data to preview.</div>
  </div>
</div>`);
  }
  const table1Btn = dialog.querySelector('[data-p3d="btn-preview-1"]');
  if (table1Btn) {
    table1Btn.insertAdjacentHTML('afterend', `
      <button type="button" data-p3d-split="btn-preview-x" class="p3d-preview-btn" style="margin-left: 8px;">Preview Table 2X & 3X</button>
    `);
  }
  const table1Output = dialog.querySelector('[data-p3d="table1-output"]');
  if (table1Output) {
    table1Output.insertAdjacentHTML('afterend', `
<div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
  <h4 style="margin:0;">Table 2X — H vs V</h4>
  <button type="button" data-p3d-split="btn-preview-x" class="p3d-preview-btn" style="background:#334155;color:#e2e8f0;border:1px solid rgba(148,163,184,.32);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">Preview SVG Graphs</button>
</div>
<div data-p3d="table2x-output">Run or load the multi-sheet sample to generate.</div>
<h4>Table 3X — HLength / Z / Markers</h4>
<div data-p3d="table3x-output">Run or load the multi-sheet sample to generate.</div>`);
  }
  renderAllEditablePreviews(dialog);
  dialog.addEventListener('input', (event) => {
    if (event.isTrusted) _highlightedKeys.clear();
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const raw = target.closest('[data-p3d-split$="-raw"]');
    const cell = target.closest('[data-p3d-split-cell]');
    if (raw) {
      renderEditablePreview(dialog, raw.dataset.p3dSplit);
      syncSplitTables(dialog);
    } else if (cell) {
      const name = panel?.dataset.p3dSplitPanel;
      if (name) {
        writePreviewRowsToRaw(dialog, name);
        syncSplitTables(dialog);
      }
    }
  });
  dialog.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const add = target.closest('[data-p3d-split-add]');
    const del = target.closest('[data-p3d-split-delete]');
    const insert = target.closest('[data-p3d-split-insert]');
    if (!add && !del && !insert) return;
    
    const panel = target.closest('[data-p3d-split-panel]');
    const name = add?.dataset.p3dSplitAdd || panel?.dataset.p3dSplitPanel;
    const headers = SPLIT_DEFS[name];
    const holder = dialog.querySelector(`[data-p3d-split-preview="${name}"]`);
    if (!headers || !holder) return;
    const rows = readEditablePreviewRows(holder, headers.length);
    let next;
    if (add) {
      next = [...rows, headers.map(() => DASH)];
    } else if (del) {
      next = rows.filter((_, index) => index !== Number(del.dataset.p3dSplitDelete));
    } else if (insert) {
      next = [...rows];
      next.splice(Number(insert.dataset.p3dSplitInsert) + 1, 0, headers.map(() => DASH));
    }
    findSlot(dialog, name).value = rowsToRawText(headers, next.length ? next : [headers.map(() => DASH)]);
    renderEditablePreview(dialog, name);
    syncSplitTables(dialog);
  });
  dialog.querySelector('[data-p3d="run"]')?.addEventListener('click', () => syncSplitTables(dialog), { capture: true });
  const btnNew = dialog.querySelector('[data-p3d="new-multisheet"]');
  if (btnNew) {
    btnNew.addEventListener('click', () => queueMicrotask(() => applyMultiSheetSplitSample(dialog)));
  }
  const btnsPreviewX = dialog.querySelectorAll('[data-p3d-split="btn-preview-x"]');
  const xModal = dialog.querySelector('[data-p3d-split="x-modal"]');
  const xClose = dialog.querySelector('[data-p3d-split="x-close"]');
  const xReload = dialog.querySelector('[data-p3d-split="x-reload"]');
  if (btnsPreviewX.length && xModal && xClose) {
    btnsPreviewX.forEach(btn => btn.addEventListener('click', () => { 
      xModal.style.display = 'flex'; 
      syncSplitTables(dialog, true); // Force initial draw on open
    }));
    xClose.addEventListener('click', () => { xModal.style.display = 'none'; });
    if (xReload) xReload.addEventListener('click', () => syncSplitTables(dialog, true));
    const xTabs = Array.from(xModal.querySelectorAll('.p3d-x-tab'));
    const xContents = Array.from(xModal.querySelectorAll('.p3d-x-content'));
    xTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        xTabs.forEach(t => t.setAttribute('data-active', 'false'));
        xContents.forEach(c => c.setAttribute('data-active', 'false'));
        tab.setAttribute('data-active', 'true');
        const target = xModal.querySelector(`[data-x-content="${tab.getAttribute('data-x-tab')}"]`);
        if (target) target.setAttribute('data-active', 'true');
      });
    });
  }
}

function installPipeline3dSplitTableEnhancer(doc = globalThis.document) {
  if (!doc?.body || doc.body.dataset.p3dSplitTableEnhancer === '1') return;
  doc.body.dataset.p3dSplitTableEnhancer = '1';
  ensureSplitStyle(doc);
  const patchAll = () => doc.querySelectorAll('.pipeline-3d-model-dialog').forEach(patchPipelineDialog);
  patchAll();
  const observer = new MutationObserver(patchAll);
  observer.observe(doc.body, { childList: true, subtree: true });
}

installPipeline3dSplitTableEnhancer();

export const _pipeline3dSplitTableSamples = Object.freeze({
  buildTable2X,
  buildTable3X,
  buildTable2ModelInput,
  buildTable3ModelInput,
  parseTable2A,
});

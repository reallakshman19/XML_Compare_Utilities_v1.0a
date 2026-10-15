/** Pure hierarchical row and fixed-height virtualization model for ExportPlan.v1. */

import { cleanText, escapeMarkup } from './topology-validator-values.js';

export const EXPORT_INSPECTOR_ROW_HEIGHT = 28;
export const EXPORT_INSPECTOR_OVERSCAN = 8;

function scalarValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function appendRows(rows, value, section, path, depth) {
  const key = path || section;
  if (Array.isArray(value)) {
    rows.push({ section, path: key, depth, type: `array[${value.length}]`, value: '' });
    value.forEach((item, index) => appendRows(rows, item, section, `${key}[${index}]`, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    rows.push({ section, path: key, depth, type: `object{${entries.length}}`, value: '' });
    entries.forEach(([name, item]) => appendRows(rows, item, section, path ? `${path}.${name}` : name, depth + 1));
    return;
  }
  rows.push({ section, path: key, depth, type: value === null ? 'null' : typeof value, value: scalarValue(value) });
}

/** Flatten the complete plan without discarding hierarchy paths or container rows. */
export function exportPlanInspectorRows(plan) {
  const rows = [];
  for (const section of ['hierarchy', 'calculations', 'files', 'gate']) appendRows(rows, plan?.[section], section, '', 0);
  return Object.freeze(rows.map((row, index) => Object.freeze({ ...row, rowId: `EP-${String(index + 1).padStart(5, '0')}` })));
}

/** Filter on visible state fields while retaining immutable source rows. */
export function filterExportPlanInspectorRows(rows, query) {
  const term = cleanText(query).toLowerCase();
  if (!term) return rows;
  return Object.freeze(rows.filter((row) => `${row.section} ${row.path} ${row.type} ${row.value}`.toLowerCase().includes(term)));
}

/** Calculate one bounded DOM window with top/bottom spacer heights. */
export function virtualExportPlanWindow(rows, scrollTop, viewportHeight) {
  const top = Math.max(0, Number(scrollTop) || 0), height = Math.max(EXPORT_INSPECTOR_ROW_HEIGHT, Number(viewportHeight) || 0);
  const first = Math.max(0, Math.floor(top / EXPORT_INSPECTOR_ROW_HEIGHT) - EXPORT_INSPECTOR_OVERSCAN);
  const count = Math.ceil(height / EXPORT_INSPECTOR_ROW_HEIGHT) + (EXPORT_INSPECTOR_OVERSCAN * 2);
  const end = Math.min(rows.length, first + count);
  return Object.freeze({ rows: Object.freeze(rows.slice(first, end)), first, end,
    topSpacer: first * EXPORT_INSPECTOR_ROW_HEIGHT, bottomSpacer: (rows.length - end) * EXPORT_INSPECTOR_ROW_HEIGHT });
}

/** Render only one virtual row window; all dynamic text is escaped. */
export function buildExportPlanRowsMarkup(windowState) {
  const spacer = (height) => height ? `<tr class="ttv-export-spacer" style="height:${height}px"><td colspan="4"></td></tr>` : '';
  const rows = windowState.rows.map((row) => `<tr data-export-row="${row.rowId}"><td>${escapeMarkup(row.section)}</td><th scope="row" style="--export-depth:${row.depth}" title="${escapeMarkup(row.path)}">${escapeMarkup(row.path)}</th><td>${escapeMarkup(row.type)}</td><td title="${escapeMarkup(row.value)}">${escapeMarkup(row.value)}</td></tr>`).join('');
  return `${spacer(windowState.topSpacer)}${rows}${spacer(windowState.bottomSpacer)}`;
}

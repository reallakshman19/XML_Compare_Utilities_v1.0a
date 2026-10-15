import { createRevCompareDashboardModel } from './rev-compare-dashboard-model.js';
import { REV_COMPARE_CHANGE_TYPES } from './rev-compare-contracts.js';

const clean = (value) => String(value ?? '').trim();
const escCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function exportRevCompareJson(workspace) {
  const model = createRevCompareDashboardModel(workspace);
  return JSON.stringify(model, null, 2);
}

export function exportRevCompareCsv(workspace) {
  const model = createRevCompareDashboardModel(workspace);
  const fields = model.compareFields || [];
  
  const headers = ['Node Key', 'Status', ...fields.flatMap(f => [`Rev 1 ${f}`, `Rev 2 ${f}`, `Delta ${f}`])];
  const rows = [headers.join(',')];
  
  for (const r of model.results) {
    const row = [escCsv(r.key), escCsv(r.type)];
    for (const f of fields) {
      const change = r.changes.find(c => c.field === f);
      if (change) {
        row.push(escCsv(change.sourceValue), escCsv(change.targetValue), escCsv(change.delta !== undefined ? change.delta : ''));
      } else {
        row.push('','','');
      }
    }
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}

export const _test = Object.freeze({ clean, escCsv, exportRevCompareJson, exportRevCompareCsv });

import { createRevCompareDashboardModel } from './rev-compare-dashboard-model.js';
import { REV_COMPARE_CHANGE_TYPES } from './rev-compare-contracts.js';

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function renderMetricsTable(summary) {
  return `<table class="xmlc-rev-compare-metrics-table">
    <thead>
      <tr><th>Metric</th><th>Count</th><th>Meaning</th></tr>
    </thead>
    <tbody>
      ${summary.map(s => `<tr><td>${esc(s.metric)}</td><td class="xmlc-num">${esc(s.count)}</td><td>${esc(s.meaning)}</td></tr>`).join('')}
    </tbody>
  </table>`;
}

function getFieldValue(r, f) { if (!r) return ''; if (r[f] !== undefined) return r[f]; return r.rawSummary?.[f] || ''; }

function renderOrphanTables(model) {
  const fields = model.compareFields || [];
  
  const renderTable = (results, type, keyHeader) => {
    if (!results.length) return `<p class="xml-compare-empty">No ${type} found.</p>`;
    const headers = [keyHeader, ...fields];
    const rows = results.map(r => {
      let html = `<tr><td>${esc(r.key)}</td>`;
      const record = r.type === REV_COMPARE_CHANGE_TYPES.MISSING ? r.sourceRecord : r.targetRecord;
      for (const f of fields) {
        html += `<td>${esc(getFieldValue(record, f))}</td>`;
      }
      html += `</tr>`;
      return html;
    }).join('');
    
    const actionsHtml = `<div style="text-align: right; margin-bottom: 4px;">
      <button type="button" class="xmlc-button" data-xml-compare-action="copy-orphan-table" data-table-type="${type}" title="Copy to clipboard">\u2398 Copy</button>
      <button type="button" class="xmlc-button" data-xml-compare-action="export-orphan-csv" data-table-type="${type}" title="Export to CSV">\u2913 CSV</button>
    </div>`;

    return `<div class="xmlc-rev-compare-grid-wrapper" style="overflow-x: auto; margin-bottom: 1em;">
      ${actionsHtml}
      <table class="xmlc-rev-compare-grid" data-xml-compare-orphan-table="${type}" style="white-space: nowrap;">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  };

  return `
    <h4 style="margin-top:0; font-size: 12px; color: #333;">Missing in Target</h4>
    ${renderTable(model.missingResults, 'missing', 'Source Key')}
    <h4 style="font-size: 12px; color: #333;">New in Target</h4>
    ${renderTable(model.newResults, 'new', 'Target Key')}
  `;
}

function renderDeltaGrid(model) {
  const fields = model.compareFields || [];
  if (!fields.length) return '<p class="xml-compare-empty">No fields selected for comparison.</p>';
  
  const headers = ['Source Key', 'Target Key', ...fields.flatMap(f => [`Source ${f}`, `Target ${f}`, `Delta (${f})`, `Delta description (${f})`]), 'Description / Comments Change'];
  
  const rows = model.commonResults.map(r => {
    const isChanged = r.type === 'CHANGED';
    let comment = isChanged ? 'Values changed' : 'No text change';
    if (isChanged && r.changes.length > 0) {
      const parts = r.changes
        .filter(c => c.type !== REV_COMPARE_CHANGE_TYPES.MATCH)
        .map(c => {
          if (c.type === REV_COMPARE_CHANGE_TYPES.NUMERIC_CHANGED) {
             const deltaStr = c.delta > 0 ? `+${c.delta}` : `${c.delta}`;
             return `[${c.field}: ${c.sourceValue} \u2192 ${c.targetValue} (\u0394${deltaStr})]`;
          }
          if (c.type === REV_COMPARE_CHANGE_TYPES.TEXT_CHANGED) {
             return `[${c.field}: "${c.sourceValue}" \u2192 "${c.targetValue}"]`;
          }
          return `[${c.field} changed]`;
        });
      if (parts.length > 0) comment = parts.join(' ');
    }
    
    const rowClass = isChanged ? 'is-changed' : 'is-common';
    // Find target key by checking if there's an IDENTITY_MISMATCH change, or fallback to the same key if it's common.
    // If r.targetUid exists but no mismatch, Target Key == Source Key. If missing, it's empty.
    const identityMismatch = r.changes.find(c => c.type === REV_COMPARE_CHANGE_TYPES.IDENTITY_MISMATCH);
    let targetKey = '';
    if (r.targetUid) targetKey = identityMismatch ? identityMismatch.targetValue : r.key;

    let html = `<tr class="${rowClass}"><td>${esc(r.key)}</td><td>${esc(targetKey)}</td>`;
    
    for (const f of fields) {
      const change = r.changes.find(c => c.field === f);
      if (change) {
        let deltaHtml = change.delta !== undefined ? (change.delta > 0 ? `+${change.delta}` : `${change.delta}`) : '';
        let deltaDesc = '';
        if (change.type === REV_COMPARE_CHANGE_TYPES.NUMERIC_CHANGED) {
          if (Math.abs(change.delta) > (model.revCompareDeltaThreshold || 0)) {
            deltaDesc = `Numeric changed by \u0394${deltaHtml}`;
          } else {
            deltaHtml = '';
            deltaDesc = '';
          }
        } else if (change.type === REV_COMPARE_CHANGE_TYPES.TEXT_CHANGED) {
          deltaDesc = `Text changed`;
          if (change.matchPct !== undefined) {
             deltaHtml = `${change.matchPct}% Match`;
          }
        }
        html += `<td>${esc(change.sourceValue)}</td><td>${esc(change.targetValue)}</td><td>${esc(deltaHtml)}</td><td>${esc(deltaDesc)}</td>`;
      } else {
        html += `<td></td><td></td><td></td><td></td>`;
      }
    }
    html += `<td>${esc(comment)}</td></tr>`;
    return html;
  });

  const actionsHtml = `<div style="text-align: right; margin-bottom: 4px;">
    <button type="button" class="xmlc-button" data-xml-compare-action="copy-delta-table" title="Copy to clipboard">\u2398 Copy</button>
  </div>`;

  return `<div class="xmlc-rev-compare-grid-wrapper" style="overflow-x: auto;">
    ${actionsHtml}
    <table class="xmlc-rev-compare-grid" data-xml-compare-delta-table="main" style="white-space: nowrap;">
    <thead>
      <tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.join('')}
    </tbody>
  </table></div>`;
}

export function renderRevCompareDashboardHtml(workspace) {
  const model = createRevCompareDashboardModel(workspace);
  
  return `<div class="xmlc-rev-compare-dashboard">
    <div class="xml-compare-panel xmlc-transfer-card">
      <div class="xml-compare-panel-title">1. Executive Summary</div>
      ${renderMetricsTable(model.executiveSummary)}
    </div>
    
    <div class="xml-compare-panel xmlc-transfer-card">
      <div class="xml-compare-panel-title">2. Missing &amp; New Identifiers (Critical Identity Blockers)</div>
      ${renderOrphanTables(model)}
    </div>
    
    <div class="xml-compare-panel xmlc-transfer-card">
      <div class="xml-compare-panel-title">
        3. Engineering Delta Grid (Common ${esc(model.activeLevel)}s)
        <label style="float: right; font-weight: normal; font-size: 11px;">
          Display delta when abs(delta) &gt; <input type="number" step="0.1" style="width: 50px;" data-xml-compare-rev-delta-threshold value="${model.revCompareDeltaThreshold || 0}"> mm
        </label>
      </div>
      ${renderDeltaGrid(model)}
    </div>
    
    <div class="xml-compare-transfer-apply-actions xmlc-transfer-output-actions">
      <button type="button" class="xmlc-transfer-action is-export" data-xml-compare-action="export-rev-compare-json">Export JSON</button>
      <button type="button" class="xmlc-transfer-action is-ledger" data-xml-compare-action="export-rev-compare-csv">Export CSV</button>
    </div>
  </div>`;
}

export const _test = Object.freeze({ esc, renderMetricsTable, renderOrphanTables, renderDeltaGrid, renderRevCompareDashboardHtml });

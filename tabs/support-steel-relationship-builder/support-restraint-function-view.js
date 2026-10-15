export function renderSupportRestraintFunctionPanel() {
  return `<section class="ssrb-card ssrb-results-card"><header><div><span class="ssrb-step">8</span><b>Support restraint-function validation</b></div><span class="ssrb-panel-note">Intent and analytical capability remain separate evidence.</span></header><div class="ssrb-rule-grid"><label>Direction offset tolerance mm<input data-ssrf-rule="restraintDirectionToleranceMm" type="number" min="0" step="0.5" value="5"></label><label>Vertical-pipe parallel threshold<input data-ssrf-rule="verticalPipeParallelThreshold" type="number" min="0.5" max="1" step="0.01" value="0.95"></label></div><div class="ssrb-scope-note"><b>Function policy:</b> REST requires -VERTICAL; GUIDE requires both lateral directions; LINE_STOP requires both axial directions; HOLD_DOWN requires +VERTICAL; ANCHOR requires all six translation directions. Physical analytical geometry and a complete carrier-to-structure path are mandatory.</div><div data-ssrf-results class="ssrb-chain-grid">${empty('Build relationships to validate restraint functions.')}</div></section>`;
}

export function renderSupportRestraintFunctionResults(restraint = {}) {
  const summary = restraint.summary || {};
  return `${summaryHtml(summary)}${section('Function assessments', restraint.functionAssessments || [], assessmentTable)}${section('Analytical restraint directions', restraint.restraintEdges || [], directionTable)}${section('Function exceptions', restraint.functionExceptions || [], exceptionTable)}<section class="ssrb-chain-section"><h4>Evidence contract</h4><dl><dt>Schema</dt><dd>${h(restraint.schema || 'Unavailable')}</dd><dt>Fabricated restraint confirmed</dt><dd>No</dd><dt>XML required</dt><dd>No</dd><dt>Evidence boundary</dt><dd>ANALYTICAL_FUNCTION_CANDIDATE</dd></dl></section>`;
}

function summaryHtml(summary) {
  const cards = [
    ['Confirmed', summary.confirmedFamilyCount], ['Partial', summary.partiallyConfirmedFamilyCount],
    ['Conflict', summary.conflictFamilyCount], ['Ambiguous', summary.ambiguousFamilyCount],
    ['Not proven', summary.notProvenFamilyCount], ['Exceptions', summary.exceptionCount],
  ];
  return `<div class="ssrb-summary-strip">${cards.map(([label, value]) => `<div class="ssrb-summary-card"><span>${h(label)}</span><strong>${h(value || 0)}</strong></div>`).join('')}</div>`;
}
function assessmentTable(rows) { return table(['Family', 'Carrier', 'Function', 'Status', 'Required', 'Evidenced'], rows, (row) => [row.supportFamilyId, row.carrierObjectId, row.supportFunction, row.functionStatus, (row.requiredDirections || []).join(' | '), (row.evidencedDirections || []).join(' | ')]); }
function directionTable(rows) { return table(['Family', 'Member', 'Carrier', 'Direction', 'Status'], rows, (row) => [row.supportFamilyId, row.supportMemberId, row.carrierObjectId, row.movementDirection, row.relationshipStatus]); }
function exceptionTable(rows) { return table(['Family', 'Carrier', 'Function', 'Exception', 'Message'], rows, (row) => [row.supportFamilyId, row.carrierObjectId || '—', row.supportFunction || '—', row.exceptionCode, row.message]); }
function section(title, rows, renderer) { return `<section class="ssrb-chain-section"><h4>${h(title)} <span>${rows.length}</span></h4>${rows.length ? renderer(rows) : empty(`No ${title.toLowerCase()}.`)}</section>`; }
function table(headers, rows, projector) { return `<div class="ssrb-table-wrap"><table class="ssrb-table"><thead><tr>${headers.map((row) => `<th>${h(row)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${projector(row).map((value) => `<td>${h(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function empty(message) { return `<div class="ssrb-empty">${h(message)}</div>`; }
function h(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

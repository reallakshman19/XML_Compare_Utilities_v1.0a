export const XML_COMPARE_TRANSFER_WORKFLOW_PANEL_SCHEMA = 'xml-compare-transfer-workflow-panel/v1';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const clean = (value) => String(value ?? '').trim();

function statusClass(status = '') { return `is-${clean(status || 'pending').toLowerCase()}`; }
function diagnosticList(diagnostics = []) {
  if (!diagnostics.length) return '';
  return `<ul>${diagnostics.map((item) => `<li><b>${esc(item.code)}</b> ${esc(item.message)}</li>`).join('')}</ul>`;
}
function stepRow(step = {}) {
  return `<article class="xml-compare-workflow-step ${statusClass(step.status)}"><header><b>${esc(step.label)}</b><span>${esc(step.status)}</span></header><p>${esc(step.message)}</p>${diagnosticList(step.diagnostics || [])}</article>`;
}
function blockerList(blockers = []) {
  if (!blockers.length) return '<small>No workflow blockers.</small>';
  return `<ul>${blockers.map((item) => `<li><b>${esc(item.code)}</b> ${esc(item.message)}</li>`).join('')}</ul>`;
}
export function renderXmlCompareTransferWorkflowPanelHtml({ gate = null } = {}) {
  const state = gate || { steps: [], blockers: [], nextAction: 'Load Source A and Target B.' };
  return `<section class="xml-compare-automap-panel" data-xml-compare-transfer-workflow-panel><header><b>Transfer workflow readiness</b><span>${esc(state.schema || XML_COMPARE_TRANSFER_WORKFLOW_PANEL_SCHEMA)}</span></header><div class="xml-compare-validation-summary"><span><b>Blockers</b><br>${esc(String(state.blockers?.length || 0))}</span><span><b>Next safe action</b><br>${esc(state.nextAction || '-')}</span></div><div class="xml-compare-transfer-workflow-list">${(state.steps || []).map(stepRow).join('')}</div><div class="xml-compare-warning">${blockerList(state.blockers || [])}</div></section>`;
}
export const _test = Object.freeze({ esc, clean, statusClass, diagnosticList, stepRow, blockerList });

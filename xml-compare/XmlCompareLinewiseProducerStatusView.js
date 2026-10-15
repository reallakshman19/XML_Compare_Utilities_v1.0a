export const XML_COMPARE_LINEWISE_PRODUCER_STATUS_VIEW_SCHEMA = 'xml-compare-linewise-producer-status-view/v2-adapter-state';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function statusLabel(status = 'idle') {
  if (status === 'running') return 'Worker categorization running';
  if (status === 'success') return 'Worker categorization passed';
  if (status === 'failed') return 'Worker categorization failed';
  return 'Worker categorization not run';
}

function row(label, value) {
  return `<tr><th>${esc(label)}</th><td>${esc(value || '—')}</td></tr>`;
}

function resultRows(adoption = {}) {
  const result = adoption.result || {};
  return [
    row('Producer ID', result.producer?.id),
    row('Source fingerprint', result.source?.fingerprint || adoption.sourceFingerprint),
    row('Categorized fingerprint', result.artifact?.fingerprint),
    row('Input elements', result.summary?.inputElements),
    row('Categorized elements', result.summary?.categorizedElements),
    row('Categorized lines', result.summary?.categorizedLines),
    row('Diagnostics', result.diagnosticCounts?.total),
  ].join('');
}

export function renderLinewiseProducerStatusHtml(adoption = {}) {
  const status = adoption.status || 'idle';
  const error = adoption.error;
  const tone = status === 'success' ? 'ok' : status === 'failed' ? 'error' : status === 'running' ? 'pending' : 'idle';
  const hasReceipt = status !== 'idle' || Boolean(adoption.result || error);
  return `<details class="xml-compare-linewise-producer-status is-${tone}" ${status === 'failed' ? 'open' : ''}>
    <summary>${esc(statusLabel(status))}</summary>
    <table class="xml-compare-linewise-table"><tbody>${resultRows(adoption)}${error ? row('Error', `${error.code || 'ERROR'}: ${error.message || ''}`) : ''}</tbody></table>
    <div class="xml-compare-linewise-actions">
      <button type="button" data-xml-compare-linewise-action="export-producer-receipt" ${hasReceipt ? '' : 'disabled'}>Download producer receipt JSON</button>
    </div>
  </details>`;
}

export const _test = Object.freeze({ esc, statusLabel, row, resultRows });

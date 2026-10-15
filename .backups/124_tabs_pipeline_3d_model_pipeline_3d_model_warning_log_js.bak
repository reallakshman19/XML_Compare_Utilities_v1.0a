const STYLE_ID = 'pipeline-3d-model-warning-log-style';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function ensureStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-warning-log{flex:0 0 auto;margin-top:6px;border:1px solid rgba(245,158,11,.36);border-radius:9px;background:rgba(120,53,15,.13);overflow:hidden}
.p3d-warning-log>summary{cursor:pointer;padding:8px 10px;color:#fde68a;font-weight:600;list-style-position:inside;user-select:none}
.p3d-warning-log[open]>summary{border-bottom:1px solid rgba(245,158,11,.24)}
.p3d-warning-log-body{max-height:190px;overflow:auto;padding:8px 10px;font-family:monospace;font-size:11px;color:#fef3c7}
.p3d-warning-log-empty{color:#94a3b8}
.p3d-warning-log-entry{display:grid;grid-template-columns:auto 1fr;gap:7px;padding:5px 0;border-bottom:1px solid rgba(148,163,184,.12)}
.p3d-warning-log-entry:last-child{border-bottom:0}
.p3d-warning-log-code{color:#fbbf24;white-space:nowrap}
.p3d-warning-log-detail{margin-top:3px;color:#cbd5e1;white-space:pre-wrap;word-break:break-word}
`;
  doc.head?.appendChild(style);
}

function warningKey(warning) {
  return `${warning?.code || 'warning'}|${warning?.message || ''}`;
}

export function addPipelineWarning(warnings, code, message, details = null) {
  if (!Array.isArray(warnings)) return null;
  const warning = Object.freeze({
    severity: 'warning',
    code: String(code || 'warning'),
    message: String(message || 'Pipeline warning.'),
    details: details && typeof details === 'object' ? Object.freeze({ ...details }) : null,
  });
  if (!warnings.some((entry) => warningKey(entry) === warningKey(warning))) warnings.push(warning);
  return warning;
}

export function warningFromError(error, code = 'pipeline_runtime_warning') {
  const message = error instanceof Error ? error.message : String(error || 'Pipeline operation could not be completed.');
  return Object.freeze({ severity: 'warning', code, message, details: null });
}

export function ensurePipelineWarningLog(dialog) {
  if (!dialog) return null;
  ensureStyle(dialog.ownerDocument || globalThis.document);
  let panel = dialog.querySelector('[data-p3d-warning-log]');
  if (panel) return panel;
  panel = dialog.ownerDocument.createElement('details');
  panel.className = 'p3d-warning-log';
  panel.dataset.p3dWarningLog = '1';
  panel.innerHTML = `<summary>Warning Log (<span data-p3d-warning-count>0</span>)</summary><div class="p3d-warning-log-body" data-p3d-warning-body><div class="p3d-warning-log-empty">No warnings.</div></div>`;
  const output = dialog.querySelector('.p3d-output') || dialog;
  output.appendChild(panel);
  return panel;
}

function detailsHtml(details) {
  if (!details || !Object.keys(details).length) return '';
  return `<div class="p3d-warning-log-detail">${escapeHtml(JSON.stringify(details, null, 2))}</div>`;
}

export function renderPipelineWarningLog(dialog, warnings = []) {
  const panel = ensurePipelineWarningLog(dialog);
  if (!panel) return null;
  const entries = Array.isArray(warnings) ? warnings : [];
  const count = panel.querySelector('[data-p3d-warning-count]');
  const body = panel.querySelector('[data-p3d-warning-body]');
  if (count) count.textContent = String(entries.length);
  if (body) {
    body.innerHTML = entries.length
      ? entries.map((warning, index) => `<div class="p3d-warning-log-entry" data-p3d-warning-entry="${index}"><span class="p3d-warning-log-code">${escapeHtml(warning.code || 'warning')}</span><div>${escapeHtml(warning.message || 'Pipeline warning.')}${detailsHtml(warning.details)}</div></div>`).join('')
      : '<div class="p3d-warning-log-empty">No warnings.</div>';
  }
  return panel;
}

export const _test = Object.freeze({ warningKey });

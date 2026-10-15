import { renderFindReplacePanel } from './cii-workspace-find-replace.js';
import { buildFindReplaceDownloadArtifact } from './cii-workspace-find-replace-output.js';
import {
  applyFindReplaceToNewCopy,
  createFindReplaceSession,
  decideFindReplaceRow,
  qualifyFindReplaceSession,
  replaceFindReplaceEditorRows,
  resetFindReplaceDecisions,
  summarizeFindReplaceSession,
  withFindReplaceCsv,
  withFindReplaceMode,
  withFindReplaceTarget,
} from './cii-workspace-find-replace-session.js';
import {
  analyzeFindReplaceEditorRows,
  editorFieldsForMode,
  findReplaceRowsToTsv,
  normalizeFindReplaceReplacement,
  parseFindReplaceSpreadsheetPaste,
} from './cii-workspace-find-replace-editor-model.js';
import {
  diagnosticRowsHtml,
  editorRowHtml,
  normalizeGridBlock,
  previewText,
  statusMessage,
} from './cii-workspace-find-replace-editor-view.js';

function downloadBlob(documentRef, name, blob) {
  const href = URL.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = href; link.download = name; link.hidden = true;
  documentRef.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(href);
}
function defaultDownloadJson(documentRef, name, value) {
  downloadBlob(documentRef, name, new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
}
function defaultDownloadText(documentRef, artifact) {
  downloadBlob(documentRef, artifact.fileName, new Blob([artifact.text], { type: artifact.mimeType }));
}
function shortHash(value) { const text = String(value || ''); return text ? `${text.slice(0, 16)}…` : '—'; }
function rawReplacement(row) { return String(row?.rawReplaceText ?? row?.replaceText ?? row?.after ?? ''); }
function operationSignature(value, mode = value?.scope || 'DOCUMENT') {
  const scope = String(mode || value?.scope || 'DOCUMENT').trim().toUpperCase();
  const hasRange = scope !== 'DOCUMENT';
  const hasBlock = scope === 'BLOCK';
  return JSON.stringify([
    String(value?.findText ?? value?.before ?? ''), rawReplacement(value),
    hasRange ? String(value?.from ?? '') : '', hasRange ? String(value?.to ?? '') : '',
    hasBlock ? normalizeGridBlock(value?.block || '') : '',
  ]);
}
function qualificationLabel(currentSession, summary) {
  if (summary?.appliedToNewCopy) return 'APPLIED TO NEW COPY';
  if (summary?.qualified) return 'QUALIFIED PREVIEW';
  if (currentSession?.status === 'VALIDATION_FAILED') return 'VALIDATION FAILED';
  if (currentSession?.status === 'POSTIMAGE_BLOCKED') return 'POSTIMAGE BLOCKED';
  if (currentSession?.status === 'QUALIFICATION_BLOCKED') return 'QUALIFICATION BLOCKED';
  return '—';
}

export function mountCiiFindReplaceShell(host, context = {}) {
  const documentRef = host.ownerDocument;
  const wrapper = documentRef.createElement('div');
  wrapper.innerHTML = renderFindReplacePanel(); host.appendChild(wrapper);
  const root = wrapper.querySelector('[data-ciifr-workspace]');
  let session = createFindReplaceSession();

  const refs = {
    target: root.querySelector('[data-ciifr-target]'), csv: root.querySelector('[data-ciifr-csv]'),
    targetMeta: root.querySelector('[data-ciifr-target-meta]'), csvMeta: root.querySelector('[data-ciifr-csv-meta]'),
    grid: root.querySelector('[data-ciifr-editor-grid]'), body: root.querySelector('[data-ciifr-preview-body]'),
    diagnosticSummary: root.querySelector('[data-ciifr-diagnostic-summary]'), diagnosticLog: root.querySelector('[data-ciifr-diagnostic-log]'),
    status: root.querySelector('[data-ciifr-status]'), validate: root.querySelector('[data-ciifr-validate]'),
    approveAll: root.querySelector('[data-ciifr-approve-all]'), reset: root.querySelector('[data-ciifr-reset]'),
    apply: root.querySelector('[data-ciifr-apply]'), audit: root.querySelector('[data-ciifr-export-audit]'),
    download: root.querySelector('[data-ciifr-download]'),
  };

  const editorRows = () => [...refs.body.querySelectorAll('[data-ciifr-editor-row]')];
  const value = (row, field) => row.querySelector(`[data-ciifr-editor-field="${field}"]`)?.value ?? '';
  function editorInput(row) {
    return {
      source: row.getAttribute('data-ciifr-source') || 'MANUAL',
      findText: value(row, 'findText'), replaceText: value(row, 'replaceText'),
      from: value(row, 'from'), to: value(row, 'to'), block: value(row, 'block'),
    };
  }
  function isEmpty(input) {
    return editorFieldsForMode(session.mode).filter((field) => field !== 'block')
      .every((field) => String(input?.[field] ?? '').trim() === '');
  }
  function activeEditorInputs() {
    return editorRows().map((element) => ({ element, input: editorInput(element) })).filter(({ input }) => !isEmpty(input));
  }
  function ensureEditorRows(count) {
    while (editorRows().length < count) refs.body.insertAdjacentHTML('beforeend', editorRowHtml(null, editorRows().length));
    renderScope();
  }
  function setEditorCell(row, field, nextValue) {
    const control = row.querySelector(`[data-ciifr-editor-field="${field}"]`); if (!control) return;
    if (field !== 'block') { control.value = String(nextValue ?? ''); return; }
    const normalized = normalizeGridBlock(nextValue);
    if (normalized && ![...control.options].some((option) => option.value === normalized)) {
      const option = documentRef.createElement('option'); option.value = normalized;
      option.textContent = `${normalized} — unsupported`; option.disabled = true; control.appendChild(option);
    }
    control.value = normalized || 'NODENAME';
  }

  function syncEditorSession() {
    const previous = [...session.rows]; const active = activeEditorInputs();
    let next = replaceFindReplaceEditorRows(session, active.map(({ input }) => input));
    next.rows.forEach((row, index) => {
      const before = previous[index];
      if (!before || operationSignature(before, session.mode) !== operationSignature(active[index]?.input, session.mode)) return;
      if (before.status === 'APPROVED' || before.status === 'REJECTED') next = decideFindReplaceRow(next, row.sequence, before.status);
    });
    session = next;
    active.forEach(({ element }, index) => {
      const row = session.rows[index]; element.setAttribute('data-ciifr-sequence', String(row.sequence));
      element.setAttribute('data-ciifr-source', row.source || 'MANUAL');
    });
    return active;
  }

  function operationSummaries() { return session.qualification?.preimage?.operationSummaries || []; }
  function diagnostics() { return analyzeFindReplaceEditorRows(session.rows, operationSummaries()); }
  function rowCodes(diag, sequence) {
    return diag.entries.filter((entry) => entry.sequences.includes(sequence)).map((entry) => entry.code);
  }
  function decisionMarkup(row) {
    return row.status === 'BLOCKED' ? '<span>Blocked</span>'
      : '<button type="button" data-ciifr-decision="APPROVED">Approve</button> <button type="button" data-ciifr-decision="REJECTED">Reject</button>';
  }
  function refreshLiveRows(active, diag) {
    active.forEach(({ element }, index) => {
      const row = session.rows[index]; if (!row) return;
      element.querySelector('[data-ciifr-row-source]').textContent = row.source || 'MANUAL';
      const normalized = normalizeFindReplaceReplacement(rawReplacement(row));
      const hint = normalized.normalized && normalized.valid ? ` — using ${row.replaceText}` : '';
      element.querySelector('[data-ciifr-row-status]').textContent = `${row.status}${hint}`;
      element.querySelector('[data-ciifr-row-log]').textContent = rowCodes(diag, row.sequence).join(', ');
      element.querySelector('[data-ciifr-row-decision]').innerHTML = decisionMarkup(row);
    });
    for (const button of refs.body.querySelectorAll('[data-ciifr-decision="APPROVED"]')) {
      const sequence = Number(button.closest('[data-ciifr-editor-row]')?.getAttribute('data-ciifr-sequence'));
      button.disabled = diag.blockedSequences.includes(sequence);
    }
  }

  function renderScope() {
    const showRange = session.mode !== 'DOCUMENT'; const showBlock = session.mode === 'BLOCK';
    for (const node of root.querySelectorAll('[data-ciifr-grid-range]')) node.hidden = !showRange;
    for (const node of root.querySelectorAll('[data-ciifr-grid-block]')) node.hidden = !showBlock;
  }
  function renderRows() {
    const count = Math.max(3, session.rows.length + 1);
    refs.body.innerHTML = Array.from({ length: count }, (_, index) => editorRowHtml(session.rows[index] || null, index)).join('');
    renderScope();
  }
  function renderDiagnostics(diag = diagnostics()) {
    refs.diagnosticSummary.textContent = `${diag.counts.error} error(s), ${diag.counts.info} info`;
    refs.diagnosticLog.innerHTML = diagnosticRowsHtml(diag);
    const active = activeEditorInputs(); refreshLiveRows(active, diag); return diag;
  }
  function renderQualification(summary) {
    root.querySelector('[data-ciifr-source-hash]').textContent = shortHash(summary.sourceHash);
    root.querySelector('[data-ciifr-claims]').textContent = String(session.qualification?.preimage?.claims?.length || 0);
    root.querySelector('[data-ciifr-target-hash]').textContent = shortHash(session.qualification?.postimage?.audit?.targetHash);
    root.querySelector('[data-ciifr-qualification]').textContent = qualificationLabel(session, summary);
    root.querySelector('[data-ciifr-postimage-preview]').textContent = previewText(session);
  }
  function renderControlState(diag = diagnostics()) {
    const summary = summarizeFindReplaceSession(session);
    refs.targetMeta.textContent = session.target ? `${session.target.name} — v${session.target.version ?? '?'} — ${shortHash(session.target.hash)}` : 'No target loaded.';
    refs.csvMeta.textContent = session.csv ? `${session.csv.name} — ${session.csv.status}` : 'No CSV loaded. Paste Find / Replace columns directly into the editor.';
    refs.status.textContent = statusMessage(session, summary, diag);
    refs.validate.disabled = diag.hasErrors || !summary.canValidate;
    refs.approveAll.disabled = session.rows.every((row) => row.status !== 'PROPOSED');
    refs.reset.disabled = (summary.approved + summary.rejected) === 0;
    refs.apply.disabled = !summary.canApplyToNewCopy; refs.audit.disabled = !summary.qualified; refs.download.disabled = !summary.canDownload;
    renderQualification(summary);
  }
  function render() { renderRows(); const diag = renderDiagnostics(); renderControlState(diag); }

  async function onTargetChange() {
    const file = refs.target.files?.[0]; if (!file) return;
    session = withFindReplaceTarget(session, { name: file.name, text: await file.text() }); render();
  }
  async function onCsvChange() {
    const file = refs.csv.files?.[0]; if (!file) return;
    session = withFindReplaceCsv(session, { name: file.name, text: await file.text(), mode: session.mode }); render();
  }
  function onScopeChange(event) { if (event.target.checked) { session = withFindReplaceMode(session, event.target.value); render(); } }
  function onAddRow() { ensureEditorRows(editorRows().length + 1); editorRows().at(-1)?.querySelector('[data-ciifr-editor-field="findText"]')?.focus(); }
  function onClearGrid() { session = replaceFindReplaceEditorRows(session, []); render(); }
  function onEditorInput() { const active = syncEditorSession(); const diag = diagnostics(); refreshLiveRows(active, diag); renderDiagnostics(diag); renderControlState(diag); }
  function onDeleteRow(event) {
    const button = event.target.closest?.('[data-ciifr-delete-row]'); if (!button) return;
    button.closest('[data-ciifr-editor-row]')?.remove(); syncEditorSession(); render();
  }
  function onPaste(event) {
    const control = event.target.closest?.('[data-ciifr-editor-field]'); if (!control) return;
    const text = event.clipboardData?.getData('text/plain'); if (text == null) return;
    const matrix = parseFindReplaceSpreadsheetPaste(text); if (!matrix.length) return; event.preventDefault();
    const fields = editorFieldsForMode(session.mode); const startField = fields.indexOf(control.getAttribute('data-ciifr-editor-field'));
    const startRow = editorRows().indexOf(control.closest('[data-ciifr-editor-row]')); if (startField < 0 || startRow < 0) return;
    ensureEditorRows(startRow + matrix.length); const rows = editorRows();
    matrix.forEach((cells, rowOffset) => cells.forEach((cell, columnOffset) => {
      const field = fields[startField + columnOffset]; if (field) setEditorCell(rows[startRow + rowOffset], field, cell);
    }));
    syncEditorSession(); render();
  }
  function onKeyDown(event) {
    const control = event.target.closest?.('[data-ciifr-editor-field]');
    if (!control || event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); const field = control.getAttribute('data-ciifr-editor-field');
    const rowIndex = editorRows().indexOf(control.closest('[data-ciifr-editor-row]')); if (rowIndex < 0) return;
    ensureEditorRows(rowIndex + 2); editorRows()[rowIndex + 1]?.querySelector(`[data-ciifr-editor-field="${field}"]`)?.focus();
  }
  async function onCopyGrid() {
    const text = findReplaceRowsToTsv(session.rows); if (!text) return;
    const clipboard = documentRef.defaultView?.navigator?.clipboard;
    if (!clipboard?.writeText) { context.showToast?.('Copy unavailable: browser clipboard permission is not available.'); return; }
    await clipboard.writeText(text); context.showToast?.(`Copied ${session.rows.length} Find / Replace row(s).`);
  }
  function onDecision(event) {
    const button = event.target.closest?.('[data-ciifr-decision]'); if (!button) return;
    syncEditorSession(); const sequence = Number(button.closest('[data-ciifr-editor-row]')?.getAttribute('data-ciifr-sequence'));
    const diag = diagnostics();
    if (button.getAttribute('data-ciifr-decision') === 'APPROVED' && diag.blockedSequences.includes(sequence)) {
      context.showToast?.('Approve blocked: resolve the row conflict/duplicate first.'); return;
    }
    session = decideFindReplaceRow(session, sequence, button.getAttribute('data-ciifr-decision')); render();
  }
  function onApproveAll() {
    syncEditorSession(); const diag = diagnostics();
    for (const row of session.rows) if (row.status === 'PROPOSED' && !diag.blockedSequences.includes(row.sequence)) session = decideFindReplaceRow(session, row.sequence, 'APPROVED');
    render();
  }
  function onReset() { session = resetFindReplaceDecisions(session); render(); }
  function onValidate() {
    syncEditorSession(); const diag = diagnostics();
    if (diag.hasErrors) { render(); context.showToast?.('Validation blocked: resolve the diagnostic log first.'); return; }
    session = qualifyFindReplaceSession(session); render();
  }
  function onApply() { session = applyFindReplaceToNewCopy(session); render(); }
  function onAudit() {
    const audit = session.qualification?.postimage?.audit; if (!audit) return;
    (context.downloadJson || ((name, value) => defaultDownloadJson(documentRef, name, value)))('cii-find-replace-audit.json', audit);
  }
  function onDownload() {
    if (session.release?.status !== 'APPLIED_TO_NEW_COPY') return;
    const result = buildFindReplaceDownloadArtifact(session);
    if (result.status !== 'READY_FOR_DOWNLOAD') { context.showToast?.(`Download blocked: ${result.blockers.join(', ')}`); return; }
    if (result.artifact.receipt.targetHash !== session.release.targetHash) { context.showToast?.('Download blocked: applied TARGET1 hash no longer matches the qualified output.'); return; }
    (context.downloadText || ((artifact) => defaultDownloadText(documentRef, artifact)))(result.artifact);
  }

  const listeners = [
    [refs.target, 'change', onTargetChange], [refs.csv, 'change', onCsvChange],
    [root.querySelector('[data-ciifr-add-row]'), 'click', onAddRow], [root.querySelector('[data-ciifr-clear-grid]'), 'click', onClearGrid],
    [root.querySelector('[data-ciifr-copy-grid]'), 'click', onCopyGrid], [refs.body, 'click', onDeleteRow], [refs.body, 'click', onDecision],
    [refs.grid, 'input', onEditorInput], [refs.grid, 'paste', onPaste], [refs.grid, 'keydown', onKeyDown],
    [refs.approveAll, 'click', onApproveAll], [refs.reset, 'click', onReset], [refs.validate, 'click', onValidate],
    [refs.apply, 'click', onApply], [refs.audit, 'click', onAudit], [refs.download, 'click', onDownload],
    [root.querySelector('[data-ciifr-close]'), 'click', context.close || (() => {})],
  ];
  for (const scope of root.querySelectorAll('[data-ciifr-scope]')) listeners.push([scope, 'change', onScopeChange]);
  for (const [node, type, handler] of listeners) node?.addEventListener(type, handler);
  render();
  return Object.freeze({
    destroy() { for (const [node, type, handler] of listeners) node?.removeEventListener(type, handler); wrapper.remove(); },
    getSession() { return session; },
  });
}

export const _test = Object.freeze({ operationSignature, rawReplacement, qualificationLabel });
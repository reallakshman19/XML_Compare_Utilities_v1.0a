/** Escaped bounded UI for current and historical offline transfer archives. */
import { revisionCompareTransferArchiveReadiness } from './revision-transfer-archive.js';
const CSS = `.revc-transfer-archive{display:grid;gap:1rem;padding:1rem;border:1px solid var(--border,#445);border-radius:.75rem}.revc-transfer-archive>header{display:flex;justify-content:space-between;gap:1rem}.revc-transfer-archive dd{overflow-wrap:anywhere}`;
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function blockers(values) { return values?.length ? `<ul data-revc-transfer-archive-blockers>${values.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>` : ''; }
export function revisionCompareTransferArchiveMarkup(state) {
  const archive = state?.transferArchive; const completion = state?.transferCompletion;
  if (!archive?.artifact && !completion?.report && !completion?.bundle) return '';
  const readiness = revisionCompareTransferArchiveReadiness(state); const current = archive?.status === 'CREATED'; const historical = archive?.status === 'STALE'; const artifact = archive?.artifact;
  const label = historical ? '<p class="revc-stale-notice"><strong>Historical archive</strong> — this retained presentation no longer matches current authority.</p>' : '';
  const facts = artifact ? `<dl><div><dt>HTML SHA-256</dt><dd data-revc-transfer-archive-sha>${escape(artifact.contentSha256)}</dd></div><div><dt>UTF-8 byte size</dt><dd data-revc-transfer-archive-size>${escape(artifact.sizeBytes)}</dd></div></dl>` : '';
  const actions = artifact ? `<div class="revc-session-actions"><button type="button" data-revc-download-transfer-archive>Download offline transfer archive</button><button type="button" data-revc-print-transfer-archive>Print / Save as PDF</button></div>` : '';
  const create = current ? '' : `<button type="button" ${artifact ? 'data-revc-create-new-transfer-archive' : 'data-revc-create-transfer-archive'} disabled>${artifact ? 'Create new offline transfer archive' : 'Create offline transfer archive'}</button>`;
  return `<style>${CSS}</style><section class="revc-transfer-archive" data-revc-transfer-archive-section><header><div><span>OFFLINE HANDOVER</span><h2>Deterministic offline transfer archive</h2><p>Presentation-only HTML generated from the exact retained transfer handover bundle.</p></div><strong data-revc-transfer-archive-status="${escape(archive?.status ?? 'IDLE')}">${escape(archive?.status ?? 'IDLE')}</strong></header>${label}${blockers(current ? [] : readiness.blockers)}${archive?.error ? blockers([archive.error]) : ''}${facts}<div class="revc-session-actions">${create}</div>${actions}</section>`;
}
export function renderRevisionCompareTransferArchiveSection(root, state) { const host = root.querySelector('.revc-review-side'); if (!host) return null; const markup = revisionCompareTransferArchiveMarkup(state); if (!markup) return null; host.insertAdjacentHTML('beforeend', markup); return host.querySelector('[data-revc-transfer-archive-section]'); }
export const _test = Object.freeze({ blockers, escape });

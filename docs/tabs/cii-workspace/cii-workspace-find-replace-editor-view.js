import { normalizeFindReplaceReplacement } from './cii-workspace-find-replace-editor-model.js';

const SUPPORTED_GRID_BLOCKS = Object.freeze([
  Object.freeze(['NODENAME', 'NODE NAME']),
  Object.freeze(['DISPLACEMENT', 'DISPLACEMENT']),
]);

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function normalizeGridBlock(value) {
  const text = String(value ?? '').trim();
  const compact = text.toUpperCase().replace(/[\s_-]+/g, '');
  if (compact === 'NODENAME') return 'NODENAME';
  if (compact === 'DISPLACEMENT' || compact === 'DISPLMNT') return 'DISPLACEMENT';
  if (compact === 'FORCE' || compact === 'FORCMNT') return 'FORCE';
  return text.toUpperCase();
}

export function blockOptions(selected = 'NODENAME') {
  const value = normalizeGridBlock(selected) || 'NODENAME';
  const options = SUPPORTED_GRID_BLOCKS.map(([candidate, label]) => [candidate, label, false]);
  if (value && !options.some(([candidate]) => candidate === value)) options.push([value, `${value} — unsupported`, true]);
  return options.map(([candidate, label, disabled]) =>
    `<option value="${escapeHtml(candidate)}"${candidate === value ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(label)}</option>`).join('');
}

function editorValue(row, field) {
  if (!row) return '';
  if (field === 'replaceText') return row.rawReplaceText ?? row.replaceText ?? row.after ?? '';
  if (field === 'findText') return row.findText ?? row.before ?? '';
  return row[field] ?? '';
}

function decisionHtml(row) {
  if (!row) return '';
  if (row.status === 'BLOCKED') return '<span>Blocked</span>';
  return `<button type="button" data-ciifr-decision="APPROVED">Approve</button>
    <button type="button" data-ciifr-decision="REJECTED">Reject</button>`;
}

export function editorRowHtml(row, index) {
  const number = index + 1;
  const raw = String(editorValue(row, 'replaceText'));
  const normalization = normalizeFindReplaceReplacement(raw);
  const effective = row?.replaceText ?? normalization.effective;
  const effectiveHint = normalization.normalized && normalization.valid
    ? `<small>Using: <code>${escapeHtml(effective)}</code></small>` : '';
  const blockers = row?.blockers?.length ? `<small>${escapeHtml(row.blockers.join(', '))}</small>` : '';
  const source = row?.source || (row ? 'MANUAL' : '');
  return `<tr data-ciifr-editor-row data-ciifr-sequence="${row?.sequence ?? ''}" data-ciifr-source="${escapeHtml(source)}">
    <th class="ciifr-sheet-row-number" scope="row">${number}</th>
    <td><input type="text" data-ciifr-editor-field="findText" value="${escapeHtml(editorValue(row, 'findText'))}" aria-label="Find row ${number}"></td>
    <td><input type="text" data-ciifr-editor-field="replaceText" value="${escapeHtml(raw)}" aria-label="Replace row ${number}"></td>
    <td data-ciifr-grid-range><input type="number" min="0" step="1" data-ciifr-editor-field="from" value="${escapeHtml(editorValue(row, 'from'))}" aria-label="From row ${number}"></td>
    <td data-ciifr-grid-range><input type="number" min="0" step="1" data-ciifr-editor-field="to" value="${escapeHtml(editorValue(row, 'to'))}" aria-label="To row ${number}"></td>
    <td data-ciifr-grid-block><select data-ciifr-editor-field="block" aria-label="Block row ${number}">${blockOptions(editorValue(row, 'block'))}</select></td>
    <td data-ciifr-row-source>${escapeHtml(source)}</td>
    <td><b data-ciifr-row-status>${escapeHtml(row?.status || '')}</b>${blockers}${effectiveHint}</td>
    <td data-ciifr-row-log></td>
    <td data-ciifr-row-decision>${decisionHtml(row)}</td>
    <td class="ciifr-sheet-action"><button type="button" data-ciifr-delete-row title="Delete row ${number}" aria-label="Delete row ${number}">×</button></td>
  </tr>`;
}

export function diagnosticRowsHtml(diagnostics) {
  if (!diagnostics?.entries?.length) return '<tr><td colspan="4">No conflicts, duplicates, or validation diagnostics.</td></tr>';
  return diagnostics.entries.map((entry) => `<tr>
    <td><b>${escapeHtml(entry.severity)}</b></td>
    <td><code>${escapeHtml(entry.code)}</code></td>
    <td>${escapeHtml(entry.sequences.join(', '))}</td>
    <td>${escapeHtml(entry.message)}</td>
  </tr>`).join('');
}

function reviewCounts(summary) {
  return `${summary.approved} approved, ${summary.rejected} rejected, ${summary.proposed} awaiting review`;
}

export function statusMessage(session, summary, diagnostics) {
  if (session.status === 'TARGET_VERSION_BLOCKED') return `Blocked: target is not CII v14 (${session.errors.join(', ')}).`;
  if (session.status === 'CSV_INVALID') return `CSV invalid: ${session.errors.join(', ')}`;
  if (diagnostics?.hasErrors) return `${diagnostics.counts.error} editor/validation error(s) logged. Resolve conflicts, duplicates, or blockers before validation.`;
  if (['VALIDATION_FAILED', 'POSTIMAGE_BLOCKED', 'QUALIFICATION_BLOCKED', 'APPLY_TO_NEW_COPY_BLOCKED'].includes(session.status)) return `Blocked: ${session.errors.join(', ')}`;
  if (summary.appliedToNewCopy) return 'Applied to a new validated output copy. TARGET0 is unchanged; Export Replaced CII is now available.';
  if (session.status === 'QUALIFIED_PREVIEW') return `Qualified preview: ${session.qualification.preimage.claims.length} TARGET0-relative claim(s). Click Apply to New Copy to explicitly release TARGET1; TARGET0 remains unchanged.`;
  if (!summary.targetLoaded) return 'Load a CII v14 target.';
  if (!session.rows.length) return 'Target loaded. Type or paste Find / Replace rows into the editor.';
  if (summary.blocked) return `${summary.blocked} row(s) blocked; ${reviewCounts(summary)}. Resolve blockers before validation.`;
  if (summary.proposed) return `${reviewCounts(summary)}. Approve or reject every pending row before validation.`;
  if (summary.canValidate) return `Review complete — ${summary.approved} approved, ${summary.rejected} rejected. Validate & Preview to build a qualified in-memory TARGET1.`;
  if (summary.approved === 0 && summary.rejected === summary.total) {
    return `All ${summary.rejected} replacement row(s) are rejected. Reset decisions or approve at least one row before validation.`;
  }
  return `Review incomplete — ${reviewCounts(summary)}. Approve at least one replacement row before validation.`;
}

export function previewText(session) {
  const target1 = session.qualification?.postimage?.target1;
  if (!target1) return 'No qualified postimage yet.';
  const limit = 12000;
  return target1.length <= limit ? target1 : `${target1.slice(0, limit)}\n\n… preview truncated; full postimage retained in memory.`;
}

export const _test = Object.freeze({ editorValue, decisionHtml, reviewCounts, SUPPORTED_GRID_BLOCKS });

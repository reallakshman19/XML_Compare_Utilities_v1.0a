// Candidate review UI: renders anchor controls, AIM transfer settings, and candidate-pair
// tables for numeric or string matching. Inputs are the workspace model and user AIM state;
// output is static HTML consumed by the XML Compare tab event handlers. No data fallback is
// performed here: unavailable candidates render as explicit empty states.
export const XML_COMPARE_ANCHOR_REVIEW_PANEL_SCHEMA = 'xml-compare-anchor-review-panel/v1';

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const clean = (value) => String(value ?? '').trim();
const label = (record = {}) => clean(record.displayName || record.nodeName || record.nodeNumber || record.elementKey || record.uid);
const mm = (value) => (value == null ? '-' : Number(value).toFixed(3));
const pct = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const STATUS_LABEL = Object.freeze({ valid: 'VALID', review: 'REVIEW', conflict: 'CONFLICT', 'no-target': 'NO TARGET' });
const APPROVAL_LABEL = Object.freeze({ approved: 'APPROVED', pending: 'PENDING', rejected: 'REJECTED', blocked: 'BLOCKED', anchor: 'ANCHOR' });
const NODE_TRANSFER_BLOCKS = Object.freeze(['DerivedCoordinateBlock', 'TemperatureBlock', 'RestraintsBlock', 'DisplacementsBlock', 'ForcesMomentsBlock', 'SifBlock']);
import { readFieldValue } from './XmlCompareFieldExtractor.js';

function anchorRail(workspace = {}) {
  const anchor = workspace.anchor || null;
  const selected = workspace.selectedRecords || {};
  const readySet = selected.source && selected.target;
  return `<div class="xmlc-anchor-rail">
    <div class="xmlc-anchor-cell"><b>Anchor (base pair)</b><span>${anchor ? `${esc(anchor.sourceUid)} &harr; ${esc(anchor.targetUid)}` : 'not set'}</span></div>
    <div class="xmlc-anchor-cell"><b>Selected</b><span>${selected.source ? esc(label(selected.source)) : '(pick a Source node)'} &harr; ${selected.target ? esc(label(selected.target)) : '(pick a Target node)'}</span></div>
    <div class="xmlc-anchor-actions">
      <button type="button" data-xml-compare-action="auto-map-node" ${readySet ? '' : 'disabled'}>Set anchor pair</button>
      <button type="button" data-xml-compare-action="clear-auto-map" ${anchor ? '' : 'disabled'}>Clear Anchor</button>
    </div>
  </div>`;
}

function transferBlockNames(workspace = {}, selected = new Set()) {
  const available = Array.isArray(workspace.availableTransferBlocks) && workspace.availableTransferBlocks.length ? workspace.availableTransferBlocks : NODE_TRANSFER_BLOCKS;
  return [...new Set([...available, ...selected])];
}

function transferBlockSourceLabel(workspace = {}) {
  const discovered = Array.isArray(workspace.availableTransferBlocks) && workspace.availableTransferBlocks.length;
  const count = discovered ? workspace.availableTransferBlocks.length : NODE_TRANSFER_BLOCKS.length;
  return `${discovered ? 'XML discovered' : 'Fallback defaults'} - ${count} block${count === 1 ? '' : 's'}`;
}

function connectorRow(workspace = {}) {
  const available = workspace.availableConnectors || [];
  if (!workspace.anchor || !available.length) return '';
  const enabled = new Set(workspace.enabledConnectorFields || ['lineNo']);
  const nameActive = workspace.aim?.basis === 'name';
  const items = available.map((c) => c.sameLevel
    ? `<label class="xmlc-conn is-samelevel" title="match by node name (same level)"><input type="checkbox" data-xml-compare-aim-name-connector ${nameActive ? 'checked' : ''}> <b>${esc(c.label)}</b> <span class="xmlc-conn-map">${esc(c.sourceValue)} &harr; ${esc(c.targetValue)}</span></label>`
    : `<label class="xmlc-conn" title="accepted parent mapping, not equality"><input type="checkbox" data-xml-compare-aim-connector="${esc(c.field)}" ${enabled.has(c.field) ? 'checked' : ''}> <b>${esc(c.label)}</b> <span class="xmlc-conn-map">${esc(c.sourceValue)} &harr; ${esc(c.targetValue)}</span></label>`).join('');
  return `<div class="xmlc-aim-row"><b>Connectors</b><div class="xmlc-conn-list">${items}</div></div>`;
}

function connectorOptionLabel(conn = {}) { return `${conn.label}: ${conn.sourceValue} <-> ${conn.targetValue}`; }

function selectedConnectorValue(workspace = {}) {
  if (workspace.aim?.basis === 'name') return `same:${(workspace.availableConnectors || []).find((conn) => conn.sameLevel)?.field || 'nodeName'}`;
  const enabled = new Set(workspace.enabledConnectorFields || ['lineNo']);
  const active = (workspace.availableConnectors || []).filter((conn) => !conn.sameLevel && enabled.has(conn.field));
  return active.length === 1 ? `parent:${active[0].field}` : (active.length > 1 ? `parent-multi:${active.map((conn) => conn.field).join('|')}` : 'none');
}

function connectorSelectRow(workspace = {}) {
  const available = workspace.availableConnectors || [];
  if (!workspace.anchor) return '<div class="xmlc-aim-row"><b>Connector:</b><span class="xmlc-muted">Set anchor pair first</span></div>';
  if (!available.length) return '<div class="xmlc-aim-row"><b>Connector:</b><span class="xmlc-muted">No common fields detected</span></div>';
  const selected = selectedConnectorValue(workspace);
  const active = available.filter((conn) => !conn.sameLevel && (workspace.enabledConnectorFields || []).includes(conn.field));
  const current = selected.startsWith('parent-multi:') ? `<option value="${esc(selected)}" selected disabled>${esc(`Active: ${active.map((conn) => conn.label).join(' + ')}`)}</option>` : '';
  const options = [`<option value="none" ${selected === 'none' ? 'selected' : ''}>None</option>`, current, ...available.map((conn) => {
    const value = `${conn.sameLevel ? 'same' : 'parent'}:${conn.field}`;
    return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(connectorOptionLabel(conn))}</option>`;
  })].join('');
  return `<div class="xmlc-aim-row"><b>Connector:</b><select data-xml-compare-main-connector>${options}</select><small class="xmlc-block-source">${esc(available.length)} option(s) from selected anchor</small></div>`;
}

function transferBlockRow(workspace = {}, blocks = new Set()) {
  const blockChecks = transferBlockNames(workspace, blocks).map((name) => `<label class="xmlc-block-chk"><input type="checkbox" data-xml-compare-aim-block="${esc(name)}" ${blocks.has(name) ? 'checked' : ''}> ${esc(name)}</label>`).join('');
  return `<div class="xmlc-aim-row"><b>Blocks to transfer</b><small class="xmlc-block-source">${esc(transferBlockSourceLabel(workspace))}</small><div class="xmlc-block-checks">${blockChecks}</div></div>`;
}

function aimConfig(workspace = {}) {
  const aim = workspace.aim || {};
  const basis = aim.basis === 'name' ? 'name' : 'coordinate';
  const blocks = new Set(aim.transferBlocks || []);
  const tol = aim.tolerance || {};
  const nameControls = basis === 'name'
    ? `<label>Name field <input data-xml-compare-aim-name-field value="${esc(aim.nameField || 'nodeName')}" style="width:110px"></label>
       <label>Delimiter <input data-xml-compare-aim-name-delimiter value="${esc(aim.nameDelimiter || '')}" style="width:44px" placeholder="."></label>
       <label>Token # <input type="number" min="0" data-xml-compare-aim-name-position value="${esc(aim.namePosition || 0)}" style="width:56px" title="0 = whole name; N = Nth delimiter token"></label>`
    : `<label title="|Delta x| within">&plusmn;X <input type="number" min="0" data-xml-compare-aim-tolerance="x" value="${esc(tol.x ?? 1000)}" style="width:70px"></label>
       <label title="|Delta y| within">&plusmn;Y <input type="number" min="0" data-xml-compare-aim-tolerance="y" value="${esc(tol.y ?? 1000)}" style="width:70px"></label>
       <label title="|Delta z| within">&plusmn;Z <input type="number" min="0" data-xml-compare-aim-tolerance="z" value="${esc(tol.z ?? 500)}" style="width:70px"></label>`;
  return `<div class="xmlc-aim-config">
    <div class="xmlc-aim-row"><b>Match on:</b><select data-xml-compare-aim-basis><option value="coordinate" ${basis === 'coordinate' ? 'selected' : ''}>Coordinate (nearest within tolerance)</option><option value="name" ${basis === 'name' ? 'selected' : ''}>Node name (exact / delimiter token)</option></select>${nameControls}</div>
    ${connectorSelectRow(workspace)}
    ${transferBlockRow(workspace, blocks)}
  </div>`;
}

function stringConfig(workspace = {}) {
  const aim = workspace.aim || {};
  const model = workspace.candidatePairs || {};
  const blocks = new Set(aim.transferBlocks || []);
  const threshold = Math.round((model.textMatchThreshold || 0.6) * 100);
  const field = model.textField || (model.stringFields || [])[0] || 'displayName';
  return `<div class="xmlc-aim-config is-string">
    <div class="xmlc-aim-row"><b>Match on:</b><span class="xmlc-mode-pill">String field</span><span class="xmlc-field-name">${esc(field)}</span></div>
    <div class="xmlc-aim-row"><b>Valid when</b><label>text &ge; <input type="number" min="0" step="1" value="${esc(threshold)}" data-xml-compare-candidate-bulk-text-threshold style="width:70px"> %</label></div>
    ${connectorSelectRow(workspace)}
    ${transferBlockRow(workspace, blocks)}
  </div>`;
}

function reviewConfig(workspace = {}) {
  return workspace.aim?.connectionType === 'string' ? stringConfig(workspace) : aimConfig(workspace);
}

function deltaFields(model = {}) {
  return Object.freeze((Array.isArray(model.numericFields) ? model.numericFields : []).map(clean).filter(Boolean));
}

function toleranceForField(model = {}, field = '') {
  const item = (model.numericCriteria || []).find((row) => clean(row.field) === clean(field));
  return item?.tolerance ?? model.toleranceMm ?? 0;
}

function numericCriterion(model = {}) {
  const fields = deltaFields(model);
  if (fields.length) return fields.map((field) => `|&Delta;${esc(field)}|&le;${esc(toleranceForField(model, field))}`).join(' AND ');
  const t = model.tolerance;
  return t ? `|&Delta;x|&le;${esc(t.x)}, |&Delta;y|&le;${esc(t.y)}, |&Delta;z|&le;${esc(t.z)}` : `&Delta; &le; ${esc(model.toleranceMm)} mm`;
}

function criterionFor(model = {}) {
  const textCrit = `text &ge; ${Math.round((model.textMatchThreshold || 0) * 100)}%`;
  if (model.mode === 'text') return textCrit;
  if (deltaFields(model).length) return numericCriterion(model);
  if (model.mode === 'numeric') return numericCriterion(model);
  return `${numericCriterion(model)} or ${textCrit}`;
}

function matchLabelFor(model = {}) {
  const fields = deltaFields(model);
  if (fields.length && model.mode !== 'text') return fields.join(', ');
  if (model.mode === 'text') return model.textField || (model.stringFields || []).join(', ') || 'text';
  if (model.basis === 'name') return 'node name';
  return model.mode || 'both';
}

function fieldDelta(pair = {}, field = '') {
  return (pair.fieldDeltas || []).find((row) => clean(row.field) === clean(field)) || null;
}

function deltaFieldCell(pair = {}, field = '') {
  const row = fieldDelta(pair, field);
  if (!row) return '<span class="xmlc-muted">-</span>';
  const title = `valid when |Delta ${field}| <= ${row.tolerance}`;
  return `<span class="xmlc-delta ${row.valid ? 'is-valid' : 'is-review'}" title="${esc(title)}">${mm(row.delta)}</span>`;
}

function pairKey(sourceUid = '', targetUid = '') { return `${clean(sourceUid)}=>${clean(targetUid)}`; }
function candidateId(pair = {}) { return `candidate:${pairKey(pair.sourceUid, pair.targetUid)}`; }
function approvalSets(workspace = {}) {
  const approved = new Set((workspace.approvedMatchSet?.approvedMatches || []).map((row) => pairKey(row.sourceUid, row.targetUid)));
  const rejected = new Set((workspace.approvedMatchSet?.rejectedMatches || []).map((row) => pairKey(row.sourceUid, row.targetUid)));
  const blocked = new Set((workspace.approvedMatchSet?.ambiguousMatches || []).map((row) => pairKey(row.sourceUid, row.targetUid)));
  const rejectedIds = new Set(workspace.candidateDecisions?.rejectedCandidateIds || []);
  return Object.freeze({ approved, rejected, blocked, rejectedIds });
}
function approvalState(pair = {}, sets = approvalSets()) {
  if (pair.isAnchor) return 'anchor';
  const key = pairKey(pair.sourceUid, pair.targetUid);
  if (sets.approved.has(key)) return 'approved';
  if (sets.rejected.has(key) || sets.rejectedIds.has(candidateId(pair))) return 'rejected';
  if (sets.blocked.has(key)) return 'blocked';
  return 'pending';
}
function approvalSummary(pairs = [], sets = approvalSets()) {
  const rows = (pairs || []).filter((pair) => !pair.isAnchor);
  const count = (state) => rows.filter((pair) => approvalState(pair, sets) === state).length;
  return Object.freeze({ approved: count('approved'), pending: count('pending'), rejected: count('rejected'), blocked: count('blocked') });
}
function allowDuplicateTargetFor(pair = {}) {
  return pair.method === 'numeric-fields' && pair.status === 'valid';
}
function candidateActions(pair = {}, approval = 'pending') {
  const data = `data-source-uid="${esc(pair.sourceUid)}" data-target-uid="${esc(pair.targetUid)}" data-source-stable="${esc(pair.sourceStableKey)}" data-target-stable="${esc(pair.targetStableKey)}" data-source-label="${esc(pair.sourceLabel)}" data-target-label="${esc(pair.targetLabel)}" data-status="${esc(pair.status)}" data-method="${esc(pair.method)}" data-allow-duplicate-target="${allowDuplicateTargetFor(pair) ? 'true' : 'false'}"`;
  if (pair.isAnchor) return '<span class="xmlc-anchor-tag">anchor</span>';
  return `<button type="button" class="xmlc-approve" data-xml-compare-candidate-approve ${data}>Approve</button><button type="button" class="xmlc-reject" data-xml-compare-candidate-reject ${data}>Reject</button>`;
}

function approvalCell(approval = 'pending') {
  return `<span class="xmlc-approval is-${esc(approval)}">${esc(APPROVAL_LABEL[approval] || approval)}</span>`;
}

function numericCandidateRow(pair = {}, deltaFieldNames = [], includeTextPct = false, sets = approvalSets()) {
  const axis = pair.deltaZ != null ? `<small class="xmlc-axis">(${mm(pair.deltaX)}, ${mm(pair.deltaY)}, ${mm(pair.deltaZ)})</small>` : '';
  const deltaCells = deltaFieldNames.length ? deltaFieldNames.map((field) => `<td>${deltaFieldCell(pair, field)}</td>`).join('') : `<td>${mm(pair.deltaMm)} ${axis}</td>`;
  const textCell = includeTextPct ? `<td>${pct(pair.matchPct)}</td>` : '';
  const approval = approvalState(pair, sets);
  return `<tr class="xmlc-cand is-${esc(pair.status)} is-approval-${esc(approval)}"><td>${esc(pair.sourceLabel)}</td><td>&rarr; ${esc(pair.targetLabel || '-')}</td>${deltaCells}${textCell}<td><span class="xmlc-chip is-${esc(pair.status)}">${esc(STATUS_LABEL[pair.status] || pair.status)}</span></td><td>${approvalCell(approval)}</td><td class="xmlc-cand-actions">${candidateActions(pair, approval)}</td></tr>`;
}

function stringCandidateRow(pair = {}, sets = approvalSets(), workspace = {}, targetFieldOptions = new Map()) {
  const approval = approvalState(pair, sets);
  
  const optionsHtml = targetFieldOptions.get(pair.textField) || '';
  const isCustom = !optionsHtml.includes(`"${esc(pair.textTargetValue)}"`);
  const customOption = (isCustom && pair.textTargetValue) ? `<option value="${esc(pair.textTargetValue)}" selected>${esc(pair.textTargetValue)}</option>` : '';
  const finalOptionsHtml = optionsHtml.replace(`value="${esc(pair.textTargetValue)}"`, `value="${esc(pair.textTargetValue)}" selected`);
  
  const targetTextHtml = `<select data-xml-compare-candidate-text-target-override="${esc(pair.id)}" style="width:100%; box-sizing:border-box;">
    <option value="">-- select target text --</option>
    ${customOption}
    ${finalOptionsHtml}
  </select>`;
  return `<tr class="xmlc-cand is-${esc(pair.status)} is-approval-${esc(approval)}"><td>${esc(pair.sourceLabel)}</td><td>&rarr; ${esc(pair.targetLabel || '-')}</td><td>${esc(pair.textField || 'displayName')}</td><td>${esc(pair.textSourceValue)}</td><td>${targetTextHtml}</td><td>${pct(pair.matchPct)}</td><td><span class="xmlc-chip is-${esc(pair.status)}">${esc(STATUS_LABEL[pair.status] || pair.status)}</span></td><td>${approvalCell(approval)}</td><td class="xmlc-cand-actions">${candidateActions(pair, approval)}</td></tr>`;
}

function candidateGrid(workspace = {}) {
  if (!workspace.anchor) return '<div class="xmlc-empty">Select one Source node and one Target node, then <b>Set anchor pair</b> to compute candidate pairs.</div>';
  const model = workspace.candidatePairs || {};
  const pairs = model.pairs || [];
  if (!pairs.length) return '<div class="xmlc-empty">No candidate pairs. Source or Target records lack coordinates.</div>';
  const summary = model.summary || {};
  const deltaFieldNames = deltaFields(model);
  const criterion = criterionFor(model);
  const isNumeric = model.mode === 'numeric' || model.mode === 'both';
  const isText = model.mode === 'text' || model.mode === 'both';
  const isStringMode = model.mode === 'text';
  const sets = approvalSets(workspace);
  const approvals = approvalSummary(pairs, sets);
  let bulkHtml = '<div class="xml-compare-validation-bulk-actions" style="margin-bottom:8px;">';
  if (deltaFieldNames.length && !isStringMode) {
    bulkHtml += `<span class="xmlc-valid-rule">Valid when ${criterion}</span>`;
  } else if (isNumeric && !isStringMode) {
    bulkHtml += `<label>Valid when &Delta; &le; <input type="number" min="0" step="0.1" value="${esc(model.toleranceMm ?? 6)}" data-xml-compare-candidate-bulk-numeric-threshold style="width: 80px; display: inline-block;"> mm</label>`;
  }
  if (isText) {
    bulkHtml += `<label style="margin-left: ${isNumeric && !isStringMode ? '12px' : '0'};">Valid when text &ge; <input type="number" min="0" step="1" value="${esc(Math.round((model.textMatchThreshold || 0.6) * 100))}" data-xml-compare-candidate-bulk-text-threshold style="width: 80px; display: inline-block;"> %</label>`;
  }
  const validPendingCount = pairs.filter((pair) => pair.status === 'valid' && !pair.isAnchor && approvalState(pair, sets) === 'pending').length;
  const bulkLabel = validPendingCount ? `Approve ${validPendingCount} valid case${validPendingCount === 1 ? '' : 's'}` : `Approved ${approvals.approved} valid case${approvals.approved === 1 ? '' : 's'}`;
  bulkHtml += `<button type="button" class="xml-compare-validation-action-btn" data-xml-compare-action="bulk-approve-candidate-pairs" ${validPendingCount ? '' : 'disabled'} style="margin-left:auto;">${esc(bulkLabel)}</button></div>`;
  const visiblePairs = pairs.slice(0, 200);
  const hiddenCount = pairs.length - visiblePairs.length;
  const baseSummary = `VALID ${summary.validCount || 0} - REVIEW ${summary.reviewCount || 0} - CONFLICT ${summary.conflictCount || 0}${summary.noTargetCount ? ` - NO TARGET ${summary.noTargetCount}` : ''} - APPROVED ${approvals.approved} - PENDING ${approvals.pending} - SHOWN ${visiblePairs.length}/${pairs.length}`;
  const filterValue = (col) => esc(workspace.candidateDecisions?.filters?.[col] || '');

  if (isStringMode) {
    const targetFieldOptions = new Map();
    if (pairs.length > 0) {
      const matchField = pairs[0].textField || 'displayName';
      const uniqueTargetTexts = new Set();
      (workspace.target?.records || []).forEach(r => {
         const v = readFieldValue(r, matchField);
         if (clean(v)) uniqueTargetTexts.add(clean(v));
      });
      const optionsHtml = Array.from(uniqueTargetTexts).sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      targetFieldOptions.set(matchField, optionsHtml);
    }

    let filteredPairs = visiblePairs;
    const filters = workspace.candidateDecisions?.filters || {};
    if (filters.source) filteredPairs = filteredPairs.filter(p => (p.sourceLabel||'').toLowerCase().includes(filters.source.toLowerCase()));
    if (filters.target) filteredPairs = filteredPairs.filter(p => (p.targetLabel||'').toLowerCase().includes(filters.target.toLowerCase()));
    if (filters.field) filteredPairs = filteredPairs.filter(p => (p.textField||'').toLowerCase().includes(filters.field.toLowerCase()));
    if (filters.sourceText) filteredPairs = filteredPairs.filter(p => (p.textSourceValue||'').toLowerCase().includes(filters.sourceText.toLowerCase()));
    if (filters.targetText) filteredPairs = filteredPairs.filter(p => (p.textTargetValue||'').toLowerCase().includes(filters.targetText.toLowerCase()));
    if (filters.status) filteredPairs = filteredPairs.filter(p => (p.status||'').toLowerCase().includes(filters.status.toLowerCase()));
    if (filters.approval) filteredPairs = filteredPairs.filter(p => (approvalState(p, sets)||'').toLowerCase().includes(filters.approval.toLowerCase()));

    const filterInput = (col, placeholder = 'filter...') => {
      const uniqueValues = new Set();
      visiblePairs.forEach(p => {
        let v = '';
        if (col === 'source') v = p.sourceLabel;
        if (col === 'target') v = p.targetLabel;
        if (col === 'field') v = p.textField;
        if (col === 'sourceText') v = p.textSourceValue;
        if (col === 'targetText') v = p.textTargetValue;
        if (col === 'status') v = p.status;
        if (col === 'approval') v = approvalState(p, sets);
        if (v) uniqueValues.add(v);
      });
      const options = Array.from(uniqueValues).sort().map(v => `<option value="${esc(v)}"></option>`).join('');
      return `<input type="text" list="xmlc-filter-list-${col}" data-xml-compare-candidate-filter="${col}" value="${filterValue(col)}" placeholder="${placeholder}" style="width:100%; box-sizing:border-box; font-size:11px;">
      <datalist id="xmlc-filter-list-${col}">${options}</datalist>`;
    };

    const rows = filteredPairs.map((pair) => stringCandidateRow(pair, sets, workspace, targetFieldOptions)).join('');
    const filterRow = `<tr class="xmlc-filters">
      <td>${filterInput('source')}</td>
      <td>${filterInput('target')}</td>
      <td>${filterInput('field')}</td>
      <td>${filterInput('sourceText')}</td>
      <td>${filterInput('targetText')}</td>
      <td></td>
      <td>${filterInput('status')}</td>
      <td>${filterInput('approval')}</td>
      <td></td>
    </tr>`;
    return `<div class="xmlc-cand-summary">${baseSummary} <span class="xmlc-criterion">valid when ${criterion} (Match on: ${esc(matchLabelFor(model))})</span></div>
      ${bulkHtml}
      <div class="xmlc-table-scroll"><table class="xmlc-table"><thead><tr><th>Source</th><th>Nearest target</th><th>Field</th><th>Source text</th><th>Target text</th><th>Text %</th><th>Status</th><th>Approval</th><th>Action</th></tr>${filterRow}</thead><tbody>${rows}${hiddenCount > 0 ? '<tr><td colspan="9">Showing first 200 candidate rows. Refine the anchor/connector scope to reduce the list.</td></tr>' : ''}</tbody></table></div>`;
  }
  const includeTextPct = model.mode !== 'numeric';
  const rows = visiblePairs.map((pair) => numericCandidateRow(pair, deltaFieldNames, includeTextPct, sets)).join('');
  const deltaHeaders = deltaFieldNames.length ? deltaFieldNames.map((field) => `<th>&Delta; ${esc(field)}</th>`).join('') : '<th>&Delta; mm</th>';
  const textHeader = includeTextPct ? '<th>Text %</th>' : '';
  const colSpan = 5 + Math.max(1, deltaFieldNames.length) + (includeTextPct ? 1 : 0);
  return `<div class="xmlc-cand-summary">${baseSummary} <span class="xmlc-criterion">valid when ${criterion} (Match on: ${esc(matchLabelFor(model))})</span></div>
    ${bulkHtml}
    <div class="xmlc-table-scroll"><table class="xmlc-table"><thead><tr><th>Source</th><th>Nearest target</th>${deltaHeaders}${textHeader}<th>Status</th><th>Approval</th><th>Action</th></tr></thead><tbody>${rows}${hiddenCount > 0 ? `<tr><td colspan="${colSpan}">Showing first 200 candidate rows. Refine the anchor/connector scope to reduce the list.</td></tr>` : ''}</tbody></table></div>`;
}

function compareValueCell(row = {}) {
  if (row.valueType === 'number' && row.delta != null) return Number(row.delta).toFixed(3);
  if (row.matchPct != null) return pct(row.matchPct);
  return '';
}

export function comparePanel(workspace = {}) {
  const report = workspace.compareReport || {};
  if (!report.pairCount) return '<div class="xmlc-empty">Approve at least one pair to compare selected fields.</div>';
  const t = report.totals || {};
  const rows = (report.pairs || []).flatMap((pairReport) => (pairReport.rows || []).map((row) => `<tr class="is-${esc(row.status)}"><td>${esc(pairReport.sourceUid)} &rarr; ${esc(pairReport.targetUid)}</td><td>${esc(row.field)}</td><td>${esc(row.sourceValue)}</td><td>${esc(row.targetValue)}</td><td>${esc(compareValueCell(row))}</td><td><span class="xmlc-chip is-${esc(row.status)}">${esc(row.status)}</span></td></tr>`)).join('');
  return `<div class="xmlc-cand-summary">fields ${t.fieldCount || 0} - unchanged ${t.unchangedCount || 0} - within-tol ${t.withinToleranceCount || 0} - changed ${t.changedCount || 0} - missing ${t.missingCount || 0}</div>
    <div class="xmlc-table-scroll"><table class="xmlc-table"><thead><tr><th>Pair</th><th>Field</th><th>Source</th><th>Target (aligned)</th><th>&Delta; / match</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No compare fields selected.</td></tr>'}</tbody></table></div>
    <div class="xmlc-anchor-actions"><button type="button" data-xml-compare-action="export-compare-csv">Export compare CSV</button><button type="button" data-xml-compare-action="export-compare-json">Export compare JSON</button></div>`;
}

export function renderXmlCompareCandidateReviewControlsHtml(workspace = {}) {
  return `<section class="xml-compare-panel xmlc-anchor-review" data-xml-compare-anchor-review data-schema="${XML_COMPARE_ANCHOR_REVIEW_PANEL_SCHEMA}">
    <div class="xml-compare-panel-title">Candidate review</div>
    ${anchorRail(workspace)}
    ${reviewConfig(workspace)}
  </section>`;
}

export function renderXmlCompareCandidatePairsPanelHtml(workspace = {}) {
  return `<section class="xml-compare-panel xmlc-candidate-pairs-panel">
    <div class="xml-compare-panel-title">Candidate pairs</div>
    ${candidateGrid(workspace)}
  </section>`;
}

export function renderXmlCompareAnchorReviewPanelHtml(workspace = {}) {
  return `<section class="xml-compare-panel xmlc-anchor-review" data-xml-compare-anchor-review data-schema="${XML_COMPARE_ANCHOR_REVIEW_PANEL_SCHEMA}">
    <div class="xml-compare-panel-title">Anchor pair review</div>
    ${anchorRail(workspace)}
    ${aimConfig(workspace)}
    <div class="xmlc-subtitle">Candidate pairs (nearest target per source node under the anchor)</div>
    ${candidateGrid(workspace)}
  </section>`;
}

export const _test = Object.freeze({ esc, clean, label, mm, pct, anchorRail, transferBlockNames, transferBlockSourceLabel, connectorSelectRow, transferBlockRow, reviewConfig, deltaFields, criterionFor, matchLabelFor, approvalSets, approvalState, approvalSummary, candidateGrid, comparePanel, numericCandidateRow, stringCandidateRow });

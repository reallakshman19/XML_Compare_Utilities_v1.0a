/**
 * table-to-xml-tab.js — graphical Table → NodeSet XML builder (sub-tab view).
 *
 * Wizard per table (source/target): load → detect columns & roles →
 * text-to-number preview → grouping resolver → SVG mapping canvas →
 * generate/download/load into compare. All engine logic lives in
 * workbench3d/tablexml/*; this module only renders and routes actions.
 */

import { parseTableSource } from '../../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { prepareTableText } from '../tablexml/table-normalizer.js';
import { previewExtraction, combinedRules } from '../tablexml/text-to-number.js';
import {
  NODESET_FIELDS, NODESET_GRAINS, suggestRoles, createNodeSetMapping, updateMappingColumn,
  mappingLinks, validateMapping, dynamicFields,
} from '../tablexml/column-mapper.js';
import { detectProfile, profileRoleHints } from '../core/profiles.js';
import { resolveGroups } from '../tablexml/grouping-resolver.js';
import { buildNodeSetModel, serializeNodeSetXml, discoverRevisions } from '../tablexml/nodeset-builder.js';
import { detectLoadCaseGroups } from '../tablexml/load-cases.js';
import { downloadFile } from '../apply/exporters.js';
import { tableXmlDiagnosticsPanelHtml, tableXmlDiagnosticsDownload } from './table-to-xml-diagnostics-view.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function ensureTablexmlState(state) {
  if (!state.tablexml) {
    const table = () => ({ name: '', text: '', parsed: null, mapping: null, groups: null, model: null, xml: '', pendingPort: null, customFields: [] });
    state.tablexml = { active: 'source', tables: { source: table(), target: table() } };
  }
  // older sessions may lack customFields
  for (const table of Object.values(state.tablexml.tables)) {
    if (!Array.isArray(table.customFields)) table.customFields = [];
  }
  return state.tablexml;
}

function activeTable(state) {
  const tx = ensureTablexmlState(state);
  return tx.tables[tx.active];
}

// ── section renderers ──────────────────────────────────────────────────────

function loadCard(tx, table) {
  return `
  <section class="wb3d-card">
    <h3>1 · Load table <span class="wb3d-muted">CSV / TSV / pasted text — delimiter auto-detected</span></h3>
    <div class="wb3d-toolbar">
      <label class="wb3d-file">File <input type="file" data-txml-file accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"></label>
      <button class="wb3d-btn wb3d-btn-primary" data-action="txml-parse">Parse table</button>
      ${table.parsed ? `<span class="wb3d-badge is-ok">${table.parsed.rows.length} row(s) · ${table.parsed.headers.length} column(s) · ${esc(table.parsed.delimiterLabel)}</span>` : ''}
    </div>
    <textarea data-txml-text spellcheck="false" placeholder="…or paste table text here (first row = headers)">${esc(table.text.length > 200000 ? '' : table.text)}</textarea>
    ${table.parsed ? `<div class="wb3d-muted">${table.parsed.diagnostics.filter((d) => d.severity !== 'INFO' && d.severity !== 'PASS').slice(0, 6).map((d) => esc(d.message)).join(' · ') || 'Parsed cleanly (multi-line quoted headers and trailing empty columns are normalized automatically).'}</div>` : ''}
  </section>`;
}

function columnsCard(table, customRules) {
  if (!table.parsed || !table.mapping) return '';
  const rules = combinedRules(customRules);
  const rows = table.mapping.columns.map((col) => {
    const samples = table.parsed.rows.slice(0, 3).map((r) => r.rawByColumnId[col.columnId]).filter(Boolean);
    const isCoord = col.role.startsWith('coord-') && col.role !== 'coord-combined';
    const isNumeric = isCoord || col.role === 'bore';
    const preview = isNumeric
      ? previewExtraction(table.parsed.rows, col.columnId, rules, 3).map((p) => (p.ok ? `${p.value}` : '✗')).join(', ')
      : '';
    return `<tr>
      <td title="${esc(col.columnId)}">${esc(col.header)}</td>
      <td class="wb3d-muted">${samples.map((s) => esc(String(s).slice(0, 28))).join(' · ')}</td>
      <td><select data-txml-role="${esc(col.columnId)}">${NODESET_FIELDS.map((f) => `<option value="${f.id}" ${col.role === f.id ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select></td>
      <td>${isNumeric ? `<select data-txml-unit="${esc(col.columnId)}">${['', 'mm', 'm', 'in'].map((u) => `<option value="${u}" ${col.unit === u ? 'selected' : ''}>${u || 'auto'}</option>`).join('')}</select>` : ''}</td>
      <td>${col.role === 'prop' ? `<input data-txml-propname="${esc(col.columnId)}" value="${esc(col.propName)}" placeholder="${esc(col.header)}" style="width:110px">` : ''}</td>
      <td class="wb3d-muted">${esc(preview)}</td>
    </tr>`;
  }).join('');
  const errors = validateMapping(table.mapping);
  const loadCases = detectLoadCaseGroups(table.mapping.columns.filter((c) => c.role === 'load'));
  const loadInfo = loadCases.length
    ? `<span class="wb3d-badge">Load cases: ${loadCases.map((lc) => `${lc.caseId}(${lc.components.map((c) => c.component).join(',')})`).join(' ')}</span>`
    : '';
  return `
  <section class="wb3d-card">
    <h3>2 · Columns & roles <span class="wb3d-muted">detected values → NodeSet fields; numbers extracted smartly (prefix/suffix/units)</span></h3>
    <div class="wb3d-toolbar"><button class="wb3d-btn" data-action="txml-autodetect">Auto-detect roles</button>
      ${errors.length ? `<span class="wb3d-badge is-bad">${esc(errors[0])}</span>` : '<span class="wb3d-badge is-ok">mapping valid</span>'}
      ${loadInfo}</div>
    <div class="wb3d-table-wrap"><table>
      <thead><tr><th>Column</th><th>Samples</th><th>Role</th><th>Unit</th><th>Prop name</th><th>Extract preview</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
  </section>`;
}

function groupingCard(table) {
  if (!table.mapping) return '';
  const g = table.mapping.grouping;
  const groups = table.groups;
  return `
  <section class="wb3d-card">
    <h3>3 · Grain & grouping <span class="wb3d-muted">what one node means, and duplicate-coordinate merging</span></h3>
    <div class="wb3d-toolbar">
      <label>Grain <select data-txml-grain>${NODESET_GRAINS.map((gr) => `<option value="${gr.id}" ${table.mapping.grain === gr.id ? 'selected' : ''}>${esc(gr.label)}</option>`).join('')}</select></label>
    </div>
    ${table.mapping.grain === 'exploded' ? '<p class="wb3d-muted">Exploded grain: each entry of the child-support-list column becomes its own node (zipped with support types and references by index); grouping is skipped.</p>' : ''}
    <div class="wb3d-toolbar" ${table.mapping.grain === 'exploded' ? 'style="opacity:.45;pointer-events:none"' : ''}>
      <label class="wb3d-check"><input type="checkbox" data-txml-group-enabled ${g.enabled ? 'checked' : ''}> group rows sharing a coordinate</label>
      <label>Tolerance mm <input type="number" data-txml-group-tol value="${g.toleranceMm}" style="width:70px"></label>
      <label>Concat separator <input data-txml-group-sep value="${esc(g.separator)}" style="width:40px"></label>
      <button class="wb3d-btn" data-action="txml-detect-groups">Detect duplicates</button>
    </div>
    ${groups ? `<p>${groups.clusters.length} coordinate cluster(s), <strong>${groups.duplicateClusters}</strong> with duplicates.
      ${groups.suggestions.basisColumnIds.length ? `Suggested grouping basis: ${groups.suggestions.basisColumnIds.map((id) => `<span class="wb3d-badge">${esc(id)}</span>`).join(' ')}` : ''}</p>
      ${groups.diagnostics.length ? `<p class="wb3d-muted">${groups.diagnostics.slice(0, 5).map((d) => esc(`${d.rowId}: ${d.message}`)).join('<br>')}</p>` : ''}` : ''}
  </section>`;
}

function mappingCanvasCard(table) {
  if (!table.mapping) return '';
  const columns = table.mapping.columns;
  if (!columns.length) {
    return `
    <section class="wb3d-card">
      <h3>4 · Visual mapping canvas</h3>
      <p class="wb3d-muted">Paste and parse a table first — its columns will appear on the left, NodeSet fields on the right.</p>
    </section>`;
  }
  // Right-hand fields are DYNAMIC: base NodeSet fields + one port per mapped
  // property + user-added custom fields.
  const fields = dynamicFields(table.mapping, table.customFields);
  const rowH = 26;
  const width = 560;
  const height = Math.max(columns.length, fields.length) * rowH + 20;
  const links = mappingLinks(table.mapping);
  const colY = (i) => 10 + i * rowH + rowH / 2;
  const fieldIndex = new Map(fields.map((f, i) => [f.id, i]));
  const pending = table.pendingPort;
  const edges = links.map((link) => {
    const i = columns.findIndex((c) => c.columnId === link.columnId);
    const j = fieldIndex.get(link.field);
    if (i < 0 || j === undefined) return '';
    const y1 = colY(i); const y2 = colY(j);
    return `<path d="M 170 ${y1} C 280 ${y1}, 330 ${y2}, 390 ${y2}" class="wb3d-map-edge" data-action="txml-unlink" data-column="${esc(link.columnId)}"><title>${esc(link.columnId)} → ${esc(link.field)} (click to remove)</title></path>`;
  }).join('');
  const colPorts = columns.map((col, i) => `
    <g transform="translate(0,${10 + i * rowH})">
      <rect class="wb3d-map-port ${pending?.side === 'col' && pending.value === col.columnId ? 'is-pending' : ''} ${col.role !== 'ignore' ? 'is-linked' : ''}" data-action="txml-port" data-side="col" data-value="${esc(col.columnId)}" x="0" y="0" width="170" height="${rowH - 4}" rx="6"/>
      <text x="8" y="${rowH / 2 + 2}" class="wb3d-map-label">${esc(String(col.header).slice(0, 22))}</text>
    </g>`).join('');
  const fieldPorts = fields.map((field, i) => `
    <g transform="translate(390,${10 + i * rowH})">
      <rect class="wb3d-map-port ${pending?.side === 'field' && pending.value === field.id ? 'is-pending' : ''} ${field.custom ? 'is-custom' : ''}" data-action="txml-port" data-side="field" data-value="${esc(field.id)}" x="0" y="0" width="160" height="${rowH - 4}" rx="6"/>
      <text x="8" y="${rowH / 2 + 2}" class="wb3d-map-label">${esc(field.label)}</text>
    </g>`).join('');
  const customChips = table.customFields.map((name) => `
    <span class="wb3d-badge">Prop: ${esc(name)} <button class="wb3d-btn wb3d-btn-mini" data-action="txml-remove-field" data-field="${esc(name)}" title="Remove custom field">✕</button></span>`).join(' ');
  return `
  <section class="wb3d-card">
    <h3>4 · Visual mapping canvas <span class="wb3d-muted">click a column port, then a field port to connect; click an edge to remove — synchronized with the role table</span></h3>
    <div class="wb3d-toolbar">
      <label>Add target field <input data-txml-newfield placeholder="e.g. SCHEDULE" style="width:130px"></label>
      <button class="wb3d-btn" data-action="txml-add-field">+ Add field</button>
      ${customChips}
    </div>
    <div class="wb3d-map-wrap"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${edges}${colPorts}${fieldPorts}</svg></div>
  </section>`;
}

function generateCard(tx, table) {
  if (!table.mapping) return '';
  const otherSide = tx.active === 'source' ? 'target' : 'source';
  // Multi-revision register: offer a one-click Rev A → Rev B pair.
  const revisions = table.parsed ? discoverRevisions(table.parsed, table.mapping) : [];
  const revPair = revisions.length >= 2 ? `
    <div class="wb3d-toolbar">
      <span class="wb3d-badge">Revisions detected: ${revisions.map(esc).join(', ')}</span>
      <label>Source rev <select data-txml-rev-a>${revisions.map((r) => `<option ${r === (table.revA ?? revisions[0]) ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label>Target rev <select data-txml-rev-b>${revisions.map((r) => `<option ${r === (table.revB ?? revisions[revisions.length - 1]) ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <button class="wb3d-btn wb3d-btn-primary" data-action="txml-revpair-load">Generate Rev pair → compare</button>
    </div>` : '';
  return `
  <section class="wb3d-card">
    <h3>5 · Generate NodeSet XML (comparison-only)</h3>
    <p class="wb3d-muted">This output is <strong>nodeset/v1</strong> for Workbench3D node comparison. It is not CAESAR II InputXML and contains no PIPINGELEMENT records.</p>
    ${revPair}
    <div class="wb3d-toolbar">
      <button class="wb3d-btn wb3d-btn-primary" data-action="txml-generate">Generate ${esc(tx.active)} XML</button>
      ${table.xml ? `<button class="wb3d-btn" data-action="txml-download">Download NodeSet XML</button>
      <button class="wb3d-btn wb3d-btn-primary" data-action="txml-load-compare">Load into compare as ${esc(tx.active)}</button>
      <span class="wb3d-muted">then switch to "${esc(otherSide)}" above and repeat</span>` : ''}
    </div>
    ${table.model ? `<div class="wb3d-muted">${table.model.nodes.length} node(s). ${table.model.diagnostics.map((d) => esc(`${d.severity}: ${d.message}`)).join(' · ')}</div>` : ''}
    ${table.xml ? `<textarea readonly spellcheck="false" style="min-height:140px">${esc(table.xml.length > 200000 ? `${table.xml.slice(0, 200000)}\n… truncated preview` : table.xml)}</textarea>` : ''}
    ${table.model?.diagnosticDocument ? tableXmlDiagnosticsPanelHtml(table.model.diagnosticDocument, tx.active) : ''}
  </section>`;
}

export function tableToXmlSection(state, customRules = []) {
  const tx = ensureTablexmlState(state);
  const table = activeTable(state);
  return `
  <div data-wb3d-tablexml>
    <section class="wb3d-card">
      <h3>Table → NodeSet XML (comparison-only) <span class="wb3d-muted">build source & target nodeset/v1 point-cloud XML for Workbench3D compare</span></h3>
      <p class="wb3d-muted">This route does not generate or mutate CAESAR II InputXML.</p>
      <div class="wb3d-seg" role="group">
        <button class="wb3d-btn ${tx.active === 'source' ? 'is-active' : ''}" data-action="txml-side" data-side="source">Table-1 → Source XML ${tx.tables.source.xml ? '✔' : ''}</button>
        <button class="wb3d-btn ${tx.active === 'target' ? 'is-active' : ''}" data-action="txml-side" data-side="target">Table-2 → Target XML ${tx.tables.target.xml ? '✔' : ''}</button>
      </div>
    </section>
    ${loadCard(tx, table)}
    ${columnsCard(table, customRules)}
    ${groupingCard(table)}
    ${mappingCanvasCard(table)}
    ${generateCard(tx, table)}
  </div>`;
}

// ── action / input routing (called from the tab's delegated handlers) ─────

function reparse(state, table) {
  // Normalize multi-line quoted cells / trailing empty spreadsheet columns
  // before the shared line-based parser sees the text.
  const previous = table.mapping;
  table.parsed = parseTableSource(prepareTableText(table.text), { sourceId: state.tablexml.active === 'source' ? 'T1' : 'T2', sourceName: table.name || `Table-${state.tablexml.active === 'source' ? 1 : 2}` });
  const profileId = state.profileOverride ?? detectProfile({ headers: table.parsed.headers });
  const roles = suggestRoles(table.parsed, profileRoleHints(profileId));
  table.mapping = createNodeSetMapping(table.parsed, roles);
  // Preserve the user's manual role/unit/prop assignments for columns that
  // still exist, plus grain and grouping settings.
  if (previous) {
    const previousById = new Map(previous.columns.map((c) => [c.columnId, c]));
    table.mapping.columns = table.mapping.columns.map((col) => {
      const old = previousById.get(col.columnId);
      return old ? { ...col, role: old.role, unit: old.unit, propName: old.propName } : col;
    });
    table.mapping.grouping = { ...previous.grouping };
    table.mapping.grain = previous.grain ?? 'row';
  }
  table.__parsedTextLength = table.text.length;
  table.groups = null;
  table.model = null;
  table.xml = '';
}

/**
 * Auto-parse after paste: parse when nothing is parsed yet, or when the text
 * changed substantially (paste-sized delta). Returns true when a parse ran.
 */
export function autoParseActiveTable(state) {
  const table = activeTable(state);
  const text = String(table.text ?? '');
  if (text.trim().split('\n').length < 2) return false;
  const delta = Math.abs(text.length - (table.__parsedTextLength ?? 0));
  if (table.parsed && delta < 200) return false;
  reparse(state, table);
  return true;
}

/**
 * @returns true when the action was handled (caller re-renders the section)
 */
export function handleTableToXmlClick(state, btn, customRules = []) {
  const tx = ensureTablexmlState(state);
  const table = activeTable(state);
  const action = btn.dataset.action;
  if (action === 'txml-side') { tx.active = btn.dataset.side; return true; }
  if (action === 'txml-parse') { reparse(state, table); return true; }
  if (action === 'txml-autodetect') {
    if (!table.parsed) return true;
    const profileId = state.profileOverride ?? detectProfile({ headers: table.parsed.headers });
    const roles = suggestRoles(table.parsed, profileRoleHints(profileId));
    for (const [columnId, role] of Object.entries(roles)) table.mapping = updateMappingColumn(table.mapping, columnId, { role });
    return true;
  }
  if (action === 'txml-detect-groups') {
    if (table.parsed && table.mapping) table.groups = resolveGroups(table.parsed, table.mapping, customRules);
    return true;
  }
  if (action === 'txml-port') {
    const side = btn.dataset.side;
    const value = btn.dataset.value;
    if (table.pendingPort && table.pendingPort.side !== side) {
      const columnId = side === 'col' ? value : table.pendingPort.value;
      const field = side === 'field' ? value : table.pendingPort.value;
      // Custom/named property ports map the column as role 'prop' with that name.
      const patch = field.startsWith('prop:')
        ? { role: 'prop', propName: field.slice(5) }
        : { role: field };
      table.mapping = updateMappingColumn(table.mapping, columnId, patch);
      table.pendingPort = null;
    } else {
      table.pendingPort = table.pendingPort?.side === side && table.pendingPort.value === value ? null : { side, value };
    }
    return true;
  }
  if (action === 'txml-unlink') {
    table.mapping = updateMappingColumn(table.mapping, btn.dataset.column, { role: 'ignore' });
    return true;
  }
  if (action === 'txml-add-field') {
    const input = btn.closest('.wb3d-toolbar')?.querySelector('[data-txml-newfield]');
    const name = String(input?.value ?? '').trim();
    if (name && !table.customFields.includes(name)) table.customFields.push(name);
    return true;
  }
  if (action === 'txml-remove-field') {
    const name = btn.dataset.field;
    table.customFields = table.customFields.filter((f) => f !== name);
    // unmap any column pointing at the removed field
    for (const col of table.mapping?.columns ?? []) {
      if (col.role === 'prop' && (col.propName || col.header) === name) {
        table.mapping = updateMappingColumn(table.mapping, col.columnId, { role: 'ignore', propName: '' });
      }
    }
    return true;
  }
  if (action === 'txml-generate') {
    if (!table.parsed || !table.mapping) return true;
    table.model = buildNodeSetModel(table.parsed, table.mapping, customRules, `${tx.active}-table`, { side: tx.active });
    table.xml = table.model.nodes.length ? serializeNodeSetXml(table.model) : '';
    return true;
  }
  if (action === 'txml-download') {
    if (table.xml) downloadFile(`${tx.active}-nodeset-comparison.xml`, table.xml, 'application/xml;charset=utf-8');
    return true;
  }
  if (action === 'txml-download-diagnostics') {
    if (table.model?.diagnosticDocument) {
      const artifact = tableXmlDiagnosticsDownload(table.model.diagnosticDocument, tx.active);
      downloadFile(artifact.name, artifact.text, artifact.mime);
    }
    return true;
  }
  return false;
}

export function handleTableToXmlInput(state, target) {
  const table = activeTable(state);
  if (target.matches?.('[data-txml-text]')) { table.text = target.value; return false; }
  const role = target.dataset?.txmlRole;
  if (role !== undefined) { table.mapping = updateMappingColumn(table.mapping, role, { role: target.value }); return true; }
  const unit = target.dataset?.txmlUnit;
  if (unit !== undefined) { table.mapping = updateMappingColumn(table.mapping, unit, { unit: target.value }); return true; }
  const propName = target.dataset?.txmlPropname;
  if (propName !== undefined) { table.mapping = updateMappingColumn(table.mapping, propName, { propName: target.value }); return false; }
  if (target.matches?.('[data-txml-rev-a]')) { table.revA = target.value; return false; }
  if (target.matches?.('[data-txml-rev-b]')) { table.revB = target.value; return false; }
  if (target.matches?.('[data-txml-grain]')) { table.mapping.grain = target.value; return true; }
  if (target.matches?.('[data-txml-group-enabled]')) { table.mapping.grouping.enabled = target.checked; return true; }
  if (target.matches?.('[data-txml-group-tol]')) { table.mapping.grouping.toleranceMm = Number(target.value) || 2; return false; }
  if (target.matches?.('[data-txml-group-sep]')) { table.mapping.grouping.separator = target.value || '|'; return false; }
  return false;
}

/**
 * Build source+target NodeSet XML from ONE multi-revision table (W3.1).
 * @returns { sourceXml, targetXml, revA, revB, sourceNodes, targetNodes, diagnostics }
 */
export function generateRevisionPair(state, customRules = []) {
  const table = activeTable(state);
  if (!table.parsed || !table.mapping) throw new Error('Parse the table first.');
  const revisions = discoverRevisions(table.parsed, table.mapping);
  if (revisions.length < 2) throw new Error('Need a mapped revision column with at least two revision values.');
  const revA = table.revA ?? revisions[0];
  const revB = table.revB ?? revisions[revisions.length - 1];
  if (revA === revB) throw new Error('Source and target revisions must differ.');
  const sourceModel = buildNodeSetModel(table.parsed, table.mapping, customRules, `rev-${revA}`, { revisionFilter: revA, side: 'source' });
  const targetModel = buildNodeSetModel(table.parsed, table.mapping, customRules, `rev-${revB}`, { revisionFilter: revB, side: 'target' });
  if (!sourceModel.nodes.length) throw new Error(`Revision ${revA} produced no nodes (check coordinate mapping).`);
  if (!targetModel.nodes.length) throw new Error(`Revision ${revB} produced no nodes (check coordinate mapping).`);
  return {
    sourceXml: serializeNodeSetXml(sourceModel),
    targetXml: serializeNodeSetXml(targetModel),
    revA,
    revB,
    sourceNodes: sourceModel.nodes.length,
    targetNodes: targetModel.nodes.length,
    diagnostics: [...sourceModel.diagnostics, ...targetModel.diagnostics],
  };
}

export async function handleTableToXmlFile(state, input) {
  const file = input.files?.[0];
  if (!file) return false;
  const table = activeTable(state);
  table.text = await file.text();
  table.name = file.name;
  reparse(state, table);
  return true;
}

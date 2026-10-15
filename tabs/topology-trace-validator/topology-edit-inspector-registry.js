/** Selection-kind registry for composable Edit Draft inspector sections. */

import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';
import { objectForSelection, uniqueContextEdges } from './topology-edit-controller-helpers.js';

export function lineageRecordRows(value) {
  const rows = [];
  const visit = (current, path) => {
    if (Array.isArray(current)) {
      if (!current.length) rows.push({ field: path, value: '[]' });
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (current && typeof current === 'object') {
      const entries = Object.entries(current);
      if (!entries.length) rows.push({ field: path, value: '{}' });
      entries.forEach(([key, item]) => visit(item, path ? `${path}.${key}` : key));
    } else rows.push({ field: path || 'value', value: current === null ? 'null' : String(current) });
  };
  visit(value, '');
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

export function buildLineageRecordTableMarkup(value) {
  const rows = lineageRecordRows(value);
  return `<div class="ttv-lineage-table-wrap"><table class="ttv-lineage-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${escapeMarkup(row.field)}</th><td>${escapeMarkup(row.value)}</td></tr>`).join('')}</tbody></table></div>`;
}

function inspectorContext(input) {
  const canonical = input.canonical, validation = objectRecord(input.validation), selection = asArray(input.selection);
  const active = selection.at(-1), value = active ? objectForSelection(canonical, active, validation) : null;
  if (!active || !value) return { canonical, validation, selection, active: null, value: null };
  const kind = active.kind;
  return {
    canonical, validation, selection, active, value, kind, contextEdgeId: cleanText(input.contextEdgeId),
    node: kind === 'node' ? value : null, edge: kind === 'edge' ? value : null,
    support: kind === 'support' ? value : null, bend: kind === 'bend' ? value : null,
    junction: kind === 'junction' ? value : null,
  };
}

function contextAuthoritySection(context) {
  const contexts = uniqueContextEdges(context.canonical, context.selection, context.contextEdgeId);
  const options = contexts.map((row) => `<option value="${escapeMarkup(row.id)}"${row.id === context.contextEdgeId ? ' selected' : ''}>${escapeMarkup(row.id)} · ${escapeMarkup(row.segmentRole)}</option>`).join('');
  return `<label>Engineering context edge<select data-ttv-edit-context><option value="">Select explicit authority…</option>${options}</select></label>`;
}

function nodeEditorSection(context) {
  const coordinates = ['x', 'y', 'z'].map((axis) => `<label>${axis.toUpperCase()}<input type="number" step="any" data-ttv-edit-coordinate="${axis}" value="${context.node.position[axis]}"></label>`).join('');
  const target = ['x', 'y', 'z'].map((axis) => `<label>${axis.toUpperCase()}<input type="number" step="any" data-ttv-edit-target="${axis}"></label>`).join('');
  return `<div class="ttv-edit-coordinate-grid">${coordinates}</div><button type="button" data-ttv-edit-inspector-action="MOVE_EXACT">Apply exact XYZ</button><button type="button" data-ttv-edit-inspector-action="MOVE_SEQUENTIAL_REQUEST">Download Sequential stretch request</button><h3>Add straight element</h3><div class="ttv-edit-coordinate-grid">${target}</div><button type="button" data-ttv-edit-inspector-action="ADD">Add with context</button><button type="button" data-ttv-edit-inspector-action="ADD_SEQUENTIAL_REQUEST">Download Sequential add request</button>`;
}

function edgeEditorSection(context) {
  const edge = context.edge;
  return `<dl><div><dt>From</dt><dd>${escapeMarkup(edge.fromNodeId)}</dd></div><div><dt>To</dt><dd>${escapeMarkup(edge.toNodeId)}</dd></div><div><dt>Role</dt><dd>${escapeMarkup(edge.segmentRole)}</dd></div></dl><button type="button" data-ttv-edit-inspector-action="DELETE">Delete edge</button><button type="button" data-ttv-edit-inspector-action="DELETE_SEQUENTIAL_REQUEST">Download Sequential retirement request</button><label>Split fraction<input type="number" min="0.001" max="0.999" step="0.001" value="0.5" data-ttv-edit-split-fraction></label><button type="button" data-ttv-edit-inspector-action="SPLIT">Split edge</button><button type="button" data-ttv-edit-inspector-action="SPLIT_SEQUENTIAL_REQUEST">Download Sequential split request</button><label>Disconnect endpoint<select data-ttv-edit-disconnect-endpoint><option value="FROM">FROM</option><option value="TO">TO</option></select></label><button type="button" data-ttv-edit-inspector-action="DISCONNECT">Disconnect endpoint</button><button type="button" data-ttv-edit-inspector-action="DISCONNECT_SEQUENTIAL_REQUEST">Download Sequential disconnect request</button>`;
}

function bendEditorSection(context) {
  const bend = context.bend;
  return `<dl><div><dt>Node</dt><dd>${escapeMarkup(bend.nodeId)}</dd></div><div><dt>Route arms</dt><dd>${asArray(bend.edgeIds).map(escapeMarkup).join(', ')}</dd></div><div><dt>Radius</dt><dd>${escapeMarkup(bend.radiusMm)} mm</dd></div><div><dt>Angle</dt><dd>${escapeMarkup(bend.angleDeg)}°</dd></div><div><dt>Authority</dt><dd>${escapeMarkup(bend.radiusAuthority)}</dd></div></dl><button type="button" data-ttv-edit-inspector-action="BEND_PRESERVATION_EXPORT">Download bend preservation evidence</button>`;
}

function junctionEditorSection(context) {
  const junction = context.junction;
  return `<dl><div><dt>Node</dt><dd>${escapeMarkup(junction.nodeId)}</dd></div><div><dt>Route arms</dt><dd>${asArray(junction.edgeIds).map(escapeMarkup).join(', ')}</dd></div><div><dt>Degree</dt><dd>${asArray(junction.edgeIds).length}</dd></div></dl><button type="button" data-ttv-edit-inspector-action="JUNCTION_PRESERVATION_EXPORT">Download junction preservation evidence</button>`;
}

function supportEditorSection(context) {
  const support = context.support;
  const rows = asArray(support.restraints).map((row) => `<li><b>${escapeMarkup(row.kind)}</b> ${escapeMarkup(row.type || row.direction)} ${Number(row.gap) >= 0 ? `(Gap: ${row.gap}mm)` : ''}</li>`).join('');
  return `<dl><div><dt>Node</dt><dd>${escapeMarkup(support.nodeId)}</dd></div><div><dt>Restraints</dt><dd>${asArray(support.restraints).length}</dd></div></dl><ul>${rows}</ul>`;
}

function geometrySection(context) {
  const incident = context.node ? asArray(context.canonical.edges).map(objectRecord).filter((row) => row.fromNodeId === context.node.id || row.toNodeId === context.node.id) : [];
  const supports = context.node ? asArray(context.canonical.supports).map(objectRecord).filter((row) => row.nodeId === context.node.id) : [];
  const rigids = context.edge ? asArray(context.canonical.rigids).map(objectRecord).filter((row) => row.edgeId === context.edge.id) : [];
  return `<h3>Geometry details</h3><dl><div><dt>Selection</dt><dd>${context.selection.length} object(s)</dd></div>${context.node ? `<div><dt>Incidence</dt><dd>${incident.length}</dd></div>` : ''}<div><dt>Supports</dt><dd>${supports.map((row) => escapeMarkup(row.tag || row.id)).join(', ') || (context.support ? 'N/A' : 'None')}</dd></div><div><dt>Rigids</dt><dd>${rigids.length}</dd></div></dl>`;
}

function validationSection(context) {
  const findings = asArray(context.validation.findings).map(objectRecord).filter((row) => asArray(row.objectIds).map(cleanText).includes(context.active.id));
  const markup = findings.length ? findings.map((row) => `<p class="${row.blocking ? 'is-blocking' : ''}" style="border-inline-start:3px solid ${escapeMarkup(cleanText(row.color) || '#ef4444')};padding-inline-start:8px"><b>${escapeMarkup(row.code)}</b> · ${escapeMarkup(row.message)}${row.canvasFix ? `<br><small>Canvas fix: ${escapeMarkup(row.canvasFix)}</small>` : ''}</p>`).join('') : '<p>No findings for this object.</p>';
  return `<h3>Validation</h3>${markup}`;
}

function lineageSection(context) {
  return `<details open><summary>Lineage and record</summary>${buildLineageRecordTableMarkup(context.value)}</details>`;
}

function section(input) { return Object.freeze(input); }

export const TOPOLOGY_EDIT_INSPECTOR_SECTIONS = Object.freeze([
  section({ id: 'context-authority', kinds: ['node', 'edge', 'support', 'bend', 'junction', 'issue'], render: contextAuthoritySection }),
  section({ id: 'node-editor', kinds: ['node'], render: nodeEditorSection }),
  section({ id: 'edge-editor', kinds: ['edge'], render: edgeEditorSection }),
  section({ id: 'support-editor', kinds: ['support'], render: supportEditorSection }),
  section({ id: 'bend-editor', kinds: ['bend'], render: bendEditorSection }),
  section({ id: 'junction-editor', kinds: ['junction'], render: junctionEditorSection }),
  section({ id: 'geometry-details', kinds: ['node', 'edge', 'support', 'bend', 'junction', 'issue'], render: geometrySection }),
  section({ id: 'validation', kinds: ['node', 'edge', 'support', 'bend', 'junction', 'issue'], render: validationSection }),
  section({ id: 'lineage', kinds: ['node', 'edge', 'support', 'bend', 'junction', 'issue'], render: lineageSection }),
]);

export function buildRegisteredTopologyEditInspectorMarkup(input) {
  if (!input.canonical) return '<div class="ttv-inspector-empty">Edit Draft is not initialized.</div>';
  const context = inspectorContext(input);
  if (!context.active) return '<div class="ttv-edit-inspector-intro"><h2>Edit Draft</h2><p>Select a node or edge. Ctrl/Cmd adds to selection; Shift selects the shortest connected path; Shift-drag draws a selection box.</p><p>Source JSON, CanonicalTopology.v1, Trace Ledger, and InputXML remain immutable.</p></div>';
  const sections = TOPOLOGY_EDIT_INSPECTOR_SECTIONS.filter((entry) => entry.kinds.includes(context.kind)).map((entry) => entry.render(context)).join('');
  return `<section><h2>${escapeMarkup(context.active.kind.toUpperCase())} · ${escapeMarkup(context.active.id)}</h2>${sections}</section>`;
}

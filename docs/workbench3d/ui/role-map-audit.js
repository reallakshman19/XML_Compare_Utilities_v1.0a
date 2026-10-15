/**
 * role-map-audit.js — role map as an editable audit layer (W5 sub-item).
 *
 * For the table domain the roles come from the live NodeSetMapping; for the
 * XML domain they are structural (derived from the canonical object) and shown
 * read-only. Either way the user can mark canonical properties "ignored" so
 * they do not count toward PROPERTY_CHANGED — the one genuinely editable knob
 * that does not require rewriting the structural adapter.
 */

/** Universal role label for a canonical property key (XML / node domains). */
const XML_ROLE_MAP = Object.freeze([
  [/^FROM_NODE$|^TO_NODE$/i, 'topology.node'],
  [/^DELTA_/i, 'geometry.delta'],
  [/^DIAMETER$/i, 'geometry.diameter'],
  [/^WALL_THICK$/i, 'geometry.wallThickness'],
  [/^INSUL/i, 'geometry.insulation'],
  [/^MATERIAL/i, 'material.name'],
  [/^TEMP|^PRESSURE|^HYDRO/i, 'process.condition'],
  [/^BORE$/i, 'geometry.bore'],
  [/^TAG$/i, 'identity.tag'],
  [/^REF$/i, 'identity.reference'],
  [/^PARENT$/i, 'hierarchy.parent'],
  [/^REVISION$/i, 'revision.label'],
  [/^REMARKS$|^FLAGS$/i, 'status.remarks'],
  [/^LC\d+_/i, 'load.component'],
  [/^MEASURE_/i, 'measure.value'],
]);

function universalRole(key) {
  for (const [pattern, role] of XML_ROLE_MAP) if (pattern.test(key)) return role;
  return 'property.value';
}

/**
 * Build the role-map audit rows for the loaded model.
 * @returns { domain, editable, rows:[{ field, role, sample, ignored }] }
 */
export function roleMapAuditModel(state) {
  const graph = state.graphs?.A;
  if (!graph) return { domain: 'none', editable: false, rows: [] };
  const domain = graph.graphKind === 'nodeset' ? 'NODE' : 'XML';
  const ignore = new Set(state.ignoredProps ?? []);
  // Sample property keys from the first few objects.
  const keys = new Map();
  for (const object of graph.objects.slice(0, 20)) {
    for (const [key, value] of Object.entries(object.properties ?? {})) {
      if (!keys.has(key)) keys.set(key, value);
    }
  }
  const rows = [...keys.entries()].map(([field, sample]) => ({
    field,
    role: universalRole(field),
    sample: String(sample ?? '').slice(0, 40),
    ignored: ignore.has(field),
  })).sort((a, b) => a.role.localeCompare(b.role) || a.field.localeCompare(b.field));
  return { domain, editable: true, rows };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function roleMapAuditHtml(state) {
  if (!state.graphs) return '';
  const model = roleMapAuditModel(state);
  if (!model.rows.length) return '';
  const body = model.rows.map((r) => `
    <tr class="${r.ignored ? 'wb3d-role-ignored' : ''}">
      <td>${esc(r.field)}</td><td class="wb3d-muted">${esc(r.role)}</td><td class="wb3d-muted">${esc(r.sample)}</td>
      <td><label class="wb3d-check"><input type="checkbox" data-action="role-ignore" data-field="${esc(r.field)}" ${r.ignored ? 'checked' : ''}> ignore in diff</label></td>
    </tr>`).join('');
  return `
  <details class="wb3d-card">
    <summary><h3>Role map audit <span class="wb3d-muted">${esc(model.domain)} domain · ${model.rows.length} field(s) — tick to exclude a field from change detection</span></h3></summary>
    <div class="wb3d-table-wrap"><table><thead><tr><th>Field</th><th>Universal role</th><th>Sample</th><th>Editable</th></tr></thead>
      <tbody>${body}</tbody></table></div>
  </details>`;
}

/**
 * column-mapper.js — NodeSetMapping.v1: table columns → NodeSet fields (pure).
 *
 * The mapping is one model with two synchronized editors in the UI (role
 * table + SVG node-link canvas). Roles extend the repo's column-contract
 * vocabulary with NodeSet-specific fields.
 */

export const NODESET_FIELDS = Object.freeze([
  { id: 'node-id', label: 'Node id' },
  { id: 'tag', label: 'Tag' },
  { id: 'coord-e', label: 'Coord E/X' },
  { id: 'coord-n', label: 'Coord N/Y' },
  { id: 'coord-u', label: 'Coord U/Z' },
  { id: 'coord-combined', label: 'Combined position text' },
  { id: 'bore', label: 'Bore / size' },
  { id: 'support-types', label: 'Support types' },
  { id: 'child-list', label: 'Child support list' },
  { id: 'child-ref', label: 'Child reference list' },
  { id: 'revision', label: 'Revision' },
  { id: 'remarks', label: 'Remarks / status' },
  { id: 'load', label: 'Load component (Fx/Fy/Fz)' },
  { id: 'measure', label: 'Measure (qty / cost / revenue)' },
  { id: 'prop', label: 'Property' },
  { id: 'ignore', label: '(ignore)' },
]);

/** Node grain: one node per row, or one node per exploded child support. */
export const NODESET_GRAINS = Object.freeze([
  { id: 'row', label: 'Node per row' },
  { id: 'exploded', label: 'Exploded support points (one node per child support)' },
]);

export const MAPPING_SCHEMA = 'NodeSetMapping.v1';

const ROLE_HEURISTICS = Object.freeze([
  // [role, header regex] — first match wins per column; order matters
  // (child-ref before child-list so "...SUPPORT REFERENCE" isn't taken as the list)
  ['coord-combined', /position\s*raw|^positionRaw$/i],
  ['coord-e', /^psE$|^rawX$|^nodeE$|^(E|X)$|EAST\/WEST|CO-?ORDINATE\s*\(X\)|^east/i],
  ['coord-n', /^psS$|^rawY$|^nodeS$|^(N|S|Y)$|NORTH\/SOUTH|CO-?ORDINATE\s*\(Y\)|^north/i],
  ['coord-u', /^psU$|^rawZ$|^nodeU$|^(U|L|Z)$|ELEVATION|CO-?ORDINATE\s*\(Z\)|^TOS|^elev/i],
  ['bore', /bore|^nps$|^dia$|derivedDn|nodeDia|^size$|^DIA$|pipeSize/i],
  ['child-ref', /PRIMARY\s*SUPPORT\s*REF/i],
  ['child-list', /^PIPING\s*PRIMARY\s*SUPPORT$|primarySupports?$|child\s*support/i],
  ['support-types', /support\s*type|supportTypes|SUPPORT TYPE/i],
  ['revision', /^REV(ISION)?\.?$/i],
  ['remarks', /^REMARKS/i],
  ['load', /^F[xyz]$/i],
  ['node-id', /^psKey$|^psName$|^node$|NODE\s*NO|^psno|CIVILPSNo|^SID$|psnoModel|^id$|^sid$/i],
  ['tag', /tag|^pipe$|LINEID|JOBNAME/i],
]);

/**
 * Header/sample-based role suggestions for a parsed source.
 * @param {Array} profileHints extra [role, regex] pairs (checked first) from a
 *        domain profile, e.g. MTO quantity/cost or Sales revenue columns.
 */
export function suggestRoles(source, profileHints = []) {
  const suggestions = {};
  const taken = new Set();
  const heuristics = [...profileHints, ...ROLE_HEURISTICS];
  (source?.columnIds ?? []).forEach((columnId, index) => {
    const header = source.headers[index] ?? columnId;
    for (const [role, pattern] of heuristics) {
      if (!pattern.test(String(header))) continue;
      // single-assignment roles: first matching column wins
      const single = ['node-id', 'coord-e', 'coord-n', 'coord-u', 'coord-combined', 'bore', 'child-list', 'child-ref', 'revision', 'remarks'].includes(role);
      if (single && taken.has(role)) break;
      suggestions[columnId] = role;
      if (single) taken.add(role);
      break;
    }
  });
  return suggestions;
}

export function createNodeSetMapping(source, roleById = {}) {
  return {
    schema: MAPPING_SCHEMA,
    columns: (source?.columnIds ?? []).map((columnId, index) => ({
      columnId,
      header: source.headers[index] ?? columnId,
      role: roleById[columnId] ?? 'ignore',
      unit: '',            // '' | 'mm' | 'm' | 'in' — applied when extraction rule is unitless
      propName: '',        // for role 'prop': XML property name (defaults to header)
    })),
    grouping: { enabled: false, toleranceMm: 2, basisColumnIds: [], separator: '|' },
    grain: 'row', // 'row' | 'exploded' (one node per child support-list entry)
  };
}

export function updateMappingColumn(mapping, columnId, patch) {
  return {
    ...mapping,
    columns: mapping.columns.map((col) => (col.columnId === columnId ? { ...col, ...patch } : col)),
  };
}

/** Canvas field id for a column: prop columns get their own named field port. */
export function fieldIdForColumn(col) {
  if (col.role === 'prop') return `prop:${col.propName || col.header}`;
  return col.role;
}

/**
 * Dynamic right-hand field list for the mapping canvas:
 * base NodeSet fields + one port per named property currently mapped +
 * user-added custom fields (connect a column to one to map it as that Prop).
 */
export function dynamicFields(mapping, customFields = []) {
  const fields = NODESET_FIELDS.filter((f) => f.id !== 'prop' && f.id !== 'ignore')
    .map((f) => ({ ...f, custom: false }));
  const seen = new Set(fields.map((f) => f.id));
  const push = (name, custom) => {
    const id = `prop:${name}`;
    if (!name || seen.has(id)) return;
    seen.add(id);
    fields.push({ id, label: `Prop: ${name}`, custom });
  };
  for (const col of mapping?.columns ?? []) {
    if (col.role === 'prop') push(col.propName || col.header, false);
  }
  for (const name of customFields) push(name, true);
  return fields;
}

/** Edges for the SVG mapping canvas: [{ columnId, field }]. */
export function mappingLinks(mapping) {
  return (mapping?.columns ?? [])
    .filter((col) => col.role && col.role !== 'ignore')
    .map((col) => ({ columnId: col.columnId, field: fieldIdForColumn(col) }));
}

export function validateMapping(mapping) {
  const errors = [];
  const roleColumns = (role) => mapping.columns.filter((c) => c.role === role);
  const hasCombined = roleColumns('coord-combined').length > 0;
  const anyCoord = hasCombined || ['coord-e', 'coord-n', 'coord-u'].some((a) => roleColumns(a).length);
  // Coordinate-less tables (MTO / sales KPI grids) are valid when a measure and
  // a node-id exist — nodes are laid out on a synthetic grid and matched by key.
  const coordOptional = !anyCoord && roleColumns('measure').length > 0 && roleColumns('node-id').length > 0;
  if (!coordOptional) {
    for (const axis of ['coord-e', 'coord-n', 'coord-u']) {
      const count = roleColumns(axis).length;
      if (count > 1) errors.push(`multiple columns mapped to ${axis}`);
      if (!count && !hasCombined) errors.push(`${axis} not mapped (or map a combined position column)`);
    }
  }
  if (!roleColumns('node-id').length && !mapping.grouping.enabled && mapping.grain !== 'exploded') {
    errors.push('node-id not mapped — map one, enable coordinate grouping, or use exploded grain');
  }
  if (roleColumns('node-id').length > 1) errors.push('multiple node-id columns');
  if (mapping.grain === 'exploded' && !roleColumns('child-list').length) {
    errors.push('exploded grain needs a child-support-list column mapped');
  }
  return errors;
}

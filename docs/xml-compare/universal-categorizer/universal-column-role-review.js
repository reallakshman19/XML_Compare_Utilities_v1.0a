import { createLinewiseUniversalPreset } from './universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from './universal-source-registry.js';

export const UNIVERSAL_COLUMN_ROLE_REVIEW_SCHEMA = 'universal-column-role-review/v1-shadow';
const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();
const ROLE_OPTIONS = freeze(['Required key', 'Candidate key', 'Coordinate field', 'Mapped field', 'Available field', 'Ignored']);

export function createLinewiseUniversalColumnRoleReview(profile = createLinewiseUniversalPreset()) {
  const registry = createUniversalSourceRegistry(profile || createLinewiseUniversalPreset());
  return createUniversalColumnRoleReview({ registry });
}

export function createUniversalColumnRoleReview(input = {}) {
  const registry = input.registry?.schema === 'universal-source-registry/v1-shadow' ? input.registry : createUniversalSourceRegistry(input.profile || createLinewiseUniversalPreset(), input.sourceInputs || input.sources || {});
  const rows = freeze(columnRoleRows(registry));
  const actions = freeze([
    action('accept-inferred-role', 'Accept inferred role'),
    action('change-role', 'Change role'),
    action('reset-role', 'Reset role'),
    action('ignore-column', 'Ignore column'),
    action('approve-column-roles', 'Approve column roles'),
  ]);
  const diagnostics = freeze(columnRoleDiagnostics(rows));
  return freeze({
    schema: UNIVERSAL_COLUMN_ROLE_REVIEW_SCHEMA,
    title: 'Column role review',
    kicker: 'Role overrides',
    status: 'locked-review-only',
    description: 'Review inferred source-column roles before any future role override handler is enabled.',
    roleOptions: ROLE_OPTIONS,
    columns: freeze(['Source', 'Column', 'Inferred role', 'Pending role', 'Reason']),
    summary: freeze({
      rows: rows.length,
      requiredKeys: rows.filter((row) => row.inferredRole === 'Required key').length,
      candidateKeys: rows.filter((row) => row.inferredRole === 'Candidate key').length,
      coordinateFields: rows.filter((row) => row.inferredRole === 'Coordinate field').length,
      mappedFields: rows.filter((row) => row.inferredRole === 'Mapped field').length,
      availableFields: rows.filter((row) => row.inferredRole === 'Available field').length,
      diagnostics: diagnostics.length,
    }),
    selected: freeze(rows[0] || emptySelected()),
    rows,
    actions,
    diagnostics,
  });
}

function columnRoleRows(registry = {}) {
  return arr(registry.sources).flatMap((source = {}) => {
    const columns = stableColumns(source);
    return columns.map((column) => columnRoleRow(source, column));
  }).sort((a, b) => `${a.sourceId}:${a.column}`.localeCompare(`${b.sourceId}:${b.column}`));
}
function columnRoleRow(source = {}, columnValue = '') {
  const column = text(columnValue);
  const inferredRole = inferColumnRole(column, source);
  return freeze({
    rowId: `${text(source.sourceId)}:${column}`,
    sourceId: text(source.sourceId),
    sourceName: text(source.displayName, source.sourceId || source.sourceKind || 'Source'),
    column,
    inferredRole,
    pendingRole: inferredRole,
    suggestedRoles: suggestedRoles(inferredRole),
    reason: roleReason(column, source, inferredRole),
    status: 'locked',
    lockedReason: 'role-overrides-are-disabled-in-shadow-mode',
  });
}
function stableColumns(source = {}) {
  const seen = new Set();
  return freeze([...arr(source.columns), ...arr(source.requiredColumns)].map(text).filter(Boolean).filter((column) => { if (seen.has(column)) return false; seen.add(column); return true; }).sort((a, b) => a.localeCompare(b)));
}
function inferColumnRole(column, source = {}) {
  const name = text(column).toLowerCase();
  if (arr(source.requiredColumns).includes(column)) return 'Required key';
  if (name.includes('node') || name.includes('line') || name.includes('id')) return 'Candidate key';
  if (name.includes('global') || name.includes('position') || name.includes('coordinate')) return 'Coordinate field';
  if (name.includes('weight') || name.includes('diameter') || name.includes('thickness') || name.includes('tag')) return 'Mapped field';
  return 'Available field';
}
function roleReason(column, source = {}, role = '') {
  const name = text(column);
  if (role === 'Required key') return `${name} is declared as a required source column.`;
  if (role === 'Candidate key') return `${name} looks like an identifier, node, or line field.`;
  if (role === 'Coordinate field') return `${name} looks like a coordinate or position field.`;
  if (role === 'Mapped field') return `${name} looks like an engineering attribute field.`;
  return `${name} is available but has no stronger inferred role.`;
}
function suggestedRoles(inferredRole) {
  return freeze([inferredRole, ...ROLE_OPTIONS.filter((role) => role !== inferredRole)].slice(0, 4));
}
function columnRoleDiagnostics(rows = []) {
  const diagnostics = [];
  if (!arr(rows).length) diagnostics.push(diagnostic('warn', 'UXC_COLUMN_ROLE_REVIEW_EMPTY', 'column-role-review', 'No source columns are available for role review.'));
  if (!arr(rows).some((row) => row.inferredRole === 'Required key')) diagnostics.push(diagnostic('info', 'UXC_COLUMN_ROLE_REVIEW_NO_REQUIRED_KEY', 'column-role-review', 'No required-key role was inferred from the current source registry.'));
  return diagnostics;
}
function action(actionId, label) { return freeze({ actionId, label, enabled: false, locked: true, lockedReason: 'column-role-review-shadow-mode' }); }
function diagnostic(severity, code, subjectId, message) { return freeze({ severity, code, subjectId, message }); }
function emptySelected() { return { rowId: '', sourceId: '', sourceName: '', column: '', inferredRole: '', pendingRole: '', suggestedRoles: [], reason: '', status: 'locked', lockedReason: 'no-column-selected' }; }
export const _test = freeze({ columnRoleRows, columnRoleRow, stableColumns, inferColumnRole, roleReason, suggestedRoles, columnRoleDiagnostics, action, diagnostic, emptySelected });

import { createLinewiseUniversalPreset } from './universal-xml-categorizer-contracts.js';
import { createUniversalMappingWorkbench } from './universal-mapping-workbench.js';

export const UNIVERSAL_MAPPING_REVIEW_SCHEMA = 'universal-mapping-review/v1-shadow';
const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];

export function createLinewiseUniversalMappingReview(profile = createLinewiseUniversalPreset()) {
  return createUniversalMappingReview({ mappingWorkbench: createUniversalMappingWorkbench({ profile: profile || createLinewiseUniversalPreset() }) });
}

export function createUniversalMappingReview(input = {}) {
  const workbench = input.mappingWorkbench?.schema === 'universal-mapping-workbench/v1-shadow' ? input.mappingWorkbench : createUniversalMappingWorkbench(input);
  const groups = reviewGroups(workbench);
  const selected = selectedMapping(workbench);
  const diagnostics = reviewDiagnostics(workbench, groups);
  return freeze({
    schema: UNIVERSAL_MAPPING_REVIEW_SCHEMA,
    profileId: workbench.profileId,
    title: 'Mapping review queue',
    kicker: 'Review queue',
    status: workbench.summary.unmapped || diagnostics.some((item) => item.severity === 'warn') ? 'review-required' : 'ready-for-preview',
    description: 'Review mapping groups and selected mapping details before any future decision handler is enabled.',
    summary: freeze({
      groups: groups.length,
      rows: workbench.rows.length,
      selected: selected.rowId ? 1 : 0,
      lockedDecisions: 5,
      diagnostics: diagnostics.length,
    }),
    groups,
    selected,
    decisions: freeze([
      decision('accept-selected-mapping', 'Accept selected mapping'),
      decision('edit-target-mapping', 'Edit target mapping'),
      decision('ignore-source-column', 'Ignore source column'),
      decision('create-derived-field', 'Create derived field'),
      decision('approve-mapping-review', 'Approve mapping review'),
    ]),
    diagnostics,
  });
}

function reviewGroups(workbench = {}) {
  const rows = arr(workbench.rows);
  return freeze([
    group('key-mappings', 'Key mappings', rows.filter((row) => row.role.includes('key'))),
    group('field-mappings', 'Field mappings', rows.filter((row) => row.role.includes('field'))),
    group('unmapped-columns', 'Unmapped columns', rows.filter((row) => row.status === 'Unmapped')),
    group('diagnostics', 'Diagnostics / missing columns', arr(workbench.diagnostics).map((item) => ({ rowId: item.code, sourceField: item.subjectId, targetLocation: item.message, status: item.severity }))),
  ]);
}
function group(groupId, label, rows) {
  return freeze({ groupId, label, count: rows.length, status: rows.length ? 'review' : 'clear', rows: freeze(rows.slice(0, 8).map((row) => freeze({ rowId: row.rowId, sourceField: row.sourceField, targetLocation: row.targetLocation, status: row.status }))) });
}
function selectedMapping(workbench = {}) {
  const row = arr(workbench.rows).find((item) => item.status === 'Unmapped') || arr(workbench.rows).find((item) => item.role.includes('key')) || arr(workbench.rows)[0] || {};
  return freeze({
    title: 'Selected mapping detail',
    rowId: row.rowId || '',
    sourceName: row.sourceName || '',
    sourceField: row.sourceField || '',
    targetLocation: row.targetLocation || '—',
    role: row.role || '—',
    status: row.status || '—',
    confidence: row.confidence || '—',
    reason: row.reason || 'No mapping row selected.',
  });
}
function reviewDiagnostics(workbench = {}, groups = []) {
  const diagnostics = [...arr(workbench.diagnostics).map((item) => diagnostic(item.severity || 'info', item.code || 'UXC_MAPPING_REVIEW_DIAGNOSTIC', item.subjectId || '', item.message || ''))];
  const unmapped = groups.find((item) => item.groupId === 'unmapped-columns')?.count || 0;
  if (unmapped) diagnostics.push(diagnostic('warn', 'UXC_MAPPING_REVIEW_UNMAPPED_COLUMNS', 'mapping-review', `${unmapped} source columns require review before approval.`));
  return freeze(diagnostics.sort((a, b) => `${a.severity}:${a.code}:${a.subjectId}`.localeCompare(`${b.severity}:${b.code}:${b.subjectId}`)));
}
function decision(actionId, label) { return freeze({ actionId, label, enabled: false, locked: true, lockedReason: 'locked-shadow-mode' }); }
function diagnostic(severity, code, subjectId, message) { return freeze({ severity, code, subjectId, message }); }

export const _test = freeze({ reviewGroups, group, selectedMapping, reviewDiagnostics, decision, diagnostic });

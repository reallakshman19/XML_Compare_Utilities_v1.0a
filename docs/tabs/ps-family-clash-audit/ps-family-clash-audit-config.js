import { buildFamilyRootDetectorLabel, normalizeFamilyPrefixes } from './ps-family-token-utils.js';

export const PS_FAMILY_CLASH_AUDIT_CONFIG_SCHEMA = 'ps-family-clash-audit-config/v11-evidence-graph';

const REPORT_TABS = Object.freeze([
  Object.freeze({ key: 'supportSummary', label: 'SupportGroup Summary', maturity: 'stable' }),
  Object.freeze({ key: 'supportChain', label: 'Support Chain Report', maturity: 'draft' }),
  Object.freeze({ key: 'supportMembers', label: 'Support Members', maturity: 'draft' }),
  Object.freeze({ key: 'structureLineProximity', label: 'StructureGroup Line Support Basis', maturity: 'stable' }),
  Object.freeze({ key: 'structureContacts', label: 'Structure Terminals', maturity: 'draft' }),
  Object.freeze({ key: 'lineSupportTree', label: 'Line Tree', maturity: 'stable' }),
  Object.freeze({ key: 'structureTree', label: 'Structure Tree', maturity: 'stable' }),
  Object.freeze({ key: 'inputEvidence', label: 'Input Evidence', maturity: 'stable' }),
  Object.freeze({ key: 'connectivityMatrix', label: 'Connectivity Matrix', maturity: 'draft' }),
  Object.freeze({ key: 'clashRows', label: 'Evidence Detail Rows', maturity: 'draft' }),
  Object.freeze({ key: 'supportExceptions', label: 'Audit Exceptions', maturity: 'stable' }),
  Object.freeze({ key: 'diagnostics', label: 'Diagnostics', maturity: 'stable' }),
]);

const REPORT_GROUPS = Object.freeze([
  Object.freeze({
    key: 'supportGroup',
    label: 'Support Group',
    description: 'SupportGroup summary, support-chain continuity and member evidence.',
    reportKeys: Object.freeze(['supportSummary', 'supportChain', 'supportMembers']),
  }),
  Object.freeze({
    key: 'structureBasis',
    label: 'Structure Group Basis',
    description: 'Structure-group relationship basis and analytical structural terminals.',
    reportKeys: Object.freeze(['structureLineProximity', 'structureContacts']),
  }),
  Object.freeze({
    key: 'lineTree',
    label: 'Line Tree',
    description: 'Line, branch, SupportGroup and support hierarchy.',
    reportKeys: Object.freeze(['lineSupportTree']),
  }),
  Object.freeze({
    key: 'structureTree',
    label: 'Structure Tree',
    description: 'Structure-root hierarchy with the native evidence used to construct it.',
    reportKeys: Object.freeze(['structureTree', 'inputEvidence']),
  }),
  Object.freeze({
    key: 'evidenceSummary',
    label: 'Evidence Summary',
    description: 'SupportGroup summary, connectivity matrix and source evidence.',
    reportKeys: Object.freeze(['supportSummary', 'connectivityMatrix', 'clashRows']),
  }),
  Object.freeze({
    key: 'auditOutcome',
    label: 'Audit Outcome',
    description: 'Exceptions and diagnostics requiring engineering action.',
    reportKeys: Object.freeze(['supportExceptions', 'diagnostics']),
  }),
]);

const EVIDENCE_MODES = Object.freeze([
  Object.freeze({ value: 'RELATIONSHIP_BUNDLE', label: 'Relationship bundle — XML-free production mode' }),
  Object.freeze({ value: 'XML', label: 'Legacy clash XML — validation mode' }),
]);

export const PS_FAMILY_CLASH_AUDIT_CONFIG = Object.freeze({
  schema: PS_FAMILY_CLASH_AUDIT_CONFIG_SCHEMA,
  appTitle: 'PS / SL Family Evidence Audit',
  launcher: Object.freeze({ label: 'PS / SL Family Evidence Audit', icon: '⚠️↔️', help: 'Audit support families directly from the XML-free relationship evidence graph.' }),
  inputRows: 7,
  defaultEvidenceMode: 'RELATIONSHIP_BUNDLE',
  evidenceModes: EVIDENCE_MODES,
  sourceFamilyPlaceholder: 'Optional filter, e.g. /PS-14396 or /SL-14396',
  familyPrefixesText: 'PS, SL',
  structuralZonesText: 'CU-SU, STRUCTURE, FRMWORK, GENSEC, PANEL, FACET GROUP',
  supportZonesText: 'PS-, SL-',
  posToleranceMm: 25,
  toleranceMinMm: 0,
  toleranceStepMm: 0.001,
  inputFiles: Object.freeze([
    Object.freeze({ key: 'bundle', label: 'Support / Steel Relationship Bundle', accept: '.json,application/json', textareaKey: 'bundle' }),
    Object.freeze({ key: 'structure', label: 'Legacy StructureGroup vs Supports XML', accept: '.xml,text/xml,application/xml', textareaKey: 'structure' }),
    Object.freeze({ key: 'support', label: 'Legacy Clash within Supports XML', accept: '.xml,text/xml,application/xml', textareaKey: 'support' }),
  ]),
  reportTabs: REPORT_TABS,
  reportGroups: REPORT_GROUPS,
  sourceSideOptions: Object.freeze([
    Object.freeze({ value: 'auto', label: 'Auto' }),
    Object.freeze({ value: 'left', label: 'Left clash object' }),
    Object.freeze({ value: 'right', label: 'Right clash object' }),
  ]),
  outputButtons: Object.freeze([
    Object.freeze({ key: 'support-summary', label: 'Support Group Summary CSV', exportKey: 'supportSummaryCsv', mime: 'text/csv', suffix: 'supportgroup-summary' }),
    Object.freeze({ key: 'json-trace-support-members', label: 'JSON Trace Support Members CSV', exportKey: 'jsonTraceSupportMembersCsv', mime: 'text/csv', suffix: 'json-trace-support-members' }),
    Object.freeze({ key: 'line-support-tree', label: 'Line Tree TXT', exportKey: 'lineSupportTreeText', mime: 'text/plain', suffix: 'line-support-tree' }),
    Object.freeze({ key: 'structure-line-proximity', label: 'Structure Group Basis CSV', exportKey: 'structureLineProximityCsv', mime: 'text/csv', suffix: 'structure-line-proximity' }),
    Object.freeze({ key: 'support-exceptions', label: 'Audit Outcome CSV', exportKey: 'supportExceptionsCsv', mime: 'text/csv', suffix: 'audit-exceptions' }),
    Object.freeze({ key: 'input-evidence', label: 'Input Evidence CSV', exportKey: 'inputEvidenceCsv', mime: 'text/csv', suffix: 'input-evidence' }),
    Object.freeze({ key: 'all-json', label: 'Audit JSON', exportKey: 'auditJson', mime: 'application/json', suffix: 'audit' }),
  ]),
  info: Object.freeze([
    'Relationship bundle mode is the XML-free production workflow and is selected by default.',
    'Legacy StructureGroup vs Supports and Clash within Supports XML remain available only for validation and historical comparison.',
    'SupportGroup identity is LineFamily_PSRoot, for example S8810011_PS-14396.',
    'Reports are organized into six task-oriented groups in a two-row report catalog.',
    'Every visible report can be exported directly as CSV from the Reports workspace.',
    'JSON Trace Support Members CSV uses the Support Detail Report headers accepted by XML→CII 2019 Standalone CSV/XLS Trace.',
    'Structural relationships, member-chain edges, symbolic references and analytical terminals remain distinct evidence classes.',
    'A support-family association alone does not prove a physical terminal; analytical support-member geometry is required.',
    'Zone classification and source-side settings apply only to legacy XML validation mode.',
    'The Export Package workspace retains stable deliverables, previews, Audit JSON and ZIP packaging.',
    'Disconnected physical members, ambiguous steel relationships, missing line context and reference-only terminals are reported as exceptions.',
    'Family prefixes are configurable; default prefixes are PS and SL.',
  ]),
});

function parseListText(value, fallbackText = '') {
  const text = String(value || fallbackText || '');
  return text.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

export function resolvePsFamilyClashAuditConfig(overrides = {}) {
  return Object.freeze({ ...PS_FAMILY_CLASH_AUDIT_CONFIG, ...overrides });
}

export function readPsFamilyUiSettings(getField, config = PS_FAMILY_CLASH_AUDIT_CONFIG) {
  const tolerance = Number(getField('tolerance')?.value);
  const sourceFamily = String(getField('source-family')?.value || '').trim().toUpperCase();
  const familyPrefixesText = String(getField('family-prefixes')?.value || config.familyPrefixesText).trim();
  const structuralZonesText = String(getField('structural-zones')?.value || config.structuralZonesText).trim();
  const supportZonesText = String(getField('support-zones')?.value || config.supportZonesText).trim();
  const familyPrefixes = normalizeFamilyPrefixes({ familyPrefixesText });
  const structuralZones = parseListText(structuralZonesText, config.structuralZonesText);
  const supportZones = parseListText(supportZonesText, config.supportZonesText);
  return Object.freeze({
    evidenceMode: getField('evidence-mode')?.value || config.defaultEvidenceMode,
    sourceSide: getField('source-side')?.value || config.sourceSideOptions[0].value,
    sourceFamily,
    familyPrefixesText: familyPrefixes.join(', '),
    familyPrefixes,
    familyDetectorLabel: buildFamilyRootDetectorLabel({ familyPrefixes }),
    structuralZonesText: structuralZones.join(', '),
    supportZonesText: supportZones.join(', '),
    structuralZones,
    supportZones,
    posToleranceMm: Number.isFinite(tolerance) ? tolerance : config.posToleranceMm,
  });
}

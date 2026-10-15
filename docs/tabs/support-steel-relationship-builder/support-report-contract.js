export const SUPPORT_REPORT_SCHEMA = 'SupportReportBundle.v1';
export const SUPPORT_REPORT_EVIDENCE_SCHEMA = 'SupportReportClashEvidence.v1';
export const SUPPORT_REPORT_ROW_SCHEMA = 'SupportReportRow.v1';

export const SUPPORT_REPORT_COLUMNS = Object.freeze([
  column('scope', 'SCOPE'),
  column('civilSecondarySupport', 'CIVILSECONDARYSUPPORT'),
  column('pipe', 'PIPE', 'PIPE\n'),
  column('size', 'SIZE', 'SIZE\n'),
  column('pipeSchedule', 'PIPE SCHEDULE', 'PIPE SCHEDULE\n'),
  column('pipeInsulationThickness', 'PIPE INSULATION THICKNESS', 'PIPE INSULATION THICKNESS\n'),
  column('pipeInsulationType', 'PIPE INSULATION TYPE', 'PIPE INSULATION TYPE\n'),
  column('pipingPrimarySupport', 'PIPING PRIMARY SUPPORT', ''),
  column('supportType', 'SUPPORT TYPE', 'SUPPORT TYPE\n'),
  column('pipingPrimarySupportReference', 'PIPING PRIMARY SUPPORT REFERENCE', 'PIPING PRIMARY SUPPORT REFERENCE\n'),
  column('eastWest', 'EAST/WEST'),
  column('northSouth', 'NORTH/SOUTH'),
  column('bopElevation', 'BOP ELEVATION'),
  column('stressSystemNumber', 'STRESS SYS.NO', 'STRESS SYS.NO\n'),
  column('nodeNumber', 'NODE NO', 'NODE NO\n'),
  column('totalSupportPointsOnSecondary', 'TOTAL SUPPORT POINTS ON SECONDARY'),
  column('previousName', 'PREV NAME'),
  column('primarySupportDescription', 'PRIMARY SUPPORT DESCRIPTION'),
  column('primarySupportZone', 'PRIMARY SUPPORT ZONE'),
  column('primarySupportSite', 'PRIMARY SUPPORT SITE'),
  column('remarks', 'REMARKS'),
]);

export const SUPPORT_REPORT_TYPICALITY_COLUMNS = Object.freeze([
  column('typicalStructure', 'TYPICAL STRUCTURE (PS NO.)'),
  column('pipingSupportArrangementMatch', 'PIPING SUPPORT ARRANGEMENT MATCH'),
  column('typicalityAuditId', 'TYPICALITY AUDIT ID'),
]);

export const SUPPORT_REPORT_COMPARISON_COLUMNS = Object.freeze([
  ...SUPPORT_REPORT_COLUMNS,
  ...SUPPORT_REPORT_TYPICALITY_COLUMNS,
]);

export function supportReportColumns(bundle = null, options = {}) {
  const enabled = options.includeTypicality === true || Boolean(bundle?.typicalityAudit);
  return enabled ? SUPPORT_REPORT_COMPARISON_COLUMNS : SUPPORT_REPORT_COLUMNS;
}

export function supportReportColumnHeader(columnOrKey, options = {}) {
  const columnDef = typeof columnOrKey === 'string'
    ? SUPPORT_REPORT_COMPARISON_COLUMNS.find((column) => column.key === columnOrKey)
    : columnOrKey;
  if (!columnDef) return '';
  if (options.ownerWorkbookFidelity === true) return columnDef.ownerWorkbookLabel;
  if (options.legacyBlankPrimarySupportHeader === true && columnDef.key === 'pipingPrimarySupport') return '';
  return columnDef.label;
}

export function supportReportColumnValue(row, columnOrKey) {
  const key = typeof columnOrKey === 'string' ? columnOrKey : columnOrKey?.key;
  if (key === 'pipeInsulationTypeAndThickness') {
    return [row?.pipeInsulationType, row?.pipeInsulationThickness]
      .map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
  }
  if (key === 'revision') return row?.revision ?? '';
  return row?.[key] ?? '';
}

function column(key, label, ownerWorkbookLabel = label) {
  return Object.freeze({ key, label, ownerWorkbookLabel });
}

export const SUPPORT_REPORT_DIAGNOSTICS = Object.freeze({
  EMPTY_XML: 'SUPPORT_REPORT_EMPTY_XML',
  NO_CLASH_RESULTS: 'SUPPORT_REPORT_NO_CLASH_RESULTS',
  AMBIGUOUS_PIPE_SIDE: 'SUPPORT_REPORT_AMBIGUOUS_PIPE_SIDE',
  MISSING_PIPE_SIDE: 'SUPPORT_REPORT_MISSING_PIPE_SIDE',
  MISSING_SECONDARY_FAMILY: 'SUPPORT_REPORT_MISSING_SECONDARY_FAMILY',
  MISSING_PRIMARY_MEMBER: 'SUPPORT_REPORT_MISSING_PRIMARY_MEMBER',
  RELATIONSHIP_BUNDLE_UNAVAILABLE: 'SUPPORT_REPORT_RELATIONSHIP_BUNDLE_UNAVAILABLE',
  FAMILY_NOT_FOUND: 'SUPPORT_REPORT_FAMILY_NOT_FOUND',
  MEMBER_ENRICHMENT_INCOMPLETE: 'SUPPORT_REPORT_MEMBER_ENRICHMENT_INCOMPLETE',
  CARRIER_ENRICHMENT_UNAVAILABLE: 'SUPPORT_REPORT_CARRIER_ENRICHMENT_UNAVAILABLE',
  CARRIER_ATTRIBUTE_CONFLICT: 'SUPPORT_REPORT_CARRIER_ATTRIBUTE_CONFLICT',
  COORDINATE_FROM_CLASH_FALLBACK: 'SUPPORT_REPORT_COORDINATE_FROM_CLASH_FALLBACK',
});

export const SUPPORT_REPORT_TRACE_EXPORT_SCHEMA = 'SupportReportTraceCsv.v4';
export const SUPPORT_REPORT_DEBUG_EXPORT_SCHEMA = 'SupportReportDebugExport.v4';

export const SUPPORT_REPORT_TRACE_COLUMNS = Object.freeze([
  'TRACE SCHEMA', 'REPORT SCHEMA', 'EVIDENCE MODE', 'REPORT ROW ID', 'CIVIL SECONDARY SUPPORT', 'PIPE',
  'LOCATION INDEX', 'LOCATION COUNT ON PIPE', 'LOCATION MERGE TOLERANCE MM', 'LOCATION GROUPING BASIS',
  'MEMBER ATTRIBUTION BASIS', 'METADATA ATTRIBUTION BASIS', 'DATUM METADATA SOURCE IDS', 'DATUM METADATA CONFLICTS',
  'DATUM METADATA CONTEXTS', 'MULTI-LOCATION',
  'REPORT E/W', 'REPORT N/S', 'REPORT BOP', 'REPORT COORDINATE BASIS',
  'POS CLUSTER ID', 'POS BASIS', 'NATIVE POS X MM', 'NATIVE POS Y MM', 'NATIVE POS Z MM',
  'OBSERVED PS/SL IDS', 'RESOLVED JSON MEMBER IDS', 'MATCH BASIS', 'TRACE MEMBER COUNT',
  'CLASH MEMBER IDS', 'SELECTED NATIVE MEMBER IDS', 'NATIVE-ONLY MEMBER IDS', 'MISSING CLASH MEMBER IDS',
  'PREV NAME', 'REJECTED PREV NAME DBREF', 'SUPPORT TYPE', 'PRIMARY SUPPORT REFERENCE', 'DESCRIPTION', 'INSU',
  'SOURCE PATHS', 'LINE CONTEXTS', 'FIELD PROVENANCE', 'CARRIER OBJECT IDS', 'CARRIER ATTRIBUTE CONFLICTS',
  'ROW DIAGNOSTIC CODES', 'ROW DIAGNOSTIC MESSAGES', 'RESOLUTION STATE',
  'TYPICAL STRUCTURE', 'PIPING SUPPORT ARRANGEMENT MATCH', 'TYPICALITY AUDIT ID',
  'TYPICALITY FINAL RESULT', 'TYPICALITY FINAL REASON CODE',
  'TYPICALITY CONSENSUS RESULT', 'TYPICALITY CONSENSUS CONFIDENCE',
  'TYPICALITY PUBLICATION STATUS', 'TYPICALITY PUBLICATION REASON', 'TYPICALITY CHANNEL AUDIT',
]);

export function supportReportTraceRows(bundle) {
  const output = [];
  for (const row of bundle?.rows || []) {
    for (const cluster of traceClusters(row)) output.push(traceRow(bundle, row, cluster));
  }
  return Object.freeze(output.map((row) => Object.freeze(row)));
}

export function supportReportTraceToCsv(bundle) {
  const lines = [SUPPORT_REPORT_TRACE_COLUMNS.map(csvCell).join(',')];
  for (const row of supportReportTraceRows(bundle)) {
    lines.push(SUPPORT_REPORT_TRACE_COLUMNS.map((column) => csvCell(row[column])).join(','));
  }
  return lines.join('\n');
}

export function supportReportTraceSummary(bundle) {
  const traces = (bundle?.rows || []).flatMap((row) => traceMembers(row));
  const clusters = (bundle?.rows || []).flatMap((row) => traceClusters(row));
  const countBasis = (basis) => traces.filter((trace) => trace.matchBasis === basis).length;
  const rows = bundle?.rows || [];
  return Object.freeze({
    reportRowCount: rows.length,
    enrichedRowCount: Number(bundle?.summary?.enrichedRowCount || 0),
    xmlOnlyRowCount: Number(bundle?.summary?.xmlOnlyRowCount || 0),
    posClusterCount: clusters.length,
    unresolvedPosClusterCount: clusters.filter((cluster) => cluster.posClusterId === 'UNRESOLVED_POS').length,
    directMemberMatchCount: countBasis('DIRECT_MEMBER_ID'),
    previousNameAliasMatchCount: countBasis('PREVIOUS_NAME_ALIAS'),
    familyLineEnrichmentCount: countBasis('FAMILY_LINE_ENRICHMENT'),
    unresolvedMemberMatchCount: traces.filter((trace) => unresolvedBasis(trace.matchBasis)).length,
    rowsWithoutTraceCount: rows.filter((row) => traceMembers(row).length === 0).length,
    multiLocationRowCount: Number(bundle?.summary?.multiLocationRowCount || 0),
    sameConcreteMemberGroupingRowCount: rows.filter((row) => locationGroupingBasis(row).includes('SAME_CONCRETE_MEMBER')).length,
    within50mmGroupingRowCount: rows.filter((row) => locationGroupingBasis(row).includes('WITHIN_50MM')).length,
    multiLocationObservedOnlyRowCount: rows.filter((row) => memberAttributionBasis(row).startsWith('MULTI_LOCATION_')).length,
    rejectedPreviousNameDbrefCount: traces.filter((trace) => clean(trace?.attributeEvidence?.previousNameRejectedDbref)).length,
    datumMetadataRowCount: rows.filter((row) => metadataAttributionBasis(row) === 'SINGLE_LOCATION_FAMILY_DATUM_METADATA').length,
    datumMetadataConflictRowCount: rows.filter((row) => metadataConflicts(row).length > 0).length,
    typicalityPublishedRowCount: rows.filter((row) => row?.typicalityPublication?.status === 'PUBLISHED').length,
    typicalityWithheldRowCount: rows.filter((row) => row?.typicalityPublication?.status === 'WITHHELD').length,
    typicalityReviewWithheldRowCount: rows.filter((row) => row?.typicalityPublication?.reasonCode === 'TYPICAL_PUBLICATION_WITHHELD_REVIEW').length,
  });
}

export function supportReportDebugToJson(bundle) {
  const payload = {
    schema: SUPPORT_REPORT_DEBUG_EXPORT_SCHEMA,
    traceExportSchema: SUPPORT_REPORT_TRACE_EXPORT_SCHEMA,
    traceSummary: supportReportTraceSummary(bundle),
    reportBundle: bundle || null,
  };
  return JSON.stringify(stableValue(payload), null, 2);
}

export function supportReportTraceExportFileName(bundle) {
  return `support-report-trace${partialSuffix(bundle)}.csv`;
}

export function supportReportDebugExportFileName(bundle) {
  return `support-report-debug${partialSuffix(bundle)}.json`;
}

function traceRow(bundle, row, cluster) {
  const evidence = row?.evidence || {};
  const members = cluster?.members || [];
  const decision = row?.typicalityDecisionAudit || null;
  const publication = row?.typicalityPublication || decision?.publication || null;
  const consensus = decision?.consensus || null;
  return {
    'TRACE SCHEMA': SUPPORT_REPORT_TRACE_EXPORT_SCHEMA,
    'REPORT SCHEMA': bundle?.schema || row?.schema || '',
    'EVIDENCE MODE': evidence.evidenceMode || bundle?.evidenceMode || '',
    'REPORT ROW ID': row?.rowId || '',
    'CIVIL SECONDARY SUPPORT': row?.civilSecondarySupport || '',
    PIPE: row?.pipe || '',
    'LOCATION INDEX': evidence.locationIndex ?? '',
    'LOCATION COUNT ON PIPE': evidence.locationCountOnPipe ?? '',
    'LOCATION MERGE TOLERANCE MM': evidence.locationMergeToleranceMm ?? '',
    'LOCATION GROUPING BASIS': join(locationGroupingBasis(row)),
    'MEMBER ATTRIBUTION BASIS': memberAttributionBasis(row),
    'METADATA ATTRIBUTION BASIS': metadataAttributionBasis(row),
    'DATUM METADATA SOURCE IDS': join(metadataSourceIds(row)),
    'DATUM METADATA CONFLICTS': compactJson(metadataConflicts(row)),
    'DATUM METADATA CONTEXTS': compactJson(row?.evidence?.jsonTrace?.metadataSources || []),
    'MULTI-LOCATION': evidence.multipleLocationsOnPipe ? 'TRUE' : 'FALSE',
    'REPORT E/W': row?.eastWest || '',
    'REPORT N/S': row?.northSouth || '',
    'REPORT BOP': row?.bopElevation || '',
    'REPORT COORDINATE BASIS': evidence.reportCoordinateBasis || '',
    'POS CLUSTER ID': cluster?.posClusterId || 'UNRESOLVED_POS',
    'POS BASIS': cluster?.positionBasis || 'UNRESOLVED',
    'NATIVE POS X MM': numericPoint(cluster?.positionGlobal, 'x'),
    'NATIVE POS Y MM': numericPoint(cluster?.positionGlobal, 'y'),
    'NATIVE POS Z MM': numericPoint(cluster?.positionGlobal, 'z'),
    'OBSERVED PS/SL IDS': join(cluster?.observedMemberIds),
    'RESOLVED JSON MEMBER IDS': join(cluster?.resolvedMemberIds),
    'MATCH BASIS': join(cluster?.matchBases),
    'TRACE MEMBER COUNT': members.length,
    'CLASH MEMBER IDS': join(evidence.clashMemberIds),
    'SELECTED NATIVE MEMBER IDS': join(evidence.selectedNativeMemberIds),
    'NATIVE-ONLY MEMBER IDS': join(evidence.nativeOnlyMemberIds),
    'MISSING CLASH MEMBER IDS': join(evidence.missingClashMemberIds),
    'PREV NAME': clusterAttribute(cluster, 'previousName'),
    'REJECTED PREV NAME DBREF': clusterAttribute(cluster, 'previousNameRejectedDbref'),
    'SUPPORT TYPE': clusterAttribute(cluster, 'supportType') || row?.supportType || '',
    'PRIMARY SUPPORT REFERENCE': clusterAttribute(cluster, 'primarySupportReference') || row?.pipingPrimarySupportReference || '',
    DESCRIPTION: clusterAttribute(cluster, 'description') || row?.primarySupportDescription || '',
    INSU: clusterAttribute(cluster, 'insulationThickness') || row?.pipeInsulationThickness || '',
    'SOURCE PATHS': join(members.map((member) => (member.sourcePath || []).join(' > '))),
    'LINE CONTEXTS': join(members.map((member) => compactJson(member.lineContext)).filter(Boolean)),
    'FIELD PROVENANCE': compactJson(evidence.fieldProvenance),
    'CARRIER OBJECT IDS': join(evidence.carrierObjectIds),
    'CARRIER ATTRIBUTE CONFLICTS': compactJson(evidence.carrierAttributeConflicts),
    'ROW DIAGNOSTIC CODES': join((row?.diagnostics || []).map((item) => item.code || item.severity)),
    'ROW DIAGNOSTIC MESSAGES': join((row?.diagnostics || []).map((item) => item.message)),
    'RESOLUTION STATE': resolutionState(cluster, evidence),
    'TYPICAL STRUCTURE': row?.typicalStructure || '',
    'PIPING SUPPORT ARRANGEMENT MATCH': row?.pipingSupportArrangementMatch || '',
    'TYPICALITY AUDIT ID': row?.typicalityAuditId || '',
    'TYPICALITY FINAL RESULT': decision?.final?.result || '',
    'TYPICALITY FINAL REASON CODE': decision?.final?.reasonCode || '',
    'TYPICALITY CONSENSUS RESULT': consensus?.result || '',
    'TYPICALITY CONSENSUS CONFIDENCE': consensus?.confidence || '',
    'TYPICALITY PUBLICATION STATUS': publication?.status || '',
    'TYPICALITY PUBLICATION REASON': publication?.reasonCode || '',
    'TYPICALITY CHANNEL AUDIT': compactJson(decision),
  };
}

function traceClusters(row) {
  const trace = row?.evidence?.jsonTrace || {};
  if (trace.posClusters?.length) return trace.posClusters;
  if (trace.members?.length) return trace.members.map((member, index) => ({
    posClusterId: validPoint(member.positionGlobal) ? `LEGACY_POS_${index + 1}` : 'UNRESOLVED_POS',
    positionBasis: validPoint(member.positionGlobal) ? member.positionBasis || 'NATIVE_MEMBER_POSITION' : 'UNRESOLVED',
    positionGlobal: member.positionGlobal || null,
    observedMemberIds: member.observedMemberId ? [member.observedMemberId] : [],
    resolvedMemberIds: member.resolvedMemberId ? [member.resolvedMemberId] : [],
    matchBases: member.matchBasis ? [member.matchBasis] : [],
    members: [member],
  }));
  return [{
    posClusterId: 'UNRESOLVED_POS', positionBasis: 'UNRESOLVED', positionGlobal: null,
    observedMemberIds: row?.evidence?.clashMemberIds || [], resolvedMemberIds: [], matchBases: ['NO_JSON_TRACE'], members: [],
  }];
}

function traceMembers(row) { return row?.evidence?.jsonTrace?.members || []; }
function locationGroupingBasis(row) {
  return row?.evidence?.jsonTrace?.locationGroupingBasis || row?.evidence?.locationGroupingBasis || [];
}
function memberAttributionBasis(row) {
  return row?.evidence?.jsonTrace?.memberAttributionBasis || row?.evidence?.memberAttributionBasis || '';
}
function metadataAttributionBasis(row) {
  return row?.evidence?.jsonTrace?.metadataAttributionBasis || row?.evidence?.metadataAttributionBasis || '';
}
function metadataSourceIds(row) {
  return row?.evidence?.jsonTrace?.metadataSourceMemberIds || row?.evidence?.metadataSourceMemberIds || [];
}
function metadataConflicts(row) {
  return row?.evidence?.jsonTrace?.metadataAttributeConflicts || row?.evidence?.metadataAttributeConflicts || [];
}
function resolutionState(cluster, evidence) {
  const resolved = (cluster?.resolvedMemberIds || []).length > 0;
  const observed = (cluster?.observedMemberIds || []).length > 0;
  const unresolvedPos = !validPoint(cluster?.positionGlobal);
  if (resolved && unresolvedPos) return 'RESOLVED_MEMBER_UNRESOLVED_POS';
  if (resolved) return (evidence?.missingClashMemberIds || []).length ? 'PARTIAL_MEMBER_RESOLUTION' : 'RESOLVED';
  if (observed) return 'UNRESOLVED_MEMBER';
  return 'NO_JSON_TRACE';
}
function unresolvedBasis(value) {
  return !value || value === 'UNRESOLVED' || String(value).startsWith('AMBIGUOUS_') || String(value).endsWith('_CONFLICT');
}
function clusterAttribute(cluster, key) {
  return join((cluster?.members || []).map((member) => member?.attributeEvidence?.[key]).filter(Boolean));
}
function numericPoint(point, key) { return validPoint(point) ? Number(point[key]) : ''; }
function validPoint(point) { return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite)); }
function join(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value !== '' && value != null).map(String))].join(' | ');
}
function compactJson(value) {
  if (value == null) return '';
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return '';
  return JSON.stringify(stableValue(value));
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}
function partialSuffix(bundle) {
  return Number(bundle?.summary?.xmlOnlyRowCount || 0) > 0 ? '-partial' : '';
}
function spreadsheetSafeText(value) {
  const text = String(value ?? '');
  return typeof value === 'string' && /^[=+\-@]/u.test(text) ? `'${text}` : text;
}
function csvCell(value) {
  const text = spreadsheetSafeText(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function clean(value) { return value == null ? '' : String(value).trim(); }

export const _test = Object.freeze({
  resolutionState, traceClusters, stableValue, locationGroupingBasis, memberAttributionBasis, metadataAttributionBasis,
});

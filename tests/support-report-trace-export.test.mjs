import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_REPORT_TRACE_COLUMNS,
  supportReportDebugToJson,
  supportReportTraceRows,
  supportReportTraceSummary,
  supportReportTraceToCsv,
} from '../tabs/support-steel-relationship-builder/support-report-trace-export.js';

function bundle() {
  const member = (observed, resolved, basis, point) => ({
    observedMemberId: observed,
    resolvedMemberId: resolved,
    matchBasis: basis,
    positionBasis: point ? 'NATIVE_MEMBER_POSITION' : 'UNRESOLVED',
    positionGlobal: point,
    sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', resolved].filter(Boolean),
    lineContext: { fullLineTag: 'ASIM-LINE' },
    attributeEvidence: {
      previousName: '', previousNameRaw: '', previousNameRejectedDbref: '', previousNameSuppressedNoOp: '',
      supportType: resolved ? 'PG-50' : '',
      primarySupportReference: resolved ? '=1/2' : '',
      description: resolved ? 'GUIDE' : '',
      insulationThickness: resolved ? '0mm' : '',
    },
  });
  const resolved = member('/PS-12005.1', '/PS-12005.1', 'DIRECT_MEMBER_ID', { x: 10, y: -20, z: 30 });
  const unresolved = member('/PS-12005', '', 'UNRESOLVED', null);
  const publishedAudit = {
    schema: 'SupportReportTypicalityRowAudit.v1',
    structural: { result: 'TYPICAL', candidateFamilyId: 'PS-14168', auditId: 'STRUCT-1' },
    relationshipTopology: { result: 'MATCH', selectedFamilyId: 'PS-14168', auditId: 'REL-1', failedReasonCodes: [] },
    axisTypicality: { result: 'MATCH', selectedFamilyId: 'PS-14168', auditId: 'AXIS-1', failedReasonCodes: [] },
    consensus: { schema: 'TypicalityConsensusV1', result: 'ALL_CHANNELS_AGREE', confidence: 'VERY_HIGH', basis: 'All channels agree.' },
    final: { result: 'TYPICAL', reasonCode: 'TYPICAL_MATCH', candidateFamilyId: 'PS-14168', auditId: 'FINAL-1' },
    publication: { schema: 'SupportReportTypicalityPublication.v1', status: 'PUBLISHED', reasonCode: 'TYPICAL_PUBLICATION_FINAL_TYPICAL', candidateFamilyId: 'PS-14168' },
  };
  const withheldAudit = {
    schema: 'SupportReportTypicalityRowAudit.v1',
    structural: { result: 'TYPICAL', candidateFamilyId: 'PS-14168', auditId: 'STRUCT-2' },
    relationshipTopology: { result: 'NO_MATCH', selectedFamilyId: '', auditId: 'REL-2', failedReasonCodes: ['REL_ASSEMBLY_COUNT_EQUAL'] },
    axisTypicality: { result: 'MATCH', selectedFamilyId: 'PS-14168', auditId: 'AXIS-2', failedReasonCodes: [] },
    consensus: { schema: 'TypicalityConsensusV1', result: 'CONFLICT', confidence: 'LOW', basis: 'Relationship conflict.' },
    final: { result: 'REVIEW', reasonCode: 'TYPICAL_CONSENSUS_RELATIONSHIP_CONFLICT', candidateFamilyId: 'PS-14168', auditId: 'FINAL-2' },
    publication: { schema: 'SupportReportTypicalityPublication.v1', status: 'WITHHELD', reasonCode: 'TYPICAL_PUBLICATION_WITHHELD_REVIEW', candidateFamilyId: 'PS-14168' },
  };
  return {
    schema: 'SupportReportBundle.v1',
    evidenceMode: 'CLASH_XML_PLUS_RELATIONSHIP_BUNDLE',
    summary: { reportRowCount: 2, enrichedRowCount: 1, xmlOnlyRowCount: 1, multiLocationRowCount: 2 },
    rows: [
      {
        schema: 'SupportReportRow.v1', rowId: 'ROW-A', civilSecondarySupport: 'PS-12005(REF)', pipe: 'ASIM-LINE',
        eastWest: 'E 100 mm', northSouth: 'S 200 mm', bopElevation: 'U 300 mm',
        typicalStructure: 'PS-14168', pipingSupportArrangementMatch: 'MATCHED — all channels agree.', typicalityAuditId: 'FINAL-1',
        typicalityPublication: publishedAudit.publication, typicalityDecisionAudit: publishedAudit,
        evidence: {
          evidenceMode: 'CLASH_XML_PLUS_RELATIONSHIP_BUNDLE', clashMemberIds: ['/PS-12005.1'],
          selectedNativeMemberIds: ['/PS-12005.1'], nativeOnlyMemberIds: [], missingClashMemberIds: [],
          locationIndex: 0, locationCountOnPipe: 2, locationMergeToleranceMm: 50, multipleLocationsOnPipe: true,
          reportCoordinateBasis: 'NAVISWORKS_CLASH_LOCATION', carrierObjectIds: ['/PIPE-1'], carrierAttributeConflicts: [],
          metadataAttributionBasis: 'CONCRETE_MEMBER_METADATA', metadataSourceMemberIds: [], metadataAttributeConflicts: [],
          fieldProvenance: { eastWest: { sourceClass: 'CLASH_POINT_FALLBACK' } },
          jsonTrace: {
            metadataAttributionBasis: 'CONCRETE_MEMBER_METADATA', metadataSourceMemberIds: [], metadataAttributeConflicts: [], metadataSources: [],
            members: [resolved],
            posClusters: [{
              posClusterId: 'POS:10|-20|30', positionBasis: 'NATIVE_MEMBER_POSITION', positionGlobal: { x: 10, y: -20, z: 30 },
              observedMemberIds: ['/PS-12005.1'], resolvedMemberIds: ['/PS-12005.1'], matchBases: ['DIRECT_MEMBER_ID'], members: [resolved],
            }],
          },
        },
        diagnostics: [{ severity: 'INFO', code: 'COORDINATE_FROM_CLASH_FALLBACK', message: 'Navisworks report location used.' }],
      },
      {
        schema: 'SupportReportRow.v1', rowId: 'ROW-B', civilSecondarySupport: 'PS-12005(REF)', pipe: 'ASIM-LINE',
        eastWest: 'E 100 mm', northSouth: 'S 280 mm', bopElevation: 'U 300 mm',
        typicalStructure: '', pipingSupportArrangementMatch: 'REVIEW — Candidate PS-14168 withheld.', typicalityAuditId: 'FINAL-2',
        typicalityPublication: withheldAudit.publication, typicalityDecisionAudit: withheldAudit,
        evidence: {
          evidenceMode: 'CLASH_XML_PLUS_RELATIONSHIP_BUNDLE', clashMemberIds: ['/PS-12005'],
          selectedNativeMemberIds: [], nativeOnlyMemberIds: [], missingClashMemberIds: ['/PS-12005'],
          locationIndex: 1, locationCountOnPipe: 2, locationMergeToleranceMm: 50, multipleLocationsOnPipe: true,
          reportCoordinateBasis: 'NAVISWORKS_CLASH_LOCATION', carrierObjectIds: [], carrierAttributeConflicts: [],
          metadataAttributionBasis: 'MULTI_LOCATION_DATUM_METADATA_DISABLED', metadataSourceMemberIds: [], metadataAttributeConflicts: [],
          fieldProvenance: {},
          jsonTrace: {
            metadataAttributionBasis: 'MULTI_LOCATION_DATUM_METADATA_DISABLED', metadataSourceMemberIds: [], metadataAttributeConflicts: [], metadataSources: [],
            members: [unresolved],
            posClusters: [{
              posClusterId: 'UNRESOLVED_POS', positionBasis: 'UNRESOLVED', positionGlobal: null,
              observedMemberIds: ['/PS-12005'], resolvedMemberIds: [], matchBases: ['UNRESOLVED'], members: [unresolved],
            }],
          },
        },
        diagnostics: [{ severity: 'WARN', code: 'MEMBER_ENRICHMENT_INCOMPLETE', message: 'No staged member resolved.' }],
      },
    ],
    diagnostics: [],
  };
}

test('trace CSV exposes row location, native POS cluster and mapping basis without changing report grain', () => {
  const rows = supportReportTraceRows(bundle());
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['REPORT ROW ID'], 'ROW-A');
  assert.equal(rows[0]['REPORT N/S'], 'S 200 mm');
  assert.equal(rows[0]['POS CLUSTER ID'], 'POS:10|-20|30');
  assert.equal(rows[0]['NATIVE POS Y MM'], -20);
  assert.equal(rows[0]['MATCH BASIS'], 'DIRECT_MEMBER_ID');
  assert.equal(rows[0]['REPORT COORDINATE BASIS'], 'NAVISWORKS_CLASH_LOCATION');
  assert.equal(rows[1]['REPORT N/S'], 'S 280 mm');
  assert.equal(rows[1]['POS CLUSTER ID'], 'UNRESOLVED_POS');
  assert.equal(rows[1]['RESOLUTION STATE'], 'UNRESOLVED_MEMBER');
});

test('trace v4 exposes Column 22 publication and independent typicality-channel audit', () => {
  const rows = supportReportTraceRows(bundle());
  assert.equal(rows[0]['TRACE SCHEMA'], 'SupportReportTraceCsv.v4');
  assert.equal(rows[0]['TYPICAL STRUCTURE'], 'PS-14168');
  assert.equal(rows[0]['TYPICALITY FINAL RESULT'], 'TYPICAL');
  assert.equal(rows[0]['TYPICALITY CONSENSUS RESULT'], 'ALL_CHANNELS_AGREE');
  assert.equal(rows[0]['TYPICALITY CONSENSUS CONFIDENCE'], 'VERY_HIGH');
  assert.equal(rows[0]['TYPICALITY PUBLICATION STATUS'], 'PUBLISHED');
  assert.match(rows[0]['TYPICALITY CHANNEL AUDIT'], /"relationshipTopology"/);
  assert.match(rows[0]['TYPICALITY CHANNEL AUDIT'], /"axisTypicality"/);
  assert.equal(rows[1]['TYPICAL STRUCTURE'], '');
  assert.equal(rows[1]['TYPICALITY FINAL RESULT'], 'REVIEW');
  assert.equal(rows[1]['TYPICALITY PUBLICATION STATUS'], 'WITHHELD');
  assert.equal(rows[1]['TYPICALITY PUBLICATION REASON'], 'TYPICAL_PUBLICATION_WITHHELD_REVIEW');
});

test('trace CSV has deterministic column order and spreadsheet-safe quoting', () => {
  const csv = supportReportTraceToCsv(bundle());
  const firstLine = csv.split('\n')[0];
  assert.equal(firstLine, SUPPORT_REPORT_TRACE_COLUMNS.map((value) => `"${value}"`).join(','));
  assert.match(csv, /"POS:10\|-20\|30"/);
  assert.match(csv, /"'=1\/2"/);
});

test('trace summary makes unresolved member, POS and typicality publication evidence visible', () => {
  const summary = supportReportTraceSummary(bundle());
  assert.deepEqual(summary, {
    reportRowCount: 2,
    enrichedRowCount: 1,
    xmlOnlyRowCount: 1,
    posClusterCount: 2,
    unresolvedPosClusterCount: 1,
    directMemberMatchCount: 1,
    previousNameAliasMatchCount: 0,
    familyLineEnrichmentCount: 0,
    unresolvedMemberMatchCount: 1,
    rowsWithoutTraceCount: 0,
    multiLocationRowCount: 2,
    sameConcreteMemberGroupingRowCount: 0,
    within50mmGroupingRowCount: 0,
    multiLocationObservedOnlyRowCount: 0,
    rejectedPreviousNameDbrefCount: 0,
    datumMetadataRowCount: 0,
    datumMetadataConflictRowCount: 0,
    typicalityPublishedRowCount: 1,
    typicalityWithheldRowCount: 1,
    typicalityReviewWithheldRowCount: 1,
  });
});

test('debug JSON is lossless around the canonical report bundle and includes trace summary', () => {
  const source = bundle();
  const parsed = JSON.parse(supportReportDebugToJson(source));
  assert.equal(parsed.schema, 'SupportReportDebugExport.v4');
  assert.equal(parsed.traceExportSchema, 'SupportReportTraceCsv.v4');
  assert.equal(parsed.traceSummary.unresolvedPosClusterCount, 1);
  assert.equal(parsed.traceSummary.typicalityPublishedRowCount, 1);
  assert.deepEqual(parsed.reportBundle, source);
});

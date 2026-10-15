import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1212';
import { supportReportTraceRows, supportReportTraceSummary } from '../tabs/support-steel-relationship-builder/support-report-trace-export.js?issue=1212';

const line = 'ASIM-1885-2"-D8810244-11441T3-PP-01';
const branch = `/${line}/B3`;

function group(overrides = {}) {
  return Object.freeze({
    groupId: `PS-12001::${line}::L1`, secondarySupportFamilyId: 'PS-12001', fullLineTag: line, scope: 'ASIM',
    branchNodes: [branch], primarySupportMemberIds: ['/PS-12001'],
    clashPointsGlobalMm: [{ x: 605291, y: -1100997, z: 101700 }],
    representativeClashPointGlobalMm: { x: 605291, y: -1100997, z: 101700 },
    primaryPaths: [['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${line}`, branch, '/PS-12001']],
    secondaryPaths: [['/ASIM-1835-CU-SU', '/PS-12001']], evidenceRows: [{}], clashCount: 1,
    totalSupportPointsOnSecondary: 1, locationIndex: 0, locationCountOnPipe: 1,
    locationMergeToleranceMm: 50, multipleLocationsOnPipe: false, ...overrides,
  });
}

function member(memberId, semanticRole, attributes = {}, fullLineTag = line) {
  return {
    memberId, semanticRole, attributes,
    positionGlobal: { x: 605291.545, y: -1100997.404, z: 1704.039 },
    sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${fullLineTag}`, branch, memberId],
    sourceParentBranch: branch,
    lineContext: { fullLineTag, branchNode: branch },
  };
}
function datum(attributes, fullLineTag = line) {
  return member('/PS-12001/DATUM', 'DATUM', attributes, fullLineTag);
}
function relationship(members) {
  return {
    schema: 'SupportSteelRelationshipBundle.v1', supportFamilies: [{ familyId: 'PS-12001', members }],
    supportCarrierResolution: { carrierObjects: [] },
  };
}
function report(members, groupOverrides = {}) {
  return buildSupportReportBundle({
    clashEvidence: { schema: 'SupportReportClashEvidence.v1', rows: [{}], groups: [group(groupOverrides)], diagnostics: [] },
    relationshipBundle: relationship(members),
  });
}

test('single-location family DATUM supplies metadata without becoming primary-support identity', () => {
  const result = report([datum({ CMPSUPTYPE: 'REST', REF: '=100/1', DTXR: 'Pipe Rest XRT01', INSU: '25.4mm' })]);
  const row = result.rows[0];
  assert.equal(row.pipingPrimarySupport, '');
  assert.equal(row.supportType, 'REST');
  assert.equal(row.pipingPrimarySupportReference, '=100/1');
  assert.equal(row.primarySupportDescription, 'Pipe Rest XRT01');
  assert.equal(row.pipeInsulationThickness, '25.4mm');
  assert.equal(row.evidence.metadataAttributionBasis, 'SINGLE_LOCATION_FAMILY_DATUM_METADATA');
  assert.deepEqual(row.evidence.metadataSourceMemberIds, ['/PS-12001/DATUM']);
  assert.equal(row.evidence.fieldProvenance.supportType.sourceClass, 'AUTHORITATIVE_NATIVE_FAMILY_DATUM_ATTRIBUTE');
  assert.equal(result.summary.datumMetadataRowCount, 1);
});

test('concrete native member remains authoritative and DATUM is not used as competing metadata', () => {
  const concrete = member('/PS-12001.1', 'OTHER_FAMILY_MEMBER', {
    CMPSUPTYPE: 'GUIDE', REF: '=200/2', DTXR: 'Pipe Guide', INSU: '50mm',
  });
  const result = report([concrete, datum({ CMPSUPTYPE: 'REST', REF: '=100/1', DTXR: 'Pipe Rest', INSU: '25mm' })]);
  const row = result.rows[0];
  assert.equal(row.pipingPrimarySupport, '/PS-12001.1');
  assert.equal(row.supportType, 'GUIDE');
  assert.equal(row.pipingPrimarySupportReference, '=200/2');
  assert.equal(row.evidence.metadataAttributionBasis, 'CONCRETE_MEMBER_METADATA');
  assert.deepEqual(row.evidence.metadataSourceMemberIds, []);
});

test('wrong-line DATUM cannot enrich a Support Report row', () => {
  const result = report([datum({ CMPSUPTYPE: 'REST' }, 'ASIM-1885-OTHER-LINE')]);
  const row = result.rows[0];
  assert.equal(row.supportType, '');
  assert.equal(row.evidence.metadataAttributionBasis, 'NO_DATUM_METADATA');
  assert.deepEqual(row.evidence.metadataSourceMemberIds, []);
});

test('conflicting compatible DATUM attributes stay blank and fail visible', () => {
  const result = report([
    datum({ CMPSUPTYPE: 'REST', REF: '=100/1' }),
    datum({ CMPSUPTYPE: 'GUIDE', REF: '=100/1' }),
  ]);
  const row = result.rows[0];
  assert.equal(row.supportType, '');
  assert.equal(row.pipingPrimarySupportReference, '=100/1');
  assert.equal(row.evidence.fieldProvenance.supportType.sourceClass, 'AUTHORITATIVE_SOURCE_CONFLICT');
  assert.equal(row.evidence.fieldProvenance.supportType.valueStatus, 'CONFLICT');
  assert.equal(row.evidence.metadataAttributeConflicts[0].field, 'supportType');
});

test('multi-location rows remain fail-closed for family DATUM metadata', () => {
  const result = report([datum({ CMPSUPTYPE: 'REST' })], {
    locationIndex: 0, locationCountOnPipe: 2, multipleLocationsOnPipe: true,
  });
  const row = result.rows[0];
  assert.equal(row.supportType, '');
  assert.equal(row.evidence.metadataAttributionBasis, 'MULTI_LOCATION_DATUM_METADATA_DISABLED');
  assert.deepEqual(row.evidence.metadataSourceMemberIds, []);
});

test('Trace CSV evidence exposes DATUM metadata source and recovered report value', () => {
  const result = report([datum({ CMPSUPTYPE: 'REST', REF: '=100/1', DTXR: 'Pipe Rest XRT01', INSU: '25.4mm' })]);
  const trace = supportReportTraceRows(result)[0];
  assert.equal(trace['METADATA ATTRIBUTION BASIS'], 'SINGLE_LOCATION_FAMILY_DATUM_METADATA');
  assert.equal(trace['DATUM METADATA SOURCE IDS'], '/PS-12001/DATUM');
  assert.equal(trace['SUPPORT TYPE'], 'REST');
  assert.equal(trace['PRIMARY SUPPORT REFERENCE'], '=100/1');
  assert.match(trace['DATUM METADATA CONTEXTS'], /PS-12001\/DATUM/);
  const summary = supportReportTraceSummary(result);
  assert.equal(summary.datumMetadataRowCount, 1);
  assert.equal(summary.datumMetadataConflictRowCount, 0);
});

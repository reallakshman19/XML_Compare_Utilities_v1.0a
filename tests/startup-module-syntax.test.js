import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  createSupportReportWorkbook,
  supportReportSpreadsheetMatrix,
  supportReportToXlsxBytes,
} from '../tabs/support-steel-relationship-builder/support-report-xlsx.js?v=20260910-support-report-owner-contract-15';
import {
  projectSupportReportFieldProvenance,
  projectSupportReportFields,
  SUPPORT_REPORT_FIELD_SOURCE_CLASSES,
} from '../tabs/support-steel-relationship-builder/support-report-field-projection.js?v=20260910-support-report-field-provenance-14';
import { _test as supportReportEngineTest } from '../tabs/support-steel-relationship-builder/support-report-engine.js?v=20260910-support-report-field-provenance-14';
import { parseSupportReportClashXml as parseSupportReportClashXmlWithTestContext } from '../tabs/support-steel-relationship-builder/support-report-clash-test-context.js?v=20260909-support-report-parser-primitives-8';
import { parseSupportReportClashXml as parseSupportReportClashXmlSafely } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js?v=20260909-support-report-parser-primitives-8';

const CACHE_TOKEN = '20260717-startup-parse-hotfix-1';
const SUPPORT_REPORT_PARITY_TOKEN = '20260909-support-report-parity-2';
const SUPPORT_REPORT_PRIMITIVES_TOKEN = '20260909-support-report-parser-primitives-8';
const SUPPORT_REPORT_CARRIER_CONFLICT_TOKEN = '20260909-support-report-carrier-conflict-13';
const SUPPORT_REPORT_FIELD_PROVENANCE_TOKEN = '20260910-support-report-field-provenance-14';
const SUPPORT_REPORT_OWNER_CONTRACT_TOKEN = '20260910-support-report-owner-contract-15';
const syntaxFiles = [
  'main-rhbg-fitguard.js',
  'core/app.js',
  'tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js',
  'tabs/support-steel-relationship-builder/support-restraint-function-addon.js',
  'tabs/support-steel-relationship-builder/support-restraint-function-view.js',
  'tabs/support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js',
  'tabs/support-steel-relationship-builder/support-restraint-function-engine.js',
  'tabs/support-steel-relationship-builder/support-restraint-evidence.js',
  'tabs/support-steel-relationship-builder/support-restraint-intent.js',
  'tabs/support-steel-relationship-builder/support-restraint-local-frame.js',
  'tabs/support-steel-relationship-builder/support-report-contract.js',
  'tabs/support-steel-relationship-builder/support-report-clash-evidence.js',
  'tabs/support-steel-relationship-builder/support-report-clash-test-context.js',
  'tabs/support-steel-relationship-builder/support-report-clash-safety.js',
  'tabs/support-steel-relationship-builder/support-report-field-projection.js',
  'tabs/support-steel-relationship-builder/support-report-engine.js',
  'tabs/support-steel-relationship-builder/support-report-export.js',
  'tabs/support-steel-relationship-builder/support-report-xlsx.js',
  'tabs/support-steel-relationship-builder/support-report-view.js',
  'tabs/support-steel-relationship-builder/support-report-addon.js',
  'tabs/ps-family-clash-audit/ps-family-token-utils.js',
  'tabs/ps-family-clash-audit/ps-family-evidence-audit-bootstrap.js',
  'tabs/ps-family-clash-audit/ps-family-native-audit-pipeline-addon.js',
  'tabs/ps-family-clash-audit/ps-family-restraint-function-addon.js',
];
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} failed JavaScript parsing:\n${result.stderr || result.stdout}`);
}
for (const file of ['index.html', 'main-rhbg-fitguard.js', 'core/app.js', 'tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', 'tabs/ps-family-clash-audit/ps-family-evidence-audit-bootstrap.js']) {
  assert.match(readFileSync(file, 'utf8'), new RegExp(CACHE_TOKEN), `${file} must carry the startup hotfix cache token`);
}
const clashEvidence = readFileSync('tabs/support-steel-relationship-builder/support-report-clash-evidence.js', 'utf8');
assert.ok(clashEvidence.includes(`./support-report-contract.js?v=${SUPPORT_REPORT_PARITY_TOKEN}`),
  'Support Report clash evidence must retain the parser-era contract cache token');
const bootstrap = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', 'utf8');
const addon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
const engine = readFileSync('tabs/support-steel-relationship-builder/support-report-engine.js', 'utf8');
const supportReportExport = readFileSync('tabs/support-steel-relationship-builder/support-report-export.js', 'utf8');
const supportReportXlsx = readFileSync('tabs/support-steel-relationship-builder/support-report-xlsx.js', 'utf8');
const supportReportView = readFileSync('tabs/support-steel-relationship-builder/support-report-view.js', 'utf8');
const safety = readFileSync('tabs/support-steel-relationship-builder/support-report-clash-safety.js', 'utf8');
const context = readFileSync('tabs/support-steel-relationship-builder/support-report-clash-test-context.js', 'utf8');
for (const [source, edge, label] of [
  [addon, './support-report-clash-safety.js', 'addon → safety'],
  [engine, './support-report-clash-safety.js', 'engine → safety'],
  [safety, './support-report-clash-test-context.js', 'safety → test context'],
  [safety, './support-report-clash-evidence.js', 'safety → evidence'],
  [context, './support-report-clash-evidence.js', 'test context → evidence'],
]) {
  assert.ok(source.includes(`${edge}?v=${SUPPORT_REPORT_PRIMITIVES_TOKEN}`),
    `Support Report ${label} must carry the parser primitives cache token`);
}
assert.ok(engine.includes(`./support-report-contract.js?v=${SUPPORT_REPORT_CARRIER_CONFLICT_TOKEN}`),
  'Support Report engine must retain the carrier-conflict contract cache token');
for (const [source, edge, label] of [
  [addon, './support-report-engine.js', 'addon → engine'],
  [engine, './support-report-field-projection.js', 'engine → field projection'],
]) {
  assert.ok(source.includes(`${edge}?v=${SUPPORT_REPORT_FIELD_PROVENANCE_TOKEN}`),
    `Support Report ${label} must carry the field provenance cache token`);
}
for (const [source, edge, label] of [
  [bootstrap, './support-report-addon.js', 'bootstrap → addon'],
  [addon, './support-report-export.js', 'addon → CSV export'],
  [addon, './support-report-view.js', 'addon → view'],
  [addon, './support-report-xlsx.js', 'addon → XLSX export'],
  [supportReportExport, './support-report-contract.js', 'CSV export → contract'],
  [supportReportXlsx, './support-report-contract.js', 'XLSX export → contract'],
  [supportReportView, './support-report-contract.js', 'view → contract'],
]) {
  assert.ok(source.includes(`${edge}?v=${SUPPORT_REPORT_OWNER_CONTRACT_TOKEN}`),
    `Support Report ${label} must carry the Owner contract cache token`);
}
assert.ok(clashEvidence.includes("../ps-family-clash-audit/ps-family-token-utils.js"),
  'Support Report clash evidence must reuse governed PS-family XML/numeric primitives');
assert.ok(context.includes("../ps-family-clash-audit/ps-family-token-utils.js"),
  'Support Report clash-test context must reuse governed PS-family XML decoding');

const xlsxFixture = { rows: [{
  previousName: '', scope: 'ASIM', civilSecondarySupport: 'PS-007(REF)', pipe: 'ASIM-10"-LINE', size: 250,
  pipingPrimarySupport: '/PS-007.7', supportType: 'SHOE-250', pipingPrimarySupportReference: '=67127059/28670',
  eastWest: 'E 798423mm', northSouth: 'S 1125028mm', bopElevation: 'U 100100.45mm',
  totalSupportPointsOnSecondary: 5, remarks: '', primarySupportDescription: 'Pipe shoe',
  primarySupportZone: 'ASIM-CU-PL-S', primarySupportSite: 'ASIM-CU-PL', pipeSchedule: 'PIPE Sch 100',
  pipeInsulationType: 'HC', pipeInsulationThickness: '80mm', stressSystemNumber: 'QSP-SYS-01', nodeNumber: '280', revision: '5',
}] };
const matrix = supportReportSpreadsheetMatrix(xlsxFixture);
assert.deepEqual(matrix[0], Array.from({ length: 21 }, (_, index) => index + 1));
assert.equal(matrix[1].length, 21);
assert.equal(matrix[1][0], 'SCOPE');
assert.equal(matrix[1][7], '');
assert.equal(matrix[1][20], 'REMARKS');
assert.equal(matrix[2][4], 'PIPE Sch 100');
assert.equal(matrix[2][5], '80mm');
assert.equal(matrix[2][6], 'HC');
assert.equal(matrix[2][7], '/PS-007.7');
assert.equal(matrix[2][9], '=67127059/28670');
assert.equal(matrix[2][15], 5);
assert.equal(matrix[2].includes('5'), false);
const captured = {};
const fakeXlsx = {
  utils: {
    aoa_to_sheet(value) { captured.matrix = value; return {}; },
    book_new() { return { sheets: [] }; },
    book_append_sheet(workbook, worksheet, name) { workbook.sheets.push({ worksheet, name }); },
  },
  write(workbook, options) { captured.write = { workbook, options }; return new Uint8Array([80, 75, 3, 4]); },
};
const workbook = createSupportReportWorkbook(xlsxFixture, fakeXlsx);
assert.equal(workbook.sheets[0].name, 'Support Report');
assert.equal(workbook.sheets[0].worksheet['!cols'].length, 21);
assert.equal(workbook.sheets[0].worksheet['!autofilter'].ref, 'A2:U3');
assert.equal(captured.matrix[2][9], '=67127059/28670');
const xlsxBytes = await supportReportToXlsxBytes(xlsxFixture, { XLSX: fakeXlsx });
assert.deepEqual([...xlsxBytes], [80, 75, 3, 4]);
assert.deepEqual(captured.write.options, { bookType: 'xlsx', type: 'array', compression: true });

const fieldAuthorityGroup = {
  scope: 'ASIM', secondarySupportFamilyId: 'PS-007', fullLineTag: 'ASIM-1885-PL-10"-S8810105-HOT-01',
  totalSupportPointsOnSecondary: 1, primaryPaths: [],
};
const classifiedOnlyFields = projectSupportReportFields({
  group: fieldAuthorityGroup,
  reportMembers: [{ memberId: '/PS-007.7', semanticRole: 'PIPE_SHOE', attributes: {} }],
  carrierRows: [], coordinatePoint: null,
});
assert.equal(classifiedOnlyFields.supportType, '');
const nativeTypeFields = projectSupportReportFields({
  group: fieldAuthorityGroup,
  reportMembers: [{ memberId: '/PS-007.7', semanticRole: 'PIPE_SHOE', attributes: { CMPSUPTYPE: 'SHOE-250' } }],
  carrierRows: [], coordinatePoint: null,
});
assert.equal(nativeTypeFields.supportType, 'SHOE-250');
const provenance = projectSupportReportFieldProvenance({
  group: fieldAuthorityGroup,
  reportMembers: [{ memberId: '/PS-007.7', attributes: { CMPSUPTYPE: 'SHOE-250' } }],
  carrierRows: [{ carrierObjectId: '/PIPE-10', attributes: { ABORE: '250' } }],
  coordinateSource: 'NATIVE_MEMBER_POSITION',
  selectedNativeMemberCount: 1,
});
assert.equal(provenance.pipingPrimarySupport.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBERSHIP);
assert.equal(provenance.size.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CARRIER_ATTRIBUTE);
assert.equal(provenance.eastWest.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_POSITION);
assert.equal(provenance.pipeSchedule.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED);

const lineA = 'ASIM-1885-PL-10"-LINE-A';
const lineB = 'ASIM-1885-PL-10"-LINE-B';
const custodyGroup = {
  fullLineTag: lineA,
  branchNodes: [`/${lineA}/B1`],
  primarySupportMemberIds: ['/PS-007.7'],
};
const lineMember = (memberId, fullLineTag) => ({
  memberId,
  semanticRole: 'OTHER_FAMILY_MEMBER',
  lineContext: fullLineTag ? { fullLineTag, branchNode: `/${fullLineTag}/B1` } : {},
  attributes: {},
});
const custodySelected = supportReportEngineTest.selectMembersForGroup({
  members: [lineMember('/PS-007.6', lineA), lineMember('/PS-007.7', lineB)],
}, custodyGroup);
assert.deepEqual(custodySelected.map((member) => member.memberId), ['/PS-007.6']);
assert.equal(supportReportEngineTest.memberContextConflictsGroup(lineMember('/PS-007.7', lineB), custodyGroup), true);
const contextlessSelected = supportReportEngineTest.selectMembersForGroup({
  members: [lineMember('/PS-007.7', '')],
}, custodyGroup);
assert.deepEqual(contextlessSelected.map((member) => member.memberId), ['/PS-007.7']);

function clashObject(nodes, itemName) {
  return `<clashobject><pathlink>${nodes.map((node) => `<node>${node}</node>`).join('')}</pathlink><smarttags><smarttag><name>Item Name</name><value>${itemName}</value></smarttag></smarttags></clashobject>`;
}
function clashResult(name, member) {
  return `<clashresult name="${name}" guid="${name}-GUID"><clashobjects>${clashObject(['/ASIM-CU-PL', '/ASIM-LINE', '/ASIM-LINE/B1', `/${member}`], `/${member}`)}${clashObject(['/ASIM-CU-SU', '/PS-007'], 'GENSEC of /PS-007')}</clashobjects></clashresult>`;
}
const multiTestXml = `<exchange units="m"><clashtest name="Test A" guid="TA">${clashResult('A1', 'PS-007.1')}</clashtest><clashtest name="Test B" guid="TB">${clashResult('B1', 'PS-007.2')}</clashtest></exchange>`;
const multiTest = parseSupportReportClashXmlWithTestContext(multiTestXml);
assert.equal(multiTest.clashTestCount, 2);
assert.equal(multiTest.rowCount, 2);
assert.equal(multiTest.groupCount, 1);
assert.deepEqual(multiTest.rows.map((row) => row.clashTestName), ['Test A', 'Test B']);
assert.deepEqual(multiTest.rows.map((row) => row.clashTestGuid), ['TA', 'TB']);
assert.deepEqual(multiTest.rows.map((row) => row.clashTestIndex), [0, 1]);
assert.deepEqual(multiTest.groups[0].evidenceRows.map((row) => row.clashTestName), ['Test A', 'Test B']);

const malformed = parseSupportReportClashXmlSafely('<exchange><clashtest><clashresult name="Broken"></clashtest></exchange>');
assert.equal(malformed.rowCount, 0);
assert.equal(malformed.diagnostics[0].code, 'SUPPORT_REPORT_MALFORMED_XML');
assert.equal(malformed.diagnostics[0].severity, 'ERROR');

const ambiguousResult = `<clashresult name="Ambiguous" guid="AMB"><clashobjects>${clashObject(['/ASIM-LINE-A', '/ASIM-LINE-A/B1', '/PS-007.1'], '/PS-007.1')}${clashObject(['/ASIM-LINE-B', '/ASIM-LINE-B/B2', '/PS-007.2'], '/PS-007.2')}${clashObject(['/ASIM-CU-SU', '/PS-007'], 'GENSEC of /PS-007')}</clashobjects></clashresult>`;
const ambiguous = parseSupportReportClashXmlSafely(`<exchange><clashtest>${ambiguousResult}</clashtest></exchange>`);
assert.equal(ambiguous.rowCount, 0);
assert.ok(ambiguous.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_AMBIGUOUS_PIPE_SIDE' && item.severity === 'ERROR'));

const conflictingXml = `<exchange><clashtest><clashresult name="Conflict" guid="CON"><clashobjects>${clashObject(['/ASIM-LINE', '/ASIM-LINE/B1', '/PS-007.1'], '/PS-007.1')}${clashObject(['/ASIM-CU-SU', '/PS-007'], 'GENSEC of /PS-007')}${clashObject(['/ASIM-CU-SU', '/SL-097'], 'GENSEC of /SL-097')}</clashobjects></clashresult></clashtest></exchange>`;
const conflicting = parseSupportReportClashXmlSafely(conflictingXml);
assert.equal(conflicting.rowCount, 0);
assert.ok(conflicting.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_CONFLICTING_SECONDARY_FAMILY' && item.severity === 'ERROR'));

const duplicateXml = `<exchange><clashtest>${clashResult('D1', 'PS-007.1')}${clashResult('D2', 'PS-007.1')}</clashtest></exchange>`;
const duplicate = parseSupportReportClashXmlSafely(duplicateXml);
assert.equal(duplicate.rowCount, 2);
assert.equal(duplicate.groupCount, 1);
assert.equal(duplicate.groups[0].evidenceRows.length, 1);
assert.equal(duplicate.groups[0].clashCount, 1);
assert.ok(duplicate.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_DUPLICATE_EVIDENCE' && item.duplicateCount === 1));

const incompleteNumericResult = `<clashresult name="Numeric" guid="NUM"><clashpoint><pos3f x="1" y="2"/></clashpoint><clashobjects>${clashObject(['/ASIM-CU-PL', '/ASIM-LINE', '/ASIM-LINE/B1', '/PS-007A.1'], '/PS-007A.1')}${clashObject(['/ASIM-CU-SU', '/PS-007'], 'GENSEC of /PS-007')}</clashobjects></clashresult>`;
const incompleteNumeric = parseSupportReportClashXmlSafely(`<exchange units="m"><clashtest name="Encoded &amp; Test">${incompleteNumericResult}</clashtest></exchange>`);
assert.equal(incompleteNumeric.rowCount, 1);
assert.equal(incompleteNumeric.rows[0].distanceSourceUnits, null);
assert.equal(incompleteNumeric.rows[0].clashPointGlobalMm, null);
assert.equal(incompleteNumeric.rows[0].primarySupportMemberId, 'PS-007A.1');
assert.equal(incompleteNumeric.rows[0].clashTestName, 'Encoded & Test');
console.log(`startup module syntax gate passed for ${syntaxFiles.length} JavaScript files`);

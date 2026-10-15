import assert from 'node:assert/strict';
import { parsePsFamilyClashXml } from '../tabs/ps-family-clash-audit/ps-family-clash-xml-parser.js';
import { parsePsFamilyRegisterCsv } from '../tabs/ps-family-clash-audit/ps-family-register-csv-parser.js';
import { parsePsFamilyElementDetailCsv } from '../tabs/ps-family-clash-audit/ps-family-element-detail-csv-parser.js';
import { buildPsFamilyPosFamilies } from '../tabs/ps-family-clash-audit/ps-family-posfamily-engine.js';
import { buildPsFamilyClashAudit } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-engine.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { extractFamilyRoot, makeExactMemberKey, parsePipeTag } from '../tabs/ps-family-clash-audit/ps-family-token-utils.js';

function clash(name, sourceObject, againstMember, branchNode, distance = '-0.010') {
  const lineNode = branchNode.replace(/\/B\d+$/, '');
  return `<clashresult name="${name}" guid="${name}-guid" href="${name}.jpg" status="new" distance="${distance}">
    <clashpoint><pos3f x="1" y="2" z="3"/></clashpoint>
    <clashobjects>
      <clashobject><pathlink><node>File</node><node>ASIM-1835.rvm</node><node>/ASIM-1835-CU-SU</node><node>/ASIM-1835-CU-SU-A</node><node>/PS-11147</node><node>/PS-11147/MAIN</node><node>/${sourceObject}</node></pathlink><smarttags><smarttag><name>Item Name</name><value>/${sourceObject}</value></smarttag></smarttags></clashobject>
      <clashobject><pathlink><node>File</node><node>ASIM-1835.rvm</node><node>/ASIM-1835-CU-PI</node><node>/ASIM-1835-CU-PI-P</node><node>/${lineNode}</node><node>/${branchNode}</node><node>/${againstMember}</node></pathlink><smarttags><smarttag><name>Item Name</name><value>/${againstMember}</value></smarttag></smarttags></clashobject>
    </clashobjects>
  </clashresult>`;
}

const clashXml = `<exchange><batchtest><clashtests><clashtest><clashresults>
${clash('Clash1', 'PS-11147-BAR-3', 'PS-11148.5', 'ASIM-1835-2&quot;-D8810353-11441T3-PP-01/B2')}
${clash('Clash2', 'PS-11147-BAR-1', 'PS-11147.11', 'ASIM-1835-4&quot;-W8810123-31441C4-01/B2')}
${clash('Clash3', 'PS-11147-BAR-1', 'PS-11147.6', 'ASIM-1835-4&quot;-P8810203-31441C4-PP-01/B1')}
${clash('Clash4', 'PANEL 2 of FRMWORK /PS-11147/MAIN', 'PS-11147.12', 'ASIM-1835-1/2&quot;-P8810294-36620T3-01/B2')}
${clash('Clash5', 'PANEL 2 of FRMWORK /PS-11147/MAIN', 'PS-11147.13', 'ASIM-1835-1/2&quot;-P8810296-36620T3-01/B2')}
${clash('Clash6', 'PANEL 1 of FRMWORK /PS-11147/MAIN', 'PS-11147.10', 'ASIM-1835-2&quot;-A8010756-13421-01/B4', '-0.009')}
${clash('Clash7', 'PS-11147-BAR-1', 'PS-11147/DATUM', 'ASIM-1835-8&quot;-P8810201-31441C4-PP-01/B2', '-0.008')}
${clash('Clash8', 'GENSEC 7 of FRMWORK /PS-11147/MAIN', 'PS-11147.8', 'ASIM-1835-1&quot;-D8810311-31441C4-PP-01/B1', '-0.005')}
${clash('Clash9', 'PS-11147-BAR-1', 'PS-11147.10', 'ASIM-1835-2&quot;-A8010756-13421-01/B4', '-0.004')}
${clash('Clash10', 'GENSEC 6 of FRMWORK /PS-11147/MAIN', 'PS-11147.13', 'ASIM-1835-1/2&quot;-P8810296-36620T3-01/B2', '-0.004')}
${clash('Clash11', 'GENSEC 6 of FRMWORK /PS-11147/MAIN', 'PS-11147.12', 'ASIM-1835-1/2&quot;-P8810294-36620T3-01/B2', '-0.001')}
</clashresults></clashtest></clashtests></batchtest></exchange>`;

const expectedCsv = `"Item\r\nName","PDMS\r\nDESC"
/PS-11147/DATUM,
/PS-11147.6,
/PS-11147.13,
/PS-11147.12,
/Copy-(2)-of-PS-11147.9,
/Copy-(2)-of-PS-11147.3,
/PS-11147.7,
/PS-11147.4,
/PS-11147.16,
/PS-11147.1,
/PS-11147.14,
/PS-11147.2,
/PS-11147.15,
/PS-11147.8,
/PS-11147.5,
/PS-11147.10,
/PS-11147.11,
`;

const detailCsv = `Name of the element\tp1bore\tpipe\tRTEXT of detailing text\tSUPPORT GAP\tReference of the element\tPosition\tISOMETRIC NOTES
PS-12005.1\t50.00\tASIM-1885-2"-D8810242-11441T3-PP\tGUIDE PDO-TYPE-604A/B - 2 x L50x50x6x55HIGH\t\t=1006649732/52813\tE 605287.827mm S 1107598.599mm U 1705.558mm\t
PS-12005/DATUM\t50.00\tASIM-1885-2"-D8810242-11441T3-PP\tPipe Rest XRT01\t\t=1006649732/52811\tE 605287.827mm S 1107598.599mm U 1705.558mm\t
PS-12005/SREF\t50.00\tASIM-1885-2"-D8810242-11441T3-PP\tPIPE SUPPORT TYPE-102\t\t=1006649732/52812\tE 605287.827mm S 1107598.599mm U 1705.558mm\t
PS-11147.8\t25.00\tASIM-1835-1"-D8810311-31441C4-PP-01\tGENSEC support\t\t=1/2\tE 231623.000mm S -1112823.000mm U 100890.000mm\t
`;

assert.equal(makeExactMemberKey('/Copy-(2)-of-PS-11147.9'), 'COPY-(2)-OF-PS-11147.9');
assert.equal(extractFamilyRoot('/SL-22001.1'), 'SL-22001');
assert.equal(extractFamilyRoot('/AA-22001.1'), '');
assert.equal(extractFamilyRoot('/AA-22001.1', { familyPrefixesText: 'PS,SL,AA' }), 'AA-22001');
assert.deepEqual(parsePipeTag('/ASIM-1835-1/2"-P8810294-36620T3-01/B2'), { raw: 'ASIM-1835-1/2"-P8810294-36620T3-01/B2', fullBranchNode: 'ASIM-1835-1/2"-P8810294-36620T3-01/B2', fullLineTag: 'ASIM-1835-1/2"-P8810294-36620T3-01', branch: 'B2', project: 'ASIM-1835', size: '1/2"', lineFamily: 'P8810294', classOrSpec: '36620T3', suffix: '01' });

const clashParsed = parsePsFamilyClashXml(clashXml);
assert.equal(clashParsed.rows.length, 11);
assert.equal(clashParsed.rows.find((row) => row.clashName === 'Clash8').against.pipe.lineFamily, 'D8810311');
assert.equal(clashParsed.rows.find((row) => row.clashName === 'Clash8').against.pipe.fullBranchNode, 'ASIM-1835-1"-D8810311-31441C4-PP-01/B1');

const slXml = `<exchange><batchtest><clashtests><clashtest><clashresults>${clash('SL1', 'SL-22001-BAR-1', 'SL-22001.1', 'ASIM-1835-1"-D8810311-31441C4-PP-01/B1')}</clashresults></clashtest></clashtests></batchtest></exchange>`;
assert.equal(parsePsFamilyClashXml(slXml).rows[0].against.familyRoot, 'SL-22001');
assert.equal(parsePsFamilyRegisterCsv('Item Name\n/SL-22001.1\n').rows[0].familyRoot, 'SL-22001');
assert.equal(parsePsFamilyElementDetailCsv('Name of the element,Position\nSL-22001.1,E 0mm S 0mm U 0mm\n').rows[0].sourceFamily, 'SL-22001');

const expectedParsed = parsePsFamilyRegisterCsv(expectedCsv);
assert.equal(expectedParsed.rows.length, 17);
assert.equal(expectedParsed.rows[4].displayName, 'Copy-(2)-of-PS-11147.9');

const detailParsed = parsePsFamilyElementDetailCsv(detailCsv);
assert.equal(detailParsed.rows.length, 4);
assert.equal(detailParsed.rows[0].lineFamily, 'D8810242');
assert.equal(detailParsed.rows[0].position.e, 605287.827);

const pos = buildPsFamilyPosFamilies(detailParsed.rows, { toleranceMm: 25 });
const ps12005 = pos.posFamilies.find((family) => family.sourceFamilies.includes('PS-12005'));
assert.equal(ps12005.elementCount, 3);
assert.deepEqual(ps12005.lineFamilies, ['D8810242']);

const boundaryRows = parsePsFamilyElementDetailCsv(`Name of the element,Position
PS-1.1,E 0mm S 0mm U 0mm
PS-1.2,E 25.000mm S 0mm U 0mm
PS-1.3,E 25.001mm S 0mm U 0mm
`).rows;
const boundary = buildPsFamilyPosFamilies(boundaryRows, { toleranceMm: 25 });
assert.equal(boundary.posFamilies.length, 2);

const audit = buildPsFamilyClashAudit({ clashRows: clashParsed.rows, expectedRows: expectedParsed.rows, elementDetailRows: pos.rows, posFamilies: pos.posFamilies, diagnostics: [] });
assert.equal(audit.summary.expectedCount, 17);
assert.equal(audit.summary.clashCount, 11);
assert.equal(audit.summary.foundExactCount, 7);
assert.equal(audit.summary.missingCount, 10);
assert.equal(audit.summary.outOfFamilyCount, 1);
assert.equal(audit.summary.duplicateMemberCount, 3);
assert.equal(audit.outOfFamilyRows[0].against.memberName, 'PS-11148.5');
assert.deepEqual(audit.duplicateRows.map((row) => row.member).sort(), ['PS-11147.10', 'PS-11147.12', 'PS-11147.13']);
assert.equal(audit.coverageRows.find((row) => row.expectedMember === 'Copy-(2)-of-PS-11147.9').status, 'MISSING');
assert.equal(audit.coverageRows.find((row) => row.expectedMember === 'PS-11147.8').lineFamily, 'D8810311');
assert.equal(audit.sourceVsPosFamilyRows.find((row) => row.source === 'PS-12005').posFamilyCount, 1);

const exports = createPsFamilyAuditExports(audit);
assert.match(exports.coverageCsv, /Copy-\(2\)-of-PS-11147\.9/);
assert.match(exports.clashRowsCsv, /D8810311/);
assert.match(exports.missingCsv, /Copy-\(2\)-of-PS-11147\.9/);
assert.match(exports.outOfFamilyCsv, /PS-11148\.5/);
assert.match(exports.duplicatesCsv, /PS-11147\.10/);
assert.match(exports.lineFamiliesCsv, /D8810311/);
assert.match(exports.posFamiliesCsv, /POSF-000001/);
assert.match(exports.sourceVsPosFamilyCsv, /PS-12005,1,3/);
assert.match(exports.diagnosticsCsv, /Level,Code,Message/);
assert.match(exports.auditJson, /"schema": "ps-family-clash-audit\/v1"/);

console.log('ps-family-clash-audit tests passed');

import assert from 'node:assert/strict';
import { buildXmlNodeWiseTraceRows } from '../converters/xml-cii2019-core/xml-node-wise-trace.js';

const branch = '/ASIM-1885-PL-4"-CS-M8810041-01/B3';
const guidePath = '$.children[146].children[0]';
const restPath = '$.children[146].children[1]';
const traceRows = [
  {
    jsonNodeNo: '146',
    branchName: '/ASIM-1885-PL-4"-CS-M8810041-01',
    sourcePath: `${guidePath}.attributes.DTXR_POS`,
    field: 'DTXR_POS',
    finalValue: 'GUIDE PDO-TYPE-604A/B',
  },
  {
    jsonNodeNo: '146',
    branchName: '/ASIM-1885-PL-4"-CS-M8810041-01',
    sourcePath: `${restPath}.attributes.DTXR_POS`,
    field: 'DTXR_POS',
    finalValue: 'REST',
  },
];
const xmlText = `<Root><Branch><Branchname>${branch}</Branchname><Node><NodeNumber>1030</NodeNumber><NodeName>PS02214.1</NodeName><ComponentType>ANCI</ComponentType><ComponentRefNo>=1006666139/642</ComponentRefNo><Position>563136.11 -1125469.20 99707.60</Position></Node></Branch></Root>`;
const diagnostics = [{
  type: 'dtxr-resolution-ledger',
  nodeNumber: '1030',
  nodeName: 'PS02214.1',
  componentType: 'ANCI',
  branchName: branch,
  stagedBranch: '/ASIM-1885-PL-4"-CS-M8810041-01',
  branchRelationship: 'SAME_ROOT_PARENT_CHILD',
  position: 'E=563136.11 N=-1125469.2 EL=99707.6',
  distanceMm: 0,
  toleranceMm: 6,
  dtxrPosValue: 'GUIDE PDO-TYPE-604A/B(NAME==1006649755/5218) | REST(NAME=/PS02214.1)',
  dtxrPsName: 'PS02214.1',
  dtxrPsValue: 'REST',
  sourcePath: restPath,
  positionPaths: [guidePath, restPath],
  effectiveAuthority: 'DTXR_POS_PRIMARY',
  status: 'RESOLVED',
}];

const rows = buildXmlNodeWiseTraceRows({ xmlText, diagnostics, traceRows });
assert.equal(rows.length, 1);
const row = rows[0];
assert.equal(row.jsonNodeNoDtxrPs, '146');
assert.equal(row.jsonNodeNoDtxrPos, '146');
assert.equal(row.matchType, 'POS/PS');
assert.equal(row.dtxrPsValue, 'REST');
assert.match(row.dtxrPosValue, /GUIDE PDO-TYPE-604A\/B/);
assert.match(row.dtxrPosValue, /REST\(NAME=\/PS02214\.1\)/);
assert.equal(row.branchRelationship, 'SAME_ROOT_PARENT_CHILD');
assert.equal(row.evidenceAuthority, 'DTXR_POS_PRIMARY');
assert.equal(row.status, 'RESOLVED');

console.log('xml-cii DTXR ledger trace consumer tests passed');

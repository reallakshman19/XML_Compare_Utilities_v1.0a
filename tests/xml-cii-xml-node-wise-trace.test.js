import assert from 'node:assert/strict';
import {
  XML_CII_XML_NODE_TRACE_SCHEMA,
  buildEvidenceTreeCsvRows,
  buildXmlNodeWiseTraceRows,
  evidenceTreeToCsv,
  matchedFactsToClipboardText,
  xmlNodeWiseTraceToCsv,
} from '../converters/xml-cii2019-core/xml-node-wise-trace.js';

const branch = '/ASIM-1885-PL-4"-CS-M8810041-01/B3';
const pos = (jsonNodeNo, e, value, name = '', path = `$.components[${jsonNodeNo}]`) => {
  const position = `E=${e} N=-1125469.2 EL=99707.6`;
  return {
    jsonNodeNo: String(jsonNodeNo),
    branchName: branch,
    sourcePath: `${path}.attributes.DTXR_POS`,
    sourceObjectType: 'SUPPORT',
    field: 'DTXR_POS',
    sourceAttributeName: 'DTXR_POS',
    finalValue: value,
    name,
    position,
    xmlTraceScope: 'DTXR_POS_SOURCE_ROW',
    xmlTraceGroupLabel: position,
    xmlTraceGroupKey: position.replace(/\s+/g, ''),
    xmlTraceGroupResolved: true,
  };
};

const supportTrace = [
  pos(145, 555136.11, 'REST', '/PS02213.1'),
  pos(146, 563136.11, 'GUIDE PDO-TYPE-604A/B - 2 x L50mmx100mmx6mmx160mmHIGH', '=1006649755/5218'),
  pos(146, 563136.11, 'REST', '/PS02214.1'),
  pos(147, 571136.11, 'REST', '/PS02215.1'),
  pos(148, 579136.11, 'PIPE STOP TYPE-602', '=1006649755/5233'),
  pos(148, 579136.11, 'WEAR PLATE TYPE-421 PAD L 600mm', '=1006649755/5417'),
  pos(148, 579136.11, 'GUIDE PDO-TYPE-604A/B - 2 x L50mmx100mmx6mmx160mmHIGH', '=1006649755/5219'),
  pos(148, 579136.11, 'REST', '/PS02216.1'),
  pos(149, 585136.11, 'REST', '/PS02217.1'),
  pos(150, 590136.11, 'REST', '/PS02218.1'),
  pos(151, 594136.11, 'REST', '/PS02219.1'),
];
const supportXml = `<Root><Branch><Branchname>${branch}</Branchname>
<Node><NodeNumber>1020</NodeNumber><NodeName>PS02213.1</NodeName><Endpoint>0</Endpoint><ComponentType>ANCI</ComponentType><ComponentRefNo>=1006666139/639</ComponentRefNo><Position>555136.11 -1125469.20 99707.60</Position></Node>
<Node><NodeNumber>1030</NodeNumber><NodeName>PS02214.1</NodeName><Endpoint>0</Endpoint><ComponentType>ANCI</ComponentType><ComponentRefNo>=1006666139/642</ComponentRefNo><Position>563136.11 -1125469.20 99707.60</Position></Node>
</Branch></Root>`;

const supportRows = buildXmlNodeWiseTraceRows({ xmlText: supportXml, traceRows: supportTrace });
assert.equal(supportRows.length, 2);
assert.equal(supportRows[0].schema, XML_CII_XML_NODE_TRACE_SCHEMA);
assert.equal(supportRows[0].xmlNode, '1020');
assert.equal(supportRows[0].jsonNodeNoDtxrPs, '145');
assert.equal(supportRows[0].jsonNodeNoDtxrPos, '145');
assert.equal(supportRows[0].matchType, 'POS/PS');
assert.equal(supportRows[0].posBasis, 'E=555136.11 N=-1125469.2 EL=99707.6');
assert.equal(supportRows[0].dtxrPosValue, 'REST(NAME=/PS02213.1)');
assert.equal(supportRows[0].dtxrPsName, 'PS02213.1');
assert.equal(supportRows[0].dtxrPsValue, 'REST');
assert.equal(supportRows[0].status, 'RESOLVED');
assert.equal(supportRows[0].evidenceAuthority, 'DTXR_POS_PRIMARY');

assert.equal(supportRows[1].xmlNode, '1030');
assert.equal(supportRows[1].jsonNodeNoDtxrPs, '146');
assert.equal(supportRows[1].jsonNodeNoDtxrPos, '146');
assert.equal(supportRows[1].matchType, 'POS/PS');
assert.match(supportRows[1].dtxrPosValue, /GUIDE PDO-TYPE-604A\/B/);
assert.match(supportRows[1].dtxrPosValue, /REST\(NAME=\/PS02214\.1\)/);
assert.equal(supportRows[1].dtxrPsName, 'PS02214.1');
assert.equal(supportRows[1].dtxrPsValue, 'REST');
assert.equal(supportRows[1].status, 'RESOLVED');

const elbowPath = '$.components[180]';
const elbowPosition = 'E=616110.81 N=-1124291 EL=100432.15';
const elbowTrace = [
  {
    jsonNodeNo: '180',
    branchName: branch,
    sourcePath: `${elbowPath}.attributes.DTXR_POS`,
    sourceObjectType: 'ELBO',
    field: 'DTXR_POS',
    sourceAttributeName: 'DTXR_POS',
    finalValue: 'ELBOW 90 DEG LR BW Sch 120',
    position: elbowPosition,
    xmlTraceScope: 'DTXR_POS_SOURCE_ROW',
    xmlTraceGroupLabel: elbowPosition,
    xmlTraceGroupKey: elbowPosition.replace(/\s+/g, ''),
    xmlTraceGroupResolved: true,
  },
  {
    jsonNodeNo: '181',
    branchName: branch,
    sourcePath: `${elbowPath}.attributes.NAME`,
    sourceObjectType: 'ELBO',
    field: 'ComponentRefNo',
    sourceAttributeName: 'NAME',
    finalValue: '=1006649755/1762',
    xmlTraceScope: 'DTXR_PS_SOURCE_ROW',
  },
];
const elbowXml = `<Root><Branch><Branchname>${branch}</Branchname>
<Node><NodeNumber>-1</NodeNumber><NodeName/><Endpoint>1</Endpoint><ComponentType>ELBO</ComponentType><ComponentRefNo>=1006649755/1762</ComponentRefNo><Position>616110.81 -1124291.00 100280.15</Position></Node>
<Node><NodeNumber>1270</NodeNumber><NodeName/><Endpoint>0</Endpoint><ComponentType>ELBO</ComponentType><ComponentRefNo>=1006649755/1762</ComponentRefNo><Position>616110.81 -1124291.00 100432.15</Position></Node>
</Branch></Root>`;
const elbowRows = buildXmlNodeWiseTraceRows({ xmlText: elbowXml, traceRows: elbowTrace });
assert.equal(elbowRows.length, 2);
assert.equal(elbowRows[0].xmlNode, '-1');
assert.equal(elbowRows[0].jsonNodeNoDtxrPs, '180');
assert.equal(elbowRows[0].jsonNodeNoDtxrPos, '180');
assert.equal(elbowRows[0].matchType, 'none');
assert.equal(elbowRows[0].dtxrPosValue, '(none)');
assert.equal(elbowRows[0].dtxrPsName, '1006649755/1762');
assert.equal(elbowRows[0].dtxrPsValue, '(none)');
assert.equal(elbowRows[0].status, 'UNRESOLVED');
assert.equal(elbowRows[0].evidenceAuthority, 'NONE');

assert.equal(elbowRows[1].xmlNode, '1270');
assert.equal(elbowRows[1].jsonNodeNoDtxrPs, '181');
assert.equal(elbowRows[1].jsonNodeNoDtxrPos, '180');
assert.equal(elbowRows[1].matchType, 'POS/PS');
assert.equal(elbowRows[1].dtxrPosValue, 'ELBOW 90 DEG LR BW Sch 120');
assert.equal(elbowRows[1].dtxrPsName, '1006649755/1762');
assert.equal(elbowRows[1].dtxrPsValue, 'ELBOW 90 DEG LR BW Sch 120');
assert.equal(elbowRows[1].status, 'RESOLVED');

const traceCsv = xmlNodeWiseTraceToCsv([...supportRows, ...elbowRows]);
assert.match(traceCsv, /JsonNodeNo\(DTXR_PS\)/);
assert.match(traceCsv, /JsonNodeNo\(DTXR_POS\)/);
assert.match(traceCsv, /DTXR_POS Value/);
assert.match(traceCsv, /Branch Relationship/);
const treeRows = buildEvidenceTreeCsvRows(supportTrace, { useDelimiter: true });
assert.ok(treeRows.length >= supportTrace.length);
const treeCsv = evidenceTreeToCsv(supportTrace, { useDelimiter: true });
assert.match(treeCsv, /Evidence Type/);
assert.match(treeCsv, /DTXR-POS/);
const copied = matchedFactsToClipboardText([...supportRows, ...elbowRows]);
assert.match(copied, /1020/);
assert.match(copied, /1270/);
assert.doesNotMatch(copied, /\t-1\t/);

console.log('xml-cii XML node wise dual DTXR trace tests passed');

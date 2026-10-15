import { _test, buildXmlNodeWiseTraceRows } from '../converters/xml-cii2019-core/xml-node-wise-trace.js';

const branch = '/ASIM-1885-PL-4"-CS-M8810041-01/B3';
const pos = (jsonNodeNo, e, value, name = '', path = `$.components[${jsonNodeNo}]`) => ({
  jsonNodeNo: String(jsonNodeNo),
  branchName: branch,
  sourcePath: `${path}.attributes.DTXR_POS`,
  sourceObjectType: 'SUPPORT',
  field: 'DTXR_POS',
  sourceAttributeName: 'DTXR_POS',
  finalValue: value,
  name,
  position: `E=${e} N=-1125469.2 EL=99707.6`,
  xmlTraceScope: 'DTXR_POS_SOURCE_ROW',
});
const traceRows = [
  pos(145, 555136.11, 'REST', '/PS02213.1'),
  pos(146, 563136.11, 'GUIDE PDO-TYPE-604A/B - 2 x L50mmx100mmx6mmx160mmHIGH', '=1006649755/5218'),
  pos(146, 563136.11, 'REST', '/PS02214.1'),
];
const xmlText = `<Root><Branch><Branchname>${branch}</Branchname><Node><NodeNumber>1020</NodeNumber><NodeName>PS02213.1</NodeName><ComponentType>ANCI</ComponentType><ComponentRefNo>=1006666139/639</ComponentRefNo><Position>555136.11 -1125469.20 99707.60</Position></Node></Branch></Root>`;
console.log('groups=', JSON.stringify(_test.branchPositionGroups(traceRows, branch), null, 2));
console.log('rows=', JSON.stringify(buildXmlNodeWiseTraceRows({ xmlText, traceRows }), null, 2));

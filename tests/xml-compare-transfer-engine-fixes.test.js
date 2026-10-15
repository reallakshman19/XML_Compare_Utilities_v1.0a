import assert from 'node:assert/strict';

import { parseCategorizedTransferDocument, serializeCategorizedTransferDocument } from '../xml-compare/XmlCompareCategorizedXmlTree.js';
import { applyGraphDomTransferPlan } from '../xml-compare/XmlCompareTransferPatchEngine.js';

// Source: two lines; nodes nested under NodesBlock; OriginalElement CDATA contains </PIPINGELEMENT>.
const source = `<CategorizedInputXML>
 <Line id="L1"><Element fromNode="10" toNode="20" elementKey="10-&gt;20"><NodesBlock><Node nodeNumber="10" role="FROM"><RestraintsBlock><RESTRAINT NUM="1" NODE="10" TYPE="ANC"/></RestraintsBlock></Node></NodesBlock><OriginalElement><![CDATA[<PIPINGELEMENT FROM_NODE="10" TO_NODE="20"><RIGID/></PIPINGELEMENT>]]></OriginalElement></Element></Line>
 <Line id="L2"><Element fromNode="30" toNode="40" elementKey="30-&gt;40"><NodesBlock><Node nodeNumber="30" role="FROM"><RestraintsBlock/></Node></NodesBlock></Element></Line>
</CategorizedInputXML>`;

// Bug A: CDATA must not corrupt the element stack -> both lines parse.
const doc = parseCategorizedTransferDocument(source);
assert.equal(doc.lines.length, 2, 'both <Line> elements parse despite embedded CDATA markup');
assert.ok(serializeCategorizedTransferDocument(doc).includes('<![CDATA['), 'CDATA is preserved on round-trip');

// Bug B: nodes nested under <NodesBlock> must resolve; restraint transfers into the target.
const target = `<CategorizedInputXML><Line id="T1"><Element fromNode="100" toNode="110" elementKey="100-&gt;110"><NodesBlock><Node nodeNumber="110" role="TO"><RestraintsBlock/></Node></NodesBlock></Element></Line></CategorizedInputXML>`;
const plan = {
  transferScope: 'node',
  selectedBlocks: ['RestraintsBlock'],
  pairs: [{ id: 'p1', sourceLine: 'L1', sourceElement: '10->20', sourceNode: '10', sourceRole: 'FROM', targetLine: 'T1', targetElement: '100->110', targetNode: '110', targetRole: 'TO', approvedCaseIds: ['p1'] }],
};
const result = applyGraphDomTransferPlan(target, source, plan, { policy: 'replace' });
assert.ok(result.audit.some((row) => row.status === 'updated'), `expected an updated row, got ${JSON.stringify(result.audit.map((r) => r.status + ':' + (r.reason || '')))}`);
assert.ok(/<RESTRAINT\b/.test(result.xml), 'RestraintsBlock content is written into the target');
// only RestraintsBlock changed (NodeRef rewrite retargets NODE 10 -> 110)
assert.ok(/NODE="110"/.test(result.xml), 'node reference rewritten to target node');

console.log('XML Compare transfer engine fixes tests passed');

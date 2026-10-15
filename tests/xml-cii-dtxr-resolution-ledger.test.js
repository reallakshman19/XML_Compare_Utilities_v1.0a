import assert from 'node:assert/strict';
import {
  canonicalizeXmlCiiBranch,
  compareXmlCiiBranches,
} from '../converters/xml-cii2019-core/canonical-branch-identity.js';
import {
  XML_CII_DTXR_LEDGER_SCHEMA,
  applyXmlCiiDtxrResolutionLedger,
  buildXmlCiiDtxrResolutionLedger,
  xmlCiiDtxrLedgerDiagnostics,
} from '../converters/xml-cii2019-core/dtxr-resolution-ledger.js';

function element(name, value = '') {
  return {
    nodeType: 1,
    localName: name,
    nodeName: name,
    textContent: value,
    namespaceURI: '',
    childNodes: [],
    parentNode: null,
    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    },
  };
}
function child(parent, name, value = '') {
  return parent.appendChild(element(name, value));
}
function mockDocument(root) {
  const walk = (node, name, out = []) => {
    if (node?.localName === name) out.push(node);
    for (const item of node?.childNodes || []) walk(item, name, out);
    return out;
  };
  return {
    root,
    createElement: (name) => element(name),
    createElementNS: (_ns, name) => element(name),
    getElementsByTagName: (name) => walk(root, name),
  };
}
function xmlNode(branch, number, name, position, componentType = 'ANCI', componentRefNo = '') {
  const node = child(branch, 'Node');
  child(node, 'NodeNumber', number);
  child(node, 'NodeName', name);
  child(node, 'ComponentType', componentType);
  child(node, 'ComponentRefNo', componentRefNo);
  child(node, 'Position', position);
  child(node, 'SIF', '0');
  return node;
}
function textOf(node, name) {
  return node.childNodes.find((childNode) => childNode.localName === name)?.textContent || '';
}

const rootIdentity = canonicalizeXmlCiiBranch('=/ASIM-1885-PL-4&quot;-CS-M8810041-01/B003/');
assert.equal(rootIdentity.normalizedFullName, '/ASIM-1885-PL-4"-CS-M8810041-01/B3');
assert.equal(rootIdentity.normalizedRootName, '/ASIM-1885-PL-4"-CS-M8810041-01');
assert.equal(rootIdentity.branchSuffix, 'B3');
assert.equal(rootIdentity.branchNumber, 3);
assert.equal(
  compareXmlCiiBranches('/ASIM-1885-PL-4"-CS-M8810041-01/B3', '/ASIM-1885-PL-4"-CS-M8810041-01').relationship,
  'SAME_ROOT_PARENT_CHILD',
);
assert.equal(
  compareXmlCiiBranches('/ASIM-1885-PL-4"-CS-M8810041-01/B3', '/ASIM-1885-PL-4"-CS-M8810041-01/B2').relationship,
  'SIBLING_BRANCH_REJECT',
);

const root = element('Root');
const branch = child(root, 'Branch');
child(branch, 'Branchname', '/ASIM-1885-PL-4"-CS-M8810041-01/B3');
const node1020 = xmlNode(branch, '1020', 'PS02213.1', '555136.11 -1125469.20 99707.60', 'ANCI', '=1006666139/639');
const node1030 = xmlNode(branch, '1030', 'PS02214.1', '563136.11 -1125469.20 99707.60', 'ANCI', '=1006666139/642');
const document = mockDocument(root);
const baseBranch = '/ASIM-1885-PL-4"-CS-M8810041-01';
const positionIndex = {
  entries: [
    {
      branchName: baseBranch,
      point: { x: 555136.11, y: -1125469.2, z: 99707.6 },
      dtxr: 'REST',
      dtxrPos: 'REST',
      attrs: { NAME: '/PS02213.1' },
      supportTags: ['PS02213.1'],
      _path: '$.children[145]',
    },
    {
      branchName: baseBranch,
      point: { x: 563136.11, y: -1125469.2, z: 99707.6 },
      dtxr: 'GUIDE PDO-TYPE-604A/B - 2 x L50mmx100mmx6mmx160mmHIGH',
      dtxrPos: 'GUIDE PDO-TYPE-604A/B - 2 x L50mmx100mmx6mmx160mmHIGH',
      attrs: { NAME: '=1006649755/5218' },
      _path: '$.children[146].children[0]',
    },
    {
      branchName: baseBranch,
      point: { x: 563136.11, y: -1125469.2, z: 99707.6 },
      dtxr: 'REST',
      dtxrPos: 'REST',
      attrs: { NAME: '/PS02214.1' },
      supportTags: ['PS02214.1'],
      _path: '$.children[146].children[1]',
    },
    {
      branchName: `${baseBranch}/B2`,
      point: { x: 563136.11, y: -1125469.2, z: 99707.6 },
      dtxr: 'WRONG SIBLING BRANCH',
      dtxrPos: 'WRONG SIBLING BRANCH',
      attrs: { NAME: '/PS02214.1' },
      supportTags: ['PS02214.1'],
      _path: '$.sibling[0]',
    },
  ],
};
const refIndex = {
  byComponentRefNo: new Map(),
  byPsTag: new Map(),
  byPsBaseTag: new Map(),
};
const supportBase = {
  branchName: baseBranch,
  point: { x: 563136.11, y: -1125469.2, z: 99707.6 },
  attrs: { NAME: '/PS02214.1' },
  supportTags: ['PS02214.1'],
  kinds: ['REST'],
};
const supportSibling = {
  ...supportBase,
  branchName: `${baseBranch}/B2`,
  kinds: ['GUIDE'],
};
const supportIndex = { items: [supportBase, supportSibling] };

const ledger = buildXmlCiiDtxrResolutionLedger({
  document,
  stagedDtxrPositionIndex: positionIndex,
  stagedDtxrRefIndex: refIndex,
  stagedSupportIndex: supportIndex,
  config: { coordinateTolerance: 6 },
});
assert.equal(ledger.schema, XML_CII_DTXR_LEDGER_SCHEMA);
assert.equal(ledger.summary.total, 2);
assert.equal(ledger.summary.positionPrimary, 2);

const first = ledger.entryForNode(node1020);
assert.equal(first.branchRelationship, 'SAME_ROOT_PARENT_CHILD');
assert.equal(first.dtxrPosValue, 'REST(NAME=/PS02213.1)');
assert.equal(first.dtxrPsValue, 'REST');
assert.equal(first.effectiveAuthority, 'DTXR_POS_PRIMARY');

const second = ledger.entryForNode(node1030);
assert.equal(second.branchRelationship, 'SAME_ROOT_PARENT_CHILD');
assert.match(second.dtxrPosValue, /GUIDE PDO-TYPE-604A\/B/);
assert.match(second.dtxrPosValue, /REST\(NAME=\/PS02214\.1\)/);
assert.doesNotMatch(second.dtxrPosValue, /WRONG SIBLING BRANCH/);
assert.equal(second.dtxrPsName, 'PS02214.1');
assert.equal(second.dtxrPsValue, 'REST');
assert.equal(second.supportMatches.length, 1);
assert.equal(second.supportMatches[0].branchName, baseBranch);

const applied = applyXmlCiiDtxrResolutionLedger(document, ledger);
assert.equal(applied.dtxrPosAnnotations, 2);
assert.equal(applied.dtxrPsAnnotations, 2);
assert.equal(textOf(node1020, 'DTXR_POS'), 'REST(NAME=/PS02213.1)');
assert.equal(textOf(node1020, 'DTXR_PS'), 'REST');
assert.equal(textOf(node1020, 'DTXR_SOURCE'), 'staged-position-group');
assert.equal(textOf(node1030, 'DTXR_BRANCH_RELATIONSHIP'), 'SAME_ROOT_PARENT_CHILD');

const diagnostics = xmlCiiDtxrLedgerDiagnostics(ledger);
assert.equal(diagnostics.length, 2);
assert.equal(diagnostics[1].effectiveAuthority, 'DTXR_POS_PRIMARY');
assert.equal(diagnostics[1].status, 'RESOLVED');

console.log('xml-cii DTXR resolution ledger tests passed');

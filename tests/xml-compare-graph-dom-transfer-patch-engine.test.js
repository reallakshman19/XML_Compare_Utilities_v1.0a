import assert from 'node:assert/strict';

import { applyCategorizedTransferPlan, parseCategorizedTransferDocument } from '../xml-compare/XmlCompareCategorizedTransferApplier.js';
import { childrenByName, elementKey, lineId, nodeKey, nodeRole } from '../xml-compare/XmlCompareCategorizedXmlTree.js';

const sourceXml = '<CategorizedInputXML><Line id="SL"><Element elementKey="SE"><Node nodeNumber="10" role="FROM"><NodeNameBlock NODE="10"><Name>S_CORRECT</Name></NodeNameBlock><KeepBlock><K>keep-source</K></KeepBlock></Node><ElementOnlyBlock><E>source-element</E></ElementOnlyBlock></Element></Line><Line id="SLX"><Element elementKey="SEX"><Node nodeNumber="10" role="FROM"><NodeNameBlock NODE="10"><Name>WRONG_LINE</Name></NodeNameBlock></Node></Element></Line><Line id="SLL"><LineBlocks><LineIdentityBlock><Name>S_LINE</Name></LineIdentityBlock></LineBlocks><Element elementKey="SEL"/></Line></CategorizedInputXML>';
const targetXml = '<CategorizedInputXML><Line id="TL"><Element elementKey="TE"><Node nodeNumber="20" role="TO"><NodeNameBlock NODE="20"><Name>OLD</Name></NodeNameBlock><OtherBlock><O>stay</O></OtherBlock></Node></Element><Element elementKey="TEX"><Node nodeNumber="20" role="TO"><NodeNameBlock NODE="20"><Name>OTHER_ELEMENT</Name></NodeNameBlock></Node></Element></Line><Line id="TLX"><Element elementKey="TE"><Node nodeNumber="20" role="TO"><NodeNameBlock NODE="20"><Name>OTHER_LINE</Name></NodeNameBlock></Node></Element></Line><Line id="TLL"><LineBlocks><LineIdentityBlock><Name>T_LINE</Name></LineIdentityBlock></LineBlocks><Element elementKey="TEL"/></Line><Line id="TELINE"><Element elementKey="TE2"><ElementOnlyBlock><E>old-element</E></ElementOnlyBlock></Element></Line></CategorizedInputXML>';

const plan = (scope, pair, blocks = ['NodeNameBlock'], extra = {}) => ({ scope, transferScope: scope, selectedBlocks: blocks, pairs: [{ id: 'p1', ...pair, ...(extra.pair || {}) }], approvedPairIds: extra.approvedPairIds || [] });
const nodePair = { sourceLine: 'SL', sourceElement: 'SE', sourceNode: '10', sourceRole: 'FROM', targetLine: 'TL', targetElement: 'TE', targetNode: '20', targetRole: 'TO' };

function text(node) { return (node?.children || []).map((child) => child.type === 'text' ? child.text : text(child)).join(''); }
function line(doc, id) { return doc.lines.find((item) => lineId(item) === id); }
function element(lineNode, key) { return childrenByName(lineNode, 'Element').find((item) => elementKey(item) === key); }
function node(elementNode, number, role = '') { return childrenByName(elementNode, 'Node').find((item) => nodeKey(item) === number && (!role || nodeRole(item) === role)); }
function block(container, name) { return childrenByName(container, name)[0] || null; }
function countBlocks(container, name) { return childrenByName(container, name).length; }
function doc(xml) { return parseCategorizedTransferDocument(xml); }

const replaced = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', nodePair), { policy: 'replace' });
let d = doc(replaced.xml);
assert.equal(text(block(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'NodeNameBlock')).includes('S_CORRECT'), true, 'node-scope resolves by target line + element + node + role');
assert.equal(text(block(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'NodeNameBlock')).includes('NODE="20"'), false, 'text helper excludes attrs');
assert.equal(replaced.xml.includes('NODE="20"'), true, 'node references are rewritten to target node');
assert.equal(text(block(node(element(line(d, 'TL'), 'TEX'), '20', 'TO'), 'NodeNameBlock')), 'OTHER_ELEMENT', 'same node in another element is not modified');
assert.equal(text(block(node(element(line(d, 'TLX'), 'TE'), '20', 'TO'), 'NodeNameBlock')), 'OTHER_LINE', 'same node in another line is not modified');
assert.equal(text(block(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'OtherBlock')), 'stay', 'replace removes matching block only');
assert.equal(replaced.audit[0].changedBlocks[0].status, 'replaced', 'audit includes changedBlocks before/after summary');
assert.equal(replaced.audit[0].changedBlocks[0].before.xml.includes('OLD'), true);
assert.equal(replaced.audit[0].changedBlocks[0].after.xml.includes('S_CORRECT'), true);

const missing = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', { ...nodePair, targetNode: '999' }), { policy: 'replace' });
assert.equal(missing.audit[0].status, 'blocked', 'missing target node blocks by default');
assert.equal(missing.audit[0].reason, 'target-node-not-found');
assert.equal(missing.xml, targetXml, 'blocked transfer leaves target unchanged');

const fallback = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', { ...nodePair, targetNode: '999' }), { policy: 'replace', allowElementFallbackForMissingNode: true });
d = doc(fallback.xml);
assert.equal(fallback.audit[0].reason, 'target-node-not-found-used-element-fallback');
assert.equal(text(block(element(line(d, 'TL'), 'TE'), 'NodeNameBlock')), 'S_CORRECT', 'explicit fallback inserts at element level');

const sourceSpecific = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', { ...nodePair, sourceLine: 'SLX', sourceElement: 'SEX' }), { policy: 'replace' });
d = doc(sourceSpecific.xml);
assert.equal(text(block(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'NodeNameBlock')), 'WRONG_LINE', 'source extraction uses source line and element context');

const elementResult = applyCategorizedTransferPlan(targetXml, sourceXml, plan('element', { sourceLine: 'SL', sourceElement: 'SE', targetLine: 'TELINE', targetElement: 'TE2' }, ['ElementOnlyBlock']), { policy: 'replace' });
d = doc(elementResult.xml);
assert.equal(text(block(element(line(d, 'TELINE'), 'TE2'), 'ElementOnlyBlock')), 'source-element', 'element-scope replaces target element block');
assert.equal(text(block(element(line(d, 'TL'), 'TE'), 'ElementOnlyBlock')), '', 'element-scope does not modify other elements');

const lineResult = applyCategorizedTransferPlan(targetXml, sourceXml, plan('line', { sourceLine: 'SLL', targetLine: 'TLL' }, ['LineIdentityBlock']), { policy: 'replace' });
d = doc(lineResult.xml);
assert.equal(text(block(childrenByName(line(d, 'TLL'), 'LineBlocks')[0], 'LineIdentityBlock')), 'S_LINE', 'line-scope updates only target line blocks');
assert.equal(text(block(childrenByName(line(d, 'TL'), 'LineBlocks')[0], 'LineIdentityBlock')), '', 'other target line is not modified');

const appended = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', nodePair), { policy: 'append' });
d = doc(appended.xml);
assert.equal(countBlocks(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'NodeNameBlock'), 2, 'append preserves existing block and appends source block');
assert.equal(appended.audit[0].changedBlocks[0].status, 'added');

const skipped = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', nodePair), { policy: 'skip-existing' });
assert.equal(skipped.audit[0].status, 'skipped', 'skip-existing skips existing target block');
assert.equal(skipped.audit[0].reason, 'skip-existing-target-block');
assert.equal(skipped.xml, targetXml);

const filtered = applyCategorizedTransferPlan(targetXml, sourceXml, plan('node', nodePair, ['NodeNameBlock', 'KeepBlock'], { approvedPairIds: ['case:p1:KeepBlock'], pair: { approvedCaseIds: ['case:p1:NodeNameBlock', 'case:p1:KeepBlock'] } }), { policy: 'replace' });
d = doc(filtered.xml);
assert.equal(text(block(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'NodeNameBlock')), 'OLD', 'unapproved block is not transferred');
assert.equal(text(block(node(element(line(d, 'TL'), 'TE'), '20', 'TO'), 'KeepBlock')), 'keep-source', 'approved block filter still works');

assert.equal(sourceXml.includes('S_CORRECT'), true, 'source XML string remains unchanged');
assert.equal(doc(replaced.xml).rootName, 'CategorizedInputXML', 'target XML output remains valid categorized XML');
assert.equal(applyCategorizedTransferPlan(targetXml, sourceXml, { scope: 'bad', pairs: [] }).audit[0].reason, 'unsupported-transfer-scope');

console.log('XML Compare graph DOM transfer patch engine tests passed');

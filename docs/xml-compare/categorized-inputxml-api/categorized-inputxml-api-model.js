import {
  childrenByName,
  elementKey,
  lineId,
  nodeKey,
  nodeRole,
  parseCategorizedTransferDocument,
  serializeCategorizedTransferDocument,
} from '../XmlCompareCategorizedXmlTree.js';
import { CATEGORIZED_INPUTXML_READ_MODEL_SCHEMA } from './categorized-inputxml-api-contracts.js';

const clean = (value) => String(value ?? '').trim();
const LINE_CHILDREN = new Set(['LineBlock', 'LineBlocks', 'Element']);
const LINE_BLOCK_CHILDREN = new Set(['ProcessBlock', 'MaterialBlock']);
const ELEMENT_CHILDREN = new Set([
  'NameBlock', 'RouteGeometryBlock', 'SectionDimensionBlock', 'DerivedBlock',
  'BendBlock', 'RigidBlock', 'FlangeBlock', 'MiscBlock', 'NodesBlock',
  'Node', 'OriginalElement',
]);
const NODE_CHILDREN = new Set([
  'DerivedCoordinateBlock', 'TemperatureBlock', 'RestraintsBlock',
  'DisplacementsBlock', 'ForcesMomentsBlock', 'SifBlock',
]);
const COMPARED_FIELDS = Object.freeze({
  NameBlock: Object.freeze(['LINE_ID', 'FROM_NAME', 'TO_NAME', 'NAME']),
  RouteGeometryBlock: Object.freeze(['DELTA_X', 'DELTA_Y', 'DELTA_Z']),
  SectionDimensionBlock: Object.freeze(['DIAMETER', 'WALL_THICK', 'INSUL_THICK']),
});

export function elementChildren(node = {}, name = '') {
  return (node.children || []).filter((child) => child?.type === 'element' && (!name || child.name === name));
}

export function nodeText(node = {}) {
  return (node.children || [])
    .filter((child) => child?.type === 'text')
    .map((child) => child.text || '')
    .join('')
    .trim();
}

export function unwrapCdata(text = '') {
  const match = String(text ?? '').match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return match ? match[1].replaceAll(']]]]><![CDATA[>', ']]>') : clean(text);
}

export function attrsOfOpenTag(xml = '', tagName = '') {
  const escaped = String(tagName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = String(xml).match(new RegExp(`<${escaped}\\b[^>]*>`, 'i'))?.[0]
    || String(xml).match(new RegExp(`<${escaped}\\b[^>]*/>`, 'i'))?.[0]
    || '';
  const attrs = {};
  open.replace(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, (_all, key, _q, dq, sq) => {
    attrs[key] = dq ?? sq ?? '';
    return _all;
  });
  return Object.freeze(attrs);
}

export function childText(node = {}, childName = '') {
  return nodeText(elementChildren(node, childName)[0] || {});
}

export function originalEvidence(element = {}) {
  const blocks = elementChildren(element, 'OriginalElement');
  const xml = blocks.length === 1 ? unwrapCdata(nodeText(blocks[0])) : '';
  return Object.freeze({
    count: blocks.length,
    xml,
    attrs: attrsOfOpenTag(xml, 'PIPINGELEMENT'),
    usable: blocks.length === 1 && /<PIPINGELEMENT\b/i.test(xml),
  });
}

export function normalizedFields(element = {}) {
  const fields = {};
  for (const [blockName, names] of Object.entries(COMPARED_FIELDS)) {
    const block = elementChildren(element, blockName)[0];
    if (!block) continue;
    for (const name of names) {
      const value = childText(block, name);
      if (value) fields[name] = value;
    }
  }
  return Object.freeze(fields);
}

function extensionNames(node = {}, allowed = new Set()) {
  return elementChildren(node)
    .map((child) => child.name)
    .filter((name) => !allowed.has(name));
}

function nodeEntry(node = {}) {
  return Object.freeze({
    nodeNumber: clean(nodeKey(node)),
    role: clean(nodeRole(node)),
    blockNames: Object.freeze(elementChildren(node).map((child) => child.name)),
    extensionBlocks: Object.freeze(extensionNames(node, NODE_CHILDREN)),
  });
}

function nodesForElement(element = {}) {
  const block = elementChildren(element, 'NodesBlock')[0];
  const candidates = block ? childrenByName(block, 'Node') : childrenByName(element, 'Node');
  return Object.freeze(candidates.map(nodeEntry));
}

function hasDerivedCoordinates(element = {}) {
  const nodes = nodesForElement(element);
  return nodes.some((node) => node.blockNames.includes('DerivedCoordinateBlock'));
}

function elementEntry(element = {}, lineValue = '') {
  const evidence = originalEvidence(element);
  return Object.freeze({
    elementKey: clean(elementKey(element)),
    fromNode: clean(element.attrs?.fromNode || element.attrs?.FROM_NODE),
    toNode: clean(element.attrs?.toNode || element.attrs?.TO_NODE),
    lineId: lineValue,
    blockNames: Object.freeze(elementChildren(element).map((child) => child.name)),
    extensionBlocks: Object.freeze(extensionNames(element, ELEMENT_CHILDREN)),
    nodes: nodesForElement(element),
    normalizedFields: normalizedFields(element),
    original: evidence,
    derivedCoordinates: hasDerivedCoordinates(element),
  });
}

function lineEntry(line = {}) {
  const id = clean(lineId(line));
  const lineBlocks = elementChildren(line, 'LineBlocks')[0];
  return Object.freeze({
    lineId: id,
    blockNames: Object.freeze(elementChildren(line).map((child) => child.name)),
    extensionBlocks: Object.freeze(extensionNames(line, LINE_CHILDREN)),
    lineBlockExtensions: Object.freeze(lineBlocks ? extensionNames(lineBlocks, LINE_BLOCK_CHILDREN) : []),
    elements: Object.freeze(childrenByName(line, 'Element').map((element) => elementEntry(element, id))),
  });
}

export function parseCategorizedInputXmlModel(text = '') {
  const document = parseCategorizedTransferDocument(text);
  const root = document.root || {};
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_READ_MODEL_SCHEMA,
    rootName: clean(root.name),
    documentSchema: clean(root.attrs?.schema),
    sourceName: clean(root.attrs?.sourceName),
    lines: Object.freeze((document.lines || []).map(lineEntry)),
    serialized: serializeCategorizedTransferDocument(document),
  });
}

export const _test = Object.freeze({
  elementChildren,
  nodeText,
  unwrapCdata,
  attrsOfOpenTag,
  childText,
  originalEvidence,
  normalizedFields,
  extensionNames,
  nodesForElement,
  hasDerivedCoordinates,
});

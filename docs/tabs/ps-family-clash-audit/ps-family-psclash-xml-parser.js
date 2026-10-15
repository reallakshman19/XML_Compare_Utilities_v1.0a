import { decodeXmlEntities, extractFamilyRoot, makeDisplayName, makeExactMemberKey, parseNumber, parsePipeTag, stripLeadingSlash } from './ps-family-token-utils.js';

const DEFAULT_STRUCTURAL_ZONES = Object.freeze(['CU-SU', 'STRUCTURE', 'FRMWORK', 'GENSEC', 'PANEL', 'FACET GROUP']);
const DEFAULT_SUPPORT_ZONES = Object.freeze(['PS-', 'SL-']);

function parseAttributes(tagText) {
  const attrs = {};
  const attrRegex = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(tagText))) attrs[match[1]] = decodeXmlEntities(match[2]);
  return attrs;
}

function extractNodes(pathlinkXml) {
  const nodes = [];
  const nodeRegex = /<node>([\s\S]*?)<\/node>/g;
  let match;
  while ((match = nodeRegex.exec(pathlinkXml))) nodes.push(stripLeadingSlash(match[1]));
  return nodes;
}

function extractSmartTagValue(clashObjectXml, tagName) {
  const tagRegex = /<smarttag>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/smarttag>/g;
  let match;
  while ((match = tagRegex.exec(clashObjectXml))) {
    if (decodeXmlEntities(match[1]).trim().toLowerCase() === tagName.toLowerCase()) return stripLeadingSlash(match[2]);
  }
  return '';
}

function findLineBranchNode(path) {
  return [...path].reverse().find((node) => /ASIM-/i.test(node) && /\/B\d+$/i.test(node)) || '';
}

function findFamilyLeaf(path, fallback = '', options = {}) {
  return [...path].reverse().find((node) => extractFamilyRoot(node, options) && !/MAIN$/i.test(node)) || fallback;
}

function listFromOption(value, fallback) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [...fallback];
  return text.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function hasZone(text, zones) {
  const upper = String(text || '').toUpperCase();
  return zones.some((zone) => upper.includes(String(zone).toUpperCase()));
}

function classifyObject(itemName, path, options = {}) {
  const text = `${itemName} ${(path || []).join(' ')}`;
  const structuralZones = listFromOption(options.structuralZones || options.structuralZonesText, DEFAULT_STRUCTURAL_ZONES);
  const supportZones = listFromOption(options.supportZones || options.supportZonesText, DEFAULT_SUPPORT_ZONES);
  if (hasZone(text, structuralZones)) return 'StructuralGroup';
  if (hasZone(text, supportZones)) return 'Support';
  return 'Support';
}

function pointFrom(xml) {
  const match = xml.match(/<pos3f\s+([^>]*)\/>/i);
  if (!match) return null;
  const attrs = parseAttributes(match[1]);
  return { x: parseNumber(attrs.x), y: parseNumber(attrs.y), z: parseNumber(attrs.z) };
}

function parseClashObject(clashObjectXml, options) {
  const pathlinkMatch = clashObjectXml.match(/<pathlink>([\s\S]*?)<\/pathlink>/i);
  const path = pathlinkMatch ? extractNodes(pathlinkMatch[1]) : [];
  const itemName = extractSmartTagValue(clashObjectXml, 'Item Name') || findFamilyLeaf(path, path[path.length - 1] || '', options);
  const branchNode = findLineBranchNode(path);
  const pipe = branchNode ? parsePipeTag(branchNode) : null;
  return { itemName: makeDisplayName(itemName), exactMemberKey: makeExactMemberKey(itemName), familyRoot: extractFamilyRoot(itemName, options), objectType: classifyObject(itemName, path, options), branchNode, pipe, path };
}

function clashNumber(name) {
  const match = String(name || '').match(/^(?:Clash)?(\d+)$/i);
  return match ? match[1] : String(name || '');
}

function lineContext(objects) {
  return objects.find((item) => item.pipe)?.pipe || null;
}

function edgeFromObjects(attrs, body, objects, sourceInput) {
  if (objects.length < 2) return null;
  const pipe = lineContext(objects);
  const [a, b] = objects;
  if (!pipe) return null;
  const supportObjects = objects.filter((item) => item.objectType === 'Support');
  const structuralObjects = objects.filter((item) => item.objectType === 'StructuralGroup');
  const edgeType = structuralObjects.length ? 'StructuralContact' : 'SupportChain';
  const root = supportObjects[0]?.familyRoot || structuralObjects[0]?.familyRoot || '';
  return {
    sourceInput,
    clashName: attrs.name || 'clash',
    supportChangeName: clashNumber(attrs.name || 'clash'),
    distance: parseNumber(attrs.distance),
    point: pointFrom(body),
    edgeType,
    objectA: a,
    objectB: b,
    supportA: supportObjects[0]?.itemName || '',
    supportB: supportObjects[1]?.itemName || '',
    support: supportObjects[0]?.itemName || '',
    structuralGroup: structuralObjects[0]?.itemName || '',
    psRoot: root,
    structuralRoot: structuralObjects[0]?.familyRoot || '',
    supportRoots: supportObjects.map((item) => item.familyRoot).filter(Boolean),
    lineFamily: pipe.lineFamily,
    fullLineTag: pipe.fullLineTag,
    branchNode: pipe.fullBranchNode,
    supportGroup: pipe.lineFamily && root ? `${pipe.lineFamily}_${root}` : '',
    parsedEdge: edgeType === 'StructuralContact' ? `${structuralObjects[0]?.itemName || a.itemName} ↔ ${supportObjects[0]?.itemName || b.itemName}` : `${a.itemName} ↔ ${b.itemName}`,
  };
}

export function parseSupportChangeXml(xmlText, options = {}, sourceInput = 'SupportChangeXML') {
  const source = String(xmlText || '');
  const rows = [];
  const diagnostics = [];
  if (!source.trim()) return { rows, diagnostics };
  const clashRegex = /<clashresult\b([^>]*)>([\s\S]*?)<\/clashresult>/gi;
  let match;
  while ((match = clashRegex.exec(source))) {
    const attrs = parseAttributes(match[1]);
    const objectXml = Array.from(match[2].matchAll(/<clashobject>([\s\S]*?)<\/clashobject>/gi)).map((item) => item[1]);
    const objects = objectXml.map((xml) => parseClashObject(xml, options));
    const row = edgeFromObjects(attrs, match[2], objects, sourceInput);
    if (row) rows.push(row);
  }
  if (!rows.length) diagnostics.push({ level: 'WARN', code: 'NO_SUPPORT_CHANGE_ROWS', message: 'No SupportChangeXML rows were found.' });
  return { rows, diagnostics };
}

export function parsePsClashXml(xmlText, options = {}) { return parseSupportChangeXml(xmlText, options, 'PSClash XML'); }
export function numberValue(value) { return parseNumber(value); }

export const XML_COMPARE_CATEGORIZED_XML_TREE_SCHEMA = 'xml-compare-categorized-xml-tree/v1';

const clean = (value) => String(value ?? '').trim();
const voidNames = new Set(['']);

function textNode(text = '') { return { type: 'text', text: String(text ?? '') }; }
function elementNode(name = '', attrs = {}, attrOrder = []) { return { type: 'element', name: clean(name), attrs: { ...attrs }, attrOrder: [...attrOrder], children: [] }; }
function isElement(node, name = '') { return node?.type === 'element' && (!name || node.name === name); }
function childElements(node, name = '') { return (node?.children || []).filter((child) => isElement(child, name)); }
function attr(node, names = []) { for (const key of names) if (clean(node?.attrs?.[key])) return clean(node.attrs[key]); return ''; }
export function nodeNumber(value = '') { const text = clean(value); return /^-?\d+(\.0+)?$/.test(text) ? String(Math.trunc(Number(text))) : text.replace(/\.0+$/, ''); }
export function lineId(node = {}) { return attr(node, ['id', 'lineId', 'LINE_ID', 'lineNo', 'LINE_NO']); }
export function elementKey(node = {}) { return attr(node, ['elementKey']) || `${attr(node, ['fromNode', 'FROM_NODE'])}->${attr(node, ['toNode', 'TO_NODE'])}`; }
export function nodeKey(node = {}) { return nodeNumber(attr(node, ['nodeNumber', 'NODE', 'NODE_NUM', 'nodeRef'])); }
export function nodeRole(node = {}) { return attr(node, ['role', 'ROLE']); }

function tagEnd(text = '', start = 0) {
  let quote = '';
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '>') return i;
  }
  return -1;
}

function splitOpen(raw = '') {
  const body = clean(raw.replace(/\/$/, ''));
  const match = body.match(/^([^\s/>]+)([\s\S]*)$/);
  return { name: clean(match?.[1]), rest: match?.[2] || '' };
}

function unescapeAttr(value = '') {
  return String(value ?? '')
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&#39;', "'").replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}
function parseAttrs(rest = '') {
  const attrs = {}, attrOrder = [];
  rest.replace(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, (_all, key, _q, dq, sq) => {
    if (!attrOrder.includes(key)) attrOrder.push(key);
    attrs[key] = unescapeAttr(dq ?? sq ?? '');
    return _all;
  });
  return { attrs, attrOrder };
}

function appendText(parent, text = '') {
  if (!clean(text)) return;
  parent.children.push(textNode(clean(text)));
}

function parseOpenTag(raw = '') {
  const selfClosing = /\/\s*$/.test(raw);
  const { name, rest } = splitOpen(raw);
  const { attrs, attrOrder } = parseAttrs(rest);
  return { node: elementNode(name, attrs, attrOrder), selfClosing: selfClosing || voidNames.has(name) };
}

function shouldSkipTag(raw = '') {
  const body = clean(raw);
  return body.startsWith('?') || body.startsWith('!');
}

export function parseXmlTree(xml = '') {
  const document = elementNode('#document');
  const stack = [document];
  let pos = 0;
  while (pos < String(xml).length) pos = parseNext(String(xml), pos, stack);
  return document.children.find((node) => isElement(node)) || elementNode('CategorizedInputXML');
}

function parseNext(text = '', pos = 0, stack = []) {
  const lt = text.indexOf('<', pos);
  if (lt < 0) { appendText(stack.at(-1), text.slice(pos)); return text.length; }
  appendText(stack.at(-1), text.slice(pos, lt));
  // CDATA is opaque: preserve it verbatim so embedded markup (e.g. OriginalElement's PIPINGELEMENT)
  // does not corrupt the element stack.
  if (text.startsWith('<![CDATA[', lt)) {
    const end = text.indexOf(']]>', lt);
    const cdataEnd = end < 0 ? text.length : end + 3;
    stack.at(-1).children.push(textNode(text.slice(lt, cdataEnd)));
    return cdataEnd;
  }
  const gt = tagEnd(text, lt + 1);
  if (gt < 0) return text.length;
  const raw = text.slice(lt + 1, gt);
  if (shouldSkipTag(raw)) return gt + 1;
  if (raw.startsWith('/')) { closeStack(stack, clean(raw.slice(1))); return gt + 1; }
  const parsed = parseOpenTag(raw);
  stack.at(-1).children.push(parsed.node);
  if (!parsed.selfClosing) stack.push(parsed.node);
  return gt + 1;
}

function closeStack(stack, name = '') {
  for (let i = stack.length - 1; i > 0; i -= 1) {
    const node = stack.pop();
    if (node.name === name) return;
  }
}

function attrsText(node = {}) {
  const keys = [...new Set([...(node.attrOrder || []), ...Object.keys(node.attrs || {}).sort()])];
  return keys.map((key) => ` ${key}="${escapeAttr(node.attrs[key])}"`).join('');
}

function escapeAttr(value = '') { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'); }
function serializeChild(node) { return node?.type === 'text' ? node.text : serializeXmlTree(node); }
export function serializeXmlTree(node = {}) { if (!isElement(node)) return ''; const body = (node.children || []).map(serializeChild).join(''); return body ? `<${node.name}${attrsText(node)}>${body}</${node.name}>` : `<${node.name}${attrsText(node)}/>`; }

export function parseCategorizedTransferDocument(xml = '') {
  const root = parseXmlTree(xml);
  return { schema: XML_COMPARE_CATEGORIZED_XML_TREE_SCHEMA, rootName: root.name, root, lines: childElements(root, 'Line') };
}

export function serializeCategorizedTransferDocument(doc = {}) { return serializeXmlTree(doc.root || doc); }
export function childrenByName(node = {}, name = '') { return childElements(node, name); }
export function cloneTree(node = {}) { return node?.type === 'text' ? textNode(node.text) : { type: 'element', name: node.name, attrs: { ...(node.attrs || {}) }, attrOrder: [...(node.attrOrder || [])], children: (node.children || []).map(cloneTree) }; }
export function blockSummary(node = null) { const xml = node ? serializeXmlTree(node) : ''; return { blockName: clean(node?.name), itemCount: node ? descendantCount(node) : 0, xml }; }
function descendantCount(node = {}) { return (node.children || []).filter(isElement).reduce((sum, child) => sum + 1 + descendantCount(child), 0); }

export const _test = Object.freeze({ clean, textNode, elementNode, isElement, childElements, attr, tagEnd, parseAttrs, parseOpenTag, closeStack, attrsText, descendantCount });

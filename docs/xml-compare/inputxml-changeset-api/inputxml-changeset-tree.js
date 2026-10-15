import { categorizedInputXmlToInputXml } from '../CategorizedInputXmlConverter.js';
import {
  childrenByName,
  cloneTree,
  elementKey,
  lineId,
  parseCategorizedTransferDocument,
  serializeCategorizedTransferDocument,
} from '../XmlCompareCategorizedXmlTree.js';
import {
  elementChildren,
  nodeText,
  unwrapCdata,
} from '../categorized-inputxml-api/categorized-inputxml-api-model.js';

const clean = (value) => String(value ?? '').trim();

function escapeForQuote(value = '', quote = '"') {
  let text = String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  text = quote === "'" ? text.replaceAll("'", '&apos;') : text.replaceAll('"', '&quot;');
  return text;
}

export function setPipingElementAttribute(xml = '', field = '', value = '') {
  const text = String(xml ?? ''), open = text.match(/^\s*<PIPINGELEMENT\b[^>]*>/i)?.[0] || '';
  if (!open) return Object.freeze({ success: false, text, reason: 'pipingelement-open-tag-missing' });
  const escapedField = String(field).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\s${escapedField}\\s*=\\s*)(["'])([\\s\\S]*?)\\2`, 'i');
  let nextOpen;
  if (pattern.test(open)) nextOpen = open.replace(pattern, (_all, prefix, quote) => `${prefix}${quote}${escapeForQuote(value, quote)}${quote}`);
  else {
    const ending = /\/\s*>$/.test(open) ? '/>' : '>';
    nextOpen = `${open.slice(0, -ending.length).trimEnd()} ${field}="${escapeForQuote(value)}"${ending}`;
  }
  return Object.freeze({ success: true, text: text.replace(open, nextOpen), reason: '' });
}

function cdataText(xml = '') {
  return `<![CDATA[${String(xml ?? '').replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function rootLines(root = {}) {
  return childrenByName(root, 'Line');
}

function findLine(root = {}, wanted = '') {
  return rootLines(root).find((line) => clean(lineId(line)) === clean(wanted)) || null;
}

function findElement(line = {}, wanted = '') {
  return childrenByName(line, 'Element').find((element) => clean(elementKey(element)) === clean(wanted)) || null;
}

function originalBlock(element = {}) {
  const blocks = elementChildren(element, 'OriginalElement');
  return blocks.length === 1 ? blocks[0] : null;
}

function groupChanges(changes = []) {
  const groups = new Map();
  for (const change of changes) {
    const key = `${change.lineId}\u001f${change.elementKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(change);
  }
  return groups;
}

function applyElementGroup(root, changes = []) {
  const first = changes[0] || {}, line = findLine(root, first.lineId);
  if (!line) return blockedRows(changes, 'line-not-found');
  const element = findElement(line, first.elementKey);
  if (!element) return blockedRows(changes, 'element-not-found');
  const block = originalBlock(element);
  if (!block) return blockedRows(changes, 'original-element-not-unique');
  let sourceXml = unwrapCdata(nodeText(block));
  const rows = [];
  for (const change of changes) {
    const patched = setPipingElementAttribute(sourceXml, change.field, change.afterValue);
    if (!patched.success) rows.push(receiptRow(change, 'blocked', patched.reason));
    else {
      sourceXml = patched.text;
      rows.push(receiptRow(change, 'applied', ''));
    }
  }
  if (rows.some((row) => row.status === 'blocked')) return rows;
  block.children = [{ type: 'text', text: cdataText(sourceXml) }];
  return rows;
}

function receiptRow(change = {}, status = 'skipped', reason = '') {
  return Object.freeze({
    changeId: change.changeId || '',
    lineId: change.lineId || '',
    elementKey: change.elementKey || '',
    field: change.field || '',
    status,
    reason,
    beforeValue: change.beforeValue ?? null,
    afterValue: change.afterValue ?? null,
  });
}

function blockedRows(changes = [], reason = '') {
  return changes.map((change) => receiptRow(change, 'blocked', reason));
}

export function applyChangesToCategorizedSource(content = '', changes = []) {
  const parsed = parseCategorizedTransferDocument(content), root = cloneTree(parsed.root);
  const rows = [];
  for (const group of groupChanges(changes).values()) rows.push(...applyElementGroup(root, group));
  const categorizedText = `<?xml version="1.0" encoding="UTF-8"?>\n${serializeCategorizedTransferDocument(root)}\n`;
  const inputXmlText = categorizedInputXmlToInputXml(categorizedText);
  return Object.freeze({
    categorizedText,
    inputXmlText,
    receiptRows: Object.freeze(rows),
  });
}

export const _test = Object.freeze({
  escapeForQuote,
  cdataText,
  rootLines,
  findLine,
  findElement,
  originalBlock,
  groupChanges,
  applyElementGroup,
  receiptRow,
  blockedRows,
});

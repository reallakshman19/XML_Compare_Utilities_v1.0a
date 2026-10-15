/**
 * simple-xml.js — dependency-free structured XML parse/mutate/serialize.
 *
 * Works identically in the browser and in Node tests (no DOMParser, no shims).
 * Used by the workbench adapters (read) and the transfer apply engine
 * (structured attribute mutation — never regex patching of the raw text).
 */

const ENTITY_DECODE = Object.freeze({ '&quot;': '"', '&apos;': "'", '&gt;': '>', '&lt;': '<', '&amp;': '&' });

export function decodeXmlEntities(value) {
  return String(value ?? '').replace(/&(?:quot|apos|gt|lt|amp);/g, (m) => ENTITY_DECODE[m] ?? m);
}

export function encodeXmlAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function encodeXmlText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class XmlNode {
  constructor(name) {
    this.name = name;
    this.attributes = new Map(); // insertion order preserved for round-trip stability
    this.children = [];
    this.text = '';
    this.parent = null;
    this.selfClosing = false;
  }

  getAttribute(name) {
    if (this.attributes.has(name)) return this.attributes.get(name);
    // case-insensitive fallback
    const wanted = String(name).toUpperCase();
    for (const [key, value] of this.attributes) {
      if (key.toUpperCase() === wanted) return value;
    }
    return null;
  }

  setAttribute(name, value) {
    const wanted = String(name).toUpperCase();
    for (const key of this.attributes.keys()) {
      if (key.toUpperCase() === wanted) {
        this.attributes.set(key, String(value));
        return;
      }
    }
    this.attributes.set(name, String(value));
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    if (this.selfClosing) this.selfClosing = false;
    return child;
  }

  childrenNamed(name) {
    const wanted = String(name).toUpperCase();
    return this.children.filter((c) => c.name.toUpperCase() === wanted);
  }

  descendantsNamed(name) {
    const wanted = String(name).toUpperCase();
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.name.toUpperCase() === wanted) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  firstDescendantNamed(name) {
    return this.descendantsNamed(name)[0] ?? null;
  }

  get textContent() {
    if (!this.children.length) return this.text;
    return this.text + this.children.map((c) => c.textContent).join('');
  }
}

/**
 * Parse XML text into an XmlNode tree.
 * Tolerant: skips comments, processing instructions, CDATA (kept as text), doctype.
 */
export function parseXml(xmlText) {
  const source = String(xmlText ?? '');
  const root = new XmlNode('#document');
  const stack = [root];
  const tokenPattern = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/g;
  let match;
  while ((match = tokenPattern.exec(source))) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('<![CDATA[')) {
      stack[stack.length - 1].text += token.slice(9, -3);
      continue;
    }
    if (!token.startsWith('<')) {
      const text = decodeXmlEntities(token);
      if (text.trim()) stack[stack.length - 1].text += text;
      continue;
    }
    if (token.startsWith('<?') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClosing = /\/\s*>$/.test(token);
    const body = token.slice(1, selfClosing ? -2 : -1).trim();
    const nameMatch = body.match(/^([^\s/>]+)/);
    if (!nameMatch) continue;
    const node = new XmlNode(nameMatch[1]);
    node.selfClosing = selfClosing;
    const attrPattern = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let attrMatch;
    const attrText = body.slice(nameMatch[1].length);
    while ((attrMatch = attrPattern.exec(attrText))) {
      node.attributes.set(attrMatch[1], decodeXmlEntities(attrMatch[3] ?? attrMatch[4] ?? ''));
    }
    stack[stack.length - 1].appendChild(node);
    if (!selfClosing) stack.push(node);
  }
  const documentElement = root.children.find((c) => !c.name.startsWith('#')) ?? null;
  if (!documentElement) throw new Error('simple-xml: no root element found');
  return { root, documentElement };
}

export function serializeXml(node, { indent = '', declaration = false } = {}) {
  const parts = [];
  if (declaration) parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  const write = (n, depth) => {
    const pad = indent ? '\n' + indent.repeat(depth) : '';
    const attrs = Array.from(n.attributes.entries())
      .map(([key, value]) => ` ${key}="${encodeXmlAttribute(value)}"`)
      .join('');
    if (!n.children.length && !n.text) {
      parts.push(`${pad}<${n.name}${attrs}/>`);
      return;
    }
    parts.push(`${pad}<${n.name}${attrs}>`);
    if (n.text) parts.push(encodeXmlText(n.text));
    for (const child of n.children) write(child, depth + 1);
    if (n.children.length && indent) parts.push('\n' + indent.repeat(depth));
    parts.push(`</${n.name}>`);
  };
  const start = node.name === '#document' ? node.children : [node];
  for (const child of start) write(child, 0);
  return parts.join('').replace(/^\n/, '');
}

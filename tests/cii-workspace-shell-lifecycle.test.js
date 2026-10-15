import assert from 'assert';
import { installCiiWorkspaceTile } from '../tabs/cii-workspace/cii-workspace-tab.js';

function datasetKey(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
function decodeHtml(value) {
  return String(value).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase(); this.ownerDocument = ownerDocument;
    this.children = []; this.parentNode = null; this.attributes = new Map(); this.dataset = {};
    this.listeners = new Map(); this.disabled = false; this.value = ''; this.files = []; this.textContent = '';
    this.className = ''; this.id = ''; this.type = ''; this.rel = ''; this.href = ''; this.download = '';
    this._innerHTML = '';
  }
  setAttribute(name, value = '') {
    const text = decodeHtml(value); this.attributes.set(name, text);
    if (name.startsWith('data-')) this.dataset[datasetKey(name)] = text;
    if (name === 'id') this.id = text;
  }
  appendChild(child) {
    child.parentNode = this; this.children.push(child);
    if (child.id) this.ownerDocument._ids.set(child.id, child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  async dispatch(type) {
    const pending = [];
    for (const listener of this.listeners.get(type) || []) {
      const value = listener({ type, target: this });
      if (value?.then) pending.push(value);
    }
    await Promise.all(pending);
  }
  async click() {
    if (this.tagName === 'A' && this.download) this.ownerDocument.downloads.push({ name: this.download, href: this.href });
    await this.dispatch('click');
  }
  matches(selector) {
    const match = selector.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
    if (!match) return false;
    if (!this.attributes.has(match[1])) return false;
    return match[2] === undefined || this.attributes.get(match[1]) === match[2];
  }
  querySelectorAll(selector) {
    const out = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (child.matches(selector)) out.push(child);
        visit(child);
      }
    };
    visit(this); return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  set innerHTML(html) {
    this._innerHTML = String(html); this.children = [];
    const tagPattern = /<([a-z0-9]+)([^>]*)>/gi;
    let match;
    while ((match = tagPattern.exec(this._innerHTML))) {
      const attrs = match[2];
      if (!/data-ciiw-/.test(attrs)) continue;
      const child = new FakeElement(match[1], this.ownerDocument);
      const attrPattern = /(data-ciiw-[a-z0-9-]+)(?:="([^"]*)")?/gi;
      let attrMatch;
      while ((attrMatch = attrPattern.exec(attrs))) child.setAttribute(attrMatch[1], attrMatch[2] || '');
      if (/\bdisabled\b/i.test(attrs)) child.disabled = true;
      this.appendChild(child);
    }
  }
  get innerHTML() { return this._innerHTML; }
}
class FakeDocument {
  constructor() {
    this._ids = new Map(); this.downloads = [];
    this.head = new FakeElement('head', this); this.body = new FakeElement('body', this);
  }
  createElement(tag) { return new FakeElement(tag, this); }
  getElementById(id) {
    if (this._ids.has(id)) return this._ids.get(id);
    const find = (root) => {
      for (const child of root.children) {
        if (child.id === id) return child;
        const nested = find(child); if (nested) return nested;
      }
      return null;
    };
    return find(this.head) || find(this.body);
  }
}

function cii(from, to) {
  return `#$ VERSION\nCII Workspace lifecycle fixture\n#$ CONTROL\n              1            0            0            0            0            0\n              0            0            0            0            0            0\n              0            0            0            0            0            0\n              0\n#$ ELEMENTS\n    ${from}.0000      ${to}.0000         0.000000     0.000000 -108.000        114.30000\n    6.00000      20.0000         0.000000  350.000         0.000000     0.000000\n       0.000000     0.000000     0.000000     0.000000     0.000000     0.000000\n    2.00000         0.000000     0.000000     0.000000     0.000000     0.000000\n       0.000000     0.000000     0.000000  203391.     0.292000     0.783344E-02\n   0.140000E-03 0.999556E-03     0.000000     0.000000     0.000000  5.00000\n       0.000000     0.000000     0.000000     0.000000     0.000000     0.000000\n       0.000000     0.000000     0.000000     0.000000  9999.99      9999.99\n       0.000000     0.000000     0.000000     0.000000     0.000000\n           0\n           0\n             -1           -1\n              0            0            0            0            0            0\n              0            0            0            0            0            0\n              0            0            0\n`;
}
function file(name, text) { return { name, async text() { return text; } }; }
function overlay(documentRef) { return documentRef.body.children.find((child) => child.className === 'ciiw-backdrop') || null; }

const documentRef = new FakeDocument();
const container = documentRef.createElement('div'); documentRef.body.appendChild(container);
const uninstall = installCiiWorkspaceTile(container);
const duplicateUninstall = installCiiWorkspaceTile(container);
assert.strictEqual(container.querySelectorAll('[data-ciiw-open]').length, 1, 'installer must create exactly one tile');
assert(documentRef.getElementById('cii-workspace-style'), 'stylesheet should install once');
duplicateUninstall();

const tile = container.querySelector('[data-ciiw-open]');
await tile.click();
let shell = overlay(documentRef);
assert(shell, 'tile click should open one workspace overlay');
assert.strictEqual(shell.querySelectorAll('[data-ciiw-stage]').length, 7, 'all seven locked stages must be visible');
assert.strictEqual(shell.querySelector('[data-ciiw-apply]'), null, 'legacy duplicate Stage06 apply control must remain removed');
assert.strictEqual(shell.querySelector('[data-ciiw-refresh-review]').disabled, true);

shell.querySelector('[data-ciiw-source]').files = [file('source.cii', cii(10, 20))];
shell.querySelector('[data-ciiw-target]').files = [file('target.cii', cii(5000, 5010))];
await shell.querySelector('[data-ciiw-inspect]').click();
assert(shell.querySelector('[data-ciiw-landmarks]').innerHTML.includes('10'));
assert(shell.querySelector('[data-ciiw-landmarks]').innerHTML.includes('5000'));
assert(shell.querySelector('[data-ciiw-landmarks]').innerHTML.includes('SUGGESTED'));
assert(/evidence only/.test(shell.querySelector('[data-ciiw-status]').textContent));
shell.querySelector('[data-ciiw-source-anchors]').value = '10,20';
shell.querySelector('[data-ciiw-target-anchors]').value = '5000,5010';
await shell.querySelector('[data-ciiw-analyze]').click();
assert(/Correspondence READY/.test(shell.querySelector('[data-ciiw-status]').textContent));
assert(/Writer 1B/.test(shell.querySelector('[data-ciiw-status]').textContent));
assert.strictEqual(shell.querySelector('[data-ciiw-refresh-review]').disabled, false);
assert.strictEqual(shell.querySelector('[data-ciiw-export-csv]').disabled, false);
assert.strictEqual(shell.querySelector('[data-ciiw-export-json]').disabled, false);

shell.querySelector('[data-ciiw-source-anchors]').value = '10,20,30';
await shell.querySelector('[data-ciiw-source-anchors]').dispatch('input');
assert.strictEqual(shell.querySelector('[data-ciiw-refresh-review]').disabled, true, 'anchor edits must invalidate stale review state');
assert.strictEqual(shell.querySelector('[data-ciiw-export-csv]').disabled, true, 'anchor edits must invalidate stale exports');
assert(/Locked anchors changed/.test(shell.querySelector('[data-ciiw-status]').textContent));
shell.querySelector('[data-ciiw-source-anchors]').value = '10,20';
await shell.querySelector('[data-ciiw-analyze]').click();

const decisions = shell.querySelector('[data-ciiw-results]').querySelectorAll('[data-ciiw-decision]');
assert(decisions.length >= 1, 'automated correspondence should expose review control');
decisions[0].value = 'ACCEPT'; await decisions[0].dispatch('change');
await shell.querySelector('[data-ciiw-refresh-review]').click();
assert(overlay(documentRef), 'review refresh must keep shell mounted');
assert(/transfer preview (PREVIEW_READY|BLOCKED)/.test(shell.querySelector('[data-ciiw-status]').textContent), 'review refresh must rebuild an explicit transfer state');
assert(/Writer 1B (READY|BLOCKED)/.test(shell.querySelector('[data-ciiw-status]').textContent), 'review refresh must expose Writer 1B readiness explicitly');

await shell.querySelector('[data-ciiw-export-csv]').click();
await shell.querySelector('[data-ciiw-export-json]').click();
assert.deepStrictEqual(documentRef.downloads.map((item) => item.name), ['cii-correspondence.csv', 'cii-workspace-audit.json']);
assert.strictEqual(shell.querySelector('[data-ciiw-apply]'), null, 'review/export must not restore the removed legacy apply control');

shell.querySelector('[data-ciiw-target]').files = [file('target-2.cii', cii(5000, 5010))];
await shell.querySelector('[data-ciiw-target]').dispatch('change');
assert.strictEqual(shell.querySelector('[data-ciiw-export-json]').disabled, true, 'file changes must invalidate stale export state');
assert.strictEqual(shell.querySelector('[data-ciiw-landmarks]').innerHTML, '', 'file changes must clear prior landmark evidence');
assert(/CII files changed/.test(shell.querySelector('[data-ciiw-status]').textContent));

await shell.querySelector('[data-ciiw-close]').click();
assert.strictEqual(overlay(documentRef), null, 'close must destroy and remove overlay');
await tile.click();
shell = overlay(documentRef);
assert(shell, 'workspace must reopen after close');
assert.strictEqual(shell.querySelectorAll('[data-ciiw-stage]').length, 7);
uninstall();
assert.strictEqual(overlay(documentRef), null, 'uninstall must close an active overlay');
assert.strictEqual(container.querySelector('[data-ciiw-open]'), null, 'uninstall must remove tile');
console.log('CII Workspace shell/installer Writer 1B lifecycle checks passed.');

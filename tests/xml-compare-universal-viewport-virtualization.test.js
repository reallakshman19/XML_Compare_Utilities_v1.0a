import assert from 'node:assert/strict';
import {
  calculateUniversalVirtualWindow,
  createUniversalVirtualController,
  moveUniversalVirtualIndex,
  universalRevealScrollTop,
  universalVirtualTotalHeight,
} from '../xml-compare/universal-categorizer/universal-viewport-virtual-window.js';

const first = calculateUniversalVirtualWindow({ count: 20_000, rowHeight: 34, viewportHeight: 420, scrollTop: 0, overscan: 8 });
const middle = calculateUniversalVirtualWindow({ count: 20_000, rowHeight: 34, viewportHeight: 420, scrollTop: 340_000, overscan: 8 });
const last = calculateUniversalVirtualWindow({ count: 20_000, rowHeight: 34, viewportHeight: 420, scrollTop: 680_000, overscan: 8 });
assert.equal(first.start, 0);
assert.ok(middle.start > 9_000 && middle.end < 11_000);
assert.equal(last.end, 20_000);
assert.ok([first, middle, last].every((window) => window.rendered <= 250));
assert.equal(universalVirtualTotalHeight(20_000, 34), 680_000);
assert.ok(universalRevealScrollTop({ index: 19_999, rowHeight: 34, viewportHeight: 420, scrollTop: 0 }) > 679_000);
assert.equal(moveUniversalVirtualIndex(10, 'ArrowDown', 20_000), 11);
assert.equal(moveUniversalVirtualIndex(10, 'Home', 20_000), 0);
assert.equal(moveUniversalVirtualIndex(10, 'End', 20_000), 19_999);

class FakeSurface extends EventTarget {
  constructor() {
    super();
    this.scrollTop = 0;
    this.clientHeight = 420;
    this.dataset = {};
    this.offsetParent = null;
    this.visible = false;
    this.spacer = { style: {} };
    this.content = {
      style: { setProperty() {} },
      innerHTML: '',
      querySelector: () => null,
      replaceChildren() { this.innerHTML = ''; },
    };
  }
  querySelector(selector) {
    if (selector === '[data-uxc-virtual-spacer]') return this.spacer;
    if (selector === '[data-uxc-viewport-content]') return this.content;
    return null;
  }
  getClientRects() { return this.visible ? [{}] : []; }
  setAttribute(name, value) { this[name] = value; }
}

const surface = new FakeSurface();
const items = Array.from({ length: 1_000 }, (_, index) => ({ id: `row:${index}` }));
const controller = createUniversalVirtualController({
  surface,
  identityFor: (item) => item.id,
  renderRows: (rows) => rows.map((row) => `<i data-id="${row.id}">${row.id}</i>`).join(''),
  idAttribute: 'data-id',
  rowHeight: 34,
});
controller.setProjection(items);
assert.equal(controller.reveal('row:900'), true);
assert.ok(controller.metrics().firstVisible > 850);
assert.match(surface.content.innerHTML, /row:900/);
surface.visible = true;
controller.setSelection({ selectedId: 'row:900' });
assert.ok(surface.scrollTop > 0);
assert.equal(controller.destroy(), true);

console.log('xml-builder viewport virtual-window tests passed');

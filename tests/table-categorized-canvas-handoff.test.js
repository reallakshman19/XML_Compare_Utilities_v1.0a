import assert from 'node:assert/strict';

import {
  createPendingCanvasHandoff,
  sendCanvasHandoffArtifact,
} from '../xml-compare/table-categorizer/table-categorized-xml-canvas-handoff.js';

globalThis.File = globalThis.File || class File extends Blob {
  constructor(parts, name, options) {
    super(parts, options);
    this.name = name;
  }
};
globalThis.DataTransfer = class DataTransfer {
  constructor() {
    this.items = { files: [], add: (file) => this.items.files.push(file) };
  }
  get files() {
    return this.items.files;
  }
};
globalThis.Event = class Event {
  constructor(type, options) {
    this.type = type;
    this.bubbles = Boolean(options?.bubbles);
  }
};

const exportResult = { ok: true, xmlText: '<Root>\n  <Item />\n</Root>', graphJson: '{}', profileJson: '{}', diagnosticsJson: '[]' };
const pending = createPendingCanvasHandoff({
  exportResult,
  graph: { profileId: 'handoff-test', nodes: [] },
  profile: { profileId: 'handoff-test' },
  targetCanvas: 'target',
});

assert.equal(pending.summary.targetCanvas, 'TargetXML');
assert.equal(pending.summary.xmlRoot, 'Root');
assert.equal(pending.summary.lineCount, 3);

let dispatched = 0;
const input = {
  files: [],
  dispatchEvent(event) {
    if (event.type === 'change') dispatched += 1;
  },
};
const documentRef = { querySelector: () => input };

const blocked = sendCanvasHandoffArtifact(pending.artifact, { documentRef });
assert.equal(blocked.ok, false);
assert.equal(dispatched, 0);

const sent = sendCanvasHandoffArtifact(pending.artifact, { documentRef, confirmed: true });
assert.equal(sent.ok, true);
assert.equal(dispatched, 1);

console.log('Table categorized canvas handoff tests passed');

import assert from 'node:assert/strict';
import { TextEncoder } from 'node:util';
import { serializeRevisionCompareTransferHandoverBundle } from '../tabs/revision-compare/revision-transfer-handover.js';
import { createRevisionCompareHandoverInspectionController } from '../tabs/revision-compare/revision-transfer-handover-inspection-controller.js';
import { adoptRevisionCompareHandoverInspectionWorkspace } from '../tabs/revision-compare/revision-transfer-handover-inspection-workspace-state.js';
import { cryptoRef, handoverInspectionFixture } from './revision-compare-transfer-handover-inspection-fixtures.mjs';

const fixture = await handoverInspectionFixture();
const text = serializeRevisionCompareTransferHandoverBundle(fixture.bundle);
const bytes = new TextEncoder().encode(text);
function freshState() {
  return adoptRevisionCompareHandoverInspectionWorkspace({
    schema: 'RevisionCompareWorkspaceState.v13', session: { documents: {} },
    slots: { baseline: { status: 'EMPTY' }, candidate: { status: 'EMPTY' } },
    compare: { status: 'IDLE' }, review: { session: null }, decision: { ledger: null },
    evidencePackageImport: { status: 'IDLE' }, transfer: { request: null, applyRequest: null,
      plan: null, result: null, patchedSnapshot: null }, transferCompletion: { report: null },
    transferArchive: { artifact: null },
  });
}
function fileInput(files) {
  return { files, value: 'selected', hasAttribute: (name) => name === 'data-revc-handover-file' };
}
function button(name, value = '') {
  return { hasAttribute: (attribute) => attribute === name,
    getAttribute: (attribute) => attribute === name ? value : null };
}
function harness(options = {}) {
  let state = freshState(); const events = { renders: 0, toasts: [], failures: [], blobs: [], clicks: 0, removes: 0, revokes: 0 };
  class BlobRef { constructor(parts, config) { this.parts = parts; this.type = config.type; events.blobs.push(this); } }
  const anchor = { click: () => { events.clicks += 1; }, remove: () => { events.removes += 1; } };
  const view = { crypto: cryptoRef, Blob: BlobRef, URL: {
    createObjectURL: () => `blob:${events.blobs.length}`, revokeObjectURL: () => { events.revokes += 1; },
  } };
  const root = { appendChild: () => {}, ownerDocument: { defaultView: view, createElement: () => anchor } };
  const controller = createRevisionCompareHandoverInspectionController({
    root, cryptoRef, readState: () => state, writeState: (next) => { state = next; },
    render: () => { events.renders += 1; }, showToast: (...args) => events.toasts.push(args),
    reportFailure: (error) => events.failures.push(error.message), readFileBytes: options.readFileBytes,
  });
  return { controller, events, root, readState: () => state, writeState: (next) => { state = next; } };
}
function deferred() {
  let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const successful = harness();
const canonicalFile = new File([bytes], 'handover.json', { type: 'application/json' });
assert.equal(await successful.controller.handleChange(fileInput([canonicalFile])), true);
assert.equal(successful.readState().handoverInspection.status, 'VERIFIED');
assert.equal(successful.events.toasts.length, 1); assert.equal(successful.events.failures.length, 0);
const retained = successful.readState().handoverInspection.bundle;
assert.equal(await successful.controller.handleChange(fileInput([canonicalFile])), false);
assert.equal(successful.readState().handoverInspection.bundle, retained);
assert.match(successful.events.failures.at(-1), /Clear the verified/);

const bom = harness();
const bomFile = new File([new Uint8Array([0xEF, 0xBB, 0xBF]), bytes], 'bom.json', { type: 'application/json' });
await bom.controller.handleChange(fileInput([bomFile]));
assert.equal(bom.readState().handoverInspection.status, 'FAILED');
assert.match(bom.events.failures[0], /byte-order mark/);
assert.equal(bom.readState().handoverInspection.bundle, null);

const invalidUtf8 = harness();
const invalidFile = new File([new Uint8Array([0x7B, 0x22, 0x78, 0x22, 0x3A, 0xC3, 0x28, 0x7D])], 'invalid.json', { type: 'application/json' });
await invalidUtf8.controller.handleChange(fileInput([invalidFile]));
assert.equal(invalidUtf8.readState().handoverInspection.status, 'FAILED');
assert.equal(invalidUtf8.events.failures.length, 1);

for (const [files, pattern] of [
  [[], /exactly one/], [[canonicalFile, canonicalFile], /exactly one/],
  [[new File([], 'empty.json', { type: 'application/json' })], /non-empty/],
  [[{ name: 'huge.json', type: 'application/json', size: 134_217_729 }], /128 MiB/],
  [[new File([bytes], 'image.png', { type: 'image/png' })], /metadata/],
  [[new File([bytes], 'handover.json', { type: 'image/png' })], /metadata/],
]) {
  const admission = harness(); await admission.controller.handleChange(fileInput(files));
  assert.match(admission.events.failures[0], pattern); assert.equal(admission.readState().handoverInspection.status, 'IDLE');
}
const blankMime = harness();
assert.equal(await blankMime.controller.handleChange(fileInput([new File([bytes], 'handover.json')])), true);
const genericMime = harness();
assert.equal(await genericMime.controller.handleChange(fileInput([
  new File([bytes], 'handover.json', { type: 'application/octet-stream' }),
])), true);

const pending = { A: deferred(), B: deferred() };
const race = harness({ readFileBytes: (file) => pending[file.name[0]].promise });
const importA = race.controller.handleChange(fileInput([new File([bytes], 'A.json')]));
const importB = race.controller.handleChange(fileInput([new File([bytes], 'B.json')]));
pending.B.resolve(bytes); assert.equal(await importB, true);
pending.A.resolve(bytes); assert.equal(await importA, false);
assert.equal(race.readState().handoverInspection.fileName, 'B.json');
assert.equal(race.events.toasts.length, 1); assert.equal(race.events.failures.length, 0);

const clearPending = deferred();
const clearRace = harness({ readFileBytes: () => clearPending.promise });
const slowClear = clearRace.controller.handleChange(fileInput([new File([bytes], 'A.json')]));
await clearRace.controller.handleClick(button('data-revc-clear-handover-inspection'));
clearPending.resolve(bytes); assert.equal(await slowClear, false);
assert.equal(clearRace.readState().handoverInspection.status, 'IDLE');
assert.equal(clearRace.events.toasts.length, 0); assert.equal(clearRace.events.failures.length, 0);

const destroyPending = deferred();
const destroyed = harness({ readFileBytes: () => destroyPending.promise });
const slowDestroy = destroyed.controller.handleChange(fileInput([new File([bytes], 'A.json')]));
const beforeDestroy = destroyed.events.renders; destroyed.controller.destroy(); destroyPending.resolve(bytes);
assert.equal(await slowDestroy, false); assert.equal(destroyed.events.renders, beforeDestroy);
assert.equal(destroyed.events.toasts.length, 0); assert.equal(destroyed.events.failures.length, 0);

const downloads = harness();
await downloads.controller.handleChange(fileInput([canonicalFile]));
await downloads.controller.handleClick(button('data-revc-download-imported-handover'));
await downloads.controller.handleClick(button('data-revc-download-imported-handover'));
assert.deepEqual(downloads.events.blobs.slice(-2).map((item) => item.parts[0]), [text, text]);
for (let index = 0; index < 4; index += 1) {
  await downloads.controller.handleClick(button('data-revc-download-imported-transfer-artifact', String(index)));
  assert.equal(downloads.events.blobs.at(-1).parts[0], fixture.bundle.payload.transferArtifacts[index].text);
}
assert.equal(downloads.events.clicks, 6); assert.equal(downloads.events.removes, 6); assert.equal(downloads.events.revokes, 6);
const corrupt = structuredClone(downloads.readState());
corrupt.handoverInspection.bundle.payload.transferArtifacts[0].text += ' ';
downloads.writeState(corrupt); const clicksBefore = downloads.events.clicks;
await downloads.controller.handleClick(button('data-revc-download-imported-transfer-artifact', '0'));
assert.equal(downloads.events.clicks, clicksBefore); assert.match(downloads.events.failures.at(-1), /identity|artifact SHA-256/);
console.log('revision-compare-transfer-handover-inspection-controller.test.mjs passed');

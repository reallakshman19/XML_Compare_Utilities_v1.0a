import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import {
  downloadRevisionCompareTransferArtifact, validateRevisionCompareTransferArtifact,
} from '../tabs/revision-compare/revision-transfer-controller.js';

const text = '{"patched":true}\n';
const artifact = Object.freeze({
  descriptorSchema: 'RevisionCompareTransferArtifact.v1', filename: 'target_patched_target.json',
  schema: 'stage/v1', mimeType: 'application/json', text,
  contentSha256: await sha256Text(text, webcrypto), sizeBytes: new TextEncoder().encode(text).byteLength,
});
assert.equal(await validateRevisionCompareTransferArtifact(artifact, webcrypto), artifact);
await assert.rejects(() => validateRevisionCompareTransferArtifact({ ...artifact, text: '{}\n' }, webcrypto), /SHA-256/);
await assert.rejects(() => validateRevisionCompareTransferArtifact({ ...artifact, sizeBytes: 1 }, webcrypto), /byte length/);

const events = [];
const URLRef = {
  createObjectURL(blob) { events.push(['create', blob.type, blob.parts.join('')]); return 'blob:transfer'; },
  revokeObjectURL(url) { events.push(['revoke', url]); },
};
class BlobFixture { constructor(parts, options) { this.parts = parts; this.type = options.type; } }
const parent = { appendChild(anchor) { anchor.parent = parent; events.push(['append', anchor.download]); } };
const documentRef = {
  defaultView: { crypto: webcrypto, URL: URLRef, Blob: BlobFixture },
  createElement(name) {
    assert.equal(name, 'a');
    return { href: '', download: '', click() { events.push(['click', this.href, this.download]); }, remove() { events.push(['remove']); } };
  },
};
const root = Object.assign(parent, { ownerDocument: documentRef });
await downloadRevisionCompareTransferArtifact(root, artifact, { cryptoRef: webcrypto, URLRef, BlobRef: BlobFixture });
assert.deepEqual(events.map((entry) => entry[0]), ['create', 'append', 'click', 'remove', 'revoke']);
assert.deepEqual(events.at(-1), ['revoke', 'blob:transfer']);
assert.deepEqual(events[2], ['click', 'blob:transfer', artifact.filename]);

let state = { transfer: { status: 'STALE', artifacts: [artifact] } };
function currentDownloadAllowed(value) { return value.transfer.status === 'APPLIED'; }
assert.equal(currentDownloadAllowed(state), false); state = { transfer: { status: 'APPLIED', artifacts: [artifact] } };
assert.equal(currentDownloadAllowed(state), true);
console.log('revision-compare-transfer-downloads.test.mjs passed');

const { createRevisionCompareTransferController } = await import('../tabs/revision-compare/revision-transfer-controller.js');
let lifecycle = { transfer: { status: 'STALE', artifacts: Object.freeze([artifact, artifact, artifact, artifact]) } };
let failure = null;
const controller = createRevisionCompareTransferController({
  root, cryptoRef: webcrypto, now: () => '2026-07-24T12:00:00.000Z',
  readState: () => lifecycle, writeState: (next) => { lifecycle = next; }, render() {},
  reportFailure: (error) => { failure = error; }, dependencies: {},
});
await controller.handleClick({ hasAttribute: (name) => name === 'data-revc-download-patched-json' });
assert.match(failure.message, /current APPLIED/); const beforeCurrent = events.length;
lifecycle = { transfer: { status: 'APPLIED', artifacts: Object.freeze([artifact, artifact, artifact, artifact]) } }; failure = null;
await controller.handleClick({ hasAttribute: (name) => name === 'data-revc-download-patched-json' });
assert.equal(failure, null); assert.equal(events.length, beforeCurrent + 5); controller.destroy();

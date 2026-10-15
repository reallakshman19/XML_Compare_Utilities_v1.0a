/** Stateful intake worker runtime with approved-scope compare projection. */
import { projectCompareRecords } from './revision-compare-projection.js';
import { filterStagedDocument, readStagedRevision } from './revision-staged-core.js';
import { stagedDocumentMetadata } from './revision-document-metadata.js';
import { sha256Text } from './revision-hash.js';
import { frozenStrings } from './revision-contract-utils.js';

function sameStrings(left, right) {
  const a = frozenStrings(left); const b = frozenStrings(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
export function createRevisionWorkerRuntime(options = {}) {
  let currentDocument = null; let currentSourceHash = null;
  function parse(message) {
    currentDocument = JSON.parse(String(message.text ?? '')); currentSourceHash = String(message.sourceHash ?? '');
    const revision = readStagedRevision(currentDocument); return { ...revision, metadata: stagedDocumentMetadata(currentDocument) };
  }
  function filter(message) {
    if (!currentDocument) throw new Error('No staged revision is loaded in this worker.');
    return filterStagedDocument(currentDocument, message.scope ?? {});
  }
  async function project(message) {
    if (!currentDocument) throw new Error('No staged revision is loaded in this worker.');
    const request = message.request ?? {};
    if (request.sourceHash !== currentSourceHash) throw new Error('Approved basis source hash does not match the worker source.');
    const filtered = filterStagedDocument(currentDocument, { selectedIds: request.selectedBranchIds });
    if (!sameStrings(filtered.retainedBranchIds, request.selectedBranchIds)) throw new Error('Approved branches do not reconcile with worker scope.');
    const scopedHash = await sha256Text(JSON.stringify(filtered.filtered), options.cryptoRef ?? globalThis.crypto);
    if (scopedHash !== request.scopedHash) throw new Error('Approved scoped hash does not match the worker scope.');
    return projectCompareRecords(currentDocument, request);
  }
  function reset() { currentDocument = null; currentSourceHash = null; return {}; }
  async function handle(message) {
    if (message.type === 'parse') return parse(message);
    if (message.type === 'filter') return filter(message);
    if (message.type === 'projectCompareRecords') return project(message);
    if (message.type === 'reset') return reset();
    throw new Error(`Unknown revision worker request: ${message.type}`);
  }
  return Object.freeze({ handle });
}

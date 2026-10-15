/**
 * staged-json-worker.js — module worker that keeps multi-MB staged JSON
 * parsing and scope filtering off the main thread.
 *
 * Protocol (request → response, correlated by `id`):
 *   { id, type: 'parse', text }            → { id, ok, schema, stats, branchTree }
 *   { id, type: 'filter', scope }          → { id, ok, filtered, stats }   (uses last parsed doc)
 *   { id, type: 'reset' }                  → { id, ok }
 * Errors: { id, ok: false, error }
 */

import { readStagedBranches, buildBranchScopeTree, filterStagedByScope, stagedDocumentStats } from '../core/staged-json-core.js';

let currentDoc = null;

function handle(message) {
  const { id, type } = message;
  if (type === 'parse') {
    currentDoc = JSON.parse(String(message.text ?? ''));
    const { branches } = readStagedBranches(currentDoc);
    return { id, ok: true, schema: stagedDocumentStats(currentDoc).schema, stats: stagedDocumentStats(currentDoc), branchTree: buildBranchScopeTree(branches) };
  }
  if (type === 'filter') {
    if (!currentDoc) throw new Error('No staged document parsed yet.');
    const { filtered, stats } = filterStagedByScope(currentDoc, message.scope ?? {});
    return { id, ok: true, filtered, stats };
  }
  if (type === 'reset') {
    currentDoc = null;
    return { id, ok: true };
  }
  throw new Error(`Unknown staged-json-worker request type: ${type}`);
}

self.addEventListener('message', (event) => {
  const message = event.data ?? {};
  try {
    self.postMessage(handle(message));
  } catch (error) {
    self.postMessage({ id: message.id, ok: false, error: String(error?.message ?? error) });
  }
});

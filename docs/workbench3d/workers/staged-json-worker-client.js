/**
 * staged-json-worker-client.js — promise API over staged-json-worker.js.
 *
 * Falls back to synchronous in-process execution when module workers are
 * unavailable (Node tests, very old browsers); the pure logic is shared via
 * workbench3d/core/staged-json-core.js either way.
 */

import { readStagedBranches, buildBranchScopeTree, filterStagedByScope, stagedDocumentStats } from '../core/staged-json-core.js';

export function createStagedJsonClient() {
  let worker = null;
  let nextId = 1;
  const pending = new Map();
  let fallbackDoc = null;

  try {
    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./staged-json-worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event) => {
        const { id, ok, error, ...rest } = event.data ?? {};
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (ok) entry.resolve(rest);
        else entry.reject(new Error(error || 'staged-json worker request failed'));
      });
      worker.addEventListener('error', (event) => {
        for (const entry of pending.values()) entry.reject(new Error(event.message || 'staged-json worker crashed'));
        pending.clear();
      });
    }
  } catch {
    worker = null;
  }

  function request(message) {
    if (!worker) return Promise.resolve(runInline(message));
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    });
  }

  function runInline(message) {
    if (message.type === 'parse') {
      fallbackDoc = JSON.parse(String(message.text ?? ''));
      const { branches } = readStagedBranches(fallbackDoc);
      const stats = stagedDocumentStats(fallbackDoc);
      return { schema: stats.schema, stats, branchTree: buildBranchScopeTree(branches) };
    }
    if (message.type === 'filter') {
      if (!fallbackDoc) throw new Error('No staged document parsed yet.');
      return filterStagedByScope(fallbackDoc, message.scope ?? {});
    }
    if (message.type === 'reset') { fallbackDoc = null; return {}; }
    throw new Error(`Unknown staged-json request type: ${message.type}`);
  }

  return {
    /** Parse staged JSON text → { schema, stats, branchTree }. */
    parse(text) { return request({ type: 'parse', text }); },
    /** Filter the last parsed document → { filtered, stats }. */
    filter(scope) { return request({ type: 'filter', scope }); },
    reset() { return request({ type: 'reset' }); },
    dispose() {
      worker?.terminate();
      worker = null;
      pending.clear();
      fallbackDoc = null;
    },
  };
}

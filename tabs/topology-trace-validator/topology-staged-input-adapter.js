/**
 * topology-staged-input-adapter.js — makes managed-stage / staged JSON
 * (schema "inputxml-managed-stage/v1") a first-class Edit Draft input.
 *
 * The heavy lifting (branch reading, scope trees, filtering) is shared with
 * the staged-json worker via workbench3d/core/staged-json-core.js; this module
 * adds the trace-evidence shape the Edit Draft controller expects when a
 * staged file is loaded directly, without a prior Trace build.
 */

import {
  buildBranchScopeTree, filterStagedByScope, readStagedBranches, stagedDocumentStats,
} from '../../workbench3d/core/staged-json-core.js';

export { buildBranchScopeTree, filterStagedByScope, readStagedBranches, stagedDocumentStats };

/** Popup thresholds: below both, the scope popup is skipped and all loads. */
export const SCOPE_POPUP_COMPONENT_THRESHOLD = 500;
export const SCOPE_POPUP_BYTE_THRESHOLD = 5 * 1024 * 1024;

/** @param {number} componentCount @param {number} byteLength @returns {boolean} */
export function shouldOfferScopePopup(componentCount, byteLength) {
  return componentCount > SCOPE_POPUP_COMPONENT_THRESHOLD || byteLength > SCOPE_POPUP_BYTE_THRESHOLD;
}

/** Stable content hash for the edit-basis key (FNV-1a over the JSON text). */
function contentHash(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `staged-${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
}

/**
 * Build the minimal trace-evidence record `createTopologyEditController`
 * `initialize()` accepts. `hashes.canonical` stays empty so the pinned-hash
 * guard (which only fires for a loaded canonical) is skipped and the producer
 * core derives the canonical topology from the staged branches directly.
 */
export function buildTraceEvidenceFromStagedJson(parsedJson, { sourceName = 'staged-source.json' } = {}) {
  const { branches } = readStagedBranches(parsedJson);
  if (!branches.length) throw new TypeError('Staged JSON contains no branch objects (expected an array or {objects|hierarchy|branches:[…]}).');
  const text = JSON.stringify(branches);
  return Object.freeze({
    artifacts: Object.freeze({
      source: Object.freeze({ raw: parsedJson }),
      canonical: Object.freeze({}),
      ledger: Object.freeze({}),
    }),
    hashes: Object.freeze({ source: contentHash(text), canonical: '' }),
    fileNames: Object.freeze({ source: sourceName }),
  });
}

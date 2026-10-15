/**
 * Loads the pinned browser-safe topology producer packaged with this site.
 * GitHub Pages receives the same self-contained ESM artifact as local builds;
 * no runtime path to a sibling 3D_Converters checkout is used or attempted.
 */

import { runTopologyChecksWithAvailableAuthority } from './topology-checker-report.js';

const CORE_URL = new URL('../../vendor/3d-converters/topology-browser-core.mjs?v=20260718-cref-span-guard-v1', import.meta.url).href;
let corePromise = null;

/** @param {Record<string, unknown>} core @returns {Record<string, unknown>} */
function assertCoreContract(core) {
  const contract = core.TOPOLOGY_BROWSER_CORE_CONTRACT;
  if (contract?.schema !== 'TopologyBrowserCore.v1') {
    throw new TypeError(`Pinned topology core has an unsupported contract: ${contract?.schema ?? '(missing)'}.`);
  }
  for (const name of [
    'buildComponentTopologyArtifacts',
    'buildEditedComponentTopologyArtifacts',
    'topologyArtifactOutputs',
    'createTopologyEditDraft',
    'appendTopologyEditCommand',
    'appendTopologyEditTransaction',
    'undoTopologyEditCommand',
    'redoTopologyEditCommand',
    'runTopologyChecks',
    'buildTopologyFixSuggestions',
    'applyTopologyFixSuggestion',
    'applyApprovedTopologyFixes',
    'createTopologyReviewState',
    'setTopologyIssueStatus',
    'topologyReviewSummary',
  ]) {
    if (typeof core[name] !== 'function') throw new TypeError(`Pinned topology core is missing ${name}().`);
  }
  return Object.freeze({
    ...core,
    runTopologyChecks: (canonical, options) => runTopologyChecksWithAvailableAuthority(core, canonical, options),
  });
}

/** @returns {Promise<Record<string, unknown>>} */
export function loadTopologyProducerCore() {
  if (!corePromise) corePromise = import(CORE_URL).then(assertCoreContract).catch((error) => {
    corePromise = null;
    throw new Error(`Pinned topology browser core failed to load from ${CORE_URL}: ${error?.message || String(error)}`);
  });
  return corePromise;
}

export const TOPOLOGY_PRODUCER_CORE_URL = CORE_URL;
export const _test = Object.freeze({ assertCoreContract });

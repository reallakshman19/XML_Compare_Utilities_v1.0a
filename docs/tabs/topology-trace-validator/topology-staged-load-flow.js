/** Worker-parse staged JSON, retain full analysis, then request Draft scope. */

import { createStagedJsonClient } from '../../workbench3d/workers/staged-json-worker-client.js';

function setEditStatus(root, message, status) {
  const target = root.querySelector('[data-ttv-edit-status]');
  if (target) { target.textContent = message; target.setAttribute('data-status', status); }
}

/**
 * @param {ParentNode} root workspace root
 * @param {Record<string, unknown>} controller workspace controller
 * @param {File} file managed-stage JSON file
 * @param {{buildFullTopology:()=>Promise<void>}} dependencies full analysis builder
 * @returns {Promise<void>}
 */
export async function loadStagedJsonScoped(root, controller, file, dependencies) {
  if (typeof dependencies?.buildFullTopology !== 'function') throw new TypeError('Staged load requires buildFullTopology().');
  const client = createStagedJsonClient();
  try {
    setEditStatus(root, `Parsing ${file.name} off the main thread…`, 'ready');
    const text = await file.text();
    const { stats } = await client.parse(text);
    setEditStatus(root, `Building full analysis topology from ${stats.branchCount} branches / ${stats.componentCount} components…`, 'ready');
    await controller.loadArtifact('source', text, file.name);
    await dependencies.buildFullTopology();
    const opened = await controller.activateTab('edit', root);
    setEditStatus(root, opened
      ? 'Full Trace/Checker loaded; Draft Edit uses the selected branch scope. Export remains full-model.'
      : 'Full Trace/Checker loaded. Draft scope selection was cancelled; documented export remains available.', 'pass');
  } finally { client.dispose(); }
}

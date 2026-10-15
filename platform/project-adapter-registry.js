/** Central registry of native project adapters available to the shared platform. */

import { pipelineCadProjectAdapter } from '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js';
import { sequentialSketcherProjectAdapter } from '../tabs/sequential-sketcher/sequential-sketcher-project-adapter.js';
import { supportSteelProjectAdapter } from '../tabs/support-steel-relationship-builder/support-steel-project-adapter.js';
import { topologyProjectAdapter } from '../tabs/topology-trace-validator/topology-project-migration.js';
import { compareWorkbenchProjectAdapter } from '../workbench3d/project/compare-workbench-project-adapter.js';

const ADAPTERS = Object.freeze([
  topologyProjectAdapter, pipelineCadProjectAdapter, sequentialSketcherProjectAdapter,
  supportSteelProjectAdapter, compareWorkbenchProjectAdapter,
]);

function validateAdapter(adapter) {
  const errors = [];
  for (const key of ['projectId', 'sourceSchema', 'writerId']) {
    if (!String(adapter?.[key] ?? '').trim()) errors.push(`${key} is required`);
  }
  if (typeof adapter?.buildMigration !== 'function') errors.push('buildMigration must be a function');
  return errors;
}

/** List immutable capability descriptors for project migration discovery. */
export function listProjectAdapters() {
  return ADAPTERS;
}

/** Resolve one project adapter or fail with the available project IDs. */
export function getProjectAdapter(projectId) {
  const adapter = ADAPTERS.find((candidate) => candidate.projectId === projectId);
  if (!adapter) throw new Error(`Unknown project adapter ${projectId}; available: ${ADAPTERS.map((row) => row.projectId).join(', ')}.`);
  const errors = validateAdapter(adapter);
  if (errors.length) throw new TypeError(`Invalid project adapter ${projectId}: ${errors.join('; ')}`);
  return adapter;
}

/** Validate uniqueness and required descriptor capabilities. */
export function validateProjectAdapterRegistry() {
  const errors = ADAPTERS.flatMap((adapter) => validateAdapter(adapter).map((error) => `${adapter?.projectId || 'UNKNOWN'}: ${error}`));
  const ids = ADAPTERS.map((adapter) => adapter.projectId);
  if (new Set(ids).size !== ids.length) errors.push('projectId values must be unique');
  return Object.freeze(errors);
}

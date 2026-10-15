/**
 * staged-json-core.js — pure helpers for managed-stage / staged JSON files
 * (schema "inputxml-managed-stage/v1" and shape-compatible documents).
 *
 * Everything here is DOM-free and Three-free so it runs identically in the
 * staged-json worker, on the main thread as a fallback, and in Node tests.
 *
 * Supported root shapes (matching topology-source-reader.js):
 *   [ ...branches ] | { objects: [...] } | { hierarchy: [...] } | { branches: [...] }
 */

import { scopeRegex } from './scope-pattern.js';

/** @returns {{ branches: Array<Record<string, unknown>>, rootKey: string|null, schema: string }} */
export function readStagedBranches(doc) {
  if (Array.isArray(doc)) return { branches: doc, rootKey: null, schema: '' };
  const record = doc && typeof doc === 'object' ? doc : {};
  for (const key of ['hierarchy', 'branches', 'objects']) {
    if (Array.isArray(record[key])) return { branches: record[key], rootKey: key, schema: String(record.schema ?? '') };
  }
  return { branches: [], rootKey: null, schema: String(record.schema ?? '') };
}

function attrs(branch) {
  const value = branch?.attributes;
  return value && typeof value === 'object' ? value : {};
}

function text(value) {
  return typeof value === 'string' ? value.trim() : (value === null || value === undefined ? '' : String(value).trim());
}

/** Identity text a wildcard scope pattern matches against (name + owner + site). */
export function branchScopeText(branch) {
  const a = attrs(branch);
  return [text(branch?.name), text(a.NAME), text(a.OWNER), text(a.OWNER_SITE)].filter(Boolean).join(' ');
}

function branchKey(branch, index) {
  return text(branch?.name) || text(attrs(branch).NAME) || `#${index}`;
}

/** Scope ids that select this branch: its own id plus every ancestor id. */
export function branchScopeIds(branch, index) {
  const a = attrs(branch);
  const site = text(a.OWNER_SITE);
  const owner = text(a.OWNER);
  const ids = [`branch:${branchKey(branch, index)}`];
  if (owner) ids.push(`owner:${site}|${owner}`);
  if (site) ids.push(`site:${site}`);
  return ids;
}

/**
 * SITE → OWNER → BRANCH tree for the scope popup. Levels with no data are
 * collapsed (a flat branch list still renders under a single root).
 * Node: { id, kind: 'SITE'|'OWNER'|'BRANCH', label, branchCount, children }
 */
export function buildBranchScopeTree(branches) {
  const sites = new Map();
  branches.forEach((branch, index) => {
    const a = attrs(branch);
    const siteLabel = text(a.OWNER_SITE) || '(no site)';
    const ownerLabel = text(a.OWNER) || '(no owner)';
    const siteId = `site:${text(a.OWNER_SITE)}`;
    const ownerId = `owner:${text(a.OWNER_SITE)}|${text(a.OWNER)}`;
    if (!sites.has(siteId)) sites.set(siteId, { id: siteId, kind: 'SITE', label: siteLabel, branchCount: 0, children: new Map() });
    const site = sites.get(siteId);
    if (!site.children.has(ownerId)) site.children.set(ownerId, { id: ownerId, kind: 'OWNER', label: ownerLabel, branchCount: 0, children: new Map() });
    const owner = site.children.get(ownerId);
    const key = branchKey(branch, index);
    const componentCount = Array.isArray(branch?.children) ? branch.children.length : 0;
    owner.children.set(`branch:${key}`, {
      id: `branch:${key}`, kind: 'BRANCH', label: key, branchCount: 1, componentCount, children: new Map(),
    });
    owner.branchCount += 1;
    site.branchCount += 1;
  });
  const toArray = (map) => [...map.values()].map((node) => ({ ...node, children: toArray(node.children) }));
  return toArray(sites);
}

/**
 * Filter a staged document by { wildcard, selectedIds }. A branch is kept when
 * its id (or an ancestor id) is selected OR the wildcard matches its scope
 * text; an empty scope keeps everything. Returns a document of the same root
 * shape plus stats — the contract mirrors 3D_Converters'
 * _filterStagedHierarchyByScope ({ scanned, matched, filtered }).
 */
export function filterStagedByScope(doc, scope = {}) {
  const { branches, rootKey, schema } = readStagedBranches(doc);
  const wildcard = text(scope.wildcard);
  const selected = new Set(Array.isArray(scope.selectedIds) ? scope.selectedIds : []);
  const regex = wildcard ? scopeRegex(wildcard) : null;
  const noScope = !regex && !selected.size;
  const kept = [];
  branches.forEach((branch, index) => {
    const match = noScope
      || branchScopeIds(branch, index).some((id) => selected.has(id))
      || (regex ? regex.test(branchScopeText(branch)) : false);
    if (match) kept.push(branch);
  });
  const stats = { scanned: branches.length, matched: kept.length, filtered: branches.length - kept.length };
  let filtered;
  if (Array.isArray(doc)) filtered = kept;
  else if (rootKey) filtered = { ...doc, [rootKey]: kept };
  else filtered = { schema: schema || 'inputxml-managed-stage/v1', objects: kept };
  return { filtered, stats };
}

/** Cheap census used for popup thresholds and load messaging. */
export function stagedDocumentStats(doc) {
  const { branches, schema } = readStagedBranches(doc);
  let components = 0;
  const componentTypes = {};
  for (const branch of branches) {
    for (const child of Array.isArray(branch?.children) ? branch.children : []) {
      components += 1;
      const type = text(child?.type) || '?';
      componentTypes[type] = (componentTypes[type] ?? 0) + 1;
    }
  }
  return { schema, branchCount: branches.length, componentCount: components, componentTypes };
}

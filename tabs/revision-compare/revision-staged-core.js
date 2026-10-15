/** Pure staged-revision readers used by the RC-001 worker and tests. */

import { cleanText, deepFreeze, frozenStrings } from './revision-contract-utils.js';

export const SUPPORTED_STAGED_ROOTS = Object.freeze(['array', 'objects', 'hierarchy', 'branches']);

function objectRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function branchCollection(document) {
  if (Array.isArray(document)) return { branches: document, rootShape: 'array', rootKey: null };
  const root = objectRecord(document);
  for (const key of ['objects', 'hierarchy', 'branches']) {
    if (Array.isArray(root[key])) return { branches: root[key], rootShape: key, rootKey: key };
  }
  throw new TypeError('Unsupported staged JSON root; expected array, objects, hierarchy, or branches.');
}

function attributes(branch) {
  return objectRecord(branch?.attributes);
}

export function exactBranchName(branch) {
  return cleanText(branch?.name) || cleanText(attributes(branch).NAME);
}

export function exactBranchId(branch) {
  const name = exactBranchName(branch);
  if (!name) throw new TypeError('Every staged branch requires an exact name or attributes.NAME value.');
  return `branch:${name}`;
}

function componentList(branch) {
  if (Array.isArray(branch?.children)) return branch.children;
  if (Array.isArray(branch?.components)) return branch.components;
  return [];
}

function hasGeometryEvidence(component) {
  const record = objectRecord(component);
  const attrs = attributes(component);
  const keys = ['position', 'start', 'end', 'points', 'coordinates', 'APOS', 'LPOS', 'POS'];
  return keys.some((key) => record[key] !== undefined || attrs[key] !== undefined);
}

function branchEntry(branch) {
  const attrs = attributes(branch);
  const components = componentList(branch);
  return deepFreeze({
    branchId: exactBranchId(branch),
    label: exactBranchName(branch),
    site: cleanText(attrs.OWNER_SITE),
    owner: cleanText(attrs.OWNER),
    componentCount: components.length,
    recordCount: components.length,
    geometryEvidenceCount: components.filter(hasGeometryEvidence).length,
  });
}

export function buildBranchIndex(document) {
  const { branches } = branchCollection(document);
  const entries = branches.map(branchEntry);
  const ids = entries.map((entry) => entry.branchId);
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate exact branch identities are not supported.');
  return Object.freeze(entries.sort((left, right) => left.branchId.localeCompare(right.branchId)));
}

function treeNode(id, kind, label) {
  return { id, kind, label, branchCount: 0, componentCount: 0, children: new Map() };
}

function addTreeEntry(sites, entry) {
  const siteId = `site:${entry.site}`;
  const ownerId = `owner:${entry.site}|${entry.owner}`;
  if (!sites.has(siteId)) sites.set(siteId, treeNode(siteId, 'SITE', entry.site || '(no site)'));
  const site = sites.get(siteId);
  if (!site.children.has(ownerId)) site.children.set(ownerId, treeNode(ownerId, 'OWNER', entry.owner || '(no owner)'));
  const owner = site.children.get(ownerId);
  owner.children.set(entry.branchId, { ...entry, id: entry.branchId, kind: 'BRANCH', children: new Map() });
  owner.branchCount += 1;
  owner.componentCount += entry.componentCount;
  site.branchCount += 1;
  site.componentCount += entry.componentCount;
}

function treeArray(nodes) {
  return [...nodes.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => deepFreeze({ ...node, children: treeArray(node.children) }));
}

export function buildBranchTree(branchIndex) {
  const sites = new Map();
  branchIndex.forEach((entry) => addTreeEntry(sites, entry));
  return Object.freeze(treeArray(sites));
}

function globRegex(pattern) {
  const escaped = cleanText(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return escaped ? new RegExp(escaped, 'i') : null;
}

function selectedBranchIds(branchIndex, scope) {
  const requested = frozenStrings(scope?.selectedIds);
  if (requested.length) return new Set(requested);
  const matcher = globRegex(scope?.wildcard);
  if (matcher) return new Set(branchIndex.filter((entry) => matcher.test(`${entry.label} ${entry.site} ${entry.owner}`)).map((entry) => entry.branchId));
  return new Set(branchIndex.map((entry) => entry.branchId));
}

function rebuildDocument(document, rootKey, kept) {
  if (Array.isArray(document)) return kept;
  return { ...document, [rootKey]: kept };
}

export function filterStagedDocument(document, scope = {}) {
  const { branches, rootKey } = branchCollection(document);
  const index = buildBranchIndex(document);
  const selected = selectedBranchIds(index, scope);
  const kept = branches.filter((branch) => selected.has(exactBranchId(branch)));
  const keptIds = index.filter((entry) => selected.has(entry.branchId)).map((entry) => entry.branchId);
  const filtered = rebuildDocument(document, rootKey, kept);
  return deepFreeze({
    filtered,
    retainedBranchIds: frozenStrings(keptIds),
    stats: stagedDocumentStats(filtered, branches.length),
  });
}

export function stagedDocumentStats(document, scannedOverride) {
  const { branches, rootShape } = branchCollection(document);
  const index = buildBranchIndex(document);
  const componentCount = index.reduce((sum, entry) => sum + entry.componentCount, 0);
  const geometryEvidenceCount = index.reduce((sum, entry) => sum + entry.geometryEvidenceCount, 0);
  const scanned = Number.isInteger(scannedOverride) ? scannedOverride : branches.length;
  return deepFreeze({
    rootShape,
    branchCount: branches.length,
    componentCount,
    recordCount: componentCount,
    geometryEvidenceCount,
    scanned,
    matched: branches.length,
    filtered: Math.max(0, scanned - branches.length),
  });
}

export function readStagedRevision(document) {
  const index = buildBranchIndex(document);
  return deepFreeze({
    rootShape: branchCollection(document).rootShape,
    branchIndex: index,
    branchTree: buildBranchTree(index),
    stats: stagedDocumentStats(document),
  });
}

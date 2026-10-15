/** Large-model mode and branch-scoped Draft canvas projections. */

import { filterStagedByScope, readStagedBranches } from '../../workbench3d/core/staged-json-core.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const DEFAULT_LARGE_MODEL_ELEMENT_THRESHOLD = 200;
export const LARGE_MODEL_THRESHOLD_STORAGE_KEY = 'xml-compare.topology.large-model-element-threshold.v1';

/** Invalid persisted input falls back explicitly to the approved 200-element policy. */
export function normalizeLargeModelThreshold(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LARGE_MODEL_ELEMENT_THRESHOLD;
}

export function readLargeModelThreshold(storage) {
  return normalizeLargeModelThreshold(storage?.getItem(LARGE_MODEL_THRESHOLD_STORAGE_KEY));
}

export function writeLargeModelThreshold(storage, value) {
  const threshold = normalizeLargeModelThreshold(value);
  storage?.setItem(LARGE_MODEL_THRESHOLD_STORAGE_KEY, String(threshold));
  return threshold;
}

/** Mode is decided from canonical route elements, not raw source records. */
export function topologyModelMode(canonical, thresholdValue) {
  const threshold = normalizeLargeModelThreshold(thresholdValue);
  const elementCount = asArray(objectRecord(canonical).edges).length;
  const large = elementCount > threshold;
  return Object.freeze({ kind: large ? 'LARGE_SCOPED' : 'SMALL_FULL', elementCount, threshold, requiresScope: large });
}

function branchSelectionId(branch, index) {
  const record = objectRecord(branch), attributes = objectRecord(record.attributes);
  return `branch:${cleanText(record.name) || cleanText(attributes.NAME) || `#${index}`}`;
}

/** Resolve one popup selection to immutable source branch indexes and records. */
export function createTopologyEditScope(sourceRaw, selection) {
  const original = readStagedBranches(sourceRaw).branches;
  const result = filterStagedByScope(sourceRaw, selection);
  const selected = new Set(readStagedBranches(result.filtered).branches);
  const sourceBranchIndexes = original.flatMap((branch, index) => selected.has(branch) ? [index] : []);
  if (!sourceBranchIndexes.length) throw new Error('Draft Edit scope must contain at least one branch.');
  return Object.freeze({
    schema: 'TopologyEditScope.v1', wildcard: cleanText(selection.wildcard),
    selectedIds: Object.freeze(asArray(selection.selectedIds).map(cleanText).filter(Boolean)),
    sourceBranchIndexes: Object.freeze(sourceBranchIndexes),
    sourceBranches: Object.freeze(sourceBranchIndexes.map((index) => original[index])),
    stats: Object.freeze({ ...result.stats }),
  });
}

/** Empty render scope used while model-wide Auto fix edits a large draft without mounting its geometry. */
export function createHeadlessTopologyEditScope() {
  return Object.freeze({
    schema: 'TopologyEditScope.v1', purpose: 'AUTO_FIX_HEADLESS', wildcard: '',
    selectedIds: Object.freeze([]), sourceBranchIndexes: Object.freeze([]),
    sourceBranches: Object.freeze([]), stats: Object.freeze({ matched: 0 }),
  });
}

function sourcePathBelongs(path, indexes) {
  const value = cleanText(path);
  return indexes.some((index) => value === `$[${index}]` || value.startsWith(`$[${index}].`) || value.startsWith(`$[${index}][`));
}

function belongsToScope(row, indexes) {
  return asArray(objectRecord(row).sourcePaths).some((path) => sourcePathBelongs(path, indexes));
}

function referencedIds(row) {
  const record = objectRecord(row);
  const singular = ['nodeId', 'fromNodeId', 'toNodeId', 'edgeId', 'supportId', 'junctionId', 'boundaryId'];
  const plural = ['nodeIds', 'edgeIds', 'objectIds', 'supportIds'];
  return [...singular.map((key) => cleanText(record[key])), ...plural.flatMap((key) => asArray(record[key]).map(cleanText))].filter(Boolean);
}

function scopedRelatedRows(rows, indexes, includedIds) {
  return Object.freeze(asArray(rows).filter((row) => belongsToScope(row, indexes)
    || referencedIds(row).some((id) => includedIds.has(id))));
}

/** Filter only the Draft canvas view; the full canonical remains authoritative. */
export function scopeCanonicalForDraft(canonical, scope) {
  if (!scope) return canonical;
  const record = objectRecord(canonical), indexes = asArray(scope.sourceBranchIndexes).map(Number);
  const edges = Object.freeze(asArray(record.edges).filter((row) => belongsToScope(row, indexes)));
  const nodeIds = new Set(edges.flatMap((row) => [cleanText(row.fromNodeId), cleanText(row.toNodeId)]));
  const nodes = Object.freeze(asArray(record.nodes).filter((row) => nodeIds.has(cleanText(row.id)) || belongsToScope(row, indexes)));
  const includedIds = new Set([...edges, ...nodes].map((row) => cleanText(row.id)).filter(Boolean));
  const relatedKeys = ['supports', 'rigids', 'junctions', 'boundaries', 'bends', 'pointFeatures'];
  const related = Object.fromEntries(relatedKeys.map((key) => [key, scopedRelatedRows(record[key], indexes, includedIds)]));
  for (const rows of Object.values(related)) for (const row of rows) includedIds.add(cleanText(row.id));
  return Object.freeze({ ...record, nodes, edges, ...related,
    buildIssues: scopedRelatedRows(record.buildIssues, indexes, includedIds) });
}

export function scopeValidationForDraft(validation, scopedCanonical) {
  if (!validation || !scopedCanonical) return validation;
  const ids = new Set(['nodes', 'edges', 'supports', 'rigids', 'junctions', 'boundaries', 'bends']
    .flatMap((key) => asArray(scopedCanonical[key]).map((row) => cleanText(objectRecord(row).id))).filter(Boolean));
  const findings = Object.freeze(asArray(validation.findings).filter((row) => {
    const objectIds = asArray(objectRecord(row).objectIds).map(cleanText).filter(Boolean);
    return !objectIds.length || objectIds.some((id) => ids.has(id));
  }));
  return Object.freeze({ ...validation, findings });
}

function suggestionTargetIds(suggestions) {
  const ids = [];
  for (const suggestion of asArray(suggestions)) for (const operation of asArray(objectRecord(suggestion).operations)) {
    const payload = objectRecord(objectRecord(operation).payload);
    for (const [key, value] of Object.entries(payload)) {
      if (/Id$/.test(key)) ids.push(cleanText(value));
      if (/Ids$/.test(key)) ids.push(...asArray(value).map(cleanText));
    }
  }
  return new Set(ids.filter(Boolean));
}

/** Source branch indexes touched by suggestion operation targets. */
export function suggestionBranchIndexes(canonical, suggestions) {
  const targets = suggestionTargetIds(suggestions), indexes = new Set();
  const rows = ['nodes', 'edges', 'supports', 'rigids', 'junctions', 'boundaries', 'bends']
    .flatMap((key) => asArray(objectRecord(canonical)[key]));
  for (const row of rows) {
    if (!targets.has(cleanText(objectRecord(row).id))) continue;
    for (const path of asArray(objectRecord(row).sourcePaths)) {
      const match = cleanText(path).match(/^\$\[(\d+)\]/);
      if (match) indexes.add(Number(match[1]));
    }
  }
  return Object.freeze([...indexes].sort((left, right) => left - right));
}

export function branchSelectionIdsForIndexes(sourceRaw, indexes) {
  const branches = readStagedBranches(sourceRaw).branches;
  return Object.freeze(asArray(indexes).map(Number).filter((index) => branches[index])
    .map((index) => branchSelectionId(branches[index], index)));
}

export function scopeContainsBranchIndexes(scope, requiredIndexes) {
  const selected = new Set(asArray(scope?.sourceBranchIndexes).map(Number));
  return asArray(requiredIndexes).map(Number).every((index) => selected.has(index));
}

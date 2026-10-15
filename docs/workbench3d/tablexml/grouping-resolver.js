/**
 * grouping-resolver.js — duplicate-coordinate detection and row grouping (pure).
 *
 * Reuses the repo's coordinate clusterer for tolerance-based duplicate
 * detection, suggests grouping-basis columns (columns constant within every
 * multi-row cluster), and merges grouped rows with a configurable separator.
 */

import { createCoordinateClusterState, assignCoordinateCluster } from '../../xml-compare/table-categorizer/table-categorized-xml-coordinate-cluster.js';
import { extractNumber, extractAxisComponents, combinedRules, UNIT_SCALES } from './text-to-number.js';

/**
 * Extract an {e,n,u} point (mm) per row from the mapping's coordinate columns.
 * @returns [{ rowId, row, point: {e,n,u}|null, issues: [] }]
 */
export function extractPoints(source, mapping, customRules = []) {
  const rules = combinedRules(customRules);
  const byRole = (role) => mapping.columns.find((c) => c.role === role);
  const combined = byRole('coord-combined');
  const axisCols = { e: byRole('coord-e'), n: byRole('coord-n'), u: byRole('coord-u') };
  return (source?.rows ?? []).map((row) => {
    const issues = [];
    const point = {};
    if (combined) {
      Object.assign(point, extractAxisComponents(row.rawByColumnId[combined.columnId]));
    }
    for (const [axis, col] of Object.entries(axisCols)) {
      if (!col) continue;
      const raw = row.rawByColumnId[col.columnId];
      const result = extractNumber(raw, rules);
      if (!result.ok) {
        if (point[axis] === undefined) issues.push(`${axis}: cannot extract from "${raw}"`);
        continue;
      }
      // unit-suffixed rules already scale to mm; unitless values use the column unit
      point[axis] = result.unit ? result.value : result.value * (UNIT_SCALES[col.unit] ?? 1);
    }
    const complete = ['e', 'n', 'u'].every((axis) => Number.isFinite(point[axis]));
    return { rowId: row.rowId, row, point: complete ? { e: point.e, n: point.n, u: point.u } : null, issues };
  });
}

/**
 * Cluster rows by coordinate within tolerance; suggest grouping-basis columns.
 * @returns { clusters: [{ clusterId, rowIds, point }], suggestions: { basisColumnIds }, diagnostics }
 */
export function resolveGroups(source, mapping, customRules = []) {
  const points = extractPoints(source, mapping, customRules);
  const state = createCoordinateClusterState({ tolerance: mapping.grouping?.toleranceMm ?? 2 });
  const byCluster = new Map();
  const diagnostics = [];
  for (const entry of points) {
    if (!entry.point) {
      diagnostics.push({ rowId: entry.rowId, message: entry.issues.join('; ') || 'no coordinate' });
      continue;
    }
    // adapt to the clusterer's row shape (reads rawByHeader[X/Y/Z])
    const result = assignCoordinateCluster(state, {
      rowId: entry.rowId,
      rawByHeader: { X: String(entry.point.e), Y: String(entry.point.n), Z: String(entry.point.u) },
    });
    const clusterId = result?.ok ? result.value : null;
    if (!clusterId) {
      diagnostics.push({ rowId: entry.rowId, message: result?.diagnostics?.[0]?.message ?? 'cluster assignment failed' });
      continue;
    }
    if (!byCluster.has(clusterId)) byCluster.set(clusterId, { clusterId, rowIds: [], point: entry.point });
    byCluster.get(clusterId).rowIds.push(entry.rowId);
  }
  const clusters = [...byCluster.values()];
  const multiClusters = clusters.filter((c) => c.rowIds.length > 1);

  // Basis suggestions: columns whose value is constant inside every multi-row cluster.
  const rowById = new Map((source?.rows ?? []).map((r) => [r.rowId, r]));
  const basisColumnIds = [];
  for (const col of mapping.columns) {
    if (['ignore', 'coord-e', 'coord-n', 'coord-u', 'coord-combined'].includes(col.role)) continue;
    const constantEverywhere = multiClusters.length > 0 && multiClusters.every((cluster) => {
      const values = new Set(cluster.rowIds.map((rowId) => String(rowById.get(rowId)?.rawByColumnId[col.columnId] ?? '').trim()));
      return values.size === 1;
    });
    if (constantEverywhere) basisColumnIds.push(col.columnId);
  }
  return {
    clusters,
    duplicateClusters: multiClusters.length,
    suggestions: { basisColumnIds },
    diagnostics,
  };
}

/** Merge rows of one cluster: distinct values per column joined by separator. */
export function mergeGroupedRows(rows, mapping) {
  const separator = mapping.grouping?.separator ?? '|';
  const merged = { rowId: rows.map((r) => r.rowId).join('+'), rawByColumnId: {} };
  for (const col of mapping.columns) {
    const distinct = [...new Set(rows.map((r) => String(r.rawByColumnId[col.columnId] ?? '').trim()).filter(Boolean))];
    merged.rawByColumnId[col.columnId] = distinct.join(separator);
  }
  return merged;
}

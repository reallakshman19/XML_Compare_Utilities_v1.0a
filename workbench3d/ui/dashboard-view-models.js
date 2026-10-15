/**
 * dashboard-view-models.js — pure models for the Dashboard view (W2).
 *
 * Universal naming per the vision doc: Node / Total / Matched / Added /
 * Deleted / Changed / Review. Every widget model carries the DrilldownContext
 * filter it should emit when clicked — the UI never invents its own filters.
 */

import { DIFF_STATUS } from '../contracts/contracts.js';
import { resolveDrilldownRows, createDrilldownContext, STATUS_SEVERITY } from './drilldown.js';
import { stripModelPrefix } from './panel-view-models.js';

const CHANGED_STATUSES = Object.freeze([DIFF_STATUS.PROPERTY_CHANGED, DIFF_STATUS.GEOMETRY_CHANGED, DIFF_STATUS.SPLIT, DIFF_STATUS.MERGE]);
const REVIEW_STATUSES = Object.freeze([DIFF_STATUS.AMBIGUOUS, DIFF_STATUS.CONFLICT]);

/** KPI story strip: Total | Matched | Added | Deleted | Changed | Review. */
export function kpiStripModel(audit) {
  if (!audit) return [];
  const s = audit.summary;
  const rows = audit.objectDiff.rows;
  const count = (statuses) => rows.filter((r) => statuses.includes(r.status)).length;
  return [
    { id: 'total', label: 'Total', value: rows.length, filter: {} },
    { id: 'matched', label: 'Matched', value: s.matchedElements, filter: { status: [DIFF_STATUS.MATCHED_UNCHANGED, ...CHANGED_STATUSES.slice(0, 2)] } },
    { id: 'added', label: 'Added', value: s.newInTarget, filter: { status: [DIFF_STATUS.NEW_IN_TARGET] } },
    { id: 'deleted', label: 'Deleted', value: s.missingInTarget, filter: { status: [DIFF_STATUS.MISSING_IN_TARGET] } },
    { id: 'changed', label: 'Changed', value: count(CHANGED_STATUSES), filter: { status: [...CHANGED_STATUSES] } },
    { id: 'review', label: 'Review', value: count(REVIEW_STATUSES), filter: { status: [...REVIEW_STATUSES] } },
  ];
}

/** Review queue: non-zero exception groups, most severe first. */
export function reviewQueueModel(audit) {
  if (!audit) return [];
  const rows = audit.objectDiff.rows;
  const entries = [];
  const push = (id, label, severity, predicate, filter) => {
    const matching = rows.filter(predicate);
    if (matching.length) entries.push({ id, label, severity, count: matching.length, filter: filter ?? { diffIds: matching.map((r) => r.diffId) } });
  };
  push('critical-load', 'Critical load (Δ ≥ 25%)', 'HIGH', (r) => (r.loadDeltaPct ?? 0) >= 25);
  push('ambiguous', 'Ambiguous', 'HIGH', (r) => r.status === DIFF_STATUS.AMBIGUOUS, { status: [DIFF_STATUS.AMBIGUOUS] });
  push('deleted', 'Deleted', 'MEDIUM', (r) => r.status === DIFF_STATUS.MISSING_IN_TARGET, { status: [DIFF_STATUS.MISSING_IN_TARGET] });
  push('added', 'Added', 'MEDIUM', (r) => r.status === DIFF_STATUS.NEW_IN_TARGET, { status: [DIFF_STATUS.NEW_IN_TARGET] });
  push('geometry', 'Geometry changed', 'MEDIUM', (r) => r.status === DIFF_STATUS.GEOMETRY_CHANGED, { status: [DIFF_STATUS.GEOMETRY_CHANGED] });
  push('load-changed', 'Load changed', 'MEDIUM', (r) => (r.loadDeltaPct ?? 0) > 0.01);
  push('flagged', 'Remark flagged', 'MEDIUM', (r) => r.remarkFlags?.length);
  push('modified', 'Property changed', 'LOW', (r) => r.status === DIFF_STATUS.PROPERTY_CHANGED, { status: [DIFF_STATUS.PROPERTY_CHANGED] });
  push('weak', 'Weak matches (LOW)', 'LOW', (r) => r.confidence === 'LOW', { confidence: ['LOW'] });
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return entries.sort((a, b) => rank[b.severity] - rank[a.severity] || b.count - a.count);
}

function groupKeyOf(object, groupBy) {
  if (!object) return '(unknown)';
  if (groupBy === 'parent') return object.properties?.PARENT || object.lineId || '(model)';
  if (groupBy === 'tag') return object.properties?.TAG || object.lineId || '(model)';
  return object.lineId || '(model)';
}

/**
 * Group × Status heatmap grid.
 * @returns { groups, statuses, cells: Map<'group|status', {count, diffIds}>, maxCount }
 */
export function heatmapModel(audit, graphs, groupBy = 'line') {
  const objectIndex = new Map();
  for (const graph of [graphs?.A, graphs?.B]) {
    for (const object of graph?.objects ?? []) objectIndex.set(object.objectId, object);
  }
  const statuses = [...new Set((audit?.objectDiff?.rows ?? []).map((r) => r.status))]
    .sort((a, b) => (STATUS_SEVERITY[b] ?? 0) - (STATUS_SEVERITY[a] ?? 0));
  const cells = new Map();
  const groupTotals = new Map();
  for (const row of audit?.objectDiff?.rows ?? []) {
    const object = objectIndex.get(row.sourceObjectId) ?? objectIndex.get(row.targetObjectId);
    const group = groupKeyOf(object, groupBy);
    const key = `${group}|${row.status}`;
    if (!cells.has(key)) cells.set(key, { group, status: row.status, count: 0, diffIds: [] });
    const cell = cells.get(key);
    cell.count += 1;
    cell.diffIds.push(row.diffId);
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + 1);
  }
  const groups = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  const maxCount = Math.max(1, ...[...cells.values()].map((c) => c.count));
  return { groups, statuses, cells, maxCount };
}

/** Top exception cards: worst N non-unchanged rows, severity first. */
export function exceptionCardsModel(audit, graphs, limit = 6) {
  const context = createDrilldownContext({ widgetType: 'EXCEPTION_CARD', domain: 'GENERIC_NODE', title: 'exceptions', filter: {} });
  return resolveDrilldownRows(context, audit, graphs)
    .filter((row) => row.status !== DIFF_STATUS.MATCHED_UNCHANGED)
    .slice(0, limit)
    .map((row) => ({
      diffId: row.diffId,
      title: row.target && row.source ? `${row.source} ↔ ${row.target}` : (row.source || row.target || row.diffId),
      status: row.status,
      severity: row.severity,
      badges: [
        row.confidence && row.confidence !== 'NONE' ? row.confidence : null,
        row.positionDeltaMm !== null ? `Δ ${row.positionDeltaMm.toFixed(1)}mm` : null,
        row.loadDeltaPct !== null && row.loadDeltaPct > 0 ? `load Δ ${row.loadDeltaPct.toFixed(0)}%` : null,
      ].filter(Boolean),
      detail: row.detail,
      objectId: row.objectId,
    }));
}

/**
 * Auto visual-mode selection (vision doc §4): coordinates → node map,
 * from/to topology → 3D overlay, many groups → heatmap emphasis.
 */
export function autoVisualMode(audit, graphs) {
  const nodeWise = audit?.compareKind === 'node-wise';
  const groupCount = new Set((graphs?.A?.objects ?? []).map((o) => groupKeyOf(o, 'parent'))).size;
  if (nodeWise && groupCount > 12) return { mode: 'heatmap', reason: `${groupCount} groups — heatmap first` };
  if (nodeWise) return { mode: 'node-map', reason: 'coordinate nodes — node map (3D markers) first' };
  return { mode: '3d-overlay', reason: 'element topology — 3D overlay first' };
}

export { stripModelPrefix };

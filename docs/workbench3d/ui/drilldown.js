/**
 * drilldown.js — DrilldownContext.v1 creation and row resolution (pure).
 *
 * Every visual widget (KPI tile, alert, pivot cell, heatmap cell, …) emits the
 * same context object; this module resolves it against the CompareAudit into
 * severity-sorted preview rows. No DOM — fully Node-testable.
 */

import { CONTRACT_VERSIONS } from '../contracts/contracts.js';
import { stripModelPrefix } from './panel-view-models.js';

/** Higher = reviewed first. */
export const STATUS_SEVERITY = Object.freeze({
  CONFLICT: 90,
  AMBIGUOUS: 80,
  GEOMETRY_CHANGED: 70,
  MISSING_IN_TARGET: 60,
  NEW_IN_TARGET: 55,
  SPLIT: 50,
  MERGE: 50,
  CONSUMED: 45,
  PROPERTY_CHANGED: 40,
  MATCHED_UNCHANGED: 10,
});

export function createDrilldownContext({ widgetType, domain, title, filter = {}, sourceWidgetId = '' }) {
  return {
    contract: CONTRACT_VERSIONS.DrilldownContext,
    widgetType,
    domain,
    title: String(title ?? ''),
    sourceWidgetId: String(sourceWidgetId ?? widgetType),
    filter: {
      status: Array.isArray(filter.status) ? filter.status.map(String) : undefined,
      confidence: Array.isArray(filter.confidence) ? filter.confidence.map(String) : undefined,
      severity: Array.isArray(filter.severity) ? filter.severity.map(String) : undefined,
      objectIds: Array.isArray(filter.objectIds) ? filter.objectIds.map(String) : undefined,
      diffIds: Array.isArray(filter.diffIds) ? filter.diffIds.map(String) : undefined,
      groupBy: filter.groupBy ? String(filter.groupBy) : undefined,
      groupValue: filter.groupValue !== undefined ? String(filter.groupValue) : undefined,
    },
  };
}

export function drilldownDomainFor(audit) {
  return audit?.compareKind === 'node-wise' ? 'NODE_SUPPORT' : 'XML_ELEMENT';
}

function lineIndex(graphs) {
  const lineOf = new Map();
  for (const graph of [graphs?.A, graphs?.B]) {
    for (const object of graph?.objects ?? []) lineOf.set(object.objectId, object.lineId || '(model)');
  }
  return lineOf;
}

/**
 * Resolve a context into severity-sorted preview rows.
 * @returns [{ diffId, status, severity, source, target, confidence, score,
 *             positionDeltaMm, detail, objectId }]
 */
export function resolveDrilldownRows(context, audit, graphs = null) {
  const filter = context?.filter ?? {};
  const lineOf = filter.groupBy === 'line' ? lineIndex(graphs) : null;
  const rows = [];
  for (const row of audit?.objectDiff?.rows ?? []) {
    if (filter.status?.length && !filter.status.includes(row.status)) continue;
    if (filter.confidence?.length && !filter.confidence.includes(row.confidence)) continue;
    if (filter.diffIds?.length && !filter.diffIds.includes(row.diffId)) continue;
    if (filter.objectIds?.length && !filter.objectIds.some((id) => id === row.sourceObjectId || id === row.targetObjectId)) continue;
    if (lineOf && filter.groupValue !== undefined) {
      const line = lineOf.get(row.sourceObjectId) ?? lineOf.get(row.targetObjectId) ?? '(model)';
      if (line !== filter.groupValue) continue;
    }
    const detailParts = [];
    if (row.geometryIssue) detailParts.push(row.geometryIssue);
    for (const change of (row.changedProperties ?? []).slice(0, 2)) {
      detailParts.push(`${change.property}: "${change.sourceValue}" → "${change.targetValue}"`);
    }
    if (row.conflicts?.length && !detailParts.length) detailParts.push(row.conflicts[0]);
    rows.push({
      diffId: row.diffId,
      status: row.status,
      severity: STATUS_SEVERITY[row.status] ?? 30,
      source: stripModelPrefix(row.sourceObjectId),
      target: stripModelPrefix(row.targetObjectId),
      confidence: row.confidence ?? '',
      score: row.score ?? null,
      positionDeltaMm: Number.isFinite(row.positionDeltaMm) ? row.positionDeltaMm : null,
      loadDeltaPct: Number.isFinite(row.loadDeltaPct) ? row.loadDeltaPct : null,
      measureDeltaPct: Number.isFinite(row.measureDeltaPct) ? row.measureDeltaPct : null,
      detail: detailParts.join(' · '),
      objectId: row.sourceObjectId || row.targetObjectId || null,
      relatedIds: [row.sourceObjectId, row.targetObjectId, ...(row.candidateTargetIds ?? [])].filter(Boolean),
    });
  }
  rows.sort((a, b) => b.severity - a.severity || (b.measureDeltaPct ?? 0) - (a.measureDeltaPct ?? 0) || (b.loadDeltaPct ?? 0) - (a.loadDeltaPct ?? 0) || (b.positionDeltaMm ?? 0) - (a.positionDeltaMm ?? 0));
  return rows;
}

export const DRILLDOWN_CSV_COLUMNS = Object.freeze([
  ['diffId', 'Diff'], ['status', 'Status'], ['source', 'Source'], ['target', 'Target'],
  ['confidence', 'Confidence'], ['score', 'Score'], ['positionDeltaMm', 'Position Δ mm'],
  ['loadDeltaPct', 'Load Δ %'], ['measureDeltaPct', 'Measure Δ %'], ['detail', 'Detail'],
]);

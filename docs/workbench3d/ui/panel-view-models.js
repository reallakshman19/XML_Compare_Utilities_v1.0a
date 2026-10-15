/**
 * panel-view-models.js — pure row/filter models for the floating panels and
 * hover tooltips. No DOM; fully Node-testable.
 */

/** 'source:E32' → 'E32' (also handles 'target:N4', plain ids pass through). */
export function stripModelPrefix(id) {
  return String(id ?? '').replace(/^(source|target):/, '');
}

function joinList(values) {
  return (values ?? []).map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join('; ');
}

/** Object diff panel rows (prefix-stripped, display-ready). */
export function objectDiffPanelRows(audit) {
  return (audit?.objectDiff?.rows ?? []).map((row) => ({
    diffId: row.diffId,
    status: row.status,
    diff: row.diffId,
    source: stripModelPrefix(row.sourceObjectId),
    target: stripModelPrefix(row.targetObjectId),
    confidence: row.confidence ?? '',
    reasons: joinList(row.reasons),
    conflicts: joinList(row.conflicts),
    objectId: row.sourceObjectId || row.targetObjectId || null,
    sourceObjectId: row.sourceObjectId ?? null,
    targetObjectId: row.targetObjectId ?? null,
  }));
}

/** Conflict panel rows with status joined from the diff row. */
export function conflictPanelRows(audit) {
  const statusByDiffId = new Map((audit?.objectDiff?.rows ?? []).map((r) => [r.diffId, r.status]));
  return (audit?.conflictLedger?.rows ?? []).map((row) => ({
    conflictId: row.conflictId,
    kind: row.kind,
    detail: String(row.detail ?? '').replace(/\b(source|target):/g, ''),
    status: row.diffId ? (statusByDiffId.get(row.diffId) ?? '') : '',
    source: stripModelPrefix(row.sourceObjectId),
    target: stripModelPrefix(row.targetObjectId),
    objectId: row.sourceObjectId || row.targetObjectId || null,
  }));
}

/** Approval-override panel rows from the transfer plan. */
export function approvalPanelRows(plan) {
  return (plan?.rows ?? []).map((row) => ({
    rowId: row.rowId,
    element: `${stripModelPrefix(row.sourceObjectId)}→${stripModelPrefix(row.targetObjectId)}`,
    targetObjectId: row.targetObjectId,
    property: row.property,
    oldValue: row.oldValue,
    newValue: row.newValue,
    confidence: row.confidence ?? '',
    approval: row.approval,
    blockedReason: row.blockedReason ?? '',
  }));
}

/**
 * Apply chip filters to panel rows. Empty filter arrays mean "no filter".
 * Filters: statusFilter (row.status), confidenceFilter (row.confidence),
 * kindFilter (row.kind).
 */
export function applyPanelFilters(rows, { statusFilter = [], confidenceFilter = [], kindFilter = [] } = {}) {
  return (rows ?? []).filter((row) => {
    if (statusFilter.length && !statusFilter.includes(row.status)) return false;
    if (confidenceFilter.length && !confidenceFilter.includes(row.confidence)) return false;
    if (kindFilter.length && !kindFilter.includes(row.kind)) return false;
    return true;
  });
}

/** Distinct non-empty values of a key (for filter chip rows), sorted. */
export function distinctValues(rows, key) {
  return [...new Set((rows ?? []).map((r) => r?.[key]).filter((v) => v !== undefined && v !== null && v !== ''))].sort();
}

/**
 * Hover tooltip lines for an object/node: id, status, position delta, changed
 * properties, and packet lines filtered by the settings allowlist.
 */
export function objectHoverTooltipLines(audit, graphs, objectId, settings = null) {
  const lines = [];
  if (!objectId) return lines;
  const graph = objectId.startsWith('source:') ? graphs?.A : graphs?.B;
  const object = graph?.objects.find((o) => o.objectId === objectId);
  if (!object) return lines;
  lines.push(`${stripModelPrefix(objectId)} · ${object.kind} · ${object.canonicalFromTo}`);
  const diffRow = audit?.objectDiff?.rows.find((r) => r.sourceObjectId === objectId || r.targetObjectId === objectId);
  if (diffRow) {
    lines.push(`${diffRow.status}${diffRow.confidence && diffRow.confidence !== 'NONE' ? ` · ${diffRow.confidence}` : ''}${Number.isFinite(diffRow.positionDeltaMm) ? ` · Δ ${diffRow.positionDeltaMm.toFixed(1)} mm` : ''}`);
    for (const change of (diffRow.changedProperties ?? []).slice(0, 4)) {
      lines.push(`${change.property}: "${change.sourceValue}" → "${change.targetValue}"`);
    }
  }
  const allow = settings?.tooltipPacketKinds;
  for (const packet of object.packets ?? []) {
    if (Array.isArray(allow) && !allow.includes(packet.kind)) continue;
    const attrs = Object.entries(packet.attrs ?? {}).slice(0, 4).map(([k, v]) => `${k}=${v}`).join(' ');
    lines.push(`${packet.kind}${attrs ? `: ${attrs}` : ''}`);
  }
  return lines;
}

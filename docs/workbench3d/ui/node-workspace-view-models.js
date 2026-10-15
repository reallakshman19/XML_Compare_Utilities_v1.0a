/**
 * node-workspace-view-models.js — node-support workspace visuals (W4, pure).
 *
 * Five adaptive views over a node-wise CompareAudit:
 *   2.5D node map · support tree · load matrix · support-type flow · match matrix
 * Every model row carries the DrilldownContext filter it emits when clicked.
 */

import { DIFF_STATUS } from '../contracts/contracts.js';
import { stripModelPrefix } from './panel-view-models.js';

function objectIndex(graphs) {
  const map = new Map();
  for (const graph of [graphs?.A, graphs?.B]) {
    for (const object of graph?.objects ?? []) map.set(object.objectId, object);
  }
  return map;
}

function coordOf(graph, object) {
  if (!object) return null;
  const node = graph?.nodes.find((n) => n.nodeId === object.fromNode);
  return node ? node.coordMm : null;
}

/** Support/node label: the object's node id (e.g. PS-27161.3), not source:N4. */
function labelOf(index, row) {
  const object = index.get(row.sourceObjectId) ?? index.get(row.targetObjectId);
  return object?.fromNode || stripModelPrefix(row.sourceObjectId || row.targetObjectId);
}

/** Status → single-glyph marker for the 2.5D map / cards. */
export const STATUS_GLYPH = Object.freeze({
  MATCHED_UNCHANGED: '○', PROPERTY_CHANGED: 'Δ', GEOMETRY_CHANGED: '⤢',
  MISSING_IN_TARGET: '−', NEW_IN_TARGET: '+', AMBIGUOUS: '?',
  SPLIT: '⑃', MERGE: '⑂', CONSUMED: '◌', CONFLICT: '⚠',
});

/**
 * 2.5D node map: East(x)/North(y) plan projection of every diff row.
 * Source-only rows use the source coord; target rows use target coord.
 * @returns { points, bounds } — points carry [east,north], status, glyph,
 *          loadDeltaPct, the object id, and a drill-down filter
 */
export function nodeMapModel(audit, graphs) {
  const index = objectIndex(graphs);
  const points = [];
  let minE = Infinity; let minN = Infinity; let maxE = -Infinity; let maxN = -Infinity;
  for (const row of audit?.objectDiff?.rows ?? []) {
    const sObj = row.sourceObjectId ? graphs?.A?.objects.find((o) => o.objectId === row.sourceObjectId) : null;
    const tObj = row.targetObjectId ? graphs?.B?.objects.find((o) => o.objectId === row.targetObjectId) : null;
    const coord = coordOf(graphs?.A, sObj) ?? coordOf(graphs?.B, tObj);
    if (!coord) continue;
    const [east, north] = coord;
    minE = Math.min(minE, east); maxE = Math.max(maxE, east);
    minN = Math.min(minN, north); maxN = Math.max(maxN, north);
    points.push({
      diffId: row.diffId,
      objectId: row.sourceObjectId || row.targetObjectId,
      label: labelOf(index, row),
      east,
      north,
      status: row.status,
      glyph: STATUS_GLYPH[row.status] ?? '·',
      loadDeltaPct: Number.isFinite(row.loadDeltaPct) ? row.loadDeltaPct : null,
      filter: { diffIds: [row.diffId] },
    });
  }
  const bounds = Number.isFinite(minE)
    ? { minE, minN, maxE, maxN }
    : { minE: 0, minN: 0, maxE: 1, maxN: 1 };
  return { points, bounds };
}

/**
 * Support tree: parent support → child support points, each with its status.
 * Parent comes from the PARENT prop (exploded grain) else the node's line.
 */
export function supportTreeModel(audit, graphs) {
  const index = objectIndex(graphs);
  const parents = new Map();
  for (const row of audit?.objectDiff?.rows ?? []) {
    const object = index.get(row.sourceObjectId) ?? index.get(row.targetObjectId);
    const parent = object?.properties?.PARENT || object?.lineId || '(model)';
    if (!parents.has(parent)) parents.set(parent, { parent, children: [], statuses: new Set() });
    const group = parents.get(parent);
    group.statuses.add(row.status);
    group.children.push({
      diffId: row.diffId,
      label: labelOf(index, row),
      status: row.status,
      glyph: STATUS_GLYPH[row.status] ?? '·',
      objectId: row.sourceObjectId || row.targetObjectId,
      loadDeltaPct: Number.isFinite(row.loadDeltaPct) ? row.loadDeltaPct : null,
      filter: { diffIds: [row.diffId] },
    });
  }
  return [...parents.values()]
    .map((g) => ({
      parent: g.parent,
      children: g.children,
      changed: g.children.some((c) => c.status !== DIFF_STATUS.MATCHED_UNCHANGED),
      filter: { diffIds: g.children.map((c) => c.diffId) },
    }))
    .sort((a, b) => Number(b.changed) - Number(a.changed) || b.children.length - a.children.length);
}

/**
 * Load matrix: matched nodes × load cases, with source/target resultants and
 * delta %. Reads LC*_R props off the paired objects.
 */
export function loadMatrixModel(audit, graphs) {
  const index = objectIndex(graphs);
  const caseIds = new Set();
  const rows = [];
  for (const row of audit?.objectDiff?.rows ?? []) {
    if (!row.sourceObjectId || !row.targetObjectId) continue;
    const src = index.get(row.sourceObjectId);
    const tgt = index.get(row.targetObjectId);
    if (!src || !tgt) continue;
    const cases = {};
    let hasLoad = false;
    for (const key of new Set([...Object.keys(src.properties), ...Object.keys(tgt.properties)])) {
      const match = /^(LC\d+)_R$/.exec(key);
      if (!match) continue;
      const caseId = match[1];
      caseIds.add(caseId);
      const a = Number(src.properties[key]);
      const b = Number(tgt.properties[key]);
      const base = Math.max(Math.abs(a) || 0, Math.abs(b) || 0);
      const deltaPct = base < 1e-9 ? 0 : Number((Math.abs((a || 0) - (b || 0)) / base * 100).toFixed(1));
      cases[caseId] = { a: Number.isFinite(a) ? a : null, b: Number.isFinite(b) ? b : null, deltaPct };
      hasLoad = true;
    }
    if (!hasLoad) continue;
    rows.push({
      diffId: row.diffId,
      label: src.fromNode || stripModelPrefix(row.sourceObjectId),
      objectId: row.sourceObjectId,
      maxDeltaPct: row.loadDeltaPct ?? Math.max(0, ...Object.values(cases).map((c) => c.deltaPct)),
      cases,
      filter: { diffIds: [row.diffId] },
    });
  }
  rows.sort((a, b) => b.maxDeltaPct - a.maxDeltaPct);
  return { caseIds: [...caseIds].sort(), rows };
}

function supportKindSet(object) {
  return (object?.packets ?? []).map((p) => p.attrs?.KIND ?? p.kind);
}

/**
 * Support-type flow: how support kinds move source→target for matched nodes
 * (REST→REST, GUIDE→(gone), (new)→SHOE …). Sankey-style link counts.
 */
export function supportFlowModel(audit, graphs) {
  const index = objectIndex(graphs);
  const links = new Map();
  const bump = (from, to, diffId) => {
    const key = `${from}|${to}`;
    if (!links.has(key)) links.set(key, { from, to, count: 0, diffIds: [] });
    const link = links.get(key);
    link.count += 1;
    link.diffIds.push(diffId);
  };
  for (const row of audit?.objectDiff?.rows ?? []) {
    const src = row.sourceObjectId ? index.get(row.sourceObjectId) : null;
    const tgt = row.targetObjectId ? index.get(row.targetObjectId) : null;
    const srcKinds = new Set(supportKindSet(src));
    const tgtKinds = new Set(supportKindSet(tgt));
    const all = new Set([...srcKinds, ...tgtKinds]);
    for (const kind of all) {
      const inSrc = srcKinds.has(kind);
      const inTgt = tgtKinds.has(kind);
      if (inSrc && inTgt) bump(kind, kind, row.diffId);
      else if (inSrc) bump(kind, '(removed)', row.diffId);
      else bump('(added)', kind, row.diffId);
    }
  }
  return [...links.values()].sort((a, b) => b.count - a.count);
}

/**
 * Match matrix for ambiguity review: source node × its candidate targets.
 */
export function matchMatrixModel(audit, graphs = null) {
  const index = graphs ? objectIndex(graphs) : new Map();
  const nameOf = (id) => index.get(id)?.fromNode || stripModelPrefix(id);
  const rows = [];
  const targetSet = new Set();
  for (const row of audit?.objectDiff?.rows ?? []) {
    if (row.status !== DIFF_STATUS.AMBIGUOUS || !row.candidateTargetIds?.length) continue;
    const candidates = row.candidateTargetIds.map(nameOf);
    candidates.forEach((c) => targetSet.add(c));
    rows.push({
      diffId: row.diffId,
      source: nameOf(row.sourceObjectId),
      sourceObjectId: row.sourceObjectId,
      candidates,
      candidateObjectIds: row.candidateTargetIds,
      filter: { diffIds: [row.diffId] },
    });
  }
  return { rows, targets: [...targetSet].sort() };
}

/** Which W4 views have data (drives the mode tabs). */
export function availableNodeViews(audit, graphs) {
  return {
    map: nodeMapModel(audit, graphs).points.length > 0,
    tree: (audit?.objectDiff?.rows ?? []).length > 0,
    load: loadMatrixModel(audit, graphs).rows.length > 0,
    flow: supportFlowModel(audit, graphs).length > 0,
    matrix: matchMatrixModel(audit, graphs).rows.length > 0,
  };
}

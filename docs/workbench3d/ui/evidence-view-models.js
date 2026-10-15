/**
 * evidence-view-models.js — Level-3 full evidence model (W5, pure).
 *
 * One universal structure (Source A · Target B · Delta · Basis · Raw
 * traceability · Actions) with a domain template choosing which fields to
 * show. Vision doc §6: NodeSupport / XmlElement / Generic templates over one
 * shell. Also builds the connector ledger rows.
 */

import { stripModelPrefix } from './panel-view-models.js';

function objectIndex(graphs) {
  const map = new Map();
  for (const graph of [graphs?.A, graphs?.B]) {
    for (const object of graph?.objects ?? []) map.set(object.objectId, object);
  }
  return map;
}

function nodeCoord(graph, object) {
  if (!object) return null;
  return graph?.nodes.find((n) => n.nodeId === object.fromNode)?.coordMm ?? null;
}

const PROP = (object, key) => (object?.properties?.[key] ?? '');

/** Domain → ordered field extractors [label, fn(object, graph)]. */
const DOMAIN_TEMPLATES = Object.freeze({
  NODE_SUPPORT: [
    ['Node / support', (o) => o?.fromNode ?? ''],
    ['Parent', (o) => PROP(o, 'PARENT')],
    ['Reference', (o) => PROP(o, 'REF')],
    ['Coordinate E/N/U', (o, g) => { const c = nodeCoord(g, o); return c ? c.map((v) => Number(v).toFixed(1)).join(' / ') : ''; }],
    ['Bore', (o) => PROP(o, 'BORE')],
    ['Tag', (o) => PROP(o, 'TAG')],
    ['Supports', (o) => (o?.packets ?? []).map((p) => p.attrs?.DETAIL || p.attrs?.KIND || p.kind).join(', ')],
    ['Revision', (o) => PROP(o, 'REVISION')],
    ['Remarks', (o) => PROP(o, 'REMARKS')],
  ],
  XML_ELEMENT: [
    ['Line', (o) => o?.lineId ?? ''],
    ['Element', (o) => o?.canonicalFromTo ?? ''],
    ['From / To node', (o) => o ? `${o.fromNode} / ${o.toNode}` : ''],
    ['Length mm', (o) => (o ? o.lengthMm : '')],
    ['Diameter mm', (o) => (o?.diameterMm ?? '')],
    ['Wall mm', (o) => (o?.wallThickMm ?? '')],
    ['Material', (o) => PROP(o, 'MATERIAL_NAME')],
    ['Packets', (o) => (o?.packets ?? []).map((p) => p.kind).join(', ')],
    ['Station mm', (o) => (o ? o.stationMm : '')],
  ],
  GENERIC_NODE: [
    ['Id', (o) => o?.fromNode ?? ''],
    ['Kind', (o) => o?.kind ?? ''],
  ],
});

export function evidenceDomainFor(audit) {
  return audit?.compareKind === 'node-wise' ? 'NODE_SUPPORT' : 'XML_ELEMENT';
}

/**
 * Build the full evidence model for one diff row.
 * @returns null | { diffId, domain, title, status, confidence, source, target,
 *                   fields:[{label,a,b,changed}], delta, basis, traceability, actions }
 */
export function buildEvidenceModel(audit, graphs, diffId) {
  const row = (audit?.objectDiff?.rows ?? []).find((r) => r.diffId === diffId);
  if (!row) return null;
  const index = objectIndex(graphs);
  const source = row.sourceObjectId ? index.get(row.sourceObjectId) : null;
  const target = row.targetObjectId ? index.get(row.targetObjectId) : null;
  const domain = evidenceDomainFor(audit);
  const template = DOMAIN_TEMPLATES[domain] ?? DOMAIN_TEMPLATES.GENERIC_NODE;
  const changedKeys = new Set((row.changedProperties ?? []).map((c) => c.property));

  const fields = template.map(([label, fn]) => {
    const a = source ? fn(source, graphs?.A) : '';
    const b = target ? fn(target, graphs?.B) : '';
    return { label, a: String(a ?? ''), b: String(b ?? ''), changed: !!(source && target) && String(a ?? '') !== String(b ?? '') };
  });

  const delta = [];
  if (row.geometryIssue) delta.push(['Geometry', row.geometryIssue]);
  if (Number.isFinite(row.positionDeltaMm) && row.positionDeltaMm > 0) delta.push(['Position Δ', `${row.positionDeltaMm.toFixed(1)} mm`]);
  if (Number.isFinite(row.loadDeltaPct) && row.loadDeltaPct > 0) delta.push(['Load Δ', `${row.loadDeltaPct.toFixed(1)} %`]);
  for (const change of row.changedProperties ?? []) delta.push([change.property, `"${change.sourceValue}" → "${change.targetValue}"`]);
  if (row.remarkFlags?.length) delta.push(['Remark flags', row.remarkFlags.join(', ')]);
  if (!delta.length) delta.push(['—', row.status === 'MATCHED_UNCHANGED' ? 'no change' : row.status.replaceAll('_', ' ')]);

  const basis = (row.reasons ?? []).slice(0, 8);
  const conflicts = row.conflicts ?? [];

  const traceability = [
    ['Diff id', row.diffId],
    ['Source object', stripModelPrefix(row.sourceObjectId) || '—'],
    ['Target object', stripModelPrefix(row.targetObjectId) || '—'],
    ['Source raw row', source && Number.isInteger(source.rawIndex) ? source.rawIndex : '—'],
    ['Target raw row', target && Number.isInteger(target.rawIndex) ? target.rawIndex : '—'],
    ['Match via', row.via ?? '—'],
    ['Score / next / gap', row.score != null ? `${row.score} / ${row.nextBestScore ?? '—'} / ${row.scoreGap ?? '—'}` : '—'],
  ];

  // Actions the shell may offer, given a paired/ambiguous row.
  const actions = {
    canReject: !!(row.sourceObjectId && row.targetObjectId),
    candidates: (row.candidateTargetIds ?? []).map((id) => ({ id, label: stripModelPrefix(id) })),
    sourceObjectId: row.sourceObjectId,
    targetObjectId: row.targetObjectId,
  };

  const label = (object, objectId) => object?.fromNode || stripModelPrefix(objectId);
  return {
    diffId: row.diffId,
    domain,
    title: source && target ? `${label(source, row.sourceObjectId)} ↔ ${label(target, row.targetObjectId)}`
      : label(source ?? target, row.sourceObjectId || row.targetObjectId),
    status: row.status,
    confidence: row.confidence ?? '',
    hasSource: !!source,
    hasTarget: !!target,
    fields,
    delta,
    basis,
    conflicts,
    traceability,
    actions,
  };
}

const STATUS_SYMBOL = Object.freeze({
  MATCHED_UNCHANGED: '✓', PROPERTY_CHANGED: 'Δ', GEOMETRY_CHANGED: '⤢',
  MISSING_IN_TARGET: '−', NEW_IN_TARGET: '+', AMBIGUOUS: '!', SPLIT: '⑃', MERGE: '⑂', CONSUMED: '◌', CONFLICT: '⚠',
});

/**
 * Connector ledger rows (vision doc Appendix B §6): status, source, target,
 * basis (top reason), confidence.
 */
export function connectorLedgerModel(audit, graphs = null) {
  const index = graphs ? objectIndex(graphs) : new Map();
  const label = (id) => (id ? (index.get(id)?.fromNode || stripModelPrefix(id)) : '—');
  return (audit?.objectDiff?.rows ?? []).map((row) => ({
    diffId: row.diffId,
    symbol: STATUS_SYMBOL[row.status] ?? '·',
    status: row.status,
    source: label(row.sourceObjectId),
    target: label(row.targetObjectId),
    confidence: row.confidence ?? '',
    basis: (row.reasons ?? [])[0] ?? (row.conflicts ?? [])[0] ?? '',
    objectId: row.sourceObjectId || row.targetObjectId,
  }));
}

export const CONNECTOR_LEDGER_CSV_COLUMNS = Object.freeze([
  ['status', 'Status'], ['source', 'Source'], ['target', 'Target'],
  ['confidence', 'Confidence'], ['basis', 'Basis'], ['diffId', 'Diff'],
]);

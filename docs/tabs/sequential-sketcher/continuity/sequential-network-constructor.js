/**
 * Constructs one connected, derived network from a supervised continuation draft.
 * The returned `records` remain the same top-level staged-source array format.
 */
import { assertSequentialContinuationDraftCurrent } from './sequential-continuation-model.js';

export const SEQUENTIAL_CONSTRUCTED_GEOMETRY_SCHEMA = 'SequentialConstructedGeometry.v1';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value ?? '').trim(); }
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }
function finitePoint(value) {
  return value && [value.x, value.y, value.z].every((entry) => Number.isFinite(Number(entry)));
}
function pairKey(connector) {
  const left = `${connector.branchId}:${connector.role}`;
  const right = `${connector.targetBranchId}:${connector.targetEndpoint}`;
  return [left, right].sort().join('|');
}
function updateReference(record, connector) {
  const reference = connector.targetBranchId
    || connector.externalReference
    || (connector.edited ? null : connector.originalReference)
    || null;
  if (connector.role === 'HEAD') record.attributes.HREF = reference;
  if (connector.role === 'TAIL') record.attributes.TREF = reference;
  if (connector.role === 'BRANCH') {
    const child = record.children?.[connector.sourceChildIndex];
    if (child?.attributes) child.attributes.CREF = reference;
  }
}
function continuityPipe(connector, record) {
  if (connector.status !== 'INTERNAL' || !finitePoint(connector.sourcePoint)
    || !finitePoint(connector.targetPoint) || Number(connector.gapMm) <= 0.001) return null;
  const bore = record.attributes?.[connector.role === 'HEAD' ? 'HBOR' : 'TBOR']
    || record.bore || null;
  return {
    name: `PIPE AUTO CONTINUITY ${connector.connectorId}`,
    type: 'PIPE',
    attributes: {
      APOS: clone(connector.sourcePoint),
      LPOS: clone(connector.targetPoint),
      AUTO_GENERATED_PIPE: 'true',
      GAP_MM: Number(connector.gapMm).toFixed(3),
      ROUTE_TIER: 'BUILD_QUEUE_CONTINUITY',
      CONTINUATION_ROLE: connector.role,
      CONTINUATION_TARGET: connector.targetBranchId,
      LBORE: bore,
    },
  };
}
function cleanPreviousGenerated(records) {
  for (const record of records) {
    if (!Array.isArray(record.children)) continue;
    record.children = record.children.filter((child) => (
      child?.attributes?.ROUTE_TIER !== 'BUILD_QUEUE_CONTINUITY'
    ));
  }
}
function validateConnectors(draft) {
  for (const connector of draft.connectors) {
    if (connector.status === 'INTERNAL_POSITION_MISSING') {
      throw new Error(`Connector ${connector.connectorId} has unresolved endpoint coordinates.`);
    }
    if (connector.edited && !connector.reason) {
      throw new Error(`Connector ${connector.connectorId} requires an engineering reason.`);
    }
  }
}
function sourceSegments(records) {
  const segments = [];
  const supports = [];
  for (const record of records) {
    const id = branchId(record);
    for (const [childIndex, child] of (record.children || []).entries()) {
      const attrs = child?.attributes || {};
      const type = String(child?.type || attrs.TYPE || '').toUpperCase();
      if (type === 'SUPPORT' && finitePoint(attrs.POS || attrs.APOS)) {
        supports.push(Object.freeze({
          branchId: id, name: child.name || attrs.NAME || '',
          point: Object.freeze({ ...(attrs.POS || attrs.APOS) }),
        }));
        continue;
      }
      if (finitePoint(attrs.APOS) && finitePoint(attrs.LPOS)) {
        segments.push(Object.freeze({
          branchId: id, childIndex, name: child.name || attrs.NAME || '',
          type,
          from: Object.freeze({ ...attrs.APOS }), to: Object.freeze({ ...attrs.LPOS }),
          generated: attrs.ROUTE_TIER === 'BUILD_QUEUE_CONTINUITY',
        }));
      }
    }
  }
  return { segments: Object.freeze(segments), supports: Object.freeze(supports) };
}
function displayConnectors(connectors) {
  const seen = new Set();
  const rows = [];
  for (const connector of connectors) {
    if (connector.status === 'INTERNAL') {
      const key = pairKey(connector);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    rows.push(Object.freeze({ ...connector }));
  }
  return Object.freeze(rows);
}
function metrics(records, segments, supports, connectors) {
  return Object.freeze({
    branchCount: records.filter((record) => String(record?.type || '').toUpperCase() === 'BRANCH').length,
    segmentCount: segments.length,
    supportCount: supports.length,
    internalConnectorCount: connectors.filter((row) => row.status === 'INTERNAL').length,
    externalSheetCount: connectors.filter((row) => row.status === 'EXTERNAL_SHEET').length,
    generatedPipeCount: segments.filter((row) => row.generated).length,
  });
}

export function constructSequentialGeometry(records, draft, queue, options = {}) {
  assertSequentialContinuationDraftCurrent(draft, records, queue);
  validateConnectors(draft);
  const output = clone(records);
  cleanPreviousGenerated(output);
  const byId = new Map(output.map((record) => [branchId(record), record]));
  const generatedPairs = new Set();
  for (const connector of draft.connectors) {
    const record = byId.get(connector.branchId);
    if (!record) throw new Error(`Source branch is unavailable: ${connector.branchId}`);
    record.attributes ||= {};
    updateReference(record, connector);
    const key = connector.status === 'INTERNAL' ? pairKey(connector) : '';
    const pipe = key && !generatedPairs.has(key) ? continuityPipe(connector, record) : null;
    if (pipe) { record.children ||= []; record.children.push(pipe); generatedPairs.add(key); }
  }
  const { segments, supports } = sourceSegments(output);
  const connectors = displayConnectors(draft.connectors);
  return Object.freeze({
    schema: SEQUENTIAL_CONSTRUCTED_GEOMETRY_SCHEMA,
    sourceSchema: 'staged-json-array',
    sourceFingerprint: draft.sourceFingerprint,
    queueGeneratedAt: draft.queueGeneratedAt,
    constructedAt: new Date().toISOString(),
    records: Object.freeze(output),
    segments,
    supports,
    connectors,
    metrics: metrics(output, segments, supports, connectors),
  });
}

export function serializeSequentialConstructedSource(geometry) {
  if (geometry?.schema !== SEQUENTIAL_CONSTRUCTED_GEOMETRY_SCHEMA) {
    throw new Error('Construct geometry before exporting constructed source JSON.');
  }
  return JSON.stringify(geometry.records, null, 2);
}

export function serializeSequentialSourceRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('Source records must be an array.');
  return JSON.stringify(records, null, 2);
}

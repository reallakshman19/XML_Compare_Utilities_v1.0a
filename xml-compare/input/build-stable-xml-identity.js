import {
  createStableIdentitySummary,
  createStableXmlIdentity,
} from '../contracts/stable-xml-identity-contract.js';

function clean(value) {
  return String(value ?? '').trim();
}

function firstValue(...values) {
  return values.map(clean).find(Boolean) || '';
}

function rawOf(record = {}) {
  return record.raw || record.rawSummary || record.attributes || {};
}

function guidOf(record = {}) {
  const raw = rawOf(record);
  return firstValue(record.guid, record.componentGuid, record.restraintGuid, record.GUID, record.COMPONENT_GUID, record.RESTRAINT_GUID, raw.guid, raw.GUID, raw.COMPONENT_GUID, raw.RESTRAINT_GUID);
}

function lineOf(record = {}) {
  const raw = rawOf(record);
  return firstValue(record.lineNo, record.lineKey, record.branchName, record.LINE_ID, raw.lineNo, raw.line, raw.LINE_ID);
}

function typeOf(record = {}) {
  const raw = rawOf(record);
  return firstValue(record.componentType, record.type, record.recordKind, record.componentRefNo, raw.type, raw.ComponentType);
}

function nodePairOf(record = {}) {
  const raw = rawOf(record);
  const from = firstValue(record.fromNode, record.FROM_NODE, raw.fromNode, raw.from, raw.FROM_NODE);
  const to = firstValue(record.toNode, record.TO_NODE, raw.toNode, raw.to, raw.TO_NODE);
  return { from, to };
}

function sourceRefOf(record = {}) {
  const refs = Array.isArray(record.sourceRefs) ? record.sourceRefs : [record.sourceRef, record.sourceRefPath];
  return refs.map(clean).find(Boolean) || '';
}

function coord(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value.X), y = Number(value.y ?? value.Y), z = Number(value.z ?? value.Z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function geometryHash(record = {}, toleranceMm = 1) {
  const points = Array.isArray(record.points) && record.points.length ? record.points : [record.position, record.centrePoint, record.coOrds];
  const rounded = points.map(coord).filter(Boolean).map((p) => [p.x, p.y, p.z].map((n) => Math.round(n / toleranceMm)).join(':'));
  return rounded.length ? `geom:${lineOf(record)}:${typeOf(record)}:${rounded.join('|')}` : '';
}

export function buildStableXmlIdentity(record = {}, options = {}) {
  const sourceId = clean(options.sourceId);
  const recordUid = clean(record.uid || record.id || `record:${Number(options.index || 0) + 1}`);
  const guid = guidOf(record);
  if (guid) return createStableXmlIdentity({ sourceId, recordUid, stableKey: `guid:${guid}`, identityBasis: 'guid' });
  const line = lineOf(record), pair = nodePairOf(record), type = typeOf(record);
  if (line && pair.from && pair.to && type) return createStableXmlIdentity({ sourceId, recordUid, stableKey: `lnp:${line}|${pair.from}|${pair.to}|${type}`, identityBasis: 'line-node-pair' });
  const element = clean(record.elementKey), node = clean(record.nodeNumber), role = clean(record.role);
  if (line && element && node && role) return createStableXmlIdentity({ sourceId, recordUid, stableKey: `lenr:${line}|${element}|${node}|${role}`, identityBasis: 'line-element-node-role' });
  const ref = sourceRefOf(record);
  if (ref) return createStableXmlIdentity({ sourceId, recordUid, stableKey: `src:${ref}`, identityBasis: 'source-ref', warnings: ['source-ref fallback identity'] });
  const geom = geometryHash(record, Number(options.toleranceMm) || 1);
  if (geom) return createStableXmlIdentity({ sourceId, recordUid, stableKey: geom, identityBasis: 'geometry-hash', warnings: ['geometry hash fallback identity'] });
  if (options.index != null) return createStableXmlIdentity({ sourceId, recordUid, stableKey: `idx:${sourceId}:${options.index}`, identityBasis: 'synthetic-index', warnings: ['synthetic index fallback identity'] });
  return createStableXmlIdentity({ sourceId, recordUid, identityBasis: 'unknown', warnings: ['identity could not be resolved'] });
}

export function buildStableXmlIdentities(records = [], options = {}) {
  return Object.freeze((Array.isArray(records) ? records : []).map((record, index) => buildStableXmlIdentity(record, { ...options, index })));
}

export function buildStableXmlIdentitySummary(records = [], options = {}) {
  return createStableIdentitySummary(buildStableXmlIdentities(records, options));
}

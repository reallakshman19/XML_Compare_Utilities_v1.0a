/** Deterministic read-only audit for resolved and blocked InputXML bends. */

export const BEND_GEOMETRY_AUDIT_CONTRACT = 'BendGeometryAudit.v1';
export const BEND_GEOMETRY_SIGNATURE_ALGORITHM = 'stable-json-fnv1a32';

const AUTHORITY = 'READ_ONLY_VISUAL_DERIVATION';

function array(value) { return Array.isArray(value) ? value : []; }
function text(value) { return String(value ?? '').trim(); }
function integer(value) { return Math.max(0, Math.trunc(Number(value) || 0)); }
function number(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
function localId(value) { return text(value).replace(/^[^:]+:/, ''); }
function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function stableValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(stableValue));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => compareText(a, b))
      .map(([key, item]) => [key, stableValue(item)])));
  }
  return value;
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => compareText(a, b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashStableString(value = '') {
  let hash = 0x811c9dc5;
  const input = String(value ?? '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `wb3d-bend-${hash.toString(16).padStart(8, '0')}`;
}

function canonicalPoint(point) {
  return Object.freeze(array(point).slice(0, 3).map(number));
}

function canonicalArc(arc = {}) {
  return stableValue({
    objectId: localId(arc.objectId),
    incomingObjectId: localId(arc.incomingObjectId),
    outgoingObjectId: localId(arc.outgoingObjectId),
    cornerNode: text(arc.cornerNode),
    radiusMm: number(arc.radiusMm),
    angleDeg: number(arc.angleDeg),
    tangentMm: number(arc.tangentMm),
    center: canonicalPoint(arc.center),
    points: array(arc.points).map(canonicalPoint),
    directionEvidence: text(arc.directionEvidence),
    packetSource: text(arc.packetSource),
  });
}

function canonicalDiagnostic(row = {}) {
  const {
    objectId, packetIndex, severity, code, message, ...details
  } = row;
  return stableValue({
    objectId: localId(objectId),
    packetIndex: Number.isInteger(Number(packetIndex)) ? Number(packetIndex) : null,
    severity: text(severity),
    code: text(code),
    message: text(message),
    details: stableValue(details),
  });
}

function sortedCanonical(rows, mapper) {
  return Object.freeze(array(rows).map(mapper)
    .sort((a, b) => compareText(stableStringify(a), stableStringify(b))));
}

function declaredSummary(plan = {}) {
  return Object.freeze({
    requested: integer(plan.summary?.requested),
    resolved: integer(plan.summary?.resolved),
    blocked: integer(plan.summary?.blocked),
    arcSegments: integer(plan.summary?.arcSegments),
  });
}

function derivedSummary(arcs, diagnostics) {
  return Object.freeze({
    resolved: arcs.length,
    blocked: diagnostics.length,
    arcSegments: arcs.reduce((sum, arc) => sum + Math.max(0, arc.points.length - 1), 0),
  });
}

function canonicalPayload(graph = {}, plan = {}) {
  const arcs = sortedCanonical(plan.arcs, canonicalArc);
  const diagnostics = sortedCanonical(plan.diagnostics, canonicalDiagnostic);
  const declared = declaredSummary(plan);
  const derived = derivedSummary(arcs, diagnostics);
  return stableValue({
    sourceGraphContract: text(graph.contract),
    unit: 'mm',
    declaredSummary: declared,
    derivedSummary: derived,
    summaryConsistent: declared.resolved === derived.resolved
      && declared.blocked === derived.blocked
      && declared.arcSegments === derived.arcSegments
      && declared.requested === derived.resolved + derived.blocked,
    arcs,
    diagnostics,
  });
}

export function buildBendGeometryAudit(graph = {}, plan = {}) {
  const payload = canonicalPayload(graph, plan);
  const signature = hashStableString(stableStringify(payload));
  return Object.freeze({
    contract: BEND_GEOMETRY_AUDIT_CONTRACT,
    modelId: text(graph.modelId),
    signatureAlgorithm: BEND_GEOMETRY_SIGNATURE_ALGORITHM,
    signature,
    deterministic: true,
    authority: AUTHORITY,
    payload,
  });
}

export function serializeBendGeometryAudit(audit = {}) {
  return stableStringify(audit);
}

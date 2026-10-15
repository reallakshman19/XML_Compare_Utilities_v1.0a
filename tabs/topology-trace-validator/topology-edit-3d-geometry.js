/** Pure Topology Edit geometry derivation; it never owns viewer state. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { buildCanonicalRestraintGeometry } from './topology-3d-visual-model.js?v=20260717-ttv-components-v1';

const boreMm = (value) => { const parsed = Number.parseFloat(String(value ?? '')); return Number.isFinite(parsed) && parsed > 0 ? parsed : 0; };
const pointArray = (value) => {
  const point = objectRecord(value);
  return [point.x, point.y, point.z].every((part) => Number.isFinite(Number(part)))
    ? [Number(point.x), Number(point.y), Number(point.z)] : null;
};

export const COMPONENT_COLORS = Object.freeze({
  PIPE: 0x64748b, VALVE: 0xcc2222, FLANGE: 0xb7b7b7, GASK: 0xe5e7eb, INST: 0xf59e0b,
  ELBOW: 0x8b5cf6, TEE: 0x14b8a6, OLET: 0x0ea5e9, REDUCER: 0xa855f7,
});

/** Rejoin source component bore/position details by canonical source path. */
export function buildBoreIndex(sourceBranches) {
  const index = new Map();
  asArray(sourceBranches).map(objectRecord).forEach((branch, branchIndex) => {
    const children = asArray(branch.children).map(objectRecord);
    const branchBoreMm = children.map((child) => objectRecord(child.attributes))
      .map((attributes) => Math.max(boreMm(attributes.ABORE), boreMm(attributes.LBORE)))
      .find((diameterMm) => diameterMm > 0) ?? 0;
    index.set(`$[${branchIndex}]`, { branchBoreMm, type: 'BRANCH' });
    children.forEach((child, childIndex) => {
      const attributes = objectRecord(child.attributes);
      index.set(`$[${branchIndex}].children[${childIndex}]`, {
        aMm: boreMm(attributes.ABORE), lMm: boreMm(attributes.LBORE),
        apos: pointArray(attributes.APOS), pos: pointArray(attributes.POS), lpos: pointArray(attributes.LPOS),
        type: cleanText(child.type || attributes.RAW_TYPE || attributes.TYPE).toUpperCase(),
        dtxr: cleanText(attributes.DTXR).toUpperCase(),
      });
    });
  });
  return index;
}

function routeGeometry(canonical, nodeIndex, boreIndex) {
  const edges = asArray(canonical.edges).map(objectRecord);
  const sourceRows = (edge) => asArray(edge.sourcePaths).map((path) => boreIndex.get(cleanText(path))).filter(Boolean);
  const edgeBore = (edge) => {
    const rows = sourceRows(edge);
    if (/CREF_BRANCH_CONNECTION/i.test(cleanText(edge.segmentRole))) {
      const diameter = [...rows].reverse().find((row) => Number(row.branchBoreMm) > 0)?.branchBoreMm;
      if (diameter) return Number(diameter);
    }
    const components = rows.filter((row) => row.type !== 'BRANCH');
    const candidates = (components.length ? components : rows).flatMap((row) => [row.aMm, row.lMm, row.branchBoreMm]);
    return Math.max(Number(edge.diameterMm) || 0, ...candidates.map(Number).filter(Number.isFinite));
  };
  const edgeRadius = (edge) => Math.max(edgeBore(edge) > 0 ? edgeBore(edge) / 2 : 24, 4);
  const radii = new Map(edges.map((edge) => [cleanText(edge.id), edgeRadius(edge)]));
  return { edges, sourceRows, edgeRadius, radii };
}

function reducerSegment(segment, edge, from, to, boreIndex) {
  const own = asArray(edge.sourcePaths).map((path) => boreIndex.get(cleanText(path)))
    .find((bore) => bore && bore.aMm > 0 && bore.lMm > 0 && bore.aMm !== bore.lMm);
  if (!own) return { ...segment, radiusMm2: segment.radiusMm * 0.6 };
  const large = Math.max(own.aMm, own.lMm), small = Math.min(own.aMm, own.lMm);
  const fromIsApos = own.apos
    ? Math.hypot(from.position.x - own.apos[0], from.position.y - own.apos[1], from.position.z - own.apos[2])
      <= Math.hypot(to.position.x - own.apos[0], to.position.y - own.apos[1], to.position.z - own.apos[2]) : true;
  const largeAtFrom = fromIsApos ? own.aMm >= own.lMm : own.lMm >= own.aMm;
  return { ...segment, start: largeAtFrom ? segment.start : segment.end, end: largeAtFrom ? segment.end : segment.start, radiusMm: large / 2, radiusMm2: small / 2 };
}

function edgeSegment(edge, nodeIndex, boreIndex, route) {
  const from = nodeIndex.get(cleanText(edge.fromNodeId)), to = nodeIndex.get(cleanText(edge.toNodeId));
  if (!from || !to) return null;
  const kind = componentKindForEdge(edge);
  let segment = {
    objectId: cleanText(edge.id), start: [from.position.x, from.position.y, from.position.z],
    end: [to.position.x, to.position.y, to.position.z], radiusMm: route.radii.get(cleanText(edge.id)), kind,
    pathId: asArray(edge.branchIds)[0] ?? '', colorInt: COMPONENT_COLORS[kind] ?? COMPONENT_COLORS.PIPE,
  };
  if (kind === 'ELBOW') {
    const elbow = route.sourceRows(edge).find((row) => /ELBO|BEND/.test(`${row.type} ${row.dtxr}`) && row.apos && row.pos && row.lpos);
    if (elbow) segment = { ...segment, start: elbow.apos, end: elbow.lpos, center: elbow.pos,
      curveRange: /RUN_IN/i.test(cleanText(edge.segmentRole)) ? [0, 0.5] : /RUN_OUT/i.test(cleanText(edge.segmentRole)) ? [0.5, 1] : [0, 1] };
  }
  return kind === 'REDUCER' ? reducerSegment(segment, edge, from, to, boreIndex) : segment;
}

function nodeMarkers(nodes, edges, radii) {
  return nodes.map((node) => {
    const incident = edges.filter((edge) => cleanText(edge.fromNodeId) === cleanText(node.id) || cleanText(edge.toNodeId) === cleanText(node.id));
    const values = incident.map((edge) => radii.get(cleanText(edge.id)));
    const maxRadius = values.length ? Math.max(...values) : 20;
    return { objectId: cleanText(node.id), nodeId: cleanText(node.id), kind: 'NODE',
      position: [node.position.x, node.position.y, node.position.z], sizeMm: Math.max(20, maxRadius * 1.3) };
  });
}

function issueMarkers(validation, canonical, nodeIndex) {
  return asArray(validation?.findings).map(objectRecord).flatMap((issue) => {
    const objectId = asArray(issue.objectIds).map(cleanText).find(Boolean), node = nodeIndex.get(objectId);
    const edge = asArray(canonical.edges).map(objectRecord).find((row) => cleanText(row.id) === objectId);
    const from = edge ? nodeIndex.get(cleanText(edge.fromNodeId)) : null, to = edge ? nodeIndex.get(cleanText(edge.toNodeId)) : null;
    const position = node ? [node.position.x, node.position.y, node.position.z]
      : from && to ? [(from.position.x + to.position.x) / 2, (from.position.y + to.position.y) / 2, (from.position.z + to.position.z) / 2] : null;
    return position ? [{ objectId, kind: 'ISSUE_BADGE', position, label: cleanText(issue.code),
      colorInt: Number.parseInt(cleanText(issue.color).replace('#', ''), 16), sizeMm: 34, isObjectMarker: true }] : [];
  });
}

function geometryBounds(segments, markers) {
  const points = [...segments.flatMap((row) => [row.start, row.end]), ...markers.map((row) => row.position)];
  const axes = [0, 1, 2].map((axis) => points.map((value) => Number(value[axis])));
  return Object.freeze({
    min: axes.map((values) => values.length ? Math.min(...values) : 0),
    max: axes.map((values) => values.length ? Math.max(...values) : 1),
  });
}

/** Derive immutable viewer primitives from canonical topology and source bore data. */
export function visualGeometry(canonical, validation, verticalAxis, boreIndex, supportScale) {
  const nodes = asArray(canonical.nodes).map(objectRecord);
  const nodeIndex = new Map(nodes.map((node) => [cleanText(node.id), node]));
  const route = routeGeometry(canonical, nodeIndex, boreIndex);
  const routeSegments = route.edges.map((edge) => edgeSegment(edge, nodeIndex, boreIndex, route)).filter(Boolean);
  const restraint = buildCanonicalRestraintGeometry(canonical, { verticalAxis, supportScale, edgeRadii: route.radii });
  const segments = [...routeSegments, ...fittingSegments(canonical, nodeIndex, route.edgeRadius), ...restraint.segments];
  const markers = [...nodeMarkers(nodes, route.edges, route.radii), ...restraint.markers, ...issueMarkers(validation, canonical, nodeIndex)];
  return Object.freeze({ segments: Object.freeze(segments), markers: Object.freeze(markers), bounds: geometryBounds(segments, markers) });
}

/** Render valve/flange/bend/instrument edges with their fitting shapes in 3D. */
export function componentKindForEdge(edge) {
  const role = cleanText(edge.segmentRole).toUpperCase();
  const types = asArray(edge.sourceTypes).map(cleanText).join(' ').toUpperCase();
  if (/VALV/.test(role)) return 'VALVE';
  if (/INST/.test(role)) return 'INST';
  if (/GASK/.test(role)) return 'GASK';
  if (/FLAN/.test(role)) return 'FLANGE';
  if (/REDU/.test(role)) return 'REDUCER';
  if (/BEND|ELBO/.test(role)) return 'ELBOW';
  if (/TEE/.test(role) || /\bTEE\b/.test(types)) return 'TEE';
  return 'PIPE';
}

const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vScale = (a, scale) => [a[0] * scale, a[1] * scale, a[2] * scale];
const vLen = (a) => Math.hypot(a[0], a[1], a[2]);
const vUnit = (a) => { const length = vLen(a); return length > 1e-9 ? vScale(a, 1 / length) : null; };
const nodeXyz = (node) => [node.position.x, node.position.y, node.position.z];

/** Tee collars and OLET tapers derived from canonical incidence and branch bore. */
function fittingSegments(canonical, nodeIndex, edgeRadius) {
  const edges = asArray(canonical.edges).map(objectRecord), segments = [];
  const otherEnd = (edge, nodeId) => nodeIndex.get(cleanText(edge.fromNodeId) === nodeId ? cleanText(edge.toNodeId) : cleanText(edge.fromNodeId));
  for (const junction of asArray(canonical.junctions).map(objectRecord)) {
    const nodeId = cleanText(junction.nodeId), node = nodeIndex.get(nodeId);
    if (!node) continue;
    const incident = edges.filter((edge) => cleanText(edge.fromNodeId) === nodeId || cleanText(edge.toNodeId) === nodeId);
    const kind = cleanText(junction.kind).toUpperCase();
    if (kind === 'OLET') {
      const edge = incident.find((row) => /CREF_BRANCH_CONNECTION/i.test(cleanText(row.segmentRole))), other = edge ? otherEnd(edge, nodeId) : null;
      const direction = other ? vUnit(vSub(nodeXyz(other), nodeXyz(node))) : null;
      if (!edge || !direction) continue;
      const radius = edgeRadius(edge), length = Math.min(radius * 4, vLen(vSub(nodeXyz(other), nodeXyz(node))) * 0.4);
      segments.push({ objectId: cleanText(edge.id), start: nodeXyz(node), end: vAdd(nodeXyz(node), vScale(direction, length)),
        radiusMm: radius * 2, radiusMm2: radius, kind: 'OLET', pathId: cleanText(junction.id), colorInt: COMPONENT_COLORS.OLET });
      continue;
    }
    if (kind !== 'TEE') continue;
    for (const edge of incident.slice(0, 3)) {
      const other = otherEnd(edge, nodeId), direction = other ? vUnit(vSub(nodeXyz(other), nodeXyz(node))) : null;
      if (!other || !direction) continue;
      const radius = edgeRadius(edge), length = Math.min(radius * 2.5, 0.35 * vLen(vSub(nodeXyz(other), nodeXyz(node))));
      segments.push({ objectId: cleanText(edge.id), start: nodeXyz(node), end: vAdd(nodeXyz(node), vScale(direction, length)),
        radiusMm: radius * 1.12, kind: 'TEE_COLLAR', pathId: cleanText(junction.id), colorInt: COMPONENT_COLORS.TEE });
    }
  }
  return segments;
}

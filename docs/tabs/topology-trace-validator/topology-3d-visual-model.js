/** Builds trace 3D geometry, including directional restraint arrows. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

/** @param {number[]} value @returns {number[]|null} */
function unit(value) {
  const length = Math.hypot(...value);
  return length > 1e-9 ? value.map((part) => part / length) : null;
}

/** @param {Record<string, unknown>} support @param {Map<string,Record<string,unknown>>} nodes @param {Record<string, unknown>[]} edges @returns {number[]|null} */
function pipeAxis(support, nodes, edges) {
  const nodeId = cleanText(support.nodeId), node = nodes.get(nodeId);
  if (!node) return null;
  const edge = edges.find((row) => cleanText(row.fromNodeId) === nodeId || cleanText(row.toNodeId) === nodeId);
  if (!edge) return null;
  const otherId = cleanText(edge.fromNodeId) === nodeId ? cleanText(edge.toNodeId) : cleanText(edge.fromNodeId), other = nodes.get(otherId);
  return other ? unit([other.position.x - node.position.x, other.position.y - node.position.y, other.position.z - node.position.z]) : null;
}

/** @param {number[]} axis @returns {number[]} */
function lateralAxis(axis) {
  const reference = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return unit([
    (axis[1] * reference[2]) - (axis[2] * reference[1]),
    (axis[2] * reference[0]) - (axis[0] * reference[2]),
    (axis[0] * reference[1]) - (axis[1] * reference[0]),
  ]);
}

function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function scale(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }

/** @param {number[]} direction @returns {number[]} */
function opposite(direction) {
  return direction.map((value) => value === 0 ? 0 : -value);
}

export const RESTRAINT_FAMILY_MAPPING = {
  REST: 'REST', HOLDOWN: 'HOLDOWN', HOLDDOWN: 'HOLDOWN', HOLD_DOWN: 'HOLDOWN',
  GUIDE: 'GUIDE', GUI: 'GUIDE',
  LINESTOP: 'LINE_STOP', LINE_STOP: 'LINE_STOP',
  LIMIT: 'LIMIT', LIM: 'LIMIT',
  CAN: 'CAN',
  SPRING: 'SPRING_WARNING', 'SPRING CAN': 'SPRING_WARNING', 'CAN SPRING': 'SPRING_WARNING',
  U_BOLT: 'U_BOLT', SHOE: 'SHOE', TRUNNION: 'TRUNNION', HANGER: 'HANGER', SPRING_HANGER: 'SPRING_HANGER', ANCHOR: 'ANCHOR'
};

/** @param {Record<string,unknown>} restraint @returns {string} */
export function restraintFamily(restraint) {
  const rawKind = cleanText(restraint.kind).toUpperCase();
  return RESTRAINT_FAMILY_MAPPING[rawKind] || rawKind;
}

/** Family → arrow tint so restraint kinds read apart at a glance. */
export const RESTRAINT_FAMILY_COLORS = Object.freeze({
  REST: 0x22d3ee, SHOE: 0x22d3ee, TRUNNION: 0x22d3ee, HANGER: 0x22d3ee,
  GUIDE: 0x4ade80,
  LINE_STOP: 0xf59e0b, LIMIT: 0xf59e0b,
  ANCHOR: 0xef4444,
  HOLDOWN: 0xa78bfa, U_BOLT: 0xa78bfa,
  SPRING_WARNING: 0xfacc15, SPRING_HANGER: 0xfacc15, CAN: 0xfacc15,
});

function verticalAxisVector(verticalAxis) { return verticalAxis === 'Z' ? [0, 0, 1] : [0, 1, 0]; }
function lateralAxes(axis, verticalAxis = 'Y') {
  if (Math.abs(axis[verticalAxis === 'Z' ? 2 : 1]) > 0.9) return verticalAxis === 'Z' ? [[1, 0, 0], [0, 1, 0]] : [[1, 0, 0], [0, 0, 1]];
  const reference = verticalAxisVector(verticalAxis);
  const lateral = unit([
    (axis[1] * reference[2]) - (axis[2] * reference[1]),
    (axis[2] * reference[0]) - (axis[0] * reference[2]),
    (axis[0] * reference[1]) - (axis[1] * reference[0])
  ]);
  return lateral ? [lateral] : [];
}

/** @param {Record<string, unknown>} canonical @param {Record<string, unknown>} viewModel @returns {{segments:Record<string,unknown>[],markers:Record<string,unknown>[]}} */
export function buildCanonicalRestraintGeometry(canonical, viewModel) {
  const nodes = new Map(asArray(canonical.nodes).map(objectRecord).map((node) => [cleanText(node.id), node]));
  const edges = asArray(canonical.edges).map(objectRecord), segments = [], markers = [];
  const verticalAxis = cleanText(viewModel?.verticalAxis || 'Y').toUpperCase() === 'Z' ? 'Z' : 'Y';
  const requestedScale = Number(viewModel?.supportScale);
  const supportScale = Number.isFinite(requestedScale) ? Math.min(6, Math.max(0.25, requestedScale)) : 2.5;
  const up = verticalAxisVector(verticalAxis);

  for (const support of asArray(canonical.supports).map(objectRecord)) {
    const node = nodes.get(cleanText(support.nodeId));
    if (!node) continue;
    const center = [node.position.x, node.position.y, node.position.z], axis = pipeAxis(support, nodes, edges) || [1,0,0];
    markers.push({ objectId: cleanText(support.id), nodeId: cleanText(support.nodeId), kind: 'SUPPORT', position: center, sizeMm: 28 * supportScale, isObjectMarker: true });

    let odMm = 25 * 2;
    const edge = edges.find((row) => cleanText(row.fromNodeId) === cleanText(support.nodeId) || cleanText(row.toNodeId) === cleanText(support.nodeId));
    if (edge && viewModel?.edgeRadii?.has(cleanText(edge.id))) {
      odMm = viewModel.edgeRadii.get(cleanText(edge.id)) * 2;
    } else if (edge && edge.diameterMm) {
      odMm = edge.diameterMm;
    }
    const R = odMm * 0.5;

    asArray(support.restraints).map(objectRecord).forEach((restraint, index) => {
      const gap = Math.max(Number(restraint.gap) >= 0 ? Number(restraint.gap) : 0, 0);
      const token = cleanText(restraint.direction || restraint.type).toUpperCase();
      const explicit = { '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1], X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }[token];

      const family = restraintFamily(restraint);

      const arrowLen = Math.max(Math.min(odMm * 0.8, 240), 60) * supportScale;

      const familyColor = RESTRAINT_FAMILY_COLORS[family] ?? 0x22d3ee;
      const pushArrow = (dir, tipPos, kind) => {
        const d = unit(dir) || [1,0,0];
        const shaftStart = sub(tipPos, scale(d, arrowLen));
        const shaftEnd = tipPos; // the shaft connects exactly to the tip

        segments.push({ objectId: cleanText(support.id), start: shaftStart, end: shaftEnd, radiusMm: 7 * supportScale, kind: 'restraint', pathId: cleanText(support.id), colorInt: familyColor });
        markers.push({ objectId: cleanText(support.id), nodeId: cleanText(support.nodeId), kind, position: tipPos, direction: d, restraintKind: cleanText(restraint.kind), restraintFamily: family, restraintIndex: index, sizeMm: 34 * supportScale, isObjectMarker: true, colorInt: kind === 'WARNING' ? 0xfacc15 : familyColor });
      };

      const pipeDim = Math.abs(axis[0]) > 0.9 ? 'X' : Math.abs(axis[verticalAxis === 'Z' ? 2 : 1]) > 0.9 ? verticalAxis : 'Z';
      const offsetDir = pipeDim === verticalAxis ? (verticalAxis === 'Z' ? [1,0,0] : [1,0,0]) : up;

      const pushResolvedArrow = (dir, gapMm, kind) => {
        const isAxial = Math.abs(axis[0]*dir[0] + axis[1]*dir[1] + axis[2]*dir[2]) > 0.99;
        
        let tipPos;
        // 1. Apply engineering contact first
        if (isAxial) {
          // Axial restraints do not use OD/2 radial contact. 
          // No positive gap means opposing axial arrow tips touch. Positive gap means separation = 10×gap.
          tipPos = add(center, scale(dir, -gapMm * 10));
        } else {
          tipPos = add(center, scale(dir, -(R + gapMm)));
        }

        // 2 & 3. Classify final symbol orientation & Apply OD×2/3 visual resolver only to final pipe-parallel / axial symbols.
        if (isAxial) {
          tipPos = add(tipPos, scale(offsetDir, R + 17));
        }

        pushArrow(dir, tipPos, kind);
      };

      if (family === 'HOLDOWN' || family === 'U_BOLT') {
        const directions = [up, opposite(up)];
        for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
          pushResolvedArrow(directions[directionIndex], gap, 'RESTRAINT_ARROW');
        }
        return;
      }

      switch (family) {
        case 'REST':
          pushResolvedArrow(up, gap, 'RESTRAINT_ARROW');
          break;
        case 'GUIDE':
          const laterals = lateralAxes(axis, verticalAxis);
          for (const lat of laterals) {
            pushResolvedArrow(lat, gap, 'RESTRAINT_ARROW');
            pushResolvedArrow(opposite(lat), gap, 'RESTRAINT_ARROW');
          }
          break;
        case 'LINE_STOP':
        case 'LIMIT':
          pushResolvedArrow(axis, gap, 'RESTRAINT_ARROW');
          pushResolvedArrow(opposite(axis), gap, 'RESTRAINT_ARROW');
          break;
        case 'CAN':
        case 'SPRING_WARNING':
        case 'SPRING':
        case 'SPRING_HANGER':
          pushArrow(up, add(center, scale(up, -(R + gap + 17))), 'WARNING');
          if (family === 'SPRING_HANGER') pushResolvedArrow(up, gap, 'RESTRAINT_ARROW');
          break;
        case 'SHOE':
        case 'TRUNNION':
        case 'HANGER':
          pushResolvedArrow(up, gap, 'RESTRAINT_ARROW');
          break;
        case 'ANCHOR':
          pushResolvedArrow(axis, gap, 'RESTRAINT_ARROW');
          pushResolvedArrow(opposite(axis), gap, 'RESTRAINT_ARROW');
          pushResolvedArrow(up, gap, 'RESTRAINT_ARROW');
          pushResolvedArrow(opposite(up), gap, 'RESTRAINT_ARROW');
          break;
        default:
          if (explicit) {
            pushResolvedArrow(explicit, gap, 'RESTRAINT_ARROW');
          }
          break;
      }
    });
  }
  return { segments, markers };
}

/** @param {Record<string, unknown>} viewModel @returns {Record<string, unknown>} */
export function build3dVisualGeometryModel(viewModel) {
  const segments = [], markers = [], nodeMap = new Map(asArray(viewModel.canonicalNodes).map((node) => [cleanText(node.id), node]));
  if (viewModel.visibility.source !== false) {
    for (const component of asArray(viewModel.sourceComponents)) {
      const positions = objectRecord(component.positions), start = positions.APOS, end = positions.LPOS, center = positions.POS;
      const objectId = component.sourceEntityId || component.sourcePath, category = cleanText(component.componentCategory), type = cleanText(component.type);
      const symbolKinds = { VALVE: 'VALVE', FLANGE: 'FLANGE', SUPPORT: 'SUPPORT', REDUCER: 'REDUCER', INST: 'INSTRUMENT_CIRCLE', TEE: 'TEE_DIAMOND' };
      if (category === 'SUPPORT') continue;
      if (viewModel.showComponentSymbols && center && symbolKinds[category]) markers.push({ objectId, kind: symbolKinds[category], position: [center.x, center.y, center.z], sizeMm: 50, isObjectMarker: true });
      else if (start && end) {
        const radiusMm = component.attributes.DIAMETER ? Number(component.attributes.DIAMETER) / 2 : 25, pathId = component.sourceBranch;
        const normCategory = (category === 'ELBO/BEND' || type === 'ELBO' || type === 'BEND') ? 'ELBOW' : category;
        if (center && normCategory === 'ELBOW') {
          if (viewModel.showComponentSymbols) markers.push({ objectId, kind: 'BEND', position: [center.x, center.y, center.z], sizeMm: 50, isObjectMarker: true });
          segments.push({
            objectId,
            start: [start.x, start.y, start.z],
            end: [end.x, end.y, end.z],
            radiusMm,
            kind: 'ELBOW',
            pathId,
            center: [center.x, center.y, center.z],
            attrs: component.attributes ? { ...component.attributes } : null
          });
        } else {
          segments.push({
            objectId,
            start: [start.x, start.y, start.z],
            end: [end.x, end.y, end.z],
            radiusMm,
            kind: normCategory,
            pathId,
            attrs: component.attributes ? { ...component.attributes } : null
          });
        }
      }
    }
  }
  if (viewModel.visibility.canonical !== false) {
    for (const edge of asArray(viewModel.canonicalEdges)) {
      const from = nodeMap.get(cleanText(edge.fromNodeId)), to = nodeMap.get(cleanText(edge.toNodeId));
      if (from && to) segments.push({ objectId: edge.id, start: [from.position.x, from.position.y, from.position.z], end: [to.position.x, to.position.y, to.position.z], radiusMm: edge.diameterMm ? edge.diameterMm / 2 : 30, kind: 'canonical-edge' });
    }
    for (const node of asArray(viewModel.canonicalNodes)) {
      markers.push({ objectId: node.id, kind: 'NODE', position: [node.position.x, node.position.y, node.position.z], nodeId: node.id, sizeMm: 9, pickSizeMm: 28 });
    }
    const restraintGeometry = buildCanonicalRestraintGeometry({ nodes: viewModel.canonicalNodes, edges: viewModel.canonicalEdges, supports: viewModel.supports }, viewModel);
    segments.push(...restraintGeometry.segments); markers.push(...restraintGeometry.markers);
  }
  for (const [visible, rows, kind] of [
    [viewModel.visibility.junctions !== false, viewModel.junctions, 'ANCHOR_JUNCTION'],
    [viewModel.visibility.pointFeatures !== false, viewModel.pointFeatures, 'NODE'],
    [viewModel.visibility.boundaries !== false, viewModel.boundaries, 'NODE'],
  ]) if (visible) for (const row of asArray(rows)) markers.push({ objectId: row.id, kind, position: [row.position.x, row.position.y, row.position.z], nodeId: row.nodeId, sizeMm: 50, isObjectMarker: true });
  if (viewModel.labels) for (const node of asArray(viewModel.canonicalNodes)) markers.push({ objectId: node.id, kind: 'LABEL', position: [node.position.x, node.position.y, node.position.z], label: cleanText(node.id), sizeMm: 0 });
  for (const issue of asArray(viewModel.issues).map(objectRecord)) {
    const id = asArray(issue.canonicalIds).map(cleanText).find((value) => nodeMap.has(value)), node = nodeMap.get(id);
    if (node) markers.push({ objectId: id, kind: 'ISSUE_BADGE', position: [node.position.x, node.position.y, node.position.z], label: cleanText(issue.code) || 'ISSUE', sizeMm: 40, isObjectMarker: true });
  }
  for (const [rows, kind] of [[viewModel.topologyGaps, 'GAP'], [viewModel.topologyOverlaps, 'OVERLAP']]) for (const row of asArray(rows).map(objectRecord)) if (row.position) markers.push({ objectId: row.id || kind.toLowerCase(), kind, position: [row.position.x, row.position.y, row.position.z], sizeMm: 50, isObjectMarker: true });
  const points = [...segments.flatMap((row) => [row.start, row.end]), ...markers.map((row) => row.position)], min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
  return { contract: 'VisualGeometryModel.v1', modelId: 'topology-3d', unit: 'mm', segments, markers, bounds: Number.isFinite(min[0]) ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] } };
}

export const _test = Object.freeze({ unit, pipeAxis, lateralAxes, opposite });

/** CanonicalObjectGraph.v1 → VisualGeometryModel.v1. */

import { CONTRACT_VERSIONS } from '../contracts/contracts.js';
import { buildBendGeometryAudit } from './bend-geometry-audit.js';
import {
  effectiveDiameterByObject, resolveInputXmlBends, trimmedEndpoint,
} from './inputxml-bend-geometry.js';
import {
  resolvePacketMarkerPlacement, resolvePacketPosition,
} from './packet-marker-placement.js';

export { resolvePacketPosition };

const PACKET_MARKER_KINDS = Object.freeze(['RIGID', 'BEND', 'SIF', 'RESTRAINT', 'HANGER', 'SUPPORT']);

function resolvedObjectKind(object) {
  if (object.kind !== 'RIGID') return object.kind;
  const packet = object.packets?.find((item) => item.kind === 'RIGID');
  if (!packet) return object.kind;
  const type = String(packet.attrs?.TYPE || packet.attrs?.type || '').toUpperCase();
  const name = String(object.name || '').toUpperCase();
  if (/VALVE/.test(type) || /VALVE/.test(name)) return 'VALVE';
  if (/FLANGE|FLAN/.test(type) || /FLANGE|FLAN/.test(name)) return 'FLANGE';
  return object.kind;
}

function segmentRadius(object, diameters) {
  const resolved = diameters.get(object.objectId);
  return resolved?.diameterMm ? resolved.diameterMm / 2 : 25;
}

function addObjectSegment(segments, object, nodeCoord, plan, diameters) {
  const rawStart = nodeCoord.get(object.fromNode);
  const rawEnd = nodeCoord.get(object.toNode);
  if (!rawStart || !rawEnd) return;
  const start = trimmedEndpoint(plan, object.objectId, object.fromNode, rawStart);
  const end = trimmedEndpoint(plan, object.objectId, object.toNode, rawEnd);
  if (Math.hypot(...end.map((value, axis) => value - start[axis])) <= 1e-6) return;
  const diameter = diameters.get(object.objectId);
  segments.push({
    objectId: object.objectId,
    start: [...start],
    end: [...end],
    radiusMm: segmentRadius(object, diameters),
    kind: resolvedObjectKind(object),
    pathId: object.pathId,
    center: object.attrs?.centerPoint || object.attrs?.centrePoint || object.attrs?.center || object.attrs?.centre || null,
    attrs: { ...(object.attrs ?? {}), diameterSource: diameter?.source ?? 'UNRESOLVED' },
  });
}

function addArcSegments(segments, graph, plan, diameters) {
  const objectById = new Map(graph.objects.map((object) => [object.objectId, object]));
  for (const arc of plan.arcs) {
    const object = objectById.get(arc.objectId);
    if (!object) continue;
    for (let index = 0; index < arc.points.length - 1; index += 1) {
      segments.push({
        objectId: object.objectId,
        start: [...arc.points[index]],
        end: [...arc.points[index + 1]],
        radiusMm: segmentRadius(object, diameters),
        kind: 'BEND',
        pathId: object.pathId,
        center: [...arc.center],
        attrs: {
          bendGeometry: 'EXPLICIT_RADIUS_ARC',
          bendRadiusMm: arc.radiusMm,
          bendAngleDeg: arc.angleDeg,
          bendCornerNode: arc.cornerNode,
          bendDirectionEvidence: arc.directionEvidence,
          bendPacketSource: arc.packetSource,
          bendIncomingObjectId: arc.incomingObjectId,
          bendOutgoingObjectId: arc.outgoingObjectId,
          arcPart: `${index + 1}/${arc.points.length - 1}`,
        },
      });
    }
  }
}

function addObjectMarker(markers, object, position, markerSize) {
  markers.push({
    objectId: object.objectId,
    kind: 'NODE',
    nodeId: object.fromNode,
    position: [...position],
    isObjectMarker: true,
    sizeMm: markerSize ?? 60,
  });
}

function addPacketMarkers(markers, object, nodeCoord, options) {
  for (const packet of object.packets ?? []) {
    if (!options.allowedKinds.includes(packet.kind)) continue;
    const resolved = resolvePacketMarkerPlacement(packet, object, nodeCoord, options.placement);
    markers.push({
      objectId: object.objectId,
      kind: packet.kind,
      position: resolved.position,
      nodeId: resolved.resolvedNodeId,
      fallback: resolved.fallback,
      placementEvidence: resolved.placementEvidence,
      consumedFrom: packet.consumedFrom ?? null,
      sizeMm: options.markerSize ?? undefined,
    });
  }
}

function addGraphMarkers(markers, graph, markerSize, showAllNodes) {
  for (const anchor of graph.anchors ?? []) {
    markers.push({ objectId: null, kind: `ANCHOR_${anchor.anchorType}`, position: [...anchor.coordMm], nodeId: anchor.nodeId });
  }
  if (!showAllNodes) return;
  const anchorIds = new Set((graph.anchors ?? []).map((anchor) => anchor.nodeId));
  for (const node of graph.nodes ?? []) {
    if (anchorIds.has(node.nodeId)) continue;
    markers.push({ objectId: null, kind: 'NODE', position: [...node.coordMm], nodeId: node.nodeId, sizeMm: markerSize ?? 24 });
  }
}

export function buildVisualModel(graph, options = {}) {
  const settings = {
    placement: options.markerPlacement ?? 'mid',
    allowedKinds: Array.isArray(options.packetMarkerKinds) ? options.packetMarkerKinds : PACKET_MARKER_KINDS,
    markerSize: Number.isFinite(options.nodeMarkerSizeMm) ? options.nodeMarkerSizeMm : null,
  };
  const nodeCoord = new Map(graph.nodes.map((node) => [node.nodeId, node.coordMm]));
  const bendPlan = resolveInputXmlBends(graph);
  const bendAudit = buildBendGeometryAudit(graph, bendPlan);
  const diameters = effectiveDiameterByObject(graph.objects);
  const segments = [];
  const markers = [];
  for (const object of graph.objects) {
    const start = nodeCoord.get(object.fromNode);
    const isPoint = object.fromNode === object.toNode || object.lengthMm === 0;
    if (isPoint && start) addObjectMarker(markers, object, start, settings.markerSize);
    else addObjectSegment(segments, object, nodeCoord, bendPlan, diameters);
    addPacketMarkers(markers, object, nodeCoord, settings);
  }
  addArcSegments(segments, graph, bendPlan, diameters);
  addGraphMarkers(markers, graph, settings.markerSize, options.showAllNodes);
  return {
    contract: CONTRACT_VERSIONS.VisualGeometryModel,
    modelId: graph.modelId,
    unit: 'mm',
    segments,
    markers,
    bendSummary: bendPlan.summary,
    bendAudit,
    geometryDiagnostics: bendPlan.diagnostics,
    bounds: computeBounds(segments, markers),
  };
}

function computeBounds(segments, markers = []) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const include = (point) => {
    for (let axis = 0; axis < 3; axis += 1) {
      if (point[axis] < min[axis]) min[axis] = point[axis];
      if (point[axis] > max[axis]) max[axis] = point[axis];
    }
  };
  for (const segment of segments) { include(segment.start); include(segment.end); }
  for (const marker of markers) include(marker.position);
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

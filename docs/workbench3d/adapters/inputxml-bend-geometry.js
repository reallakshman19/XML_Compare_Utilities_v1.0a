/** Pure CAESAR InputXML bend reconstruction for Workbench visual geometry. */

import { resolveSourceOrientation } from './source-element-orientation.js';
import { resolveConsumedPacketAncestry } from './source-packet-ancestry.js';

const RADIUS_KEYS = Object.freeze([
  'RADIUS', 'BEND_RADIUS', 'BENDRADIUS', 'BEND_RAD',
  'BENDRAD', 'CURVE_RADIUS', 'CURVERADIUS', 'R',
]);
const MIN_LENGTH_MM = 1e-3;
const MIN_ANGLE_RAD = Math.PI / 360;
const MAX_ANGLE_RAD = Math.PI - MIN_ANGLE_RAD;
const ARC_STEP_RAD = Math.PI / 24;
const MAX_ARC_STEPS = 48;

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(vector, factor) { return vector.map((value) => value * factor); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function length(vector) { return Math.hypot(...vector); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value) { return Number(value.toFixed(6)); }
function roundPoint(point) { return point.map(round); }

function normalize(vector) {
  const magnitude = length(vector);
  return magnitude > MIN_LENGTH_MM ? scale(vector, 1 / magnitude) : null;
}

function rotateAroundAxis(vector, axis, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return add(
    add(scale(vector, cosine), scale(cross(axis, vector), sine)),
    scale(axis, dot(axis, vector) * (1 - cosine)),
  );
}

function numericAttribute(attrs, names) {
  for (const name of names) {
    const key = Object.keys(attrs ?? {}).find((candidate) => candidate.toUpperCase() === name);
    if (!key) continue;
    const value = Number(String(attrs[key]).trim());
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function endpoints(object) { return [object.fromNode, object.toNode]; }
function otherNode(object, nodeId) {
  if (object.fromNode === nodeId) return object.toNode;
  if (object.toNode === nodeId) return object.fromNode;
  return null;
}

function bendOccurrences(graph) {
  return graph.objects.flatMap((object) => (object.packets ?? [])
    .map((packet, packetIndex) => ({ object, packet, packetIndex }))
    .filter((item) => item.packet.kind === 'BEND'));
}

function objectsAtNode(objects, nodeId, excludedIds = new Set()) {
  return objects.filter((object) => !excludedIds.has(object.objectId)
    && object.lengthMm > MIN_LENGTH_MM
    && endpoints(object).includes(nodeId));
}

function buildArcPoints(center, tangentStart, normal, angle) {
  const radial = sub(tangentStart, center);
  const steps = Math.min(MAX_ARC_STEPS, Math.max(6, Math.ceil(angle / ARC_STEP_RAD)));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = add(center, rotateAroundAxis(radial, normal, angle * index / steps));
    return roundPoint(point);
  });
}

function blocked(occurrence, code, message, details = {}) {
  return {
    objectId: occurrence.object.objectId,
    packetIndex: occurrence.packetIndex,
    severity: 'BLOCKED',
    code,
    message,
    ...details,
  };
}

function orientationDiagnostic(occurrence, direction) {
  return blocked(occurrence, direction.code, direction.message);
}

function sameLine(object, lineId) {
  return !lineId || !object.lineId || object.lineId === lineId;
}

function classifyConsumedLegs(graph, ancestry) {
  const incoming = [];
  const outgoing = [];
  for (const object of objectsAtNode(graph.objects, ancestry.cornerNode)) {
    if (!sameLine(object, ancestry.lineId)) continue;
    const direction = resolveSourceOrientation(object);
    if (!direction.ok || !Number.isInteger(direction.rawIndex)) continue;
    if (direction.toNode === ancestry.cornerNode && direction.rawIndex < ancestry.rawIndex) incoming.push(object);
    if (direction.fromNode === ancestry.cornerNode && direction.rawIndex > ancestry.rawIndex) outgoing.push(object);
  }
  return { incoming, outgoing };
}

function consumedLegDiagnostic(occurrence, ancestry, legs) {
  return blocked(
    occurrence,
    'BEND_CONSUMED_LEGS_AMBIGUOUS',
    `Consumed bend requires one incoming and one outgoing source leg; found ${legs.incoming.length}/${legs.outgoing.length}.`,
    { cornerNode: ancestry.cornerNode, incomingCount: legs.incoming.length, outgoingCount: legs.outgoing.length },
  );
}

function resolveConsumedBend(graph, occurrence, nodeCoord, radiusMm) {
  const ancestry = resolveConsumedPacketAncestry(occurrence.packet);
  if (!ancestry.ok) return { diagnostic: orientationDiagnostic(occurrence, ancestry) };
  const legs = classifyConsumedLegs(graph, ancestry);
  if (legs.incoming.length !== 1 || legs.outgoing.length !== 1 || legs.incoming[0] === legs.outgoing[0]) {
    return { diagnostic: consumedLegDiagnostic(occurrence, ancestry, legs) };
  }
  return resolveLegGeometry(
    occurrence, legs.incoming[0], legs.outgoing[0], ancestry.cornerNode,
    ancestry.evidence, nodeCoord, radiusMm,
  );
}

function resolveNativeBend(graph, occurrence, nodeCoord, radiusMm) {
  const direction = resolveSourceOrientation(occurrence.object);
  if (!direction.ok) return { diagnostic: orientationDiagnostic(occurrence, direction) };
  const adjacent = objectsAtNode(graph.objects, direction.toNode, new Set([occurrence.object.objectId]));
  if (adjacent.length !== 1) {
    return { diagnostic: blocked(occurrence, 'BEND_ADJACENCY_AMBIGUOUS', `Expected one outgoing element at bend node; found ${adjacent.length}.`) };
  }
  return resolveLegGeometry(
    occurrence, occurrence.object, adjacent[0], direction.toNode,
    direction.evidence, nodeCoord, radiusMm,
  );
}

function resolveLegGeometry(occurrence, incomingObject, outgoingObject, cornerNode, evidence, nodeCoord, radiusMm) {
  const previousNode = otherNode(incomingObject, cornerNode);
  const nextNode = otherNode(outgoingObject, cornerNode);
  const previous = nodeCoord.get(previousNode);
  const corner = nodeCoord.get(cornerNode);
  const next = nodeCoord.get(nextNode);
  if (!previous || !corner) return { diagnostic: blocked(occurrence, 'BEND_NODE_MISSING', 'Bend endpoint coordinates are unavailable.') };
  if (!next) return { diagnostic: blocked(occurrence, 'BEND_OUTGOING_NODE_MISSING', 'Outgoing bend coordinate is unavailable.') };
  return resolveArc(
    occurrence, incomingObject, outgoingObject, cornerNode,
    evidence, previous, corner, next, radiusMm,
  );
}

function resolveArc(occurrence, incomingObject, outgoingObject, cornerNode, evidence, previous, corner, next, radiusMm) {
  const incoming = normalize(sub(corner, previous));
  const outgoing = normalize(sub(next, corner));
  if (!incoming || !outgoing) return { diagnostic: blocked(occurrence, 'BEND_ZERO_LENGTH', 'Bend legs must have non-zero length.') };
  const angle = Math.acos(clamp(dot(incoming, outgoing), -1, 1));
  if (angle <= MIN_ANGLE_RAD || angle >= MAX_ANGLE_RAD) {
    return { diagnostic: blocked(occurrence, 'BEND_ANGLE_INVALID', 'Bend turn angle is degenerate.', { angleDeg: round(angle * 180 / Math.PI) }) };
  }
  return resolveSizedArc(
    occurrence, incomingObject, outgoingObject, cornerNode,
    evidence, previous, corner, next, incoming, outgoing, angle, radiusMm,
  );
}

function resolveSizedArc(occurrence, incomingObject, outgoingObject, cornerNode, evidence, previous, corner, next, incoming, outgoing, angle, radiusMm) {
  const tangentMm = radiusMm * Math.tan(angle / 2);
  const incomingLength = length(sub(corner, previous));
  const outgoingLength = length(sub(next, corner));
  if (tangentMm >= incomingLength - MIN_LENGTH_MM || tangentMm >= outgoingLength - MIN_LENGTH_MM) {
    return { diagnostic: blocked(occurrence, 'BEND_RADIUS_EXCEEDS_LEGS', 'Explicit bend radius cannot fit the connected straight lengths.', { radiusMm, tangentMm: round(tangentMm) }) };
  }
  const tangentStart = add(corner, scale(incoming, -tangentMm));
  const tangentEnd = add(corner, scale(outgoing, tangentMm));
  const normal = normalize(cross(incoming, outgoing));
  if (!normal) return { diagnostic: blocked(occurrence, 'BEND_PLANE_UNRESOLVED', 'Bend plane cannot be resolved.') };
  const center = add(tangentStart, scale(cross(normal, incoming), radiusMm));
  const points = buildArcPoints(center, tangentStart, normal, angle);
  points[0] = roundPoint(tangentStart);
  points[points.length - 1] = roundPoint(tangentEnd);
  return { arc: arcRecord(occurrence, incomingObject, outgoingObject, cornerNode, evidence, center, points, radiusMm, angle, tangentMm) };
}

function arcRecord(occurrence, incomingObject, outgoingObject, cornerNode, evidence, center, points, radiusMm, angle, tangentMm) {
  return {
    objectId: occurrence.object.objectId,
    incomingObjectId: incomingObject.objectId,
    outgoingObjectId: outgoingObject.objectId,
    adjacentObjectId: outgoingObject.objectId,
    cornerNode,
    radiusMm: round(radiusMm),
    angleDeg: round(angle * 180 / Math.PI),
    tangentMm: round(tangentMm),
    center: roundPoint(center),
    points,
    directionEvidence: evidence,
    packetSource: occurrence.packet.sourceAncestry ? 'CONSUMED_SHORT_ELEMENT' : 'HOST_ELEMENT',
  };
}

function consumedOccurrenceKey(occurrence) {
  if (!occurrence.packet.sourceAncestry && !occurrence.packet.consumedFrom) return null;
  const ancestry = resolveConsumedPacketAncestry(occurrence.packet);
  return ancestry.ok ? `${ancestry.lineId}\u0000${ancestry.cornerNode}` : null;
}

function duplicateConsumedKeys(occurrences) {
  const counts = new Map();
  for (const occurrence of occurrences) {
    const key = consumedOccurrenceKey(occurrence);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

function duplicateConsumedDiagnostic(occurrence, key, occurrences) {
  const count = occurrences.filter((item) => consumedOccurrenceKey(item) === key).length;
  return blocked(
    occurrence,
    'BEND_CONSUMED_PACKET_AMBIGUOUS',
    `Multiple consumed bend packets resolve to the same normalized corner; found ${count}.`,
    { consumedPacketCount: count },
  );
}

function resolveOneBend(graph, occurrence, nodeCoord) {
  const radiusMm = numericAttribute(occurrence.packet.attrs, RADIUS_KEYS);
  if (!radiusMm) return { diagnostic: blocked(occurrence, 'BEND_RADIUS_MISSING', 'Explicit positive bend radius is required.') };
  if (occurrence.packet.sourceAncestry || occurrence.packet.consumedFrom) {
    return resolveConsumedBend(graph, occurrence, nodeCoord, radiusMm);
  }
  return resolveNativeBend(graph, occurrence, nodeCoord, radiusMm);
}

function endpointKey(objectId, nodeId) { return `${objectId}\u0000${nodeId}`; }

export function effectiveDiameterByObject(objects) {
  const ordered = [...objects].sort((a, b) => (a.rawIndex ?? 0) - (b.rawIndex ?? 0));
  const result = new Map();
  let activeLine = null;
  let current = null;
  for (const object of ordered) {
    if (object.lineId && object.lineId !== activeLine) { activeLine = object.lineId; current = null; }
    const explicit = Number(object.diameterMm);
    if (Number.isFinite(explicit) && explicit > 0) current = explicit;
    result.set(object.objectId, {
      diameterMm: current,
      source: Number.isFinite(explicit) && explicit > 0 ? 'EXPLICIT' : current ? 'INHERITED' : 'UNRESOLVED',
    });
  }
  return result;
}

export function resolveInputXmlBends(graph) {
  const nodeCoord = new Map(graph.nodes.map((node) => [node.nodeId, node.coordMm]));
  const arcs = [];
  const diagnostics = [];
  const trims = new Map();
  const occurrences = bendOccurrences(graph);
  const duplicateKeys = duplicateConsumedKeys(occurrences);
  for (const occurrence of occurrences) {
    const consumedKey = consumedOccurrenceKey(occurrence);
    if (consumedKey && duplicateKeys.has(consumedKey)) {
      diagnostics.push(duplicateConsumedDiagnostic(occurrence, consumedKey, occurrences));
      continue;
    }
    const result = resolveOneBend(graph, occurrence, nodeCoord);
    if (result.diagnostic) { diagnostics.push(result.diagnostic); continue; }
    const arc = result.arc;
    arcs.push(arc);
    trims.set(endpointKey(arc.incomingObjectId, arc.cornerNode), arc.points[0]);
    trims.set(endpointKey(arc.outgoingObjectId, arc.cornerNode), arc.points.at(-1));
  }
  return {
    arcs,
    diagnostics,
    trims,
    summary: {
      requested: occurrences.length,
      resolved: arcs.length,
      blocked: diagnostics.length,
      arcSegments: arcs.reduce((sum, arc) => sum + arc.points.length - 1, 0),
    },
  };
}

export function trimmedEndpoint(plan, objectId, nodeId, fallback) {
  return plan.trims.get(endpointKey(objectId, nodeId)) ?? fallback;
}

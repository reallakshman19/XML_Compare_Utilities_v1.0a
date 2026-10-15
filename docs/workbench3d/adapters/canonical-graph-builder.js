/**
 * canonical-graph-builder.js — raw element records → CanonicalObjectGraph.v1.
 *
 * Responsibilities (Phase 1):
 *  - derive absolute node coordinates from relative DELTA vectors
 *  - consume short/zero elements within tolerance (preserving packet evidence)
 *  - derive anchors (endpoints / branch nodes), paths (anchor→anchor chains),
 *    path stations, and hierarchy grouping
 *
 * Pure module: no DOM, no rendering, no matching.
 */

import { CONTRACT_VERSIONS } from '../contracts/contracts.js';
import { buildSourceOrientation, captureSourceRecord } from './source-element-orientation.js';
import { consumeShortElements } from './short-element-normalizer.js';

function addVec(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

/**
 * Walk the element graph to assign absolute coordinates per node.
 * Disconnected components each start at origin; componentId recorded per node.
 */
function solveNodeCoordinates(records) {
  const adjacency = new Map();
  const pushEdge = (node, record, forward) => {
    if (!adjacency.has(node)) adjacency.set(node, []);
    adjacency.get(node).push({ record, forward });
  };
  for (const record of records) {
    if (!record.fromNode || !record.toNode) continue;
    pushEdge(record.fromNode, record, true);
    pushEdge(record.toNode, record, false);
  }
  const coords = new Map();
  const componentOf = new Map();
  let componentIndex = 0;
  for (const startNode of adjacency.keys()) {
    if (coords.has(startNode)) continue;
    componentIndex += 1;
    const componentId = `C${componentIndex}`;
    coords.set(startNode, [0, 0, 0]);
    componentOf.set(startNode, componentId);
    const queue = [startNode];
    while (queue.length) {
      const node = queue.shift();
      const base = coords.get(node);
      for (const { record, forward } of adjacency.get(node) ?? []) {
        const other = forward ? record.toNode : record.fromNode;
        if (coords.has(other)) continue;
        const delta = forward ? record.deltaMm : record.deltaMm.map((value) => -value);
        coords.set(other, addVec(base, delta));
        componentOf.set(other, componentId);
        queue.push(other);
      }
    }
  }
  return { coords, componentOf };
}

function recordsByNode(records) {
  const byNode = new Map();
  for (const record of records) {
    for (const node of [record.fromNode, record.toNode]) {
      if (!byNode.has(node)) byNode.set(node, []);
      byNode.get(node).push(record);
    }
  }
  return byNode;
}

function walkPath(startNode, firstRecord, byNode, isAnchor, visited) {
  const elements = [];
  let node = startNode;
  let record = firstRecord;
  while (record && !visited.has(record)) {
    visited.add(record);
    const forward = record.fromNode === node;
    node = forward ? record.toNode : record.fromNode;
    elements.push({ record, forward });
    if (isAnchor(node)) break;
    record = (byNode.get(node) ?? []).find((item) => !visited.has(item));
  }
  return { elements, endNode: node };
}

function appendAnchorPaths(paths, byNode, isAnchor, visited) {
  const anchorNodes = Array.from(byNode.keys()).filter(isAnchor);
  for (const anchor of anchorNodes) {
    for (const record of byNode.get(anchor) ?? []) {
      if (visited.has(record)) continue;
      const result = walkPath(anchor, record, byNode, isAnchor, visited);
      if (result.elements.length) paths.push({ startNode: anchor, ...result });
    }
  }
}

function appendLoopPaths(paths, records, byNode, isAnchor, visited) {
  for (const record of records) {
    if (visited.has(record)) continue;
    const result = walkPath(record.fromNode, record, byNode, isAnchor, visited);
    if (result.elements.length) paths.push({ startNode: record.fromNode, ...result });
  }
}

function buildPaths(records, degree) {
  const isAnchor = (node) => (degree.get(node) ?? 0) !== 2;
  const byNode = recordsByNode(records);
  const visited = new Set();
  const paths = [];
  appendAnchorPaths(paths, byNode, isAnchor, visited);
  appendLoopPaths(paths, records, byNode, isAnchor, visited);
  return paths;
}

function anchorType(node, degree, restraintNodes) {
  const deg = degree.get(node) ?? 0;
  if (restraintNodes.has(node)) return deg >= 3 ? 'BRANCH+RESTRAINT' : 'RESTRAINT';
  if (deg >= 3) return 'BRANCH';
  if (deg === 1) return 'ENDPOINT';
  return 'ROUTE';
}

function copyRecord(record) {
  return {
    ...record,
    deltaMm: [...record.deltaMm],
    packets: record.packets.map((packet) => ({ ...packet, attrs: { ...packet.attrs } })),
    properties: { ...record.properties },
    blocks: record.blocks ?? null,
    sourceRecord: captureSourceRecord(record),
  };
}

function objectKind(record) {
  if (record.componentType) return record.componentType;
  if (record.packets.some((packet) => packet.kind === 'RIGID')) return 'RIGID';
  return record.packets.some((packet) => packet.kind === 'BEND') ? 'BEND' : 'PIPE';
}

function buildObject(modelId, record, forward, pathId, sequence, stationMm, objectNumber) {
  const startNode = forward ? record.fromNode : record.toNode;
  const endNode = forward ? record.toNode : record.fromNode;
  return {
    objectId: `${modelId}:E${objectNumber}`,
    kind: objectKind(record),
    fromNode: startNode,
    toNode: endNode,
    canonicalFromTo: `${startNode}->${endNode}`,
    sourceOrientation: buildSourceOrientation(record, forward),
    lengthMm: Number(record.lengthMm.toFixed(3)),
    diameterMm: Number.isFinite(record.diameterMm) ? record.diameterMm : null,
    wallThickMm: Number.isFinite(record.wallThickMm) ? record.wallThickMm : null,
    name: record.name,
    lineId: record.lineId,
    pathId,
    pathSequence: sequence,
    stationMm: Number(stationMm.toFixed(3)),
    packets: record.packets,
    properties: record.properties,
    blocks: record.blocks ?? null,
    rawIndex: record.index,
  };
}

function buildPath(modelId, path, pathIndex, objects, degree, restraintNodes) {
  const pathId = `${modelId}:P${pathIndex + 1}`;
  const elementIds = [];
  let station = 0;
  let totalLength = 0;
  path.elements.forEach(({ record, forward }, sequence) => {
    const object = buildObject(modelId, record, forward, pathId, sequence, station, objects.length + 1);
    station += record.lengthMm;
    totalLength += record.lengthMm;
    objects.push(object);
    elementIds.push(object.objectId);
  });
  return {
    pathId,
    startNode: path.startNode,
    endNode: path.endNode,
    startAnchorType: anchorType(path.startNode, degree, restraintNodes),
    endAnchorType: anchorType(path.endNode, degree, restraintNodes),
    elementIds,
    elementCount: elementIds.length,
    totalLengthMm: Number(totalLength.toFixed(3)),
    packetSequence: path.elements.flatMap(({ record }) => record.packets.map((packet) => packet.kind)).join('>'),
  };
}

function buildHierarchy(objects, paths) {
  const lineIds = Array.from(new Set(objects.map((object) => object.lineId || '(model)')));
  return lineIds.map((lineId) => ({
    lineId,
    paths: paths
      .filter((path) => objects.some((object) => object.pathId === path.pathId && (object.lineId || '(model)') === lineId))
      .map((path) => ({ pathId: path.pathId, elementIds: path.elementIds })),
  }));
}

function degreeByNode(records) {
  const degree = new Map();
  for (const record of records) {
    degree.set(record.fromNode, (degree.get(record.fromNode) ?? 0) + 1);
    degree.set(record.toNode, (degree.get(record.toNode) ?? 0) + 1);
  }
  return degree;
}

function restraintNodeIds(records) {
  const nodes = new Set();
  for (const record of records) {
    for (const packet of record.packets) {
      if (packet.kind === 'RESTRAINT' && packet.attrs.NODE) nodes.add(String(Math.round(Number(packet.attrs.NODE))));
    }
  }
  return nodes;
}

function canonicalNodes(coords, componentOf, degree, restraintNodes) {
  return Array.from(coords.entries()).map(([nodeId, coordinates]) => ({
    nodeId,
    coordMm: coordinates.map((value) => Number(value.toFixed(3))),
    degree: degree.get(nodeId) ?? 0,
    componentId: componentOf.get(nodeId) ?? 'C1',
    anchorType: anchorType(nodeId, degree, restraintNodes),
  }));
}

/** Build CanonicalObjectGraph.v1 from raw records. */
export function buildCanonicalGraph(modelId, rawRecords, options = {}) {
  const toleranceMm = Number(options.shortElementToleranceMm ?? 6);
  const records = rawRecords.map(copyRecord);
  const { surviving, consumedRows } = consumeShortElements(records, toleranceMm);
  const { coords, componentOf } = solveNodeCoordinates(surviving);
  const degree = degreeByNode(surviving);
  const restraintNodes = restraintNodeIds(surviving);
  const objects = [];
  const rawPaths = buildPaths(surviving, degree);
  const paths = rawPaths.map((path, index) => buildPath(modelId, path, index, objects, degree, restraintNodes));
  const nodes = canonicalNodes(coords, componentOf, degree, restraintNodes);
  const anchors = nodes.filter((node) => node.anchorType !== 'ROUTE');
  return {
    contract: CONTRACT_VERSIONS.CanonicalObjectGraph,
    modelId,
    unit: 'mm',
    rawElementCount: rawRecords.length,
    canonicalElementCount: objects.length,
    consumedRows,
    normalizationRule: `consume elements with length <= ${toleranceMm} mm; packets re-attach to nearest surviving element`,
    objects,
    nodes,
    anchors,
    paths,
    hierarchy: buildHierarchy(objects, paths),
  };
}

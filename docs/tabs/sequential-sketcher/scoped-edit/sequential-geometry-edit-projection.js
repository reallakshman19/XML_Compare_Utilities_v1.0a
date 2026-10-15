/** Deterministic effective scene and topology projection from geometry journal authority. */
import { createEngineeringScene, validateEngineeringScene } from '../../../core/engineering-scene/index.js';
import { translateEngineeringGeometry } from '../../../core/engineering-svg/engineering-svg-precision-geometry.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import {
  assertSequentialGeometryEditJournal,
  SEQUENTIAL_GEOMETRY_EDIT_ENTRY_SCHEMA,
  SEQUENTIAL_GEOMETRY_EDIT_TYPE,
} from './sequential-geometry-edit-journal.js';
import {
  projectSequentialStretchConnections,
  projectSequentialStretchNode,
  validateSequentialStretchEntryPairs,
  validateSequentialStretchTopology,
} from './sequential-node-stretch-projection.js';
import {
  projectSequentialRotationConnections,
  projectSequentialRotationNode,
  validateSequentialRotationEntryPairs,
  validateSequentialRotationTopology,
} from './sequential-rotation-projection.js';

export const SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION = Object.freeze({
  ENTRY_STALE: 'SEQUENTIAL_GEOMETRY_EDIT_ENTRY_STALE',
  TARGET_INVALID: 'SEQUENTIAL_GEOMETRY_EDIT_TARGET_INVALID',
  TRANSFORM_INVALID: 'SEQUENTIAL_GEOMETRY_EDIT_TRANSFORM_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function add(point, delta) {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}
function byId(rows, key) { return new Map(rows.map((row) => [row[key], row])); }
function assertEntry(entry) {
  if (entry?.schema !== SEQUENTIAL_GEOMETRY_EDIT_ENTRY_SCHEMA
    || !Object.values(SEQUENTIAL_GEOMETRY_EDIT_TYPE).includes(entry.type)) {
    fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.TARGET_INVALID,
      'Effective projection requires one canonical geometry edit entry.', TypeError);
  }
  return entry;
}
function assertPosition(before, after, expected, label) {
  if (!sameSequentialContractValue(expected, after?.position)) fail(
    SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.TRANSFORM_INVALID,
    `${label} after position differs from canonical regeneration.`);
}
function entryMaps(entry) {
  return {
    beforeParts: byId(entry.before.geometryParts, 'geometryPartId'),
    afterParts: byId(entry.after.geometryParts, 'geometryPartId'),
    beforePorts: byId(entry.before.ports, 'portId'),
    afterPorts: byId(entry.after.ports, 'portId'),
    beforeNodes: byId(entry.before.nodes, 'nodeId'),
    afterNodes: byId(entry.after.nodes, 'nodeId'),
  };
}
function validateMovePairs(entry, maps) {
  for (const before of maps.beforeParts.values()) {
    const expected = translateEngineeringGeometry(before.geometry, entry.delta);
    if (!sameSequentialContractValue(expected, maps.afterParts.get(before.geometryPartId)?.geometry)) {
      fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.TRANSFORM_INVALID,
        `Geometry part ${before.geometryPartId} is not the exact journal translation.`);
    }
  }
  for (const before of maps.beforePorts.values()) {
    assertPosition(before, maps.afterPorts.get(before.portId), add(before.position, entry.delta),
      `Port ${before.portId}`);
  }
  for (const before of maps.beforeNodes.values()) {
    assertPosition(before, maps.afterNodes.get(before.nodeId), add(before.position, entry.delta),
      `Node ${before.nodeId}`);
  }
}
function validateEntryPairs(entry, maps) {
  if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.MOVE_COMPONENT) {
    validateMovePairs(entry, maps);
  } else if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.STRETCH_NODE) {
    validateSequentialStretchEntryPairs(entry, maps);
  } else {
    validateSequentialRotationEntryPairs(entry, maps);
  }
}
function allowedComponents(entry) {
  return new Set(entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.MOVE_COMPONENT
    ? [entry.componentId] : entry.affectedComponentIds);
}
function projectSceneEntry(scene, entryInput) {
  const entry = assertEntry(entryInput); const maps = entryMaps(entry);
  validateEntryPairs(entry, maps); const components = allowedComponents(entry);
  const entities = scene.entities.map((entity) => {
    const before = maps.beforeParts.get(entity.id);
    if (!before) return entity;
    if (entity.domainRef?.category !== 'confirmed'
      || !components.has(entity.domainRef?.componentId)
      || !sameSequentialContractValue(entity.geometry, before.geometry)) {
      fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.ENTRY_STALE,
        `Scene geometry is stale for journal part ${entity.id}.`);
    }
    return {
      ...entity,
      geometry: maps.afterParts.get(entity.id).geometry,
      metadata: { ...entity.metadata, sequentialGeometryEdit: {
        entryId: entry.entryId, operationId: entry.operationId, type: entry.type,
        componentId: entry.componentId, nodeId: entry.nodeId || null,
        scope: entry.scope || null,
      } },
    };
  });
  if (maps.beforeParts.size !== entities.filter((row) => maps.beforeParts.has(row.id)).length) {
    fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.ENTRY_STALE,
      `Scene is missing journal geometry for operation ${entry.operationId}.`);
  }
  return createEngineeringScene({ ...scene, entities });
}
export function applySequentialGeometryEditJournalToScene(sceneInput, journalInput, options = {}) {
  let scene = validateEngineeringScene(sceneInput);
  for (const entry of journalInput.entries || []) scene = projectSceneEntry(scene, entry);
  return createEngineeringScene({
    ...scene,
    sceneId: String(options.sceneId || scene.sceneId),
    revision: options.revision || scene.revision,
    metadata: { ...scene.metadata, sequentialGeometryEdit: {
      journalHeadFingerprint: journalInput.headFingerprint,
      entryCount: journalInput.entries?.length || 0,
    } },
  });
}
function currentTopologyMaps(snapshot) {
  return { components: byId(snapshot.components, 'componentId'),
    parts: byId(snapshot.geometryParts, 'geometryPartId'),
    ports: byId(snapshot.ports, 'portId'), nodes: byId(snapshot.nodes, 'nodeId') };
}
function validateCurrentParts(maps, evidence, components) {
  for (const before of evidence.beforeParts.values()) {
    const current = maps.parts.get(before.geometryPartId);
    if (!current || !components.has(current.componentId)
      || !sameSequentialContractValue(current.geometry, before.geometry)) {
      fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.ENTRY_STALE,
        `Topology geometry is stale for ${before.geometryPartId}.`);
    }
  }
}
function validateMoveTopology(snapshot, entry, maps, evidence) {
  const component = maps.components.get(entry.componentId);
  if (!component || component.supportAttachmentIds.length
    || snapshot.componentBoundaryCuts.some((row) => row.componentId === entry.componentId)) {
    fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.TARGET_INVALID,
      `Journal component is no longer an isolated unsupported target: ${entry.componentId}`);
  }
  validateCurrentParts(maps, evidence, allowedComponents(entry));
  for (const before of evidence.beforePorts.values()) {
    const current = maps.ports.get(before.portId);
    if (current?.componentId !== entry.componentId
      || !sameSequentialContractValue(current.position, before.position)) {
      fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.ENTRY_STALE,
        `Topology port is stale for ${before.portId}.`);
    }
  }
  for (const before of evidence.beforeNodes.values()) {
    const current = maps.nodes.get(before.nodeId);
    if (!current || current.incidentComponentIds.some((id) => id !== entry.componentId)
      || !sameSequentialContractValue(current.position, before.position)) {
      fail(SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.ENTRY_STALE,
        `Topology node is stale or shared: ${before.nodeId}.`);
    }
  }
}
function validateTopologyEntry(snapshot, entryInput, maps) {
  const entry = assertEntry(entryInput); const evidence = entryMaps(entry);
  validateEntryPairs(entry, evidence);
  if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.MOVE_COMPONENT) {
    validateMoveTopology(snapshot, entry, maps, evidence);
  } else if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.STRETCH_NODE) {
    validateSequentialStretchTopology(snapshot, entry, maps, evidence);
  } else {
    validateSequentialRotationTopology(snapshot, entry, maps, evidence);
  }
  return evidence;
}
function projectedNodes(snapshot, entry, evidence) {
  if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.STRETCH_NODE) {
    return snapshot.nodes.map((row) => projectSequentialStretchNode(row, evidence));
  }
  if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.ROTATE_SUBGRAPH) {
    return snapshot.nodes.map((row) => projectSequentialRotationNode(row, evidence));
  }
  return snapshot.nodes.map((row) => (evidence.afterNodes.has(row.nodeId)
    ? { ...row, position: evidence.afterNodes.get(row.nodeId).position,
      positionProvenance: 'GEOMETRY_EDIT_JOURNAL' } : row));
}
function projectedConnections(snapshot, entry, evidence) {
  if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.STRETCH_NODE) {
    return projectSequentialStretchConnections(snapshot.committedConnections, evidence);
  }
  if (entry.type === SEQUENTIAL_GEOMETRY_EDIT_TYPE.ROTATE_SUBGRAPH) {
    return projectSequentialRotationConnections(snapshot.committedConnections, evidence);
  }
  return snapshot.committedConnections;
}
function projectTopologyEntry(snapshot, entry) {
  const evidence = validateTopologyEntry(snapshot, entry, currentTopologyMaps(snapshot));
  return {
    ...snapshot,
    geometryParts: snapshot.geometryParts.map((row) => (evidence.afterParts.has(row.geometryPartId)
      ? { ...row, geometry: evidence.afterParts.get(row.geometryPartId).geometry } : row)),
    ports: snapshot.ports.map((row) => (evidence.afterPorts.has(row.portId)
      ? { ...row, position: evidence.afterPorts.get(row.portId).position } : row)),
    nodes: projectedNodes(snapshot, entry, evidence),
    committedConnections: projectedConnections(snapshot, entry, evidence),
  };
}
export function applySequentialGeometryEditJournalToTopology(snapshotInput, journalInput) {
  const journal = assertSequentialGeometryEditJournal(journalInput, snapshotInput);
  let snapshot = snapshotInput;
  for (const entry of journal.entries) snapshot = projectTopologyEntry(snapshot, entry);
  return Object.freeze({
    ...snapshot,
    geometryEditJournalFingerprint: journal.headFingerprint,
    effectiveGeometryFingerprint: sequentialSemanticFingerprint('SSKEFFECTIVEGEOMETRY', {
      nodes: snapshot.nodes.map((row) => [row.nodeId, row.position]),
      ports: snapshot.ports.map((row) => [row.portId, row.position]),
      geometryParts: snapshot.geometryParts,
      committedConnections: snapshot.committedConnections,
      journalHeadFingerprint: journal.headFingerprint,
    }),
  });
}

/** Canonical immutable topology authority derived from certified Sequential construction. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { classifySequentialEngineeringSvgAuthority } from '../sequential-engineering-svg-authority.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import { createSequentialEditEligibility, inheritSequentialEditEligibility } from './sequential-edit-eligibility.js';
import { projectSequentialEditableTopology } from './sequential-editable-topology-projection.js';
import { applySequentialGeometryEditJournalToTopology } from './sequential-geometry-edit-projection.js';
import { isSequentialEffectiveGeometryReadModel } from './sequential-effective-geometry-read-model.js';
import { isSequentialEffectiveTopologyReadModel } from './sequential-effective-topology-read-model.js';
import { applySequentialTopologyEditJournalToTopology } from './sequential-topology-edit-projection.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_EDITABLE_TOPOLOGY_SNAPSHOT_SCHEMA =
  'SequentialEditableTopologySnapshot.v1';
export const SEQUENTIAL_EDITABLE_TOPOLOGY_REJECTION = Object.freeze({
  AUTHORITY_MISSING: 'SEQUENTIAL_EDITABLE_TOPOLOGY_AUTHORITY_MISSING',
  DUPLICATE_ID: 'SEQUENTIAL_EDITABLE_TOPOLOGY_DUPLICATE_ID',
});

function fail(code, message, Constructor = Error) {
  const error = new Constructor(message); error.code = code; throw error;
}
function assertUnique(rows, key, label) {
  const values = rows.map((row) => row[key]);
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) fail(SEQUENTIAL_EDITABLE_TOPOLOGY_REJECTION.DUPLICATE_ID,
    `Duplicate ${label}: ${duplicate}`, RangeError);
}
function validateProjection(projection) {
  assertUnique(projection.nodes, 'nodeId', 'node ID');
  assertUnique(projection.ports, 'portId', 'port ID');
  assertUnique(projection.components, 'componentId', 'component ID');
  assertUnique(projection.geometryParts, 'geometryPartId', 'geometry-part ID');
  assertUnique(projection.internalEdges, 'edgeId', 'internal-edge ID');
  assertUnique(projection.committedConnections, 'connectionId', 'connection ID');
  assertUnique(projection.componentBoundaryCuts, 'boundaryCutId', 'boundary-cut ID');
  assertUnique(projection.supportAttachments, 'supportAttachmentId', 'support-attachment ID');
  return projection;
}
function componentEligibility(authority, component, projection) {
  const repaired = projection.committedConnections.filter((row) => (
    row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY'
      && (component.portIds.includes(row.fromPortId) || component.portIds.includes(row.toPortId))
  ));
  const cuts = projection.componentBoundaryCuts
    .filter((row) => row.componentId === component.componentId);
  return createSequentialEditEligibility({
    targetKind: 'COMPONENT', targetId: component.componentId,
    componentId: component.componentId, canonicalType: component.canonicalType,
    sessionState: authority.state, geometryPartCount: component.geometryPartIds.length,
    positionedPortCount: component.portIds.length, unresolvedPortCount: 0,
    completeAncestry: Boolean(component.ancestry.strokeId),
    repairConnectionIds: repaired.map((row) => row.connectionId),
    rigidBoundaryCount: cuts.length,
    supportAttachmentCount: component.supportAttachmentIds.length,
    evidence: { ...component.ancestry, boundaryCutIds: cuts.map((row) => row.boundaryCutId) },
  });
}
function nodeEligibility(authority, node) {
  const locked = node.boundaryClass === 'REPAIR_BOUNDARY'
    ? ['LOCKED_CANDIDATE_OR_REPAIR'] : [];
  return createSequentialEditEligibility({
    targetKind: 'NODE', targetId: node.nodeId, sessionState: authority.state,
    geometryPartCount: node.incidentEdgeIds.length || 1, positionedPortCount: 1,
    completeAncestry: true,
    capabilities: node.incidentComponentIds.length ? ['STRETCH_ELIGIBLE'] : [],
    locks: locked,
    evidence: { incidentComponentIds: node.incidentComponentIds, boundaryClass: node.boundaryClass },
  });
}
function eligibilityRecords(authority, projection) {
  const components = projection.components
    .map((component) => componentEligibility(authority, component, projection));
  const byComponent = new Map(components.map((row) => [row.componentId, row]));
  const parts = projection.geometryParts.map((part) => inheritSequentialEditEligibility(
    byComponent.get(part.componentId), {
      targetKind: 'GEOMETRY_PART', targetId: part.geometryPartId,
      evidence: {
        sceneEntityId: part.sceneEntityId, role: part.role,
        sourceStrokeId: part.sourceStrokeId,
        ownerEligibilityId: byComponent.get(part.componentId).eligibilityId,
        selectionResolution: 'WHOLE_COMPONENT',
      },
    },
  ));
  const nodes = projection.nodes.map((node) => nodeEligibility(authority, node));
  return [...components, ...parts, ...nodes];
}
function supportCarriers(components) {
  return components.map((component) => ({
    carrierId: component.componentId,
    componentId: component.componentId,
    supportAttachmentIds: component.supportAttachmentIds,
  }));
}
function selectionCandidates(parts, cuts, eligibility) {
  const byTarget = new Map(eligibility.map((row) => [row.targetId, row]));
  return parts.map((part) => ({
    selectionCandidateId: `ssk:selection:${part.geometryPartId}`,
    topologyEntityId: part.geometryPartId,
    selectionGroupId: `ssk:selection-group:${part.componentId}`,
    resolvedComponentId: part.componentId,
    sceneEntityId: part.sceneEntityId,
    boundaryCutIds: cuts.filter((row) => row.componentId === part.componentId)
      .map((row) => row.boundaryCutId),
    eligibilityId: byTarget.get(part.geometryPartId)?.eligibilityId || null,
  }));
}
function selectionGroups(components, candidates, cuts, eligibility) {
  const componentEligibilityMap = new Map(eligibility
    .filter((row) => row.targetKind === 'COMPONENT')
    .map((row) => [row.componentId, row.eligibilityId]));
  return components.map((component) => ({
    selectionGroupId: `ssk:selection-group:${component.componentId}`,
    componentId: component.componentId,
    geometryPartIds: component.geometryPartIds,
    selectionCandidateIds: candidates.filter((row) => row.resolvedComponentId === component.componentId)
      .map((row) => row.selectionCandidateId),
    boundaryCutIds: cuts.filter((row) => row.componentId === component.componentId)
      .map((row) => row.boundaryCutId),
    eligibilityId: componentEligibilityMap.get(component.componentId),
  }));
}
function openBoundaries(nodes, classifications) {
  const included = new Set(['OPEN_TERMINAL', 'INTENTIONAL_TERMINAL', 'EXTERNAL_BOUNDARY']);
  return nodes.filter((node) => included.has(node.boundaryClass)).map((node) => ({
    boundaryId: `ssk:open-boundary:${node.nodeId}`,
    nodeId: node.nodeId, portIds: node.portIds,
    boundaryClass: node.boundaryClass,
    classificationIds: classifications.filter((row) => node.portIds.includes(row.activePortId))
      .map((row) => row.classificationId),
  }));
}
function nonEditableEvidence(authority) {
  return {
    candidates: authority.candidates,
    rejectedCandidates: authority.rejectedCandidates,
    rejectedCandidateIdsMissingEvidence: authority.rejectedCandidateIdsMissingEvidence,
  };
}
function fingerprintMaterial(base) {
  return {
    topology: {
      branch: base.branch, nodes: base.nodes, ports: base.ports,
      components: base.components, internalEdges: base.internalEdges,
      committedConnections: base.committedConnections,
      componentBoundaryCuts: base.componentBoundaryCuts,
      repairs: base.repairs, openBoundaries: base.openBoundaries,
      selectionGroups: base.selectionGroups, supportCarriers: base.supportCarriers,
      supportAttachments: base.supportAttachments,
      topologyEditJournalFingerprint: base.topologyEditJournalFingerprint || null,
    },
    geometry: {
      nodes: base.nodes.map((row) => [row.nodeId, row.position]),
      geometryParts: base.geometryParts,
      supports: base.supportAttachments.map((row) => [row.supportAttachmentId, row.position]),
      geometryEditJournalFingerprint: base.geometryEditJournalFingerprint || null,
      topologyEditJournalFingerprint: base.topologyEditJournalFingerprint || null,
    },
    ancestry: {
      authority: base.authority,
      components: base.components.map((row) => [row.componentId, row.ancestry]),
      geometryParts: base.geometryParts.map((row) => [row.geometryPartId, row.sceneEntityId]),
      nonEditableEvidence: base.nonEditableEvidence,
      topologySupersededComponents: base.topologySupersededComponents || [],
    },
  };
}
function fingerprintSet(base) {
  const material = fingerprintMaterial(base);
  return {
    topologyFingerprint: sequentialSemanticFingerprint('SSKEDITTOPOLOGY', material.topology),
    geometryFingerprint: sequentialSemanticFingerprint('SSKEDITGEOMETRY', material.geometry),
    ancestryFingerprint: sequentialSemanticFingerprint('SSKEDITANCESTRY', material.ancestry),
  };
}
function authorityRecord(readModel, authority, scene) {
  return {
    authorityId: readModel.authorityId,
    revision: readModel.revision,
    sourceEvidenceFingerprint: sequentialSemanticFingerprint('SSKSOURCEEVIDENCE', authority.evidenceModel),
    sessionFingerprint: readModel.sessionFingerprint,
    confirmedConstructionFingerprint: readModel.confirmedConstructionFingerprint,
    supportProjectionFingerprint: readModel.supportProjectionFingerprint,
    supportAdjustmentRegisterFingerprint: readModel.supportAdjustmentRegisterFingerprint,
    geometryEditJournalFingerprint: readModel.geometryEditJournalFingerprint || null,
    topologyEditJournalFingerprint: readModel.topologyEditJournalFingerprint || null,
    sceneId: scene.sceneId,
    sceneFingerprint: sequentialSemanticFingerprint('SSKEDITSCENE', scene),
  };
}
function finalize(base) {
  const fingerprints = fingerprintSet(base);
  return immutableJson({
    ...base,
    ...fingerprints,
    snapshotFingerprint: sequentialSemanticFingerprint(
      'SSKEDITABLESNAPSHOT', { ...base, ...fingerprints },
    ),
  }, 'Sequential editable topology snapshot');
}
function createBaseSnapshot(readModel) {
  const authority = classifySequentialEngineeringSvgAuthority(readModel.ownerSnapshot);
  const confirmed = authority.confirmedConstruction;
  if (!confirmed) fail(SEQUENTIAL_EDITABLE_TOPOLOGY_REJECTION.AUTHORITY_MISSING,
    'Editable topology requires confirmed Sequential construction.', RangeError);
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const projection = validateProjection(projectSequentialEditableTopology(authority, scene));
  const eligibility = eligibilityRecords(authority, projection);
  const boundaryClassifications = confirmed.boundaryClassifications;
  const candidates = selectionCandidates(
    projection.geometryParts, projection.componentBoundaryCuts, eligibility,
  );
  const groups = selectionGroups(
    projection.components, candidates, projection.componentBoundaryCuts, eligibility,
  );
  return finalize({
    schema: SEQUENTIAL_EDITABLE_TOPOLOGY_SNAPSHOT_SCHEMA,
    authority: authorityRecord(readModel, authority, scene),
    branch: { branchId: readModel.branchId, branchIds: confirmed.branchIds, state: authority.state },
    ...projection,
    boundaryClassifications,
    openBoundaries: openBoundaries(projection.nodes, boundaryClassifications),
    supportCarriers: supportCarriers(projection.components),
    selectionGroups: groups,
    selectionCandidates: candidates,
    eligibility,
    nonEditableEvidence: nonEditableEvidence(authority),
  });
}
function stripFingerprints(value) {
  const result = { ...value };
  ['topologyFingerprint', 'geometryFingerprint', 'ancestryFingerprint',
    'snapshotFingerprint', 'effectiveGeometryFingerprint',
    'effectiveStructuralFingerprint'].forEach((key) => delete result[key]);
  return result;
}
function createGeometrySnapshot(readModel) {
  const base = createBaseSnapshot(readModel.baseReadModel);
  const projected = applySequentialGeometryEditJournalToTopology(
    base,
    readModel.geometryEditJournal,
  );
  const authority = classifySequentialEngineeringSvgAuthority(readModel.baseReadModel.ownerSnapshot);
  return finalize({
    ...stripFingerprints(projected),
    authority: authorityRecord(readModel, authority,
      buildSequentialScopedEditEngineeringScene(readModel)),
    geometryEditJournalFingerprint: readModel.geometryEditJournalFingerprint,
  });
}
function createStructuralSnapshot(readModel) {
  const base = createSequentialEditableTopologySnapshot(readModel.topologyBaseReadModel);
  const projected = applySequentialTopologyEditJournalToTopology(
    base,
    readModel.topologyEditJournal,
  );
  const authorityBase = readModel.topologyBaseReadModel.baseReadModel
    || readModel.topologyBaseReadModel;
  const authority = classifySequentialEngineeringSvgAuthority(authorityBase.ownerSnapshot);
  return finalize({
    ...stripFingerprints(projected),
    authority: authorityRecord(readModel, authority,
      buildSequentialScopedEditEngineeringScene(readModel)),
    topologyEditJournalFingerprint: readModel.topologyEditJournalFingerprint,
  });
}
export function createSequentialEditableTopologySnapshot(readModelInput) {
  const readModel = assertSequentialScopedEditReadModel(readModelInput);
  if (isSequentialEffectiveTopologyReadModel(readModel)) return createStructuralSnapshot(readModel);
  if (isSequentialEffectiveGeometryReadModel(readModel)) return createGeometrySnapshot(readModel);
  return createBaseSnapshot(readModel);
}
export function assertSequentialEditableTopologySnapshot(value, readModelInput) {
  if (value?.schema !== SEQUENTIAL_EDITABLE_TOPOLOGY_SNAPSHOT_SCHEMA) {
    throw new TypeError(`Editable topology must use ${SEQUENTIAL_EDITABLE_TOPOLOGY_SNAPSHOT_SCHEMA}.`);
  }
  const rebuilt = createSequentialEditableTopologySnapshot(readModelInput);
  if (!sameSequentialContractValue(rebuilt, value)) {
    throw new RangeError('Editable topology differs from deterministic authority regeneration.');
  }
  return rebuilt;
}

/** Deterministic EngineeringScene.v1 derivation from one reference document. */
import { createPointGeometry } from '../engineering-scene/engineering-geometry-contracts.js';
import { createEngineeringRevisionToken } from '../engineering-scene/engineering-revision-contracts.js';
import { createEngineeringScene } from '../engineering-scene/engineering-scene-contracts.js';
import {
  assertScopedEditReferenceDocument,
  hashReferenceValue,
} from './reference-document-contracts.js';

function point(anchor) {
  return { x: anchor[0], y: anchor[1], z: anchor[2] };
}

function sceneEntity(entity, renderOrder) {
  return {
    id: entity.entityId,
    kind: 'reference-entity',
    domainType: 'reference-entity',
    geometry: createPointGeometry(point(entity.anchor)),
    domainRef: {
      schema: 'ScopedEditReferenceEntityRef.v1',
      entityId: entity.entityId,
      structuralIds: entity.structuralIds,
      referenceIds: entity.referenceIds,
    },
    editCapabilities: ['POSITION', 'ATTRIBUTE', 'REMARK'],
    layer: 'authoritative',
    renderOrder,
    visible: true,
    selectable: true,
    contributesToFit: true,
    metadata: {
      authoritativeGeometry: { anchor: entity.anchor },
      presentation: { readOnly: true, attributes: entity.attributes, remark: entity.remark },
      scopeMaterial: { structuralIds: entity.structuralIds, referenceIds: entity.referenceIds },
    },
  };
}

export function deriveReferenceEngineeringScene(documentInput) {
  const document = assertScopedEditReferenceDocument(documentInput);
  const documentHash = hashReferenceValue(document);
  return createEngineeringScene({
    sceneId: `reference-scene:${documentHash}`,
    revision: createEngineeringRevisionToken({ documentId: document.documentId, revision: document.revision }),
    coordinateSystem: { unit: 'mm', frame: 'GLOBAL', verticalAxis: 'Z', handedness: 'right' },
    entities: document.entities.map(sceneEntity),
    metadata: {
      authority: 'DERIVED_REFERENCE_VIEW',
      sourceDocumentId: document.documentId,
      sourceRevision: document.revision,
      sourceDocumentHash: documentHash,
    },
  });
}

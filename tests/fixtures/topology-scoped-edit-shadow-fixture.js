import { immutableJson } from '../../contracts/contract-values.js';
import { createTopologyScopedEditReadOnlyHostFixture } from './topology-scoped-edit-read-only-host-fixture.js';

function requestWithPolicy(request, boundaryPolicy) {
  return immutableJson({ ...request, boundaryPolicy }, 'Topology shadow scope request');
}

function semanticInput(base, envelope, targetIds, targetClassification, semanticClass) {
  return Object.freeze({ envelope, dragEntityId: 'N02', targetIds: Object.freeze(targetIds),
    targetClassification, semanticClass, commandName: envelope.commandType,
    runtimeExpectedCodes: Object.freeze(['BOUNDARY_FROZEN', 'BOUNDARY_GHOSTED']) });
}

export async function createTopologyScopedEditShadowFixture() {
  const base = await createTopologyScopedEditReadOnlyHostFixture();
  const scopeRequest = base.selectionRequests[1];
  const positive = Object.freeze({ envelope: base.envelopes.authorized,
    dragEntityId: 'N02', targetIds: Object.freeze(['N02']),
    commandName: base.envelopes.authorized.commandType });
  const boundary = semanticInput(base, base.envelopes.boundary, ['N05'], 'BOUNDARY',
    'NON_EDITABLE_BOUNDARY_TARGET');
  const excluded = semanticInput(base, base.envelopes.excluded, ['N09'], 'EXCLUDED',
    'NON_EDITABLE_EXCLUDED_TARGET');
  const unsupported = Object.freeze({ ...positive, envelope: base.envelopes.unsupported,
    targetClassification: 'COMMAND', semanticClass: 'UNSUPPORTED_COMMAND' });
  const mismatch = Object.freeze({ ...positive, envelope: base.envelopes.mismatch,
    targetClassification: 'COMMAND', semanticClass: 'COMMAND_PAYLOAD_MISMATCH',
    runtimeExpectedCodes: Object.freeze(['APPEND_PROJECTION_INVALID']) });
  return Object.freeze({
    readModel: base.readModelA0, core: base.core, scopeRequest, positive, boundary, excluded,
    unsupported, mismatch, selectionRequests: base.selectionRequests,
    structuralRequests: base.structuralRequests, geometryIds: base.geometryIds,
    sectionalRequest: base.sectionalRequest,
    propagateRequest: requestWithPolicy(scopeRequest, 'PROPAGATE'),
    corruptedProjections: base.corruptedProjections,
    corruptedRuntimeExpectedCodes: Object.freeze(['APPEND_PROJECTION_INVALID',
      'SCOPED_EDIT_RUNTIME_PROJECTION_INVALID']),
    staleRuntimeExpectedCodes: Object.freeze(['STALE_TOPOLOGY_HOST_AUTHORITY',
      'STALE_TOPOLOGY_SCOPE_AUTHORITY', 'SCOPE_REVALIDATION_FAILED']),
    authorityGet: base.authorityGet, authoritySet: base.authoritySet,
    staleAuthorityId: base.readModelA1.authorityId,
    unknownEntityId: base.unknownGeometryId,
    unknownDragRequest: Object.freeze({ schema: 'Edit3DDragRequest.v1', start: [0, 0, 0],
      maxDistance: 1, constraint: { kind: 'CAMERA_PLANE', planeNormal: [0, 0, 1] } }),
    expectedCodes: base.expectedCodes,
  });
}

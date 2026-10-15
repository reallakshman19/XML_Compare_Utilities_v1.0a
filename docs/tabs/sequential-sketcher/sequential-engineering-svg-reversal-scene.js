/** Read-only authority and EngineeringScene projection of native Sequential reversal candidates. */
import {
  createEngineeringSceneEntity,
  createPointGeometry,
} from '../../core/engineering-scene/index.js';
import { buildSequentialReversalCandidates } from './construction/sequential-supervised-decision-actions.js';

function text(value) { return String(value || '').trim(); }
function point(value) {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) return null;
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}
function samePoint(left, right) {
  if (!left || !right) return left === right;
  return left.x === right.x && left.y === right.y && left.z === right.z;
}
function propertyId(entityId) { return `ssk:properties:${entityId}`; }
function invalid(message) { throw new RangeError(message); }

function indexedCandidate(candidate, indexes) {
  const candidateId = text(candidate?.candidateId);
  const componentId = text(candidate?.componentId);
  const entryPortId = text(candidate?.entryPortId);
  if (!candidateId || !componentId || !entryPortId) invalid('Sequential reversal candidate identity is incomplete.');
  const component = indexes.components.get(componentId);
  const port = indexes.ports.get(entryPortId);
  if (!component || !port || text(port.componentId) !== componentId) {
    invalid('Sequential reversal candidate does not match current indexed component/port authority.');
  }
  const sourcePosition = point(port.sourcePosition);
  if (text(candidate.sourceComponentId) !== text(component.sourceComponentId)
    || text(candidate.branchId) !== text(component.branchId)
    || text(candidate.portRole) !== text(port.role)
    || !samePoint(point(candidate.sourcePosition), sourcePosition)) {
    invalid('Sequential reversal candidate differs from current indexed entry-port evidence.');
  }
  return Object.freeze({ ...candidate, candidateId, componentId, entryPortId, sourcePosition });
}

export function projectSequentialReversalCandidates(session, indexes) {
  if (!(indexes?.components instanceof Map) || !(indexes?.ports instanceof Map)) {
    throw new TypeError('Sequential reversal projection requires indexed components and ports.');
  }
  return Object.freeze(buildSequentialReversalCandidates(session, indexes)
    .map((candidate) => indexedCandidate(candidate, indexes)));
}

function omission(omissions, candidate, reason) {
  omissions.push(Object.freeze({
    category: 'reversalCandidate',
    id: text(candidate?.candidateId) || null,
    reason,
  }));
  return null;
}

function reversalEntity(candidate, omissions) {
  const position = point(candidate.sourcePosition);
  if (!position) return omission(omissions, candidate, 'REVERSAL_ENTRY_PORT_POSITION_MISSING');
  const id = `ssk:reversal:${candidate.candidateId}`;
  return createEngineeringSceneEntity({
    id,
    kind: 'point',
    domainType: 'SEQUENTIAL_REVERSAL_CANDIDATE',
    geometry: createPointGeometry(position),
    domainRef: {
      owner: 'sequential-sketcher', category: 'reversalCandidate',
      candidateId: candidate.candidateId, componentId: candidate.componentId,
      sourceComponentId: candidate.sourceComponentId, branchId: candidate.branchId,
      entryPortId: candidate.entryPortId, portRole: candidate.portRole,
      sourcePosition: candidate.sourcePosition,
    },
    propertySetIds: [propertyId(id)],
    editCapabilities: [],
    layer: 'sequential-reversal-candidate',
    renderOrder: 35,
    contributesToFit: false,
    metadata: {
      sequential: {
        category: 'reversalCandidate', status: 'NOT_CONFIRMED', candidate,
      },
    },
  });
}

export function buildSequentialReversalSceneEntities(authority, omissions = []) {
  return Object.freeze((authority?.reversalCandidates || [])
    .map((candidate) => reversalEntity(candidate, omissions))
    .filter(Boolean));
}

/** Pure adapter from a Validator MOVE_NODE request to a Sequential stretch preview plan. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialMoveNodeRequest } from '../../topology-trace-validator/topology-sequential-move-node-request.js';
import { semanticHash, semanticStringify } from '../../topology-trace-validator/topology-validator-values.js';

export const SEQUENTIAL_NODE_STRETCH_REQUEST_PLAN_SCHEMA =
  'SequentialNodeStretchRequestPlan.v1';

export const SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_NODE_STRETCH_REQUEST_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_NODE_STRETCH_EXPLICIT_IDENTITY_REQUIRED',
  OPERATION_UNSUPPORTED: 'SEQUENTIAL_NODE_STRETCH_REQUEST_OPERATION_UNSUPPORTED',
  PROFILE_INVALID: 'SEQUENTIAL_NODE_STRETCH_REQUEST_PROFILE_INVALID',
  PLAN_INVALID: 'SEQUENTIAL_NODE_STRETCH_REQUEST_PLAN_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return text;
}

function finite(value, label, minimum) {
  const text = String(value ?? '').trim();
  const number = Number(text);
  if (!text || !Number.isFinite(number) || number < minimum) {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.PROFILE_INVALID,
      `${label} must be finite and at least ${minimum}.`, TypeError);
  }
  return number;
}

function profile(input = {}) {
  const value = {
    minimumLengthMm: finite(input.minimumLengthMm ?? 1, 'Minimum length', Number.MIN_VALUE),
    zeroLengthToleranceMm: finite(input.zeroLengthToleranceMm ?? 1e-9, 'Zero tolerance', 0),
    collinearityTolerance: finite(input.collinearityTolerance ?? 1e-9, 'Collinearity tolerance', 0),
  };
  if (value.zeroLengthToleranceMm >= value.minimumLengthMm) {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.PROFILE_INVALID,
      'Zero tolerance must be smaller than minimum length.', TypeError);
  }
  return value;
}

function exactRequest(value) {
  try { return assertTopologySequentialMoveNodeRequest(value); }
  catch (error) {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.REQUEST_INVALID,
      `Validator request is invalid: ${error.message || String(error)}`, TypeError);
  }
}

function planMaterial(request, input) {
  if (request.sequentialIntent?.requiredOperation !== 'STRETCH_NODE') {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.OPERATION_UNSUPPORTED,
      `Request operation is not STRETCH_NODE: ${request.sequentialIntent?.requiredOperation || 'missing'}`);
  }
  return {
    schema: SEQUENTIAL_NODE_STRETCH_REQUEST_PLAN_SCHEMA,
    requestFingerprint: request.requestFingerprint,
    validatorNodeId: request.sourceNode.nodeId,
    selectedObjectId: requiredText(input.selectedObjectId, 'selectedObjectId'),
    sequentialNodeId: requiredText(input.sequentialNodeId, 'sequentialNodeId'),
    targetPosition: request.sourceCommand.payload.position,
    profile: profile(input.profile),
    authorityMapping: 'EXPLICIT_OPERATOR_SELECTION',
    publicationState: 'NOT_PUBLISHED',
  };
}

export function parseSequentialNodeStretchRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.REQUEST_INVALID,
      `Validator request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}

export function createSequentialNodeStretchRequestPlan(input = {}) {
  const material = planMaterial(exactRequest(input.request), input);
  return immutableJson({ ...material,
    planFingerprint: `sequential-request-plan:${semanticHash(material)}` },
  'Sequential node stretch request plan');
}

export function assertSequentialNodeStretchRequestPlan(value) {
  if (value?.schema !== SEQUENTIAL_NODE_STRETCH_REQUEST_PLAN_SCHEMA) {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.PLAN_INVALID,
      `Request plan must use ${SEQUENTIAL_NODE_STRETCH_REQUEST_PLAN_SCHEMA}.`, TypeError);
  }
  const material = { ...value }; delete material.planFingerprint;
  if (value.planFingerprint !== `sequential-request-plan:${semanticHash(material)}`) {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.PLAN_INVALID,
      'Request plan fingerprint is invalid.');
  }
  immutableJson(value, 'Sequential node stretch request plan'); return value;
}

export function sequentialNodeStretchRequestPreviewInput(planInput) {
  const plan = assertSequentialNodeStretchRequestPlan(planInput);
  return immutableJson({
    selectedObjectId: plan.selectedObjectId,
    sequentialNodeId: plan.sequentialNodeId,
    stageInput: {
      targetPosition: plan.targetPosition,
      profile: plan.profile,
      operationId: plan.planFingerprint,
    },
  }, 'Sequential node stretch request preview input');
}

export function validateSequentialNodeStretchRequestPlan(value, input = {}) {
  const plan = assertSequentialNodeStretchRequestPlan(value);
  const rebuilt = createSequentialNodeStretchRequestPlan(input);
  if (semanticStringify(plan) !== semanticStringify(rebuilt)) {
    fail(SEQUENTIAL_NODE_STRETCH_REQUEST_REJECTION.PLAN_INVALID,
      'Request plan differs from current canonical regeneration.');
  }
  return rebuilt;
}

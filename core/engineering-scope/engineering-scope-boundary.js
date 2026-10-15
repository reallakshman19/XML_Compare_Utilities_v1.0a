import { freezeJsonValue } from '../engineering-scene/engineering-json-value.js';
import {
  ENGINEERING_SCOPE_BOUNDARY_POLICY,
  assertEngineeringScope,
} from './engineering-scope-contracts.js';

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required.`);
  return value.trim();
}

function targetSet(values) {
  if (!Array.isArray(values)) throw new TypeError('targetIds must be an array.');
  return [...new Set(values.map((value, index) => requiredText(value, `targetIds[${index}]`)))].sort();
}

function rejectionReason(policy) {
  if (policy === ENGINEERING_SCOPE_BOUNDARY_POLICY.FROZEN) return 'BOUNDARY_FROZEN';
  return 'BOUNDARY_GHOSTED';
}

export function guardScopeBoundary(inputScope, commandName, inputTargetIds) {
  const scope = assertEngineeringScope(inputScope);
  const targetIds = targetSet(inputTargetIds);
  const editable = new Set(scope.entityIds);
  const escapingIds = targetIds.filter((id) => !editable.has(id));
  const propagates = scope.boundaryPolicy === ENGINEERING_SCOPE_BOUNDARY_POLICY.PROPAGATE;
  const allowed = escapingIds.length === 0 || propagates;
  return freezeJsonValue({
    allowed,
    commandName: requiredText(commandName, 'commandName'),
    boundaryPolicy: scope.boundaryPolicy,
    targetIds,
    escapingIds,
    reason: allowed ? null : rejectionReason(scope.boundaryPolicy),
  });
}

/** Pure reset model for deliberate Revision Compare scope decisions. */
import { deepFreeze } from './revision-contract-utils.js';

function decisionCount(state) {
  return Object.keys(state?.scopeDecisions ?? {}).length;
}

export function revisionScopeResetModel(state) {
  const count = decisionCount(state);
  return deepFreeze({
    visible: count > 0,
    decisionCount: count,
    label: count === 1 ? 'Reset 1 scope decision' : `Reset ${count} scope decisions`,
    message: count === 1
      ? 'Restore the default branch scope by clearing 1 deliberate decision.'
      : `Restore the default branch scope by clearing ${count} deliberate decisions.`,
  });
}

export const _test = Object.freeze({ decisionCount });

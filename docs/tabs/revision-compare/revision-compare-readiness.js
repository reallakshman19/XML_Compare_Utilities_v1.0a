/** RC-002 approval and visual-readiness gates derived from current authority. */
import { deepFreeze } from './revision-contract-utils.js';

const COMPATIBILITY_KEYS = Object.freeze([
  'unitCompatibility',
  'coordinateFrameCompatibility',
  'verticalAxisCompatibility',
]);

function compatibilityItems(source) {
  return COMPATIBILITY_KEYS.map((key) => source?.[key]);
}

function visualCompatibilityBlockers(source, approval = false) {
  const blockers = [];
  for (const item of compatibilityItems(source)) {
    if (item?.status === 'COMPATIBLE') continue;
    const label = item?.label ?? 'Compatibility evidence';
    const status = item?.status ?? 'UNKNOWN';
    blockers.push(approval && status === 'UNKNOWN'
      ? `${label} must be declared before approving the comparison basis.`
      : `${label} is ${status}.`);
  }
  return blockers;
}

export function revisionBasisApprovalReadiness(preflight) {
  const blockers = [...(preflight?.blockers ?? [])];
  if (preflight?.status !== 'READY' && !blockers.length) blockers.push('Comparison preflight is not ready.');
  blockers.push(...visualCompatibilityBlockers(preflight?.compatibility, true));
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers) });
}

export function revisionVisualReadiness(state) {
  const blockers = [];
  if (state?.basisStatus !== 'CURRENT') blockers.push('Comparison basis is not current.');
  const basis = state?.basis;
  if (!basis || basis.validation?.status !== 'READY') blockers.push('An approved RevisionComparisonBasis.v1 is required.');
  blockers.push(...visualCompatibilityBlockers(basis));
  if (!basis?.includedBranchesA?.length) blockers.push('Rev A included scope is empty.');
  if (!basis?.includedBranchesB?.length) blockers.push('Rev B included scope is empty.');
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers) });
}

export const _test = Object.freeze({ compatibilityItems, visualCompatibilityBlockers });

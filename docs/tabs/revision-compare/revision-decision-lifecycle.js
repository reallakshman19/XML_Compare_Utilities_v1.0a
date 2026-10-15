/** Workspace lifecycle for current, stale and replacement-gated RC-004 ledgers. */
import { deepFreeze } from './revision-contract-utils.js';
import { createDecisionFilters } from './revision-decision-projection.js';
import { createDecisionLedger, decisionLedgerMatchesAudit, markDecisionLedgerStale, reattachDecisionLedger } from './revision-decision-ledger.js';

export function createDecisionLifecycleState() {
  return deepFreeze({
    schema: 'RevisionDecisionLifecycle.v1', ledger: null, replacementRequired: false, importError: null,
    filters: createDecisionFilters(), preview: deepFreeze({ differenceId: null, candidateIndex: 0 }),
  });
}
export function staleDecisionLifecycle(decision, updatedAt) {
  if (!decision?.ledger) return decision;
  return deepFreeze({ ...decision, ledger: markDecisionLedgerStale(decision.ledger, updatedAt), importError: null });
}
export function attachDecisionAudit(decision, audit, updatedAt) {
  if (!decision.ledger) return deepFreeze({ ...decision, ledger: createDecisionLedger(audit, updatedAt), replacementRequired: false, importError: null, preview: { differenceId: null, candidateIndex: 0 } });
  if (decisionLedgerMatchesAudit(decision.ledger, audit)) {
    const ledger = decision.ledger.status === 'STALE' ? reattachDecisionLedger(decision.ledger, audit, updatedAt) : decision.ledger;
    return deepFreeze({ ...decision, ledger, replacementRequired: false, importError: null });
  }
  return deepFreeze({ ...decision, ledger: markDecisionLedgerStale(decision.ledger, updatedAt), replacementRequired: true, importError: null, preview: { differenceId: null, candidateIndex: 0 } });
}
export function startNewDecisionForAudit(decision, audit, createdAt) {
  return deepFreeze({ ...decision, ledger: createDecisionLedger(audit, createdAt), replacementRequired: false, importError: null, preview: { differenceId: null, candidateIndex: 0 } });
}
export function setDecisionLifecycleLedger(decision, ledger) { return deepFreeze({ ...decision, ledger, replacementRequired: false, importError: null }); }
export function setDecisionImportError(decision, error) { return deepFreeze({ ...decision, importError: error ? String(error?.message ?? error) : null }); }
export function setDecisionPreview(decision, differenceId, candidateIndex = 0) {
  return deepFreeze({ ...decision, preview: { differenceId: differenceId ?? null, candidateIndex: Math.max(0, Number(candidateIndex) || 0) } });
}
export function toggleDecisionFilter(decision, value) {
  const states = new Set(decision.filters.decisionStates); if (states.has(value)) states.delete(value); else states.add(value);
  return deepFreeze({ ...decision, filters: { ...decision.filters, decisionStates: [...states].sort() } });
}
export function setDecisionUnresolvedOnly(decision, enabled) {
  return deepFreeze({ ...decision, filters: { ...decision.filters, unresolvedOnly: Boolean(enabled) } });
}

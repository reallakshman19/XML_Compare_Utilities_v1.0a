const CLOSURE_TYPES = new Set(['CAP', 'BLIND']);

export function classifyActiveTerminal(session, evidenceIndexes) {
  const component = evidenceIndexes.components.get(session.activeComponentId);
  const branch = evidenceIndexes.branches.get(session.activeBranchId);
  if (!component || !branch) return Object.freeze({ status: 'UNEXPLAINED_TERMINAL', basis: ['ACTIVE_EVIDENCE_MISSING'] });
  if (CLOSURE_TYPES.has(component.canonicalType)) {
    return Object.freeze({ status: 'CONFIRMED_TERMINAL', basis: ['CLOSURE_COMPONENT', component.canonicalType] });
  }
  if (branch.tref) {
    return Object.freeze({ status: 'EXPECTED_CONTINUATION', basis: ['BRANCH_TREF'], referenceTarget: branch.tref });
  }
  return Object.freeze({ status: 'UNEXPLAINED_TERMINAL', basis: ['NO_CLOSURE_OR_DECLARED_BOUNDARY'] });
}

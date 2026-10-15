export const CATEGORIZED_DIAGNOSTIC_SEVERITIES = Object.freeze(['INFO', 'WARNING', 'BLOCKER', 'ERROR']);

export function categorizedDiagnostic(severity, code, message, ref = '') {
  const stableSeverity = CATEGORIZED_DIAGNOSTIC_SEVERITIES.includes(severity) ? severity : 'ERROR';
  return Object.freeze({ severity: stableSeverity, code: String(code), message: String(message), ref: String(ref) });
}

export function hasCategorizedBlockers(diagnostics = []) {
  return (diagnostics || []).some((item) => item.severity === 'BLOCKER' || item.severity === 'ERROR');
}

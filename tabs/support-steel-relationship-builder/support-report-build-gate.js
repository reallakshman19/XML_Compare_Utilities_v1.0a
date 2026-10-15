export function supportReportBlockingDiagnostic(diagnostics = []) {
  return (diagnostics || []).find((item) => diagnosticLevel(item) === 'ERROR') || null;
}

export function assertSupportReportEvidenceReady(evidence = {}) {
  const diagnostics = evidence?.diagnostics || [];
  const blocker = supportReportBlockingDiagnostic(diagnostics);
  if (blocker) throw new Error(blocker.message || blocker.code || 'Support Report clash evidence contains a blocking error.');
  if (Array.isArray(evidence?.rows) && evidence.rows.length > 0) return evidence;
  const context = diagnostics.find((item) => diagnosticLevel(item) === 'WARN') || diagnostics[0];
  const detail = context?.message || context?.code || 'No usable PS/SL clash evidence was found.';
  throw new Error(`Support Report has no usable clash evidence. ${detail}`);
}

function diagnosticLevel(item) {
  return String(item?.severity || item?.level || '').trim().toUpperCase();
}

export const _test = Object.freeze({ diagnosticLevel });

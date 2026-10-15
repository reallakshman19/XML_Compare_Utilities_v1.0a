export const SUPPORT_REPORT_COMPLETENESS = Object.freeze({
  PARTIAL: 'PARTIAL',
  NO_XML_ONLY_ROWS: 'NO_XML_ONLY_ROWS',
});

export function supportReportCompleteness(report) {
  const reportRowCount = nonNegativeCount(report?.summary?.reportRowCount);
  const xmlOnlyRowCount = nonNegativeCount(report?.summary?.xmlOnlyRowCount);
  const partial = xmlOnlyRowCount > 0;
  return Object.freeze({
    state: partial
      ? SUPPORT_REPORT_COMPLETENESS.PARTIAL
      : SUPPORT_REPORT_COMPLETENESS.NO_XML_ONLY_ROWS,
    partial,
    reportRowCount,
    xmlOnlyRowCount,
  });
}

export function supportReportExportFileName(report, extension) {
  const ext = String(extension || '').trim().replace(/^\.+/u, '').toLowerCase();
  if (!ext) throw new Error('Support Report export extension is required.');
  const suffix = supportReportCompleteness(report).partial ? '-partial' : '';
  return `support-report${suffix}.${ext}`;
}

function nonNegativeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

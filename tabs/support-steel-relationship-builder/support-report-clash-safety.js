import {
  groupSupportReportClashEvidence,
  parseSupportReportClashXml as parseWithTestContext,
} from './support-report-clash-test-context.js?v=20260909-support-report-parser-primitives-8&location=20260915-support-report-bore-axis-occurrence-1&perf=20260913-support-report-large-xml-1';
import { _test as clashParserTest } from './support-report-clash-evidence.js?v=20260909-support-report-parser-primitives-8&perf=20260913-support-report-large-xml-1';

export { groupSupportReportClashEvidence };

const DIAGNOSTICS = Object.freeze({
  MALFORMED_XML: 'SUPPORT_REPORT_MALFORMED_XML',
  AMBIGUOUS_PIPE_SIDE: 'SUPPORT_REPORT_AMBIGUOUS_PIPE_SIDE',
  CONFLICTING_SECONDARY_FAMILY: 'SUPPORT_REPORT_CONFLICTING_SECONDARY_FAMILY',
  DUPLICATE_EVIDENCE: 'SUPPORT_REPORT_DUPLICATE_EVIDENCE',
});

export function parseSupportReportClashXml(xmlText, options = {}) {
  const source = String(xmlText || '');
  const structural = validateStructure(source);
  if (!structural.ok) {
    const parsed = parseWithTestContext('', options);
    return Object.freeze({
      ...parsed,
      diagnostics: [diagnostic('ERROR', DIAGNOSTICS.MALFORMED_XML, structural.message)],
    });
  }

  const parsed = parseWithTestContext(source, options);
  const unsafeClashes = classifyUnsafeClashes(parsed.rawClashes || []);
  const rows = parsed.rows.filter((row) => !unsafeClashes.has(clashKey(row)));
  const diagnostics = [
    ...parsed.diagnostics,
    ...[...unsafeClashes.values()].map((item) => diagnostic('ERROR', item.code, item.message, item.extra)),
  ];
  const grouped = deduplicateGroupEvidence(groupSupportReportClashEvidence(rows, options));
  if (grouped.duplicateCount) diagnostics.push(diagnostic(
    'WARN', DIAGNOSTICS.DUPLICATE_EVIDENCE,
    `${grouped.duplicateCount} duplicate clash-member evidence row(s) were ignored within logical groups.`,
    { duplicateCount: grouped.duplicateCount },
  ));
  return Object.freeze({
    ...parsed,
    rowCount: rows.length,
    groupCount: grouped.groups.length,
    rows,
    groups: grouped.groups,
    diagnostics,
  });
}

function validateStructure(source) {
  const counts = new Map([
    ['clashtest', { opens: 0, closes: 0 }],
    ['clashresult', { opens: 0, closes: 0 }],
    ['clashobject', { opens: 0, closes: 0 }],
  ]);
  const regex = /<\s*(\/?)\s*(clashtest|clashresult|clashobject)\b/gi;
  let match;
  while ((match = regex.exec(String(source || '')))) {
    const entry = counts.get(match[2].toLowerCase());
    if (match[1]) entry.closes += 1;
    else entry.opens += 1;
  }
  for (const [tag, entry] of counts) {
    if (entry.opens !== entry.closes) return {
      ok: false,
      message: `Malformed Support Report XML: <${tag}> count ${entry.opens} does not match closing count ${entry.closes}.`,
    };
  }
  return { ok: true, message: '' };
}

function classifyUnsafeClashes(rawClashes = []) {
  const unsafe = new Map();
  for (const rawClash of rawClashes || []) {
    const clashName = rawClash?.clashName || '';
    const guid = rawClash?.guid || '';
    const testIndex = Number.isInteger(rawClash?.clashTestIndex) ? rawClash.clashTestIndex : 0;
    const key = rawClashKey(testIndex, clashName, guid);
    const branchBearingCount = Number(rawClash?.branchBearingObjectCount) || 0;
    if (branchBearingCount > 1) {
      unsafe.set(key, {
        code: DIAGNOSTICS.AMBIGUOUS_PIPE_SIDE,
        message: `${clashName || 'Clash'} has multiple branch-bearing objects; no pipe side was selected.`,
        extra: { clashName, guid, clashTestIndex: testIndex },
      });
      continue;
    }
    if (!branchBearingCount) continue;

    const secondaryFamilies = [...new Set((rawClash?.secondaryFamilyIds || [])
      .map((value) => clashParserTest.extractFamilyRoot(value) || String(value || '').toUpperCase())
      .filter(Boolean))];
    if (secondaryFamilies.length > 1) {
      unsafe.set(key, {
        code: DIAGNOSTICS.CONFLICTING_SECONDARY_FAMILY,
        message: `${clashName || 'Clash'} has conflicting non-pipe PS/SL family roots: ${secondaryFamilies.join(', ')}.`,
        extra: { clashName, guid, clashTestIndex: testIndex, secondaryFamilies },
      });
    }
  }
  return unsafe;
}

function deduplicateGroupEvidence(groups) {
  let duplicateCount = 0;
  const output = groups.map((group) => {
    const deduplicated = deduplicateRows(group.evidenceRows || []);
    duplicateCount += deduplicated.duplicateCount;
    return Object.freeze({
      ...group,
      evidenceRows: deduplicated.rows,
      clashCount: deduplicated.rows.length,
    });
  });
  return { groups: output, duplicateCount };
}

function deduplicateRows(rows) {
  const seen = new Set();
  const output = [];
  let duplicateCount = 0;
  for (const row of rows) {
    const signature = [
      row.primarySupportMemberId || '', row.secondarySupportFamilyId || '',
      row.fullLineTag || '', row.branchNode || '',
    ].join('\u0000').toUpperCase();
    if (seen.has(signature)) { duplicateCount += 1; continue; }
    seen.add(signature);
    output.push(row);
  }
  return { rows: output, duplicateCount };
}

function clashKey(row) { return rawClashKey(row.clashTestIndex ?? 0, row.clashName || '', row.guid || ''); }
function rawClashKey(testIndex, clashName, guid) { return `${testIndex}\u0000${guid || clashName}`.toUpperCase(); }
function diagnostic(severity, code, message, extra = {}) { return Object.freeze({ severity, code, message, ...extra }); }

export const _test = Object.freeze({
  validateStructure,
  classifyUnsafeClashes,
  deduplicateGroupEvidence,
  deduplicateRows,
  DIAGNOSTICS,
});

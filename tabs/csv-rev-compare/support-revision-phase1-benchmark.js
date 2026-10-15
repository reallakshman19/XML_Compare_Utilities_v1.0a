import { parseTableSource } from '../../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { canonicalizeSupportRevisionSource } from './support-revision-pipeline.js';
import { compositeSupportLocationIdentity } from './support-revision-model.js';
import { runSupportRevisionCompare } from './support-revision-engine.js';

export const SUPPORT_REVISION_PHASE1_BENCHMARK_SCHEMA = 'support-revision-phase1-benchmark/v1';
export const SUPPORT_REVISION_PHASE1_BUCKET = 'PS No. change';

/**
 * Phase 1 benchmark authority.
 *
 * Target/R3 remarks are parsed only to establish expected labels, then every
 * remark cell is blanked before the XML comparison engine runs. Unsupported
 * manual semantics such as HOLD therefore cannot become comparison evidence.
 */
export function runPsNoChangeBenchmark(earlierText, benchmarkLaterText, options = {}) {
  const oracleSource = canonicalizeSupportRevisionSource(parseTableSource(benchmarkLaterText, {
    sourceId: 'BENCHMARK_R3',
    sourceName: 'Benchmark later revision / R3 oracle',
    sourceType: options.sourceType || 'benchmarkText',
    delimiterMode: options.delimiterMode || 'auto',
    customDelimiter: options.customDelimiter || '',
    firstRowIsHeader: options.firstRowIsHeader !== false,
  }));
  const expected = expectedPsNoChangeItems(oracleSource);
  const sanitizedLaterText = sourceToCsv(oracleSource, { blankRemarks: true });
  const compareResult = runSupportRevisionCompare(earlierText, sanitizedLaterText, options.compareOptions || {});
  const detected = detectedPsNoChangeItems(compareResult);
  const metrics = scoreItems(expected, detected);
  return Object.freeze({
    schema: SUPPORT_REVISION_PHASE1_BENCHMARK_SCHEMA,
    bucket: SUPPORT_REVISION_PHASE1_BUCKET,
    oraclePolicy: 'R3 remarks are labels only; REMARKS (IF ANY) is blanked before comparison.',
    unsupportedRemarkPolicy: 'Manual HOLD/Hold Removed semantics are not scored unless the same row independently contains a PS-number-change label.',
    expected,
    detected,
    metrics,
    compareStage: compareResult.stage,
    compareOk: compareResult.ok,
    compareResult,
  });
}

export function expectedPsNoChangeItems(source) {
  return Object.freeze((source?.rows || []).flatMap((row) => {
    const remark = read(row, 'REMARKS (IF ANY)');
    if (!isPsNoChangeRemark(remark)) return [];
    const civilSecondarySupport = read(row, 'CIVILSECONDARYSUPPORT');
    const pipe = read(row, 'PIPE');
    return [Object.freeze({
      key: compositeSupportLocationIdentity(civilSecondarySupport, pipe),
      rowId: row.rowId,
      civilSecondarySupport,
      pipe,
      oracleRemark: remark,
    })];
  }));
}

export function detectedPsNoChangeItems(compareResult) {
  const targetByRow = new Map((compareResult?.targetModel?.locations || []).map((location) => [location.sourceRowId, location]));
  const rows = [];
  for (const [rowId, rendered] of Object.entries(compareResult?.remarks?.targetRemarks || {})) {
    const hasPsToken = (rendered?.tokens || []).some((token) => token.key === 'PREVIOUS_FAMILY_LINE') || isPsNoChangeRemark(rendered?.remark || '');
    if (!hasPsToken) continue;
    const location = targetByRow.get(rowId);
    if (!location) continue;
    rows.push(Object.freeze({
      key: location.supportLocationIdentity,
      rowId,
      civilSecondarySupport: location.family,
      pipe: location.pipe.raw,
      generatedRemark: rendered.remark,
    }));
  }
  return Object.freeze(rows);
}

export function isPsNoChangeRemark(value) {
  const text = String(value ?? '');
  return /\bPS\s*No\.?\s*(?:\/\s*Line\s*No\.?)?\s*Change\b/i.test(text)
    || /\bLine\s*No\.?\s*Change\b/i.test(text);
}

function scoreItems(expected, detected) {
  const expectedKeys = new Set(expected.map((item) => item.key));
  const detectedKeys = new Set(detected.map((item) => item.key));
  const truePositiveKeys = [...expectedKeys].filter((key) => detectedKeys.has(key)).sort();
  const falsePositiveKeys = [...detectedKeys].filter((key) => !expectedKeys.has(key)).sort();
  const falseNegativeKeys = [...expectedKeys].filter((key) => !detectedKeys.has(key)).sort();
  const tp = truePositiveKeys.length, fp = falsePositiveKeys.length, fn = falseNegativeKeys.length;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return Object.freeze({
    expected: expectedKeys.size,
    detected: detectedKeys.size,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    truePositiveKeys: Object.freeze(truePositiveKeys),
    falsePositiveKeys: Object.freeze(falsePositiveKeys),
    falseNegativeKeys: Object.freeze(falseNegativeKeys),
  });
}

function sourceToCsv(source, options = {}) {
  const headers = [...(source?.headers || [])];
  const remarkIndexes = headers.flatMap((header, index) => header === 'REMARKS (IF ANY)' ? [index] : []);
  const rows = (source?.rows || []).map((row) => (row.rawCells || []).map((value, index) => options.blankRemarks && remarkIndexes.includes(index) ? '' : value));
  return [headers, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function read(row, header) { return String(row?.rawByHeader?.[header] ?? '').trim(); }

export const _test = Object.freeze({ scoreItems, sourceToCsv, read });

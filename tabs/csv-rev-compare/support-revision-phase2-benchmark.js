import { parseTableSource } from '../../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { canonicalizeSupportRevisionSource } from './support-revision-pipeline.js';
import { compositeSupportLocationIdentity } from './support-revision-model.js';
import { runSupportRevisionCompare } from './support-revision-engine.js';
import { runPsNoChangeBenchmark } from './support-revision-phase1-benchmark.js';

export const SUPPORT_REVISION_PHASE2_BENCHMARK_SCHEMA = 'support-revision-phase2-benchmark/v1';
export const SUPPORT_REVISION_PHASE2_BUCKET = 'Support location change';
const RELOCATION_EVENT_TYPES = Object.freeze(['SUPPORT_LOCATION_RELOCATED', 'COMMON_SUPPORT_ANCHOR_RELOCATED']);

export function runSupportLocationChangeBenchmark(earlierText, benchmarkLaterText, options = {}) {
  const earlierSource = parseBenchmarkSource(earlierText, 'BENCHMARK_R2', 'Benchmark earlier revision / R2');
  const oracleSource = parseBenchmarkSource(benchmarkLaterText, 'BENCHMARK_R3', 'Benchmark later revision / R3 oracle');
  const expected = expectedSupportLocationChanges(oracleSource);
  const compareResult = runSupportRevisionCompare(
    sourceToCsv(earlierSource, { blankRemarks: true }),
    sourceToCsv(oracleSource, { blankRemarks: true }),
    options.compareOptions || {},
  );
  const detected = detectedSupportLocationChanges(compareResult);
  const phase1 = runPsNoChangeBenchmark(earlierText, benchmarkLaterText, options.phase1Options || {});
  return Object.freeze({
    schema: SUPPORT_REVISION_PHASE2_BENCHMARK_SCHEMA,
    bucket: SUPPORT_REVISION_PHASE2_BUCKET,
    oraclePolicy: 'R3 remarks provide expected labels only; both revisions have REMARKS (IF ANY) blanked before comparison.',
    detectorPolicy: 'Relocation requires an accepted XML lineage edge plus ACTUAL_POSITION_CHANGED under a trusted revision coordinate frame.',
    expected,
    detected,
    metrics: scoreItems(expected, detected),
    phase1Guard: Object.freeze({ bucket: phase1.bucket, metrics: phase1.metrics }),
    compareStage: compareResult.stage,
    compareOk: compareResult.ok,
    compareResult,
  });
}

export function expectedSupportLocationChanges(source) {
  return Object.freeze((source?.rows || []).flatMap((row) => {
    const oracleRemark = read(row, 'REMARKS (IF ANY)');
    if (!isSupportLocationChangeRemark(oracleRemark)) return [];
    const civilSecondarySupport = read(row, 'CIVILSECONDARYSUPPORT');
    const pipe = read(row, 'PIPE');
    return [Object.freeze({
      key: compositeSupportLocationIdentity(civilSecondarySupport, pipe),
      rowId: row.rowId,
      civilSecondarySupport,
      pipe,
      oracleRemark,
    })];
  }));
}

export function detectedSupportLocationChanges(compareResult) {
  const targetByNode = compareResult?.targetModel?.locationByNodeId || new Map();
  const byKey = new Map();
  for (const event of compareResult?.ledger?.events || []) {
    if (!RELOCATION_EVENT_TYPES.includes(event.type) || !event.targetXmlNode) continue;
    const target = targetByNode.get(event.targetXmlNode);
    if (!target) continue;
    if (!byKey.has(target.supportLocationIdentity)) byKey.set(target.supportLocationIdentity, Object.freeze({
      key: target.supportLocationIdentity,
      rowId: target.sourceRowId,
      civilSecondarySupport: target.family,
      pipe: target.pipe.raw,
      eventType: event.type,
      eventId: event.eventId,
      coordinateResidual: event.coordinateResidual,
      reasonCodes: event.reasonCodes,
    }));
  }
  return Object.freeze([...byKey.values()]);
}

export function isSupportLocationChangeRemark(value) {
  const text = String(value ?? '');
  return /\bSupport\s+location\s+change\b/i.test(text)
    || /\bRelocated\s+Support\b/i.test(text)
    || /\bSupport\s+Relocated\b/i.test(text);
}

function parseBenchmarkSource(text, sourceId, sourceName) {
  return canonicalizeSupportRevisionSource(parseTableSource(text, {
    sourceId,
    sourceName,
    sourceType: 'benchmarkText',
    delimiterMode: 'auto',
    firstRowIsHeader: true,
  }));
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
  return Object.freeze({ expected: expectedKeys.size, detected: detectedKeys.size, truePositives: tp, falsePositives: fp, falseNegatives: fn, precision, recall, f1, truePositiveKeys: Object.freeze(truePositiveKeys), falsePositiveKeys: Object.freeze(falsePositiveKeys), falseNegativeKeys: Object.freeze(falseNegativeKeys) });
}

function sourceToCsv(source, options = {}) {
  const headers = [...(source?.headers || [])];
  const remarkIndexes = headers.flatMap((header, index) => header === 'REMARKS (IF ANY)' ? [index] : []);
  const rows = (source?.rows || []).map((row) => (row.rawCells || []).map((value, index) => options.blankRemarks && remarkIndexes.includes(index) ? '' : value));
  return [headers, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function read(row, header) { return String(row?.rawByHeader?.[header] ?? '').trim(); }

export const _test = Object.freeze({ scoreItems, sourceToCsv, read, parseBenchmarkSource });

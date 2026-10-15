import { parseTableSource } from '../../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { canonicalizeSupportRevisionSource } from './support-revision-pipeline.js';
import { compositeSupportLocationIdentity } from './support-revision-model.js';
import { runSupportRevisionCompare } from './support-revision-engine.js';
import { runSupportLocationChangeBenchmark } from './support-revision-phase2-benchmark.js';

export const SUPPORT_REVISION_PHASE3_BENCHMARK_SCHEMA = 'support-revision-phase3-benchmark/v1';
export const SUPPORT_REVISION_PHASE3_BUCKET = 'Load change';
const LOAD_EVENT_TYPES = Object.freeze(['LOAD_BECAME_NUMERIC', 'LOAD_SIGNATURE_CHANGED']);

export function runLoadChangeBenchmark(earlierText, benchmarkLaterText, options = {}) {
  const earlierSource = parseBenchmarkSource(earlierText, 'BENCHMARK_R2', 'Benchmark earlier revision / R2');
  const oracleSource = parseBenchmarkSource(benchmarkLaterText, 'BENCHMARK_R3', 'Benchmark later revision / R3 oracle');
  const expected = expectedLoadChanges(oracleSource);
  const compareResult = runSupportRevisionCompare(
    sourceToCsv(earlierSource, { blankRemarks: true }),
    sourceToCsv(oracleSource, { blankRemarks: true }),
    options.compareOptions || {},
  );
  const detected = detectedLoadChanges(compareResult);
  const phase2 = runSupportLocationChangeBenchmark(earlierText, benchmarkLaterText, options.phase2Options || {});
  return Object.freeze({
    schema: SUPPORT_REVISION_PHASE3_BENCHMARK_SCHEMA,
    bucket: SUPPORT_REVISION_PHASE3_BUCKET,
    oraclePolicy: 'R3 remarks provide expected labels only; both revisions have REMARKS (IF ANY) blanked before comparison.',
    detectorPolicy: 'Detector authority is typed load events on accepted XML lineage; load values never establish lineage identity.',
    expected,
    detected,
    metrics: scoreItems(expected, detected),
    phase1Guard: phase2.phase1Guard,
    phase2Guard: Object.freeze({ bucket: phase2.bucket, metrics: phase2.metrics }),
    compareStage: compareResult.stage,
    compareOk: compareResult.ok,
    compareResult,
  });
}

export function expectedLoadChanges(source) {
  return Object.freeze((source?.rows || []).flatMap((row) => {
    const oracleRemark = read(row, 'REMARKS (IF ANY)');
    const eventTypes = loadOracleEventTypes(oracleRemark);
    const civilSecondarySupport = read(row, 'CIVILSECONDARYSUPPORT');
    const pipe = read(row, 'PIPE');
    const supportLocationKey = compositeSupportLocationIdentity(civilSecondarySupport, pipe);
    return eventTypes.map((eventType) => Object.freeze({
      key: loadEventKey(supportLocationKey, eventType),
      supportLocationKey,
      eventType,
      rowId: row.rowId,
      civilSecondarySupport,
      pipe,
      oracleRemark,
    }));
  }));
}

export function detectedLoadChanges(compareResult) {
  const targetByNode = compareResult?.targetModel?.locationByNodeId || new Map();
  const byKey = new Map();
  for (const event of compareResult?.ledger?.events || []) {
    if (!LOAD_EVENT_TYPES.includes(event.type) || !event.targetXmlNode) continue;
    const target = targetByNode.get(event.targetXmlNode);
    if (!target) continue;
    const key = loadEventKey(target.supportLocationIdentity, event.type);
    if (!byKey.has(key)) byKey.set(key, Object.freeze({
      key,
      supportLocationKey: target.supportLocationIdentity,
      eventType: event.type,
      rowId: target.sourceRowId,
      civilSecondarySupport: target.family,
      pipe: target.pipe.raw,
      eventId: event.eventId,
      loadDeltas: event.loadDeltas,
      reasonCodes: event.reasonCodes,
    }));
  }
  return Object.freeze([...byKey.values()]);
}

export function loadOracleEventTypes(value) {
  const text = String(value ?? '');
  const types = [];
  if (/\bload\s+standardis(?:ed|ation)\b/i.test(text) || /\bload\s+standardiz(?:ed|ation)\b/i.test(text)) {
    types.push('LOAD_BECAME_NUMERIC');
  }
  if (/\bload\s+change\b/i.test(text)) types.push('LOAD_SIGNATURE_CHANGED');
  return Object.freeze(types);
}

function loadEventKey(supportLocationKey, eventType) {
  return `${supportLocationKey}::${eventType}`;
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

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function read(row, header) { return String(row?.rawByHeader?.[header] ?? '').trim(); }

export const _test = Object.freeze({ scoreItems, sourceToCsv, read, loadEventKey, parseBenchmarkSource });

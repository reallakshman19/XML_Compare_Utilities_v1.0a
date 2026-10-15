import { parseTableSource } from '../../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { canonicalizeSupportRevisionSource } from './support-revision-pipeline.js';
import { compositeSupportLocationIdentity } from './support-revision-model.js';
import { runSupportRevisionCompare } from './support-revision-engine.js';
import { runLoadChangeBenchmark } from './support-revision-phase3-benchmark.js';
import { SUPPORT_REV_TOTAL_POINTS_EVENT } from './support-revision-total-points.js';

export const SUPPORT_REVISION_PHASE4_BENCHMARK_SCHEMA = 'support-revision-phase4-benchmark/v1';
export const SUPPORT_REVISION_PHASE4_BUCKET = 'Total no of support change';

export function runTotalSupportPointChangeBenchmark(earlierText, benchmarkLaterText, options = {}) {
  const earlierSource = parseBenchmarkSource(earlierText, 'BENCHMARK_R2', 'Benchmark earlier revision / R2');
  const oracleSource = parseBenchmarkSource(benchmarkLaterText, 'BENCHMARK_R3', 'Benchmark later revision / R3 oracle');
  const oracle = expectedTotalSupportPointChanges(oracleSource);
  const compareResult = runSupportRevisionCompare(
    sourceToCsv(earlierSource, { blankRemarks: true }),
    sourceToCsv(oracleSource, { blankRemarks: true }),
    options.compareOptions || {},
  );
  const qualification = qualifyOracleItems(oracle, compareResult);
  const detected = detectedTotalSupportPointChanges(compareResult);
  const phase3 = runLoadChangeBenchmark(earlierText, benchmarkLaterText, options.phase3Options || {});
  return Object.freeze({
    schema: SUPPORT_REVISION_PHASE4_BENCHMARK_SCHEMA,
    bucket: SUPPORT_REVISION_PHASE4_BUCKET,
    oraclePolicy: 'R3 remarks provide expected labels only; REMARKS (IF ANY) is blanked before comparison. An oracle item without an R2 lineage predecessor is reported unsupported rather than treated as comparison evidence.',
    detectorPolicy: 'Detector authority is a typed TOTAL_SUPPORT_POINTS_CHANGED event derived from the governed categorized-XML field TOTAL SUPPORT POINTS ON SECONDARY on accepted lineage.',
    oracle,
    expected: qualification.expected,
    unsupported: qualification.unsupported,
    detected,
    metrics: Object.freeze({
      oracleExpected: oracle.length,
      unsupported: qualification.unsupported.length,
      ...scoreItems(qualification.expected, detected),
    }),
    phase1Guard: phase3.phase1Guard,
    phase2Guard: phase3.phase2Guard,
    phase3Guard: Object.freeze({ bucket: phase3.bucket, metrics: phase3.metrics }),
    compareStage: compareResult.stage,
    compareOk: compareResult.ok,
    compareResult,
  });
}

export function expectedTotalSupportPointChanges(source) {
  return Object.freeze((source?.rows || []).flatMap((row) => {
    const oracleRemark = read(row, 'REMARKS (IF ANY)');
    if (!totalSupportPointOracleMatch(oracleRemark)) return [];
    const civilSecondarySupport = read(row, 'CIVILSECONDARYSUPPORT');
    const pipe = read(row, 'PIPE');
    const supportLocationKey = compositeSupportLocationIdentity(civilSecondarySupport, pipe);
    return [Object.freeze({
      key: supportLocationKey,
      supportLocationKey,
      rowId: row.rowId,
      civilSecondarySupport,
      pipe,
      totalSupportPoints: read(row, 'TOTAL SUPPORT POINTS ON SECONDARY'),
      oracleRemark,
    })];
  }));
}

export function detectedTotalSupportPointChanges(compareResult) {
  const targetByNode = compareResult?.targetModel?.locationByNodeId || new Map();
  const byKey = new Map();
  for (const event of compareResult?.ledger?.events || []) {
    if (event.type !== SUPPORT_REV_TOTAL_POINTS_EVENT || !event.targetXmlNode) continue;
    const target = targetByNode.get(event.targetXmlNode);
    if (!target) continue;
    const key = target.supportLocationIdentity;
    if (!byKey.has(key)) byKey.set(key, Object.freeze({
      key,
      supportLocationKey: key,
      rowId: target.sourceRowId,
      civilSecondarySupport: target.family,
      pipe: target.pipe.raw,
      eventId: event.eventId,
      before: event.normalizedState?.before ?? null,
      after: event.normalizedState?.after ?? null,
      delta: event.normalizedState?.delta ?? null,
      reasonCodes: event.reasonCodes,
    }));
  }
  return Object.freeze([...byKey.values()]);
}

export function qualifyOracleItems(oracle, compareResult) {
  const targetByIdentity = new Map((compareResult?.targetModel?.locations || []).map((item) => [item.supportLocationIdentity, item]));
  const expected = [];
  const unsupported = [];
  for (const item of oracle || []) {
    const target = targetByIdentity.get(item.supportLocationKey);
    const edge = target ? (compareResult?.lineage?.edges || []).find((candidate) => candidate.targetNodeIds?.includes(target.nodeId)) : null;
    if (!target) {
      unsupported.push(Object.freeze({ ...item, supportStatus: 'UNSUPPORTED', reason: 'TARGET_IDENTITY_NOT_FOUND' }));
      continue;
    }
    if (!edge || !(edge.sourceNodeIds || []).length) {
      unsupported.push(Object.freeze({ ...item, supportStatus: 'UNSUPPORTED', reason: 'NO_LINEAGE_PREDECESSOR', targetXmlNode: target.nodeId }));
      continue;
    }
    if (edge.outcome === 'AMBIGUOUS') {
      unsupported.push(Object.freeze({ ...item, supportStatus: 'UNSUPPORTED', reason: 'AMBIGUOUS_LINEAGE', targetXmlNode: target.nodeId, lineageEdgeId: edge.edgeId }));
      continue;
    }
    expected.push(Object.freeze({ ...item, supportStatus: 'CHECKABLE', targetXmlNode: target.nodeId, lineageEdgeId: edge.edgeId }));
  }
  return Object.freeze({ expected: Object.freeze(expected), unsupported: Object.freeze(unsupported) });
}

export function totalSupportPointOracleMatch(value) {
  return /\btotal\s+no\.?\s+of\s+support\s+changes?\b/i.test(String(value ?? ''));
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

export const _test = Object.freeze({ scoreItems, sourceToCsv, read, parseBenchmarkSource });

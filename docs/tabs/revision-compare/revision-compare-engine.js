/** Stage-oriented compare engine used only inside the independent RC-002 worker. */
import { createRevisionCompareAudit } from './revision-compare-audit.js';
import { buildDifferenceRows } from './revision-compare-differences.js';
import { DEFAULT_REVISION_COMPARE_CONFIG, matchBoundedCandidates, matchExactIdentities } from './revision-compare-matching.js';
import { deepFreeze } from './revision-contract-utils.js';

export class RevisionComparisonCancelledError extends Error {
  constructor() { super('Revision comparison was cancelled.'); this.name = 'RevisionComparisonCancelledError'; this.code = 'REVISION_COMPARE_CANCELLED'; }
}
function clockValue(clock) { return Number(clock?.()) || 0; }
function elapsed(clock, started) { return Math.max(0, clockValue(clock) - started); }
function visualReadiness(basis) {
  const values = [basis.unitCompatibility, basis.coordinateFrameCompatibility, basis.verticalAxisCompatibility];
  const blockers = values.filter((item) => item?.status !== 'COMPATIBLE').map((item) => `${item?.label ?? 'Compatibility'} is ${item?.status ?? 'UNKNOWN'}.`);
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers) });
}
async function yieldStage() { await new Promise((resolve) => setTimeout(resolve, 0)); }
async function checkpoint(context, stage, metrics = {}) {
  if (context.isCancelled()) throw new RevisionComparisonCancelledError();
  context.onProgress(deepFreeze({ stage, ...metrics })); await yieldStage();
  if (context.isCancelled()) throw new RevisionComparisonCancelledError();
}
function assertInput(input) {
  if (!input?.basis || input.basis.validation?.status !== 'READY') throw new Error('A current approved comparison basis is required.');
  if (input.revA?.basisId !== input.basis.basisId || input.revB?.basisId !== input.basis.basisId) throw new Error('Projected records do not belong to the approved basis.');
}
function basicIndex(records) { return new Map(records.map((record) => [record.recordId, record.componentType])); }

export async function runRevisionCompare(input, options = {}) {
  assertInput(input);
  const configuration = deepFreeze({ ...DEFAULT_REVISION_COMPARE_CONFIG, ...(input.configuration ?? {}) });
  const clock = options.clock ?? (() => globalThis.performance?.now?.() ?? 0);
  const context = { onProgress: options.onProgress ?? (() => {}), isCancelled: options.isCancelled ?? (() => false) };
  const totalStarted = clockValue(clock); const timings = {};
  await checkpoint(context, 'Building identity indexes', { recordsProcessed: 0, candidatePairsEvaluated: 0, maximumCandidatesForOneRecord: 0 });
  let started = clockValue(clock); basicIndex(input.revA.records); basicIndex(input.revB.records); timings.indexMilliseconds = elapsed(clock, started);
  await checkpoint(context, 'Matching exact identities', { recordsProcessed: input.revA.records.length });
  started = clockValue(clock); const exact = matchExactIdentities(input.revA.records, input.revB.records); timings.exactMatchMilliseconds = elapsed(clock, started);
  await checkpoint(context, 'Evaluating bounded candidates', { recordsProcessed: exact.matches.length });
  started = clockValue(clock); const inferred = matchBoundedCandidates(exact.unmatchedA, exact.unmatchedB, exact.usedTargets, configuration); timings.candidateMilliseconds = elapsed(clock, started);
  await checkpoint(context, 'Comparing properties', inferred.performance);
  started = clockValue(clock); const rows = buildDifferenceRows(exact, inferred, configuration); timings.propertyCompareMilliseconds = elapsed(clock, started);
  await checkpoint(context, 'Comparing geometry', { ...inferred.performance, recordsProcessed: rows.length });
  started = clockValue(clock); const geometryRows = rows.filter((row) => row.geometryDelta.status === 'AVAILABLE').length; timings.geometryCompareMilliseconds = elapsed(clock, started);
  await checkpoint(context, 'Building visual review', { ...inferred.performance, recordsProcessed: rows.length });
  const receipt = deepFreeze({
    projectRevAMilliseconds: Number(input.projectionReceipt?.projectRevAMilliseconds ?? 0), projectRevBMilliseconds: Number(input.projectionReceipt?.projectRevBMilliseconds ?? 0),
    ...timings, auditBuildMilliseconds: 0, totalMilliseconds: 0, revARecordCount: input.revA.records.length, revBRecordCount: input.revB.records.length,
    ...inferred.performance, geometryRecordCount: geometryRows, cancelled: false,
  });
  const readiness = visualReadiness(input.basis); if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const auditStarted = clockValue(clock);
  let audit = await createRevisionCompareAudit({ ...input, configuration, visualReadiness: readiness }, rows, inferred.candidateEvidence, receipt, options.cryptoRef ?? globalThis.crypto);
  const finalReceipt = deepFreeze({ ...receipt, auditBuildMilliseconds: elapsed(clock, auditStarted), totalMilliseconds: elapsed(clock, totalStarted) });
  audit = deepFreeze({ ...audit, performanceReceipt: finalReceipt }); return audit;
}

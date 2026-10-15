/** Safe-subset Auto fix planner; accepted operations become one transaction. */

import { buildEffectiveTopologySuggestions } from './topology-checker-short-fix.js';
import { asArray, cleanText, deepFreeze, objectRecord, semanticHash } from './topology-validator-values.js';

export const TOPOLOGY_AUTO_FIX_RUN_SCHEMA = 'TopologyAutoFixRun.v1';

/** Plan against an evolving temporary draft; the input draft is never mutated. */
export async function planSafeTopologyAutoFixes(input) {
  assertInput(input);
  const selectedIds = [...new Set(asArray(input.issueIds).map(cleanText).filter(Boolean))].sort();
  const initialIssues = new Map(asArray(input.report.issues).map((row) => [cleanText(row.id), row]));
  let currentCanonical = input.canonical, currentReport = input.report;
  const accepted = [], related = [], rejected = outOfScopeRejections(input, initialIssues);
  for (let index = 0; index < selectedIds.length; index += 1) {
    const issueId = selectedIds[index];
    await reportProgress(input, index, selectedIds.length, issueId);
    const issue = asArray(currentReport.issues).find((row) => cleanText(row.id) === issueId);
    if (!issue) { related.push(resolution(initialIssues.get(issueId), null, 'RESOLVED_BY_RELATED_AUTOFIX')); continue; }
    const suggestion = currentSuggestion(input.core, currentCanonical, currentReport, input.policy, issueId);
    if (!suggestion || suggestion.effectiveFixMode !== 'AUTO' || !asArray(suggestion.operations).length) {
      rejected.push(rejection(issue, suggestion, cleanText(suggestion?.failureReason) || 'AUTO_OPERATION_UNAVAILABLE', suggestion?.rationale)); continue;
    }
    const stepDraft = input.core.createTopologyEditDraft(currentCanonical, input.draft.settings);
    const candidateDraft = input.core.applyTopologyFixSuggestion(stepDraft, suggestion);
    const materialized = input.core.materializeTopologyEditDraft(currentCanonical, candidateDraft);
    const nextReport = input.core.runTopologyChecks(materialized.canonicalTopology, input.checkOptions);
    const failure = postCheckFailure(currentReport, nextReport, issueId);
    if (failure) { rejected.push(rejection(issue, suggestion, failure.code, failure.message)); continue; }
    accepted.push(resolution(issue, suggestion, 'RESOLVED_BY_AUTOFIX'));
    currentCanonical = materialized.canonicalTopology; currentReport = nextReport;
  }
  await reportProgress(input, selectedIds.length, selectedIds.length, '');
  return finalizePlan(input, initialIssues, accepted, related, rejected, currentCanonical, currentReport);
}

async function reportProgress(input, completed, total, issueId) {
  input.onProgress?.(Object.freeze({ completed, total, issueId }));
  if (typeof globalThis.setTimeout === 'function') await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

function finalizePlan(input, initialIssues, accepted, related, rejected, currentCanonical, currentReport) {
  const operations = accepted.flatMap((row) => asArray(row.suggestion.operations));
  const issuedAt = cleanText(input.issuedAt), policyHash = cleanText(input.policyHash);
  const runId = `TAF-${semanticHash({ issuedAt, policyHash, before: input.canonical.canonicalTopologyHash,
    selected: asArray(input.issueIds).map(cleanText).sort() }).split(':')[1]}`;
  const baseRun = {
    schema: TOPOLOGY_AUTO_FIX_RUN_SCHEMA, runId, issuedAt, policyHash,
    beforeTopologyHash: cleanText(input.canonical.canonicalTopologyHash), afterTopologyHash: operations.length ? '' : cleanText(input.canonical.canonicalTopologyHash),
    preflightGeometryHash: topologyGeometryHash(currentCanonical),
    selectedIssueIds: Object.freeze(asArray(input.issueIds).map(cleanText).filter(Boolean)), applied: Object.freeze(accepted),
    related: Object.freeze(related.filter((row) => row.issue)), rejected: Object.freeze(rejected),
    operationCount: operations.length, transactionId: '', committed: operations.length > 0,
  };
  if (!operations.length) return deepFreeze({ candidateDraft: input.draft, finalReport: input.report, run: baseRun });
  const transactionId = `EC-${String(Number(input.draft.nextCommandSequence)).padStart(6, '0')}`;
  const transactionRun = deepFreeze({ ...baseRun, transactionId });
  const suggestionIds = accepted.map((row) => cleanText(row.suggestion.id));
  const issueIds = accepted.map((row) => cleanText(row.issue.id));
  const candidateDraft = input.core.appendTopologyEditTransaction(input.draft, operations, { suggestionIds, issueIds, autoFixRun: transactionRun });
  const final = input.core.materializeTopologyEditDraft(input.baseCanonical, candidateDraft);
  if (topologyGeometryHash(final.canonicalTopology) !== topologyGeometryHash(currentCanonical)) {
    throw new Error('Safe Auto fix final transaction differs from the validated temporary topology.');
  }
  const finalReport = input.core.runTopologyChecks(final.canonicalTopology, input.checkOptions);
  if (semanticHash(finalReport.issues) !== semanticHash(currentReport.issues)) throw new Error('Safe Auto fix final report differs from preflight evidence.');
  const run = deepFreeze({ ...transactionRun, afterTopologyHash: cleanText(final.canonicalTopology.canonicalTopologyHash) });
  return deepFreeze({ candidateDraft, finalReport, run, geometryHash: topologyGeometryHash(final.canonicalTopology) });
}

function currentSuggestion(core, canonical, report, policy, issueId) {
  const producer = core.buildTopologyFixSuggestions(canonical, report, {});
  return buildEffectiveTopologySuggestions(canonical, report, producer, policy).find((row) => cleanText(row.issueId) === issueId) ?? null;
}

function postCheckFailure(before, after, targetId) {
  const beforeMap = new Map(asArray(before.issues).map((row) => [cleanText(row.id), row]));
  const afterMap = new Map(asArray(after.issues).map((row) => [cleanText(row.id), row]));
  if (afterMap.has(targetId)) return { code: 'TARGET_ISSUE_PERSISTS', message: `Issue ${targetId} remains after the proposed operation.` };
  const introduced = [...afterMap.keys()].filter((id) => !beforeMap.has(id));
  if (introduced.length) return { code: 'NEW_FINDINGS_INTRODUCED', message: `Proposed operation introduces ${introduced.length} new finding(s): ${introduced.slice(0, 5).join(', ')}.` };
  for (const [id, next] of afterMap) {
    const previous = beforeMap.get(id); if (!previous) continue;
    if (issueWorsened(previous, next)) return { code: 'EXISTING_FINDING_WORSENED', message: `Existing issue ${id} worsens after the proposed operation.` };
  }
  return null;
}

function issueWorsened(before, after) {
  if (after.blocking === true && before.blocking !== true) return true;
  if (severityRank(after.severity) > severityRank(before.severity)) return true;
  if (['SHORT_ELEMENT', 'EXPECTED_SHORT_INLINE_COMPONENT'].includes(cleanText(before.code))) {
    const oldLength = Number(objectRecord(before.details).lengthMm), nextLength = Number(objectRecord(after.details).lengthMm);
    return Number.isFinite(oldLength) && Number.isFinite(nextLength) && nextLength + 1e-9 < oldLength;
  }
  return false;
}

function resolution(issue, suggestion, outcome) {
  return Object.freeze({ issue: issue ? deepFreeze({ ...issue }) : null, suggestion: suggestion ? deepFreeze({ ...suggestion }) : null, outcome });
}

function rejection(issue, suggestion, reasonCode, message) {
  return Object.freeze({ issueId: cleanText(issue?.id), issueCode: cleanText(issue?.code), suggestionId: cleanText(suggestion?.id),
    reasonCode: cleanText(reasonCode), message: cleanText(message) || 'Auto fix precondition failed.' });
}

function outOfScopeRejections(input, initialIssues) {
  return asArray(input.outOfScopeIssueIds).map(cleanText).filter(Boolean).map((id) => rejection(initialIssues.get(id), null,
    'OUTSIDE_EDIT_SCOPE', 'Auto candidate is outside the selected large-model Draft Edit scope.'));
}

function severityRank(value) { return ({ INFO: 0, WARNING: 1, ERROR: 2, BLOCKER: 3 })[cleanText(value).toUpperCase()] ?? 0; }

export function topologyGeometryHash(canonical) {
  return semanticHash({ nodes: canonical?.nodes, edges: canonical?.edges, pointFeatures: canonical?.pointFeatures,
    junctions: canonical?.junctions, boundaries: canonical?.boundaries, supports: canonical?.supports,
    rigids: canonical?.rigids, bends: canonical?.bends, buildIssues: canonical?.buildIssues });
}

function assertInput(input) {
  if (input?.draft?.schema !== 'TopologyEditDraft.v1') throw new TypeError('Safe Auto fix requires TopologyEditDraft.v1.');
  if (input?.baseCanonical?.schema !== 'CanonicalTopology.v1' || input?.canonical?.schema !== 'CanonicalTopology.v1') throw new TypeError('Safe Auto fix requires base and current CanonicalTopology.v1.');
  if (input?.report?.schema !== 'TopologyCheckReport.v1') throw new TypeError('Safe Auto fix requires TopologyCheckReport.v1.');
  for (const name of ['createTopologyEditDraft', 'applyTopologyFixSuggestion', 'appendTopologyEditTransaction', 'materializeTopologyEditDraft', 'runTopologyChecks', 'buildTopologyFixSuggestions']) {
    if (typeof input.core?.[name] !== 'function') throw new TypeError(`Safe Auto fix core is missing ${name}().`);
  }
}

export const _test = Object.freeze({ currentSuggestion, postCheckFailure, issueWorsened, severityRank, rejection });

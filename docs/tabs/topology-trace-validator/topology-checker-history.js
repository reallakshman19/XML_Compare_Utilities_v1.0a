/** Auto-fix run persistence and active-command-derived Resolved history. */

import { TOPOLOGY_AUTO_FIX_RUN_SCHEMA } from './topology-checker-auto-fix.js';
import { asArray, cleanText, deepFreeze, objectRecord } from './topology-validator-values.js';

const HISTORY_PREFIX = 'xml-compare.topology-checker.autofix-runs.v1.';
const HISTORY_LIMIT = 20;

export function topologyAutoFixHistoryKey(baseHash) { return `${HISTORY_PREFIX}${cleanText(baseHash)}`; }

export function loadTopologyAutoFixRuns(storage, baseHash) {
  const text = storage?.getItem?.(topologyAutoFixHistoryKey(baseHash));
  if (!text) return Object.freeze([]);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.some((row) => cleanText(row?.schema) !== TOPOLOGY_AUTO_FIX_RUN_SCHEMA)) {
    throw new TypeError(`Stored Auto-fix history for ${baseHash} is invalid.`);
  }
  return deepFreeze(parsed.slice(-HISTORY_LIMIT));
}

export function saveTopologyAutoFixRun(storage, baseHash, runs, run) {
  if (cleanText(run?.schema) !== TOPOLOGY_AUTO_FIX_RUN_SCHEMA) throw new TypeError(`Auto-fix run must be ${TOPOLOGY_AUTO_FIX_RUN_SCHEMA}.`);
  const byId = new Map([...asArray(runs), run].map((row) => [cleanText(row.runId), row]));
  const next = [...byId.values()].slice(-HISTORY_LIMIT);
  if (typeof storage?.setItem !== 'function') throw new Error('Browser Auto-fix history storage is unavailable.');
  storage.setItem(topologyAutoFixHistoryKey(baseHash), JSON.stringify(next));
  return deepFreeze(next);
}

export function activeTopologyAutoFixRuns(draft) {
  return deepFreeze(asArray(draft?.commands).map(objectRecord).filter((command) => cleanText(command.type) === 'TRANSACTION')
    .map((command) => objectRecord(objectRecord(command.payload).metadata).autoFixRun)
    .filter((run) => cleanText(run?.schema) === TOPOLOGY_AUTO_FIX_RUN_SCHEMA));
}

export function mergeTopologyAutoFixRuns(stored, draft) {
  const active = activeTopologyAutoFixRuns(draft), activeIds = new Set(active.map((row) => cleanText(row.runId)));
  const byId = new Map(active.map((row) => [cleanText(row.runId), row]));
  for (const row of asArray(stored)) byId.set(cleanText(row.runId), { ...byId.get(cleanText(row.runId)), ...row });
  return deepFreeze([...byId.values()].slice(-HISTORY_LIMIT).map((row) => ({ ...row, active: activeIds.has(cleanText(row.runId)) })));
}

/** Only active transaction receipts can populate the live Resolved bucket. */
export function resolvedTopologyIssues(draft, currentIssues) {
  const currentIds = new Set(asArray(currentIssues).map((row) => cleanText(row.id))), byIssue = new Map();
  for (const run of activeTopologyAutoFixRuns(draft)) for (const record of [...asArray(run.applied), ...asArray(run.related)]) {
    const issue = objectRecord(record).issue, issueId = cleanText(issue?.id);
    if (!issueId || currentIds.has(issueId)) continue;
    byIssue.set(issueId, deepFreeze({ issue, suggestion: objectRecord(record).suggestion,
      outcome: cleanText(record.outcome), runId: cleanText(run.runId), transactionId: cleanText(run.transactionId), resolvedAt: cleanText(run.issuedAt) }));
  }
  return deepFreeze([...byIssue.values()]);
}

export function latestAutoFixFailures(runs) {
  const result = new Map();
  for (const run of asArray(runs)) for (const row of asArray(run.rejected)) {
    const issueId = cleanText(row.issueId); if (issueId) result.set(issueId, deepFreeze({ ...row, runId: cleanText(run.runId) }));
  }
  return result;
}

export const _test = Object.freeze({ HISTORY_PREFIX, HISTORY_LIMIT });

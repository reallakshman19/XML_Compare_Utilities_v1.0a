import assert from 'node:assert/strict';
import {
  activeTargetReservations, DECISION_EVENT_SCHEMA, DECISION_ITEM_SCHEMA, DECISION_LEDGER_SCHEMA,
  decisionSummary, selectedPairFingerprint, SELECTED_PAIR_EVIDENCE_SCHEMA,
} from '../tabs/revision-compare/revision-decision-contracts.js';
import { resolvedRevisionReview } from '../tabs/revision-compare/revision-decision-projection.js';

const COUNT = 5000; const NOW = '2026-07-18T12:00:00.000Z';
const HASH = 'a'.repeat(64); const ledgerId = 'ambiguity-ledger:audit:scale:v1';
const differenceRows = []; const candidateEvidence = []; const decisions = []; const events = []; const pairs = [];
for (let index = 0; index < COUNT; index += 1) {
  const suffix = String(index).padStart(5, '0'); const source = `source:${suffix}`; const target = `target:${suffix}`;
  const differenceId = `difference:${source}:none`; const targetDifferenceId = `difference:none:${target}`; const evidenceId = `candidate:${source}`;
  const pairId = `selected-pair:${ledgerId}:${source}:${target}`; const eventId = `${ledgerId}:event:${index + 1}`;
  const ranked = { targetRecordId: target, score: 6, reasons: ['same nominal size'], geometryDistance: 0 };
  differenceRows.push({ differenceId, differenceCategory: 'REMOVED', matchCertainty: 'AMBIGUOUS', sourceRecordId: source, targetRecordId: null, candidateEvidenceId: evidenceId });
  differenceRows.push({ differenceId: targetDifferenceId, differenceCategory: 'ADDED', matchCertainty: 'NOT_APPLICABLE', sourceRecordId: null, targetRecordId: target, candidateEvidenceId: null });
  candidateEvidence.push({ candidateEvidenceId: evidenceId, sourceRecordId: source, candidateRecordIds: [target], candidateCount: 1, candidateLimit: 8, rankedEvidence: [ranked], thresholds: { inferredThreshold: 4, winnerGap: 1.5 }, scoreGapOrDecisionBasis: 'single passing candidate', rejectionReasons: [], reachedCandidateLimit: false });
  const core = { differenceId, sourceRecordId: source, targetRecordId: target, targetDifferenceId, candidateEvidenceId: evidenceId, rank: 1, score: 6, reasons: ranked.reasons, geometryDistance: 0, thresholds: { inferredThreshold: 4, winnerGap: 1.5 }, candidateLimit: 8, decisionBasis: 'single passing candidate' };
  pairs.push({ schema: SELECTED_PAIR_EVIDENCE_SCHEMA, selectedPairEvidenceId: pairId, ...core, evidenceHash: selectedPairFingerprint(core) });
  decisions.push({ schema: DECISION_ITEM_SCHEMA, differenceId, sourceRecordId: source, candidateEvidenceId: evidenceId, decisionState: 'ACCEPTED_CANDIDATE', acceptedTargetRecordId: target, acceptedTargetDifferenceId: targetDifferenceId, rationale: 'accepted by scale fixture', rationaleHash: HASH, activeEventId: eventId, selectedPairEvidenceId: pairId, updatedAt: NOW, eventIds: [eventId] });
  events.push({ schema: DECISION_EVENT_SCHEMA, eventId, sequence: index + 1, differenceId, action: 'ACCEPT_CANDIDATE', previousDecisionState: 'UNDECIDED', nextDecisionState: 'ACCEPTED_CANDIDATE', previousTargetRecordId: null, nextTargetRecordId: target, rationale: 'accepted by scale fixture', rationaleHash: HASH, occurredAt: NOW, supersedesEventId: null, selectedPairEvidenceId: pairId });
}
const audit = { schema: 'RevisionCompareAudit.v1', auditId: 'audit:scale', basisId: 'basis:scale', revADocumentId: 'doc:A', revBDocumentId: 'doc:B', validation: { status: 'READY', errors: [] }, differenceRows, candidateEvidence };
const ledger = { schema: DECISION_LEDGER_SCHEMA, ledgerId, auditId: audit.auditId, basisId: audit.basisId, revADocumentId: audit.revADocumentId, revBDocumentId: audit.revBDocumentId, status: 'CURRENT', revision: events.length, createdAt: NOW, updatedAt: NOW, decisions, events, selectedPairEvidence: pairs, summary: decisionSummary(decisions), validation: { status: 'READY', errors: [] } };
const started = performance.now(); const reservations = activeTargetReservations(ledger); const projection = resolvedRevisionReview(audit, ledger); const elapsedMilliseconds = performance.now() - started;
assert.equal(reservations.size, COUNT); assert.equal(projection.summary.resolvedCandidateCount, COUNT);
assert.equal(projection.summary.activeTargetReservations, COUNT); assert.equal(projection.rows.filter((row) => row.decisionState === 'CONSUMED_BY_ACCEPTED_CANDIDATE').length, COUNT);
assert.equal(new Set(projection.rows.filter((row) => row.consumedByDifferenceId).map((row) => row.differenceId)).size, COUNT);
assert(elapsedMilliseconds < 10_000, `5,000-item decision projection took ${elapsedMilliseconds} ms`);
const receipt = Object.freeze({ ambiguityItems: COUNT, activeReservations: reservations.size, projectedAuditRows: projection.rows.length, elapsedMilliseconds });
console.log('revision-compare-rc004-scale.test.mjs passed', receipt);

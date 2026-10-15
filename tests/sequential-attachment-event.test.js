import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';

function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}
function sessionReport(result, indexes) {
  return {
    state: result.session.state,
    outcomes: result.outcomes,
    confirmedComponents: result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId),
    operations: result.session.strokeLedger.map((row) => row.op),
    pendingJunctions: result.session.pendingBranchJunctions,
    blockedReason: result.session.currentDecisionRequest?.reason || null,
    candidates: (result.session.currentDecisionRequest?.candidates || []).map((candidate) => ({
      targetSourceComponentId: candidate.targetSourceComponentId,
      targetComponentType: candidate.targetComponentType,
      targetPortRole: candidate.targetPortRole,
      sourceAdjacent: candidate.sourceAdjacent,
      attachmentEvent: candidate.attachmentEvent,
      gapMm: candidate.gapMm,
    })),
  };
}

let resolvedReport;
let brokenReport;

{
  const main = '/EVENT/MAIN';
  const side = '/EVENT/SIDE';
  const records = [
    { type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
      { type: 'OLET', name: 'O1', attributes: { NAME: 'O1', POS: { x: 100, y: 0, z: 0 }, CREF: side } },
      { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 200, y: 0, z: 0 } } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 200, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: side, attributes: { NAME: side, HPOS: { x: 100, y: 20, z: 0 } }, children: [
      { type: 'PIPE', name: 'SP1', attributes: { APOS: { x: 100, y: 20, z: 0 }, LPOS: { x: 100, y: 80, z: 0 } } },
      { type: 'CAP', name: 'SC1', attributes: { APOS: { x: 100, y: 80, z: 0 } } },
    ] },
  ];
  const { evidence, indexes, session } = setup(records, main);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  resolvedReport = sessionReport(result, indexes);
  mkdirSync('artifacts/sequential-sketcher', { recursive: true });
  writeFileSync('artifacts/sequential-sketcher/attachment-event-probe.json', `${JSON.stringify({ resolvedReport }, null, 2)}\n`, 'utf8');
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  const components = result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId);
  assert.deepEqual(components.slice(0, 4), ['P1', 'O1', 'P2', 'C1']);
  const operations = result.session.strokeLedger.map((row) => row.op);
  assert.ok(operations.indexOf('DRAW_OLET') > operations.indexOf('DRAW_PIPE'));
  assert.ok(operations.indexOf('DRAW_OLET') < operations.indexOf('DRAW_CAP'));
  assert.equal(result.session.currentDecisionRequest, null);
}

{
  const main = '/EVENT/BROKEN';
  const records = [{ type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'OLET', name: 'O1', attributes: { NAME: 'O1', POS: { x: 130, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 200, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, main);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  brokenReport = sessionReport(result, indexes);
  mkdirSync('artifacts/sequential-sketcher', { recursive: true });
  writeFileSync('artifacts/sequential-sketcher/attachment-event-probe.json', `${JSON.stringify({ resolvedReport, brokenReport }, null, 2)}\n`, 'utf8');
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'ATTACHMENT_EVENT_GAP_EXCEEDS_LIMIT');
  assert.deepEqual(result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId), ['P1']);
  assert.equal(result.session.strokeLedger.filter((row) => row.op === 'DRAW_PIPE').length, 1, 'later pipe must not bypass broken OLET event');
}

console.log('sequential attachment event tests passed');

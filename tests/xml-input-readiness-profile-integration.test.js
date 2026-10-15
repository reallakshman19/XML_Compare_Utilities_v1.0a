import assert from 'node:assert/strict';

import {
  createInputReadinessAuditFromWorkspace,
  serializeInputReadinessAuditJson,
} from '../xml-compare/input/create-input-readiness-audit-from-workspace.js';

function record(uid = 'r1') {
  return { uid, lineNo: 'L1', fromNode: '10', toNode: '20', componentType: 'PIPE', position: { x: 1, y: 2, z: 3 } };
}

const state = {
  fileA: { name: 'bad-source.xml' },
  fileB: { name: 'unsupported-target.json' },
  textA: '<Root><Broken></Root>',
  textB: '{"foo":"bar"}',
  report: { datasets: { A: {}, B: {} }, parseErrors: [] },
};
const workspace = {
  source: { profile: 'unknown', baseRecords: [], diagnostics: [] },
  target: {
    profile: 'unknown',
    baseRecords: [],
    diagnostics: [
      { severity: 'BLOCKER', code: 'unsupported_json_profile', message: 'JSON input shape is not supported by XML Compare intake.' },
    ],
  },
  diagnostics: [],
};
const beforeState = JSON.stringify(state);
const beforeWorkspace = JSON.stringify(workspace);

const audit = createInputReadinessAuditFromWorkspace({ state, workspace, generatedAt: '2026-07-03T07:55:00.000Z' });
assert.equal(audit.sourceA.diagnostics.some((item) => item.code === 'xml_parse_failed'), true);
assert.equal(audit.targetB.diagnostics.some((item) => item.code === 'xml_parse_failed'), false);
assert.equal(audit.targetB.diagnostics.some((item) => item.code === 'unsupported_json_profile'), true);
assert.equal(audit.sourceA.diagnostics.some((item) => item.code === 'unsupported_json_profile'), false);
assert.equal(audit.targetB.diagnostics.filter((item) => item.code === 'unsupported_json_profile').length, 1);
assert.ok(audit.sourceA.identitySummary);
assert.ok(audit.sourceA.coordinateFrameSummary);

const zeroRecord = createInputReadinessAuditFromWorkspace({
  state: { fileA: { name: 'zero.xml' }, textA: '<PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" /></PIPINGMODEL>', textB: '<PIPINGMODEL><PIPINGELEMENT FROM_NODE="30" TO_NODE="40" /></PIPINGMODEL>' },
  workspace: {
    source: { profile: 'inputxml', confidence: 0.9, baseRecords: [] },
    target: { profile: 'inputxml', confidence: 0.9, baseRecords: [record('b1')] },
  },
});
assert.equal(zeroRecord.sourceA.readyForConnector, false);
assert.equal(zeroRecord.sourceA.diagnostics.some((item) => item.code === 'zero_records' && item.severity === 'BLOCKER'), true);

const json = serializeInputReadinessAuditJson(audit);
assert.equal(json.endsWith('\n'), true);
assert.equal(JSON.parse(json).schema, 'xml-input-readiness-audit/v1');
assert.equal(JSON.stringify(state), beforeState);
assert.equal(JSON.stringify(workspace), beforeWorkspace);

console.log('XML input readiness profile integration tests passed');

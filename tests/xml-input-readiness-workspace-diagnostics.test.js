import assert from 'node:assert/strict';

import {
  createInputReadinessAuditFromWorkspace,
  createReadinessSideInputFromWorkspace,
  serializeInputReadinessAuditJson,
} from '../xml-compare/input/create-input-readiness-audit-from-workspace.js';

function record(uid = 'r1') {
  return { uid, lineNo: 'L1', fromNode: '10', toNode: '20', componentType: 'PIPE', position: { x: 1, y: 2, z: 3 } };
}

const state = {
  fileA: { name: 'source.xml' },
  fileB: { name: 'target.xml' },
  textA: '<Root>A</Root>',
  textB: '<Root>B</Root>',
  report: {
    parseErrors: ['global parse issue'],
    datasets: {
      A: { error: 'source dataset parse failed', diagnostics: [{ severity: 'WARNING', code: 'source_dataset_diag', message: 'source dataset warning' }] },
      B: { error: 'target dataset parse failed', diagnostics: [{ severity: 'INFO', code: 'target_dataset_diag', message: 'target dataset info' }] },
    },
  },
};
const workspace = {
  source: {
    profile: 'CategorizedInputXML',
    baseRecords: [record('a1')],
    diagnostics: [{ severity: 'WARNING', code: 'source_model_diag', message: 'source model warning' }],
    intake: { diagnostics: [{ severity: 'INFO', code: 'source_intake_diag', message: 'source intake info' }] },
    adapter: { diagnostics: [{ severity: 'WARNING', code: 'source_adapter_diag', message: 'source adapter warning' }] },
  },
  target: {
    profile: 'CategorizedInputXML',
    baseRecords: [record('b1')],
    diagnostics: [{ severity: 'WARNING', code: 'target_model_diag', message: 'target model warning' }],
    intake: { diagnostics: [{ severity: 'INFO', code: 'target_intake_diag', message: 'target intake info' }] },
    adapter: { diagnostics: [{ severity: 'WARNING', code: 'target_adapter_diag', message: 'target adapter warning' }] },
  },
  diagnostics: [
    { severity: 'WARNING', code: 'workspace_global_diag', message: 'global workspace warning' },
    { severity: 'WARNING', code: 'workspace_source_diag', message: 'source workspace warning', datasetId: 'A' },
    { severity: 'WARNING', code: 'workspace_target_diag', message: 'target workspace warning', datasetId: 'B' },
  ],
};
const stateBefore = JSON.stringify(state);
const workspaceBefore = JSON.stringify(workspace);

const sourceInput = createReadinessSideInputFromWorkspace({ state, workspace, side: 'a' });
const targetInput = createReadinessSideInputFromWorkspace({ state, workspace, side: 'b' });
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'source_model_diag'), true);
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'source_intake_diag'), true);
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'source_adapter_diag'), true);
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'workspace_source_diag'), true);
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'workspace_target_diag'), false);
assert.equal(targetInput.diagnostics.some((item) => item.code === 'target_model_diag'), true);
assert.equal(targetInput.diagnostics.some((item) => item.code === 'target_intake_diag'), true);
assert.equal(targetInput.diagnostics.some((item) => item.code === 'target_adapter_diag'), true);

const audit = createInputReadinessAuditFromWorkspace({ state, workspace, generatedAt: '2026-07-03T07:00:00.000Z' });
const sourceMessages = audit.sourceA.diagnostics.map((item) => item.message);
const targetMessages = audit.targetB.diagnostics.map((item) => item.message);
assert.equal(audit.sourceA.diagnostics.some((item) => item.code === 'parse_error' && item.severity === 'BLOCKER'), true);
assert.equal(audit.targetB.diagnostics.some((item) => item.code === 'parse_error' && item.severity === 'BLOCKER'), true);
assert.equal(sourceMessages.includes('global parse issue'), true);
assert.equal(targetMessages.includes('global parse issue'), true);
assert.equal(sourceMessages.includes('source dataset parse failed'), true);
assert.equal(targetMessages.includes('source dataset parse failed'), false);
assert.equal(targetMessages.includes('target dataset parse failed'), true);
assert.equal(sourceMessages.includes('target dataset parse failed'), false);
assert.equal(audit.sourceA.diagnostics.some((item) => item.code === 'source_dataset_diag'), true);
assert.equal(audit.targetB.diagnostics.some((item) => item.code === 'target_dataset_diag'), true);

const json = serializeInputReadinessAuditJson(audit);
assert.equal(JSON.parse(json).schema, 'xml-input-readiness-audit/v1');
assert.equal(json.endsWith('\n'), true);
assert.equal(JSON.stringify(state), stateBefore);
assert.equal(JSON.stringify(workspace), workspaceBefore);

console.log('XML input readiness workspace diagnostics tests passed');

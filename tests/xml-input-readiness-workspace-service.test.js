import assert from 'node:assert/strict';

import {
  createInputReadinessAuditFromWorkspace,
  createReadinessSideInputFromWorkspace,
  serializeInputReadinessAuditJson,
} from '../xml-compare/input/create-input-readiness-audit-from-workspace.js';

const sourceBaseRecords = Object.freeze([
  Object.freeze({ uid: 'a1', lineNo: 'L1', fromNode: '10', toNode: '20', componentType: 'PIPE', position: { x: 1, y: 2, z: 3 } }),
]);
const sourceRecords = Object.freeze([Object.freeze({ uid: 'fallback-only' })]);
const targetRecords = Object.freeze([
  Object.freeze({ uid: 'b1', lineNo: 'L2', elementKey: 'E2', nodeNumber: '30', role: 'FROM', globalX: '1', globalY: '2', globalZ: '3', coordinateBasisNode: 'N30' }),
]);

const state = {
  fileA: { name: 'loaded-source.xml' },
  fileB: { name: 'loaded-target.xml' },
  textA: '<CategorizedInputXML><Line id="L1" /></CategorizedInputXML>',
  textB: '<CategorizedInputXML><Line id="L2" /></CategorizedInputXML>',
};
const workspace = {
  source: {
    fileName: 'workspace-source.xml',
    profile: 'CategorizedInputXML',
    baseRecords: sourceBaseRecords,
    records: sourceRecords,
    diagnostics: [{ severity: 'WARNING', code: 'source_model_warning', message: 'source warning' }],
    intake: { diagnostics: [{ severity: 'INFO', code: 'source_intake_info', message: 'source info' }] },
  },
  target: {
    fileName: 'workspace-target.xml',
    profile: 'CategorizedInputXML',
    records: targetRecords,
    diagnostics: [{ severity: 'WARNING', code: 'target_model_warning', message: 'target warning' }],
    intake: { diagnostics: [{ severity: 'INFO', code: 'target_intake_info', message: 'target info' }] },
  },
};

const beforeState = JSON.stringify(state);
const beforeWorkspace = JSON.stringify(workspace);

const sourceInput = createReadinessSideInputFromWorkspace({ state, workspace, side: 'a' });
assert.equal(sourceInput.sourceId, 'A');
assert.equal(sourceInput.side, 'Source A');
assert.equal(sourceInput.fileName, 'loaded-source.xml');
assert.equal(sourceInput.rawText, state.textA);
assert.equal(sourceInput.profile, 'CategorizedInputXML');
assert.equal(sourceInput.dataset, workspace.source);
assert.equal(sourceInput.records, sourceBaseRecords);
assert.equal(sourceInput.diagnostics.length, 2);
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'source_model_warning'), true);
assert.equal(sourceInput.diagnostics.some((item) => item.code === 'source_intake_info'), true);

const targetInput = createReadinessSideInputFromWorkspace({ state, workspace, side: 'b' });
assert.equal(targetInput.sourceId, 'B');
assert.equal(targetInput.side, 'Target B');
assert.equal(targetInput.fileName, 'loaded-target.xml');
assert.equal(targetInput.rawText, state.textB);
assert.equal(targetInput.records, targetRecords);

const noFile = createReadinessSideInputFromWorkspace({ state: { textA: 'x' }, workspace, side: 'a' });
assert.equal(noFile.fileName, 'workspace-source.xml');

const emptyRecords = createReadinessSideInputFromWorkspace({ state: {}, workspace: { source: {} }, side: 'a' });
assert.deepEqual(emptyRecords.records, []);

const audit = createInputReadinessAuditFromWorkspace({ state, workspace, generatedAt: '2026-07-03T05:40:00.000Z' });
assert.equal(audit.sourceA.identitySummary.stableCount, 1);
assert.equal(audit.targetB.coordinateFrameSummary.sideloadGlobalCount, 1);
assert.equal(audit.targetB.coordinateFrameSummary.comparableForDeltaCount, 1);

const json = serializeInputReadinessAuditJson(audit);
assert.equal(json.endsWith('\n'), true);
assert.equal(JSON.parse(json).schema, 'xml-input-readiness-audit/v1');

assert.equal(JSON.stringify(state), beforeState);
assert.equal(JSON.stringify(workspace), beforeWorkspace);

console.log('XML input readiness workspace service tests passed');

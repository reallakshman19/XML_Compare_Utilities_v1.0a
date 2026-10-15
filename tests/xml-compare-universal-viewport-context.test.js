import assert from 'node:assert/strict';
import {
  createUniversalViewportContext,
  publishUniversalViewportContext,
  readUniversalViewportContext,
  clearUniversalViewportContext,
} from '../xml-compare/universal-categorizer/universal-viewport-context.js';

const sourceRecords = Object.freeze([
  Object.freeze({
    uid: 'source:element:10-20', fromNode: '10', toNode: '20', lineNo: 'LINE-100',
  }),
  Object.freeze({
    uid: 'source:node:10', nodeNumber: '10', position: Object.freeze({ x: 1, y: 2, z: 3 }),
  }),
  Object.freeze({
    uid: 'source:restraint:20', nodeNumber: '20', evidenceKind: 'RestraintsBlock',
    TYPE: 'GUIDE', STIFFNESS: '1000', GAP: '5', TAG: 'RS-20',
  }),
]);
const targetRecords = Object.freeze([
  Object.freeze({ uid: 'target:element:10-20', levelId: 'element', elementKey: '10+20', displayName: 'Element 10-20', LINE_ID: 'LINE-100' }),
  Object.freeze({ uid: 'target:node:10', levelId: 'node', nodeNumber: '10', displayName: 'Node 10', elementKey: '10+20' }),
  Object.freeze({ uid: 'target:node:20', levelId: 'node', nodeNumber: '20', displayName: 'Node 20', elementKey: '10+20' }),
]);
const workspace = Object.freeze({
  source: Object.freeze({ fileName: 'source.xml', records: sourceRecords, baseRecords: sourceRecords }),
  target: Object.freeze({ fileName: 'target.xml', records: targetRecords, baseRecords: targetRecords }),
});
const state = Object.freeze({ workspaceRevision: 4 });

const context = createUniversalViewportContext({ state, workspace });
assert.equal(context.schema, 'universal-viewport-context/v1');
assert.equal(context.status, 'loaded');
assert.equal(context.usableLoaded, true);
assert.equal(context.sourceInputs.mainXml.rows.length, 3);
assert.deepEqual(context.sourceInputs.lineIdLookup.rows[0], { FROM_NODE: '10', TO_NODE: '20', LINE_ID: 'LINE-100' });
assert.deepEqual(context.sourceInputs.coordinateLookup.rows[0], { NODE: '10', GLOBAL_X: 1, GLOBAL_Y: 2, GLOBAL_Z: 3 });
assert.equal(context.sourceInputs.restraintLookup.rows[0].TAG, 'RS-20');
assert.deepEqual(context.targetRows.map((row) => row.levelId), ['element', 'node', 'node']);
assert.ok(Object.isFrozen(context));
assert.ok(Object.isFrozen(context.sourceInputs));
assert.equal(sourceRecords[0].FROM_NODE, undefined);

const repeat = createUniversalViewportContext({ state, workspace });
assert.equal(repeat.signature, context.signature);
const changed = createUniversalViewportContext({ state: { workspaceRevision: 5 }, workspace });
assert.notEqual(changed.signature, context.signature);

const missingTarget = createUniversalViewportContext({
  state,
  workspace: { source: workspace.source, target: { fileName: 'plain.xml', records: [{ uid: 'plain:1' }] } },
});
assert.equal(missingTarget.status, 'sample');
assert.equal(missingTarget.targetRows.length, 0);
assert.ok(missingTarget.diagnostics.some((item) => item.code === 'XMLB_TARGET_LEVEL_IDENTITY_UNAVAILABLE'));

const docA = {};
const docB = {};
publishUniversalViewportContext(docA, { state, workspace });
publishUniversalViewportContext(docB, { state: { workspaceRevision: 8 }, workspace });
assert.equal(readUniversalViewportContext(docA).signature, context.signature);
assert.notEqual(readUniversalViewportContext(docA).signature, readUniversalViewportContext(docB).signature);
assert.equal(clearUniversalViewportContext(docA), true);
assert.equal(readUniversalViewportContext(docA), null);

console.log('xml-compare universal viewport context tests passed');

import assert from 'node:assert/strict';
import {
  PIPELINE_CAD_PRECISION_EXPRESSION_SCHEMA,
  PIPELINE_CAD_PRECISION_RESULT_SCHEMA,
  PIPELINE_CAD_PRECISION_SESSION_SCHEMA,
  createPipelineCadPrecisionExpression,
  createPipelineCadPrecisionResult,
  createPipelineCadPrecisionSession,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-precision-contracts.js';

const expression = createPipelineCadPrecisionExpression({ kind: 'pair', mode: 'relative', raw: '@2.5,-0.4', values: [2.5, -0.4] });
assert.equal(expression.schema, PIPELINE_CAD_PRECISION_EXPRESSION_SCHEMA);
assert.equal(expression.mode, 'relative');
assert.deepEqual(expression.values, [2.5, -0.4]);
assert.ok(Object.isFrozen(expression));
assert.ok(Object.isFrozen(expression.values));

const session = createPipelineCadPrecisionSession({
  sessionId: 'session-1',
  graph: 'table2x',
  entityId: 'table2a-0002',
  entityType: 'elevation-node',
  sourceRevision: 3,
  coordinateMode: 'canonical',
  inputMode: 'absolute',
  source: 'typed',
  before: { station: 6.7, elevation: 230.95 },
  requested: { x: 7.2, y: 231.1 },
  staged: { station: 7.2, elevation: 231.1 },
});
assert.equal(session.schema, PIPELINE_CAD_PRECISION_SESSION_SCHEMA);
assert.ok(Object.isFrozen(session.before));
assert.ok(Object.isFrozen(session.staged));
assert.throws(() => { session.staged.station = 99; }, TypeError);

const result = createPipelineCadPrecisionResult({ session, reason: 'move-table2-node' });
assert.equal(result.schema, PIPELINE_CAD_PRECISION_RESULT_SCHEMA);
assert.equal(result.reason, 'move-table2-node');
assert.deepEqual(result.after, session.staged);
assert.ok(Object.isFrozen(result));

assert.throws(() => createPipelineCadPrecisionExpression({ kind: 'pair', values: [1] }), /require 2/);
assert.throws(() => createPipelineCadPrecisionSession({ graph: 'bad', entityId: 'x', entityType: 'node', sourceRevision: 0 }), /graph/);
assert.throws(() => createPipelineCadPrecisionResult({ session }), /reason/);

console.log('Pipeline CAD precision contract tests passed');

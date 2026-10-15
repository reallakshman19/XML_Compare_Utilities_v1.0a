import assert from 'node:assert/strict';
import { PipelineCadMarkupMode, PipelineCadMarkupStage } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-interaction-contracts.js';
import { createPipelineCadMarkupInteractionSession } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-interaction-session.js';

const anchor = (id, x, y) => Object.freeze({
  anchor: Object.freeze({ kind: 'ENTITY', graph: 'table2x', entityId: id, entityType: 'elevation-node', pointRole: 'ENDPOINT' }),
  worldPoint: Object.freeze({ x, y }), acquisitionMode: 'endpoint', identity: `table2x:elevation-node:${id}`,
});
const session = createPipelineCadMarkupInteractionSession();
const events = [];
const unsubscribe = session.subscribe((event) => events.push(event.reason));
assert.equal(session.getState().mode, null);
session.activate(PipelineCadMarkupMode.DIMENSION_HORIZONTAL, 'table2x');
session.acceptAnchor(anchor('a', 0, 0));
assert.equal(session.getState().stage, PipelineCadMarkupStage.SECOND_ANCHOR);
assert.throws(() => session.acceptAnchor(anchor('same', 0, 0)), /different points/);
session.acceptAnchor(anchor('b', 5, 2));
assert.equal(session.getState().stage, PipelineCadMarkupStage.OFFSET);
session.updatePointer({ x: 3, y: 4 });
assert.equal(session.backspace(), true);
assert.equal(session.getState().second, null);
assert.equal(session.cancelTransient('escape'), true);
assert.equal(session.getState().stage, PipelineCadMarkupStage.FIRST_ANCHOR);

session.activate(PipelineCadMarkupMode.MARKUP_SELECT, 'table2x');
session.setSelection({ id: 'pcad-dim-000001', kind: 'DIMENSION', graph: 'table2x', status: 'ACTIVE' });
session.beginDrag({ id: 'pcad-dim-000001', kind: 'DIMENSION', startWorld: { x: 1, y: 1 }, initial: { offset: 0 } });
session.updateDrag({ offset: 2 }, { x: 1, y: 3 });
assert.deepEqual(session.finishDrag().previewPatch, { offset: 2 });
const ids = new Set(['pcad-dim-000001']);
assert.equal(session.reconcileSelection(ids).id, 'pcad-dim-000001');
assert.equal(session.reconcileSelection(new Set()), null);

unsubscribe();
const count = events.length;
session.activate(PipelineCadMarkupMode.ANNOTATION, 'table3x');
assert.equal(events.length, count, 'unsubscribed listener receives no events');
assert.equal(session.destroy(), true);
assert.equal(session.destroy(), false);
assert.throws(() => session.activate(PipelineCadMarkupMode.MARKUP_SELECT, 'table2x'), /destroyed/);
console.log('Pipeline CAD markup interaction session: ok');

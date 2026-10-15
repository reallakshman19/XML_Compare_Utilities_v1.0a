import assert from 'node:assert/strict';
import {
  PIPELINE_CAD_MARKUP_INTERACTION_PREVIEW_SCHEMA,
  PIPELINE_CAD_MARKUP_INTERACTION_STATE_SCHEMA,
  PipelineCadMarkupMode,
  PipelineCadMarkupStage,
  createPipelineCadMarkupInteractionPreview,
  createPipelineCadMarkupInteractionState,
  emptyPipelineCadMarkupInteractionState,
  pipelineCadMarkupDimensionType,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-interaction-contracts.js';

const initial = emptyPipelineCadMarkupInteractionState();
assert.equal(initial.schema, PIPELINE_CAD_MARKUP_INTERACTION_STATE_SCHEMA);
assert.equal(initial.mode, null);
assert.equal(initial.graph, null);
assert.equal(initial.stage, PipelineCadMarkupStage.IDLE);
assert(Object.isFrozen(initial));

for (const [mode, type] of [
  [PipelineCadMarkupMode.DIMENSION_HORIZONTAL, 'LINEAR_HORIZONTAL'],
  [PipelineCadMarkupMode.DIMENSION_VERTICAL, 'LINEAR_VERTICAL'],
  [PipelineCadMarkupMode.DIMENSION_ALIGNED, 'LINEAR_ALIGNED'],
]) {
  const state = createPipelineCadMarkupInteractionState({ mode, graph: 'table2x' });
  assert.equal(state.stage, PipelineCadMarkupStage.FIRST_ANCHOR);
  assert.equal(pipelineCadMarkupDimensionType(mode), type);
}
assert.equal(createPipelineCadMarkupInteractionState({ mode: PipelineCadMarkupMode.MARKUP_SELECT, graph: 'table3x' }).stage, PipelineCadMarkupStage.SELECT);
assert.equal(createPipelineCadMarkupInteractionState({ mode: PipelineCadMarkupMode.ANNOTATION, graph: 'table2x' }).stage, PipelineCadMarkupStage.ANCHOR);
assert.throws(() => createPipelineCadMarkupInteractionState({ mode: 'BAD', graph: 'table2x' }), /mode is invalid/);
assert.throws(() => createPipelineCadMarkupInteractionState({ mode: PipelineCadMarkupMode.MARKUP_SELECT }), /activate together/);

const preview = createPipelineCadMarkupInteractionPreview({ graph: 'table2x', pointer: { x: 1, y: 2 } });
assert.equal(preview.schema, PIPELINE_CAD_MARKUP_INTERACTION_PREVIEW_SCHEMA);
assert(Object.isFrozen(preview));
assert(Object.isFrozen(preview.pointer));
console.log('Pipeline CAD markup interaction contracts: ok');

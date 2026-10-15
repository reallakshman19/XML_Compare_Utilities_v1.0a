export const PIPELINE_CAD_MARKUP_INTERACTION_STATE_SCHEMA =
  'PipelineCadMarkupInteractionState.v1';
export const PIPELINE_CAD_MARKUP_INTERACTION_PREVIEW_SCHEMA =
  'PipelineCadMarkupInteractionPreview.v1';

export const PipelineCadMarkupMode = Object.freeze({
  MARKUP_SELECT: 'MARKUP_SELECT',
  DIMENSION_HORIZONTAL: 'DIMENSION_HORIZONTAL',
  DIMENSION_VERTICAL: 'DIMENSION_VERTICAL',
  DIMENSION_ALIGNED: 'DIMENSION_ALIGNED',
  ANNOTATION: 'ANNOTATION',
});

export const PipelineCadMarkupStage = Object.freeze({
  IDLE: 'IDLE',
  SELECT: 'SELECT',
  FIRST_ANCHOR: 'FIRST_ANCHOR',
  SECOND_ANCHOR: 'SECOND_ANCHOR',
  OFFSET: 'OFFSET',
  ANCHOR: 'ANCHOR',
  PALETTE: 'PALETTE',
  DRAGGING: 'DRAGGING',
});

const DIMENSION_TYPES = Object.freeze({
  DIMENSION_HORIZONTAL: 'LINEAR_HORIZONTAL',
  DIMENSION_VERTICAL: 'LINEAR_VERTICAL',
  DIMENSION_ALIGNED: 'LINEAR_ALIGNED',
});
const MODES = new Set(Object.values(PipelineCadMarkupMode));
const GRAPHS = new Set(['table2x', 'table3x']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

export function pipelineCadMarkupDimensionType(mode) {
  return DIMENSION_TYPES[mode] || null;
}

export function isPipelineCadMarkupDimensionMode(mode) {
  return Boolean(pipelineCadMarkupDimensionType(mode));
}

export function pipelineCadMarkupInitialStage(mode) {
  if (!mode) return PipelineCadMarkupStage.IDLE;
  if (mode === PipelineCadMarkupMode.MARKUP_SELECT) return PipelineCadMarkupStage.SELECT;
  if (mode === PipelineCadMarkupMode.ANNOTATION) return PipelineCadMarkupStage.ANCHOR;
  if (isPipelineCadMarkupDimensionMode(mode)) return PipelineCadMarkupStage.FIRST_ANCHOR;
  throw new TypeError(`Unsupported Pipeline CAD markup mode: ${mode}.`);
}

export function createPipelineCadMarkupInteractionState(input = {}) {
  const mode = input.mode ?? null;
  const graph = input.graph ?? null;
  if (mode !== null && !MODES.has(mode)) throw new TypeError('Markup mode is invalid.');
  if (graph !== null && !GRAPHS.has(graph)) throw new TypeError('Markup graph is invalid.');
  if ((mode === null) !== (graph === null)) throw new TypeError('Markup mode and graph must activate together.');
  return freeze({
    schema: PIPELINE_CAD_MARKUP_INTERACTION_STATE_SCHEMA,
    mode,
    graph,
    stage: input.stage || pipelineCadMarkupInitialStage(mode),
    first: input.first || null,
    second: input.second || null,
    pointer: input.pointer || null,
    annotation: input.annotation || null,
    selected: input.selected || null,
    drag: input.drag || null,
    feedback: input.feedback || null,
  });
}

export function emptyPipelineCadMarkupInteractionState() {
  return createPipelineCadMarkupInteractionState();
}

export function createPipelineCadMarkupInteractionPreview(input = {}) {
  return freeze({
    schema: PIPELINE_CAD_MARKUP_INTERACTION_PREVIEW_SCHEMA,
    graph: input.graph || null,
    mode: input.mode || null,
    stage: input.stage || PipelineCadMarkupStage.IDLE,
    first: input.first || null,
    second: input.second || null,
    pointer: input.pointer || null,
    dimensionType: input.dimensionType || null,
    offset: Number.isFinite(Number(input.offset)) ? Number(input.offset) : 0,
    annotation: input.annotation || null,
    selectedItem: input.selectedItem || null,
    dragItem: input.dragItem || null,
    feedback: input.feedback || null,
  });
}

export const _markupInteractionContractTest = Object.freeze({ freeze, DIMENSION_TYPES });

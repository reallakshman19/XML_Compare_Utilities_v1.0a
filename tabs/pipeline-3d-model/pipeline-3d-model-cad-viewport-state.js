import {
  WorkbenchViewportScaleMode,
  loadWorkbenchViewportState,
  normalizeWorkbenchViewportRange,
  normalizeWorkbenchViewportState,
  saveWorkbenchViewportState,
  workbenchViewportScaleRatio,
} from '../../core/workbench-viewport/index.js';

export const PIPELINE_CAD_VIEWPORT_SCHEMA = 'PipelineCadViewportState.v1';
export const PIPELINE_CAD_VIEWPORT_STORAGE_KEY = 'pipeline3dCadViewportStateV1';
export const PIPELINE_CAD_VIEWPORT_NAMESPACE = 'pipeline-cad';
export const PipelineCadScaleMode = Object.freeze({
  AUTO: WorkbenchViewportScaleMode.AUTO,
  CUSTOM: WorkbenchViewportScaleMode.CUSTOM,
  ENGINEERING: 'engineering-scale',
});

const GRAPH_NAMES = new Set(['table2x', 'table3x']);
const PREVIEW_MODES = new Set(['table2x', 'table3x', 'side-by-side', 'overlay']);

export const DEFAULT_PIPELINE_CAD_VIEWPORT_STATE = Object.freeze({
  schema: PIPELINE_CAD_VIEWPORT_SCHEMA,
  namespace: PIPELINE_CAD_VIEWPORT_NAMESPACE,
  graph: 'table2x',
  previewMode: 'table2x',
  scaleMode: PipelineCadScaleMode.AUTO,
  zoomX: 1,
  zoomY: 1,
  panX: 0,
  panY: 0,
  horizontalScale: 1000,
  verticalScale: 100,
  customRange: null,
  displayGrid: true,
  minorGrid: true,
  linkX: true,
});

function normalizeGraph(value) {
  return GRAPH_NAMES.has(value) ? value : DEFAULT_PIPELINE_CAD_VIEWPORT_STATE.graph;
}

function normalizePreviewMode(value, graph) {
  return PREVIEW_MODES.has(value) ? value : graph;
}

function toWorkbenchScaleMode(value) {
  return value === PipelineCadScaleMode.ENGINEERING ? WorkbenchViewportScaleMode.RATIO : value;
}

function toPipelineScaleMode(value) {
  return value === WorkbenchViewportScaleMode.RATIO ? PipelineCadScaleMode.ENGINEERING : value;
}

export function normalizePipelineCadCustomRange(value) {
  return normalizeWorkbenchViewportRange(value);
}

export function pipelineCadVerticalExaggeration(horizontalScale, verticalScale) {
  return workbenchViewportScaleRatio(horizontalScale, verticalScale);
}

export function normalizePipelineCadViewportState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const graph = normalizeGraph(source.graph || source.surfaceId);
  const previewMode = normalizePreviewMode(source.previewMode || source.modeId, graph);
  const common = normalizeWorkbenchViewportState({
    ...source,
    namespace: PIPELINE_CAD_VIEWPORT_NAMESPACE,
    surfaceId: graph,
    modeId: previewMode,
    scaleMode: toWorkbenchScaleMode(source.scaleMode),
    xScale: source.horizontalScale ?? source.xScale ?? 1000,
    yScale: source.verticalScale ?? source.yScale ?? 100,
    linkX: source.linkX !== false,
  });
  return Object.freeze({
    schema: PIPELINE_CAD_VIEWPORT_SCHEMA,
    namespace: common.namespace,
    graph,
    previewMode,
    scaleMode: toPipelineScaleMode(common.scaleMode),
    zoomX: common.zoomX,
    zoomY: common.zoomY,
    panX: common.panX,
    panY: common.panY,
    horizontalScale: common.xScale,
    verticalScale: common.yScale,
    customRange: common.customRange,
    displayGrid: common.displayGrid,
    minorGrid: common.minorGrid,
    linkX: source.linkX !== false,
  });
}

function identity(graph, previewMode) {
  const surfaceId = normalizeGraph(graph);
  return {
    namespace: PIPELINE_CAD_VIEWPORT_NAMESPACE,
    surfaceId,
    modeId: normalizePreviewMode(previewMode, surfaceId),
  };
}

function persistenceOptions() {
  return { storageKey: PIPELINE_CAD_VIEWPORT_STORAGE_KEY };
}

export function loadPipelineCadViewportState(graph, previewMode, storage = globalThis.localStorage) {
  const ids = identity(graph, previewMode);
  const common = loadWorkbenchViewportState(ids, storage, {
    ...persistenceOptions(),
    fallback: {
      ...DEFAULT_PIPELINE_CAD_VIEWPORT_STATE,
      xScale: 1000,
      yScale: 100,
      linkX: true,
    },
  });
  return normalizePipelineCadViewportState({
    ...common,
    graph: ids.surfaceId,
    previewMode: ids.modeId,
    horizontalScale: common.xScale,
    verticalScale: common.yScale,
  });
}

export function savePipelineCadViewportState(value, storage = globalThis.localStorage) {
  const state = normalizePipelineCadViewportState(value);
  saveWorkbenchViewportState({
    ...state,
    namespace: PIPELINE_CAD_VIEWPORT_NAMESPACE,
    surfaceId: state.graph,
    modeId: state.previewMode,
    scaleMode: toWorkbenchScaleMode(state.scaleMode),
    xScale: state.horizontalScale,
    yScale: state.verticalScale,
  }, storage, persistenceOptions());
  return state;
}

function compact(value) {
  return Number(value).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function describePipelineCadViewportScale(value = {}) {
  const state = normalizePipelineCadViewportState(value);
  const ve = pipelineCadVerticalExaggeration(state.horizontalScale, state.verticalScale);
  return `H 1:${compact(state.horizontalScale)} V 1:${compact(state.verticalScale)} VE ${compact(ve)}x`;
}

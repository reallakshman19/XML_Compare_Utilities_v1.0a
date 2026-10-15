import { buildWorkbenchGridModel } from '../../core/workbench-viewport/index.js';

export function pipelineCadVisibleWorldRange(graph) {
  const plot = graph.getPlotRect();
  const a = graph.screenToWorld({ x: plot.left, y: plot.bottom });
  const b = graph.screenToWorld({ x: plot.right, y: plot.top });
  return Object.freeze({
    plot,
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
  });
}

export function buildPipelineCadEngineeringGrid(range, plot, options = {}) {
  return buildWorkbenchGridModel(range, plot, options);
}

function drawLines(context, graph, range, values, axis) {
  if (!values.length) return;
  context.beginPath();
  for (const value of values) {
    if (axis === 'x') {
      const point = graph.worldToScreen({ x: value, y: range.minY });
      context.moveTo(point.x, range.plot.top);
      context.lineTo(point.x, range.plot.bottom);
    } else {
      const point = graph.worldToScreen({ x: range.minX, y: value });
      context.moveTo(range.plot.left, point.y);
      context.lineTo(range.plot.right, point.y);
    }
  }
  context.stroke();
}

function markGrid(canvas, grid, minorGrid) {
  if (!canvas) return;
  canvas.dataset.p3dCadGridVisible = 'true';
  canvas.dataset.p3dCadGridXMajorStep = String(grid.xMajorStep);
  canvas.dataset.p3dCadGridYMajorStep = String(grid.yMajorStep);
  canvas.dataset.p3dCadGridMajorCount = String(grid.xMajor.length + grid.yMajor.length);
  canvas.dataset.p3dCadGridMinorCount = String(minorGrid ? grid.xMinor.length + grid.yMinor.length : 0);
}

export function drawPipelineCadEngineeringGrid(graph, context = graph?.context, options = {}) {
  if (!graph || !context) return false;
  if (options.displayGrid === false) {
    if (graph.canvas) graph.canvas.dataset.p3dCadGridVisible = 'false';
    return false;
  }
  const range = pipelineCadVisibleWorldRange(graph);
  const grid = buildPipelineCadEngineeringGrid(range, range.plot, options);
  context.save?.();
  context.lineWidth = 1;
  if (options.minorGrid !== false) {
    context.strokeStyle = 'rgba(71,85,105,.24)';
    drawLines(context, graph, range, grid.xMinor, 'x');
    drawLines(context, graph, range, grid.yMinor, 'y');
  }
  context.strokeStyle = 'rgba(100,116,139,.48)';
  drawLines(context, graph, range, grid.xMajor, 'x');
  drawLines(context, graph, range, grid.yMajor, 'y');
  context.restore?.();
  markGrid(graph.canvas, grid, options.minorGrid !== false);
  return true;
}

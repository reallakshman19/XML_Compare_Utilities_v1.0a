export const WORKBENCH_GRID_SCHEMA = 'WorkbenchGridModel.v1';
export const MAX_WORKBENCH_GRID_LINES = 240;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function selectWorkbenchGridStep(span, pixels, targetPixels = 90) {
  const worldSpan = Math.abs(finite(span, 1)) || 1;
  const pixelSpan = Math.max(1, finite(pixels, 1));
  const target = Math.max(24, finite(targetPixels, 90));
  const rough = worldSpan / Math.max(2, pixelSpan / target);
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

export function buildWorkbenchGridValues(minimum, maximum, step, limit = MAX_WORKBENCH_GRID_LINES) {
  const min = Math.min(finite(minimum), finite(maximum, 1));
  const max = Math.max(finite(minimum), finite(maximum, 1));
  const spacing = Math.abs(finite(step, 1)) || 1;
  const first = Math.ceil((min - spacing * 1e-9) / spacing) * spacing;
  const values = [];
  for (let value = first; value <= max + spacing * 1e-9 && values.length < limit; value += spacing) {
    values.push(Math.abs(value) < spacing * 1e-10 ? 0 : Number(value.toPrecision(12)));
  }
  return Object.freeze(values);
}

function removeMajorValues(minor, major, tolerance) {
  const values = minor.filter((value) => !major.some((candidate) => Math.abs(candidate - value) <= tolerance));
  return Object.freeze(values);
}

export function buildWorkbenchGridModel(range, plot, options = {}) {
  const xSpan = Math.max(1e-12, Number(range.maxX) - Number(range.minX));
  const ySpan = Math.max(1e-12, Number(range.maxY) - Number(range.minY));
  const xMajorStep = selectWorkbenchGridStep(xSpan, plot.width, options.targetPixels);
  const yMajorStep = selectWorkbenchGridStep(ySpan, plot.height, options.targetPixels);
  const xMinorStep = xMajorStep / 5;
  const yMinorStep = yMajorStep / 5;
  const xMajor = buildWorkbenchGridValues(range.minX, range.maxX, xMajorStep);
  const yMajor = buildWorkbenchGridValues(range.minY, range.maxY, yMajorStep);
  const xMinorRaw = buildWorkbenchGridValues(range.minX, range.maxX, xMinorStep);
  const yMinorRaw = buildWorkbenchGridValues(range.minY, range.maxY, yMinorStep);
  return Object.freeze({
    schema: WORKBENCH_GRID_SCHEMA,
    range: Object.freeze({ ...range }),
    xMajorStep,
    yMajorStep,
    xMinorStep,
    yMinorStep,
    xMajor,
    yMajor,
    xMinor: removeMajorValues(xMinorRaw, xMajor, xMinorStep * 1e-6),
    yMinor: removeMajorValues(yMinorRaw, yMajor, yMinorStep * 1e-6),
  });
}

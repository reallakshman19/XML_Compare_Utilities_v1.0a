import { resolvePipelineSvgPreviewTarget } from './pipeline-3d-model-svg-reference.js';
const SURFACES = Object.freeze([
  ['value', '[data-p3d="table2"]'], ['value', '[data-p3d="table3"]'],
  ['html', '[data-p3d="table2x-output"]'], ['html', '[data-p3d="table3x-output"]'],
  ['svg', '[data-p3d-split="table2x-preview"]'], ['svg', '[data-p3d-split="table3x-preview"]'],
  ['text', '[data-p3d="table1-output"]'], ['text', '[data-p3d="coordinate-output"]'],
  ['text', '[data-p3d="xml-output"]'], ['html', '[data-p3d-core-artifacts]'],
  ['status', '[data-p3d-approved-catalog-status]'], ['status', '[data-p3d-inputxml-status]'],
  ['download', '[data-p3d="download-xml"]'], ['text', '[data-p3d-warning-count]'],
  ['html', '[data-p3d-warning-body]'],
]);
function elementFor(dialog, [kind, selector]) {
  const element = dialog?.querySelector?.(selector) || null;
  return kind === 'svg' ? resolvePipelineSvgPreviewTarget(element) : element;
}
function attribute(element, name) {
  return element?.getAttribute?.(name) ?? null;
}
function statusValue(element) {
  return JSON.stringify([element.textContent ?? '', element.id ?? '', element.title ?? '',
    element.dataset?.state ?? '']);
}
function downloadValue(element) {
  return JSON.stringify([Boolean(element.disabled), element.title ?? '',
    element.dataset?.inputXmlState ?? '', element.dataset?.approvedCatalogState ?? '',
    attribute(element, 'aria-disabled'), attribute(element, 'aria-describedby')]);
}
function surfaceValue(element, kind) {
  if (!element) return null;
  if (kind === 'value') return String(element.value ?? '');
  if (kind === 'html' || kind === 'svg') return String(element.innerHTML ?? '');
  if (kind === 'status') return statusValue(element);
  if (kind === 'download') return downloadValue(element);
  return String(element.textContent ?? '');
}
function captureSurface(dialog, descriptor) {
  const element = elementFor(dialog, descriptor);
  return Object.freeze({ descriptor, element, value: surfaceValue(element, descriptor[0]) });
}
function surfaceMatches(dialog, snapshot) {
  const element = elementFor(dialog, snapshot.descriptor);
  return element === snapshot.element
    && surfaceValue(element, snapshot.descriptor[0]) === snapshot.value;
}
export function createPipelineRenderedSurfaceSession() {
  let sourceOutput = null, snapshots = null;
  function capture(dialog, output) {
    snapshots = Object.freeze(SURFACES.map((item) => captureSurface(dialog, item)));
    sourceOutput = output; return true;
  }
  function matches(dialog, output) {
    return Boolean(output && output === sourceOutput && snapshots
      && snapshots.every((item) => surfaceMatches(dialog, item)));
  }
  function reset() { sourceOutput = null; snapshots = null; }
  return Object.freeze({ capture, matches, reset });
}
export const _test = Object.freeze({ SURFACES, elementFor, surfaceValue, captureSurface, surfaceMatches });

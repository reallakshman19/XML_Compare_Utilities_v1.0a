/**
 * Functionality: renders review-only component glyphs from immutable source
 * view rows. Inputs are view-model components and a world transform. Output is
 * SVG markup. Fallback: unknown or unpositioned types render no glyph and never
 * create topology semantics.
 */

import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';

/** @param {Record<string, unknown>} component @param {(point:{x:number,y:number})=>{x:number,y:number}} transform @returns {Record<string, number>|null} */
function symbolPlacement(component, transform) {
  const start = component.projectedStart ? transform(component.projectedStart) : null;
  const end = component.projectedEnd ? transform(component.projectedEnd) : null;
  const point = component.projectedPoint ? transform(component.projectedPoint) : null;
  const anchor = point ?? (start && end ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } : start ?? end);
  if (!anchor) return null;
  const angle = start && end ? Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI) : 0;
  return { x: anchor.x, y: anchor.y, angle };
}

/** @param {string} category @returns {string} */
function glyph(category) {
  if (category === 'PIPE') return '<path d="M -11 0 L 11 0"/>';
  if (category === 'VALVE') return '<path d="M -11 -8 L 0 0 L -11 8 Z M 11 -8 L 0 0 L 11 8 Z"/>';
  if (category === 'FLANGE') return '<path d="M -4 -10 L -4 10 M 4 -10 L 4 10"/>';
  if (category === 'GASK') return '<path d="M 0 -10 L 0 10"/>';
  if (category === 'INST') return '<circle cx="0" cy="0" r="9"/>';
  if (category === 'REDUCER') return '<path d="M -12 -8 L 12 -4 L 12 4 L -12 8 Z"/>';
  if (category === 'ELBO/BEND') return '<path d="M -12 8 Q -12 -8 8 -8"/>';
  if (category === 'TEE') return '<rect x="-7" y="-7" width="14" height="14" transform="rotate(45)"/>';
  if (category === 'OLET') return '<path d="M 0 -10 L -9 8 L 9 8 Z"/>';
  if (category === 'SUPPORT') return '<path d="M -8 -8 L 8 8 M -8 8 L 8 -8"/>';
  return '';
}

/** @param {Record<string, unknown>} viewModel @param {(point:{x:number,y:number})=>{x:number,y:number}} transform @returns {string} */
export function buildComponentSymbolMarkup(viewModel, transform) {
  if (viewModel.showComponentSymbols !== true) return '';
  return asArray(viewModel.sourceComponents).map(objectRecord).flatMap((component) => {
    const category = cleanText(component.componentCategory), shape = glyph(category), placement = symbolPlacement(component, transform);
    if (!shape || !placement) return [];
    const cssType = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return [`<g class="ttv-component-symbol ttv-component-${cssType}" transform="translate(${placement.x.toFixed(2)} ${placement.y.toFixed(2)}) rotate(${placement.angle.toFixed(2)})" data-object-key="${escapeMarkup(component.objectKey)}" data-source-entity-id="${escapeMarkup(component.sourceEntityId)}" data-source-component-type="${escapeMarkup(category)}"><g style="transform: scale(var(--ttv-inverse-scale, 1)); transform-origin: 0 0;"><circle class="ttv-component-hit" cx="0" cy="0" r="12"/>${shape}</g><title>${escapeMarkup(`${category} · ${component.sourcePath}`)}</title></g>`];
  }).join('');
}

export const _test = Object.freeze({ glyph, symbolPlacement });

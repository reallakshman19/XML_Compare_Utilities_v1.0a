/** Pure pointer-selection transitions for the Draft canvas. */

import { shortestPathSelection } from './topology-edit-controller-helpers.js';

export function pointerSelection(canonical, selection, row, modifiers) {
  if (modifiers.shiftKey && row.kind === 'node') {
    const anchor = [...selection].reverse().find((item) => item.kind === 'node');
    if (anchor && canonical) return shortestPathSelection(canonical, anchor.id, row.id);
  }
  if (modifiers.toggle) {
    const key = `${row.kind}:${row.id}`;
    const retained = selection.filter((item) => `${item.kind}:${item.id}` !== key);
    return retained.length === selection.length ? [...selection, row] : retained;
  }
  return [row];
}


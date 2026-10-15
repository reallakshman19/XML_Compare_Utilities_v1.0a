import { normalizePivotSpec, validatePivotSpec } from './table-categorized-pivot-spec-contracts.js';

export const TABLE_CATEGORIZED_OUTPUT_VIEW_SCHEMA = 'OutputView.v1';
export const OUTPUT_VIEW_TYPES = Object.freeze(['pivot']);

export function normalizeOutputViews(input = []) {
  return Object.freeze((Array.isArray(input) ? input : []).map(normalizeOutputView));
}

export function normalizeOutputView(input = {}) {
  const view = input && typeof input === 'object' ? input : {};
  const type = clean(view.type || 'pivot');
  return deepFreeze({
    schema: TABLE_CATEGORIZED_OUTPUT_VIEW_SCHEMA,
    viewId: clean(view.viewId),
    type,
    displayName: clean(view.displayName || view.viewId || 'Output View'),
    enabled: view.enabled !== false,
    ...(type === 'pivot' || view.pivotSpec ? { pivotSpec: normalizePivotSpec(view.pivotSpec || {}) } : {}),
  });
}

export function validateOutputViews(views = [], fieldCatalog = {}) {
  const normalized = normalizeOutputViews(views);
  const out = [];
  const seen = new Set();
  for (const view of normalized) {
    if (!view.viewId) out.push(blocker('output_view_id_missing', 'Output view requires viewId.'));
    if (seen.has(view.viewId)) out.push(blocker('output_view_id_duplicate', `Duplicate output viewId: ${view.viewId}.`, view.viewId));
    seen.add(view.viewId);
    if (!OUTPUT_VIEW_TYPES.includes(view.type)) out.push(blocker('output_view_type_unknown', `Unknown output view type: ${view.type}.`, view.viewId));
    if (view.enabled && view.type === 'pivot') out.push(...validatePivotSpec(view.pivotSpec, fieldCatalog, { ref: view.viewId }));
  }
  return Object.freeze(out);
}

function clean(value) { return String(value ?? '').trim(); }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }
function blocker(code, message, ref = '') { return Object.freeze({ gate: code, severity: 'BLOCKER', status: 'FAIL', code, message, ref }); }

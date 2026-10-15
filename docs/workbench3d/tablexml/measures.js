/**
 * measures.js — generic measure props + delta (W6, pure).
 *
 * A "measure" column (MTO quantity/cost, sales revenue/volume, or any numeric
 * KPI) becomes a MEASURE_<name> prop on the node; measureDeltaBetween returns
 * the max change % across shared measures — the node analogue of load delta.
 */

import { extractNumber, DEFAULT_EXTRACT_RULES } from './text-to-number.js';

export function buildMeasureProps(row, measureColumns, rules) {
  const effective = rules?.length ? rules : DEFAULT_EXTRACT_RULES;
  const props = {};
  for (const col of measureColumns ?? []) {
    const raw = String(row.rawByColumnId?.[col.columnId] ?? '').trim();
    if (!raw || raw === '-') continue;
    const result = extractNumber(raw, effective);
    if (!result.ok) continue;
    const name = (col.propName || col.header || col.columnId).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    props[`MEASURE_${name}`] = result.value;
  }
  return props;
}

/** @returns { maxDeltaPct, measures: [{ name, a, b, deltaPct }] } | null */
export function measureDeltaBetween(propsA, propsB) {
  const measures = [];
  for (const key of Object.keys(propsA ?? {})) {
    if (!key.startsWith('MEASURE_')) continue;
    const a = Number(propsA[key]);
    const b = Number(propsB?.[key]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const base = Math.max(Math.abs(a), Math.abs(b));
    const deltaPct = base < 1e-9 ? 0 : Number((Math.abs(a - b) / base * 100).toFixed(2));
    measures.push({ name: key.replace(/^MEASURE_/, ''), a, b, deltaPct });
  }
  if (!measures.length) return null;
  return { maxDeltaPct: Math.max(...measures.map((m) => m.deltaPct)), measures };
}

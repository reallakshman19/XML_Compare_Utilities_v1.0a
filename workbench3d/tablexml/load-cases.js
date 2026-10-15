/**
 * load-cases.js — load-case grouping for repeated Fx/Fy/Fz columns (pure).
 *
 * Support registers repeat force-component headers per load case
 * (…Fy Fy Fy Fx Fy Fz Fx Fy Fz…). Duplicate headers get de-duplicated
 * columnIds by the parser (Fy, Fy__2, …); this module groups the mapped
 * 'load' columns into cases in table order: a new case starts whenever the
 * component letter repeats within the current case.
 */

import { extractNumber, DEFAULT_EXTRACT_RULES } from './text-to-number.js';

function componentOf(header) {
  const match = String(header ?? '').trim().match(/^F([xyz])/i);
  return match ? `F${match[1].toUpperCase()}` : null;
}

/**
 * Group load-role columns into cases.
 * @param {Array} loadColumns mapping columns with role 'load' (table order)
 * @returns [{ caseId: 'LC1', components: [{ columnId, component: 'FX'|'FY'|'FZ' }] }]
 */
const COMPONENT_RANK = Object.freeze({ FX: 0, FY: 1, FZ: 2 });

export function detectLoadCaseGroups(loadColumns) {
  const cases = [];
  let current = null;
  for (const col of loadColumns ?? []) {
    const component = componentOf(col.header);
    if (!component) continue;
    const lastComponent = current?.components[current.components.length - 1]?.component;
    // New case whenever the component rank does not increase (Fx<Fy<Fz):
    // "Fy Fy Fy Fx Fy Fz Fx Fy Fz" → LC1[FY] LC2[FY] LC3[FY] LC4[FX FY FZ] LC5[FX FY FZ]
    const startsNewCase = !current || COMPONENT_RANK[component] <= COMPONENT_RANK[lastComponent];
    if (startsNewCase) {
      current = { caseId: `LC${cases.length + 1}`, components: [] };
      cases.push(current);
    }
    current.components.push({ columnId: col.columnId, component });
  }
  return cases;
}

/**
 * Extract per-node load props for one row:
 * { LC1_FX: -5406, …, LC1_R: 9603.2 } — blanks and '-' skipped; a case with
 * no numeric component produces nothing.
 */
export function buildLoadProps(row, cases, rules) {
  const effectiveRules = rules?.length ? rules : DEFAULT_EXTRACT_RULES;
  const props = {};
  for (const loadCase of cases) {
    let sumSq = 0;
    let any = false;
    for (const { columnId, component } of loadCase.components) {
      const raw = String(row.rawByColumnId?.[columnId] ?? '').trim();
      if (!raw || raw === '-') continue;
      const result = extractNumber(raw, effectiveRules);
      if (!result.ok) continue;
      props[`${loadCase.caseId}_${component}`] = result.value;
      sumSq += result.value * result.value;
      any = true;
    }
    if (any) props[`${loadCase.caseId}_R`] = Number(Math.sqrt(sumSq).toFixed(3));
  }
  return props;
}

/**
 * Max resultant-load delta (%) between two prop maps across common LC*_R keys.
 * @returns { maxDeltaPct, cases: [{ caseId, a, b, deltaPct }] } or null when
 *          no comparable case exists
 */
export function loadDeltaBetween(propsA, propsB) {
  const cases = [];
  for (const key of Object.keys(propsA ?? {})) {
    if (!/^LC\d+_R$/.test(key)) continue;
    const a = Number(propsA[key]);
    const b = Number(propsB?.[key]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const base = Math.max(Math.abs(a), Math.abs(b));
    const deltaPct = base < 1e-9 ? 0 : Number((Math.abs(a - b) / base * 100).toFixed(2));
    cases.push({ caseId: key.replace(/_R$/, ''), a, b, deltaPct });
  }
  if (!cases.length) return null;
  return { maxDeltaPct: Math.max(...cases.map((c) => c.deltaPct)), cases };
}

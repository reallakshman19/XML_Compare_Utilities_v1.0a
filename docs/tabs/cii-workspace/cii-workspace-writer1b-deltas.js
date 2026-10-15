import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId } from './cii-workspace-contracts.js';
import { ciiIdentityBound } from './cii-workspace-engineering-delta.js';
import { ciiWriter1BOdEligibility } from './cii-workspace-writer1b-od.js';

function edgeMap(graph) { return new Map((graph?.edges || []).map((edge) => [String(edge.elementId), edge])); }
function sourceIds(row) { return row?.sourceElementIds || (row?.sourceElementId ? [row.sourceElementId] : []); }
function targetIds(row) { return row?.targetElementIds || (row?.targetElementId ? [row.targetElementId] : []); }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function changedNumber(source, target, tolerance) {
  const a = finite(source); const b = finite(target);
  return a != null && b != null && Math.abs(b - a) > tolerance;
}
function numericDelta(source, target) {
  const a = finite(source); const b = finite(target);
  return a == null || b == null ? null : b - a;
}
function deltaRow(row, property, sourceValue, targetValue, authority, tolerance, limitations = []) {
  const changed = changedNumber(sourceValue, targetValue, tolerance);
  return deepFreeze({
    deltaId: stableId('delta', row.correspondenceId, 'PROCESS', property), correspondenceId: row.correspondenceId, identityKind: row.kind,
    sourceIdentity: sourceIds(row).join('|') || row.sourceElementId || null,
    targetIdentity: targetIds(row).join('|') || row.targetElementId || null,
    identityConfidence: row.status === 'LOCKED' ? 'LOCKED' : row.status,
    category: 'PROCESS', property, sourceValue, targetValue, delta: numericDelta(sourceValue, targetValue),
    semanticChange: changed ? 'CHANGED' : 'UNCHANGED', changed, evidenceStatus: 'QUALIFIED', authority,
    limitations: Object.freeze(limitations),
  });
}

const EXTENDED_FIELDS = Object.freeze([
  ['Insulation thickness', 'insulationThickness', 'PROTECTED_WRITER_ELEMENT_ROW2_INSULATION_FIXED_FIELD'],
  ['Corrosion allowance', 'corrosionAllowance', 'PROTECTED_WRITER_ELEMENT_ROW2_CORROSION_FIXED_FIELD'],
  ['T3', 'T3', 'PROTECTED_WRITER_ELEMENT_ROW2_T3_FIXED_FIELD'],
  ['T4', 'T4', 'PROTECTED_WRITER_ELEMENT_ROW3_T4_FIXED_FIELD'],
  ['T5', 'T5', 'PROTECTED_WRITER_ELEMENT_ROW3_T5_FIXED_FIELD'],
  ['T6', 'T6', 'PROTECTED_WRITER_ELEMENT_ROW3_T6_FIXED_FIELD'],
  ['T7', 'T7', 'PROTECTED_WRITER_ELEMENT_ROW3_T7_FIXED_FIELD'],
  ['T8', 'T8', 'PROTECTED_WRITER_ELEMENT_ROW3_T8_FIXED_FIELD'],
  ['T9', 'T9', 'PROTECTED_WRITER_ELEMENT_ROW3_T9_FIXED_FIELD'],
  ['P2', 'P2', 'PROTECTED_WRITER_ELEMENT_ROW4_P2_FIXED_FIELD'],
  ['P3', 'P3', 'PROTECTED_WRITER_ELEMENT_ROW4_P3_FIXED_FIELD'],
  ['P4', 'P4', 'PROTECTED_WRITER_ELEMENT_ROW4_P4_FIXED_FIELD'],
  ['P5', 'P5', 'PROTECTED_WRITER_ELEMENT_ROW4_P5_FIXED_FIELD'],
  ['P6', 'P6', 'PROTECTED_WRITER_ELEMENT_ROW4_P6_FIXED_FIELD'],
  ['P7', 'P7', 'PROTECTED_WRITER_ELEMENT_ROW5_P7_FIXED_FIELD'],
  ['P8', 'P8', 'PROTECTED_WRITER_ELEMENT_ROW5_P8_FIXED_FIELD'],
  ['P9', 'P9', 'PROTECTED_WRITER_ELEMENT_ROW5_P9_FIXED_FIELD'],
  ['Insulation density', 'insulationDensity', 'PROTECTED_WRITER_ELEMENT_ROW6_INSULATION_DENSITY_FIXED_FIELD'],
  ['Fluid density', 'fluidDensity', 'PROTECTED_WRITER_ELEMENT_ROW6_FLUID_DENSITY_FIXED_FIELD'],
  ['Hydro pressure', 'hydroPressure', 'PROTECTED_WRITER_ELEMENT_ROW6_HYDRO_PRESSURE_FIXED_FIELD'],
]);

function replaceOdAuthority(rows, correspondenceId, source, target, options) {
  const blockers = ciiWriter1BOdEligibility(source, target, options);
  const authority = blockers.length
    ? `PARSED_ELEMENT_PIPE_PROPERTY;WRITER_1B_OD_BLOCKED:${blockers.join(',')}`
    : 'PROTECTED_WRITER_ELEMENT_ROW1_OD_FIXED_FIELD:WRITER_1B_PLAIN_PIPE_NO_REDUCER_TOPOLOGY_CLOSED';
  return rows.map((item) => {
    if (item.correspondenceId !== correspondenceId || item.category !== 'PIPE_SIZE' || item.property !== 'OD') return item;
    return deepFreeze({ ...item, authority, evidenceStatus: blockers.length ? 'PARTIAL' : 'QUALIFIED', limitations: Object.freeze(blockers) });
  });
}
function writer1BLimitations(limitations = []) {
  return Object.freeze(limitations.map((item) => item?.family === 'process' ? deepFreeze({
    ...item, label: 'Process P1–P9 / T1–T9 / densities', comparisonState: 'PARTIAL',
    reason: 'Exact Writer 1B fixed fields are normalized individually; unique values are revision evidence, not qualified CAESAR load-case counts or a complete process-data model.',
  }) : item));
}

export function augmentCiiEngineeringDeltasWithWriter1BFields(deltaSet, sourceGraph, targetGraph, correspondence, options = {}) {
  if (!deltaSet || deltaSet.schema !== CII_WORKSPACE_SCHEMAS.engineeringDeltaSet) return deltaSet;
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph);
  const tolerance = Number(options.engineeringNumericTolerance ?? 1e-9); let rows = [...(deltaSet.rows || [])];
  for (const row of correspondence?.elementRows || []) {
    if (row.kind !== 'ELEMENT' || !ciiIdentityBound(row)) continue;
    const sourceIdList = sourceIds(row); const targetIdList = targetIds(row);
    if (sourceIdList.length !== 1 || targetIdList.length !== 1) continue;
    const source = sourceEdges.get(String(sourceIdList[0])); const target = targetEdges.get(String(targetIdList[0]));
    if (!source || !target) continue;
    rows = replaceOdAuthority(rows, row.correspondenceId, source, target, options);
    for (const [property, key, authority] of EXTENDED_FIELDS) {
      rows.push(deltaRow(row, property, source[key], target[key], authority, tolerance,
        ['Qualified fixed-field revision evidence; no load-case semantics beyond exact source field custody are inferred.']));
    }
  }
  rows.sort((a, b) => `${a.sourceIdentity}|${a.category}|${a.property}`.localeCompare(`${b.sourceIdentity}|${b.category}|${b.property}`, undefined, { numeric: true }));
  const changedRows = rows.filter((row) => row.changed); const counts = {};
  for (const row of changedRows) counts[row.category] = (counts[row.category] || 0) + 1;
  return deepFreeze({
    ...deltaSet, rows: Object.freeze(rows), changedRows: Object.freeze(changedRows), limitations: writer1BLimitations(deltaSet.limitations),
    summary: Object.freeze({ ...deltaSet.summary, comparedPropertyCount: rows.length, engineeringChangeCount: changedRows.length,
      unchangedPropertyCount: rows.length - changedRows.length, changeFamilyCounts: Object.freeze(counts) }),
  });
}

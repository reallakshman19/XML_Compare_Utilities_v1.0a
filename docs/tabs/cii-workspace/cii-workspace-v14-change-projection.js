const SECTION_RX = /^#\$\s+([A-Z0-9_&]+)\s*$/;
const NUMBER_RX = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][-+]?\d+)?$/;
const MAX_DIFF_ROWS = 3000;
const MAX_DIFF_CELLS = 4_000_000;
const PROJECTABLE_CHANGED_SECTIONS = new Set([
  'CONTROL',
  'ELEMENTS',
  'NODENAME',
  'RESTRANT',
  'SIF&TEES',
]);
const CARDINALITY_UNIT_ROWS = Object.freeze({
  NODENAME: 1,
  RESTRANT: 24,
  'SIF&TEES': 14,
});

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  throw new Error('CII_V14_PROJECTION_BYTES_REQUIRED');
}

function decodeV14(value, label) {
  const bytes = asBytes(value);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`CII_V14_PROJECTION_${label}_UTF8_REQUIRED:${error?.message || error}`);
  }
  if (!text.endsWith('\r\n')) throw new Error(`CII_V14_PROJECTION_${label}_FINAL_CRLF_REQUIRED`);
  const withoutFinal = text.slice(0, -2);
  if (/(^|[^\r])\n|\r(?!\n)/.test(withoutFinal)) {
    throw new Error(`CII_V14_PROJECTION_${label}_CRLF_ONLY_REQUIRED`);
  }
  const physical = withoutFinal ? withoutFinal.split('\r\n') : [];
  const sections = [];
  const names = new Set();
  let current = null;
  for (let index = 0; index < physical.length; index += 1) {
    const line = physical[index];
    const match = SECTION_RX.exec(line);
    if (match) {
      const name = match[1];
      if (names.has(name)) throw new Error(`CII_V14_PROJECTION_${label}_DUPLICATE_SECTION:${name}`);
      names.add(name);
      current = { name, header: line, rows: [] };
      sections.push(current);
      continue;
    }
    if (!current) throw new Error(`CII_V14_PROJECTION_${label}_CONTENT_BEFORE_SECTION:${index + 1}`);
    current.rows.push(line);
  }
  if (!sections.length) throw new Error(`CII_V14_PROJECTION_${label}_SECTION_REQUIRED`);
  return Object.freeze({ bytes, sections: Object.freeze(sections.map((item) => Object.freeze({
    name: item.name,
    header: item.header,
    rows: Object.freeze([...item.rows]),
  }))) });
}

function equalRows(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function fixedFields(line) {
  if (line.length < 15 || (line.length - 15) % 13 !== 0) return null;
  const fields = [line.slice(0, 15)];
  for (let start = 15; start < line.length; start += 13) fields.push(line.slice(start, start + 13));
  return fields;
}

function numericValue(field) {
  const token = field.trim();
  if (!token || NUMBER_RX.test(token) === false) return null;
  const value = Number(token.replace(/[Dd]/g, 'E'));
  return Number.isFinite(value) ? value : null;
}

function numbersEquivalent(left, right) {
  const a = numericValue(left);
  const b = numericValue(right);
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-5, Math.abs(b) * 1e-5);
}

function mergeChangedRow(original, baseline, modified, context) {
  if (baseline === modified) return Object.freeze({ row: original, changedFields: Object.freeze([]) });
  if (baseline === original) return Object.freeze({ row: modified, changedFields: Object.freeze(['ROW_EXACT_BASELINE']) });
  if (original.length !== baseline.length || baseline.length !== modified.length) {
    throw new Error(`CII_V14_PROJECTION_ROW_WIDTH_MISMATCH:${context}`);
  }
  const originalFields = fixedFields(original);
  const baselineFields = fixedFields(baseline);
  const modifiedFields = fixedFields(modified);
  if (!originalFields || !baselineFields || !modifiedFields || originalFields.length !== baselineFields.length || baselineFields.length !== modifiedFields.length) {
    throw new Error(`CII_V14_PROJECTION_NON_FIXED_ROW_REPLACEMENT:${context}`);
  }
  const output = [];
  const changedFields = [];
  for (let index = 0; index < baselineFields.length; index += 1) {
    const before = baselineFields[index];
    const after = modifiedFields[index];
    const source = originalFields[index];
    if (before === after) {
      output.push(source);
      continue;
    }
    const beforeBlank = before.trim() === '';
    const sourceBlank = source.trim() === '';
    if (beforeBlank !== sourceBlank && !numbersEquivalent(before, source)) {
      throw new Error(`CII_V14_PROJECTION_CHANGED_FIELD_PREIMAGE_MISMATCH:${context}:${index}`);
    }
    if (!beforeBlank && !sourceBlank && !numbersEquivalent(before, source) && before !== source) {
      throw new Error(`CII_V14_PROJECTION_CHANGED_FIELD_PREIMAGE_MISMATCH:${context}:${index}`);
    }
    const afterToken = after.trim();
    if (afterToken && numericValue(after) == null && before !== source) {
      throw new Error(`CII_V14_PROJECTION_CHANGED_FIELD_NON_NUMERIC:${context}:${index}`);
    }
    output.push(after);
    changedFields.push(index);
  }
  if (!changedFields.length) throw new Error(`CII_V14_PROJECTION_ROW_CHANGE_UNRESOLVED:${context}`);
  return Object.freeze({ row: output.join(''), changedFields: Object.freeze(changedFields) });
}

function lcsMatches(baseline, modified, sectionName) {
  const n = baseline.length;
  const m = modified.length;
  if (n > MAX_DIFF_ROWS || m > MAX_DIFF_ROWS || (n + 1) * (m + 1) > MAX_DIFF_CELLS) {
    throw new Error(`CII_V14_PROJECTION_DIFF_ENVELOPE_EXCEEDED:${sectionName}:${n}:${m}`);
  }
  const cols = m + 1;
  const table = new Uint16Array((n + 1) * cols);
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = i * cols;
    const next = (i + 1) * cols;
    for (let j = m - 1; j >= 0; j -= 1) {
      table[row + j] = baseline[i] === modified[j]
        ? table[next + j + 1] + 1
        : Math.max(table[next + j], table[row + j + 1]);
    }
  }
  const matches = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (baseline[i] === modified[j]) {
      matches.push([i, j]);
      i += 1;
      j += 1;
      continue;
    }
    const deleteScore = table[(i + 1) * cols + j];
    const insertScore = table[i * cols + j + 1];
    if (deleteScore >= insertScore) i += 1;
    else j += 1;
  }
  return matches;
}

function assertNoUnitReorder(baselineKeys, modifiedKeys, matches, sectionName) {
  const modifiedSet = new Set(modifiedKeys);
  const commonCount = baselineKeys.reduce((count, key) => count + (modifiedSet.has(key) ? 1 : 0), 0);
  if (matches.length !== commonCount) {
    throw new Error(`CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED:${sectionName}:${commonCount}:${matches.length}`);
  }
}

function rejectEqualCardinalityUnitMutation(baseline, modified, sectionName) {
  const baselineUnits = groupUnits(baseline, sectionName, 'BASELINE');
  const modifiedUnits = groupUnits(modified, sectionName, 'MODIFIED');
  assertStableDuplicateMultiplicity(baselineUnits, modifiedUnits, sectionName);
  const baselineKeys = occurrenceQualifiedUnitKeys(baselineUnits);
  const modifiedKeys = occurrenceQualifiedUnitKeys(modifiedUnits);
  const matches = lcsMatches(baselineKeys, modifiedKeys, sectionName);
  assertNoUnitReorder(baselineKeys, modifiedKeys, matches, sectionName);
  throw new Error(`CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED:${sectionName}`);
}

function projectEqualCardinality(original, baseline, modified, sectionName, ledger) {
  const rows = [];
  for (let index = 0; index < baseline.length; index += 1) {
    if (baseline[index] === modified[index]) {
      rows.push(original[index]);
      continue;
    }
    const merged = mergeChangedRow(original[index], baseline[index], modified[index], `${sectionName}:${index}`);
    rows.push(merged.row);
    ledger.push(Object.freeze({
      section: sectionName,
      operation: 'MERGE_FIXED_ROW',
      baselineRow: index,
      modifiedRow: index,
      changedFields: merged.changedFields,
    }));
  }
  return rows;
}

function groupUnits(rows, sectionName, label) {
  const unitRows = CARDINALITY_UNIT_ROWS[sectionName];
  if (!unitRows) throw new Error(`CII_V14_PROJECTION_CARDINALITY_SECTION_NOT_QUALIFIED:${sectionName}`);
  if (rows.length % unitRows !== 0) {
    throw new Error(`CII_V14_PROJECTION_${label}_UNIT_ALIGNMENT:${sectionName}:${rows.length}:${unitRows}`);
  }
  const units = [];
  for (let start = 0; start < rows.length; start += unitRows) {
    const physicalRows = rows.slice(start, start + unitRows);
    units.push(Object.freeze({
      start,
      rows: Object.freeze(physicalRows),
      key: physicalRows.join('\n'),
    }));
  }
  return units;
}

function unitKeyCounts(units) {
  const counts = new Map();
  for (const unit of units) counts.set(unit.key, (counts.get(unit.key) || 0) + 1);
  return counts;
}

function occurrenceQualifiedUnitKeys(units) {
  const seen = new Map();
  return units.map((unit) => {
    const ordinal = (seen.get(unit.key) || 0) + 1;
    seen.set(unit.key, ordinal);
    return `${unit.key}\u0000${ordinal}`;
  });
}

function assertStableDuplicateMultiplicity(baselineUnits, modifiedUnits, sectionName) {
  const baselineCounts = unitKeyCounts(baselineUnits);
  const modifiedCounts = unitKeyCounts(modifiedUnits);
  for (const key of new Set([...baselineCounts.keys(), ...modifiedCounts.keys()])) {
    const baselineCount = baselineCounts.get(key) || 0;
    const modifiedCount = modifiedCounts.get(key) || 0;
    if (Math.max(baselineCount, modifiedCount) > 1 && baselineCount !== modifiedCount) {
      throw new Error(`CII_V14_PROJECTION_AMBIGUOUS_DUPLICATE_UNIT_CARDINALITY:${sectionName}:${baselineCount}:${modifiedCount}`);
    }
  }
}

function mergeNodeNameBlankTransition(original, baseline, modified, context) {
  const ranges = [[2, 28, 'FROM'], [28, 53, 'TO']];
  if (original.length !== baseline.length || baseline.length !== modified.length || baseline.length < 53) {
    throw new Error(`CII_V14_PROJECTION_NODENAME_ROW_WIDTH_MISMATCH:${context}`);
  }
  if (baseline.slice(0, 2) !== modified.slice(0, 2) || baseline.slice(53) !== modified.slice(53)) {
    throw new Error(`CII_V14_PROJECTION_NODENAME_OUTSIDE_FIELD_CHANGE:${context}`);
  }
  let row = original; const changedFields = [];
  for (const [start, end, field] of ranges) {
    const before = baseline.slice(start, end); const after = modified.slice(start, end);
    if (before === after) continue;
    if ((before.trim() === '') === (after.trim() === '')) {
      throw new Error(`CII_V14_PROJECTION_NODENAME_NONBLANK_REPLACEMENT_NOT_AUTHORIZED:${context}:${field}`);
    }
    if (original.slice(start, end) !== before) {
      throw new Error(`CII_V14_PROJECTION_NODENAME_CHANGED_FIELD_PREIMAGE_MISMATCH:${context}:${field}`);
    }
    row = `${row.slice(0, start)}${after}${row.slice(end)}`; changedFields.push(field);
  }
  if (!changedFields.length) throw new Error(`CII_V14_PROJECTION_NODENAME_CHANGE_UNRESOLVED:${context}`);
  return Object.freeze({ row, changedFields: Object.freeze(changedFields) });
}

function projectNodeNameReplacementRun(output, originalUnits, baselineUnits, modifiedUnits, bStart, mStart, count, ledger) {
  for (let offset = 0; offset < count; offset += 1) {
    const original = originalUnits[bStart + offset].rows[0];
    const baseline = baselineUnits[bStart + offset].rows[0];
    const modified = modifiedUnits[mStart + offset].rows[0];
    const merged = mergeNodeNameBlankTransition(original, baseline, modified, `NODENAME:${bStart + offset}`);
    output.push(merged.row);
    ledger.push(Object.freeze({
      section: 'NODENAME', operation: 'MERGE_NODENAME_BLANK_TRANSITION',
      baselineUnitStart: bStart + offset, modifiedUnitStart: mStart + offset, changedFields: merged.changedFields,
    }));
  }
}

function projectCardinalityRun(output, originalUnits, baselineUnits, modifiedUnits, sectionName, bStart, bEnd, mStart, mEnd, ledger) {
  const bCount = bEnd - bStart;
  const mCount = mEnd - mStart;
  if (sectionName === 'NODENAME' && bCount > 0 && bCount === mCount) {
    projectNodeNameReplacementRun(output, originalUnits, baselineUnits, modifiedUnits, bStart, mStart, bCount, ledger);
    return;
  }
  if (bCount === 0 && mCount > 0) {
    for (const unit of modifiedUnits.slice(mStart, mEnd)) output.push(...unit.rows);
    ledger.push(Object.freeze({ section: sectionName, operation: 'INSERT_UNITS', baselineUnitStart: bStart, modifiedUnitStart: mStart, count: mCount, unitRows: CARDINALITY_UNIT_ROWS[sectionName] }));
    return;
  }
  if (mCount === 0 && bCount > 0) {
    ledger.push(Object.freeze({ section: sectionName, operation: 'DELETE_UNITS', baselineUnitStart: bStart, count: bCount, unitRows: CARDINALITY_UNIT_ROWS[sectionName] }));
    return;
  }
  if (bCount === 0 && mCount === 0) return;
  throw new Error(`CII_V14_PROJECTION_NON_ISOLATED_CARDINALITY_RUN:${sectionName}:${bStart}:${bCount}:${mStart}:${mCount}`);
}

function projectChangedCardinality(original, baseline, modified, sectionName, ledger) {
  if (original.length !== baseline.length) {
    throw new Error(`CII_V14_PROJECTION_BASELINE_ORIGINAL_ROW_COUNT_MISMATCH:${sectionName}:${original.length}:${baseline.length}`);
  }
  const originalUnits = groupUnits(original, sectionName, 'ORIGINAL');
  const baselineUnits = groupUnits(baseline, sectionName, 'BASELINE');
  const modifiedUnits = groupUnits(modified, sectionName, 'MODIFIED');
  if (originalUnits.length !== baselineUnits.length) {
    throw new Error(`CII_V14_PROJECTION_BASELINE_ORIGINAL_UNIT_COUNT_MISMATCH:${sectionName}`);
  }
  assertStableDuplicateMultiplicity(baselineUnits, modifiedUnits, sectionName);
  const baselineKeys = occurrenceQualifiedUnitKeys(baselineUnits);
  const modifiedKeys = occurrenceQualifiedUnitKeys(modifiedUnits);
  const matches = lcsMatches(baselineKeys, modifiedKeys, sectionName);
  assertNoUnitReorder(baselineKeys, modifiedKeys, matches, sectionName);
  const output = [];
  let previousB = 0;
  let previousM = 0;
  for (const [bIndex, mIndex] of [...matches, [baselineUnits.length, modifiedUnits.length]]) {
    projectCardinalityRun(output, originalUnits, baselineUnits, modifiedUnits, sectionName, previousB, bIndex, previousM, mIndex, ledger);
    if (bIndex < baselineUnits.length && mIndex < modifiedUnits.length) output.push(...originalUnits[bIndex].rows);
    previousB = bIndex + 1;
    previousM = mIndex + 1;
  }
  return output;
}

function assertSectionOrder(original, baseline, modified) {
  const expected = baseline.sections.map((item) => item.name);
  for (const [label, document] of [['ORIGINAL', original], ['MODIFIED', modified]]) {
    const actual = document.sections.map((item) => item.name);
    if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
      throw new Error(`CII_V14_PROJECTION_${label}_SECTION_ORDER_MISMATCH`);
    }
  }
}

export function projectCanonicalV14WriterDelta(originalValue, baselineCanonicalValue, modifiedCanonicalValue) {
  const original = decodeV14(originalValue, 'ORIGINAL');
  const baseline = decodeV14(baselineCanonicalValue, 'BASELINE');
  const modified = decodeV14(modifiedCanonicalValue, 'MODIFIED');
  assertSectionOrder(original, baseline, modified);

  const ledger = [];
  const physical = [];
  const changedSections = [];
  for (let sectionIndex = 0; sectionIndex < baseline.sections.length; sectionIndex += 1) {
    const originalSection = original.sections[sectionIndex];
    const baselineSection = baseline.sections[sectionIndex];
    const modifiedSection = modified.sections[sectionIndex];
    physical.push(originalSection.header);

    if (equalRows(baselineSection.rows, modifiedSection.rows)) {
      physical.push(...originalSection.rows);
      continue;
    }

    if (!PROJECTABLE_CHANGED_SECTIONS.has(baselineSection.name)) {
      throw new Error(`CII_V14_PROJECTION_CHANGED_SECTION_NOT_AUTHORIZED:${baselineSection.name}`);
    }
    changedSections.push(baselineSection.name);
    if (originalSection.rows.length !== baselineSection.rows.length) {
      throw new Error(`CII_V14_PROJECTION_BASELINE_ORIGINAL_ROW_COUNT_MISMATCH:${baselineSection.name}:${originalSection.rows.length}:${baselineSection.rows.length}`);
    }
    const equalCardinality = baselineSection.rows.length === modifiedSection.rows.length;
    if (equalCardinality && CARDINALITY_UNIT_ROWS[baselineSection.name]) {
      rejectEqualCardinalityUnitMutation(baselineSection.rows, modifiedSection.rows, baselineSection.name);
    }
    const projectedRows = equalCardinality
      ? projectEqualCardinality(originalSection.rows, baselineSection.rows, modifiedSection.rows, baselineSection.name, ledger)
      : projectChangedCardinality(originalSection.rows, baselineSection.rows, modifiedSection.rows, baselineSection.name, ledger);
    physical.push(...projectedRows);
  }

  const text = `${physical.join('\r\n')}\r\n`;
  const outputBytes = new TextEncoder().encode(text);
  return Object.freeze({
    schema: 'CIIWorkspaceV14ChangeProjection.v2',
    outputBytes,
    changedSections: Object.freeze([...changedSections]),
    ledger: Object.freeze([...ledger]),
    untouchedSectionCount: baseline.sections.length - changedSections.length,
  });
}

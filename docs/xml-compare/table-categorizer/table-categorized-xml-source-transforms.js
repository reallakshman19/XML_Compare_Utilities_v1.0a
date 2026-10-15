export const TABLE_CATEGORIZED_XML_SOURCE_TRANSFORMS_SCHEMA = 'table-categorized-xml-source-transforms/v1';

const OPS = new Set(['copy', 'trim', 'take-before', 'take-after', 'replace-text', 'regex-replace', 'regex-extract', 'parse-number']);
const clean = (v) => String(v ?? '').trim();
const diag = (severity, code, message, details = {}) => Object.freeze({ severity, code, message, details: Object.freeze({ ...details }) });
const freeze = (value) => Object.freeze(value);

export function createSourceTransformRule(input = {}) {
  const op = OPS.has(input.operation) ? input.operation : 'trim';
  return freeze({
    ruleId: clean(input.ruleId) || `rule_${Date.now()}`,
    enabled: input.enabled !== false,
    newColumn: clean(input.newColumn) || 'New_Column',
    sourceColumn: clean(input.sourceColumn),
    operation: op,
    find: String(input.find ?? ''),
    replaceWith: String(input.replaceWith ?? ''),
    group: Number(input.group) || 1,
    trim: input.trim !== false,
  });
}

export function applySourceTransformRuleToRow(row, rule) {
  const src = readSourceValue(row, rule.sourceColumn);
  const result = transformValue(src, rule);
  return freeze({ sourceValue: src, newValue: result.value, diagnostics: freeze(result.diagnostics) });
}

export function applySourceTransformRules(source, rules = []) {
  const enabled = (rules || []).map(createSourceTransformRule).filter((r) => r.enabled);
  let current = cloneSource(source);
  const diagnostics = [...(current.diagnostics || [])];
  for (const rule of enabled) {
    const next = applyOneRule(current, rule);
    current = next.source;
    diagnostics.push(...next.diagnostics);
  }
  return freeze({ ...current, diagnostics: freeze(diagnostics), transformRules: freeze((rules || []).map(createSourceTransformRule)) });
}

export function previewSourceTransform(source, rule, limit = 6) {
  const safeRule = createSourceTransformRule(rule);
  const rows = (source?.rows || []).slice(0, Math.max(0, Number(limit) || 6)).map((row) => {
    const result = applySourceTransformRuleToRow(row, safeRule);
    return freeze({ sourceValue: result.sourceValue, newValue: result.newValue, diagnostics: result.diagnostics });
  });
  return freeze({ rule: safeRule, rows: freeze(rows), diagnostics: freeze(rows.flatMap((r) => r.diagnostics || [])) });
}

function cloneSource(source = {}) {
  return {
    ...source,
    headers: [...(source.headers || [])],
    columnIds: [...(source.columnIds || [])],
    rows: (source.rows || []).map(cloneRow),
    diagnostics: [...(source.diagnostics || [])],
  };
}

function cloneRow(row = {}) {
  return {
    ...row,
    rawCells: [...(row.rawCells || [])],
    rawByHeader: { ...(row.rawByHeader || {}) },
    rawByColumnId: { ...(row.rawByColumnId || {}) },
  };
}

function applyOneRule(source, rule) {
  if (!rule.newColumn) return { source, diagnostics: [diag('BLOCKER', 'transform_new_column_missing', 'New column name is required.', { ruleId: rule.ruleId })] };
  if ((source.headers || []).includes(rule.newColumn)) return { source, diagnostics: [diag('BLOCKER', 'transform_new_column_duplicate', `Column already exists: ${rule.newColumn}`, { ruleId: rule.ruleId, column: rule.newColumn })] };
  const columnId = stableColumnId(rule.newColumn, source.columnIds || []);
  
  let effectiveSourceColumn = rule.sourceColumn;
  if (effectiveSourceColumn && source.headers && source.headers.length > 0 && !source.headers.includes(effectiveSourceColumn)) {
    effectiveSourceColumn = source.headers[0];
  }
  const effectiveRule = { ...rule, sourceColumn: effectiveSourceColumn };

  const diagnostics = [];
  const rows = (source.rows || []).map((row) => appendValue(row, effectiveRule, columnId, diagnostics));
  return {
    source: freeze({ ...source, headers: freeze([...(source.headers || []), rule.newColumn]), columnIds: freeze([...(source.columnIds || []), columnId]), rows: freeze(rows) }),
    diagnostics: [diag('INFO', 'transform_column_added', `Derived column added: ${rule.newColumn}`, { ruleId: rule.ruleId, sourceColumn: effectiveSourceColumn, newColumn: rule.newColumn }), ...diagnostics],
  };
}

function appendValue(row, rule, columnId, diagnostics) {
  const result = applySourceTransformRuleToRow(row, rule);
  diagnostics.push(...result.diagnostics.map((d) => ({ ...d, details: { ...(d.details || {}), rowId: row.rowId } })));
  return freeze({
    ...row,
    rawCells: freeze([...(row.rawCells || []), result.newValue]),
    rawByHeader: freeze({ ...(row.rawByHeader || {}), [rule.newColumn]: result.newValue }),
    rawByColumnId: freeze({ ...(row.rawByColumnId || {}), [columnId]: result.newValue }),
  });
}

function transformValue(value, rule) {
  let text = String(value ?? '');
  const find = String(rule.find ?? '');
  const replaceWith = String(rule.replaceWith ?? '');
  const diagnostics = [];
  if (rule.operation === 'trim') text = text.trim();
  else if (rule.operation === 'take-before' && find) text = text.split(find)[0] ?? '';
  else if (rule.operation === 'take-after' && find) text = text.includes(find) ? text.split(find).slice(1).join(find) : '';
  else if (rule.operation === 'replace-text' && find) text = text.replaceAll(find, replaceWith);
  else if (rule.operation === 'regex-replace' && find) {
    try { text = text.replace(new RegExp(find, 'g'), replaceWith); }
    catch (error) { diagnostics.push(diag('WARNING', 'transform_regex_invalid', 'Invalid regex. Value was left unchanged.', { ruleId: rule.ruleId, error: String(error?.message || error) })); }
  }
  else if (rule.operation === 'regex-extract' && find) {
    try {
      const match = text.match(new RegExp(find, 'i'));
      if (match) {
        if (rule.group !== undefined && rule.group !== null && rule.group !== '') {
          text = match[Number(rule.group)] || '';
        } else {
          text = match[0] || '';
        }
      } else {
        text = ''; // Clear if not found
      }
    }
    catch (error) {
      diagnostics.push(diag('WARNING', 'transform_regex_invalid', 'Invalid regex. Value cleared.', { ruleId: rule.ruleId, error: String(error?.message || error) }));
      text = '';
    }
  }
  if (rule.trim) text = text.trim();
  if (rule.operation === 'parse-number') {
    if (text === '' || text === '-') {
      text = '';
    } else {
      const num = Number(text.replace(/[^0-9.-]+/g, ''));
      if (!Number.isNaN(num)) text = String(num);
      else {
        diagnostics.push(diag('WARNING', 'transform_number_invalid', 'Failed to parse number. Value cleared.', { ruleId: rule.ruleId, value: text }));
        text = '';
      }
    }
  }
  return { value: text, diagnostics };
}

function readSourceValue(row = {}, column = '') {
  if (row.rawByHeader && column in row.rawByHeader) return row.rawByHeader[column];
  if (row.rawByColumnId && column in row.rawByColumnId) return row.rawByColumnId[column];
  return '';
}

function stableColumnId(header, existing = []) {
  const base = clean(header).replaceAll(' ', '_') || 'New_Column';
  if (!existing.includes(base)) return base;
  let index = 2;
  while (existing.includes(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

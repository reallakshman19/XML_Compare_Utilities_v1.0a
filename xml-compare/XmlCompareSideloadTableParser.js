export const XML_COMPARE_SIDELOAD_TABLE_SCHEMA = 'xml-compare-sideload-table/v1';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const normalKey = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

const HEADER_ALIASES = Object.freeze({
  from: ['from', 'fromnode', 'from_node', 'fromnodeno'],
  to: ['to', 'tonode', 'to_node', 'tonodeno'],
  lineId: ['lineid', 'line_id', 'branch', 'branchname'],
  fromName: ['fromname', 'from_name'],
  toName: ['toname', 'to_name'],
  node: ['node', 'nodenumber', 'node_no', 'basednode', 'base_node'],
  type: ['type', 'restrainttype', 'supporttype'],
  stiffness: ['stiffness', 'stiff'],
  gap: ['gap', 'gapmm'],
  mu: ['mu', 'friction', 'frictionmu'],
  cnode: ['cnode', 'cnodeno'],
  tag: ['tag', 'sourcetag', 'supporttag', 'dtxrps'],
});

export function normalizeNode(value) {
  const raw = clean(value).replace(/^[\'"]|[\'"]$/g, '');
  const number = Number(raw);
  if (Number.isFinite(number) && Math.abs(number - Math.round(number)) < 1e-6) {
    return String(Math.round(number));
  }
  return raw.replace(/\.0+$/, '');
}

export function normalizeScalar(value) {
  const raw = clean(value).replace(/^[\'"]|[\'"]$/g, '');
  const number = Number(raw);
  return Number.isFinite(number) ? String(Number(number.toFixed(6))) : upper(raw);
}

export function numberValue(value) {
  const match = clean(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  const number = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

export function pairKey(from, to) {
  return `${normalizeNode(from)}->${normalizeNode(to)}`;
}

export function splitSideloadLine(line) {
  const raw = clean(line);
  if (!raw || raw.startsWith('#')) return [];
  if (raw.includes('\t')) return raw.split('\t').map(clean);
  if (raw.includes('|')) return raw.split('|').map(clean);
  if (raw.includes(',')) return raw.split(',').map(clean);
  return raw.split(/\s+/).map(clean);
}

export function aliasIndex(headers, column) {
  const aliases = (HEADER_ALIASES[column] || [column]).map(normalKey);
  return headers.findIndex((header) => aliases.includes(normalKey(header)));
}

export function isSideloadHeader(cells, columns) {
  return columns.some((column) => aliasIndex(cells, column) >= 0);
}

function rowFromCells(cells, headers, columns, table, sourceRow) {
  const row = { table, sourceRow, rowId: `${table}:${sourceRow}` };
  for (const [position, column] of columns.entries()) {
    const headerPosition = headers ? aliasIndex(headers, column) : -1;
    row[column] = clean(cells[headerPosition >= 0 ? headerPosition : position]);
  }
  return Object.freeze(row);
}

export function parseSideloadRows(input, columns, options = {}) {
  const rows = [];
  let headers = null;
  const table = clean(options.table) || 'sideload';
  const lines = String(input ?? '').split(/\r?\n/);
  for (const [index, sourceLine] of lines.entries()) {
    let cells = splitSideloadLine(sourceLine);
    if (!cells.length) continue;
    if (!headers && isSideloadHeader(cells, columns)) {
      headers = cells;
      continue;
    }
    if (options.joinTail && cells.length > columns.length) {
      cells = [...cells.slice(0, columns.length - 1), cells.slice(columns.length - 1).join(' ')];
    }
    const row = rowFromCells(cells, headers, columns, table, index + 1);
    if (columns.some((column) => clean(row[column]))) rows.push(row);
  }
  return Object.freeze(rows);
}

export function parseLineIdRows(input = '') {
  return parseSideloadRows(input, ['from', 'to', 'lineId'], { table: 'line-id' });
}

export function parseNodeNameRows(input = '') {
  return parseSideloadRows(
    input,
    ['from', 'to', 'fromName', 'toName'],
    { table: 'node-name' },
  );
}

export function parseRestraintTagRows(input = '') {
  return parseSideloadRows(
    input,
    ['from', 'to', 'node', 'type', 'stiffness', 'gap', 'mu', 'cnode', 'tag'],
    { table: 'restraint-tag', joinTail: true },
  );
}

export function tagKeys(row = {}) {
  const node = normalizeNode(row.node);
  const type = normalizeScalar(row.type);
  const stiffness = normalizeScalar(row.stiffness);
  const gap = normalizeScalar(row.gap);
  const mu = normalizeScalar(row.mu);
  const cnode = normalizeScalar(row.cnode);
  return Object.freeze({
    exact: `${node}|${type}|${stiffness}|${gap}|${mu}|${cnode}`,
    nodeType: `${node}|${type}`,
    node,
  });
}

export function rowIdentity(row = {}) {
  return `${clean(row.table) || 'sideload'} row ${Number(row.sourceRow) || '?'}`;
}

export const _test = Object.freeze({
  clean,
  upper,
  normalKey,
  HEADER_ALIASES,
  rowFromCells,
});

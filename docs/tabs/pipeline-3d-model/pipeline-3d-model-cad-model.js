import {
  buildMonotonicCoordinateMap,
  interpolateAbsoluteHFromCumulative,
  formatDepth,
  formatStation,
  parseDepthText,
  parseStation,
} from './pipeline-3d-model-cad-math.js';

export const DASH = '—';

export const TABLE_HEADERS = Object.freeze({
  table2a: Object.freeze(['H(coor)', 'V(coor)', '[H vs V] Length', 'Station Text', 'Elevation Text']),
  table3a: Object.freeze(['From H(coor)', 'To H(coor)', 'Text Position X', 'HLength Text']),
  table3b: Object.freeze(['From H(coor)', 'To H(coor)', 'Text Position X', 'Z Text']),
  table3c: Object.freeze(['Text Position X', 'Marker Text']),
});

function clean(value) {
  return String(value ?? '').trim();
}

function finiteOrNull(value) {
  const match = clean(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function allNumbers(value) {
  return (clean(value).match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
}

function splitLines(text) {
  return String(text ?? '').split(/\r?\n/).filter((line) => line.trim());
}

function splitTsv(line) {
  return String(line ?? '').split('\t').map(clean);
}

function hasHeader(lines, expected) {
  if (!lines.length) return false;
  const first = splitTsv(lines[0]).map((value) => value.toLowerCase());
  return first.some((value) => value === expected[0].toLowerCase());
}

function parseRows(text, headers) {
  const lines = splitLines(text);
  const body = hasHeader(lines, headers) ? lines.slice(1) : lines;
  return body.map((line, index) => {
    const cells = splitTsv(line);
    return {
      sourceLine: index + 1,
      cells: headers.map((_, cellIndex) => cells[cellIndex] ?? ''),
      rawLine: line,
    };
  });
}

function stableId(table, sourceLine) {
  return `${table}-${String(sourceLine).padStart(4, '0')}`;
}

function parseCoordinateToken(value) {
  const numbers = allNumbers(value);
  if (!numbers.length) return Object.freeze({ kind: 'empty', value: null, from: null, to: null, text: clean(value) || DASH });
  if (numbers.length >= 2 && /→|->/.test(clean(value))) {
    return Object.freeze({ kind: 'range', value: null, from: numbers[0], to: numbers[1], text: clean(value) });
  }
  return Object.freeze({ kind: 'point', value: numbers[0], from: null, to: null, text: clean(value) });
}

function endpointBasis(token) {
  if (!token) return null;
  if (token.kind === 'point') return token.value;
  if (token.kind === 'range') return token.to;
  return null;
}

function fmt(value, decimals = 3) {
  if (!Number.isFinite(Number(value))) return DASH;
  return Number(value).toFixed(decimals).replace(/\.?0+$/, '');
}

function normalizeText(value) {
  return clean(value) || DASH;
}

export function parseTable2ARows(text) {
  return parseRows(text, TABLE_HEADERS.table2a).map((source) => {
    const [hText, vText, lengthText, stationText, elevationText] = source.cells;
    const hCoordinate = parseCoordinateToken(hText);
    return {
      id: stableId('table2a', source.sourceLine),
      sourceTable: 'table2a',
      sourceLine: source.sourceLine,
      hCoordinate,
      basisH: endpointBasis(hCoordinate),
      vCoordinateText: normalizeText(vText),
      spanLength: finiteOrNull(lengthText),
      stationText: normalizeText(stationText),
      stationValue: parseStation(stationText),
      elevationText: normalizeText(elevationText),
      elevationValue: finiteOrNull(elevationText),
    };
  });
}

export function parseTable3ARows(text) {
  return parseRows(text, TABLE_HEADERS.table3a).map((source) => {
    const [fromText, toText, textPositionText, lengthText] = source.cells;
    return {
      id: stableId('table3a', source.sourceLine),
      sourceTable: 'table3a',
      sourceLine: source.sourceLine,
      fromH: finiteOrNull(fromText),
      toH: finiteOrNull(toText),
      textPositionH: finiteOrNull(textPositionText),
      hLength: finiteOrNull(lengthText),
    };
  });
}

export function parseTable3BRows(text) {
  return parseRows(text, TABLE_HEADERS.table3b).map((source) => {
    const [fromText, toText, textPositionText, zText] = source.cells;
    const depth = parseDepthText(zText);
    return {
      id: stableId('table3b', source.sourceLine),
      sourceTable: 'table3b',
      sourceLine: source.sourceLine,
      fromH: finiteOrNull(fromText),
      toH: finiteOrNull(toText),
      absoluteH: finiteOrNull(textPositionText) ?? finiteOrNull(toText) ?? finiteOrNull(fromText),
      textPositionH: finiteOrNull(textPositionText),
      zText: normalizeText(zText),
      zMode: depth?.mode ?? null,
      z: depth?.z ?? null,
      depth: depth?.depth ?? null,
    };
  });
}

export function parseTable3CRows(text) {
  return parseRows(text, TABLE_HEADERS.table3c).map((source) => {
    const [textPositionText, markerText] = source.cells;
    return {
      id: stableId('table3c', source.sourceLine),
      sourceTable: 'table3c',
      sourceLine: source.sourceLine,
      absoluteH: finiteOrNull(textPositionText),
      markerText: normalizeText(markerText),
    };
  });
}

export function serializeTable2ARows(rows) {
  const body = rows.map((row) => [
    row.hCoordinate?.text || (row.hCoordinate?.kind === 'point' ? fmt(row.hCoordinate.value) : DASH),
    normalizeText(row.vCoordinateText),
    Number.isFinite(row.spanLength) ? fmt(row.spanLength) : DASH,
    Number.isFinite(row.stationValue) ? formatStation(row.stationValue) : normalizeText(row.stationText),
    Number.isFinite(row.elevationValue) ? Number(row.elevationValue).toFixed(2) : normalizeText(row.elevationText),
  ].join('\t'));
  return [TABLE_HEADERS.table2a.join('\t'), ...body].join('\n');
}

export function serializeTable3ARows(rows) {
  const body = rows.map((row) => [
    Number.isFinite(row.fromH) ? fmt(row.fromH) : DASH,
    Number.isFinite(row.toH) ? fmt(row.toH) : DASH,
    Number.isFinite(row.textPositionH) ? fmt(row.textPositionH) : DASH,
    Number.isFinite(row.hLength) ? Number(row.hLength).toFixed(1) : DASH,
  ].join('\t'));
  return [TABLE_HEADERS.table3a.join('\t'), ...body].join('\n');
}

export function serializeTable3BRows(rows) {
  const body = rows.map((row) => [
    Number.isFinite(row.fromH) ? fmt(row.fromH) : DASH,
    Number.isFinite(row.toH) ? fmt(row.toH) : DASH,
    Number.isFinite(row.textPositionH ?? row.absoluteH) ? fmt(row.textPositionH ?? row.absoluteH) : DASH,
    Number.isFinite(row.z) ? formatDepth(row.z) : normalizeText(row.zText),
  ].join('\t'));
  return [TABLE_HEADERS.table3b.join('\t'), ...body].join('\n');
}

export function serializeTable3CRows(rows) {
  const body = rows.map((row) => [
    Number.isFinite(row.absoluteH) ? fmt(row.absoluteH) : DASH,
    normalizeText(row.markerText),
  ].join('\t'));
  return [TABLE_HEADERS.table3c.join('\t'), ...body].join('\n');
}

export function buildTable2StationCoordinateMap(table2Rows) {
  const anchors = table2Rows
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.basisH))
    .map((row) => ({ cumulative: row.stationValue, absoluteH: row.basisH }));
  if (anchors.length < 2) throw new Error('Table 2A must contain at least two station/H coordinate anchors.');
  return buildMonotonicCoordinateMap(anchors);
}

export function buildCoordinateAnchors(table3LengthRows) {
  const validRows = table3LengthRows.filter((row) => Number.isFinite(row.fromH) && Number.isFinite(row.toH) && Number.isFinite(row.hLength));
  if (!validRows.length) throw new Error('Table 3A must contain at least one valid HLength row.');
  let cumulative = 0;
  const anchors = [{ cumulative: 0, absoluteH: validRows[0].fromH }];
  for (const row of validRows) {
    cumulative += row.hLength;
    anchors.push({ cumulative, absoluteH: row.toH });
  }
  return buildMonotonicCoordinateMap(anchors);
}

function cloneRow(row) {
  return {
    ...row,
    ...(row.hCoordinate ? { hCoordinate: { ...row.hCoordinate } } : {}),
  };
}

function cloneState(state) {
  return {
    table2Rows: state.table2Rows.map(cloneRow),
    table3LengthRows: state.table3LengthRows.map(cloneRow),
    table3DepthRows: state.table3DepthRows.map(cloneRow),
    table3MarkerRows: state.table3MarkerRows.map(cloneRow),
    revision: state.revision,
    dirtyRowIds: new Set(state.dirtyRowIds),
  };
}

export class PipelineProfileModel extends EventTarget {
  constructor(state) {
    super();
    this.table2Rows = state.table2Rows;
    this.table3LengthRows = state.table3LengthRows;
    this.table3DepthRows = state.table3DepthRows;
    this.table3MarkerRows = state.table3MarkerRows;
    this.revision = state.revision ?? 0;
    this.dirtyRowIds = state.dirtyRowIds ?? new Set();
    this.coordinateMap = buildCoordinateAnchors(this.table3LengthRows);
    this.table2StationMap = buildTable2StationCoordinateMap(this.table2Rows);
  }

  static fromRaw(raw) {
    return new PipelineProfileModel({
      table2Rows: parseTable2ARows(raw?.table2a),
      table3LengthRows: parseTable3ARows(raw?.table3a),
      table3DepthRows: parseTable3BRows(raw?.table3b),
      table3MarkerRows: parseTable3CRows(raw?.table3c),
      revision: 0,
      dirtyRowIds: new Set(),
    });
  }

  snapshot() {
    return cloneState(this);
  }

  restore(snapshot, reason = 'restore') {
    const state = cloneState(snapshot);
    this.table2Rows = state.table2Rows;
    this.table3LengthRows = state.table3LengthRows;
    this.table3DepthRows = state.table3DepthRows;
    this.table3MarkerRows = state.table3MarkerRows;
    this.revision = state.revision;
    this.dirtyRowIds = state.dirtyRowIds;
    this.coordinateMap = buildCoordinateAnchors(this.table3LengthRows);
    this.table2StationMap = buildTable2StationCoordinateMap(this.table2Rows);
    this.dispatchEvent(new CustomEvent('modelRestored', { detail: { reason, revision: this.revision } }));
  }

  findRow(id) {
    return [...this.table2Rows, ...this.table3LengthRows, ...this.table3DepthRows, ...this.table3MarkerRows].find((row) => row.id === id) ?? null;
  }

  mutateRow(id, patch, reason) {
    const groups = [this.table2Rows, this.table3LengthRows, this.table3DepthRows, this.table3MarkerRows];
    for (const rows of groups) {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) continue;
      const before = cloneRow(rows[index]);
      rows[index] = { ...rows[index], ...patch };
      this.revision += 1;
      this.dirtyRowIds.add(id);
      this.dispatchEvent(new CustomEvent('rowChanged', {
        detail: { id, reason, before, after: cloneRow(rows[index]), revision: this.revision },
      }));
      return rows[index];
    }
    throw new Error(`Unknown profile row: ${id}`);
  }

  moveTable2Elevation(id, elevation) {
    const value = Number(elevation);
    if (!Number.isFinite(value)) throw new TypeError('Elevation must be finite.');
    return this.mutateRow(id, { elevationValue: value, elevationText: value.toFixed(2) }, 'move-table2-elevation');
  }

  moveDepth(id, z) {
    const value = Number(z);
    if (!Number.isFinite(value)) throw new TypeError('Z must be finite.');
    const zText = formatDepth(value);
    const parsed = parseDepthText(zText);
    return this.mutateRow(id, {
      z: parsed?.z ?? value,
      depth: parsed?.depth ?? Math.max(0, -value),
      zMode: parsed?.mode ?? 'DEPTH',
      zText,
    }, 'move-table3-depth');
  }

  moveMarker(id, absoluteH) {
    const value = Number(absoluteH);
    if (!Number.isFinite(value)) throw new TypeError('Marker H must be finite.');
    return this.mutateRow(id, { absoluteH: value }, 'move-table3-marker');
  }

  renameMarker(id, markerText) {
    const value = clean(markerText);
    if (!value) throw new Error('Marker text cannot be empty.');
    return this.mutateRow(id, { markerText: value }, 'rename-table3-marker');
  }

  nextId(table) {
    const rows = {
      table2a: this.table2Rows,
      table3a: this.table3LengthRows,
      table3b: this.table3DepthRows,
      table3c: this.table3MarkerRows,
    }[table] || [];
    let counter = rows.length + 1;
    let candidate = `${table}-new-${String(counter).padStart(4, '0')}`;
    const ids = new Set(rows.map((row) => row.id));
    while (ids.has(candidate)) {
      counter += 1;
      candidate = `${table}-new-${String(counter).padStart(4, '0')}`;
    }
    return candidate;
  }

  insertTable2Node({ stationValue, elevationValue, afterId = null, beforeId = null }) {
    const station = Number(stationValue);
    const elevation = Number(elevationValue);
    if (!Number.isFinite(station) || !Number.isFinite(elevation)) {
      throw new TypeError('Inserted Table 2 node requires finite station and elevation values.');
    }
    const absoluteH = interpolateAbsoluteHFromCumulative(station, this.table2StationMap);
    const row = {
      id: this.nextId('table2a'),
      sourceTable: 'table2a',
      sourceLine: null,
      hCoordinate: { kind: 'point', value: absoluteH, from: null, to: null, text: fmt(absoluteH) },
      basisH: absoluteH,
      vCoordinateText: DASH,
      spanLength: null,
      stationText: formatStation(station),
      stationValue: station,
      elevationText: elevation.toFixed(2),
      elevationValue: elevation,
    };
    let index = afterId ? this.table2Rows.findIndex((candidate) => candidate.id === afterId) + 1 : -1;
    if (index <= 0 && beforeId) index = this.table2Rows.findIndex((candidate) => candidate.id === beforeId);
    if (index < 0) index = this.table2Rows.findIndex((candidate) => Number.isFinite(candidate.stationValue) && candidate.stationValue > station);
    if (index < 0) index = this.table2Rows.length;
    this.table2Rows.splice(index, 0, row);
    this.revision += 1;
    this.dirtyRowIds.add(row.id);
    this.table2StationMap = buildTable2StationCoordinateMap(this.table2Rows);
    this.dispatchEvent(new CustomEvent('rowAdded', { detail: { row: cloneRow(row), index, revision: this.revision } }));
    return row;
  }

  addDepth({ absoluteH, z }) {
    const h = Number(absoluteH);
    const value = Number(z);
    if (!Number.isFinite(h) || !Number.isFinite(value)) throw new TypeError('Depth requires finite absoluteH and z.');
    const parsed = parseDepthText(formatDepth(value));
    const row = {
      id: this.nextId('table3b'),
      sourceTable: 'table3b',
      sourceLine: null,
      fromH: null,
      toH: null,
      absoluteH: h,
      textPositionH: h,
      zText: formatDepth(value),
      zMode: parsed?.mode ?? 'DEPTH',
      z: parsed?.z ?? value,
      depth: parsed?.depth ?? Math.max(0, -value),
    };
    this.table3DepthRows.push(row);
    this.table3DepthRows.sort((a, b) => (a.absoluteH ?? Infinity) - (b.absoluteH ?? Infinity));
    this.revision += 1;
    this.dirtyRowIds.add(row.id);
    this.dispatchEvent(new CustomEvent('rowAdded', { detail: { row: cloneRow(row), revision: this.revision } }));
    return row;
  }

  addMarker({ absoluteH, markerText = 'PM-NEW' }) {
    const h = Number(absoluteH);
    const text = clean(markerText);
    if (!Number.isFinite(h) || !text) throw new TypeError('Marker requires finite absoluteH and non-empty text.');
    const row = { id: this.nextId('table3c'), sourceTable: 'table3c', sourceLine: null, absoluteH: h, markerText: text };
    this.table3MarkerRows.push(row);
    this.table3MarkerRows.sort((a, b) => (a.absoluteH ?? Infinity) - (b.absoluteH ?? Infinity));
    this.revision += 1;
    this.dirtyRowIds.add(row.id);
    this.dispatchEvent(new CustomEvent('rowAdded', { detail: { row: cloneRow(row), revision: this.revision } }));
    return row;
  }

  deleteRow(id) {
    const groups = [this.table2Rows, this.table3LengthRows, this.table3DepthRows, this.table3MarkerRows];
    for (const rows of groups) {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) continue;
      const [row] = rows.splice(index, 1);
      this.revision += 1;
      this.dirtyRowIds.delete(id);
      if (row.sourceTable === 'table2a') this.table2StationMap = buildTable2StationCoordinateMap(this.table2Rows);
      if (row.sourceTable === 'table3a') this.coordinateMap = buildCoordinateAnchors(this.table3LengthRows);
      this.dispatchEvent(new CustomEvent('rowDeleted', { detail: { row: cloneRow(row), index, revision: this.revision } }));
      return row;
    }
    throw new Error(`Unknown profile row: ${id}`);
  }

  clearDirtyRows() {
    this.dirtyRowIds.clear();
    this.dispatchEvent(new CustomEvent('dirtyRowsCleared', { detail: { revision: this.revision } }));
  }

  serializeRaw() {
    return Object.freeze({
      table2a: serializeTable2ARows(this.table2Rows),
      table3a: serializeTable3ARows(this.table3LengthRows),
      table3b: serializeTable3BRows(this.table3DepthRows),
      table3c: serializeTable3CRows(this.table3MarkerRows),
    });
  }
}

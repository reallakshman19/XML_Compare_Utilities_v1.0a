const ENTITY_START_RE = /^\s*(LINE|TEXT|DIMENSION|CIRCLE|LWPOLYLINE)\s+Layer:\s*"([^"]+)"/i;
const POINT_RE = /X\s*=\s*(-?[\d.]+)\s+Y\s*=\s*(-?[\d.]+)\s+Z\s*=\s*(-?[\d.]+)/i;
const STATION_RE = /^\s*(\d+)\s*\+\s*(\d+(?:\.\d+)?)\s*$/;
const NUMERIC_TEXT_RE = /^\s*[+-]?\d+(?:\.\d+)?\s*$/;
const DASH = '—';

function round(value, places = 3) {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function fmt(value, places = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DASH;
  return number.toFixed(places);
}

function fmtTrim(value, places = 3) {
  const text = fmt(value, places);
  if (text === DASH) return text;
  return text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function fmtOne(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : DASH;
}

function parsePoint(line) {
  const match = String(line || '').match(POINT_RE);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
}

function readFirstPoint(lines, matcher) {
  const line = lines.find((entry) => matcher.test(entry));
  return line ? parsePoint(line) : null;
}

function parseEntity(block) {
  const first = block[0].match(ENTITY_START_RE);
  if (!first) return null;
  const type = first[1].toUpperCase();
  const layer = first[2];
  const handle = block.find((line) => /Handle\s*=/.test(line))?.split('=')[1]?.trim() || '';
  if (type === 'LINE') {
    return {
      type,
      layer,
      handle,
      from: readFirstPoint(block, /from point/i),
      to: readFirstPoint(block, /to point/i),
      length: Number(block.find((line) => /^\s*Length\s*=/.test(line))?.split('=')[1]?.trim()) || null,
    };
  }
  if (type === 'TEXT') {
    const point = readFirstPoint(block, /(?:start|mid) point/i);
    const textLine = block.slice(1).find((line) => /^\s*text\s+/i.test(line));
    return {
      type,
      layer,
      handle,
      point,
      text: textLine ? textLine.replace(/^\s*text\s+/i, '').trim() : '',
    };
  }
  if (type === 'DIMENSION') {
    const extensionLines = block.filter((line) => /(?:1st|2nd) extension\s+defining point/i.test(line));
    const modifierLine = block.find((line) => /dimension text modifier:/i.test(line));
    const textPositionLine = block.find((line) => /(?:default|user specified) text position:/i.test(line));
    return {
      type,
      layer,
      handle,
      extension1: parsePoint(extensionLines[0]),
      extension2: parsePoint(extensionLines[1]),
      textPosition: parsePoint(textPositionLine),
      modifier: modifierLine ? modifierLine.split(':').slice(1).join(':').trim() : '',
      defaultText: block.some((line) => /^\s*default text\s*$/i.test(line)),
    };
  }
  if (type === 'CIRCLE') {
    const radiusLine = block.find((line) => /^\s*radius\s+/i.test(line));
    return {
      type,
      layer,
      handle,
      center: readFirstPoint(block, /center point/i),
      radius: radiusLine ? Number(radiusLine.match(/-?[\d.]+/)?.[0]) : null,
    };
  }
  return { type, layer, handle };
}

export function parseAutocadListEntities(text) {
  const blocks = [];
  let current = null;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    if (ENTITY_START_RE.test(rawLine)) {
      if (current?.length) blocks.push(current);
      current = [rawLine];
    } else if (current) {
      current.push(rawLine);
    }
  }
  if (current?.length) blocks.push(current);
  return blocks.map(parseEntity).filter(Boolean);
}

function frameKey(point) {
  return [point.sheetIndex ?? '', point.originX, point.originY, point.originZ, point.angleDeg].join('|');
}

export function framesFromTable1(points) {
  const frames = [];
  const seen = new Set();
  for (const point of Array.isArray(points) ? points : []) {
    const key = frameKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    frames.push({
      originX: Number(point.originX) || 0,
      originY: Number(point.originY) || 0,
      originZ: Number(point.originZ) || 0,
      angleDeg: Number(point.angleDeg) || 0,
    });
  }
  return frames;
}

function inversePoint(point, frame) {
  if (!point) return null;
  if (!frame) return { ...point };
  const rad = ((Number(frame.angleDeg) || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - (Number(frame.originX) || 0);
  const dy = point.y - (Number(frame.originY) || 0);
  return {
    x: (dx * cos) + (dy * sin),
    y: (-dx * sin) + (dy * cos),
    z: point.z - (Number(frame.originZ) || 0),
  };
}

function usesGlobalCoordinates(entities) {
  const points = [];
  for (const entity of entities) {
    points.push(entity.from, entity.to, entity.point, entity.extension1, entity.extension2, entity.center);
  }
  return points.filter(Boolean).some((point) => Math.abs(point.x) > 100000 || Math.abs(point.y) > 100000);
}

function chooseFrame(entities, frames, orientation) {
  if (!usesGlobalCoordinates(entities)) return null;
  const candidates = Array.isArray(frames) ? frames : [];
  if (!candidates.length) throw new Error('Global-coordinate paste requires Table 1 origin and angle data.');
  const source = orientation === 'vertical'
    ? entities.find((entity) => entity.type === 'LINE' && entity.from && entity.to)
    : entities.find((entity) => entity.type === 'DIMENSION' && entity.extension1 && entity.extension2);
  if (!source) return candidates[0];
  return [...candidates].sort((a, b) => {
    const a1 = inversePoint(source.from || source.extension1, a);
    const a2 = inversePoint(source.to || source.extension2, a);
    const b1 = inversePoint(source.from || source.extension1, b);
    const b2 = inversePoint(source.to || source.extension2, b);
    const scoreA = orientation === 'vertical' ? Math.abs(a2.x - a1.x) : Math.abs(a2.y - a1.y);
    const scoreB = orientation === 'vertical' ? Math.abs(b2.x - b1.x) : Math.abs(b2.y - b1.y);
    return scoreA - scoreB;
  })[0];
}

function stationValue(text) {
  const match = String(text || '').match(STATION_RE);
  return match ? (Number(match[1]) * 1000) + Number(match[2]) : null;
}

function groupVerticalLines(lines, frame) {
  const groups = [];
  for (const line of lines) {
    const from = inversePoint(line.from, frame);
    const to = inversePoint(line.to, frame);
    if (!from || !to || Math.abs(to.x - from.x) > 0.03) continue;
    const x = (from.x + to.x) / 2;
    let group = groups.find((entry) => Math.abs(entry.x - x) <= 0.01);
    if (!group) {
      group = { x, minY: Infinity, maxY: -Infinity, maxDeclaredLength: 0 };
      groups.push(group);
    }
    group.minY = Math.min(group.minY, from.y, to.y);
    group.maxY = Math.max(group.maxY, from.y, to.y);
    group.maxDeclaredLength = Math.max(group.maxDeclaredLength, Number(line.length) || 0);
  }
  const maxSpan = Math.max(0, ...groups.map((group) => group.maxY - group.minY));
  return groups
    .filter((group) => maxSpan === 0 || (group.maxY - group.minY) >= maxSpan * 0.9)
    .sort((a, b) => a.x - b.x);
}

function pairTable2Texts(textEntities, frame) {
  const stations = [];
  const elevations = [];
  for (const entity of textEntities) {
    const point = inversePoint(entity.point, frame);
    if (!point) continue;
    const station = stationValue(entity.text);
    if (Number.isFinite(station)) stations.push({ ...entity, point, station });
    else if (NUMERIC_TEXT_RE.test(entity.text)) elevations.push({ ...entity, point, elevation: Number(entity.text.trim()) });
  }
  const pairs = [];
  const seen = new Set();
  for (const station of stations.sort((a, b) => a.station - b.station)) {
    const elevation = [...elevations].sort((a, b) => {
      const ax = Math.abs(a.point.x - station.point.x);
      const bx = Math.abs(b.point.x - station.point.x);
      return ax - bx || Math.abs(a.point.y - station.point.y) - Math.abs(b.point.y - station.point.y);
    })[0];
    if (!elevation || Math.abs(elevation.point.x - station.point.x) > 0.05) continue;
    const key = `${station.text}|${elevation.text}|${round(station.point.x, 3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ stationText: station.text.trim(), station: station.station, elevationText: elevation.text.trim() });
  }
  return pairs;
}

export function parseTable2Paste(text, options = {}) {
  const entities = parseAutocadListEntities(text);
  const frame = chooseFrame(entities, options.frames, 'vertical');
  const lines = entities.filter((entity) => entity.type === 'LINE' && /^F953$/i.test(entity.layer));
  const groups = groupVerticalLines(lines, frame);
  const pairs = pairTable2Texts(
    entities.filter((entity) => entity.type === 'TEXT' && /^F953$/i.test(entity.layer)),
    frame,
  );
  const count = Math.min(groups.length, pairs.length);
  if (!count) throw new Error('No Table 2 station/elevation line groups were found in the pasted AutoCAD LIST text.');
  const rows = Array.from({ length: count }, (_, index) => {
    const group = groups[index];
    const pair = pairs[index];
    return {
      h: round(group.x),
      vFrom: round(group.minY),
      vTo: round(group.maxY),
      length: round(group.maxDeclaredLength >= (group.maxY - group.minY) * 0.9 ? group.maxDeclaredLength : group.maxY - group.minY),
      stationText: pair.stationText,
      elevationText: pair.elevationText,
    };
  });
  const rawText = [
    'H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text',
    ...rows.map((row) => `${fmt(row.h)}\t${fmt(row.vFrom)} → ${fmt(row.vTo)}\t${fmt(row.length)}\t${row.stationText}\t${row.elevationText}`),
  ].join('\n');
  return {
    rows,
    rawText,
    warnings: pairs.length > groups.length ? [`Ignored ${pairs.length - groups.length} unmatched station/elevation pair(s).`] : [],
  };
}

function dimensionRecord(entity, frame) {
  const a = inversePoint(entity.extension1, frame);
  const b = inversePoint(entity.extension2, frame);
  const text = inversePoint(entity.textPosition, frame);
  if (!a || !b || !text) return null;
  return {
    from: round(Math.min(a.x, b.x)),
    to: round(Math.max(a.x, b.x)),
    textX: round(text.x),
    length: Math.abs(b.x - a.x),
    modifier: entity.modifier,
    defaultText: entity.defaultText,
  };
}

export function parseTable3Paste(text, options = {}) {
  const entities = parseAutocadListEntities(text);
  const frame = chooseFrame(entities, options.frames, 'horizontal');
  const dimensions = entities
    .filter((entity) => entity.type === 'DIMENSION')
    .map((entity) => dimensionRecord(entity, frame))
    .filter(Boolean);
  const lengthRows = dimensions
    .filter((row) => row.defaultText && !row.modifier)
    .sort((a, b) => a.from - b.from);
  const zRows = dimensions
    .filter((row) => row.modifier)
    .map((row) => ({ ...row, zText: row.modifier }))
    .sort((a, b) => a.from - b.from);
  for (const entity of entities.filter((entry) => entry.type === 'TEXT' && /^\s*A\s*\/\s*G\s*$/i.test(entry.text))) {
    const point = inversePoint(entity.point, frame);
    if (point) zRows.push({ from: null, to: null, textX: round(point.x), zText: 'A/G' });
  }
  const explicitMarkers = entities
    .filter((entity) => entity.type === 'TEXT' && /^(?:PM|PMS)-\d+/i.test(entity.text))
    .map((entity) => ({ textX: round(inversePoint(entity.point, frame)?.x), markerText: entity.text.trim() }))
    .filter((row) => Number.isFinite(row.textX));
  const circleMarkers = entities
    .filter((entity) => entity.type === 'CIRCLE' && entity.layer === '1' && entity.center)
    .map((entity) => ({ textX: round(inversePoint(entity.center, frame)?.x) }))
    .filter((row) => Number.isFinite(row.textX))
    .sort((a, b) => a.textX - b.textX)
    .map((row, index) => ({ ...row, markerText: `PMS-${String(index + 1).padStart(3, '0')}` }));
  const markerRows = [...explicitMarkers, ...circleMarkers].sort((a, b) => a.textX - b.textX);
  const table3ARaw = [
    'From H(coor)\tTo H(coor)\tText Position X\tHLength Text',
    ...lengthRows.map((row) => `${fmt(row.from)}\t${fmt(row.to)}\t${fmt(row.textX)}\t${fmtOne(row.length)}`),
  ].join('\n');
  const table3BRaw = [
    'From H(coor)\tTo H(coor)\tText Position X\tZ Text',
    ...zRows.map((row) => `${Number.isFinite(row.from) ? fmt(row.from) : DASH}\t${Number.isFinite(row.to) ? fmt(row.to) : DASH}\t${fmt(row.textX)}\t${row.zText}`),
  ].join('\n');
  const table3CRaw = [
    'Text Position X\tMarker Text',
    ...markerRows.map((row) => `${fmt(row.textX)}\t${row.markerText}`),
  ].join('\n');
  if (!lengthRows.length && !zRows.length && !markerRows.length) {
    throw new Error('No Table 3 dimensions, A/G text, PM/PMS text, or Layer 1 circles were found.');
  }
  return { lengthRows, zRows, markerRows, table3ARaw, table3BRaw, table3CRaw };
}

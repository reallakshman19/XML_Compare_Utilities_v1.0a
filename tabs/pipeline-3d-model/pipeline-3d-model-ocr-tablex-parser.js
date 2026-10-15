// Pure parser for Table X OCR reference data in the Pipeline 3D Model tool.
// Input: OCR text and optional positioned words from the info-block drawing.
// Output: review-ready rows. Fallback: uncertain distances are left blank.

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;
const MARKER_RE = /\bPM[-\s]?[A-Z0-9]{1,6}\b/gi;
const COVER_RE = /\b\d+(?:[.,]\d+)?\s*M\b/gi;

function compactText(text) {
  return String(text || '').normalize('NFKC').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
}

function parseNumberToken(text) {
  const value = Number(String(text || '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function extractNumbers(text) {
  return (compactText(text).match(NUMBER_RE) || []).map(parseNumberToken).filter((value) => value != null);
}

function normalizeOptions(options) {
  const axisStart = parseNumberToken(options?.axisStart);
  const axisEnd = parseNumberToken(options?.axisEnd);
  return {
    axisStart: axisStart == null ? 0 : axisStart,
    axisEnd: axisEnd == null ? null : axisEnd,
  };
}

function makeRow(type, label, value, rawText, confidence) {
  return {
    type,
    label,
    start: '',
    end: '',
    horizontal: '',
    value: value || '',
    rawText: rawText || '',
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

function lineAfterLabel(line, pattern) {
  return compactText(line).replace(pattern, '').replace(/^[:\-\s]+/, '').trim();
}

function findLine(lines, pattern) {
  return lines.find((line) => pattern.test(line)) || '';
}

function normalizeNoteToken(text) {
  const note = compactText(text).match(/\bNOTE\s*-\s*\d+\b/i)?.[0] || '';
  return note ? note.replace(/\s+/g, '').toUpperCase() : '';
}

function extractHorizontalLengthValues(lines) {
  const line = findLine(lines, /horizontal\s+length/i);
  if (!line) return [];
  return extractNumbers(line).filter((value) => value > 0);
}

function buildSegmentRows(lengths) {
  let cumulative = 0;
  return lengths.map((length, index) => {
    const start = cumulative;
    cumulative += length;
    return {
      ...makeRow('segment-length', `Segment ${index + 1}`, String(length), `HORIZONTAL LENGTH ${length}`, 0),
      start,
      end: Math.round(cumulative * 1000) / 1000,
    };
  });
}

function collectSingleValueRows(lines) {
  const rows = [];
  const designLine = findLine(lines, /design\s+factor|df\s*:/i);
  const designValue = compactText(designLine).match(/\bDF\s*:?\s*\d+(?:\.\d+)?\b/i)?.[0] || '';
  if (designValue) rows.push(makeRow('single-value', 'DESIGN FACTOR', designValue, designLine, 0));

  const wallLine = findLine(lines, /wall\s*thk|wall\s*thickness|\d+(?:\.\d+)?\s*MM/i);
  const wallValue = compactText(wallLine).match(/\b\d+(?:\.\d+)?\s*MM\b/i)?.[0] || '';
  if (wallValue) rows.push(makeRow('single-value', 'WALL THK.', wallValue, wallLine, 0));

  const sizeLine = findLine(lines, /size|material|coating|code|ISO\s*\d+/i);
  const sizeValue = lineAfterLabel(sizeLine, /.*?(size|material|coating|code)\s*/i);
  if (sizeValue) rows.push(makeRow('single-value', 'SIZE/MATERIAL/COATING/CODE', sizeValue, sizeLine, 0));
  return rows;
}

function collectTextRows(text) {
  const lines = String(text || '').split(/\r?\n/).map(compactText).filter(Boolean);
  const rows = [];
  const lengths = extractHorizontalLengthValues(lines);
  rows.push(...buildSegmentRows(lengths));
  rows.push(...collectSingleValueRows(lines));

  const markerLine = findLine(lines, /markers?|PM[-\s]?[A-Z0-9]{1,6}/i);
  const markers = markerLine.match(MARKER_RE) || [];
  for (const marker of markers) {
    rows.push(makeRow('marker', 'MARKERS', compactText(marker).replace(/\s+/g, ''), markerLine, 0));
  }
  if (markerLine && !markers.length) rows.push(makeRow('marker', 'MARKERS', '', markerLine, 0));

  const coverLine = findLine(lines, /minimum\s+cover/i) || findLine(lines, /\b\d+(?:[.,]\d+)?\s*M\b/i);
  const covers = coverLine.match(COVER_RE) || [];
  for (const cover of covers) {
    rows.push(makeRow('range-value', 'MINIMUM COVER', compactText(cover), coverLine, 0));
  }
  if (coverLine && !covers.length) rows.push(makeRow('range-value', 'MINIMUM COVER', '', coverLine, 0));

  const crossingLine = findLine(lines, /crossing|WDX/i);
  if (/\bWDX\b/i.test(crossingLine)) rows.push(makeRow('point-label', 'CROSSING', 'WDX', crossingLine, 0));
  if (crossingLine && !/\bWDX\b/i.test(crossingLine)) rows.push(makeRow('point-label', 'CROSSING', '', crossingLine, 0));

  const provisionLine = findLine(lines, /special\s+provision|note\s*-\s*\d+/i);
  const provision = normalizeNoteToken(provisionLine);
  if (provision) rows.push(makeRow('point-label', 'SPECIAL PROVISION', provision, provisionLine, 0));

  return { rows, lengths };
}

function positionedWordBounds(words) {
  const positioned = (Array.isArray(words) ? words : []).filter((word) =>
    Number.isFinite(word?.x0) && Number.isFinite(word?.x1),
  );
  if (positioned.length < 2) return null;
  return {
    minX: Math.min(...positioned.map((word) => word.x0)),
    maxX: Math.max(...positioned.map((word) => word.x1)),
  };
}

function horizontalFromX(x, bounds, axisStart, axisEnd) {
  if (!bounds || axisEnd == null || bounds.maxX <= bounds.minX) return '';
  const ratio = (x - bounds.minX) / (bounds.maxX - bounds.minX);
  const value = axisStart + ratio * (axisEnd - axisStart);
  return Math.round(value * 1000) / 1000;
}

function applyWordPositions(rows, words, axisStart, axisEnd) {
  const bounds = positionedWordBounds(words);
  if (!bounds || axisEnd == null) return;
  for (const row of rows) {
    if (!['marker', 'point-label'].includes(row.type)) continue;
    const match = words.find((word) => compactText(word.text).replace(/\s+/g, '').toUpperCase() === row.value.toUpperCase());
    if (!match) continue;
    row.horizontal = horizontalFromX((match.x0 + match.x1) / 2, bounds, axisStart, axisEnd);
    row.confidence = match.confidence;
  }
}

/**
 * Parses OCR output from the construction/pipe-details info block into a
 * reviewable Table X shape. Segment lengths are converted to cumulative
 * start/end limits; marker positions are estimated only when word boxes and
 * an axis end are available.
 * @param {{ words?: Array, text?: string, axisStart?: string|number, axisEnd?: string|number }} input
 * @returns {{ rows: Array, warnings: Array<{ code: string, message: string }> }}
 */
export function parseTableXOcr(input) {
  const { axisStart, axisEnd } = normalizeOptions(input);
  const { rows, lengths } = collectTextRows(input?.text || '');
  const resolvedAxisEnd = axisEnd == null && lengths.length
    ? axisStart + lengths.reduce((sum, length) => sum + length, 0)
    : axisEnd;
  applyWordPositions(rows, input?.words || [], axisStart, resolvedAxisEnd);

  const warnings = [
    { code: 'tablex_review_required', message: 'Table X is OCR reference data only. Review all rows before use.' },
  ];
  if (resolvedAxisEnd == null) {
    warnings.push({ code: 'tablex_axis_missing', message: 'Marker and crossing distances need axis start/end calibration or positioned OCR words.' });
  }
  if (!rows.length) {
    warnings.push({ code: 'tablex_no_rows', message: 'No known Table X row types were detected from OCR text.' });
  }
  return { rows, warnings };
}

export const _internal = Object.freeze({ collectTextRows, extractHorizontalLengthValues });

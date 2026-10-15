// Pure Table 2 OCR reconstruction for the Pipeline 3D Model utility.
// Input: positioned OCR words from pipeline-3d-model-ocr.js and explicit
// parser options. Output: reviewed-ready rows with parsed horizontal/elevation
// values plus raw OCR text. Fallback: uncertainty raises a structured Error.

const DEFAULT_MIN_CONFIDENCE = 45;
const ROW_GAP_HEIGHT_FACTOR = 2;
const DECIMAL_NUMBER_RE = /^-?\d+(?:[.,]\d+)?$/;

/**
 * @typedef {Object} OcrWord
 * @property {string} text
 * @property {number} x0
 * @property {number} y0
 * @property {number} x1
 * @property {number} y1
 * @property {number} confidence
 */

/**
 * @typedef {Object} ParsedTable2OcrRow
 * @property {number} horizontal
 * @property {number} elevation
 * @property {string} rawStationText
 * @property {string} rawElevationText
 * @property {number} confidence
 */

function normalizeParserOptions(options) {
  const minConfidence = Number(options?.minConfidence);
  const layout = options?.layout === 'columns' ? 'columns' : 'rows';
  return {
    minConfidence: Number.isFinite(minConfidence) ? minConfidence : DEFAULT_MIN_CONFIDENCE,
    layout,
  };
}

function makeTable2OcrError(code, message, details) {
  const error = new Error(message);
  error.name = 'Table2OcrParseError';
  error.code = code;
  error.details = details;
  return error;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeWord(word) {
  const x0 = toFiniteNumber(word?.x0 ?? word?.bbox?.x0);
  const y0 = toFiniteNumber(word?.y0 ?? word?.bbox?.y0);
  const x1 = toFiniteNumber(word?.x1 ?? word?.bbox?.x1);
  const y1 = toFiniteNumber(word?.y1 ?? word?.bbox?.y1);
  const confidence = toFiniteNumber(word?.confidence);
  const text = String(word?.text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text || x0 == null || y0 == null || x1 == null || y1 == null) return null;
  return {
    ...word,
    text,
    x0,
    y0,
    x1,
    y1,
    confidence: confidence == null ? 0 : confidence,
    xCenter: (x0 + x1) / 2,
    yCenter: (y0 + y1) / 2,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

function splitWordsIntoRowBands(words) {
  const sorted = [...words].sort((a, b) => a.yCenter - b.yCenter);
  if (sorted.length < 2) {
    throw makeTable2OcrError('ocr_table2_too_few_words', 'OCR did not return enough positioned words to find two Table 2 rows.', {
      recognizedTokens: sorted.map((word) => word.text),
    });
  }

  let largestGap = -Infinity;
  let largestGapIndex = -1;
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].yCenter - sorted[index - 1].yCenter;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index - 1;
    }
  }

  const medianHeight = median(sorted.map((word) => word.height));
  const minimumDistinctGap = Math.max(1, medianHeight * ROW_GAP_HEIGHT_FACTOR);
  if (largestGap < minimumDistinctGap) {
    throw makeTable2OcrError('ocr_table2_rows_not_distinct', 'Could not find two distinct OCR row bands for Table 2.', {
      largestGap,
      medianHeight,
      recognizedTokens: sorted.map((word) => word.text),
    });
  }

  const splitIndex = largestGapIndex + 1;
  const topBand = sorted.slice(0, splitIndex).sort((a, b) => a.xCenter - b.xCenter);
  const bottomBand = sorted.slice(splitIndex).sort((a, b) => a.xCenter - b.xCenter);
  if (!topBand.length || !bottomBand.length) {
    throw makeTable2OcrError('ocr_table2_empty_row_band', 'OCR row splitting produced an empty Table 2 row band.', {
      recognizedTokens: sorted.map((word) => word.text),
    });
  }

  return { topBand, bottomBand };
}

function splitWordsIntoColumnBands(words) {
  const sorted = [...words].sort((a, b) => a.xCenter - b.xCenter);
  if (sorted.length < 2) {
    throw makeTable2OcrError('ocr_table2_too_few_words', 'OCR did not return enough positioned words to find two Table 2 columns.', {
      recognizedTokens: sorted.map((word) => word.text),
    });
  }

  let largestGap = -Infinity;
  let largestGapIndex = -1;
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].xCenter - sorted[index - 1].xCenter;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index - 1;
    }
  }

  const medianHeight = median(sorted.map((word) => word.height));
  const minimumDistinctGap = Math.max(1, medianHeight * ROW_GAP_HEIGHT_FACTOR);
  if (largestGap < minimumDistinctGap) {
    throw makeTable2OcrError('ocr_table2_columns_not_distinct', 'Could not find two distinct OCR column bands for rotated Table 2 text.', {
      largestGap,
      medianHeight,
      recognizedTokens: sorted.map((word) => word.text),
    });
  }

  const splitIndex = largestGapIndex + 1;
  const leftBand = sorted.slice(0, splitIndex).sort((a, b) => a.yCenter - b.yCenter);
  const rightBand = sorted.slice(splitIndex).sort((a, b) => a.yCenter - b.yCenter);
  if (!leftBand.length || !rightBand.length) {
    throw makeTable2OcrError('ocr_table2_empty_column_band', 'OCR column splitting produced an empty rotated Table 2 column band.', {
      recognizedTokens: sorted.map((word) => word.text),
    });
  }

  return { leftBand, rightBand };
}

function compactTokenText(text) {
  return String(text ?? '').normalize('NFKC').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
}

function parseElevationText(text) {
  const compact = compactTokenText(text).replace(/\s+/g, '');
  if (!DECIMAL_NUMBER_RE.test(compact)) return null;
  const value = Number(compact);
  return Number.isFinite(value) ? value : null;
}

function parseSeparatedStationText(text) {
  const match = compactTokenText(text).match(/^(\d+)\s*[+*-]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const meterText = match[2];
  const meterValue = meterText.includes('.') ? Number(meterText) : parseCompactMeterText(meterText);
  return Number(match[1]) * 1000 + meterValue;
}

function parseWhitespaceStationText(text) {
  const match = compactTokenText(text).match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const meterText = match[2];
  const meterValue = meterText.includes('.') ? Number(meterText) : parseCompactMeterText(meterText);
  return Number(match[1]) * 1000 + meterValue;
}

function parseCompactMeterText(meterText) {
  const compact = String(meterText || '').replace(/\D/g, '');
  if (compact.length === 4) return Number(compact) / 10;
  return Number(compact);
}

function parseCompactStationText(text) {
  const compact = compactTokenText(text).replace(/\s+/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(compact)) return null;
  const [integerPart, decimalPart] = compact.split('.');
  if (integerPart.startsWith('0') && integerPart.length > 3) {
    if (decimalPart != null) return Number(`${integerPart.slice(-3)}.${decimalPart}`);
    return Number(integerPart.slice(-4)) / 10;
  }
  if (integerPart.length <= 3) return Number(compact);
  const kmPart = integerPart.slice(0, -3) || '0';
  const meterIntegerPart = integerPart.slice(-3);
  const meterText = decimalPart == null ? meterIntegerPart : `${meterIntegerPart}.${decimalPart}`;
  return Number(kmPart) * 1000 + Number(meterText);
}

function parseStationText(text) {
  const parsed = parseSeparatedStationText(text) ?? parseWhitespaceStationText(text) ?? parseCompactStationText(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreStationTokenEvidence(text) {
  const normalized = compactTokenText(text);
  const compact = normalized.replace(/\s+/g, '');
  let score = 0;
  if (/^\d+\s*[+*-]\s*\d/.test(normalized)) score += 5;
  if (/^0\d{3,}(?:\.\d+)?$/.test(compact)) score += 3;
  if (/^\d+\s+\d/.test(normalized)) score += 2;
  const parsed = parseStationText(text);
  if (parsed != null && parsed >= 0 && parsed < 1000) score += 1;
  return score;
}

function scoreBandAsStation(words, minConfidence) {
  return words
    .filter((word) => word.confidence >= minConfidence)
    .reduce((score, word) => score + scoreStationTokenEvidence(word.text), 0);
}

function scoreElevationTokenEvidence(text) {
  const parsed = parseElevationText(text);
  if (parsed == null) return 0;
  if (parsed >= 200 && parsed <= 260) return 5;
  if (parsed >= 150 && parsed <= 350) return 2;
  return 1;
}

function scoreBandAsElevation(words, minConfidence) {
  return words
    .filter((word) => word.confidence >= minConfidence)
    .reduce((score, word) => score + scoreElevationTokenEvidence(word.text), 0);
}

function summarizeDroppedTokens(warnings, code, rowName, tokens) {
  if (!tokens.length) return;
  warnings.push({
    code,
    message: `Dropped ${tokens.length} ${rowName} OCR token(s): ${tokens.map((word) => word.text).join(', ')}`,
    tokens: tokens.map((word) => word.text),
  });
}

function filterBandTokens(words, rowName, parser, minConfidence, warnings, sortKey) {
  const lowConfidence = [];
  const invalid = [];
  const kept = [];

  for (const word of words) {
    if (word.confidence < minConfidence) {
      lowConfidence.push(word);
      continue;
    }
    if (parser(word.text) == null) {
      invalid.push(word);
      continue;
    }
    kept.push(word);
  }

  summarizeDroppedTokens(warnings, 'ocr_table2_low_confidence_tokens_dropped', rowName, lowConfidence);
  summarizeDroppedTokens(warnings, 'ocr_table2_invalid_tokens_dropped', rowName, invalid);
  return kept.sort((a, b) => a[sortKey] - b[sortKey]);
}

function rawTexts(words) {
  return words.map((word) => word.text);
}

function normalizeOcrDigitText(text) {
  return String(text || '').normalize('NFKC').replace(/[Oo]/g, '0').replace(/,/g, '.');
}

function findStationTextInLine(line) {
  const normalized = normalizeOcrDigitText(line);
  const separated = normalized.match(/\b\d\s*[+*-]\s*\d{2,4}(?:[.]\d+)?\b/);
  if (separated) return separated[0];
  const compact = normalized.match(/\b0\d{4}(?:[.]\d+)?\b/);
  return compact ? compact[0] : null;
}

function parseElevationCandidate(rawText) {
  const compact = normalizeOcrDigitText(rawText).replace(/[^\d.]/g, '');
  if (/^2[23]\d[.]\d{1,2}$/.test(compact)) return Number(compact);
  if (/^2[23]\d{3}$/.test(compact)) return Number(`${compact.slice(0, 3)}.${compact.slice(3)}`);
  if (/^3[01][.]\d{1,2}$/.test(compact)) return Number(`2${compact}`);
  if (/^3[01]\d{2}$/.test(compact)) return Number(`2${compact.slice(0, 2)}.${compact.slice(2)}`);
  return null;
}

function findElevationInLine(line, stationText) {
  const withoutStation = stationText ? normalizeOcrDigitText(line).replace(stationText, ' ') : normalizeOcrDigitText(line);
  const candidates = withoutStation.match(/[^\s|[\]]*[23]?\d{2}[.,]?\d{1,2}[^\s|[\]]*/g) || [];
  for (const candidate of candidates) {
    const value = parseElevationCandidate(candidate);
    if (value != null && value >= 200 && value <= 260) {
      return { rawText: candidate, value };
    }
  }
  return null;
}

/**
 * Fallback for Tesseract outputs that contain OCR text but no word boxes. It
 * only pairs a station and elevation found on the same OCR line, so missing
 * or split lines produce review warnings instead of shifted ordinal pairs.
 * @param {string} text
 * @returns {{ rows: ParsedTable2OcrRow[], warnings: Array<{ code: string, message: string, tokens?: string[] }> }}
 */
export function parseTable2OcrText(text) {
  const rows = [];
  const skippedStationLines = [];
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const stationText = findStationTextInLine(line);
    if (!stationText) continue;
    const horizontal = parseStationText(stationText);
    const elevation = findElevationInLine(line, stationText);
    if (horizontal == null || !elevation) {
      skippedStationLines.push(line);
      continue;
    }
    rows.push({
      horizontal,
      elevation: elevation.value,
      rawStationText: stationText,
      rawElevationText: elevation.rawText,
      confidence: 0,
    });
  }
  if (!rows.length) {
    throw makeTable2OcrError('ocr_table2_text_fallback_no_pairs', 'OCR text fallback could not find same-line station/elevation pairs.', {
      recognizedText: String(text || '').slice(0, 1000),
    });
  }
  rows.sort((a, b) => a.horizontal - b.horizontal);
  return {
    rows,
    warnings: [
      { code: 'ocr_table2_text_fallback_used', message: 'Parsed from OCR text because Tesseract did not return positioned words. Review every row before applying.' },
      ...(skippedStationLines.length ? [{
        code: 'ocr_table2_text_fallback_skipped_lines',
        message: `Skipped ${skippedStationLines.length} station line(s) without a same-line elevation value.`,
        tokens: skippedStationLines,
      }] : []),
    ],
  };
}

function buildRowsFromBands(elevationTokens, stationTokens) {
  const rows = elevationTokens.map((elevationToken, index) => {
    const stationToken = stationTokens[index];
    return {
      horizontal: parseStationText(stationToken.text),
      elevation: parseElevationText(elevationToken.text),
      rawStationText: stationToken.text,
      rawElevationText: elevationToken.text,
      confidence: Math.min(elevationToken.confidence, stationToken.confidence),
    };
  });
  return rows.sort((a, b) => a.horizontal - b.horizontal);
}

function parseRowLayout(normalizedWords, minConfidence, warnings) {
  const { topBand, bottomBand } = splitWordsIntoRowBands(normalizedWords);
  const topAsStation = scoreBandAsStation(topBand, minConfidence) + scoreBandAsElevation(bottomBand, minConfidence);
  const bottomAsStation = scoreBandAsStation(bottomBand, minConfidence) + scoreBandAsElevation(topBand, minConfidence);
  const rawStationBand = topAsStation > bottomAsStation ? topBand : bottomBand;
  const rawElevationBand = topAsStation > bottomAsStation ? bottomBand : topBand;
  return {
    rawElevationBand,
    rawStationBand,
    elevationTokens: filterBandTokens(rawElevationBand, 'elevation', parseElevationText, minConfidence, warnings, 'xCenter'),
    stationTokens: filterBandTokens(rawStationBand, 'station', parseStationText, minConfidence, warnings, 'xCenter'),
  };
}

function parseColumnLayout(normalizedWords, minConfidence, warnings) {
  const { leftBand, rightBand } = splitWordsIntoColumnBands(normalizedWords);
  const leftStationScore = scoreBandAsStation(leftBand, minConfidence);
  const rightStationScore = scoreBandAsStation(rightBand, minConfidence);
  if (leftStationScore === rightStationScore) {
    throw makeTable2OcrError('ocr_table2_column_type_ambiguous', 'Could not tell which rotated OCR column contains station labels.', {
      leftTokens: rawTexts(leftBand),
      rightTokens: rawTexts(rightBand),
      leftStationScore,
      rightStationScore,
    });
  }

  const rawStationBand = leftStationScore > rightStationScore ? leftBand : rightBand;
  const rawElevationBand = leftStationScore > rightStationScore ? rightBand : leftBand;
  return {
    rawElevationBand,
    rawStationBand,
    elevationTokens: filterBandTokens(rawElevationBand, 'elevation', parseElevationText, minConfidence, warnings, 'yCenter'),
    stationTokens: filterBandTokens(rawStationBand, 'station', parseStationText, minConfidence, warnings, 'yCenter'),
  };
}

/**
 * Reconstructs a two-row transposed Table 2 image into horizontal/elevation
 * rows. Row/column bands are classified as station vs grade elevation before
 * ordinal pairing, so upright, upside-down, and rotated captures are reviewed
 * through the same output table.
 * @param {OcrWord[]} words
 * @param {{ minConfidence?: number, layout?: 'rows' | 'columns' }} options
 * @returns {{ rows: ParsedTable2OcrRow[], warnings: Array<{ code: string, message: string, tokens?: string[] }> }}
 */
export function parseTable2OcrWords(words, options) {
  const { minConfidence, layout } = normalizeParserOptions(options);
  const normalizedWords = (Array.isArray(words) ? words : []).map(normalizeWord).filter(Boolean);
  const warnings = [];
  const parsedBands = layout === 'columns'
    ? parseColumnLayout(normalizedWords, minConfidence, warnings)
    : parseRowLayout(normalizedWords, minConfidence, warnings);
  const { elevationTokens, stationTokens, rawElevationBand, rawStationBand } = parsedBands;

  if (elevationTokens.length !== stationTokens.length) {
    throw makeTable2OcrError(
      'ocr_table2_row_count_mismatch',
      `Recognized ${elevationTokens.length} elevation value(s) but ${stationTokens.length} station label(s).`,
      {
        rawElevationTokens: rawTexts(rawElevationBand),
        rawStationTokens: rawTexts(rawStationBand),
        filteredElevationTokens: rawTexts(elevationTokens),
        filteredStationTokens: rawTexts(stationTokens),
        layout,
        warnings,
      },
    );
  }

  if (!elevationTokens.length) {
    throw makeTable2OcrError('ocr_table2_no_rows', 'No usable Table 2 OCR rows remained after confidence and token filtering.', {
      rawElevationTokens: rawTexts(rawElevationBand),
      rawStationTokens: rawTexts(rawStationBand),
      layout,
      warnings,
    });
  }

  const rows = buildRowsFromBands(elevationTokens, stationTokens);

  return { rows, warnings };
}

export const _internal = Object.freeze({ findElevationInLine, findStationTextInLine, parseElevationText, parseStationText, splitWordsIntoColumnBands, splitWordsIntoRowBands });

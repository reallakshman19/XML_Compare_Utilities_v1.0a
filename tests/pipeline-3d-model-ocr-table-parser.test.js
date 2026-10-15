import assert from 'node:assert/strict';
import { parseTable2OcrText, parseTable2OcrWords } from '../tabs/pipeline-3d-model/pipeline-3d-model-ocr-table-parser.js';

function makeWord(text, x0, y0, width, height, confidence) {
  return {
    text,
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height,
    confidence,
  };
}

function makeTableWords(stationTexts, elevationTexts) {
  const words = [];
  elevationTexts.forEach((text, index) => {
    words.push(makeWord(text, 20 + index * 80, 10, 42, 10, 92));
  });
  stationTexts.forEach((text, index) => {
    words.push(makeWord(text, 10 + index * 80, 52, 64, 10, 91));
  });
  return words;
}

function assertThrowsCode(fn, code) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, `Expected ${code} to be thrown`);
  assert.equal(thrown.code, code);
  return thrown;
}

const parsed = parseTable2OcrWords([
  ...makeTableWords(['0+000.0', '0+006.7', '0+019.0'], ['231.32', '230.95', '230.82']),
  makeWord('grid', 1, 12, 10, 8, 88),
  makeWord('999.99', 300, 10, 44, 10, 20),
], { minConfidence: 45 });

assert.deepEqual(
  parsed.rows.map((row) => ({ horizontal: row.horizontal, elevation: row.elevation })),
  [
    { horizontal: 0, elevation: 231.32 },
    { horizontal: 6.7, elevation: 230.95 },
    { horizontal: 19, elevation: 230.82 },
  ],
);
assert.equal(parsed.rows[0].rawStationText, '0+000.0');
assert.ok(parsed.warnings.some((warning) => warning.code === 'ocr_table2_invalid_tokens_dropped'));
assert.ok(parsed.warnings.some((warning) => warning.code === 'ocr_table2_low_confidence_tokens_dropped'));

const cleaned = parseTable2OcrWords(
  makeTableWords(['0+000.0', '0019,0'], ['231,32', '230,82']),
  { minConfidence: 45 },
);
assert.deepEqual(
  cleaned.rows.map((row) => ({ horizontal: row.horizontal, elevation: row.elevation })),
  [
    { horizontal: 0, elevation: 231.32 },
    { horizontal: 19, elevation: 230.82 },
  ],
);

const rotatedColumns = parseTable2OcrWords([
  makeWord('0+000.0', 10, 20, 64, 10, 91),
  makeWord('0+006.7', 10, 100, 64, 10, 91),
  makeWord('0+019.0', 10, 180, 64, 10, 91),
  makeWord('231.32', 110, 20, 42, 10, 92),
  makeWord('230.95', 110, 100, 42, 10, 92),
  makeWord('230.82', 110, 180, 42, 10, 92),
], { minConfidence: 45, layout: 'columns' });
assert.deepEqual(
  rotatedColumns.rows.map((row) => ({ horizontal: row.horizontal, elevation: row.elevation })),
  [
    { horizontal: 0, elevation: 231.32 },
    { horizontal: 6.7, elevation: 230.95 },
    { horizontal: 19, elevation: 230.82 },
  ],
);

const textFallback = parseTable2OcrText(`0+019.0 [230.82
0+1051 [23168
0+312.6 [231.18
04404.3 [23275
0+000.0 station only`);
assert.deepEqual(
  textFallback.rows.map((row) => ({ horizontal: row.horizontal, elevation: row.elevation })),
  [
    { horizontal: 19, elevation: 230.82 },
    { horizontal: 105.1, elevation: 231.68 },
    { horizontal: 312.6, elevation: 231.18 },
    { horizontal: 404.3, elevation: 232.75 },
  ],
);
assert.ok(textFallback.warnings.some((warning) => warning.code === 'ocr_table2_text_fallback_used'));
assert.ok(textFallback.warnings.some((warning) => warning.code === 'ocr_table2_text_fallback_skipped_lines'));

const mismatchError = assertThrowsCode(
  () => parseTable2OcrWords(makeTableWords(['0+000.0'], ['231.32', '230.95']), { minConfidence: 45 }),
  'ocr_table2_row_count_mismatch',
);
assert.deepEqual(mismatchError.details.filteredElevationTokens, ['231.32', '230.95']);
assert.deepEqual(mismatchError.details.filteredStationTokens, ['0+000.0']);

assertThrowsCode(
  () => parseTable2OcrWords([
    makeWord('231.32', 20, 10, 42, 10, 93),
    makeWord('0+000.0', 10, 12, 64, 10, 93),
  ], { minConfidence: 45 }),
  'ocr_table2_rows_not_distinct',
);

console.log('pipeline-3d-model-ocr-table-parser tests passed');

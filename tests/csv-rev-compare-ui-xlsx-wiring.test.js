import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('CSV Rev Compare UI routes XLSX through workbook ingress instead of file.text()', async () => {
  const source = await readFile(new URL('../tabs/csv-rev-compare/csv-rev-compare-tab.js', import.meta.url), 'utf8');
  assert.match(source, /readSupportRevisionFile/);
  assert.match(source, /\.xlsx/);
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.doesNotMatch(source, /textarea\.value\s*=\s*await\s+file\.text\(\)/);
  assert.match(source, /Loaded \$\{file\.name\}: \$\{loaded\.sheetName\}/);
});

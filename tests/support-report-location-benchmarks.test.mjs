import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js?v=20260910-support-report-location-17';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?v=20260910-support-report-json-trace-18&rca=20260910-bore-site-zone-19';
import { SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK } from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js?v=20260910-support-report-location-17';

const ps12154Xml = readFileSync('benchmarks/SupportreportXML-PS-068_PS-12154.xml', 'utf8');
const ps12120Xml = readFileSync('benchmarks/SupportreportXML-PS-12120.xml', 'utf8');
const xml1885 = readZipTextEntry('benchmarks/1885.zip', '1885.xml');
const SAME_LOCATION_PIPE = 'ASIM-1885-2"-D8810003-11441T3-PP-01';
const MULTI_LOCATION_PIPE = 'ASIM-1885-2"-P8810365-31441C4-HT-01';
const SECOND_MULTI_LOCATION_PIPE = 'ASIM-1885-4"-W8810126-31441C4-01';

test('PS-12154 REST/GUIDE pair stays one report location while retaining multiple-primary-support family remark', () => {
  const parsed = parseSupportReportClashXml(ps12154Xml);
  const groups = parsed.groups.filter((group) => group.fullLineTag === SAME_LOCATION_PIPE);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].primarySupportMemberIds, ['/PS-12154.2', '/PS-12154.5']);
  assert.equal(groups[0].locationCountOnPipe, 1);
  assert.equal(groups[0].multipleLocationsOnPipe, false);
  assert.equal(groups[0].locationMergeToleranceMm, 50);

  const report = buildSupportReportBundle({ clashEvidence: parsed });
  const row = report.rows.find((item) => item.pipe === SAME_LOCATION_PIPE);
  assert.ok(row);
  assert.equal(row.pipingPrimarySupport, '/PS-12154.2, /PS-12154.5');
  assert.equal(row.remarks, SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK);
  assert.equal(row.primarySupportSite, 'ASIM-1885-CU-PI');
  assert.equal(row.primarySupportZone, 'ASIM-1885-CU-PI-D');
});

test('all PS-12154 rows recover discipline-neutral CU-PI Site/Zone', () => {
  const report = buildSupportReportBundle({ clashXmlText: ps12154Xml });
  const rows = report.rows.filter((row) => row.civilSecondarySupport === 'PS-12154(REF)');
  assert.equal(rows.length, 6);
  assert.ok(rows.every((row) => row.primarySupportSite === 'ASIM-1885-CU-PI'));
  assert.ok(rows.every((row) => row.primarySupportZone.startsWith('ASIM-1885-CU-PI-')));
  const sameLocation = rows.find((row) => row.pipe === SAME_LOCATION_PIPE);
  assert.ok(sameLocation);
  assert.equal(sameLocation.remarks, SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK);
});

test('PS-12120 full benchmark produces all location-aware report rows across all pipes', () => {
  const parsed = parseSupportReportClashXml(ps12120Xml);
  assert.equal(parsed.rows.length, 19);
  const report = buildSupportReportBundle({ clashEvidence: parsed });
  assert.equal(report.summary.clashEvidenceCount, 19);
  assert.equal(report.summary.reportRowCount, 14);
  assert.equal(new Set(report.rows.map((row) => row.pipe)).size, 9);
  assert.ok(report.rows.every((row) => row.totalSupportPointsOnSecondary === 14));

  const repeated = report.rows.filter((row) => row.pipe === MULTI_LOCATION_PIPE);
  assert.equal(repeated.length, 5);
  assert.ok(repeated.every((row) => row.remarks === SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK));

  const secondRepeated = report.rows.filter((row) => row.pipe === SECOND_MULTI_LOCATION_PIPE);
  assert.equal(secondRepeated.length, 2);
  assert.ok(secondRepeated.every((row) => row.remarks === SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK));

  const singleLocationRows = report.rows.filter((row) => ![MULTI_LOCATION_PIPE, SECOND_MULTI_LOCATION_PIPE].includes(row.pipe));
  assert.equal(singleLocationRows.length, 7);
  assert.ok(singleLocationRows.every((row) => row.remarks === SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK));
  assert.ok(singleLocationRows.every((row) => !row.evidence.multipleLocationsOnPipe));
  assert.equal(report.summary.multiLocationRowCount, 7);
});

test('PS-12120 repeated pipe splits into five physical report locations', () => {
  const parsed = parseSupportReportClashXml(ps12120Xml);
  const groups = parsed.groups.filter((group) => group.fullLineTag === MULTI_LOCATION_PIPE);
  assert.equal(groups.length, 5);
  assert.ok(groups.every((group) => group.locationCountOnPipe === 5));
  assert.ok(groups.every((group) => group.multipleLocationsOnPipe));
  assert.ok(groups.every((group) => group.locationMergeToleranceMm === 50));

  const report = buildSupportReportBundle({ clashEvidence: parsed });
  const rows = report.rows.filter((row) => row.pipe === MULTI_LOCATION_PIPE);
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.remarks === SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK));
  assert.ok(rows.every((row) => row.evidence.multipleLocationsOnPipe));
});

test('1885 assembly-count projection preserves owner support counts after raw location grouping', () => {
  const parsed = parseSupportReportClashXml(xml1885);
  const report = buildSupportReportBundle({ clashEvidence: parsed });
  const expectedCounts = new Map([
    ['PS-12060', 1],
    ['PS-12877', 4],
    ['PS-12860', 6],
    ['PS-12120', 14],
  ]);

  for (const [familyId, expectedCount] of expectedCounts) {
    const summary = report.primarySupportFamilySummaries.find((item) => familyToken(item.familyId) === familyId);
    assert.ok(summary, `${familyId} primary-support count summary`);
    assert.equal(summary.totalSupportPointsOnSecondary, expectedCount, `${familyId} owner support count`);

    const rows = report.rows.filter((row) => familyToken(row.civilSecondarySupport) === familyId);
    assert.ok(rows.length > 0, `${familyId} report rows`);
    assert.ok(rows.every((row) => row.totalSupportPointsOnSecondary === expectedCount),
      `${familyId} projected owner support count`);
  }

  const rawPs12877Groups = parsed.groups.filter((group) => familyToken(group.secondarySupportFamilyId) === 'PS-12877');
  assert.equal(rawPs12877Groups.length, 5, 'PS-12877 raw geometry groups remain auditable before assembly recovery');
  const ps12877Summary = report.primarySupportFamilySummaries.find((item) => familyToken(item.familyId) === 'PS-12877');
  assert.equal(ps12877Summary.legacyGeometryCount, 5);
  assert.equal(ps12877Summary.countBasis, 'GEOMETRY_ORPHAN_RECOVERY');
  assert.equal(ps12877Summary.totalSupportPointsOnSecondary, 4);
});

test('PS-068 family mismatch remains visible and is not silently renamed', () => {
  const report = buildSupportReportBundle({ clashXmlText: ps12154Xml });
  const row = report.rows.find((item) => item.pipingPrimarySupport === '/SL-147.1');
  assert.ok(row);
  assert.match(row.remarks, /Primary support family mismatch: \/SL-147\.1 under PS-068; rename required/);
  assert.equal(row.previousName, '');
});

function familyToken(value) {
  return String(value || '').replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
}

function readZipTextEntry(path, entryName) {
  const zip = readFileSync(path);
  const eocd = findSignatureFromEnd(zip, 0x06054b50);
  assert.notEqual(eocd, -1, `${path} has no ZIP end-of-central-directory record`);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entryCount = zip.readUInt16LE(eocd + 10);

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50, `${path} has an invalid central-directory entry`);
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const fileNameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localHeaderOffset = zip.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const name = zip.subarray(nameStart, nameStart + fileNameLength).toString('utf8');

    if (name === entryName) {
      assert.equal(zip.readUInt32LE(localHeaderOffset), 0x04034b50, `${entryName} has an invalid local ZIP header`);
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed.toString('utf8');
      if (method === 8) return inflateRawSync(compressed).toString('utf8');
      throw new Error(`Unsupported ZIP compression method ${method} for ${entryName}`);
    }

    cursor = nameStart + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`${entryName} not found in ${path}`);
}

function findSignatureFromEnd(buffer, signature) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 0x10016); offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}

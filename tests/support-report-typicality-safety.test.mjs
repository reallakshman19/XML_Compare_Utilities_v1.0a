import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';

function clashObject(nodes, itemName) {
  return `<clashobject><pathlink>${nodes.map((node) => `<node>${node}</node>`).join('')}</pathlink><smarttags><smarttag><name>Item Name</name><value>${itemName}</value></smarttag></smarttags></clashobject>`;
}

function result(name, objects) {
  return `<clashresult name="${name}" guid="${name}-GUID"><clashobjects>${objects.join('')}</clashobjects></clashresult>`;
}

const pipeObject = clashObject(
  ['/ASIM-CU-PL', '/ASIM-1885-2"-P8810365-31441C4-HT-01', '/ASIM-1885-2"-P8810365-31441C4-HT-01/B1', '/PS-007.1'],
  '/PS-007.1',
);
const secondary = clashObject(['/ASIM-CU-SU', '/PS-007'], 'GENSEC of /PS-007');
const sl12841 = clashObject(['/ASIM-CU-SU', '/SL-12841'], 'GENSEC of /SL-12841');
const ps12050 = clashObject(['/ASIM-CU-SU', '/PS-12050'], 'GENSEC of /PS-12050');

test('non-pipe PS/SL-vs-PS/SL clashes are skipped as out-of-domain evidence, not promoted to fatal family conflicts', () => {
  const xml = `<exchange units="m"><clashtest name="Mixed">${result('SupportVsSupport', [sl12841, ps12050])}${result('UsablePipeSupport', [pipeObject, secondary])}</clashtest></exchange>`;
  const parsed = parseSupportReportClashXml(xml);

  assert.equal(parsed.rowCount, 1);
  assert.equal(parsed.rows[0].clashName, 'UsablePipeSupport');
  assert.ok(parsed.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_MISSING_PIPE_SIDE' && item.severity === 'WARN'));
  assert.equal(parsed.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_CONFLICTING_SECONDARY_FAMILY'), false);
});

test('one pipe side with multiple secondary PS/SL roots remains fail-closed', () => {
  const xml = `<exchange units="m"><clashtest name="Unsafe">${result('TrueSecondaryConflict', [pipeObject, sl12841, ps12050])}</clashtest></exchange>`;
  const parsed = parseSupportReportClashXml(xml);

  assert.equal(parsed.rowCount, 0);
  const conflict = parsed.diagnostics.find((item) => item.code === 'SUPPORT_REPORT_CONFLICTING_SECONDARY_FAMILY');
  assert.ok(conflict);
  assert.equal(conflict.severity, 'ERROR');
  assert.deepEqual(conflict.secondaryFamilies, ['SL-12841', 'PS-12050']);
});

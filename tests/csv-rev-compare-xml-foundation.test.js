import assert from 'node:assert/strict';

import { convertSupportRevisionPair, convertSupportRevisionTable } from '../tabs/csv-rev-compare/support-revision-pipeline.js';

const HEADERS = [
  'PREV NAME', 'SCOPE', 'CIVILSECONDARYSUPPORT', 'PIPE', 'SIZE',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION', 'TOTAL SUPPORT POINTS ON SECONDARY',
  'REMARKS (IF ANY)', 'PRIMARY SUPPORT DESCRIPTION', 'PRIMARY SUPPORT ZONE', 'PRIMARY SUPPORT SITE',
  'PIPE SCHEDULE', 'INSULATION', 'STRESS SYSTEM NUMBER', 'NODE NO', 'REVISION',
  'Fx', 'Fy', 'Fz', 'Fx', 'Fy', 'Fz',
];

function supportRow(overrides = {}) {
  const base = {
    'PREV NAME': 'PS02012', SCOPE: 'PL', CIVILSECONDARYSUPPORT: 'SL-212',
    PIPE: 'ASIM-1885-PL-4"-M8810130-02', SIZE: '4',
    'PIPING PRIMARY SUPPORT': '/SL-212.3, /SL-212.1, /SL-212.4, /SL-212.2',
    'SUPPORT TYPE': 'SHOE-250, REST-250, MDS/AT05-10-PMP, MDS/ST06.10-PMP',
    'PIPING PRIMARY SUPPORT REFERENCE': '=1006649755/3641, =1006657947/896, =1006649755/3642, =1006649755/4596',
    'EAST/WEST': 'E 1000', 'NORTH/SOUTH': 'N 2000', 'BOP ELEVATION': 'U 3000',
    'TOTAL SUPPORT POINTS ON SECONDARY': '4', 'REMARKS (IF ANY)': '',
    'PRIMARY SUPPORT DESCRIPTION': '', 'PRIMARY SUPPORT ZONE': '', 'PRIMARY SUPPORT SITE': '',
    'PIPE SCHEDULE': 'SCH40', INSULATION: 'NONE', 'STRESS SYSTEM NUMBER': 'SYS-1', NODE_NO: '10', REVISION: '1',
    'Fx#1': '100', 'Fy#1': '-13623', 'Fz#1': '50', 'Fx#2': '5', 'Fy#2': '-11594', 'Fz#2': '8',
  };
  const values = { ...base, ...overrides };
  const ordinals = new Map();
  return HEADERS.map((header) => {
    const ordinal = (ordinals.get(header) || 0) + 1;
    ordinals.set(header, ordinal);
    const duplicateKey = `${header}#${ordinal}`;
    if (duplicateKey in values) return values[duplicateKey];
    if (header === 'NODE NO') return values.NODE_NO || '';
    return values[header] ?? '';
  });
}

function csv(headers, rows) {
  return [headers, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function nodes(conversion, levelId) {
  return conversion.graph.nodes.filter((node) => node.levelId === levelId);
}

// Existing parser owns CSV quoting and stable duplicate-column IDs all the way into XML.
{
  const conversion = convertSupportRevisionTable(csv(HEADERS, [supportRow()]));
  assert.equal(conversion.ok, true, JSON.stringify(conversion.validationResults, null, 2));
  assert.deepEqual(conversion.source.columnIds.slice(-6), ['Fx', 'Fy', 'Fz', 'Fx__2', 'Fy__2', 'Fz__2']);
  const loads = nodes(conversion, 'load');
  assert.equal(loads.length, 6);
  assert.equal(loads.find((node) => node.fields.columnId === 'Fy')?.fields.ordinal, 1);
  assert.equal(loads.find((node) => node.fields.columnId === 'Fy__2')?.fields.ordinal, 2);
  assert.equal(loads.find((node) => node.fields.columnId === 'Fy__2')?.fields.raw, '-11594');
  assert.match(conversion.exportResult.xmlText, /columnId="Fy__2"/);
  assert.match(conversion.exportResult.xmlText, /sourceCellRef="R1:1:Fy__2"/);
}

// Parallel support lists create aligned children and retain persistent references/member IDs.
{
  const conversion = convertSupportRevisionTable(csv(HEADERS, [supportRow()]));
  const components = nodes(conversion, 'primarySupport');
  assert.equal(components.length, 4);
  assert.equal(components[0].fields.memberId, '/SL-212.3');
  assert.equal(components[0].fields.supportType, 'SHOE-250');
  assert.equal(components[0].fields.reference, '=1006649755/3641');
  assert.equal(components[3].fields.reference, '=1006649755/4596');
}

// Unequal lists preserve longest evidence rather than truncating to shortest.
{
  const row = supportRow({
    'PIPING PRIMARY SUPPORT': '/SL-9.1, /SL-9.2',
    'SUPPORT TYPE': 'REST-50',
    'PIPING PRIMARY SUPPORT REFERENCE': '=9/1, =9/2, =9/3',
  });
  const conversion = convertSupportRevisionTable(csv(HEADERS, [row]));
  const components = nodes(conversion, 'primarySupport');
  assert.equal(components.length, 3);
  assert.equal(components[2].fields.reference, '=9/3');
  assert.equal(components[2].fields.memberId, '');
  assert.ok(conversion.graph.diagnostics.some((item) => item.code === 'many_per_row_parallel_list_length_mismatch'));
}

// Owner Support Report CIVIL header alias is accepted without changing the source parser.
{
  const aliasedHeaders = HEADERS.map((header) => header === 'CIVILSECONDARYSUPPORT'
    ? 'CIVILSECONDARYSUPPORT (GHTYPE-4PLOT/1885)'
    : header);
  const row = supportRow();
  const conversion = convertSupportRevisionTable(csv(aliasedHeaders, [row]));
  assert.equal(conversion.ok, true, JSON.stringify(conversion.validationResults, null, 2));
  assert.equal(nodes(conversion, 'supportLocation')[0].fields.civilSecondarySupport, 'SL-212');
}

// Missing both accepted secondary-support headers blocks export explicitly.
{
  const headers = HEADERS.filter((header) => header !== 'CIVILSECONDARYSUPPORT');
  const row = supportRow().filter((_, index) => HEADERS[index] !== 'CIVILSECONDARYSUPPORT');
  const conversion = convertSupportRevisionTable(csv(headers, [row]));
  assert.equal(conversion.ok, false);
  assert.ok(conversion.validationResults.some((item) => item.code === 'support_revision_secondary_support_column_missing'));
}

// REV1 and REV2 are converted independently through the same governed profile.
{
  const rev1 = csv(HEADERS, [supportRow({ REVISION: '1' })]);
  const rev2 = csv(HEADERS, [supportRow({ REVISION: '2', 'Fy#1': '-14000' })]);
  const pair = convertSupportRevisionPair(rev1, rev2);
  assert.equal(pair.ok, true);
  assert.equal(pair.rev1.source.sourceId, 'R1');
  assert.equal(pair.rev2.source.sourceId, 'R2');
  assert.equal(pair.rev1.graph.profileId, 'support-revision-csv-xml/v1');
  assert.equal(pair.rev2.graph.profileId, 'support-revision-csv-xml/v1');
  assert.notEqual(pair.rev1.graph, pair.rev2.graph);
}

console.log('csv-rev-compare XML foundation tests passed');

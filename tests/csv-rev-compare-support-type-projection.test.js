import assert from 'node:assert/strict';

import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';

const HEADERS = [
  'PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE',
  'PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY',
  'REMARKS (IF ANY)',
];

function row(overrides = {}) {
  const values = {
    'PREV NAME': 'PS-1', SCOPE: 'BWGA', CIVILSECONDARYSUPPORT: 'SL-TYPE(REF)',
    PIPE: 'BWGA-1000-2"-P100-01', SIZE: '50',
    'PIPING PRIMARY SUPPORT': '/SL-TYPE.1',
    'SUPPORT TYPE': 'REST-50',
    'PIPING PRIMARY SUPPORT REFERENCE': '=TYPE/1',
    'EAST/WEST': 'E 1000mm', 'NORTH/SOUTH': 'N 2000mm', 'BOP ELEVATION': 'U 3000mm',
    'TOTAL SUPPORT POINTS ON SECONDARY': '1', 'REMARKS (IF ANY)': '',
    ...overrides,
  };
  return HEADERS.map((header) => values[header] ?? '');
}

function csv(rows) {
  return [HEADERS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function targetRemark(result) {
  const index = result.output.headers.indexOf('REMARKS (IF ANY)');
  return result.output.rows.find((item) => item.disposition === 'REV2')?.values?.[index] || '';
}

// Same persistent component changes type: this is genuine Support Type Changes.
{
  const result = runSupportRevisionCompare(
    csv([row()]),
    csv([row({ 'SUPPORT TYPE': 'GUIDE-50', 'REMARKS (IF ANY)': 'ORACLE TEXT IS NOT EVIDENCE' })]),
  );
  assert.equal(result.exportReady, true);
  const typeEvent = result.ledger.events.find((event) => event.type === 'SUPPORT_COMPONENT_TYPE_CHANGED');
  assert.ok(typeEvent);
  assert.deepEqual(typeEvent.persistentReferences, ['=TYPE/1']);
  assert.equal(result.remarks.targetRemarks[typeEvent.targetCsvRowId].remark, 'Support Type Changes');
  assert.equal(targetRemark(result), 'Support Type Changes');
}

// Reference/component membership changes while surviving component types remain stable.
// Keep the typed structural SET event for graph/Phase4 attribution, but do not project it
// as a support-type remark.
{
  const source = row({
    'PIPING PRIMARY SUPPORT': '/SL-TYPE.1, /SL-TYPE.2',
    'SUPPORT TYPE': 'REST-50, BP-50',
    'PIPING PRIMARY SUPPORT REFERENCE': '=SET/1, =SET/2',
  });
  const target = row({
    'PIPING PRIMARY SUPPORT': '/SL-TYPE.1, /SL-TYPE.2, /SL-TYPE.3',
    'SUPPORT TYPE': 'REST-50, BP-50, GUIDE-50',
    'PIPING PRIMARY SUPPORT REFERENCE': '=SET/1, =SET/2, =SET/3',
    'REMARKS (IF ANY)': 'Support Type Changes',
  });
  const result = runSupportRevisionCompare(csv([source]), csv([target]));
  assert.equal(result.exportReady, true);
  assert.ok(result.ledger.events.some((event) => event.type === 'SUPPORT_COMPONENT_SET_CHANGED'));
  assert.equal(result.ledger.events.some((event) => event.type === 'SUPPORT_COMPONENT_TYPE_CHANGED'), false);
  assert.equal(result.remarks.targetRemarks[result.targetModel.locations[0].sourceRowId]?.tokens?.some((token) => token.key === 'SUPPORT_TYPE_CHANGES') || false, false);
  assert.equal(targetRemark(result), '');
}

console.log('csv-rev-compare support-type projection tests: PASS');
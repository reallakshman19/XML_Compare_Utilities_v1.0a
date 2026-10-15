import assert from 'node:assert/strict';

import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { SUPPORT_REV_LINE_IDENTITY_SHELL_EVENT } from '../tabs/csv-rev-compare/support-revision-line-identity-shell.js';

const HEADERS = [
  'PREV NAME', 'CIVILSECONDARYSUPPORT', 'PIPE', 'SIZE (BORE)',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION', 'REMARKS (IF ANY)',
];

function row({ prev = '', civil, pipe, size = '8"', members = '', types = '', refs = '', x = '', y = '', z = '', remarks = '' }) {
  return [prev, civil, pipe, size, members, types, refs, x, y, z, remarks];
}

function csv(rows) {
  return [HEADERS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function contextRow() {
  return row({
    civil: 'SL-CONTEXT', pipe: 'BWGA-1000-8"-CONTEXT-01',
    members: '/SL-CONTEXT.1', types: 'REST-200', refs: '=CTX/1',
    x: 'E 150000mm', y: 'N 90000mm', z: 'U 100000mm',
  });
}

function shellOutputRemark(result, shell) {
  const remarksIndex = result.output.headers.indexOf('REMARKS (IF ANY)');
  const outputRow = result.output.rows.find((item) => item.disposition === 'REV2' && item.sourceRowId === shell.sourceRowId);
  return outputRow?.values?.[remarksIndex] || '';
}

const oldPipe = '8"-P-1110XXX-METALLIC';
const newPipe = 'BWGA-1000-FL-8"-M1610003-(FL-07)';

// The old Civil+PIPE survives only as an identity-only target shell while an
// active same-Civil successor is deterministically linked through persistent
// references on a changed PIPE. The old shell receives the invalid-line token.
{
  const rev2 = csv([
    contextRow(),
    row({
      civil: 'SL-111001(REF)', pipe: oldPipe, size: '200',
      members: '/SL-111001.1,/SL-111001.2,/SL-111001.3',
      types: 'REST-200,GUIDE-200,LINE-STOP-200',
      refs: '=67133218/20,=67133218/21,=67141410/11',
      x: 'E 187110.232mm', y: 'N 103000.648mm', z: 'U 100656.05mm',
    }),
  ]);
  const rev3 = csv([
    contextRow(),
    row({
      civil: 'SL-111001(REF)', pipe: oldPipe, size: '200',
      remarks: 'ORACLE TEXT MUST NOT BE USED',
    }),
    row({
      prev: 'SL-111001.1', civil: 'SL-111001(REF)', pipe: newPipe, size: '200',
      members: '/SL-111001.1,/SL-111001.4,/SL-111001.3',
      types: 'REST-200,GUIDE-200,LINE-STOP-200',
      refs: '=67133218/20,=67133218/27,=67141410/11',
      x: 'E 187114mm', y: 'N 103001mm', z: 'U 100547mm',
    }),
  ]);

  const result = runSupportRevisionCompare(rev2, rev3);
  assert.equal(result.stage, 'READY_TO_EXPORT');
  const shell = result.targetModel.locations.find((location) => location.pipe.raw === oldPipe);
  const activeTarget = result.targetModel.locations.find((location) => location.pipe.raw === newPipe);
  assert.ok(shell && activeTarget);
  assert.equal(result.lineage.comparisonEligibility.ignoredTargetLocations.some((item) => item.nodeId === shell.nodeId && item.classification === 'IDENTITY_ONLY_SHELL'), true);

  const shellEvent = result.ledger.events.find((event) => event.type === SUPPORT_REV_LINE_IDENTITY_SHELL_EVENT);
  assert.ok(shellEvent);
  assert.equal(shellEvent.targetXmlNode, shell.nodeId);
  assert.equal(shellEvent.normalizedState.activeSuccessorTargetXmlNode, activeTarget.nodeId);
  assert.deepEqual(shellEvent.persistentReferences, ['=67133218/20', '=67141410/11']);
  assert.equal(result.remarks.targetRemarks[shell.sourceRowId].remark, 'Invalid (Line No. Changed)');
  assert.equal(shellOutputRemark(result, shell), 'Invalid (Line No. Changed)');

  const activeRemark = result.remarks.targetRemarks[activeTarget.sourceRowId]?.remark || '';
  assert.match(activeRemark, /Line No\. Change\(Old Line No\. 8"-P-1110XXX-METALLIC\)/);
}

// An identity-only shell plus oracle wording is insufficient without a proven
// active same-Civil line-change successor and persistent-reference continuity.
{
  const rev2 = csv([
    contextRow(),
    row({
      civil: 'SL-ORACLE-ONLY(REF)', pipe: oldPipe, size: '200',
      members: '/SL-ORACLE-ONLY.1', types: 'REST-200', refs: '=ORACLE/1',
      x: 'E 1000mm', y: 'N 2000mm', z: 'U 3000mm',
    }),
  ]);
  const rev3 = csv([
    contextRow(),
    row({
      civil: 'SL-ORACLE-ONLY(REF)', pipe: oldPipe, size: '200',
      remarks: 'Invalid (Line No. Changed)',
    }),
  ]);

  const result = runSupportRevisionCompare(rev2, rev3);
  const shell = result.targetModel.locations.find((location) => location.family === 'SL-ORACLE-ONLY(REF)');
  assert.ok(shell);
  assert.equal(result.ledger.events.some((event) => event.type === SUPPORT_REV_LINE_IDENTITY_SHELL_EVENT), false);
  assert.equal(result.remarks.targetRemarks[shell.sourceRowId]?.remark || '', '');
  assert.equal(shellOutputRemark(result, shell), '');
}

console.log('csv-rev-compare line-identity shell tests passed');
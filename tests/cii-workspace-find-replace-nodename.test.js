import assert from 'node:assert/strict';
import test from 'node:test';

import { CII_SIX_FIELD_WIDTHS } from '../parser/fixed-field.js';
import { createFindReplaceOperation, parseFindReplaceCsv } from '../tabs/cii-workspace/cii-workspace-find-replace-csv.js';
import { buildValidatedFindReplacePostimage } from '../tabs/cii-workspace/cii-workspace-find-replace-executor.js';
import { resolveFindReplaceScope } from '../tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js';
import {
  appendFindReplaceManualRow,
  createFindReplaceSession,
  withFindReplaceMode,
} from '../tabs/cii-workspace/cii-workspace-find-replace-session.js';
import { validateFindReplacePreimage } from '../tabs/cii-workspace/cii-workspace-find-replace-validator.js';

function row(values) {
  return CII_SIX_FIELD_WIDTHS.map((width, index) => String(values[index] ?? 0).padStart(width, ' ')).join('');
}

function elementBlock(from, to, nodeNamePointer = 0) {
  const rows = [
    row([from, to, 100, 0, 0, 114.3]),
    row([6.02, 25, 3, 0, 0, 0]),
    ...Array.from({ length: 10 }, () => row([0, 0, 0, 0, 0, 0])),
    row([0, 0, 0, 0, 0, 0]),
    row([0, 0, 0, 0, 0, nodeNamePointer]),
    row([0, 0, 0, 0, 0, 0]),
  ];
  assert.equal(rows.length, 15);
  return rows;
}

function nodeNameRow(fromName, toName) {
  return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`;
}

function fixture({ selectedPointer = 1, adjacentPointer = 0, controlCount = 1 } = {}) {
  const lines = [
    '#$ CONTROL',
    row([0, 0, 0, controlCount, 0, 0]),
    '#$ ELEMENTS',
    ...elementBlock(10, 20, selectedPointer),
    ...elementBlock(20, 30, adjacentPointer),
    '#$ NODENAME',
    nodeNameRow('', 'PS-12146'),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

test('Node Name intake canonicalizes user spelling and remains reviewable', () => {
  const operation = createFindReplaceOperation({
    from: 10, to: 20, block: 'Node Name', findText: 'PS-12146', replaceText: 'NODE-20030',
  }, 'BLOCK');
  assert.equal(operation.block, 'NODENAME');
  assert.equal(operation.status, 'PROPOSED');

  const csv = parseFindReplaceCsv(
    'From,To,Find Text,Replace Text,Block\n10,20,PS-12146,NODE-20030,NODE_NAME\n',
    'BLOCK',
  );
  assert.equal(csv.status, 'VALID');
  assert.equal(csv.operations[0].block, 'NODENAME');

  let session = createFindReplaceSession();
  session = withFindReplaceMode(session, 'BLOCK');
  session = appendFindReplaceManualRow(session, {
    from: 10, to: 20, block: 'node name', findText: 'PS-12146', replaceText: 'NODE-20030',
  });
  assert.equal(session.rows[0].block, 'NODENAME');
  assert.equal(session.rows[0].status, 'PROPOSED');
});

test('Node Name resolver binds exact fixed fields and validator emits one padded TARGET0 claim', () => {
  const target0 = fixture();
  const operation = {
    scope: 'BLOCK', block: 'NODENAME', from: 10, to: 20,
    findText: 'PS-12146', replaceText: 'NODE-20030', expectedMatches: 1, status: 'APPROVED',
  };
  const resolved = resolveFindReplaceScope(target0, operation);
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.authority, 'CII_V14_ELEMENT_NODENAME_POINTER_FIXED_FIELDS');
  assert.equal(resolved.evidence.pointer, 1);
  assert.deepEqual(resolved.spans.map((span) => span.fieldIdentity), ['NODENAME_FROM', 'NODENAME_TO']);
  assert.equal(resolved.spans[1].semanticValue, 'PS-12146');
  assert.deepEqual(resolved.spans[1].ownerNodeIds, ['20']);

  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'PASS');
  assert.equal(preimage.claims.length, 1);
  const claim = preimage.claims[0];
  assert.equal(claim.fieldIdentity, 'NODENAME_TO');
  assert.equal(claim.nodeId, '20');
  assert.equal(claim.before.length, 25);
  assert.equal(claim.after.length, 25);
  assert.equal(claim.before.trim(), 'PS-12146');
  assert.equal(claim.after.trim(), 'NODE-20030');

  const postimage = buildValidatedFindReplacePostimage(target0, preimage);
  assert.equal(postimage.status, 'QUALIFIED_POSTIMAGE');
  assert.equal(postimage.target1.length, target0.length);
  assert.equal(postimage.target1.slice(0, claim.start), target0.slice(0, claim.start));
  assert.equal(postimage.target1.slice(claim.end), target0.slice(claim.end));
});

test('Node Name ownership fails closed on pointer, CONTROL and distinct-node alias defects', () => {
  const noPointer = resolveFindReplaceScope(fixture({ selectedPointer: 0 }), {
    scope: 'BLOCK', block: 'NODENAME', from: 10, to: 20,
  });
  assert.equal(noPointer.status, 'BLOCKED');
  assert.ok(noPointer.blockers.includes('NODENAME_POINTER_REQUIRED:10:20'));

  const badCount = resolveFindReplaceScope(fixture({ controlCount: 2 }), {
    scope: 'BLOCK', block: 'NODENAME', from: 10, to: 20,
  });
  assert.equal(badCount.status, 'BLOCKED');
  assert.ok(badCount.blockers.includes('NODENAME_CONTROL_COUNT_MISMATCH:2:1'));

  const alias = validateFindReplacePreimage(fixture({ adjacentPointer: 1 }), [{
    scope: 'BLOCK', block: 'NODENAME', from: 10, to: 20,
    findText: 'PS-12146', replaceText: 'NODE-20030', status: 'APPROVED',
  }]);
  assert.equal(alias.status, 'FAIL');
  assert.ok(alias.blockers.some((item) => item.includes('NODENAME_FIELD_OWNER_AMBIGUOUS:1:TO')));
});

test('Node Name validation requires exact semantic match, ASCII and field-width fit', () => {
  const target0 = fixture();
  const base = { scope: 'BLOCK', block: 'NODENAME', from: 10, to: 20, status: 'APPROVED' };

  const substring = validateFindReplacePreimage(target0, [{ ...base, findText: '12146', replaceText: '20030' }]);
  assert.equal(substring.status, 'FAIL');
  assert.ok(substring.blockers.some((item) => item.includes('NO_MATCHES_IN_SCOPE')));

  const nonAscii = validateFindReplacePreimage(target0, [{ ...base, findText: 'PS-12146', replaceText: 'NØDE' }]);
  assert.equal(nonAscii.status, 'FAIL');
  assert.ok(nonAscii.blockers.some((item) => item.includes('NODENAME_ASCII_TEXT_REQUIRED')));

  const overflow = validateFindReplacePreimage(target0, [{ ...base, findText: 'PS-12146', replaceText: 'X'.repeat(26) }]);
  assert.equal(overflow.status, 'FAIL');
  assert.ok(overflow.blockers.some((item) => item.includes('NODENAME_REPLACEMENT_TOO_WIDE:26:25:NODENAME_TO')));
});

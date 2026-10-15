import assert from 'node:assert/strict';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY, buildCiiWriter2NodeNameRelocationPlan, _test } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';

function pointerField() { return Object.freeze({ qualified: true, width: 13, byteStart: 10, byteEnd: 23 }); }
function custody({ rowCount = 0, bindings = [], spans = {} } = {}) {
  return Object.freeze({ status: 'QUALIFIED', rowCount,
    byElementIndex: Object.freeze(Object.fromEntries(bindings.map((item, index) => [String(index), Object.freeze({ bindingAuthority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS', pointerField: pointerField(), ...item })]))),
    bySpan: Object.freeze(spans),
  });
}
function document({ c = custody(), nodeNames = {}, controlCount = 0, nodenameRows = [] } = {}) {
  const controlText = ['0', '0', '0', String(controlCount), '0', '0'].map((value, index) => String(value).padStart(index === 0 ? 15 : 13, ' ')).join('');
  const lines = [
    Object.freeze({ text: '#$ CONTROL', byteStart: 0 }), Object.freeze({ text: controlText, byteStart: 12 }),
    Object.freeze({ text: '#$ NODENAME', byteStart: 100 }),
    ...nodenameRows.map((text, index) => Object.freeze({ text, byteStart: 112 + index * 55 })),
    Object.freeze({ text: '#$ BEND', byteStart: 500 }),
  ];
  return Object.freeze({
    writer1CByteEligible: true, nodeNames: Object.freeze(nodeNames), nodeNameEvidence: Object.freeze({ physicalCustody: c }),
    physicalFile: Object.freeze({ lines: Object.freeze(lines) }),
  });
}
function op(id, action, nodeId, before, proposed, extra = {}) {
  return Object.freeze({ operationId: id, family: 'NODE_NAME', property: 'Node name / to-name', action,
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    targetEvidence: Object.freeze({ identity: String(nodeId) }), before, proposed, matchAuthority: Object.freeze({ status: 'REVIEWED' }), ...extra });
}
function run(targetDocument, targetGraph, operations) {
  return buildCiiWriter2NodeNameRelocationPlan({ targetDocument, targetGraph,
    transferPlan: Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze(operations), transferScope: Object.freeze({ status: 'BOUND' }) }) });
}
const blankToRow = _test.canonicalRow('P10', '');

// A blank existing redundant field alone is still Writer1C territory: Writer2 CREATE
// requires a separate exact zero-pointer owner proving a real cardinality append.
{
  const span = Object.freeze({ owners: Object.freeze([Object.freeze({ nodeId: '20', rowIndex: 0, end: 'TO', pointer: 1 })]) });
  const c = custody({ rowCount: 1, bindings: [{ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1 }], spans: { '120:145': span } });
  const result = run(document({ c, controlCount: 1, nodenameRows: [blankToRow] }), { edges: [{ parsedElementIndex: 0, from: 10, to: 20 }] }, [op('C', 'CREATE', 20, '', 'P20')]);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('WRITER_2_NODENAME_CREATE_ZERO_POINTER_OWNER_REQUIRED:20'));
}

// Mixed cardinality CREATE: the same node has an existing blank redundant field and
// an independent exact zero pointer. Writer2 may atomically fill the blank and append
// the new row; neither action exists without the cardinality proof.
{
  const span = Object.freeze({ owners: Object.freeze([Object.freeze({ nodeId: '20', rowIndex: 0, end: 'TO', pointer: 1 })]) });
  const c = custody({
    rowCount: 1,
    bindings: [
      { parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1 },
      { parsedElementIndex: 1, blockIndex: 1, from: '20', to: '30', pointer: 0 },
    ],
    spans: { '120:145': span },
  });
  const result = run(document({ c, controlCount: 1, nodenameRows: [blankToRow] }), { edges: [] }, [op('C', 'CREATE', 20, '', 'P20')]);
  assert.equal(result.ready, true, result.blockers.join('|'));
  assert.equal(result.rowCountBefore, 1);
  assert.equal(result.rowCountAfter, 2);
  assert.equal(result.redundantCreateClaims.length, 1);
  assert.equal(result.appendedRows.length, 1);
  assert.equal(result.appendedRows[0].fromName, 'P20');
  assert.equal(_test.rowField(result.finalRows[0].rowText, 'TO').trim(), 'P20');
  assert(result.pointerChanges.some((change) => change.parsedElementIndex === 1 && change.oldPointer === 0 && change.newPointer === 2));
}

// A nonblank existing field cannot be overwritten merely because another incident
// representation has a zero pointer.
{
  const row = _test.canonicalRow('', 'OLD20');
  const span = Object.freeze({ owners: Object.freeze([Object.freeze({ nodeId: '20', rowIndex: 0, end: 'TO', pointer: 1 })]) });
  const c = custody({
    rowCount: 1,
    bindings: [
      { parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1 },
      { parsedElementIndex: 1, blockIndex: 1, from: '20', to: '30', pointer: 0 },
    ],
    spans: { '120:145': span },
  });
  const result = run(document({ c, controlCount: 1, nodenameRows: [row] }), { edges: [] }, [op('C', 'CREATE', 20, '', 'P20')]);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('WRITER_2_NODENAME_CREATE_EXISTING_FIELD_USE_WRITER_1C:20'));
}

{
  const row = _test.canonicalRow('', 'D20');
  const span = Object.freeze({ owners: Object.freeze([
    Object.freeze({ nodeId: '20', rowIndex: 0, end: 'TO', pointer: 1 }),
    Object.freeze({ nodeId: '99', rowIndex: 0, end: 'TO', pointer: 1 }),
  ]) });
  const c = custody({ rowCount: 1, bindings: [{ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1 }], spans: { '120:145': span } });
  const result = run(document({ c, nodeNames: { 20: 'D20' }, controlCount: 1, nodenameRows: [row] }), { edges: [] }, [op('D', 'DELETE', 20, 'D20', '')]);
  assert.equal(result.ready, false);
  assert(result.blockers.some((item) => item.startsWith('WRITER_2_NODENAME_DELETE_UNAPPROVED_ALIAS')));
}

{
  const c = custody({ rowCount: 1 });
  const result = run(document({ c, controlCount: 2, nodenameRows: [blankToRow] }), { edges: [] }, [op('D', 'DELETE', 20, '', '')]);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('WRITER_2_NODENAME_CONTROL_COUNT_MISMATCH:2:1'));
}

{
  const c = custody({ rowCount: 0, bindings: [{ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 0 }] });
  const graph = { edges: [{ parsedElementIndex: 0, from: 10, to: 20 }] };
  const nonAscii = run(document({ c }), graph, [op('A', 'CREATE', 20, '', 'P-Δ')]);
  assert.equal(nonAscii.ready, false);
  assert(nonAscii.blockers.some((item) => item.includes('NON_ASCII')));
  const overflow = run(document({ c }), graph, [op('B', 'CREATE', 20, '', 'X'.repeat(26))]);
  assert.equal(overflow.ready, false);
  assert(overflow.blockers.some((item) => item.includes('WIDTH:26>25')));
}

{
  const c = custody({ rowCount: 0 });
  const other = Object.freeze({ operationId: 'P3', family: 'PROCESS', property: 'P3', action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY' });
  const result = run(document({ c }), { edges: [] }, [other]);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('WRITER_2_PHASE1_UNSUPPORTED_APPLY:P3'));
}

{
  const c = custody({ rowCount: 0, bindings: [{ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 0, pointerField: { qualified: false, width: 13 } }] });
  const result = run(document({ c }), { edges: [{ parsedElementIndex: 0, from: 10, to: 20 }] }, [op('C', 'CREATE', 20, '', 'P20')]);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('WRITER_2_NODENAME_POINTER_FIELD_CUSTODY_REQUIRED:0'));
}

{
  const c = custody({ rowCount: 0, bindings: [{ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 0 }] });
  const graph = { edges: [{ parsedElementIndex: 0, from: 10, to: 20 }] };
  const result = run(document({ c }), graph, [op('C1', 'CREATE', 20, '', 'P20-A'), op('C2', 'CREATE', 20, '', 'P20-B')]);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('WRITER_2_NODENAME_CREATE_OWNER_CONFLICT:0:TO'));
}

console.log('Writer 2 NODENAME relocation falsifiers remain fail-closed.');

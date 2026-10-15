import assert from 'assert';
import { _test as sideloadTest, RESTRAINT_COLUMNS } from '../tabs/inputxml-workspace/inputxml-workspace-sideload.js';
import { rowsToTabText } from '../tabs/inputxml-workspace/inputxml-workspace-table.js';

const { parseBasic, buildLineIdText, buildRestraintTagText, buildCoordinateText, nodeKey } = sideloadTest;

// parseBasic + buildLineIdText round trip.
const basicText = 'ELEMENTID\tFROM_NODE\tTO_NODE\tFROM_NODE_NAME\tTO_NODE_NAME\tLINE_NO\tREST_PTR\tELEMENT_NAME\n1\t10\t20\tPS-1\tPS-2\tL100\tR1\tPIPE-1';
const basicRows = parseBasic(basicText);
assert.strictEqual(basicRows.length, 1, 'parseBasic should parse one row from the sample text.');
const lineIdText = buildLineIdText(basicRows);
assert.ok(lineIdText.includes('10\t20\tL100'), 'buildLineIdText should produce a FROM/TO/LINE_ID row.');

// buildRestraintTagText using REST_PTR-based from/to pairing.
const restPtrPairs = new Map([['R1', { from: '10', to: '20' }]]);
const restraintTagText = buildRestraintTagText([{ REST_PTR: 'R1', NODE_NUM: '20', RES_TYPEID: 'GUIDE', STIFFNESS: '1E12', GAP: '0', RES_TAG: 'G-101' }], restPtrPairs);
assert.ok(restraintTagText.includes('10\t20\t20\tGUIDE'), 'buildRestraintTagText should resolve from/to via REST_PTR pairing.');
assert.ok(restraintTagText.includes('G-101'), 'buildRestraintTagText should preserve the tag.');

// buildCoordinateText merges nodal + user coordinate rows, deduped by node.
const coordinateText = buildCoordinateText(
  [{ FROM_NODE: '10', TO_NODE: '20', FROM_NODE_X: '0', FROM_NODE_Y: '0', FROM_NODE_Z: '0', TO_NODE_X: '1000', TO_NODE_Y: '0', TO_NODE_Z: '0' }],
  [{ NODE: '20', NODE_X: '1000', NODE_Y: '0', NODE_Z: '0' }],
);
assert.ok(coordinateText.includes('10\t0\t0\t0'), 'buildCoordinateText should include the FROM_NODE coordinate.');
assert.strictEqual(coordinateText.split('\n').filter((line) => line.startsWith('20\t')).length, 1, 'Node 20 coordinate should only appear once despite being present in both nodal and user tables.');

assert.strictEqual(nodeKey('20.0'), '20', 'nodeKey should normalize a whole-number float to its integer string.');

// Row -> tab-text serialization step used by the new ACCDB file-loading path (parser/accdb-mdb.js's readAccdbNamedTables).
const accdbRestraintRows = [{ REST_PTR: 'R1', NODE_NUM: '20', NODE_NAME: 'PS-2', RES_TYPEID: 'GUIDE', STIFFNESS: '1E12', GAP: '0', FRIC_COEF: '0.3', CNODE: '', RES_TAG: 'G-101' }];
const serialized = rowsToTabText(accdbRestraintRows, RESTRAINT_COLUMNS);
assert.ok(serialized.startsWith('REST_PTR\tNODE_NUM\tNODE_NAME'), 'rowsToTabText should emit the ACCDB column names as a header row.');
assert.ok(serialized.includes('R1\t20\tPS-2\tGUIDE\t1E12\t0\t0.3\t\tG-101'), 'rowsToTabText should serialize the row values in column order.');

console.log('ACCDB sideload adapter checks passed.');

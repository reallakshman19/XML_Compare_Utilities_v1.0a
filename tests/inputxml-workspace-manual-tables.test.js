import assert from 'assert';
import { buildTablesFromManualRows } from '../tabs/inputxml-workspace/inputxml-workspace-manual-tables.js';
import { buildCleanXmlFromTables } from '../tabs/inputxml-workspace/inputxml-workspace-cleanxml.js';

const branchRows = [{ branchName: '/PIPE-1', pressure1: '150', temperature1: '300', materialName: 'A106', pipingClass: 'CS150' }];
const componentRows = [
  { branchName: '/PIPE-1', nodeNumberRaw: '10', nodeName: 'PS-1', endpoint: '1', componentType: 'ATTA', positionX: '0', positionY: '0', positionZ: '0', boreMm: '100' },
  { branchName: '/PIPE-1', nodeNumberRaw: '20', nodeName: 'PS-2', endpoint: '', componentType: 'ATTA', componentTypeOverride: 'TEE', positionX: '1000', positionY: '0', positionZ: '0', boreMm: '100' },
];
const supportRows = [{ branchName: '/PIPE-1', nodeNumber: '20', nodeName: 'PS-2', type: 'GUIDE', stiffness: '1E12', gap: '0', tag: 'G-101' }];
const coordinateRows = [];

const tables = buildTablesFromManualRows({ branchRows, componentRows, supportRows, coordinateRows });

assert.ok(Array.isArray(tables.branches) && tables.branches.length === 1, 'Should produce one branch.');
assert.ok(Array.isArray(tables.nodes) && tables.nodes.length === 2, 'Should produce two node rows.');
assert.ok(Array.isArray(tables.coordinates) && tables.coordinates.length === 2, 'Both nodes have positions, so two coordinate rows should be produced.');
assert.ok(Array.isArray(tables.supports) && tables.supports.length === 1, 'Should attach the one support row to its node.');

const overriddenNode = tables.nodes.find((node) => node.nodeNumberRaw === '20');
assert.strictEqual(overriddenNode.componentType, 'TEE', 'componentTypeOverride should win during role resolution for manual rows.');

const cleanXmlText = buildCleanXmlFromTables(tables, { sourceName: 'manual-tables-test' });
assert.ok(cleanXmlText.includes('<CleanXML'), 'CleanXML output should have the CleanXML root.');
assert.ok(cleanXmlText.includes('<Branch>'), 'CleanXML output should include a Branch block.');
assert.ok(cleanXmlText.includes('<Node>'), 'CleanXML output should include Node blocks.');
assert.ok(cleanXmlText.includes('<RealComponentType>TEE</RealComponentType>'), 'CleanXML output should preserve the resolved override role.');

// A branch referenced only by a Components row (no matching Branches row) should still synthesize a minimal branch.
const orphanTables = buildTablesFromManualRows({
  branchRows: [],
  componentRows: [{ branchName: '/PIPE-2', nodeNumberRaw: '10', nodeName: 'PS-1', endpoint: '1', componentType: 'ATTA' }],
  supportRows: [],
  coordinateRows: [],
});
assert.strictEqual(orphanTables.branches.length, 1, 'A branch-less Components row should synthesize a minimal branch.');
assert.strictEqual(orphanTables.branches[0].branchName, '/PIPE-2', 'Synthesized branch should keep the referenced branch name.');

console.log(`Manual tables adapter checks passed: ${tables.branches.length} branch(es), ${tables.nodes.length} node(s).`);

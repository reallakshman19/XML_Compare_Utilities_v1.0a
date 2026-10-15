import assert from 'assert';
import { applyCiiAuxiliaryCapabilities, buildCiiWorkspaceAuxiliaryEvidence } from '../tabs/cii-workspace/cii-workspace-auxiliary.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';

function row(values) {
  const widths = [15, ...values.slice(1).map(() => 13)];
  return values.map((value, index) => String(value).padStart(widths[index])).join('');
}
function elementBlock(from, to, pointers = {}) {
  const zeros6 = row(['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']);
  return [
    row([`${from}.000`, `${to}.000`, '100.000', '0.000000', '0.000000', '60.30000']),
    row(['3.90000', '0.000000', '0.000000', '100.000', '0.000000', '0.000000']),
    zeros6,
    row(['10.0000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']),
    zeros6, zeros6, zeros6, zeros6,
    row(['0.000000', '0.000000', '0.000000', '0.000000', '0.000000']),
    row(['0']), row(['0']), row(['-1', '-1']),
    row(['0', String(pointers.rigid || 0), '0', String(pointers.restraint || 0), '0', '0']),
    row(['0', '0', '0', '0', String(pointers.sifTee || 0), '0']),
    row(['0', '0', '0']),
  ];
}
function restraintBlock(node, typeCode, gap, friction) {
  const rows = [
    row([`${node}.000`, `${typeCode}.00000`, '0.175120E+13', String(gap), String(friction), '0.000000']),
    row(['1.00000', '0.000000', '0.000000']), row(['0']), row(['0']),
  ];
  for (let slot = 1; slot < 6; slot += 1) {
    rows.push(row(['0.000000', '0.000000', '0.175120E+13', '0.000000', '0.000000', '0.000000']));
    rows.push(row(['0.000000', '0.000000', '0.000000']), row(['0']), row(['0']));
  }
  return rows;
}
function sifBlock(node, rawCode) {
  const zero = row(['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']);
  return [row([`${node}.000`, `${rawCode}.00000`, '0.000000', '0.000000', '0.000000', '0.000000']), ...Array(9).fill(zero)];
}
function parsedElement(index, from, to, x = 0) {
  return { index, from, to, dx: 100, dy: 0, dz: 0, od: 60.3, wall: 3.9, P1: 10, T1: 100, length: 100,
    fromPos: { x, y: 0, z: 0 }, toPos: { x: x + 100, y: 0, z: 0 }, hasBend: false };
}

const text = [
  '#$ ELEMENTS',
  ...elementBlock(10, 20, { rigid: 1, restraint: 1, sifTee: 1 }),
  '#$ RIGID', row(['123.400', '2.00000']),
  '#$ RESTRANT', ...restraintBlock(10, 15, 0, 0.3),
  '#$ SIF&TEES', ...sifBlock(20, 3),
].join('\n');

const parsed = {
  elements: [parsedElement(0, 10, 20)],
  nodes: { 10: { x: 0, y: 0, z: 0 }, 20: { x: 100, y: 0, z: 0 } },
  // Deliberately bogus generic-parser rigid evidence. CII Workspace must ignore
  // this and use the ELEMENT pointer -> RIGID record association instead.
  rigids: [{ node: 999, mass: 2 }],
};
const auxiliary = buildCiiWorkspaceAuxiliaryEvidence(text, parsed);
assert.strictEqual(auxiliary.conflicts.length, 0);
assert.strictEqual(auxiliary.mappedElementCount, 1);
assert.strictEqual(auxiliary.elements[0].pointers.rigid, 1);
assert.strictEqual(auxiliary.elements[0].pointers.restraint, 1);
assert.strictEqual(auxiliary.elements[0].pointers.sifTee, 1);
assert.strictEqual(auxiliary.restraints.blockRows, 24);
assert.strictEqual(auxiliary.sifTee.blockRows, 10);
assert.strictEqual(auxiliary.restraints.byNode['10'][0].typeCode, 15);
assert.strictEqual(auxiliary.restraints.byNode['10'][0].gap, 0);
assert.strictEqual(auxiliary.restraints.byNode['10'][0].friction, 0.3);
assert.deepStrictEqual(auxiliary.restraints.byNode['10'][0].directionCosines, { x: 1, y: 0, z: 0 });
assert.strictEqual(auxiliary.rigids.byPointer[1].weight, 123.4);
assert.strictEqual(auxiliary.sifTee.byPointer[1].node, '20');
assert.strictEqual(auxiliary.sifTee.byPointer[1].rawCode, 3);
assert.strictEqual(auxiliary.sifTee.byPointer[1].rawRows.length, 10);
assert.strictEqual(auxiliary.sifTee.byPointer[1].normalizedPayload[0][0], null, 'renumbered SIF node must be excluded from normalized payload equality');

const baseCapabilities = { schema: 'CIIWorkspaceCapabilities.v1', families: {
  restraints: { state: 'NOT_PARSED', count: null, qualification: 'NONE' },
  rigidMass: { state: 'NOT_PARSED', count: null, qualification: 'NONE' },
  sifTee: { state: 'NOT_PARSED', count: null, qualification: 'NONE' },
} };
const capabilities = applyCiiAuxiliaryCapabilities(baseCapabilities, auxiliary);
assert.strictEqual(capabilities.families.restraints.state, 'PARSED');
assert.strictEqual(capabilities.families.restraints.details.gapFrictionQualified, true);
assert.strictEqual(capabilities.families.restraints.details.pointerUnit, '24_ROW_BLOCK_INDEX');
assert.strictEqual(capabilities.families.rigidMass.qualification, 'QUALIFIED');
assert.strictEqual(capabilities.families.sifTee.qualification, 'PARTIAL');
assert.strictEqual(capabilities.families.sifTee.details.pointerUnit, '10_ROW_BLOCK_INDEX');

const document = {
  schema: 'CIIWorkspaceDocument.v1', side: 'SOURCE', contentSha256: 'test', parsed, nodeNames: {}, auxiliaryEvidence: auxiliary, capabilities,
};
const graph = adaptCiiDocumentToTopologyGraph(document);
assert.strictEqual(graph.edges.length, 1);
assert.strictEqual(graph.edges[0].componentKind, 'RIGID');
assert.strictEqual(graph.edges[0].rigidEvidence.status, 'POINTER_BOUND_RECORD');
assert.strictEqual(graph.edges[0].rigidEvidence.pointer, 1);
assert.strictEqual(graph.edges[0].rigidEvidence.weight, 123.4);
assert.strictEqual(graph.edges[0].rigidEvidence.mass, 123.4, 'mass alias may exist only after pointer-bound weight custody');
assert.strictEqual(graph.edges[0].sifTeeEvidence.rawCode, 3);

const blockedDocument = {
  ...document,
  capabilities: {
    ...capabilities,
    families: {
      ...capabilities.families,
      rigidMass: { ...capabilities.families.rigidMass, state: 'PARSE_ERROR', qualification: 'NONE' },
    },
  },
};
assert.throws(() => adaptCiiDocumentToTopologyGraph(blockedDocument), /CII_WORKSPACE_RIGID_AUXILIARY_PARSE_BLOCKED/);

// Regression for the engineering-critical pointer-unit bug: pointer 2 selects
// the second fixed-size block, not raw section row 2.
const multiText = [
  '#$ ELEMENTS',
  ...elementBlock(100, 110, { restraint: 1, sifTee: 1 }),
  ...elementBlock(110, 120, { restraint: 2, sifTee: 2 }),
  '#$ RESTRANT',
  ...restraintBlock(100, 1, 0, 0.1),
  ...restraintBlock(120, 15, 2.5, 0.3),
  '#$ SIF&TEES',
  ...sifBlock(110, 3),
  ...sifBlock(120, 5),
].join('\n');
const multiParsed = {
  elements: [parsedElement(0, 100, 110, 0), parsedElement(1, 110, 120, 100)],
  nodes: { 100: { x: 0, y: 0, z: 0 }, 110: { x: 100, y: 0, z: 0 }, 120: { x: 200, y: 0, z: 0 } },
};
const multi = buildCiiWorkspaceAuxiliaryEvidence(multiText, multiParsed);
assert.strictEqual(multi.conflicts.length, 0);
assert.strictEqual(multi.restraints.byPointer[2][0].node, '120');
assert.strictEqual(multi.restraints.byPointer[2][0].typeCode, 15);
assert.strictEqual(multi.restraints.byPointer[2][0].gap, 2.5);
assert.strictEqual(multi.restraints.byPointer[2][0].friction, 0.3);
assert.strictEqual(multi.sifTee.byPointer[2].node, '120');
assert.strictEqual(multi.sifTee.byPointer[2].rawCode, 5);
assert.strictEqual(multi.elements[1].restraintRecords[0].node, '120');
assert.strictEqual(multi.elements[1].sifTeeRecord.node, '120');

console.log('CII auxiliary block-index pointer-custody checks passed.');

import assert from 'assert';
import { applyCiiAuxiliaryCapabilities, buildCiiWorkspaceAuxiliaryEvidence } from '../tabs/cii-workspace/cii-workspace-auxiliary.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { buildCiiEngineeringDeltas } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

function row(values) {
  const widths = [15, ...values.slice(1).map(() => 13)];
  return values.map((value, index) => String(value).padStart(widths[index])).join('');
}
function elementBlock(from, to, pointers = {}) {
  const zeros6 = row(['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']);
  return [
    row([`${from}.000`, `${to}.000`, '100.000', '0.000000', '0.000000', '60.30000']),
    row(['3.90000', '0.000000', '0.000000', '100.000', '0.000000', '0.000000']),
    zeros6, row(['10.0000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']),
    zeros6, zeros6, zeros6, zeros6,
    row(['0.000000', '0.000000', '0.000000', '0.000000', '0.000000']),
    row(['0']), row(['0']), row(['-1', '-1']),
    row(['0', String(pointers.rigid || 0), '0', String(pointers.restraint || 0), '0', '0']),
    row(['0', '0', '0', '0', String(pointers.sifTee || 0), '0']),
    row(['0', '0', '0']),
  ];
}
function restraintBlock(node, typeCode, friction) {
  const rows = [
    row([`${node}.000`, `${typeCode}.00000`, '0.175120E+13', '0.000000', String(friction), '0.000000']),
    row(['1.00000', '0.000000', '0.000000']), row(['0']), row(['0']),
  ];
  for (let slot = 1; slot < 6; slot += 1) {
    rows.push(row(['0.000000', '0.000000', '0.175120E+13', '0.000000', '0.000000', '0.000000']));
    rows.push(row(['0.000000', '0.000000', '0.000000']), row(['0']), row(['0']));
  }
  return rows;
}
function sifRecord(node, rawCode) {
  const zero = row(['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']);
  return [row([`${node}.000`, `${rawCode}.00000`, '0.000000', '0.000000', '0.000000', '0.000000']), ...Array(9).fill(zero)];
}
function parsedElement(index, from, to, fromX) {
  return { index, from, to, dx: 100, dy: 0, dz: 0, od: 60.3, wall: 3.9, P1: 10, T1: 100, length: 100,
    fromPos: { x: fromX, y: 0, z: 0 }, toPos: { x: fromX + 100, y: 0, z: 0 }, hasBend: false };
}
function baselineCapabilities() {
  return { schema: 'CIIWorkspaceCapabilities.v1', families: {
    restraints: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['not parsed'] },
    rigidMass: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['not parsed'] },
    sifTee: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['not parsed'] },
    hangers: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['hanger custody unresolved'] },
    weightData: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['general weight unresolved'] },
    lineNumbers: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['line number unresolved'] },
    process: { state: 'PARSED', qualification: 'PARTIAL', limitations: ['element values only'] },
    nodeNames: { state: 'EMPTY', qualification: 'QUALIFIED', limitations: [] },
  } };
}
function makeDocument(side, spec) {
  const elements = [
    parsedElement(0, spec.restraintFrom, spec.restraintNode, 0),
    parsedElement(1, spec.sifFrom, spec.sifNode, 300),
    parsedElement(2, spec.rigidFrom, spec.rigidTo, 600),
  ];
  const nodes = {};
  for (const element of elements) { nodes[element.from] = element.fromPos; nodes[element.to] = element.toPos; }
  // Override the restraint target location to exercise registered-vs-native basis.
  nodes[spec.restraintNode] = { x: spec.restraintTargetX, y: 0, z: 0 };
  const parsed = { elements, nodes, restraints: [], rigids: [] };
  const text = [
    '#$ ELEMENTS',
    ...elementBlock(spec.restraintFrom, spec.restraintNode, { restraint: 1 }),
    ...elementBlock(spec.sifFrom, spec.sifNode, { sifTee: 1 }),
    ...elementBlock(spec.rigidFrom, spec.rigidTo, { rigid: 1 }),
    '#$ RESTRANT', ...restraintBlock(spec.restraintNode, spec.restraintCode, spec.friction),
    '#$ SIF&TEES', ...sifRecord(spec.sifNode, spec.sifCode),
    '#$ RIGID', row([String(spec.rigidWeight), '1.00000']),
  ].join('\n');
  const auxiliaryEvidence = buildCiiWorkspaceAuxiliaryEvidence(text, parsed);
  assert.strictEqual(auxiliaryEvidence.conflicts.length, 0);
  const capabilities = applyCiiAuxiliaryCapabilities(baselineCapabilities(), auxiliaryEvidence);
  return { schema: 'CIIWorkspaceDocument.v1', side, contentSha256: side, fileName: `${side}.CII`, parsed, nodeNames: {}, auxiliaryEvidence,
    capabilities, summary: { nodeCount: Object.keys(nodes).length, elementCount: elements.length } };
}
function edgeByEnds(graph, from, to) { return graph.edges.find((edge) => edge.from === String(from) && edge.to === String(to)); }

const source = makeDocument('SOURCE', {
  restraintFrom: 120, restraintNode: 130, restraintCode: 15, friction: 0,
  sifFrom: 35, sifNode: 70, sifCode: 3,
  rigidFrom: 113, rigidTo: 116, rigidWeight: 100,
  restraintTargetX: 100,
});
const target = makeDocument('TARGET', {
  restraintFrom: 20120, restraintNode: 20130, restraintCode: 9, friction: 0.3,
  sifFrom: 20035, sifNode: 20070, sifCode: 5,
  rigidFrom: 20113, rigidTo: 20116, rigidWeight: 250,
  restraintTargetX: 200,
});
const sourceGraph = adaptCiiDocumentToTopologyGraph(source); const targetGraph = adaptCiiDocumentToTopologyGraph(target);
const sourceSif = edgeByEnds(sourceGraph, 35, 70); const targetSif = edgeByEnds(targetGraph, 20035, 20070);
const sourceRigid = edgeByEnds(sourceGraph, 113, 116); const targetRigid = edgeByEnds(targetGraph, 20113, 20116);
assert(sourceSif && targetSif && sourceRigid && targetRigid);

const sifRow = { correspondenceId: 'element:sif', kind: 'ELEMENT', sourceElementId: sourceSif.elementId, targetElementIds: [targetSif.elementId], status: 'HIGH' };
const rigidRow = { correspondenceId: 'element:rigid', kind: 'ELEMENT', sourceElementId: sourceRigid.elementId, targetElementIds: [targetRigid.elementId], status: 'HIGH' };
const nodeRow = { correspondenceId: 'node:130:20130', kind: 'NODE', sourceNodeId: '130', targetNodeId: '20130', status: 'HIGH' };
const componentRow = { correspondenceId: 'component:rigid', kind: 'COMPONENT', componentKind: 'RIGID', sourceElementId: sourceRigid.elementId,
  targetElementIds: [targetRigid.elementId], sourceComponentId: 'RIGID_PTR@1', targetComponentId: 'RIGID_PTR@1', status: 'HIGH',
  parentElementCorrespondenceId: rigidRow.correspondenceId, evidence: { blockers: [] } };
const correspondence = { nodeRows: [nodeRow], elementRows: [sifRow, rigidRow], componentRows: [componentRow] };
const geometryTransform = { status: 'READY', mode: 'RIGID_3D', rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], translation: [100, 0, 0] };
const deltas = buildCiiEngineeringDeltas(source, target, sourceGraph, targetGraph, correspondence, { geometryTransform });

const changed = (property) => deltas.changedRows.find((item) => item.property === property);
assert.deepStrictEqual(changed('Restraint code set').sourceValue, [15]);
assert.deepStrictEqual(changed('Restraint code set').targetValue, [9]);
assert.deepStrictEqual(changed('Restraint friction values').sourceValue, [0]);
assert.deepStrictEqual(changed('Restraint friction values').targetValue, [0.3]);
assert.strictEqual(changed('SIF/Tee raw code (field 2)').sourceValue, 3);
assert.strictEqual(changed('SIF/Tee raw code (field 2)').targetValue, 5);
assert.strictEqual(changed('Rigid weight').sourceValue, 100);
assert.strictEqual(changed('Rigid weight').targetValue, 250);

const nativeLocation = deltas.changedRows.find((item) => item.property === 'Node location (native basis)');
assert(nativeLocation && Math.abs(nativeLocation.delta.distanceMm - 100) < 1e-9);
const registeredLocation = deltas.rows.find((item) => item.property === 'Node location (registered basis)');
assert(registeredLocation);
assert.strictEqual(registeredLocation.changed, false);
assert(Math.abs(registeredLocation.delta.distanceMm) < 1e-9);
assert.strictEqual(deltas.summary.geometryBases.registered, 'QUALIFIED_RIGID_3D_REGISTRATION');

assert.strictEqual(source.capabilities.families.sifTee.details.pointerUnit, '10_ROW_BLOCK_INDEX');
assert.strictEqual(source.capabilities.families.restraints.details.pointerUnit, '24_ROW_BLOCK_INDEX');
assert.strictEqual(deltas.limitations.find((item) => item.family === 'sifTee').comparisonState, 'PARTIAL');

const restraintBlockedSource = {
  ...source,
  capabilities: {
    ...source.capabilities,
    families: {
      ...source.capabilities.families,
      restraints: { ...source.capabilities.families.restraints, state: 'PARSE_ERROR', qualification: 'NONE' },
    },
  },
};
const restraintBlocked = buildCiiEngineeringDeltas(restraintBlockedSource, target, sourceGraph, targetGraph, correspondence, { geometryTransform });
assert(!restraintBlocked.rows.some((item) => item.category === 'RESTRAINT'), 'PARSE_ERROR restraint evidence must be withheld');
assert.strictEqual(restraintBlocked.limitations.find((item) => item.family === 'restraints').comparisonState, 'BLOCKED');

const sifBlockedTarget = {
  ...target,
  capabilities: {
    ...target.capabilities,
    families: {
      ...target.capabilities.families,
      sifTee: { ...target.capabilities.families.sifTee, state: 'PARSE_ERROR', qualification: 'NONE' },
    },
  },
};
const sifBlocked = buildCiiEngineeringDeltas(source, sifBlockedTarget, sourceGraph, targetGraph, correspondence, { geometryTransform });
assert(!sifBlocked.rows.some((item) => item.category === 'SIF_TEE'), 'PARSE_ERROR SIF/Tee evidence must be withheld');
assert.strictEqual(sifBlocked.limitations.find((item) => item.family === 'sifTee').comparisonState, 'BLOCKED');

console.log('CII auxiliary engineering-delta checks passed.');

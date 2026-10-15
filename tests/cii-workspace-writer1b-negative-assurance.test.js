import assert from 'assert';
import { validateCiiWriterRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer-validation.js';

function metadata(text = '') { return Object.freeze({ declaredLength: text.length, text, raw: `${text.length} ${text}` }); }
function record(pointer, slot, node, typeCode, values = {}) {
  return Object.freeze({
    pointer, slot, node: String(node), typeCode,
    stiffness: values.stiffness ?? 1e9, gap: values.gap ?? 0, friction: values.friction ?? 0,
    connectingNode: values.connectingNode ?? 0,
    directionCosines: Object.freeze(values.directionCosines || { x: 1, y: 0, z: 0 }),
    tag: metadata(values.tag || ''), guid: metadata(values.guid || ''),
  });
}
function document(elements, records, sectionRowCount = 24) {
  const byPointer = {};
  for (const item of records) {
    if (!byPointer[item.pointer]) byPointer[item.pointer] = [];
    byPointer[item.pointer].push(item);
  }
  return Object.freeze({
    parsed: Object.freeze({ nodes: Object.freeze({ 10: Object.freeze({ x: 0, y: 0, z: 0 }), 20: Object.freeze({ x: 100, y: 0, z: 0 }) }), elements: Object.freeze(elements) }),
    nodeNames: Object.freeze({}),
    auxiliaryEvidence: Object.freeze({
      elements: Object.freeze({ 0: Object.freeze({ pointers: Object.freeze({ restraint: 1, rigid: 0, sifTee: 0, reducer: 0 }) }) }),
      rigids: Object.freeze({ byPointer: Object.freeze({}) }),
      restraints: Object.freeze({ records: Object.freeze(records), byPointer: Object.freeze(byPointer), sectionRowCount }),
    }),
  });
}
const beforeElement = Object.freeze({ from: 10, to: 20, dx: 100, dy: 0, dz: 0, od: 114.3, wall: 6.02, insul: 25, corrosion: 3,
  P1: 10, P2: 20, P3: 30, P4: 40, P5: 50, P6: 60, P7: 70, P8: 80, P9: 90,
  T1: 100, T2: 110, T3: 120, T4: 130, T5: 140, T6: 150, T7: 160, T8: 170, T9: 180,
  insulationDensity: 0.001, fluidDensity: 0.002, hydroPressure: 5 });
const afterElement = Object.freeze({ ...beforeElement, od: 168.3, T9: 245 });
const beforeRecord = record(1, 1, 20, 9, { friction: 0.2 });
const createdRecord = record(1, 2, 20, 15, { stiffness: 2.5e9, gap: 4, friction: 0.1, directionCosines: { x: 0, y: 1, z: 0 } });
const before = document([beforeElement], [beforeRecord]);
const after = document([afterElement], [beforeRecord, createdRecord]);
const targetGraph = Object.freeze({ edges: Object.freeze([Object.freeze({ elementId: 'E1:10->20', parsedElementIndex: 0 })]) });
const writerResult = Object.freeze({ mutations: Object.freeze([
  Object.freeze({ section: 'ELEMENTS', elementId: 'E1:10->20', field: 'OD', proposed: 168.3 }),
  Object.freeze({ section: 'ELEMENTS', elementId: 'E1:10->20', field: 'T9', proposed: 245 }),
  ...['Restraint node','Restraint typeCode','Restraint stiffness','Restraint gap','Restraint friction','Restraint direction Y'].map((field) => Object.freeze({ section: 'RESTRANT', pointer: 1, slot: 2, field, proposed: ({
    'Restraint node': 20, 'Restraint typeCode': 15, 'Restraint stiffness': 2.5e9, 'Restraint gap': 4, 'Restraint friction': 0.1, 'Restraint direction Y': 1,
  })[field] })),
]) });
const slotPlan = Object.freeze({
  status: 'QUALIFIED', mode: 'CREATE', pointer: 1, slot: 2,
  proposedSlot: Object.freeze({ node: 20, typeCode: 15, stiffness: 2.5e9, gap: 4, friction: 0.1, connectingNode: 0,
    directionCosines: Object.freeze({ x: 0, y: 1, z: 0 }) }),
});
const transferPlan = Object.freeze({ operations: Object.freeze([Object.freeze({
  family: 'RESTRAINT', property: 'Qualified restraint slot mutation', status: 'PREVIEW_READY', proposed: slotPlan,
})]) });
const validation = validateCiiWriterRoundTrip(before, after, targetGraph, writerResult, transferPlan, 'WRITER_1B');
assert.strictEqual(validation.status, 'PASS');
assert.strictEqual(validation.unexpectedSemanticDeltaCount, 0);

const badElement = document([Object.freeze({ ...afterElement, dx: 101 })], [beforeRecord, createdRecord]);
assert.throws(() => validateCiiWriterRoundTrip(before, badElement, targetGraph, writerResult, transferPlan, 'WRITER_1B'),
  /ELEMENT_0_dx_UNEXPECTED_CHANGE/);

const badMetadata = document([afterElement], [beforeRecord, record(1, 2, 20, 15, {
  stiffness: 2.5e9, gap: 4, friction: 0.1, directionCosines: { x: 0, y: 1, z: 0 }, tag: 'UNQUALIFIED',
})]);
assert.throws(() => validateCiiWriterRoundTrip(before, badMetadata, targetGraph, writerResult, transferPlan, 'WRITER_1B'),
  /CREATED_METADATA_NOT_EMPTY/);

console.log('CII Writer 1B round-trip negative-assurance checks passed.');

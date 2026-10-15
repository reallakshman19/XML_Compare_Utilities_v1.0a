import assert from 'assert';
import { pairCiiRestraintRecords } from '../tabs/cii-workspace/cii-workspace-restraint-pairing.js';

function record(pointer, slot, node, config = {}) {
  return {
    pointer, slot, node: String(node),
    typeCode: config.typeCode ?? 15,
    stiffness: config.stiffness ?? 1e12,
    gap: config.gap ?? 0,
    friction: config.friction ?? 0,
    connectingNode: config.connectingNode ?? 0,
    directionCosines: config.directionCosines || { x: 1, y: 0, z: 0 },
    tag: { text: config.tag || '' },
    guid: { text: config.guid || '' },
  };
}

// Singleton custody is intrinsically unique even when every mutable engineering
// value and the direction change.
{
  const pairing = pairCiiRestraintRecords(
    [record(5, 2, 130, { typeCode: 15, gap: 3, friction: 0, directionCosines: { x: 1, y: 0, z: 0 } })],
    [record(6, 4, 20130, { typeCode: 9, gap: 0, friction: 0.3, directionCosines: { x: 0, y: 1, z: 0 } })],
    new Map(),
  );
  assert.strictEqual(pairing.status, 'QUALIFIED');
  assert.strictEqual(pairing.authority, 'SINGLETON_EQUAL_CARDINALITY');
  assert.strictEqual(pairing.pairs[0].target.pointer, 6);
  assert.strictEqual(pairing.pairs[0].target.slot, 4);
  assert.strictEqual(pairing.pairs[0].proposed.typeCode, 15);
  assert.strictEqual(pairing.pairs[0].proposed.gap, 3);
  assert.deepStrictEqual(pairing.pairs[0].proposed.directionCosines, { x: 1, y: 0, z: 0 });
}

// Slot positions are deliberately swapped. Direction identity, not slot order,
// must recover the unique global assignment. Type/gap/friction changes do not
// participate in pairing.
{
  const source = [
    record(2, 1, 500, { typeCode: 15, gap: 2, friction: 0.1, directionCosines: { x: 1, y: 0, z: 0 } }),
    record(2, 5, 500, { typeCode: 9, gap: 4, friction: 0.2, directionCosines: { x: 0, y: 1, z: 0 } }),
  ];
  const target = [
    record(7, 2, 9500, { typeCode: 61, gap: 99, friction: 0.9, directionCosines: { x: 0, y: 1, z: 0 } }),
    record(7, 6, 9500, { typeCode: 62, gap: 88, friction: 0.8, directionCosines: { x: 1, y: 0, z: 0 } }),
  ];
  const pairing = pairCiiRestraintRecords(source, target, new Map());
  assert.strictEqual(pairing.status, 'QUALIFIED');
  assert.strictEqual(pairing.authority, 'UNIQUE_GLOBAL_ASSIGNMENT_STABLE_EVIDENCE');
  const bySourceSlot = new Map(pairing.pairs.map((pair) => [pair.source.slot, pair.target.slot]));
  assert.strictEqual(bySourceSlot.get(1), 6);
  assert.strictEqual(bySourceSlot.get(5), 2);
  assert.strictEqual(pairing.runnerUpScore, null, 'all alternative assignments are invalid rather than lower-scoring');
  assert.strictEqual(pairing.winnerGap, null);
}

// GUID can preserve identity while direction itself is an approved engineering
// change. This proves direction is evidence, not a mandatory same-direction gate.
{
  const source = [
    record(3, 1, 700, { guid: 'GUID-A', directionCosines: { x: 1, y: 0, z: 0 } }),
    record(3, 2, 700, { guid: 'GUID-B', directionCosines: { x: 0, y: 1, z: 0 } }),
  ];
  const target = [
    record(8, 4, 9700, { guid: 'GUID-B', directionCosines: { x: 0, y: 0, z: 1 } }),
    record(8, 5, 9700, { guid: 'GUID-A', directionCosines: { x: 0, y: 0, z: -1 } }),
  ];
  const pairing = pairCiiRestraintRecords(source, target, new Map());
  assert.strictEqual(pairing.status, 'QUALIFIED');
  const byGuid = new Map(pairing.pairs.map((pair) => [pair.source.guid, pair.target.guid]));
  assert.strictEqual(byGuid.get('GUID-A'), 'GUID-A');
  assert.strictEqual(byGuid.get('GUID-B'), 'GUID-B');
}

// Connecting-node evidence is translated through approved node correspondence;
// raw source/target numbering is never compared as if it were identity.
{
  const source = [
    record(4, 1, 800, { connectingNode: 810, directionCosines: { x: 1, y: 0, z: 0 } }),
    record(4, 2, 800, { connectingNode: 820, directionCosines: { x: 1, y: 0, z: 0 } }),
  ];
  const target = [
    record(9, 3, 9800, { connectingNode: 10820, directionCosines: { x: 1, y: 0, z: 0 } }),
    record(9, 4, 9800, { connectingNode: 10810, directionCosines: { x: 1, y: 0, z: 0 } }),
  ];
  const map = new Map([['810', '10810'], ['820', '10820']]);
  const pairing = pairCiiRestraintRecords(source, target, map);
  assert.strictEqual(pairing.status, 'QUALIFIED');
  const bySourceConnecting = new Map(pairing.pairs.map((pair) => [pair.source.connectingNode, pair.target.connectingNode]));
  assert.strictEqual(bySourceConnecting.get(810), 10810);
  assert.strictEqual(bySourceConnecting.get(820), 10820);
}

// Two indistinguishable multi-record restraints must remain blocked. Slot order,
// type, gap, friction and stiffness are not permitted to manufacture identity.
{
  const source = [
    record(5, 1, 900, { typeCode: 15, gap: 1 }),
    record(5, 2, 900, { typeCode: 9, gap: 2 }),
  ];
  const target = [
    record(10, 5, 9900, { typeCode: 61, gap: 100 }),
    record(10, 6, 9900, { typeCode: 62, gap: 200 }),
  ];
  const pairing = pairCiiRestraintRecords(source, target, new Map());
  assert.strictEqual(pairing.status, 'BLOCKED');
  assert(pairing.blockers.includes('RESTRAINT_RECORD_PAIRING_AMBIGUOUS'));
}

{
  const pairing = pairCiiRestraintRecords(
    [record(1, 1, 1)],
    [record(2, 1, 2), record(2, 2, 2)],
    new Map(),
  );
  assert.strictEqual(pairing.status, 'BLOCKED');
  assert(pairing.blockers.includes('RESTRAINT_RECORD_CARDINALITY_CHANGE'));
}

console.log('CII deterministic restraint pairing checks passed.');

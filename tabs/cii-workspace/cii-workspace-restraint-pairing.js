import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';

const MAX_RESTRAINT_RECORDS = 6;
const DEFAULT_DIRECTION_TOLERANCE = 1e-9;

function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function textValue(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.text || '').trim();
}

function mappedNode(nodeMap, sourceNode) {
  const key = String(Math.round(Number(sourceNode)));
  if (nodeMap instanceof Map) return nodeMap.get(key) ?? null;
  return nodeMap && Object.hasOwn(nodeMap, key) ? nodeMap[key] : null;
}

function direction(record) {
  const value = record?.directionCosines || {};
  return { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
}

function finiteDirection(value) {
  return [value.x, value.y, value.z].every(Number.isFinite);
}

function sameDirection(left, right, tolerance) {
  if (!finiteDirection(left) || !finiteDirection(right)) return false;
  return ['x', 'y', 'z'].every((axis) => Math.abs(left[axis] - right[axis]) <= tolerance);
}

function normalizedRecord(record) {
  return deepFreeze({
    pointer: integer(record?.pointer),
    slot: integer(record?.slot),
    node: String(Math.round(Number(record?.node))),
    typeCode: Number(record?.typeCode),
    stiffness: Number(record?.stiffness),
    gap: Number(record?.gap),
    friction: Number(record?.friction),
    connectingNode: Number(record?.connectingNode),
    directionCosines: deepFreeze(direction(record)),
    tag: textValue(record?.tag),
    guid: textValue(record?.guid),
  });
}

function recordKey(record) {
  return `${String(record.pointer).padStart(3, '0')}:${String(record.slot).padStart(2, '0')}:${record.node}`;
}

function validRecord(record) {
  return Number.isSafeInteger(record.pointer) && record.pointer >= 1
    && Number.isSafeInteger(record.slot) && record.slot >= 1 && record.slot <= MAX_RESTRAINT_RECORDS
    && /^-?\d+$/.test(record.node)
    && Number.isFinite(record.typeCode)
    && Number.isFinite(record.stiffness)
    && Number.isFinite(record.gap)
    && Number.isFinite(record.friction)
    && Number.isFinite(record.connectingNode)
    && finiteDirection(record.directionCosines);
}

function projectedConnectingNode(source, nodeMap) {
  const connecting = Number(source.connectingNode);
  if (!Number.isFinite(connecting)) return { status: 'INVALID', target: null };
  if (Math.abs(connecting) <= 1e-12) return { status: 'ZERO', target: 0 };
  if (!Number.isSafeInteger(Math.round(connecting)) || Math.abs(connecting - Math.round(connecting)) > 1e-9) {
    return { status: 'INVALID', target: null };
  }
  const mapped = mappedNode(nodeMap, connecting);
  if (mapped === null || mapped === undefined || mapped === '') return { status: 'UNMAPPED', target: null };
  const target = Number(mapped);
  return Number.isFinite(target) ? { status: 'MAPPED', target } : { status: 'INVALID', target: null };
}

function candidateEvidence(source, target, nodeMap, tolerance, singleton) {
  const sourceDirection = source.directionCosines;
  const targetDirection = target.directionCosines;
  const projectedConnecting = projectedConnectingNode(source, nodeMap);
  const targetConnecting = Number(target.connectingNode);
  const guidExact = Boolean(source.guid && target.guid && source.guid === target.guid);
  const tagExact = Boolean(source.tag && target.tag && source.tag === target.tag);
  const connectingNodeMappedExact = projectedConnecting.status === 'MAPPED'
    && Number.isFinite(targetConnecting)
    && Math.abs(projectedConnecting.target - targetConnecting) <= 1e-9;
  const connectingNodeZeroExact = projectedConnecting.status === 'ZERO'
    && Number.isFinite(targetConnecting)
    && Math.abs(targetConnecting) <= 1e-12;
  const directionExact = sameDirection(sourceDirection, targetDirection, tolerance);
  const strong = guidExact || tagExact || connectingNodeMappedExact || directionExact;

  // Hierarchical weights are chosen so no combination of lower-level evidence
  // across all six slots can outweigh one higher-level exact identity cue.
  const score = (guidExact ? 1_000_000 : 0)
    + (tagExact ? 10_000 : 0)
    + (connectingNodeMappedExact ? 1_000 : 0)
    + (directionExact ? 100 : 0)
    + (connectingNodeZeroExact ? 1 : 0);

  return deepFreeze({
    valid: singleton || strong,
    score,
    strong,
    guidExact,
    tagExact,
    connectingNodeMappedExact,
    connectingNodeZeroExact,
    directionExact,
    projectedConnectingNodeStatus: projectedConnecting.status,
    projectedConnectingNode: projectedConnecting.target,
  });
}

function proposedTargetRecord(source, target, nodeMap) {
  const connecting = projectedConnectingNode(source, nodeMap);
  if (connecting.status === 'UNMAPPED' || connecting.status === 'INVALID') return null;
  return deepFreeze({
    pointer: target.pointer,
    slot: target.slot,
    node: target.node,
    typeCode: source.typeCode,
    stiffness: source.stiffness,
    gap: source.gap,
    friction: source.friction,
    connectingNode: connecting.target,
    directionCosines: source.directionCosines,
  });
}

function targetBeforeRecord(target) {
  return deepFreeze({
    pointer: target.pointer,
    slot: target.slot,
    node: target.node,
    typeCode: target.typeCode,
    stiffness: target.stiffness,
    gap: target.gap,
    friction: target.friction,
    connectingNode: target.connectingNode,
    directionCosines: target.directionCosines,
  });
}

function permutations(size) {
  const out = [];
  const used = Array(size).fill(false);
  const current = [];
  function visit() {
    if (current.length === size) { out.push([...current]); return; }
    for (let index = 0; index < size; index += 1) {
      if (used[index]) continue;
      used[index] = true; current.push(index); visit(); current.pop(); used[index] = false;
    }
  }
  visit();
  return out;
}

function blocked(blockers, sourceCount, targetCount, details = {}) {
  return deepFreeze({
    schema: 'CIIWorkspaceRestraintPairing.v1',
    status: 'BLOCKED',
    authority: 'NONE',
    sourceCount,
    targetCount,
    pairs: Object.freeze([]),
    blockers: Object.freeze([...new Set(blockers)]),
    ...details,
  });
}

/**
 * Pair existing SOURCE/TARGET restraint records without using mutable
 * engineering values (type, stiffness, gap or friction) as identity evidence.
 *
 * Singleton record sets are unambiguous by cardinality. Multi-record sets use
 * a global one-to-one assignment over stable evidence only: exact GUID, exact
 * tag, approved connecting-node correspondence and exact direction cosines.
 * A tied best assignment is rejected rather than resolved by slot order.
 */
export function pairCiiRestraintRecords(sourceRecords = [], targetRecords = [], nodeCorrespondenceMap = new Map(), options = {}) {
  const tolerance = Number(options.directionTolerance ?? DEFAULT_DIRECTION_TOLERANCE);
  const source = sourceRecords.map(normalizedRecord).sort((a, b) => recordKey(a).localeCompare(recordKey(b), undefined, { numeric: true }));
  const target = targetRecords.map(normalizedRecord).sort((a, b) => recordKey(a).localeCompare(recordKey(b), undefined, { numeric: true }));
  const sourceCount = source.length; const targetCount = target.length;

  if (sourceCount !== targetCount) return blocked(['RESTRAINT_RECORD_CARDINALITY_CHANGE'], sourceCount, targetCount);
  if (sourceCount === 0) return deepFreeze({
    schema: 'CIIWorkspaceRestraintPairing.v1', status: 'QUALIFIED', authority: 'EMPTY_EQUAL_CARDINALITY',
    sourceCount: 0, targetCount: 0, pairs: Object.freeze([]), blockers: Object.freeze([]),
    assignmentScore: 0, runnerUpScore: null, winnerGap: null,
  });
  if (sourceCount > MAX_RESTRAINT_RECORDS) return blocked(['RESTRAINT_RECORD_COUNT_EXCEEDS_SIX_SLOT_BLOCK'], sourceCount, targetCount);
  if (source.some((record) => !validRecord(record)) || target.some((record) => !validRecord(record))) {
    return blocked(['RESTRAINT_RECORD_FIXED_FIELD_CUSTODY_INVALID'], sourceCount, targetCount);
  }

  const singleton = sourceCount === 1;
  const matrix = source.map((left) => target.map((right) => candidateEvidence(left, right, nodeCorrespondenceMap, tolerance, singleton)));
  const assignments = [];
  for (const permutation of permutations(sourceCount)) {
    const pairs = []; let score = 0; let valid = true;
    for (let sourceIndex = 0; sourceIndex < sourceCount; sourceIndex += 1) {
      const targetIndex = permutation[sourceIndex]; const evidence = matrix[sourceIndex][targetIndex];
      const proposed = proposedTargetRecord(source[sourceIndex], target[targetIndex], nodeCorrespondenceMap);
      if (!evidence.valid || !proposed) { valid = false; break; }
      score += evidence.score;
      const before = targetBeforeRecord(target[targetIndex]);
      pairs.push(deepFreeze({
        source: source[sourceIndex], target: target[targetIndex], before, proposed, evidence,
        changed: stableStringify(before) !== stableStringify(proposed),
      }));
    }
    if (!valid) continue;
    const key = pairs.map((pair) => `${recordKey(pair.source)}=>${recordKey(pair.target)}`).join('|');
    assignments.push({ score, key, pairs });
  }

  if (!assignments.length) {
    const blockers = ['RESTRAINT_RECORD_PAIRING_NO_QUALIFIED_ASSIGNMENT'];
    if (source.some((record) => projectedConnectingNode(record, nodeCorrespondenceMap).status === 'UNMAPPED')) {
      blockers.push('RESTRAINT_CONNECTING_NODE_CORRESPONDENCE_REQUIRED');
    }
    return blocked(blockers, sourceCount, targetCount);
  }

  assignments.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key, undefined, { numeric: true }));
  const best = assignments[0]; const runnerUp = assignments[1] || null;
  if (!singleton && runnerUp && runnerUp.score === best.score) {
    return blocked(['RESTRAINT_RECORD_PAIRING_AMBIGUOUS'], sourceCount, targetCount, {
      assignmentScore: best.score,
      runnerUpScore: runnerUp.score,
      winnerGap: 0,
    });
  }

  return deepFreeze({
    schema: 'CIIWorkspaceRestraintPairing.v1',
    status: 'QUALIFIED',
    authority: singleton ? 'SINGLETON_EQUAL_CARDINALITY' : 'UNIQUE_GLOBAL_ASSIGNMENT_STABLE_EVIDENCE',
    sourceCount,
    targetCount,
    pairs: Object.freeze(best.pairs),
    blockers: Object.freeze([]),
    assignmentScore: best.score,
    runnerUpScore: runnerUp?.score ?? null,
    winnerGap: runnerUp ? best.score - runnerUp.score : null,
  });
}

const NODE_STEP = 10;

function nextAvailableNode(used, start) {
  let candidate = start;
  while (used.has(candidate)) candidate += NODE_STEP;
  used.add(candidate);
  return candidate;
}

export function assignBendCurvatureNodes(candidates, rows, settingsInput) {
  const used = new Set(rows.map((row) => Number(row.nodeNumber)).filter(Number.isFinite));
  let nextNode = Math.ceil((Math.max(0, ...used) + 1) / NODE_STEP) * NODE_STEP;
  return candidates.map((candidate) => {
    if (candidate.status !== 'EMITTED') {
      return Object.freeze({ ...candidate, curvatureNodes: Object.freeze([]) });
    }
    const settings = typeof settingsInput === 'function' ? settingsInput(candidate) : settingsInput;
    const nodes = [];
    if (settings?.emitNearPointNode === true) {
      const nodeNumber = nextAvailableNode(used, nextNode);
      nextNode = nodeNumber + NODE_STEP;
      nodes.push(Object.freeze({ angleDeg: 0, nodeNumber, role: 'NEAR_POINT' }));
    }
    if (settings?.emitMidpointNode === true) {
      const nodeNumber = nextAvailableNode(used, nextNode);
      nextNode = nodeNumber + NODE_STEP;
      nodes.push(Object.freeze({
        angleDeg: candidate.turnAngleDeg / 2,
        nodeNumber,
        role: 'MIDPOINT',
      }));
    }
    return Object.freeze({ ...candidate, curvatureNodes: Object.freeze(nodes) });
  });
}

export const SUPPORT_CARRIER_TOPOLOGY_SCHEMA = 'SupportCarrierTopologyBundle.v1';

export function buildSupportCarrierTopologyBundle(input = {}) {
  const catalog = input.catalog || { components: [], ports: [], summary: {} };
  const config = resolveTopologyConfig(input.config);
  const components = catalog.components || [];
  const componentIndex = new Map(components.map((row) => [token(row.componentId), row]));
  const acceptedEdges = [];
  const exceptions = [];
  const occupiedPorts = new Set();

  resolveExplicitReferences(components, componentIndex, acceptedEdges, exceptions, occupiedPorts);
  const exactCandidates = buildGeometricCandidates(components, occupiedPorts, config, 'EXACT');
  acceptMutuallyUnique(exactCandidates, acceptedEdges, exceptions, occupiedPorts, 'EXACT_PORT_CONNECTION');
  const repairCandidates = buildGeometricCandidates(components, occupiedPorts, config, 'REPAIR');
  acceptMutuallyUnique(repairCandidates, acceptedEdges, exceptions, occupiedPorts, 'SMALL_GAP_CARRIER_REPAIR');

  addDisconnectedExceptions(components, acceptedEdges, exceptions);
  const paths = buildTopologyPaths(components, acceptedEdges, exceptions);
  return {
    schema: SUPPORT_CARRIER_TOPOLOGY_SCHEMA,
    relationshipSemantic: 'FAIL_CLOSED_CARRIER_COMPONENT_CONTINUITY',
    xmlRequired: false,
    config,
    catalogSchema: catalog.schema || null,
    components,
    ports: catalog.ports || [],
    connectionEdges: acceptedEdges,
    topologyPaths: paths,
    topologyExceptions: exceptions,
    summary: {
      componentCount: components.length,
      portCount: catalog.ports?.length || 0,
      connectionCount: acceptedEdges.length,
      explicitConnectionCount: acceptedEdges.filter((row) => row.relationshipStatus === 'EXPLICIT_REFERENCE_CONNECTION').length,
      exactConnectionCount: acceptedEdges.filter((row) => row.relationshipStatus === 'EXACT_PORT_CONNECTION').length,
      smallGapRepairCount: acceptedEdges.filter((row) => row.relationshipStatus === 'SMALL_GAP_CARRIER_REPAIR').length,
      attachmentEventCount: acceptedEdges.filter((row) => row.edgeType === 'CARRIER_COMPONENT_ATTACHMENT').length,
      pathCount: paths.length,
      reviewExceptionCount: exceptions.length,
      disconnectedComponentCount: exceptions.filter((row) => row.exceptionCode === 'DISCONNECTED_CARRIER_COMPONENT').length,
      ambiguousConnectionCount: exceptions.filter((row) => row.exceptionCode.includes('AMBIGUOUS')).length,
    },
  };
}

export function resolveTopologyConfig(config = {}) {
  const exactToleranceMm = nonNegative(config.carrierTopologyExactToleranceMm, 1);
  return {
    exactToleranceMm,
    smallGapToleranceMm: Math.max(exactToleranceMm, nonNegative(config.carrierTopologySmallGapToleranceMm, 25)),
    boreToleranceMm: nonNegative(config.carrierTopologyBoreToleranceMm, 3),
    requireSourceAdjacencyForRepair: config.requireSourceAdjacencyForCarrierRepair !== false,
  };
}

function resolveExplicitReferences(components, index, edges, exceptions, occupied) {
  for (const component of components) {
    for (const reference of component.references || []) {
      const target = index.get(token(reference.targetComponentId));
      if (!target) {
        exceptions.push(exception('MISSING_CARRIER_REFERENCE_TARGET', component, {
          targetComponentId: reference.targetComponentId,
          message: `Explicit ${reference.kind} reference target is unavailable.`,
        }));
        continue;
      }
      if (reference.kind === 'HOST') {
        const sourcePort = rolePort(component, 'HOST_ATTACHMENT');
        edges.push(connectionEdge(component, target, sourcePort, null, {
          edgeType: 'CARRIER_COMPONENT_ATTACHMENT',
          relationshipStatus: 'EXPLICIT_REFERENCE_CONNECTION',
          relationshipBasis: [`EXPLICIT_${reference.kind}_REFERENCE`],
          gapMm: sourcePort ? distanceToComponentAxis(sourcePort, target) : null,
          confidence: 'HIGH',
        }));
        if (sourcePort) occupied.add(sourcePort.portId);
        continue;
      }
      const pair = nearestReferencePortPair(component, target, reference.kind);
      if (!pair) {
        exceptions.push(exception('UNRESOLVED_REFERENCE_PORTS', component, {
          targetComponentId: target.componentId,
          message: `Explicit ${reference.kind} reference has no usable port pair.`,
        }));
        continue;
      }
      edges.push(connectionEdge(component, target, pair.left, pair.right, {
        relationshipStatus: 'EXPLICIT_REFERENCE_CONNECTION',
        relationshipBasis: [`EXPLICIT_${reference.kind}_REFERENCE`],
        gapMm: pair.gapMm,
        confidence: 'HIGH',
      }));
      occupied.add(pair.left.portId);
      occupied.add(pair.right.portId);
    }
  }
}

function buildGeometricCandidates(components, occupied, config, mode) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < components.length; leftIndex += 1) {
    const left = components[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < components.length; rightIndex += 1) {
      const right = components[rightIndex];
      if (!contextCompatible(left, right)) continue;
      for (const leftPort of left.ports || []) {
        if (occupied.has(leftPort.portId) || leftPort.role === 'HOST_ATTACHMENT') continue;
        for (const rightPort of right.ports || []) {
          if (occupied.has(rightPort.portId) || rightPort.role === 'HOST_ATTACHMENT') continue;
          if (!rolesCompatible(leftPort.role, rightPort.role)) continue;
          if (!boresCompatible(leftPort, rightPort, left, right, config)) continue;
          const gapMm = distance(leftPort.positionGlobal, rightPort.positionGlobal);
          const exact = gapMm <= config.exactToleranceMm;
          const repair = gapMm > config.exactToleranceMm && gapMm <= config.smallGapToleranceMm;
          if ((mode === 'EXACT' && !exact) || (mode === 'REPAIR' && !repair)) continue;
          const sourceAdjacent = Math.abs((left.catalogIndex ?? left.sourceIndex) - (right.catalogIndex ?? right.sourceIndex)) <= 1;
          if (mode === 'REPAIR' && config.requireSourceAdjacencyForRepair && !sourceAdjacent) continue;
          candidates.push({ left, right, leftPort, rightPort, gapMm: round3(gapMm), sourceAdjacent });
        }
      }
    }
  }
  return candidates;
}

function acceptMutuallyUnique(candidates, edges, exceptions, occupied, status) {
  const byPort = new Map();
  for (const candidate of candidates) {
    push(byPort, candidate.leftPort.portId, candidate);
    push(byPort, candidate.rightPort.portId, candidate);
  }
  const acceptedKeys = new Set();
  for (const candidate of candidates) {
    if (occupied.has(candidate.leftPort.portId) || occupied.has(candidate.rightPort.portId)) continue;
    const leftChoices = byPort.get(candidate.leftPort.portId) || [];
    const rightChoices = byPort.get(candidate.rightPort.portId) || [];
    if (leftChoices.length !== 1 || rightChoices.length !== 1) continue;
    const key = pairKey(candidate.leftPort.portId, candidate.rightPort.portId);
    if (acceptedKeys.has(key)) continue;
    acceptedKeys.add(key);
    edges.push(connectionEdge(candidate.left, candidate.right, candidate.leftPort, candidate.rightPort, {
      relationshipStatus: status,
      relationshipBasis: [status === 'EXACT_PORT_CONNECTION' ? 'UNIQUE_EXACT_PORT_MATCH' : 'UNIQUE_SOURCE_ADJACENT_SMALL_GAP'],
      gapMm: candidate.gapMm,
      confidence: status === 'EXACT_PORT_CONNECTION' ? 'HIGH' : 'MEDIUM',
    }));
    occupied.add(candidate.leftPort.portId);
    occupied.add(candidate.rightPort.portId);
  }
  const ambiguousPorts = [...byPort.entries()].filter(([, rows]) => rows.length > 1);
  for (const [portId, rows] of ambiguousPorts) {
    if (occupied.has(portId)) continue;
    const owner = rows[0].leftPort.portId === portId ? rows[0].left : rows[0].right;
    exceptions.push(exception(
      status === 'EXACT_PORT_CONNECTION' ? 'AMBIGUOUS_EXACT_CARRIER_CONNECTION' : 'AMBIGUOUS_SMALL_GAP_CARRIER_CONNECTION',
      owner,
      {
        portId,
        candidatePortIds: unique(rows.map((row) => row.leftPort.portId === portId ? row.rightPort.portId : row.leftPort.portId)),
        message: `${rows.length} eligible topology candidates remain for ${portId}.`,
      },
    ));
  }
}

function connectionEdge(left, right, leftPort, rightPort, metadata) {
  const suffix = `${leftPort?.portId || 'COMPONENT'}::${rightPort?.portId || right.componentId}`;
  return {
    edgeId: `SCT-EDGE:${suffix}`,
    edgeType: metadata.edgeType || 'CARRIER_COMPONENT_CONNECTION',
    fromComponentId: left.componentId,
    fromPortId: leftPort?.portId || null,
    fromPortRole: leftPort?.role || null,
    toComponentId: right.componentId,
    toPortId: rightPort?.portId || null,
    toPortRole: rightPort?.role || null,
    relationshipStatus: metadata.relationshipStatus,
    relationshipBasis: metadata.relationshipBasis,
    gapMm: Number.isFinite(metadata.gapMm) ? round3(metadata.gapMm) : null,
    confidence: metadata.confidence,
    branchIds: unique([left.lineContext?.branchNode, right.lineContext?.branchNode]),
    lineFamilies: unique([left.lineContext?.lineFamily, right.lineContext?.lineFamily]),
  };
}

function addDisconnectedExceptions(components, edges, exceptions) {
  const connected = new Set(edges.flatMap((row) => [row.fromComponentId, row.toComponentId]));
  for (const component of components) {
    if (connected.has(component.componentId)) continue;
    exceptions.push(exception('DISCONNECTED_CARRIER_COMPONENT', component, {
      message: 'No accepted explicit, exact, or small-gap topology connection was found.',
    }));
  }
}

function buildTopologyPaths(components, edges, exceptions) {
  const adjacency = new Map(components.map((row) => [row.componentId, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.fromComponentId)?.add(edge.toComponentId);
    adjacency.get(edge.toComponentId)?.add(edge.fromComponentId);
  }
  const componentIndex = new Map(components.map((row) => [row.componentId, row]));
  const visited = new Set();
  const paths = [];
  for (const component of components) {
    if (visited.has(component.componentId)) continue;
    const queue = [component.componentId];
    const componentIds = [];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      componentIds.push(current);
      for (const next of adjacency.get(current) || []) if (!visited.has(next)) queue.push(next);
    }
    const memberSet = new Set(componentIds);
    const pathEdges = edges.filter((row) => memberSet.has(row.fromComponentId) && memberSet.has(row.toComponentId));
    const pathExceptions = exceptions.filter((row) => memberSet.has(row.componentId));
    const rows = componentIds.map((id) => componentIndex.get(id)).filter(Boolean);
    paths.push({
      pathId: `SCT-PATH:${paths.length + 1}`,
      pathStatus: pathExceptions.length ? 'REVIEW_REQUIRED' : 'CONNECTED',
      componentIds: componentIds.sort(),
      edgeIds: pathEdges.map((row) => row.edgeId).sort(),
      branchIds: unique(rows.map((row) => row.lineContext?.branchNode)),
      lineFamilies: unique(rows.map((row) => row.lineContext?.lineFamily)),
      exceptionCodes: unique(pathExceptions.map((row) => row.exceptionCode)),
    });
  }
  return paths;
}

function nearestReferencePortPair(left, right, kind) {
  const preferredRole = ({ HEAD: 'INLET', TAIL: 'OUTLET', BRANCH: 'BRANCH_OUT' })[kind];
  const leftPorts = preferredRole ? left.ports.filter((row) => row.role === preferredRole) : left.ports;
  const pairs = [];
  for (const leftPort of leftPorts.length ? leftPorts : left.ports) {
    for (const rightPort of right.ports) {
      if (!rolesCompatible(leftPort.role, rightPort.role)) continue;
      pairs.push({ left: leftPort, right: rightPort, gapMm: distance(leftPort.positionGlobal, rightPort.positionGlobal) });
    }
  }
  return pairs.sort((a, b) => a.gapMm - b.gapMm)[0] || null;
}

function rolePort(component, role) { return component.ports.find((row) => row.role === role) || null; }
function rolesCompatible(left, right) {
  if (left === 'HOST_ATTACHMENT' || right === 'HOST_ATTACHMENT') return false;
  if (left === 'TERMINAL' && right === 'TERMINAL') return false;
  return true;
}
function boresCompatible(a, b, left, right, config) {
  if (!Number.isFinite(a.boreMm) || !Number.isFinite(b.boreMm)) return true;
  if (Math.abs(a.boreMm - b.boreMm) <= config.boreToleranceMm) return true;
  return left.canonicalType === 'REDUCER' || right.canonicalType === 'REDUCER';
}
function contextCompatible(left, right) {
  const leftBranch = token(left.lineContext?.branchNode);
  const rightBranch = token(right.lineContext?.branchNode);
  if (leftBranch && rightBranch) return leftBranch === rightBranch;
  const leftLine = token(left.lineContext?.lineFamily);
  const rightLine = token(right.lineContext?.lineFamily);
  return !leftLine || !rightLine || leftLine === rightLine;
}
function distance(a, b) { return a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : Number.POSITIVE_INFINITY; }
function distanceToComponentAxis(port, component) {
  const [first, second] = component.ports || [];
  if (!port?.positionGlobal || !first?.positionGlobal || !second?.positionGlobal) return null;
  const a = first.positionGlobal; const b = second.positionGlobal; const p = port.positionGlobal;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
  const length2 = ab.x ** 2 + ab.y ** 2 + ab.z ** 2;
  const t = length2 ? Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / length2)) : 0;
  return round3(distance(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }));
}
function exception(exceptionCode, component, extra = {}) {
  return { exceptionId: `SCT-EX:${exceptionCode}:${component.componentId}:${extra.portId || ''}`, exceptionCode, componentId: component.componentId, severity: 'WARN', ...extra };
}
function push(map, key, value) { if (!map.has(key)) map.set(key, []); map.get(key).push(value); }
function pairKey(a, b) { return [a, b].sort().join('|'); }
function token(value) { return String(value || '').trim().toUpperCase(); }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function nonNegative(value, fallback) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : fallback; }
function round3(value) { return Math.round(value * 1000) / 1000; }

export const SUPPORT_CARRIER_TO_STRUCTURE_PATH_SCHEMA = 'SupportCarrierToStructurePathBundle.v1';

export function buildSupportCarrierToStructurePathBundle(input = {}) {
  const resolution = input.carrierResolution || {};
  const attachment = input.carrierAttachment || {};
  const topology = input.carrierTopology || {};
  const chain = input.supportMemberChain || {};
  const families = input.supportFamilies || [];
  const completePaths = [];
  const pathExceptions = [];
  const identityEdges = resolution.supportCarrierEdges || [];
  const identityEdgesByFamily = groupBy(identityEdges, 'supportFamilyId');
  const topologyByComponent = indexTopologyPaths(topology.topologyPaths || []);
  const topologyEdgeIndex = new Map((topology.connectionEdges || []).map((row) => [row.edgeId, row]));
  const chainEdgesByFamily = groupBy(chain.supportChainEdges || [], 'supportFamilyId');
  const terminalsByFamily = groupBy(
    (chain.structuralTerminalEdges || []).filter(isAnalyticalStructuralTerminal),
    'supportFamilyId',
  );
  const attachmentsByIdentity = indexByIdentity(attachment.supportCarrierAttachmentEdges || []);
  const nearbyByIdentity = indexByIdentity(attachment.nearbyCarrierAttachmentCandidates || []);
  const unresolvedByIdentity = indexByIdentity(attachment.unresolvedCarrierAttachments || []);

  for (const family of families) {
    if ((identityEdgesByFamily.get(family.familyId) || []).length) continue;
    pathExceptions.push(pathException('CARRIER_IDENTITY_NOT_RESOLVED', {
      supportFamilyId: family.familyId,
      supportMemberId: null,
      carrierObjectId: null,
      edgeId: null,
    }, { message: 'No authoritative physical carrier identity edge exists for this support family.' }));
  }

  for (const identityEdge of identityEdges) {
    const key = identityKey(identityEdge);
    const attachmentEdge = attachmentsByIdentity.get(key);
    if (!attachmentEdge) {
      pathExceptions.push(missingAttachmentException(
        identityEdge,
        nearbyByIdentity.get(key),
        unresolvedByIdentity.get(key),
      ));
      continue;
    }
    evaluateAttachmentPath({
      identityEdge,
      attachmentEdge,
      topologyByComponent,
      topologyEdgeIndex,
      chainEdges: chainEdgesByFamily.get(identityEdge.supportFamilyId) || [],
      terminals: terminalsByFamily.get(identityEdge.supportFamilyId) || [],
      completePaths,
      pathExceptions,
    });
  }

  const familyResults = buildFamilyResults(families, completePaths, pathExceptions);
  return {
    schema: SUPPORT_CARRIER_TO_STRUCTURE_PATH_SCHEMA,
    relationshipSemantic: 'CARRIER_TO_SUPPORT_TO_STRUCTURE_ANALYTICAL_PATH',
    xmlRequired: false,
    completePaths,
    pathExceptions,
    familyResults,
    summary: createSummary(familyResults, completePaths, pathExceptions),
    diagnostics: pathExceptions.map(exceptionDiagnostic),
  };
}

function createSummary(familyResults, completePaths, exceptions) {
  return {
    familyCount: familyResults.length,
    completePathCount: completePaths.length,
    completeFamilyCount: familyResults.filter((row) => row.pathStatus === 'COMPLETE').length,
    incompleteFamilyCount: familyResults.filter((row) => row.pathStatus !== 'COMPLETE').length,
    carrierIdentityMissingCount: countCode(exceptions, ['CARRIER_IDENTITY_NOT_RESOLVED']),
    attachmentNotProvenCount: countCode(exceptions, [
      'CARRIER_ATTACHMENT_NOT_PROVEN', 'CARRIER_ATTACHMENT_CLEARANCE_ONLY',
      'CARRIER_ATTACHMENT_GEOMETRY_UNRESOLVED',
    ]),
    topologyPathExceptionCount: countCode(exceptions, [
      'CARRIER_TOPOLOGY_PATH_MISSING', 'CARRIER_TOPOLOGY_PATH_REVIEW_REQUIRED',
      'AMBIGUOUS_CARRIER_TOPOLOGY_PATH',
    ]),
    structuralTerminalMissingCount: countCode(exceptions, ['STRUCTURAL_TERMINAL_MISSING']),
    supportChainIncompleteCount: countCode(exceptions, ['SUPPORT_CHAIN_TO_STRUCTURE_INCOMPLETE']),
    multipleCompletePathFamilyCount: familyResults.filter((row) => row.completePathIds.length > 1).length,
    exceptionCount: exceptions.length,
  };
}

function evaluateAttachmentPath(context) {
  const {
    identityEdge, attachmentEdge, topologyByComponent, topologyEdgeIndex,
    chainEdges, terminals, completePaths, pathExceptions,
  } = context;
  const topologyPaths = topologyByComponent.get(identityEdge.carrierObjectId) || [];
  if (!topologyPaths.length) {
    pathExceptions.push(pathException('CARRIER_TOPOLOGY_PATH_MISSING', identityEdge, {
      message: 'The resolved carrier object is not present in a topology path.',
    }));
    return;
  }
  if (topologyPaths.length > 1) {
    pathExceptions.push(pathException('AMBIGUOUS_CARRIER_TOPOLOGY_PATH', identityEdge, {
      topologyPathIds: topologyPaths.map((row) => row.pathId),
      message: 'The carrier object appears in more than one topology path.',
    }));
    return;
  }
  const topologyPath = topologyPaths[0];
  if (topologyPath.pathStatus !== 'CONNECTED' || !(topologyPath.edgeIds || []).length) {
    pathExceptions.push(pathException('CARRIER_TOPOLOGY_PATH_REVIEW_REQUIRED', identityEdge, {
      topologyPathId: topologyPath.pathId,
      topologyExceptionCodes: topologyPath.exceptionCodes || [],
      message: 'The carrier topology path is disconnected or has unresolved continuity exceptions.',
    }));
    return;
  }
  if (!terminals.length) {
    pathExceptions.push(pathException('STRUCTURAL_TERMINAL_MISSING', identityEdge, {
      message: 'No analytical support-member-to-structure terminal exists for the support family.',
    }));
    return;
  }
  const routes = terminals.map((terminal) => ({
    terminal,
    supportChainEdgeIds: findMemberPath(attachmentEdge.supportMemberId, terminal.supportMemberId, chainEdges),
  })).filter((row) => row.supportChainEdgeIds !== null);
  if (!routes.length) {
    pathExceptions.push(pathException('SUPPORT_CHAIN_TO_STRUCTURE_INCOMPLETE', identityEdge, {
      attachmentSupportMemberId: attachmentEdge.supportMemberId,
      structuralTerminalMemberIds: terminals.map((row) => row.supportMemberId),
      message: 'The attached support member is not connected analytically to a structural terminal member.',
    }));
    return;
  }
  for (const route of routes) {
    completePaths.push(completePathRecord(
      identityEdge, attachmentEdge, topologyPath, topologyEdgeIndex,
      route.terminal, route.supportChainEdgeIds, chainEdges,
    ));
  }
}

function completePathRecord(identity, attachment, topologyPath, topologyEdgeIndex, terminal, chainEdgeIds, chainEdges) {
  const usedChainEdges = chainEdges.filter((row) => chainEdgeIds.includes(row.edgeId));
  const repairEdgeIds = (topologyPath.edgeIds || []).filter(
    (edgeId) => topologyEdgeIndex.get(edgeId)?.relationshipStatus === 'SMALL_GAP_CARRIER_REPAIR',
  );
  return {
    pathId: `SCSP:${identity.supportFamilyId}:${identity.carrierObjectId}:${terminal.supportMemberId}:${terminal.structuralMemberId || terminal.steelGroupId}`,
    pathStatus: 'COMPLETE_CARRIER_TO_STRUCTURE_PATH',
    supportFamilyId: identity.supportFamilyId,
    carrierObjectId: identity.carrierObjectId,
    carrierIdentityEdgeId: identity.edgeId,
    carrierTopologyPathId: topologyPath.pathId,
    carrierTopologyComponentIds: topologyPath.componentIds || [],
    carrierTopologyEdgeIds: topologyPath.edgeIds || [],
    carrierTopologyRepairEdgeIds: repairEdgeIds,
    carrierAttachmentEdgeId: attachment.edgeId,
    attachmentSupportMemberId: attachment.supportMemberId,
    supportChainEdgeIds: chainEdgeIds,
    supportChainMemberIds: unique([
      attachment.supportMemberId, terminal.supportMemberId,
      ...usedChainEdges.flatMap((row) => [row.supportA, row.supportB]),
    ]),
    structuralTerminalEdgeId: terminal.edgeId,
    structuralTerminalMemberId: terminal.supportMemberId,
    steelGroupId: terminal.steelGroupId,
    structuralMemberId: terminal.structuralMemberId || null,
    relationshipBasis: [
      'AUTHORITATIVE_CARRIER_IDENTITY', 'CONNECTED_CARRIER_TOPOLOGY',
      repairEdgeIds.length ? 'AUDITED_CARRIER_TOPOLOGY_REPAIR' : 'EXACT_OR_EXPLICIT_CARRIER_TOPOLOGY',
      'ANALYTICAL_SUPPORT_TO_CARRIER_ATTACHMENT',
      chainEdgeIds.length ? 'ANALYTICAL_SUPPORT_MEMBER_CHAIN' : 'ATTACHMENT_MEMBER_IS_STRUCTURAL_TERMINAL',
      'ANALYTICAL_SUPPORT_TO_STRUCTURE_TERMINAL',
    ],
    contactEvidenceStatus: 'ANALYTICAL_PATH_CANDIDATE',
    confidence: minimumConfidence([
      identity.confidence, attachment.confidence, terminal.confidence,
      ...usedChainEdges.map((row) => row.confidence),
    ]),
  };
}

function findMemberPath(start, target, edges) {
  if (!start || !target) return null;
  if (start === target) return [];
  const adjacency = new Map();
  for (const edge of edges) {
    addNeighbor(adjacency, edge.supportA, edge.supportB, edge.edgeId);
    addNeighbor(adjacency, edge.supportB, edge.supportA, edge.edgeId);
  }
  const queue = [{ memberId: start, edgeIds: [] }];
  const visited = new Set([start]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current.memberId) || []) {
      if (visited.has(next.memberId)) continue;
      const edgeIds = [...current.edgeIds, next.edgeId];
      if (next.memberId === target) return edgeIds;
      visited.add(next.memberId);
      queue.push({ memberId: next.memberId, edgeIds });
    }
  }
  return null;
}

function buildFamilyResults(families, completePaths, exceptions) {
  return families.map((family) => {
    const familyPaths = completePaths.filter((row) => row.supportFamilyId === family.familyId);
    const familyExceptions = exceptions.filter((row) => row.supportFamilyId === family.familyId);
    return {
      supportFamilyId: family.familyId,
      pathStatus: familyPaths.length ? 'COMPLETE' : 'INCOMPLETE',
      completePathIds: familyPaths.map((row) => row.pathId),
      exceptionIds: familyExceptions.map((row) => row.exceptionId),
      exceptionCodes: unique(familyExceptions.map((row) => row.exceptionCode)),
      carrierObjectIds: unique(familyPaths.map((row) => row.carrierObjectId)),
      steelGroupIds: unique(familyPaths.map((row) => row.steelGroupId)),
    };
  });
}

function missingAttachmentException(identity, nearby, unresolved) {
  if (nearby) return pathException('CARRIER_ATTACHMENT_CLEARANCE_ONLY', identity, {
    distanceMm: nearby.distanceMm,
    message: 'Carrier identity is resolved, but analytical geometry shows clearance rather than attachment.',
  });
  if (unresolved) return pathException('CARRIER_ATTACHMENT_GEOMETRY_UNRESOLVED', identity, {
    attachmentStatus: unresolved.attachmentStatus,
    message: 'Carrier identity is resolved, but analytical attachment geometry is incomplete.',
  });
  return pathException('CARRIER_ATTACHMENT_NOT_PROVEN', identity, {
    message: 'Carrier identity is resolved, but no analytical carrier-attachment edge exists.',
  });
}

function pathException(code, identity, extra = {}) {
  return {
    exceptionId: `SCSP-EX:${code}:${identity.supportMemberId || identity.supportFamilyId}:${identity.carrierObjectId || 'NONE'}`,
    exceptionCode: code,
    severity: code === 'CARRIER_ATTACHMENT_CLEARANCE_ONLY' ? 'INFO' : 'WARN',
    supportFamilyId: identity.supportFamilyId,
    supportMemberId: identity.supportMemberId || null,
    carrierObjectId: identity.carrierObjectId || null,
    carrierIdentityEdgeId: identity.edgeId || null,
    ...extra,
  };
}

function isAnalyticalStructuralTerminal(row) {
  return row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE';
}
function indexTopologyPaths(paths) {
  const index = new Map();
  for (const path of paths) for (const id of path.componentIds || []) push(index, id, path);
  return index;
}
function indexByIdentity(rows) { return new Map(rows.map((row) => [identityKey(row), row])); }
function groupBy(rows, key) { const map = new Map(); for (const row of rows) push(map, row[key], row); return map; }
function push(map, key, value) { if (!map.has(key)) map.set(key, []); map.get(key).push(value); }
function identityKey(row) { return `${row.supportMemberId}::${row.carrierObjectId}`; }
function addNeighbor(map, from, to, edgeId) { if (from && to) push(map, from, { memberId: to, edgeId }); }
function minimumConfidence(values) {
  const rank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
  const filtered = values.filter((row) => rank[row] !== undefined);
  return filtered.length ? filtered.reduce((min, value) => rank[value] < rank[min] ? value : min, 'HIGH') : 'NONE';
}
function countCode(rows, codes) { return rows.filter((row) => codes.includes(row.exceptionCode)).length; }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function exceptionDiagnostic(row) {
  return {
    severity: row.severity, code: row.exceptionCode,
    supportFamilyId: row.supportFamilyId, supportMemberId: row.supportMemberId,
    carrierObjectId: row.carrierObjectId, message: row.message,
  };
}

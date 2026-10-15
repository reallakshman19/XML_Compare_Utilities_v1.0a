import { samePoint } from './sequential-sketcher-contract.js';
import { buildPipeSupportProjectionBundle } from './support/sj-pipe-support-projection.js';

function nodeMap(topology) { return new Map(topology.nodes.map((node) => [node.id, node])); }
function segmentMap(topology) { return new Map(topology.segments.map((segment) => [segment.id, segment])); }
function componentMap(topology) { return new Map(topology.components.map((component) => [component.id, component])); }
function vector(from, to) { return from && to ? { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z } : null; }

function orderedComponents(topology, traversal) {
  const firstDraw = new Map();
  traversal.commands.forEach((command, index) => {
    if ((command.op === 'DRAW_SEGMENT' || command.op === 'MARK_COMPONENT') && !firstDraw.has(command.componentId)) {
      firstDraw.set(command.componentId, index);
    }
  });
  return [...topology.components].sort((left, right) => {
    const leftOrder = firstDraw.get(left.id) ?? Number.POSITIVE_INFINITY;
    const rightOrder = firstDraw.get(right.id) ?? Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder || left.sourceIndex - right.sourceIndex || left.id.localeCompare(right.id);
  });
}

function componentDrawCommands(component, traversal) {
  return traversal.commands.filter((command) => command.op === 'DRAW_SEGMENT' && command.componentId === component.id);
}

function traversalForComponent(component, topology, traversal) {
  const nodes = nodeMap(topology);
  const commands = componentDrawCommands(component, traversal);
  const firstPosition = nodes.get(commands[0]?.fromNodeId)?.position || null;
  const reversedForTraversal = Boolean(
    component.a && component.b && firstPosition
    && samePoint(firstPosition, component.b, topology.toleranceMm)
    && !samePoint(firstPosition, component.a, topology.toleranceMm)
  );
  return {
    sourceStartField: 'APOS',
    traversalStartField: reversedForTraversal ? 'LPOS' : 'APOS',
    reversedForTraversal,
  };
}

function tangentAt(point, toward) {
  const direction = vector(point, toward);
  if (!direction) return null;
  const length = Math.hypot(direction.x, direction.y, direction.z);
  return length > 1e-12 ? { x: direction.x / length, y: direction.y / length, z: direction.z / length } : null;
}

function fallbackNodeTangent(component, topology) {
  const nodes = nodeMap(topology);
  const segments = segmentMap(topology);
  const eventNode = nodes.get(component.eventNodeId);
  const first = eventNode?.segmentIds.map((id) => segments.get(id)).find(Boolean);
  if (!eventNode || !first) return null;
  const otherId = first.fromNodeId === eventNode.id ? first.toNodeId : first.fromNodeId;
  return tangentAt(eventNode.position, nodes.get(otherId)?.position);
}

function fittingGeometry(component, topology) {
  const ports = [];
  const centre = component.position || component.a || component.b || null;
  const aTangent = tangentAt(component.a, centre || component.b);
  const bTangent = tangentAt(centre || component.a, component.b);
  if (component.a) ports.push({ portId: 'A', locationType: 'INLET_PORT', point: component.a, tangent: aTangent });
  if (component.b) ports.push({ portId: 'B', locationType: 'OUTLET_PORT', point: component.b, tangent: bTangent });
  if (component.cref && centre) ports.push({
    portId: 'CREF',
    locationType: 'BRANCH_PORT',
    point: centre,
    tangent: fallbackNodeTangent(component, topology) || aTangent || bTangent,
  });
  return {
    componentCentre: centre,
    tangent: fallbackNodeTangent(component, topology) || tangentAt(component.a, component.b),
    ports,
    axis: component.a && component.b ? { start: component.a, end: component.b } : null,
  };
}

function toCarrier(component, topology, traversal) {
  const componentTraversal = traversalForComponent(component, topology, traversal);
  const start = componentTraversal.reversedForTraversal ? component.b : component.a;
  const end = componentTraversal.reversedForTraversal ? component.a : component.b;
  const lengthMm = start && end ? Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) : 0;
  return {
    carrierId: component.componentId,
    carrierType: component.canonicalType,
    sourceBranchId: component.branchId,
    sourceSequenceIndex: component.sourceIndex,
    sourcePath: ['children', component.sourceIndex],
    attributes: component.attributes,
    traversal: componentTraversal,
    centerline: start && end && lengthMm > 1e-12 ? { start, end, lengthMm } : null,
    componentCentre: component.position,
    fittingGeometry: component.canonicalType === 'PIPE' ? null : fittingGeometry(component, topology),
  };
}

export function buildValidatedSupportCarriers(topology, traversal) {
  return Object.freeze(orderedComponents(topology, traversal).map((component) => Object.freeze(toCarrier(component, topology, traversal))));
}

export function buildSequentialSketcherSupportProjection(inventory, topology, traversal, options = {}) {
  const carriers = buildValidatedSupportCarriers(topology, traversal);
  return buildPipeSupportProjectionBundle({
    branchId: inventory.branchId,
    carriers,
    supportRecords: inventory.supportRecords || [],
    coordinateSystem: { units: 'mm', globalAxes: { x: 'EAST', y: 'NORTH', z: 'UP' } },
    projectionToleranceMm: options.projectionToleranceMm,
    onCenterlineToleranceMm: options.onCenterlineToleranceMm,
    ambiguityToleranceMm: options.ambiguityToleranceMm,
    plantUp: options.plantUp,
  });
}

function displayFamily(family) {
  const glyph = family.supportGlyph || {};
  return Object.freeze({
    familyId: family.familyId,
    carrierId: family.carrierBinding?.carrierId || glyph.carrierId || '',
    carrierStationMm: family.position?.carrierStationMm,
    carrierFraction: family.position?.carrierFraction,
    centerlinePointGlobal: family.position?.centerlinePointGlobal || glyph.centerlinePointGlobal || null,
    fittingLocation: family.position?.fittingLocation || glyph.fittingLocation || null,
    offsetFromCenterline: family.position?.offsetFromCenterline || glyph.offsetFromCenterline || null,
    displayKind: family.resolvedFunction?.supportKind || glyph.displayKind || 'REST',
    label: glyph.label || String(family.familyId || '').replace(/^\//u, '') || 'Support',
    resolutionStatus: family.carrierBinding?.bindingStatus || glyph.resolutionStatus || 'UNKNOWN',
    members: Object.freeze(Array.isArray(family.members) ? family.members : []),
  });
}

export function decorateTopologyWithSupportProjection(topology, bundle) {
  const familyIndex = new Map();
  for (const carrier of bundle?.carriers || []) {
    familyIndex.set(carrier.carrierId, Object.freeze((carrier.supportFamilies || []).map(displayFamily)));
  }
  const components = topology.components.map((component) => Object.freeze({
    ...component,
    supports: familyIndex.get(component.componentId) || Object.freeze([]),
  }));
  const supportIssues = [
    ...(bundle?.unresolvedSupportFamilies || []).map((family) => Object.freeze({
      code: family.position?.positionStatus || 'SUPPORT_UNRESOLVED',
      severity: 'WARNING',
      familyId: family.familyId,
      carrierId: family.carrierBinding?.carrierId || '',
    })),
    ...(bundle?.diagnostics || []).filter((row) => row.severity !== 'INFO').map((row) => Object.freeze({
      code: row.code,
      severity: row.severity || 'WARNING',
      familyId: row.familyId || '',
      carrierId: row.carrierId || '',
    })),
  ];
  return Object.freeze({
    ...topology,
    components: Object.freeze(components),
    supportBundle: bundle || null,
    supportIssues: Object.freeze(supportIssues),
    supportSummary: Object.freeze({
      familyCount: bundle?.supportGlyphs?.length || 0,
      unresolvedCount: bundle?.unresolvedSupportFamilies?.length || 0,
      diagnosticCount: bundle?.diagnostics?.length || 0,
    }),
  });
}

export function appendSupportDiagnostics(traversal, topology) {
  return Object.freeze({
    ...traversal,
    issues: Object.freeze([...(traversal.issues || []), ...(topology.supportIssues || [])]),
  });
}

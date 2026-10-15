import { resolveSupportLineContext } from './support-steel-line-context.js';
import { transformPoint } from './support-steel-world-matrix.js';
import {
  cleanText,
  cloneJson,
  normalizeIdentity,
  parsePoint,
  sourceAttributes,
  sourceIdentity,
  sourceType,
  walkSupportSteelHierarchy,
} from './support-steel-source-utils.js';

export const SUPPORT_CARRIER_TOPOLOGY_CATALOG_SCHEMA = 'SupportCarrierTopologyCatalog.v1';

const COMPONENT_TYPES = new Set([
  'PIPE', 'TUBE', 'PIPE_SEGMENT', 'STRAIGHT_PIPE', 'PIPING_PIPE', 'PIPE_COMPONENT',
  'ELBOW', 'BEND', 'TEE', 'OLET', 'REDUCER', 'VALVE', 'FLANGE', 'GASKET',
  'INSTRUMENT', 'CAP', 'BLIND', 'COUPLING', 'UNION', 'STRAINER', 'CHECK_VALVE',
]);
const TYPE_ALIASES = Object.freeze({
  TUBE: 'PIPE', PIPE_SEGMENT: 'PIPE', STRAIGHT_PIPE: 'PIPE', PIPING_PIPE: 'PIPE',
  PIPE_COMPONENT: 'PIPE', BEND: 'ELBOW', CHECK_VALVE: 'VALVE',
});
const PAIR_KEYS = Object.freeze([
  ['APOS', 'LPOS'], ['AXIS_START', 'AXIS_END'], ['START', 'END'], ['P1', 'P2'],
  ['INLET_POS', 'OUTLET_POS'], ['INLET', 'OUTLET'],
]);
const REFERENCE_KEYS = Object.freeze([
  ['HREF', 'HEAD'], ['HEAD_REF', 'HEAD'], ['TREF', 'TAIL'], ['TAIL_REF', 'TAIL'],
  ['CREF', 'BRANCH'], ['BRANCH_REF', 'BRANCH'], ['HOST_REF', 'HOST'],
  ['COMPONENT_REF', 'COMPONENT'],
]);

export function collectSupportCarrierTopologyCatalog(source) {
  if (source?.schema === 'PipeSupportProjectionBundle.v1') return projectionCatalog(source);
  const components = [];
  for (const row of walkSupportSteelHierarchy(source)) {
    const attrs = sourceAttributes(row.node);
    const rawType = sourceType(row.node, attrs);
    if (!COMPONENT_TYPES.has(rawType)) continue;
    const component = topologyComponent(row, attrs, rawType);
    if (component.componentId && component.ports.length) components.push(component);
  }
  return finalizeCatalog(components);
}

export function normalizeTopologyComponentId(value) {
  const text = cleanText(value).replace(/\(REF\)$/iu, '');
  return text ? normalizeIdentity(text) : '';
}

function topologyComponent(row, attrs, rawType) {
  const componentId = normalizeTopologyComponentId(sourceIdentity(row.node, attrs));
  const canonicalType = TYPE_ALIASES[rawType] || rawType;
  const context = resolveSupportLineContext(row, attrs);
  const ports = buildPorts(componentId, canonicalType, attrs, row.worldMatrix, row.transformBasis);
  return {
    schema: SUPPORT_CARRIER_TOPOLOGY_CATALOG_SCHEMA,
    componentId,
    canonicalType,
    sourceRecordType: rawType,
    sourcePath: row.path,
    sourceIndex: sourceIndex(row.path),
    lineContext: context,
    ports,
    references: collectReferences(attrs),
    terminalComponent: canonicalType === 'CAP' || canonicalType === 'BLIND',
    branchComponent: canonicalType === 'TEE' || canonicalType === 'OLET',
    attributes: cloneJson(attrs),
  };
}

function buildPorts(componentId, type, attrs, worldMatrix, transformBasis) {
  const ports = [];
  if (type === 'TEE') {
    addPort(ports, componentId, 'RUN_IN', attrs.APOS || attrs.RUN_IN, 'APOS', attrs, worldMatrix, transformBasis);
    addPort(ports, componentId, 'RUN_OUT', attrs.LPOS || attrs.RUN_OUT, 'LPOS', attrs, worldMatrix, transformBasis);
    addPort(ports, componentId, 'BRANCH_OUT', attrs.BPOS || attrs.BRANCH_POS, 'BPOS', attrs, worldMatrix, transformBasis);
  } else if (type === 'OLET') {
    addPort(ports, componentId, 'HOST_ATTACHMENT', attrs.APOS || attrs.HOST_POS || attrs.POS, 'HOST_POS', attrs, worldMatrix, transformBasis);
    addPort(ports, componentId, 'BRANCH_OUT', attrs.LPOS || attrs.BPOS || attrs.BRANCH_POS, 'BRANCH_POS', attrs, worldMatrix, transformBasis);
  } else {
    for (const [firstKey, secondKey] of PAIR_KEYS) {
      const first = parsePoint(attrs[firstKey]);
      const second = parsePoint(attrs[secondKey]);
      if (!first || !second) continue;
      addPort(ports, componentId, 'INLET', first, firstKey, attrs, worldMatrix, transformBasis);
      addPort(ports, componentId, 'OUTLET', second, secondKey, attrs, worldMatrix, transformBasis);
      break;
    }
  }
  if (!ports.length && inlineZeroLengthType(type)) {
    const position = parsePoint(attrs.POS || attrs.POSITION || attrs.CENTRE || attrs.CENTER);
    addPort(ports, componentId, 'INLET', position, 'POS', attrs, worldMatrix, transformBasis);
    addPort(ports, componentId, 'OUTLET', position, 'POS', attrs, worldMatrix, transformBasis);
  }
  if (!ports.length && (type === 'CAP' || type === 'BLIND')) {
    addPort(ports, componentId, 'TERMINAL', attrs.POS || attrs.APOS || attrs.START, 'POS', attrs, worldMatrix, transformBasis);
  }
  return uniquePorts(ports);
}

function addPort(ports, componentId, role, value, sourceKey, attrs, worldMatrix, transformBasis) {
  const local = parsePoint(value);
  if (!local) return;
  const positionGlobal = pointInWorld(local, attrs, worldMatrix, transformBasis);
  ports.push({
    portId: `${componentId}::${role}`,
    componentId,
    role,
    sourceKey,
    positionGlobal,
    boreMm: readBore(attrs, role),
  });
}

function pointInWorld(point, attrs, worldMatrix, transformBasis) {
  const coordinateSpace = cleanText(
    attrs.PORT_COORDINATE_SPACE || attrs.GEOMETRY_COORDINATE_SPACE || attrs.COORDINATE_SPACE,
  ).toUpperCase();
  if (coordinateSpace === 'WORLD' || coordinateSpace === 'GLOBAL') return point;
  if ((coordinateSpace === 'LOCAL' || transformBasis !== 'IDENTITY') && worldMatrix?.length === 16) {
    return transformPoint(worldMatrix, point);
  }
  return point;
}

function readBore(attrs, role) {
  const roleKey = role === 'BRANCH_OUT' ? attrs.BRANCH_BORE || attrs.BORE_BRANCH : null;
  const raw = roleKey ?? attrs.BORE ?? attrs.NOMINAL_DIAMETER ?? attrs.DIAMETER ?? attrs.OD;
  const text = cleanText(raw).replace(/mm|,/giu, '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function collectReferences(attrs) {
  return REFERENCE_KEYS.flatMap(([key, kind]) => {
    const targetComponentId = normalizeTopologyComponentId(attrs[key]);
    return targetComponentId ? [{ kind, sourceKey: key, targetComponentId }] : [];
  });
}

function projectionCatalog(bundle) {
  const components = (bundle.carriers || []).map((carrier, index) => {
    const componentId = normalizeTopologyComponentId(carrier.carrierId || carrier.id || `CARRIER-${index + 1}`);
    const attrs = carrier.attributes || {};
    const canonicalType = TYPE_ALIASES[cleanText(carrier.type || 'PIPE').toUpperCase()] || cleanText(carrier.type || 'PIPE').toUpperCase();
    return {
      schema: SUPPORT_CARRIER_TOPOLOGY_CATALOG_SCHEMA,
      componentId,
      canonicalType,
      sourceRecordType: canonicalType,
      sourcePath: ['carriers', index],
      sourceIndex: index,
      lineContext: {
        branchNode: normalizeTopologyComponentId(bundle.branchId) || null,
        fullLineTag: cleanText(bundle.fullLineTag || bundle.lineTag) || null,
        lineFamily: cleanText(bundle.lineFamily || bundle.fullLineTag || bundle.lineTag) || null,
      },
      ports: buildPorts(componentId, canonicalType, attrs, carrier.worldMatrix, carrier.transformBasis || 'IDENTITY'),
      references: collectReferences(attrs),
      terminalComponent: canonicalType === 'CAP' || canonicalType === 'BLIND',
      branchComponent: canonicalType === 'TEE' || canonicalType === 'OLET',
      attributes: cloneJson(attrs),
    };
  }).filter((row) => row.componentId && row.ports.length);
  return finalizeCatalog(components);
}

function finalizeCatalog(components) {
  const unique = uniqueBy(components, 'componentId').sort((a, b) => a.sourceIndex - b.sourceIndex || a.componentId.localeCompare(b.componentId));
  return {
    schema: SUPPORT_CARRIER_TOPOLOGY_CATALOG_SCHEMA,
    components: unique,
    ports: unique.flatMap((row) => row.ports),
    summary: {
      componentCount: unique.length,
      portCount: unique.reduce((sum, row) => sum + row.ports.length, 0),
      branchComponentCount: unique.filter((row) => row.branchComponent).length,
      explicitReferenceCount: unique.reduce((sum, row) => sum + row.references.length, 0),
    },
  };
}

function inlineZeroLengthType(type) {
  return ['VALVE', 'FLANGE', 'GASKET', 'INSTRUMENT', 'COUPLING', 'UNION', 'STRAINER'].includes(type);
}

function sourceIndex(path) {
  for (let index = path.length - 1; index >= 0; index -= 1) if (Number.isInteger(path[index])) return path[index];
  return 0;
}

function uniquePorts(ports) {
  const seen = new Set();
  return ports.filter((row) => {
    const key = `${row.role}|${row.positionGlobal.x}|${row.positionGlobal.y}|${row.positionGlobal.z}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueBy(rows, key) {
  const seen = new Set();
  return rows.filter((row) => !seen.has(row[key]) && seen.add(row[key]));
}

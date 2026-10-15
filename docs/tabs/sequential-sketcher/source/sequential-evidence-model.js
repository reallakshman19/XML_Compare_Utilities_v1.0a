import { canonicalComponentType, pointFrom, stableToken } from '../sequential-sketcher-contract.js';
import { orderSequentialComponentsByGeometry } from './sequential-geometry-route-order.js';

const TWO_PORT_TYPES = new Set(['PIPE', 'ELBOW', 'REDUCER', 'VALVE', 'FLANGE', 'GASKET', 'INSTRUMENT', 'COUPLING', 'UNION']);
const TERMINAL_TYPES = new Set(['CAP', 'BLIND']);
const SHADOW_PRIMARY_TYPES = new Set(['INSTRUMENT', 'VALVE']);

function text(value) { return String(value ?? '').trim(); }
function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value ?? '').trim().match(/[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
function clonePoint(value) { const point = pointFrom(value); return point ? { ...point } : null; }
function componentIdentity(child, branchId, sourceIndex) {
  return text(child?.attributes?.NAME || child?.attributes?.REF || child?.name || `${branchId}#CHILD-${sourceIndex + 1}`);
}
function branchIdentity(record) { return text(record?.attributes?.NAME || record?.name); }
function tangentFrom(origin, target) {
  if (!origin || !target) return null;
  const dx = target.x - origin.x; const dy = target.y - origin.y; const dz = target.z - origin.z;
  const length = Math.hypot(dx, dy, dz);
  return length > 1e-9 ? { x: dx / length, y: dy / length, z: dz / length } : null;
}
function readBore(attrs, keys) {
  for (const key of keys) {
    const value = number(attrs?.[key]);
    if (value !== null && value > 0) return value;
  }
  return null;
}
function makePort(componentId, branchId, role, sourcePosition, sourceIndex, extra = {}) {
  const position = clonePoint(sourcePosition);
  return Object.freeze({
    portId: `PORT-${stableToken(`${componentId}|${role}`)}`,
    componentId, branchId, role, sourceIndex,
    sourcePosition: position,
    sourcePositionStatus: position ? 'SOURCE_EXPLICIT' : 'UNRESOLVED',
    resolvedPosition: null,
    tangent: extra.tangent || null,
    boreMm: extra.boreMm ?? null,
    boreStatus: Number.isFinite(extra.boreMm) ? 'SOURCE_EXPLICIT' : 'UNRESOLVED',
    referenceTarget: text(extra.referenceTarget),
    connectionStatus: 'UNRESOLVED',
  });
}

function buildComponentPorts(componentId, branchId, canonicalType, attrs, sourceIndex) {
  const apos = clonePoint(attrs.APOS || attrs.HPOS);
  const lpos = clonePoint(attrs.LPOS || attrs.TPOS);
  const centre = clonePoint(attrs.POS || attrs.CPOS || attrs.CENTRE || attrs.CENTER);
  const branchPoint = clonePoint(attrs.BPOS || attrs.BRANCH_POS || attrs.BRANCHPOS);
  const inletBore = readBore(attrs, ['INLET_BORE', 'INLETBORE', 'LARGE_BORE', 'LARGEBORE', 'OD1', 'BORE1', 'NPD1', 'ABORE']);
  const outletBore = readBore(attrs, ['OUTLET_BORE', 'OUTLETBORE', 'SMALL_BORE', 'SMALLBORE', 'OD2', 'BORE2', 'NPD2', 'LBORE']);
  const commonBore = readBore(attrs, ['BORE', 'NOMINAL_BORE', 'NOMINALBORE', 'OUTSIDE_DIAMETER', 'OUTSIDEDIAMETER', 'OD', 'NPD', 'ABORE', 'LBORE', 'HBOR', 'TBOR']);
  const branchBore = readBore(attrs, ['BRANCH_BORE', 'BRANCHBORE', 'BBORE', 'CBORE', 'OD3', 'BORE3', 'NPD3']);
  const cref = text(attrs.CREF);

  if (TWO_PORT_TYPES.has(canonicalType)) {
    const roles = canonicalType === 'REDUCER' ? ['LARGE_END', 'SMALL_END'] : ['INLET', 'OUTLET'];
    const axial = canonicalType !== 'ELBOW';
    return [
      makePort(componentId, branchId, roles[0], apos, sourceIndex, {
        tangent: axial ? tangentFrom(lpos, apos) : null,
        boreMm: inletBore ?? commonBore,
      }),
      makePort(componentId, branchId, roles[1], lpos, sourceIndex, {
        tangent: axial ? tangentFrom(apos, lpos) : null,
        boreMm: outletBore ?? commonBore,
      }),
    ];
  }
  if (canonicalType === 'TEE') {
    return [
      makePort(componentId, branchId, 'RUN_IN', apos, sourceIndex, {
        tangent: tangentFrom(centre || lpos, apos), boreMm: inletBore ?? commonBore,
      }),
      makePort(componentId, branchId, 'RUN_OUT', lpos, sourceIndex, {
        tangent: tangentFrom(centre || apos, lpos), boreMm: outletBore ?? commonBore,
      }),
      makePort(componentId, branchId, 'BRANCH_OUT', branchPoint, sourceIndex, {
        tangent: branchPoint && centre ? tangentFrom(centre, branchPoint) : null,
        boreMm: branchBore, referenceTarget: cref,
      }),
    ];
  }
  if (canonicalType === 'OLET') {
    return [
      makePort(componentId, branchId, 'HOST_ATTACHMENT', centre || apos, sourceIndex, { boreMm: inletBore ?? commonBore }),
      makePort(componentId, branchId, 'BRANCH_OUT', branchPoint, sourceIndex, {
        tangent: branchPoint && centre ? tangentFrom(centre, branchPoint) : null,
        boreMm: branchBore, referenceTarget: cref,
      }),
    ];
  }
  if (TERMINAL_TYPES.has(canonicalType)) {
    return [makePort(componentId, branchId, 'TERMINAL', apos || lpos || centre, sourceIndex, { boreMm: commonBore })];
  }
  return [];
}

function buildComponent(child, branchId, sourceIndex) {
  const attrs = child?.attributes && typeof child.attributes === 'object' ? child.attributes : {};
  const canonicalType = canonicalComponentType(child?.type || attrs.TYPE);
  if (!canonicalType) return null;
  const sourceComponentId = componentIdentity(child, branchId, sourceIndex);
  const componentId = `COMP-${stableToken(`${branchId}|${sourceComponentId}|${sourceIndex}`)}`;
  const ports = buildComponentPorts(componentId, branchId, canonicalType, attrs, sourceIndex);
  return Object.freeze({
    componentId, sourceComponentId, sourceName: text(child?.name), branchId, sourceIndex,
    sourceType: text(child?.type || attrs.TYPE).toUpperCase(), canonicalType, attributes: attrs,
    ports: Object.freeze(ports),
    geometry: Object.freeze({
      centre: clonePoint(attrs.POS || attrs.CPOS || attrs.CENTRE || attrs.CENTER),
      radiusMm: number(attrs.BEND_RADIUS || attrs.BENDRADIUS || attrs.RADIUS || attrs.RADI),
      angleDeg: number(attrs.ANGLE || attrs.BEND_ANGLE || attrs.BENDANGLE || attrs.ANGL),
      eccentricOffsetMm: number(attrs.ECCENTRIC_OFFSET || attrs.ECCENTRICOFFSET),
    }),
    cref: text(attrs.CREF), shadowCarrierEvidence: null,
  });
}

function exactPoint(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y && left.z === right.z);
}
function componentSpan(component) {
  const positioned = component.ports.filter((port) => port.sourcePosition);
  if (positioned.length < 2) return null;
  return { start: positioned[0].sourcePosition, end: positioned[1].sourcePosition };
}
function identicalSpan(left, right) {
  const a = componentSpan(left); const b = componentSpan(right);
  if (!a || !b || exactPoint(a.start, a.end) || exactPoint(b.start, b.end)) return null;
  if (exactPoint(a.start, b.start) && exactPoint(a.end, b.end)) return 'SAME_DIRECTION';
  if (exactPoint(a.start, b.end) && exactPoint(a.end, b.start)) return 'REVERSED_DIRECTION';
  return null;
}
function isSyntheticAutoPipe(component) {
  return component.canonicalType === 'PIPE' && /^PIPE\s+AUTO\b/iu.test(component.sourceName || component.sourceComponentId);
}
function shadowPair(left, right) {
  const pipe = isSyntheticAutoPipe(left) ? left : isSyntheticAutoPipe(right) ? right : null;
  const primary = pipe === left ? right : pipe === right ? left : null;
  if (!pipe || !primary || !SHADOW_PRIMARY_TYPES.has(primary.canonicalType)) return null;
  const orientation = identicalSpan(pipe, primary);
  return orientation ? { pipe, primary, orientation } : null;
}
function shadowEvidence(pipe, orientation) {
  return Object.freeze({
    schema: 'SequentialShadowCarrierEvidence.v1', componentId: pipe.componentId,
    sourceComponentId: pipe.sourceComponentId, sourceName: pipe.sourceName,
    sourceIndex: pipe.sourceIndex, sourceType: pipe.sourceType,
    canonicalType: pipe.canonicalType, orientation, attributes: pipe.attributes, ports: pipe.ports,
  });
}
function collapseSyntheticCarrierShadows(sourceComponents) {
  const suppressed = new Set(); const shadows = new Map();
  for (let index = 0; index < sourceComponents.length - 1; index += 1) {
    const pair = shadowPair(sourceComponents[index], sourceComponents[index + 1]);
    if (!pair || suppressed.has(pair.pipe.componentId) || shadows.has(pair.primary.componentId)) continue;
    suppressed.add(pair.pipe.componentId);
    shadows.set(pair.primary.componentId, shadowEvidence(pair.pipe, pair.orientation));
  }
  return sourceComponents.filter((component) => !suppressed.has(component.componentId)).map((component) => {
    const shadow = shadows.get(component.componentId);
    return shadow ? Object.freeze({ ...component, shadowCarrierEvidence: shadow }) : component;
  });
}

function buildBranch(record, sourceBranchIndex) {
  const branchId = branchIdentity(record);
  const attrs = record?.attributes && typeof record.attributes === 'object' ? record.attributes : {};
  const children = Array.isArray(record?.children) ? record.children : [];
  const sourceComponents = children
    .map((child, sourceIndex) => buildComponent(child, branchId, sourceIndex))
    .filter(Boolean)
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  const collapsed = collapseSyntheticCarrierShadows(sourceComponents);
  const components = orderSequentialComponentsByGeometry(collapsed, clonePoint(attrs.HPOS));
  return Object.freeze({
    branchId, sourceBranchIndex, sourceRecord: record,
    headPosition: clonePoint(attrs.HPOS), tailPosition: clonePoint(attrs.TPOS),
    href: text(attrs.HREF), tref: text(attrs.TREF),
    sourceRouteComponentCount: sourceComponents.length,
    shadowCarrierCount: sourceComponents.length - components.length,
    routeSequenceBasis: components.every((component) => component.routeSequenceBasis === 'GEOMETRY_PORT_CONTINUITY')
      ? 'GEOMETRY_PORT_CONTINUITY'
      : 'GEOMETRY_WITH_REVIEWABLE_FRAGMENTS',
    components,
  });
}

function addMulti(map, key, value) {
  const normalized = text(key);
  if (!normalized) return;
  const rows = map.get(normalized) || [];
  if (!rows.some((row) => row.componentId === value.componentId)) rows.push(value);
  map.set(normalized, rows);
}
function addComponentAliases(componentReferences, component) {
  addMulti(componentReferences, component.sourceComponentId, component);
  addMulti(componentReferences, component.sourceName, component);
  addMulti(componentReferences, component.attributes?.NAME, component);
  addMulti(componentReferences, component.attributes?.REF, component);
  const shadow = component.shadowCarrierEvidence;
  if (shadow) {
    addMulti(componentReferences, shadow.sourceComponentId, component);
    addMulti(componentReferences, shadow.sourceName, component);
    addMulti(componentReferences, shadow.attributes?.NAME, component);
    addMulti(componentReferences, shadow.attributes?.REF, component);
  }
}

export function buildSequentialEvidenceModel(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array.');
  const branches = records
    .map((record, index) => String(record?.type || '').toUpperCase() === 'BRANCH' ? buildBranch(record, index) : null)
    .filter((branch) => branch?.branchId);
  const branchIds = new Set();
  for (const branch of branches) {
    if (branchIds.has(branch.branchId)) throw new Error(`Duplicate branch identity: ${branch.branchId}`);
    branchIds.add(branch.branchId);
  }
  const components = branches.flatMap((branch) => branch.components);
  const ports = components.flatMap((component) => component.ports);
  return Object.freeze({
    schema: 'SequentialSourceEvidence.v1',
    branches: Object.freeze(branches), components: Object.freeze(components), ports: Object.freeze(ports),
    audit: Object.freeze({
      sourceRouteComponentCount: branches.reduce((sum, branch) => sum + branch.sourceRouteComponentCount, 0),
      activeRouteComponentCount: components.length,
      shadowCarrierCount: branches.reduce((sum, branch) => sum + branch.shadowCarrierCount, 0),
      geometryOrderedBranchCount: branches.filter((branch) => branch.routeSequenceBasis === 'GEOMETRY_PORT_CONTINUITY').length,
    }),
  });
}

export function indexSequentialEvidence(model) {
  const componentReferences = new Map();
  for (const component of model.components) addComponentAliases(componentReferences, component);
  return Object.freeze({
    branches: new Map(model.branches.map((branch) => [branch.branchId, branch])),
    components: new Map(model.components.map((component) => [component.componentId, component])),
    ports: new Map(model.ports.map((port) => [port.portId, port])),
    componentReferences,
  });
}

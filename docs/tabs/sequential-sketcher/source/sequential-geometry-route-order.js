import { DEFAULT_TOLERANCE_MM } from '../sequential-sketcher-contract.js';

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function routePorts(component) {
  const inline = (component?.ports || []).filter((port) => port.sourcePosition && port.role !== 'BRANCH_OUT');
  return inline.length ? inline : (component?.ports || []).filter((port) => port.sourcePosition);
}

function nearestPort(component, point) {
  const ports = routePorts(component);
  if (!ports.length) return { port: null, gapMm: Number.POSITIVE_INFINITY };
  if (!point) return { port: ports[0], gapMm: null };
  return ports.map((port) => ({ port, gapMm: distance(point, port.sourcePosition) }))
    .sort((a, b) => a.gapMm - b.gapMm || a.port.portId.localeCompare(b.port.portId))[0];
}

function exitPort(component, entry) {
  const ports = routePorts(component);
  if (!ports.length) return null;
  if (!entry || ports.length === 1) return ports[0];
  const other = ports.filter((port) => port.portId !== entry.portId);
  if (!other.length) return entry;
  return other.map((port) => ({ port, span: distance(entry.sourcePosition, port.sourcePosition) }))
    .sort((a, b) => b.span - a.span || a.port.portId.localeCompare(b.port.portId))[0].port;
}

function isAttachmentEvent(component) {
  return component?.canonicalType === 'OLET' && routePorts(component).length <= 1;
}

function carrierPriority(component) {
  if (['CAP', 'BLIND'].includes(component?.canonicalType)) return 2;
  return routePorts(component).length <= 1 ? 1 : 0;
}

function fallback(components) {
  return Object.freeze(components.map((component, routeIndex) => Object.freeze({
    ...component,
    routeIndex,
    routeEntryPortId: routePorts(component)[0]?.portId || null,
    routeExitPortId: routePorts(component).at(-1)?.portId || null,
    routeGapMm: null,
    routeSequenceBasis: 'SOURCE_ORDER_FALLBACK_NO_HPOS',
  })));
}

function orderCarriers(components, headPosition, toleranceMm) {
  const remaining = [...components];
  const ordered = [];
  let cursor = headPosition;
  while (remaining.length) {
    const ranked = remaining.map((component) => ({
      component,
      entry: nearestPort(component, cursor),
      priority: carrierPriority(component),
    })).sort((a, b) => (
      a.entry.gapMm - b.entry.gapMm
      || a.priority - b.priority
      || a.component.sourceIndex - b.component.sourceIndex
      || a.component.componentId.localeCompare(b.component.componentId)
    ));
    const selected = ranked[0];
    remaining.splice(remaining.findIndex((row) => row.componentId === selected.component.componentId), 1);
    const exit = exitPort(selected.component, selected.entry.port);
    const gapMm = Number.isFinite(selected.entry.gapMm) ? selected.entry.gapMm : null;
    ordered.push({
      component: selected.component,
      entry: selected.entry.port,
      exit,
      gapMm,
      basis: gapMm !== null && gapMm <= toleranceMm
        ? 'GEOMETRY_PORT_CONTINUITY'
        : 'GEOMETRY_NEAREST_FRAGMENT',
    });
    cursor = exit?.sourcePosition || selected.entry.port?.sourcePosition || cursor;
  }
  return ordered;
}

function projection(point, start, end) {
  if (!point || !start || !end) return { gapMm: Number.POSITIVE_INFINITY, t: 0 };
  const dx = end.x - start.x; const dy = end.y - start.y; const dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared <= 1e-12) return { gapMm: distance(point, start), t: 0 };
  const raw = ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared;
  const t = Math.max(0, Math.min(1, raw));
  const projected = { x: start.x + t * dx, y: start.y + t * dy, z: start.z + t * dz };
  return { gapMm: distance(point, projected), t };
}

function assignEvent(event, carriers) {
  const point = routePorts(event)[0]?.sourcePosition || event.geometry?.centre || null;
  const ranked = carriers.map((carrier, carrierIndex) => {
    const start = carrier.entry?.sourcePosition;
    const end = carrier.exit?.sourcePosition || start;
    const hit = projection(point, start, end);
    const boundaryPreference = hit.t <= 1e-9 ? 0 : hit.t >= 1 - 1e-9 ? 2 : 1;
    return { carrierIndex, ...hit, boundaryPreference };
  }).sort((a, b) => (
    a.gapMm - b.gapMm
    || a.boundaryPreference - b.boundaryPreference
    || a.carrierIndex - b.carrierIndex
  ));
  return { point, ...(ranked[0] || { carrierIndex: 0, gapMm: Number.POSITIVE_INFINITY, t: 0 }) };
}

function decorate(component, routeIndex, entry, exit, gapMm, basis) {
  return Object.freeze({
    ...component,
    routeIndex,
    routeEntryPortId: entry?.portId || null,
    routeExitPortId: exit?.portId || entry?.portId || null,
    routeGapMm: Number.isFinite(gapMm) ? gapMm : null,
    routeSequenceBasis: basis,
  });
}

export function orderSequentialComponentsByGeometry(components, headPosition, options = {}) {
  if (!Array.isArray(components)) throw new TypeError('Sequential components must be an array.');
  if (!components.length) return Object.freeze([]);
  if (!headPosition) return fallback(components);

  const toleranceMm = Math.max(0, Number(options.toleranceMm ?? DEFAULT_TOLERANCE_MM));
  const events = components.filter(isAttachmentEvent);
  const carriers = orderCarriers(components.filter((component) => !isAttachmentEvent(component)), headPosition, toleranceMm);
  if (!carriers.length) return fallback(components);

  const groupedEvents = new Map();
  for (const event of events) {
    const assigned = assignEvent(event, carriers);
    const rows = groupedEvents.get(assigned.carrierIndex) || [];
    rows.push({ event, ...assigned });
    groupedEvents.set(assigned.carrierIndex, rows);
  }
  for (const rows of groupedEvents.values()) {
    rows.sort((a, b) => a.t - b.t || a.event.sourceIndex - b.event.sourceIndex || a.event.componentId.localeCompare(b.event.componentId));
  }

  const ordered = [];
  let cursor = headPosition;
  carriers.forEach((carrier, carrierIndex) => {
    for (const assigned of groupedEvents.get(carrierIndex) || []) {
      const eventPort = routePorts(assigned.event)[0] || null;
      const gapMm = eventPort?.sourcePosition ? distance(cursor, eventPort.sourcePosition) : null;
      ordered.push(decorate(
        assigned.event,
        ordered.length,
        eventPort,
        eventPort,
        gapMm,
        assigned.gapMm <= toleranceMm ? 'GEOMETRY_ATTACHMENT_EVENT' : 'GEOMETRY_ATTACHMENT_OFF_CARRIER',
      ));
      cursor = eventPort?.sourcePosition || cursor;
    }
    const entryGapMm = carrier.entry?.sourcePosition ? distance(cursor, carrier.entry.sourcePosition) : carrier.gapMm;
    ordered.push(decorate(
      carrier.component,
      ordered.length,
      carrier.entry,
      carrier.exit,
      entryGapMm,
      carrier.basis,
    ));
    cursor = carrier.exit?.sourcePosition || carrier.entry?.sourcePosition || cursor;
  });
  return Object.freeze(ordered);
}

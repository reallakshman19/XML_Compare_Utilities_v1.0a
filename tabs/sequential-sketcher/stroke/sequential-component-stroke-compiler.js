function point(port) { return port?.sourcePosition ? { ...port.sourcePosition } : null; }
function command(op, component, fields = {}) {
  return Object.freeze({
    op,
    componentId: component.componentId,
    sourceComponentId: component.sourceComponentId,
    branchId: component.branchId,
    componentType: component.canonicalType,
    shadowCarrierEvidence: component.shadowCarrierEvidence || null,
    ...fields,
  });
}

export function reversibleComponentEntryPorts(component) {
  if (!component || ['OLET', 'CAP', 'BLIND'].includes(component.canonicalType)) return Object.freeze([]);
  if (component.canonicalType === 'TEE') {
    return Object.freeze(component.ports.filter((port) => ['RUN_IN', 'RUN_OUT'].includes(port.role)));
  }
  if (component.ports.length === 2) return Object.freeze([...component.ports]);
  return Object.freeze([]);
}

export function resolveComponentTraversal(component, entryPortId) {
  const entry = component.ports.find((port) => port.portId === entryPortId) || null;
  if (!entry) return { status: 'ENTRY_PORT_NOT_FOUND', entry: null, exit: null, pendingBranchPort: null };
  const byRole = new Map(component.ports.map((port) => [port.role, port]));

  if (component.ports.length === 1) return { status: 'TERMINAL_COMPONENT', entry, exit: null, pendingBranchPort: null };
  if (component.canonicalType === 'TEE') {
    if (entry.role === 'RUN_IN') return { status: 'RESOLVED', entry, exit: byRole.get('RUN_OUT') || null, pendingBranchPort: byRole.get('BRANCH_OUT') || null };
    if (entry.role === 'RUN_OUT') return { status: 'RESOLVED', entry, exit: byRole.get('RUN_IN') || null, pendingBranchPort: byRole.get('BRANCH_OUT') || null };
    return { status: 'TEE_ENTERED_FROM_BRANCH', entry, exit: null, pendingBranchPort: null };
  }
  if (component.canonicalType === 'OLET') {
    return { status: 'OLET_ATTACHMENT', entry, exit: null, pendingBranchPort: byRole.get('BRANCH_OUT') || null };
  }
  const exit = component.ports.find((port) => port.portId !== entry.portId) || null;
  return { status: exit ? 'RESOLVED' : 'EXIT_PORT_NOT_FOUND', entry, exit, pendingBranchPort: null };
}

export function compileComponentStrokes(component, traversal) {
  const entry = traversal.entry; const exit = traversal.exit;
  const common = {
    entryPortId: entry?.portId || null,
    exitPortId: exit?.portId || null,
    entryPosition: point(entry),
    exitPosition: point(exit),
    centre: component.geometry?.centre || null,
  };
  switch (component.canonicalType) {
    case 'PIPE': return [command('DRAW_PIPE', component, common)];
    case 'ELBOW': return [command('DRAW_ELBOW', component, { ...common, radiusMm: component.geometry?.radiusMm, angleDeg: component.geometry?.angleDeg })];
    case 'REDUCER': return [command('DRAW_REDUCER', component, { ...common, inletBoreMm: entry?.boreMm ?? null, outletBoreMm: exit?.boreMm ?? null, eccentricOffsetMm: component.geometry?.eccentricOffsetMm ?? null })];
    case 'TEE': return [
      command('DRAW_TEE_RUN', component, { ...common, branchPortId: traversal.pendingBranchPort?.portId || null, branchPosition: point(traversal.pendingBranchPort) }),
      command('REGISTER_TEE_BRANCH', component, { branchPortId: traversal.pendingBranchPort?.portId || null, branchPosition: point(traversal.pendingBranchPort), referenceTarget: traversal.pendingBranchPort?.referenceTarget || component.cref || '' }),
    ];
    case 'OLET': return [
      command('DRAW_OLET', component, { hostPortId: entry?.portId || null, hostPosition: point(entry), branchPortId: traversal.pendingBranchPort?.portId || null, branchPosition: point(traversal.pendingBranchPort) }),
      command('REGISTER_OLET_BRANCH', component, { branchPortId: traversal.pendingBranchPort?.portId || null, branchPosition: point(traversal.pendingBranchPort), referenceTarget: traversal.pendingBranchPort?.referenceTarget || component.cref || '' }),
    ];
    case 'VALVE': return [command('DRAW_VALVE', component, common)];
    case 'INSTRUMENT': return [command('DRAW_INSTRUMENT', component, common)];
    case 'FLANGE': return [command('DRAW_FLANGE', component, common)];
    case 'GASKET': return [command('DRAW_GASKET', component, common)];
    case 'CAP':
    case 'BLIND': return [command('DRAW_CAP', component, { entryPortId: entry?.portId || null, entryPosition: point(entry) })];
    default: return [command('DRAW_COMPONENT', component, common)];
  }
}

export function compileRepairStroke(connection) {
  return Object.freeze({
    op: 'DRAW_VIRTUAL_REPAIR',
    connectionId: connection.connectionId,
    fromPortId: connection.fromPortId,
    toPortId: connection.toPortId,
    fromPosition: connection.fromPosition,
    toPosition: connection.toPosition,
    gapMm: connection.gapMm,
    repairPolicy: connection.repairPolicy,
  });
}

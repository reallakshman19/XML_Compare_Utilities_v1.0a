import { buildBranchInventory } from '../sequential-sketcher-source.js';
import { buildPipeSupportProjectionBundle } from './sj-pipe-support-projection.js';

function clonePoint(point) { return point ? { x: point.x, y: point.y, z: point.z } : null; }
function cleanText(value) { return String(value ?? '').trim(); }
function uniqueText(values) { return [...new Set(values.map(cleanText).filter(Boolean))]; }
function strokeByComponent(confirmed) {
  const rows = new Map();
  for (const stroke of confirmed.strokeLedger) {
    if (!stroke.componentId || !stroke.op.startsWith('DRAW_')) continue;
    if (!rows.has(stroke.componentId)) rows.set(stroke.componentId, stroke);
  }
  return rows;
}
function traversalFor(component, stroke) {
  const firstPort = component.ports[0];
  const entryPortId = stroke?.entryPortId || stroke?.hostPortId || null;
  const reversedForTraversal = Boolean(firstPort && entryPortId && firstPort.portId !== entryPortId);
  return {
    sourceStartField: 'APOS',
    traversalStartField: reversedForTraversal ? 'LPOS' : 'APOS',
    reversedForTraversal,
  };
}
function fittingPorts(component) {
  return component.ports.map((port) => ({
    portId: port.portId,
    role: port.role,
    position: clonePoint(port.sourcePosition),
    boreMm: port.boreMm,
  }));
}
function carrierReferences(component) {
  const shadow = component.shadowCarrierEvidence;
  return uniqueText([
    component.componentId,
    component.sourceComponentId,
    component.sourceName,
    component.attributes?.NAME,
    component.attributes?.REF,
    shadow?.componentId,
    shadow?.sourceComponentId,
    shadow?.sourceName,
    shadow?.attributes?.NAME,
    shadow?.attributes?.REF,
  ]);
}
function carrierFromComponent(component, stroke) {
  const entryPosition = clonePoint(stroke?.entryPosition || stroke?.hostPosition);
  const exitPosition = clonePoint(stroke?.exitPosition || stroke?.branchPosition);
  const centerline = entryPosition && exitPosition ? {
    start: entryPosition,
    end: exitPosition,
    lengthMm: Math.hypot(
      exitPosition.x - entryPosition.x,
      exitPosition.y - entryPosition.y,
      exitPosition.z - entryPosition.z,
    ),
  } : null;
  const ports = fittingPorts(component);
  const shadow = component.shadowCarrierEvidence;
  return {
    carrierId: component.componentId,
    sourceRef: component.sourceComponentId,
    ref: component.sourceComponentId,
    name: component.sourceComponentId,
    references: carrierReferences(component),
    carrierType: component.canonicalType,
    sourceBranchId: component.branchId,
    sourceSequenceIndex: shadow
      ? Math.min(component.sourceIndex, shadow.sourceIndex)
      : component.sourceIndex,
    attributes: component.attributes,
    shadowCarrierEvidence: shadow || null,
    traversal: traversalFor(component, stroke),
    centerline,
    ports,
    componentCentre: clonePoint(component.geometry?.centre),
    fittingGeometry: {
      ports,
      componentCentre: clonePoint(component.geometry?.centre),
      radiusMm: component.geometry?.radiusMm ?? null,
      angleDeg: component.geometry?.angleDeg ?? null,
    },
  };
}

export function buildConfirmedConstructionSupportProjection(confirmed, indexes, options = {}) {
  if (confirmed?.schema !== 'ConfirmedSequentialConstruction.v1') {
    throw new TypeError('Support projection requires ConfirmedSequentialConstruction.v1.');
  }
  if (!confirmed.downstreamEligibility?.supportProjection) {
    throw new Error('Confirmed construction is not eligible for support projection.');
  }
  const strokes = strokeByComponent(confirmed);
  const branchBundles = [];
  const diagnostics = [];

  for (const branchId of confirmed.branchIds) {
    const branch = indexes.branches.get(branchId);
    if (!branch) {
      diagnostics.push({ severity: 'ERROR', code: 'SUPPORT_BRANCH_EVIDENCE_MISSING', branchId });
      continue;
    }
    const inventory = buildBranchInventory(branch.sourceRecord);
    const components = confirmed.components.filter((component) => component.branchId === branchId);
    const carriers = components.map((component) => carrierFromComponent(component, strokes.get(component.componentId)));
    const bundle = buildPipeSupportProjectionBundle({
      branchId,
      branchAliases: options.branchAliases?.[branchId] || [],
      coordinateSystem: { units: 'mm', globalAxes: options.globalAxes },
      carriers,
      supportRecords: inventory.supportRecords,
      projectionToleranceMm: options.projectionToleranceMm ?? 50,
      onCenterlineToleranceMm: options.onCenterlineToleranceMm ?? 0.001,
      ambiguityToleranceMm: options.ambiguityToleranceMm ?? 1,
      plantUp: options.plantUp,
    });
    branchBundles.push(bundle);
    diagnostics.push(...bundle.diagnostics.map((row) => ({ ...row, branchId })));
  }

  return Object.freeze({
    schema: 'SequentialConfirmedSupportProjection.v1',
    constructionFingerprint: confirmed.constructionFingerprint,
    branchBundles: Object.freeze(branchBundles),
    supportGlyphs: Object.freeze(branchBundles.flatMap((bundle) => bundle.supportGlyphs)),
    unresolvedSupportFamilies: Object.freeze(branchBundles.flatMap((bundle) => bundle.unresolvedSupportFamilies)),
    diagnostics: Object.freeze(diagnostics),
    audit: Object.freeze({
      branchBundleCount: branchBundles.length,
      supportGlyphCount: branchBundles.reduce((sum, bundle) => sum + bundle.supportGlyphs.length, 0),
      unresolvedSupportFamilyCount: branchBundles.reduce((sum, bundle) => sum + bundle.unresolvedSupportFamilies.length, 0),
      shadowCarrierCount: confirmed.audit?.shadowCarrierCount || 0,
      constructionMutated: false,
    }),
  });
}

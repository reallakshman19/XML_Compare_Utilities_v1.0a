import { buildSupportCarrierAnalyticalGeometry } from './support-carrier-analytical-geometry.js';
import { resolveSupportLineContext } from './support-steel-line-context.js';
import { transformPoint } from './support-steel-world-matrix.js';
import {
  cleanText,
  cloneJson,
  normalizeIdentity,
  readPosition,
  sourceAttributes,
  sourceIdentity,
  sourceType,
  walkSupportSteelHierarchy,
} from './support-steel-source-utils.js';

export const SUPPORT_CARRIER_CATALOG_SCHEMA = 'SupportCarrierCatalog.v1';

const PHYSICAL_CARRIER_TYPES = new Set([
  'PIPE', 'TUBE', 'PIPE_SEGMENT', 'STRAIGHT_PIPE', 'PIPING_PIPE', 'PIPE_COMPONENT',
]);
const BRANCH_CONTEXT_TYPES = new Set(['BRANCH', 'PIPE_BRANCH', 'PIPING_BRANCH', 'BRAN']);
const CARRIER_REFERENCE_KEYS = Object.freeze([
  'CARRIER_ID', 'CARRIER_REF', 'PIPE_REF', 'PIPE_ID', 'PIPEID',
]);

export function collectSupportCarrierCatalog(source) {
  if (source?.schema === 'PipeSupportProjectionBundle.v1') {
    return collectProjectionCarrierCatalog(source);
  }
  const carrierObjects = [];
  const branchContexts = [];
  for (const row of walkSupportSteelHierarchy(source)) {
    const attrs = sourceAttributes(row.node);
    const identity = sourceIdentity(row.node, attrs);
    const type = sourceType(row.node, attrs);
    if (PHYSICAL_CARRIER_TYPES.has(type)) {
      carrierObjects.push(carrierRecord(row, attrs, identity, type));
    } else if (BRANCH_CONTEXT_TYPES.has(type)) {
      branchContexts.push(branchContextRecord(row, attrs, identity, type));
    }
  }
  return {
    schema: SUPPORT_CARRIER_CATALOG_SCHEMA,
    carrierObjects: uniqueById(carrierObjects, 'carrierObjectId'),
    branchContexts: uniqueById(branchContexts, 'branchContextId'),
  };
}

export function normalizeCarrierId(value) {
  const text = cleanText(value).replace(/\(REF\)$/iu, '');
  return text ? normalizeIdentity(text) : '';
}

export function carrierReference(attrs = {}) {
  return normalizeCarrierId(firstValue(attrs, CARRIER_REFERENCE_KEYS));
}

function collectProjectionCarrierCatalog(bundle) {
  const lineContext = projectionLineContext(bundle);
  const carrierObjects = (bundle.carriers || []).map((carrier, index) => {
    const carrierObjectId = normalizeCarrierId(
      carrier.carrierId || carrier.id || `CARRIER-${index + 1}`,
    );
    return withCarrierGeometry({
      schema: SUPPORT_CARRIER_CATALOG_SCHEMA,
      carrierObjectId,
      carrierObjectClass: 'PROJECTION_CARRIER',
      sourceRecordType: cleanText(carrier.type || 'PROJECTION_CARRIER').toUpperCase(),
      sourcePath: ['carriers', index],
      positionGlobal: carrier.positionGlobal || carrier.position || null,
      worldMatrix: carrier.worldMatrix || null,
      transformBasis: carrier.transformBasis || 'IDENTITY',
      lineContext: {
        ...lineContext,
        carrierId: carrierObjectId,
        contextEvidence: unique([
          ...(lineContext.contextEvidence || []),
          'PROJECTION_CARRIER_OBJECT',
        ]),
      },
      attributes: cloneJson(carrier.attributes || carrier.geometry || {}),
      physicalCarrierObjectAvailable: true,
      contactEvidenceStatus: 'NOT_PROVEN',
    });
  });
  return {
    schema: SUPPORT_CARRIER_CATALOG_SCHEMA,
    carrierObjects: uniqueById(carrierObjects, 'carrierObjectId'),
    branchContexts: lineContext.branchNode ? [{
      schema: SUPPORT_CARRIER_CATALOG_SCHEMA,
      branchContextId: normalizeCarrierId(lineContext.branchNode),
      sourceRecordType: 'PROJECTION_BRANCH',
      sourcePath: ['branchId'],
      lineContext,
      physicalCarrierObjectAvailable: false,
    }] : [],
  };
}

function carrierRecord(row, attrs, identity, type) {
  const carrierObjectId = carrierReference(attrs) || normalizeCarrierId(identity);
  return withCarrierGeometry({
    schema: SUPPORT_CARRIER_CATALOG_SCHEMA,
    carrierObjectId,
    carrierObjectClass: 'PHYSICAL_PIPE_CARRIER',
    sourceRecordType: type,
    sourcePath: row.path,
    positionGlobal: sourcePositionGlobal(row, attrs),
    worldMatrix: [...(row.worldMatrix || [])],
    transformBasis: row.transformBasis || 'IDENTITY',
    lineContext: { ...resolveSupportLineContext(row, attrs), carrierId: carrierObjectId },
    attributes: cloneJson(attrs),
    physicalCarrierObjectAvailable: true,
    contactEvidenceStatus: 'NOT_PROVEN',
  });
}

function withCarrierGeometry(carrier) {
  const analyticalGeometry = buildSupportCarrierAnalyticalGeometry(carrier);
  return {
    ...carrier,
    analyticalGeometry,
    analyticalCarrierGeometryAvailable: Boolean(
      analyticalGeometry.physicalCarrierGeometryAvailable,
    ),
  };
}

function branchContextRecord(row, attrs, identity, type) {
  const branchContextId = normalizeCarrierId(
    identity || firstValue(attrs, ['BRANCH_ID', 'BRANCH_NODE']),
  );
  const fullLineTag = cleanText(attrs.FULL_LINE_TAG || attrs.LINE_TAG)
    || cleanText(branchContextId)
      .replace(/^\//u, '')
      .replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, '');
  return {
    schema: SUPPORT_CARRIER_CATALOG_SCHEMA,
    branchContextId,
    sourceRecordType: type,
    sourcePath: row.path,
    lineContext: {
      branchNode: branchContextId,
      fullLineTag: fullLineTag || null,
      lineFamily: cleanText(attrs.LINE_FAMILY) || fullLineTag || null,
      contextQuality: 'MEDIUM',
      contextEvidence: ['TYPED_BRANCH_CONTEXT_OBJECT'],
      ownerFallbackUsed: false,
    },
    physicalCarrierObjectAvailable: false,
  };
}

function projectionLineContext(bundle) {
  const branchNode = normalizeCarrierId(bundle.branchId);
  const fullLineTag = cleanText(bundle.fullLineTag || bundle.lineTag)
    || cleanText(branchNode)
      .replace(/^\//u, '')
      .replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, '');
  return {
    branchNode: branchNode || null,
    fullLineTag: fullLineTag || null,
    lineFamily: cleanText(bundle.lineFamily) || fullLineTag || null,
    contextQuality: branchNode ? 'HIGH' : 'NONE',
    contextEvidence: branchNode ? ['PROJECTION_BUNDLE_BRANCH'] : [],
    ownerFallbackUsed: false,
  };
}

function sourcePositionGlobal(row, attrs) {
  const point = readPosition(attrs, [
    'WORLD_POS', 'WORLD_POSITION', 'POS', 'POSITION', 'CENTRE', 'CENTER', 'ORIGIN',
  ]);
  if (!point) return null;
  const coordinateSpace = cleanText(
    attrs.POSITION_COORDINATE_SPACE || attrs.COORDINATE_SPACE,
  ).toUpperCase();
  if (coordinateSpace === 'WORLD' || coordinateSpace === 'GLOBAL') return point;
  if (row.transformBasis && row.transformBasis !== 'IDENTITY' && row.worldMatrix?.length === 16) {
    return transformPoint(row.worldMatrix, point);
  }
  return point;
}

function uniqueById(rows, key) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = token(row[key]);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function firstValue(attrs, keys) {
  for (const key of keys || []) {
    const value = cleanText(attrs?.[key]);
    if (value) return value;
  }
  return '';
}

function token(value) {
  return cleanText(value).replace(/\(REF\)$/iu, '').toUpperCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

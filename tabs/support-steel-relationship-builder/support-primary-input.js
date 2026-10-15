import { parseSupportMemberRelationshipXml } from '../ps-family-clash-audit/ps-family-psclash-xml-parser.js';
import { buildSupportPrimaryRelationshipBundle } from './support-primary-relationship.js';
import {
  deriveSupportReportReferenceZoneScope,
  discoverSupportReportZones,
  normalizeSupportReportZoneScope,
  scopeSupportRelationshipRows,
} from './support-report-zone-scope.js';

export const SUPPORT_PRIMARY_INPUT_SCHEMA = 'SupportPrimaryInput.v1';
export const SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS = 'REFERENCE_SUPPORT_REPORT_EXACT_ANCESTRY';

export function buildSupportPrimaryRelationshipInput(xmlText, options = {}) {
  const zoneScope = normalizeSupportReportZoneScope(options.zoneScope || {});
  const parsed = parseSupportMemberRelationshipXml(
    String(xmlText || ''),
    options.parserOptions || {},
    options.sourceInput || 'Clash within Supports',
  );
  return buildInputFromParsed(parsed, zoneScope, {
    scopeBasis: options.scopeBasis || (zoneScope.active ? 'EXPLICIT_ZONE_SCOPE' : 'UNRESTRICTED'),
    failClosedWithoutScope: Boolean(options.failClosedWithoutScope),
    zoneCatalog: options.zoneCatalog || null,
  });
}

export function buildReferenceSupportPrimaryRelationshipInput(xmlText, referenceEvidence, options = {}) {
  const zoneCatalog = discoverSupportReportZones(referenceEvidence?.rows || []);
  const zoneScope = deriveSupportReportReferenceZoneScope(referenceEvidence?.rows || []);
  const parsed = parseSupportMemberRelationshipXml(
    String(xmlText || ''),
    options.parserOptions || {},
    options.sourceInput || 'Reference Clash within Supports',
  );
  return buildInputFromParsed(parsed, zoneScope, {
    scopeBasis: SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS,
    failClosedWithoutScope: true,
    zoneCatalog,
  });
}

function buildInputFromParsed(parsed, zoneScope, options = {}) {
  const failClosed = Boolean(options.failClosedWithoutScope && !zoneScope.active);
  const scopedRows = failClosed
    ? Object.freeze([])
    : scopeSupportRelationshipRows(parsed.rows || [], zoneScope);
  const bundle = buildSupportPrimaryRelationshipBundle({
    relationshipRows: scopedRows,
    zoneScope,
  });
  return Object.freeze({
    schema: SUPPORT_PRIMARY_INPUT_SCHEMA,
    zoneScope,
    scopeBasis: options.scopeBasis || '',
    scopeAvailable: zoneScope.active || !options.failClosedWithoutScope,
    zoneCatalog: options.zoneCatalog ? Object.freeze({
      primaryZones: Object.freeze([...(options.zoneCatalog.primaryZones || [])]),
      secondaryZones: Object.freeze([...(options.zoneCatalog.secondaryZones || [])]),
    }) : null,
    parsedRowCount: parsed.rows?.length || 0,
    scopedRowCount: scopedRows.length,
    excludedByZoneCount: Math.max(0, (parsed.rows?.length || 0) - scopedRows.length),
    parsedDiagnostics: Object.freeze([...(parsed.diagnostics || [])]),
    bundle,
  });
}

export const _test = Object.freeze({
  buildInputFromParsed,
});

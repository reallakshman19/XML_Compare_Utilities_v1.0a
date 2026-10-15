import { parsePsFamilyClashXml } from './ps-family-clash-xml-parser.js';
import { parseSupportChangeXml } from './ps-family-psclash-xml-parser.js';
import { parsePsFamilyRegisterCsv } from './ps-family-register-csv-parser.js';
import { parsePsFamilyElementDetailCsv } from './ps-family-element-detail-csv-parser.js';
import { buildPsFamilyPosFamilies } from './ps-family-posfamily-engine.js';
import { buildPsFamilyClashAudit } from './ps-family-clash-audit-engine.js';
import { createPsFamilyJsonTraceRows } from './ps-family-json-trace-export.js';
import {
  PS_FAMILY_EVIDENCE_MODE,
  buildPsFamilyEvidenceAudit,
  createPsFamilyEvidenceReadiness,
  parsePsFamilyEvidenceBundle,
} from './ps-family-evidence-graph-audit.js';

function hasText(value) { return Boolean(String(value || '').trim()); }
function emptyParsed() { return { rows: [], diagnostics: [] }; }

function detectSourceFamily(expectedRows, supportRows, config = {}) {
  const manual = String(config.sourceFamily || '').trim().toUpperCase();
  return manual || expectedRows.find((row) => row.familyRoot)?.familyRoot || supportRows.find((row) => row.psRoot)?.psRoot || '';
}

function severityCount(diagnostics, level) { return diagnostics.filter((item) => item.level === level).length; }

function inputPresenceDiagnostics(parsed) {
  const diagnostics = [];
  if (!parsed.structure.rows.length) diagnostics.push({ level: 'ERROR', code: 'MISSING_STRUCTUREGROUP_SUPPORTS_XML', message: 'StructureGroup vs Supports XML is required for legacy XML audit mode.' });
  if (!parsed.support.rows.length) diagnostics.push({ level: 'ERROR', code: 'MISSING_SUPPORT_CHAIN_XML', message: 'Clash within Supports XML is required for legacy XML audit mode.' });
  return diagnostics;
}

function readinessSummary(parsed, diagnostics) {
  const sourceFamily = detectSourceFamily(parsed.expected.rows, [...parsed.structure.rows, ...parsed.support.rows], parsed.config);
  if (!sourceFamily) diagnostics.push({ level: 'ERROR', code: 'UNKNOWN_SOURCE_FAMILY', message: 'Source family could not be detected from XML evidence or manual input.' });
  const parsedPositions = parsed.details.rows.filter((row) => row.position).length;
  return {
    evidenceMode: 'XML',
    sourceFamily,
    structureContactCount: parsed.structure.rows.length,
    supportChainCount: parsed.support.rows.length,
    xmlClashCount: parsed.legacy.rows.length,
    psClashCount: parsed.support.rows.length + parsed.structure.rows.length,
    expectedCount: parsed.expected.rows.length,
    detailCount: parsed.details.rows.length,
    positionParsedCount: parsedPositions,
    positionMissingCount: parsed.details.rows.length - parsedPositions,
    posFamilyCount: parsed.pos.posFamilies.length,
    errorCount: severityCount(diagnostics, 'ERROR'),
    warnCount: severityCount(diagnostics, 'WARN'),
    infoCount: severityCount(diagnostics, 'INFO'),
  };
}

function parseSharedInputs(input) {
  const config = input?.config || {};
  const expectedText = input?.expectedCsvText || '';
  const detailText = input?.detailCsvText || '';
  const expected = hasText(expectedText) ? parsePsFamilyRegisterCsv(expectedText, config) : emptyParsed();
  const details = hasText(detailText) ? parsePsFamilyElementDetailCsv(detailText, config) : emptyParsed();
  const pos = buildPsFamilyPosFamilies(details.rows, { toleranceMm: config.posToleranceMm });
  return { config, expected, details, pos };
}

function parseInputs(input) {
  const shared = parseSharedInputs(input);
  const legacyText = input?.clashXmlText || '';
  const structureText = input?.structureXmlText || '';
  const supportText = input?.supportXmlText || input?.psClashXmlText || '';
  const legacy = hasText(legacyText) ? parsePsFamilyClashXml(legacyText, shared.config) : emptyParsed();
  const structure = hasText(structureText) ? parseSupportChangeXml(structureText, shared.config, 'StructureGroup vs Supports') : emptyParsed();
  const support = hasText(supportText) ? parseSupportChangeXml(supportText, shared.config, 'Clash within Supports') : emptyParsed();
  return { ...shared, legacy, structure, support };
}

function evidenceMode(input) {
  const explicit = String(input?.evidenceMode || input?.config?.evidenceMode || '').trim().toUpperCase();
  if (explicit === PS_FAMILY_EVIDENCE_MODE) return PS_FAMILY_EVIDENCE_MODE;
  if (explicit === 'XML') return 'XML';
  return hasText(input?.relationshipBundleText) && !hasText(input?.structureXmlText) && !hasText(input?.supportXmlText)
    ? PS_FAMILY_EVIDENCE_MODE
    : 'XML';
}

function graphDiagnostics(shared) {
  return [...shared.expected.diagnostics, ...shared.details.diagnostics, ...shared.pos.diagnostics];
}

function createGraphReadiness(input) {
  const shared = parseSharedInputs(input);
  const readiness = createPsFamilyEvidenceReadiness({
    relationshipBundleText: input?.relationshipBundleText || '',
    expectedRows: shared.expected.rows,
    elementDetailRows: shared.pos.rows,
    config: shared.config,
  });
  const diagnostics = [...readiness.diagnostics, ...graphDiagnostics(shared)];
  const parsedPositions = shared.details.rows.filter((row) => row.position).length;
  const summary = {
    ...readiness.summary,
    expectedCount: shared.expected.rows.length,
    detailCount: shared.details.rows.length,
    positionParsedCount: parsedPositions,
    positionMissingCount: shared.details.rows.length - parsedPositions,
    posFamilyCount: shared.pos.posFamilies.length,
    errorCount: severityCount(diagnostics, 'ERROR'),
    warnCount: severityCount(diagnostics, 'WARN'),
    infoCount: severityCount(diagnostics, 'INFO'),
  };
  return Object.freeze({ summary, diagnostics, blocking: diagnostics.some((item) => item.level === 'ERROR') });
}

export function createPsFamilyInputReadinessFromTextInputs(input) {
  if (evidenceMode(input) === PS_FAMILY_EVIDENCE_MODE) return createGraphReadiness(input);
  const parsed = parseInputs(input);
  const diagnostics = [...inputPresenceDiagnostics(parsed), ...parsed.legacy.diagnostics, ...parsed.structure.diagnostics, ...parsed.support.diagnostics, ...parsed.expected.diagnostics, ...parsed.details.diagnostics, ...parsed.pos.diagnostics];
  const summary = readinessSummary(parsed, diagnostics);
  return Object.freeze({ summary, diagnostics, blocking: diagnostics.some((item) => item.level === 'ERROR') });
}

function selectedGraphFamilies(bundle, audit) {
  const selectedIds = new Set((audit.supportMemberRows || []).map((row) => row.supportFamilyId).filter(Boolean));
  return (bundle.supportFamilies || []).filter((family) => selectedIds.has(family.familyId));
}

function createGraphAudit(input) {
  const shared = parseSharedInputs(input);
  const bundle = parsePsFamilyEvidenceBundle(input?.relationshipBundleText || '');
  const audit = buildPsFamilyEvidenceAudit({
    relationshipBundle: bundle,
    expectedRows: shared.expected.rows,
    elementDetailRows: shared.pos.rows,
    posFamilies: shared.pos.posFamilies,
    config: shared.config,
    diagnostics: graphDiagnostics(shared),
  });
  return {
    ...audit,
    jsonTraceSupportMemberRows: createPsFamilyJsonTraceRows(
      selectedGraphFamilies(bundle, audit),
      bundle.schema,
    ),
  };
}

export function createPsFamilyClashAuditFromTextInputs(input) {
  if (evidenceMode(input) === PS_FAMILY_EVIDENCE_MODE) return createGraphAudit(input);
  const parsed = parseInputs(input);
  const sourceFamily = detectSourceFamily(parsed.expected.rows, [...parsed.structure.rows, ...parsed.support.rows], parsed.config);
  const auditConfig = sourceFamily ? { ...parsed.config, sourceFamily } : parsed.config;
  return buildPsFamilyClashAudit({
    clashRows: parsed.legacy.rows,
    structureGroupRows: parsed.structure.rows,
    supportChainRows: parsed.support.rows,
    expectedRows: parsed.expected.rows,
    elementDetailRows: parsed.pos.rows,
    posFamilies: parsed.pos.posFamilies,
    config: auditConfig,
    diagnostics: [...parsed.legacy.diagnostics, ...parsed.structure.diagnostics, ...parsed.support.diagnostics, ...parsed.expected.diagnostics, ...parsed.details.diagnostics, ...parsed.pos.diagnostics],
  });
}

export const createPsFamilyAuditFromTextInputs = createPsFamilyClashAuditFromTextInputs;

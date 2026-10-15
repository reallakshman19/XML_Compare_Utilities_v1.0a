import { parseTableSource } from '../../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { buildCategorizedGraph } from '../../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { exportCategorizedGraphArtifacts } from '../../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { runCategorizerValidation } from '../../xml-compare/table-categorizer/table-categorized-xml-validation.js';
import { SUPPORT_REVISION_CSV_XML_PROFILE } from '../../xml-compare/table-categorizer/presets/support-revision/support-revision-profile.js';
import { validateSupportRevisionPair } from './support-revision-pair-validation.js';
import { inferRevisionValue, validateSupportRevisionSource } from './support-revision-schema.js';

export const SUPPORT_REVISION_PIPELINE_SCHEMA = 'support-revision-pipeline/v3-bore-alias';

const HEADER_ALIASES = Object.freeze(new Map([
  ['PREV PRIMARY SUPPORT NAME', 'PREV NAME'],
  ['PREV NAME', 'PREV NAME'],
  ['CIVILSECONDARYSUPPORT', 'CIVILSECONDARYSUPPORT'],
  ['CIVIL SECONDARY SUPPORT (TAG PROVIDED BY CIVIL)', 'CIVILSECONDARYSUPPORT'],
  ['CIVILSECONDARYSUPPORT (GHTYPE-4PLOT/1885)', 'CIVILSECONDARYSUPPORT'],
  ['CIVIL SECONDARY SUPPORT (GHTYPE-4PLOT/1885)', 'CIVILSECONDARYSUPPORT'],
  ['PIPE', 'PIPE'],
  ['SIZE (BORE)', 'SIZE'],
  ['SIZE/BORE', 'SIZE'],
  ['BORE', 'SIZE'],
  ['SIZE', 'SIZE'],
  ['INSULATION TYPE AND THICKNESS', 'INSULATION'],
  ['INSULATION', 'INSULATION'],
]));

const normalizedHeader = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

export function canonicalSupportRevisionHeader(header) {
  const normalized = normalizedHeader(header);
  return HEADER_ALIASES.get(normalized) || String(header ?? '').trim();
}

export function canonicalizeSupportRevisionSource(parsedSource) {
  const originalHeaders = Object.freeze([...(parsedSource?.headers || [])]);
  const headers = Object.freeze(originalHeaders.map(canonicalSupportRevisionHeader));
  const changes = originalHeaders.flatMap((header, index) => header === headers[index] ? [] : [{ index, from: header, to: headers[index] }]);
  const rows = Object.freeze((parsedSource?.rows || []).map((row) => {
    const rawByHeader = { ...(row.rawByHeader || {}) };
    headers.forEach((header, index) => {
      const value = row.rawCells?.[index] ?? '';
      const columnId = parsedSource.columnIds?.[index] || header;
      if (rawByHeader[header] === undefined) rawByHeader[header] = value;
      else rawByHeader[columnId] = value;
    });
    return Object.freeze({ ...row, rawByHeader: Object.freeze(rawByHeader) });
  }));
  const aliasDiagnostic = changes.length ? [Object.freeze({
    severity: 'INFO',
    code: 'support_revision_header_aliases_applied',
    message: `${changes.length} Support Report header alias(es) mapped to the governed profile.`,
    details: Object.freeze({ changes: Object.freeze(changes.map((item) => Object.freeze({ ...item }))) }),
  })] : [];
  return Object.freeze({
    ...parsedSource,
    headers,
    originalHeaders,
    rows,
    diagnostics: Object.freeze([...(parsedSource?.diagnostics || []), ...aliasDiagnostic]),
  });
}

export function convertSupportRevisionTable(tableText, options = {}) {
  const revision = String(options.revision || '1');
  const parsedSource = parseSupportSource(tableText, revision, options);
  const source = canonicalizeSupportRevisionSource(parsedSource);
  const profile = options.profile || SUPPORT_REVISION_CSV_XML_PROFILE;
  const graph = buildCategorizedGraph(profile, [source]);
  const validationResults = Object.freeze([
    ...validateSupportRevisionSource(source),
    ...runCategorizerValidation({ profile, sources: [source], graph, activeSourceId: source.sourceId }),
  ]);
  const exportResult = exportCategorizedGraphArtifacts({ profile, graph, validationResults, sources: [source] });
  return Object.freeze({
    schema: SUPPORT_REVISION_PIPELINE_SCHEMA,
    revision,
    inferredRevision: inferRevisionValue(source),
    source,
    profile,
    graph,
    validationResults,
    exportResult,
    ok: Boolean(exportResult.ok),
  });
}

export function convertSupportRevisionPair(revision1Text, revision2Text, options = {}) {
  const profile = options.profile || SUPPORT_REVISION_CSV_XML_PROFILE;
  const rev1 = convertSupportRevisionTable(revision1Text, revisionOptions(options.rev1, '1', 'R1', 'Revision 1 / Earlier', profile));
  const rev2 = convertSupportRevisionTable(revision2Text, revisionOptions(options.rev2, '2', 'R2', 'Revision 2 / Later', profile));
  const pairValidation = validateSupportRevisionPair(rev1, rev2, options);
  return Object.freeze({
    schema: 'support-revision-pair/v1',
    profileId: profile.profileId,
    rev1,
    rev2,
    pairValidation,
    ok: rev1.ok && rev2.ok && pairValidation.ok,
    diagnostics: Object.freeze([
      ...revisionDiagnostics('1', rev1),
      ...revisionDiagnostics('2', rev2),
      ...pairValidation.diagnostics.map((item) => Object.freeze({ revision: 'PAIR', ...item })),
    ]),
  });
}

function parseSupportSource(tableText, revision, options) {
  return parseTableSource(tableText, {
    sourceId: String(options.sourceId || `R${revision}`),
    sourceName: String(options.sourceName || `Revision ${revision}`),
    sourceType: options.sourceType || 'pasteText',
    delimiterMode: options.delimiterMode || 'auto',
    customDelimiter: options.customDelimiter || '',
    firstRowIsHeader: options.firstRowIsHeader !== false,
  });
}

function revisionOptions(input = {}, revision, sourceId, sourceName, profile) {
  return { ...input, revision, sourceId: input?.sourceId || sourceId, sourceName: input?.sourceName || sourceName, profile };
}

function revisionDiagnostics(revision, conversion) {
  return [
    ...(conversion.source?.diagnostics || []),
    ...(conversion.validationResults || []),
    ...(conversion.graph?.diagnostics || []),
  ].map((item) => Object.freeze({ revision, ...item }));
}

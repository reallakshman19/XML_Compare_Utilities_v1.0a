export const SUPPORT_REVISION_PROFILE_ID = 'support-revision-csv-xml/v1';

const trim = (column) => ({ op: 'trim', column });
const fallback = (...columns) => ({ op: 'fallback', resolvers: columns.map((column) => trim(column)), defaultValue: '' });
const regex = (column, pattern, group = 1) => ({ op: 'regexExtract', input: trim(column), pattern, group, severity: 'INFO' });
const supportLocationIdentityResolver = () => ({ op: 'concat', separator: '||', parts: [trim('CIVILSECONDARYSUPPORT'), trim('PIPE')] });
const CIVIL_COLUMNS = Object.freeze(['CIVILSECONDARYSUPPORT','CIVILSECONDARYSUPPORT (GHTYPE-4PLOT/1885)']);
const civil = () => fallback(...CIVIL_COLUMNS);

export const SUPPORT_REVISION_CSV_XML_PROFILE = Object.freeze({
  schema: 'UniversalCategorizerProfile.v1',
  profileId: SUPPORT_REVISION_PROFILE_ID,
  displayName: 'Support Revision CSV to XML',
  version: '1.1.0',
  presetType: 'built-in preset',
  duplicateKeyPolicy: 'merge-sourceRefs',
  multiValuePolicy: 'preserve-parallel-evidence',
  coordinateCluster: Object.freeze({ unit: 'mm', axisMapping: Object.freeze({ x: 'EAST/WEST', y: 'NORTH/SOUTH', z: 'BOP ELEVATION' }), roundingPrecision: 3, tolerance: 5, clusterMethod: 'max-axis-delta', originDatum: 'revision-source', coordinateSource: 'sourceColumns', failurePolicy: 'warn-and-fallback' }),
  requiredColumns: Object.freeze(['CIVILSECONDARYSUPPORT','PIPE','PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE']),
  optionalColumns: Object.freeze(['PREV NAME','SCOPE',...CIVIL_COLUMNS,'SIZE','EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY','REMARKS (IF ANY)','PRIMARY SUPPORT DESCRIPTION','PRIMARY SUPPORT ZONE','PRIMARY SUPPORT SITE','PIPE SCHEDULE','INSULATION','STRESS SYSTEM NUMBER','NODE NO','REVISION']),
  joins: Object.freeze([]),
  rootPartitions: Object.freeze([]),
  exportPolicy: Object.freeze({
    documentRootTag: 'SupportRevision', includeXmlDeclaration: true, includeDiagnosticsElement: false, valueMode: 'attributes',
    attributeFields: Object.freeze(['legacyIdentity','scope','civilSecondarySupport','supportLocationIdentity','size','raw','area','pipeScope','nps','service','lineNumber','qualifier','sequence','eastWestRaw','northSouthRaw','bopRaw','memberId','supportType','reference','manyOrdinal','ordinal','columnOrdinal','columnId','sourceHeader','value','sourceCellRef','totalSupportPoints','primarySupportDescription','primarySupportZone','primarySupportSite','pipeSchedule','insulation','stressSystemNumber','nodeNo','revision','historicalRemarks']),
    childElementFields: Object.freeze([]),
  }),
  levelDefinitions: Object.freeze([
    Object.freeze({
      levelId: 'supportRevision', xmlTag: 'SupportRevision', displayName: 'SupportRevision', levelType: 'container', creationMode: 'static', key: 'SUPPORT_REVISION', documentRoot: true,
      children: Object.freeze([
        Object.freeze({
          levelId: 'secondarySupport', xmlTag: 'SecondarySupport', displayName: 'SecondarySupport', levelType: 'group', creationMode: 'one-per-key', keyResolver: fallback(...CIVIL_COLUMNS, 'PREV NAME'),
          fieldResolvers: Object.freeze({ legacyIdentity: trim('PREV NAME'), civilSecondarySupport: civil() }),
          children: Object.freeze([
            Object.freeze({
              levelId: 'supportLocation', xmlTag: 'SupportLocation', displayName: 'SupportLocation', levelType: 'occurrence', creationMode: 'one-per-row',
              fieldResolvers: Object.freeze({
                supportLocationIdentity: supportLocationIdentityResolver(), legacyIdentity: trim('PREV NAME'), scope: trim('SCOPE'), civilSecondarySupport: civil(), size: trim('SIZE'), totalSupportPoints: trim('TOTAL SUPPORT POINTS ON SECONDARY'),
                primarySupportDescription: trim('PRIMARY SUPPORT DESCRIPTION'), primarySupportZone: trim('PRIMARY SUPPORT ZONE'), primarySupportSite: trim('PRIMARY SUPPORT SITE'), pipeSchedule: trim('PIPE SCHEDULE'), insulation: trim('INSULATION'), stressSystemNumber: trim('STRESS SYSTEM NUMBER'), nodeNo: trim('NODE NO'), revision: trim('REVISION'), historicalRemarks: trim('REMARKS (IF ANY)'),
              }),
              children: Object.freeze([
                Object.freeze({
                  levelId: 'pipe', xmlTag: 'Pipe', displayName: 'Pipe', levelType: 'attribute', creationMode: 'one-per-row', keyResolver: trim('PIPE'),
                  fieldResolvers: Object.freeze({ raw: trim('PIPE'), area: regex('PIPE', '^([^-]+-[^-]+)', 1), pipeScope: regex('PIPE', '^[^-]+-[^-]+-([^-]+)', 1), nps: regex('PIPE', '-(\\d+(?:\\.\\d+)?)\\s*(?:&quot;|["”])', 1), service: regex('PIPE', '(?:&quot;|["”])-([A-Za-z])', 1), lineNumber: regex('PIPE', '(?:&quot;|["”])-[A-Za-z]?(\\d+)', 1), qualifier: regex('PIPE', '-(PP|HOT|HT)(?:-|$)', 1), sequence: regex('PIPE', '-(\\d+)$', 1) }),
                  children: Object.freeze([]),
                }),
                Object.freeze({
                  levelId: 'position', xmlTag: 'Position', displayName: 'Position', levelType: 'attribute', creationMode: 'one-per-row', keyResolver: { op: 'literal', value: 'POSITION' },
                  fieldResolvers: Object.freeze({ eastWestRaw: trim('EAST/WEST'), northSouthRaw: trim('NORTH/SOUTH'), bopRaw: trim('BOP ELEVATION') }), children: Object.freeze([]),
                }),
                Object.freeze({
                  levelId: 'primarySupport', xmlTag: 'PrimarySupport', displayName: 'PrimarySupport', levelType: 'feature', creationMode: 'many-per-row', delimiter: ',', listResolver: trim('PIPING PRIMARY SUPPORT'),
                  parallelListResolvers: Object.freeze({ memberId: trim('PIPING PRIMARY SUPPORT'), supportType: trim('SUPPORT TYPE'), reference: trim('PIPING PRIMARY SUPPORT REFERENCE') }), children: Object.freeze([]),
                }),
                Object.freeze({
                  levelId: 'load', xmlTag: 'Load', displayName: 'Load', levelType: 'measure', creationMode: 'many-per-row',
                  columnSeries: Object.freeze({ headerPattern: '^(?:[FfMm][XxYyZz]|[Ll][Oo][Aa][Dd].*|[Rr][Ee][Ss][Uu][Ll][Tt].*)$', includeBlank: true, valueType: 'number' }), children: Object.freeze([]),
                }),
              ]),
            }),
          ]),
        }),
      ]),
    }),
  ]),
});

export function supportRevisionProfile() { return SUPPORT_REVISION_CSV_XML_PROFILE; }
export const SUPPORT_REVISION_CIVIL_COLUMNS = CIVIL_COLUMNS;

export const UNIVERSAL_XML_CATEGORIZER_CONTRACT_SCHEMA = 'universal-xml-categorizer-contracts/v1-shadow';

export const UNIVERSAL_SOURCE_ROLES = Object.freeze(['primary', 'sideload']);
export const UNIVERSAL_ATTACHMENT_MODES = Object.freeze(['lookup', 'enrich-existing', 'create-block', 'create-level']);

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createUniversalSideloadSource(input = {}) {
  return freeze({
    sourceId: text(input.sourceId, 'sideloadSource'),
    displayName: text(input.displayName, input.sourceId || 'Sideload Source'),
    role: UNIVERSAL_SOURCE_ROLES.includes(input.role) ? input.role : 'sideload',
    sourceKind: text(input.sourceKind, 'table'),
    requiredColumns: freeze(arr(input.requiredColumns).map((item) => text(item)).filter(Boolean)),
    optionalColumns: freeze(arr(input.optionalColumns).map((item) => text(item)).filter(Boolean)),
  });
}

export function createUniversalAttachmentRule(input = {}) {
  return freeze({
    ruleId: text(input.ruleId, 'attachmentRule'),
    sourceId: text(input.sourceId),
    attachToLevelId: text(input.attachToLevelId),
    mode: UNIVERSAL_ATTACHMENT_MODES.includes(input.mode) ? input.mode : 'lookup',
    sourceKey: text(input.sourceKey),
    targetKey: text(input.targetKey),
    blockName: text(input.blockName),
    fieldBindings: freeze(arr(input.fieldBindings).map(normalizeFieldBinding)),
    conflictPolicy: text(input.conflictPolicy, 'diagnostic-only'),
    missingTargetPolicy: text(input.missingTargetPolicy, 'warn'),
  });
}

export function normalizeUniversalCategorizerProfile(input = {}) {
  const profileId = text(input.profileId, 'universal-xml-categorizer-shadow');
  return freeze({
    schema: 'UniversalXmlCategorizerProfile.v1',
    profileId,
    displayName: text(input.displayName, 'Universal XML Categorizer Shadow Profile'),
    sources: freeze(arr(input.sources).map(createUniversalSideloadSource)),
    levelDefinitions: freeze(arr(input.levelDefinitions).map(normalizeLevelDefinition)),
    blockDefinitions: freeze(arr(input.blockDefinitions).map(normalizeBlockDefinition)),
    sideloadAttachments: freeze(arr(input.sideloadAttachments).map(createUniversalAttachmentRule)),
  });
}

export function createLinewiseUniversalPreset() {
  return normalizeUniversalCategorizerProfile({
    profileId: 'linewise-universal-preset',
    displayName: 'Line-wise XML universal preset',
    sources: [
      { sourceId: 'mainXml', displayName: 'Main Input XML', role: 'primary', sourceKind: 'xml' },
      { sourceId: 'lineIdLookup', displayName: 'Line ID Lookup', requiredColumns: ['FROM_NODE', 'TO_NODE', 'LINE_ID'] },
      { sourceId: 'coordinateLookup', displayName: 'Node Coordinate Lookup', requiredColumns: ['NODE', 'GLOBAL_X', 'GLOBAL_Y', 'GLOBAL_Z'] },
      { sourceId: 'restraintLookup', displayName: 'Restraint Tag Lookup', requiredColumns: ['NODE', 'TYPE', 'STIFFNESS', 'GAP', 'TAG'] },
    ],
    levelDefinitions: [line('documentRoot', 'DocumentRoot', ['line']), line('line', 'Line', ['element']), line('element', 'Element', ['node']), line('node', 'Node')],
    blockDefinitions: [block('LineBlock', 'line'), block('MaterialBlock', 'line'), block('RouteGeometryBlock', 'element'), block('DerivedBlock', 'element'), block('DerivedCoordinateBlock', 'node'), block('RestraintsBlock', 'node')],
    sideloadAttachments: [
      { ruleId: 'line-id-to-element', sourceId: 'lineIdLookup', attachToLevelId: 'element', sourceKey: 'FROM_NODE+TO_NODE', targetKey: 'elementKey', blockName: 'LineBlock', mode: 'enrich-existing' },
      { ruleId: 'coordinates-to-node', sourceId: 'coordinateLookup', attachToLevelId: 'node', sourceKey: 'NODE', targetKey: 'nodeNumber', blockName: 'DerivedCoordinateBlock', mode: 'create-block' },
      { ruleId: 'restraints-to-node', sourceId: 'restraintLookup', attachToLevelId: 'node', sourceKey: 'NODE', targetKey: 'nodeNumber', blockName: 'RestraintsBlock', mode: 'create-block' },
    ],
  });
}

export function summarizeUniversalProfile(profile = createLinewiseUniversalPreset()) {
  const p = normalizeUniversalCategorizerProfile(profile);
  return freeze({
    profileId: p.profileId,
    sources: p.sources.length,
    sideloadSources: p.sources.filter((source) => source.role === 'sideload').length,
    levels: p.levelDefinitions.length,
    blocks: p.blockDefinitions.length,
    attachments: p.sideloadAttachments.length,
  });
}

function normalizeFieldBinding(input = {}) {
  return freeze({ sourceField: text(input.sourceField), targetField: text(input.targetField || input.outputName), transform: text(input.transform, 'copy') });
}

function normalizeLevelDefinition(input = {}) {
  return freeze({ levelId: text(input.levelId), displayName: text(input.displayName, input.levelId), children: freeze(arr(input.children).map(text).filter(Boolean)) });
}

function normalizeBlockDefinition(input = {}) {
  return freeze({ blockName: text(input.blockName), attachToLevelId: text(input.attachToLevelId), createMode: text(input.createMode, 'when-fields-present') });
}

function line(levelId, displayName, children = []) { return { levelId, displayName, children }; }
function block(blockName, attachToLevelId) { return { blockName, attachToLevelId }; }

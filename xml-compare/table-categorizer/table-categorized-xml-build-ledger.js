export const TABLE_CATEGORIZED_XML_BUILD_LEDGER_SCHEMA = 'table-categorized-xml-build-ledger/v1';

export function createBuildLedger(profile = {}, sources = [], graph = {}) {
  const levels = flattenLevels(profile.levelDefinitions || []);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const diagnostics = [];
  const entries = levels.map(({ level, path }) => createLedgerEntry(level, path, nodes, diagnostics));
  return Object.freeze({
    schema: TABLE_CATEGORIZED_XML_BUILD_LEDGER_SCHEMA,
    profileId: profile.profileId || '',
    graphSchema: graph.schema || '',
    sourceIds: Object.freeze(sources.map((source) => source.sourceId).filter(Boolean)),
    entries: Object.freeze(entries),
    diagnostics: Object.freeze(diagnostics),
  });
}

function createLedgerEntry(level = {}, path = [], nodes = [], diagnostics = []) {
  const levelNodes = nodes.filter((node) => node.levelId === level.levelId);
  const sourceRefs = [...new Set(levelNodes.flatMap((node) => node.sourceRefs || []))];
  const blankKeyCount = levelNodes.filter((node) => !String(node.key || '').trim()).length;
  const duplicateMergeCount = Math.max(0, sourceRefs.length - levelNodes.length);
  const keyResolver = resolverSummary(level.keyResolver, level.key);
  const displayResolver = resolverSummary(level.displayNameResolver, level.displayName || level.key || '');
  const fieldResolvers = Object.entries(level.fieldResolvers || {}).map(([name, resolver]) => ({ name, ...resolverSummary(resolver, '') }));
  if (requiresKeyResolver(level) && !level.keyResolver) diagnostics.push(diag('WARNING', 'build_ledger_missing_key_resolver', `Level ${level.levelId} has no explicit key resolver.`, { levelId: level.levelId, path: pathKey(path) }));
  if (blankKeyCount) diagnostics.push(diag('WARNING', 'build_ledger_blank_keys', `Level ${level.levelId} emitted ${blankKeyCount} blank key node(s).`, { levelId: level.levelId, path: pathKey(path), blankKeyCount }));
  if (!levelNodes.length) diagnostics.push(diag('INFO', 'build_ledger_no_nodes', `Level ${level.levelId} emitted no nodes.`, { levelId: level.levelId, path: pathKey(path) }));
  return Object.freeze({
    schema: 'BuildLedgerEntry.v1',
    levelId: level.levelId || '',
    path: pathKey(path),
    levelType: level.levelType || '',
    creationMode: level.creationMode || '',
    xmlTag: level.xmlTag || (level.documentRoot ? 'documentRoot' : ''),
    keyResolver,
    displayResolver,
    fieldResolverCount: fieldResolvers.length,
    fieldResolvers: Object.freeze(fieldResolvers.map(Object.freeze)),
    nodeCount: levelNodes.length,
    sourceRefCount: sourceRefs.length,
    duplicateMergeCount,
    blankKeyCount,
    sampleKeys: Object.freeze(levelNodes.map((node) => node.key).filter(Boolean).slice(0, 5)),
  });
}

function resolverSummary(resolver = null, fallback = '') {
  if (!resolver) return Object.freeze({ op: fallback ? 'literal' : '', column: '', sourceId: '', literal: fallback || '' });
  if (resolver.column || resolver.sourceId) return Object.freeze({ op: resolver.op || '', column: resolver.column || '', sourceId: resolver.sourceId || '', literal: '' });
  if (resolver.input) return Object.freeze({ op: resolver.op || '', column: resolver.input.column || '', sourceId: resolver.input.sourceId || '', literal: '' });
  if (Array.isArray(resolver.parts)) return Object.freeze({ op: resolver.op || 'concat', column: resolver.parts.map((part) => part?.column || '').filter(Boolean).join(' + '), sourceId: '', literal: '' });
  return Object.freeze({ op: resolver.op || '', column: '', sourceId: resolver.sourceId || '', literal: resolver.value || '' });
}

function requiresKeyResolver(level = {}) {
  return !['static', 'one-per-row'].includes(level.creationMode) && !level.key;
}

function flattenLevels(levels = [], path = []) {
  return levels.flatMap((level, index) => [{ level, path: [...path, index] }, ...flattenLevels(level.children || [], [...path, index])]);
}

function pathKey(path = []) { return path.join('.'); }
function diag(severity, code, message, details = {}) { return Object.freeze({ severity, code, message, details: Object.freeze(details) }); }

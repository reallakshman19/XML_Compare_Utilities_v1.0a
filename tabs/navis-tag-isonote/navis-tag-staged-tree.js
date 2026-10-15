import {
  STAGED_JSON_TREE_SCHEMA,
  coordinateProfileOptions,
  firstConfiguredValue,
  normalizeConfig,
  normalizeReference,
  normalizeSupportIdentity,
  parseCoordinate,
  supportRoot,
  text,
  unitScaleToMm,
} from './navis-tag-isonote-contracts.js';
import { resolveBuiltInBoreToOd } from './navis-tag-bore-od-master.js';

function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function scalar(value) { return value == null || ['string', 'number', 'boolean'].includes(typeof value); }
function coordinateLike(value) {
  if (!isObject(value)) return false;
  const keys = Object.keys(value).map((key) => key.toUpperCase());
  return ['X', 'Y', 'Z'].every((key) => keys.includes(key)) || ['E', 'N', 'EL'].every((key) => keys.includes(key));
}
function collectLocalValues(value, prefix = '', out = {}, depth = 0) {
  if (!isObject(value) || depth > 6) return out;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (scalar(child)) out[path] = child;
    else if (coordinateLike(child)) { out[path] = { ...child }; collectLocalValues(child, path, out, depth + 1); }
    else if (isObject(child)) collectLocalValues(child, path, out, depth + 1);
  }
  return out;
}
function nodeType(value, values) { return text(values.type ?? values.TYPE ?? values['attributes.TYPE'] ?? value?.type ?? value?.kind ?? 'OBJECT').toUpperCase(); }
function nodeName(value, values, fallback) { return text(values.name ?? values.NAME ?? values['attributes.NAME'] ?? values['attributes.OWNER'] ?? value?.name ?? fallback); }
function childEntries(value) {
  const entries = [];
  if (Array.isArray(value)) value.forEach((child, index) => { if (child && typeof child === 'object') entries.push({ key: index, value: child }); });
  else if (isObject(value)) for (const [key, child] of Object.entries(value)) if (child && typeof child === 'object') entries.push({ key, value: child });
  return entries;
}
function valueType(value) { if (Array.isArray(value)) return 'array'; if (value === null) return 'null'; return typeof value === 'object' ? 'object' : typeof value; }
function appendPathStat(pathStats, path, value) {
  if (!path) return;
  const stat = pathStats.get(path) || { path, count: 0, samples: [], valueTypes: new Set() };
  stat.count += 1;
  stat.valueTypes.add(valueType(value));
  const sample = typeof value === 'object' ? JSON.stringify(value) : text(value);
  if (sample && !stat.samples.includes(sample) && stat.samples.length < 5) stat.samples.push(sample);
  pathStats.set(path, stat);
}
function inferAncestor(node, byId, paths, typePattern, namePattern, role) {
  let current = node;
  while (current) {
    const configured = firstConfiguredValue(current, paths);
    if (configured.value) return { value: text(configured.value), path: configured.path, nodeId: current.nodeId, basis: `CONFIGURED_${role}_PATH` };
    if (typePattern.test(current.rawType)) return { value: current.rawName, path: `hierarchy:type=${current.rawType}`, nodeId: current.nodeId, basis: `HIERARCHY_${role}_TYPE` };
    if (namePattern && namePattern.test(current.rawName)) return { value: current.rawName, path: 'hierarchy:name', nodeId: current.nodeId, basis: `HIERARCHY_${role}_NAME` };
    current = current.parentNodeId ? byId.get(current.parentNodeId) : null;
  }
  return { value: '', path: '', nodeId: '', basis: 'NONE' };
}
function valueForIdentity(node, paths) {
  for (const path of paths) {
    const raw = node.values[path];
    const identity = normalizeSupportIdentity(raw);
    if (identity && supportRoot(identity)) return { path, raw, identity, root: supportRoot(identity) };
  }
  return null;
}
function numericValue(node, paths, unit = 'mm') {
  for (const path of paths) {
    const raw = node.values[path];
    if (raw == null || raw === '') continue;
    const number = Number(String(raw).match(/-?\d+(?:\.\d+)?/)?.[0]);
    if (Number.isFinite(number)) return { path, raw, value: number * unitScaleToMm(unit, [number]), sourceUnit: unit };
  }
  return { path: '', raw: '', value: null, sourceUnit: unit };
}
function explicitLookupOd(bore, config) {
  if (!config.boreToOdLookupEnabled || !Number.isFinite(bore.value)) return null;
  const lookup = config.boreToOdLookup || {};
  const keys = [text(bore.raw), String(bore.value), String(Number(bore.value))];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(lookup, key)) continue;
    const value = Number(lookup[key]);
    if (Number.isFinite(value) && value > 0) return {
      value,
      key,
      lookupName: config.boreToOdLookupName || 'CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP',
      profileName: config.boreToOdLookupName || 'CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP',
      source: 'CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP',
      standardBasis: null,
      dn: Number.isFinite(bore.value) ? Number(bore.value) : null,
      nps: '',
      odMm: value,
    };
  }
  return resolveBuiltInBoreToOd({ rawBore: bore.raw, boreNominalMm: bore.value, profileName: config.boreToOdLookupName });
}
function deriveFacts(node, config) {
  const identity = valueForIdentity(node, config.jsonIdentityPaths);
  const referenceEvidence = firstConfiguredValue(node, config.jsonReferencePaths);
  const positionEvidence = firstConfiguredValue(node, config.jsonPositionPaths);
  const position = parseCoordinate(positionEvidence.value, config.jsonUnits, coordinateProfileOptions(config, 'json'));
  const directOd = numericValue(node, config.jsonOdPaths, config.jsonOdUnits);
  const bore = numericValue(node, config.jsonBorePaths, config.jsonBoreUnits);
  const lookupOd = directOd.value == null ? explicitLookupOd(bore, config) : null;
  const odMm = directOd.value ?? lookupOd?.value ?? null;
  return {
    identityRaw: identity?.raw ?? '',
    canonicalIdentity: identity?.identity || '',
    supportRoot: identity?.root || '',
    identityPath: identity?.path || '',
    referenceRaw: referenceEvidence.value ?? '',
    reference: normalizeReference(referenceEvidence.value),
    referencePath: referenceEvidence.path,
    positionRaw: positionEvidence.value,
    position,
    positionPath: positionEvidence.path,
    positionUnits: config.jsonUnits,
    positionSourceUnit: position?.sourceUnit || '',
    positionUnitScale: position?.unitScale ?? null,
    positionRawPoint: position?.rawPoint || null,
    positionDatumOffsetMm: position?.datumOffsetMm || coordinateProfileOptions(config, 'json'),
    positionProfileName: position?.profileName || config.jsonCoordinateProfileName,
    positionAxisBasis: position?.axisBasis || '',
    branch: node.resolvedBranch,
    branchPath: node.resolvedBranchPath,
    branchNodeId: node.resolvedBranchNodeId,
    pipe: node.resolvedPipe,
    pipePath: node.resolvedPipePath,
    pipeNodeId: node.resolvedPipeNodeId,
    zone: node.resolvedZone,
    zonePath: node.resolvedZonePath,
    zoneNodeId: node.resolvedZoneNodeId,
    odMm,
    odRaw: directOd.raw,
    odPath: directOd.path,
    odSource: directOd.value != null ? 'DIRECT_JSON_OD_PATH' : lookupOd?.source || 'NONE',
    odLookupName: lookupOd?.lookupName || '',
    odLookupKey: lookupOd?.key || '',
    odLookupProfileName: lookupOd?.profileName || '',
    odLookupStandardBasis: lookupOd?.standardBasis || null,
    odLookupDn: lookupOd?.dn ?? null,
    odLookupNps: lookupOd?.nps || '',
    boreNominalMm: bore.value,
    boreRaw: bore.raw,
    borePath: bore.path,
    boreUnits: config.jsonBoreUnits,
  };
}

export function buildStagedJsonHierarchy(documents = [], inputConfig = {}) {
  const config = normalizeConfig(inputConfig);
  const nodes = [];
  const byId = new Map();
  const pathStats = new Map();
  const roots = [];
  let sequence = 0;
  let objectCount = 0;
  let arrayCount = 0;
  const visit = (value, meta) => {
    const values = collectLocalValues(isObject(value) ? value : {});
    const nodeId = `SJ-${++sequence}`;
    const rawType = Array.isArray(value) ? 'ARRAY' : nodeType(value, values);
    const rawName = Array.isArray(value) ? `${meta.key}[${value.length}]` : nodeName(value, values, String(meta.key));
    const kind = Array.isArray(value) ? 'array' : 'object';
    if (kind === 'array') arrayCount += 1; else objectCount += 1;
    const node = {
      nodeId,
      parentNodeId: meta.parentNodeId || '',
      sourceFile: meta.sourceFile,
      sourceDocumentIndex: meta.sourceDocumentIndex,
      depth: meta.depth,
      jsonPath: meta.jsonPath,
      rawType,
      rawName,
      kind,
      raw: value,
      attributes: isObject(value?.attributes) ? { ...value.attributes } : {},
      properties: isObject(value?.properties) ? { ...value.properties } : {},
      values,
      childNodeIds: [],
      ancestorIds: [...meta.ancestorIds],
      hierarchyPath: [...meta.hierarchyPath, rawName].filter(Boolean),
      resolvedBranch: '',
      resolvedBranchPath: '',
      resolvedBranchNodeId: '',
      resolvedBranchBasis: 'NONE',
      resolvedPipe: '',
      resolvedPipePath: '',
      resolvedPipeNodeId: '',
      resolvedPipeBasis: 'NONE',
      resolvedZone: '',
      resolvedZonePath: '',
      resolvedZoneNodeId: '',
      resolvedZoneBasis: 'NONE',
      derivedFacts: {},
    };
    nodes.push(node);
    byId.set(nodeId, node);
    if (!node.parentNodeId) roots.push(nodeId); else byId.get(node.parentNodeId)?.childNodeIds.push(nodeId);
    for (const [path, fieldValue] of Object.entries(values)) appendPathStat(pathStats, path, fieldValue);
    for (const child of childEntries(value)) {
      const childPath = Array.isArray(value) ? `${meta.jsonPath}[${child.key}]` : `${meta.jsonPath}.${child.key}`;
      visit(child.value, {
        parentNodeId: nodeId,
        sourceFile: meta.sourceFile,
        sourceDocumentIndex: meta.sourceDocumentIndex,
        depth: meta.depth + 1,
        jsonPath: childPath,
        key: child.key,
        ancestorIds: [...meta.ancestorIds, nodeId],
        hierarchyPath: node.hierarchyPath,
      });
    }
    return node;
  };
  documents.forEach((document, index) => {
    const sourceFile = text(document?.sourceFile) || `staged-${index + 1}.json`;
    const parsed = document?.data ?? document;
    if (!parsed || typeof parsed !== 'object') return;
    visit(parsed, { parentNodeId: '', sourceFile, sourceDocumentIndex: index, depth: 0, jsonPath: '$', key: sourceFile, ancestorIds: [], hierarchyPath: [] });
  });
  for (const node of nodes) {
    const branch = inferAncestor(node, byId, config.jsonBranchPaths, /^(BRANCH|PIPE_BRANCH)$/i, /\/B\d+$/i, 'BRANCH');
    const pipe = inferAncestor(node, byId, config.jsonPipePaths, /^(PIPE|PIPELINE|LINE|PIPING|PIPING_SYSTEM)$/i, null, 'PIPE');
    const zone = inferAncestor(node, byId, config.jsonZonePaths, /^(ZONE|AREA|SITE|LOCATION)$/i, null, 'ZONE');
    Object.assign(node, {
      resolvedBranch: branch.value, resolvedBranchPath: branch.path, resolvedBranchNodeId: branch.nodeId, resolvedBranchBasis: branch.basis,
      resolvedPipe: pipe.value, resolvedPipePath: pipe.path, resolvedPipeNodeId: pipe.nodeId, resolvedPipeBasis: pipe.basis,
      resolvedZone: zone.value, resolvedZonePath: zone.path, resolvedZoneNodeId: zone.nodeId, resolvedZoneBasis: zone.basis,
    });
  }
  for (const node of nodes) node.derivedFacts = deriveFacts(node, config);
  const pathCatalogue = [...pathStats.values()].map((entry) => ({ ...entry, valueTypes: [...entry.valueTypes].sort() })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  const tree = {
    schema: STAGED_JSON_TREE_SCHEMA,
    config,
    nodes,
    roots,
    byId,
    pathCatalogue,
    summary: {
      documentCount: documents.length,
      nodeCount: nodes.length,
      rootCount: roots.length,
      objectCount,
      arrayCount,
      discoveredPathCount: pathStats.size,
      branchResolvedNodeCount: nodes.filter((node) => node.resolvedBranch).length,
      pipeResolvedNodeCount: nodes.filter((node) => node.resolvedPipe).length,
      zoneResolvedNodeCount: nodes.filter((node) => node.resolvedZone).length,
      identityFactNodeCount: nodes.filter((node) => node.derivedFacts.canonicalIdentity).length,
      positionFactNodeCount: nodes.filter((node) => node.derivedFacts.position).length,
    },
  };
  tree.pathRecommendations = recommendStagedJsonPaths(tree);
  return tree;
}

export function buildStagedSupportIndex(tree, inputConfig = {}) {
  const config = normalizeConfig({ ...(tree?.config || {}), ...inputConfig });
  const entries = [];
  const byIdentity = new Map();
  const byRoot = new Map();
  for (const node of tree?.nodes || []) {
    const facts = node.derivedFacts || deriveFacts(node, config);
    if (!facts.canonicalIdentity || !facts.supportRoot) continue;
    const entry = {
      nodeId: node.nodeId,
      sourceFile: node.sourceFile,
      jsonPath: node.jsonPath,
      hierarchyPath: node.hierarchyPath,
      ancestorIds: node.ancestorIds,
      rawType: node.rawType,
      rawName: node.rawName,
      attributes: node.attributes,
      identity: facts.canonicalIdentity,
      identityRaw: facts.identityRaw,
      identityPath: facts.identityPath,
      supportRoot: facts.supportRoot,
      referenceRaw: facts.referenceRaw,
      reference: facts.reference,
      referencePath: facts.referencePath,
      position: facts.position,
      positionRaw: facts.positionRaw,
      positionPath: facts.positionPath,
      positionSourceUnit: facts.positionSourceUnit,
      positionUnitScale: facts.positionUnitScale,
      positionRawPoint: facts.positionRawPoint,
      positionDatumOffsetMm: facts.positionDatumOffsetMm,
      positionProfileName: facts.positionProfileName,
      positionAxisBasis: facts.positionAxisBasis,
      resolvedBranch: facts.branch,
      resolvedBranchPath: facts.branchPath,
      resolvedPipe: facts.pipe,
      resolvedPipePath: facts.pipePath,
      resolvedZone: facts.zone,
      resolvedZonePath: facts.zonePath,
      odMm: facts.odMm,
      odPath: facts.odPath,
      odSource: facts.odSource,
      odLookupName: facts.odLookupName,
      odLookupKey: facts.odLookupKey,
      odLookupProfileName: facts.odLookupProfileName,
      odLookupStandardBasis: facts.odLookupStandardBasis,
      odLookupDn: facts.odLookupDn,
      odLookupNps: facts.odLookupNps,
      boreNominalMm: facts.boreNominalMm,
      borePath: facts.borePath,
      boreUnits: facts.boreUnits,
      derivedFacts: facts,
      node,
    };
    entries.push(entry);
    if (!byIdentity.has(entry.identity)) byIdentity.set(entry.identity, []);
    byIdentity.get(entry.identity).push(entry);
    if (!byRoot.has(entry.supportRoot)) byRoot.set(entry.supportRoot, []);
    byRoot.get(entry.supportRoot).push(entry);
  }
  return {
    config,
    entries,
    byIdentity,
    byRoot,
    summary: {
      indexedNodeCount: entries.length,
      exactIdentityCount: byIdentity.size,
      supportRootCount: byRoot.size,
      positionedEntryCount: entries.filter((entry) => entry.position).length,
      referenceEntryCount: entries.filter((entry) => entry.reference).length,
      branchResolvedEntryCount: entries.filter((entry) => entry.resolvedBranch).length,
      pipeResolvedEntryCount: entries.filter((entry) => entry.resolvedPipe).length,
      zoneResolvedEntryCount: entries.filter((entry) => entry.resolvedZone).length,
      odEntryCount: entries.filter((entry) => Number.isFinite(entry.odMm)).length,
      directOdEntryCount: entries.filter((entry) => entry.odSource === 'DIRECT_JSON_OD_PATH').length,
      customLookupOdEntryCount: entries.filter((entry) => entry.odSource === 'CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP').length,
      builtInLookupOdEntryCount: entries.filter((entry) => entry.odSource === 'BUILT_IN_ASME_BORE_TO_OD_PROFILE').length,
      lookupOdEntryCount: entries.filter((entry) => /BORE_TO_OD|ASME_BORE_TO_OD/.test(entry.odSource)).length,
      boreEntryCount: entries.filter((entry) => Number.isFinite(entry.boreNominalMm)).length,
    },
  };
}

function sampleRate(entry, predicate) { const samples = entry.samples || []; return samples.length ? samples.filter(predicate).length / samples.length : 0; }
function rankedPaths(catalogue, scorer) {
  return catalogue.map((entry) => ({ path: entry.path, score: scorer(entry), count: entry.count, samples: entry.samples })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || b.count - a.count || a.path.localeCompare(b.path));
}
export function recommendStagedJsonPaths(tree) {
  const catalogue = tree?.pathCatalogue || [];
  const identity = rankedPaths(catalogue, (entry) => (/(?:^|\.)(NAME|PS|SUPPORT|TAG|DTXR_PS)$/i.test(entry.path) ? 40 : 0) + Math.round(sampleRate(entry, (sample) => /(?:^|[^A-Z0-9])(PS|SL)-?\d+/i.test(sample)) * 100));
  const reference = rankedPaths(catalogue, (entry) => (/(?:^|\.)(REF|REFERENCE|COMPONENTREFNO|CMPSUPREFN)$/i.test(entry.path) ? 80 : 0) + Math.round(sampleRate(entry, (sample) => /^=?[A-Z0-9]+\/\d+$/i.test(sample)) * 60));
  const position = rankedPaths(catalogue, (entry) => (/POS|COORD|POINT|CENTER/i.test(entry.path) ? 35 : 0) + Math.round(sampleRate(entry, (sample) => Boolean(parseCoordinate(sample, 'auto'))) * 100));
  const branch = rankedPaths(catalogue, (entry) => (/OWNER|BRANCH/i.test(entry.path) ? 35 : 0) + Math.round(sampleRate(entry, (sample) => /\/B\d+/i.test(sample)) * 100));
  const pipe = rankedPaths(catalogue, (entry) => (/PIPE|PIPELINE|LINE|PIPING/i.test(entry.path) ? 60 : 0) + Math.round(sampleRate(entry, (sample) => /ASIM-|PIPE|LINE/i.test(sample)) * 40));
  const zone = rankedPaths(catalogue, (entry) => /ZONE|AREA|SITE|LOCATION/i.test(entry.path) ? 100 : 0);
  const od = rankedPaths(catalogue, (entry) => /(^|\.)(OD|OUTSIDE_DIAMETER|PIPE_OD|DIAMETER)$/i.test(entry.path) ? 100 : 0);
  const bore = rankedPaths(catalogue, (entry) => /(^|\.)(ABORE|LBORE|HBORE|BORE|NOMINAL_BORE)$/i.test(entry.path) ? 100 : 0);
  return { identity, reference, position, branch, pipe, zone, od, bore };
}

export function parseStagedJsonText(textValue, sourceFile = 'staged.json') {
  try { return { documents: [{ sourceFile, data: JSON.parse(String(textValue || '')) }], diagnostics: [] }; }
  catch (error) { return { documents: [], diagnostics: [{ severity: 'ERROR', code: 'STAGED_JSON_PARSE_FAILED', sourceFile, message: error?.message || String(error) }] }; }
}

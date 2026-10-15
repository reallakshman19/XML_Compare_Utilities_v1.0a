import { firstConfiguredValue, normalizeConfig, normalizeReference, text } from './navis-tag-isonote-contracts.js';

function pointKey(point) {
  if (!point) return '';
  return [point.x, point.y, point.z].map((value) => Number(value).toFixed(6)).join('|');
}
function derivePipeFromBranch(branch) {
  const value = text(branch);
  if (!value) return '';
  return value.replace(/\/B\d+$/i, '');
}
function isMetadataMirror(entry, entryByNodeId) {
  if (!/\.(attributes|properties|metadata)$/i.test(entry.jsonPath || '')) return false;
  const parentId = entry.node?.parentNodeId;
  const parent = parentId ? entryByNodeId.get(parentId) : null;
  if (!parent) return false;
  return parent.identity === entry.identity
    && (parent.reference || '') === (entry.reference || '')
    && pointKey(parent.position) === pointKey(entry.position);
}
function duplicateKey(entry) {
  return [
    entry.sourceFile,
    entry.identity,
    entry.reference,
    entry.resolvedBranch,
    entry.resolvedPipe,
    entry.resolvedZone,
    pointKey(entry.position),
    entry.odMm ?? '',
    entry.boreNominalMm ?? '',
  ].join('||');
}
function preferEntry(a, b) {
  const aMetadata = /\.(attributes|properties|metadata)$/i.test(a.jsonPath || '');
  const bMetadata = /\.(attributes|properties|metadata)$/i.test(b.jsonPath || '');
  if (aMetadata !== bMetadata) return aMetadata ? b : a;
  const aDepth = a.node?.depth ?? Number.MAX_SAFE_INTEGER;
  const bDepth = b.node?.depth ?? Number.MAX_SAFE_INTEGER;
  if (aDepth !== bDepth) return aDepth < bDepth ? a : b;
  return String(a.jsonPath).localeCompare(String(b.jsonPath)) <= 0 ? a : b;
}
function rebuild(entries, config, suppressedMirrorEntryCount, suppressedDuplicateEntryCount) {
  const byIdentity = new Map();
  const byRoot = new Map();
  for (const entry of entries) {
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
      lookupOdEntryCount: entries.filter((entry) => ['CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP', 'BUILT_IN_ASME_BORE_TO_OD_PROFILE'].includes(entry.odSource)).length,
      boreEntryCount: entries.filter((entry) => Number.isFinite(entry.boreNominalMm)).length,
      suppressedMirrorEntryCount,
      suppressedDuplicateEntryCount,
    },
  };
}

export function refineStagedSupportIndex(stagedIndex, tree, inputConfig = {}) {
  const config = normalizeConfig({ ...(stagedIndex?.config || {}), ...inputConfig });
  const enriched = (stagedIndex?.entries || []).map((entry) => {
    const referenceEvidence = firstConfiguredValue(entry.node, config.jsonReferencePaths);
    const referenceRaw = referenceEvidence.value ?? '';
    const derivedPipe = derivePipeFromBranch(entry.resolvedBranch);
    const useDerivedPipe = !entry.resolvedPipe && derivedPipe;
    return {
      ...entry,
      referenceRaw,
      reference: normalizeReference(referenceRaw),
      referencePath: referenceEvidence.path,
      resolvedPipe: entry.resolvedPipe || derivedPipe,
      resolvedPipePath: entry.resolvedPipePath || (useDerivedPipe ? 'derived:branch-without-Bn' : ''),
      resolvedPipeBasis: entry.resolvedPipe ? 'STAGED_TREE' : useDerivedPipe ? 'DERIVED_FROM_BRANCH' : 'NONE',
    };
  });
  const byNode = new Map(enriched.map((entry) => [entry.nodeId, entry]));
  let suppressedMirrorEntryCount = 0;
  const withoutMirrors = enriched.filter((entry) => {
    const mirror = isMetadataMirror(entry, byNode);
    if (mirror) suppressedMirrorEntryCount += 1;
    return !mirror;
  });
  const deduped = new Map();
  let suppressedDuplicateEntryCount = 0;
  for (const entry of withoutMirrors) {
    const key = duplicateKey(entry);
    if (!deduped.has(key)) deduped.set(key, entry);
    else {
      deduped.set(key, preferEntry(deduped.get(key), entry));
      suppressedDuplicateEntryCount += 1;
    }
  }
  return rebuild([...deduped.values()], config, suppressedMirrorEntryCount, suppressedDuplicateEntryCount);
}

export const _test = Object.freeze({ derivePipeFromBranch, pointKey, duplicateKey });

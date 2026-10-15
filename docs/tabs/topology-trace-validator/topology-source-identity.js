/**
 * Producer identity binder for the immutable source read model.
 * Inputs: parsed source inventory and normalized trace ledger. Output: a new
 * frozen source inventory whose IDs come from explicit source fields or the
 * ledger's SourceEnvelope/UniversalSourceGraph manifest. Conflicts remain
 * explicit findings metadata; raw source JSON is never changed.
 */

import {
  asArray,
  cleanText,
  deepFreeze,
  objectRecord,
} from './topology-validator-values.js';

/** @param {ReadonlyArray<Record<string, unknown>>} rows @param {string} pathField @returns {Readonly<Record<string, unknown>>} */
function indexByPath(rows, pathField) {
  const grouped = new Map();
  for (const row of rows.map(objectRecord)) {
    const path = cleanText(row[pathField]);
    if (path) grouped.set(path, [...(grouped.get(path) ?? []), row]);
  }
  const byPath = new Map(), duplicates = [];
  for (const [path, matches] of grouped) {
    if (matches.length === 1) byPath.set(path, matches[0]);
    else duplicates.push({ kind: 'DUPLICATE_IDENTITY_PATH', sourcePath: path, count: matches.length });
  }
  return Object.freeze({ byPath, duplicates: Object.freeze(duplicates) });
}

/** @param {Record<string, unknown>} entity @param {Map<string,Record<string,unknown>>} identityByPath @param {Record<string, unknown>[]} conflicts @returns {Record<string, unknown>} */
function bindEntity(entity, identityByPath, conflicts) {
  const sourcePath = cleanText(entity.sourcePath), manifest = objectRecord(identityByPath.get(sourcePath));
  const explicitId = cleanText(entity.sourceEntityId), manifestId = cleanText(manifest.sourceEntityId);
  if (explicitId && manifestId && explicitId !== manifestId) conflicts.push({
    kind: 'SOURCE_ENTITY_ID_CONFLICT', sourcePath, explicitId, manifestId,
  });
  return {
    ...entity,
    sourceEntityId: explicitId || manifestId,
    identityOrigin: explicitId ? 'SOURCE_JSON' : manifestId ? 'TRACE_LEDGER_MANIFEST' : 'MISSING',
  };
}

/** @param {Record<string, unknown>} port @param {string} ownerId @param {Map<string,Record<string,unknown>>} identityByPath @param {Record<string, unknown>[]} conflicts @returns {Record<string, unknown>} */
function bindPort(port, ownerId, identityByPath, conflicts) {
  const sourcePath = cleanText(port.sourcePath), manifest = objectRecord(identityByPath.get(sourcePath));
  const explicitId = cleanText(port.sourcePortId), manifestId = cleanText(manifest.sourcePortId);
  const manifestOwner = cleanText(manifest.sourceEntityId);
  if (explicitId && manifestId && explicitId !== manifestId) conflicts.push({
    kind: 'SOURCE_PORT_ID_CONFLICT', sourcePath, explicitId, manifestId,
  });
  if (manifestOwner && ownerId && manifestOwner !== ownerId) conflicts.push({
    kind: 'SOURCE_PORT_OWNER_CONFLICT', sourcePath, ownerId, manifestOwner,
  });
  return {
    ...port,
    sourcePortId: explicitId || manifestId,
    sourceEntityId: ownerId,
    identityOrigin: explicitId ? 'SOURCE_JSON' : manifestId ? 'TRACE_LEDGER_MANIFEST' : 'MISSING',
  };
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>} ledger @returns {Readonly<Record<string, unknown>>} */
export function bindProducerSourceIdentity(source, ledger) {
  const entityIndex = indexByPath(asArray(ledger.records), 'sourcePath');
  const portIndex = indexByPath(asArray(ledger.sourcePorts), 'sourcePath');
  const conflicts = [...entityIndex.duplicates, ...portIndex.duplicates];
  const branches = asArray(source.branches).map(objectRecord).map((rawBranch) => {
    const branch = bindEntity(rawBranch, entityIndex.byPath, conflicts);
    const branchPorts = asArray(branch.ports).map((port) => bindPort(objectRecord(port), branch.sourceEntityId, portIndex.byPath, conflicts));
    const components = asArray(branch.components).map(objectRecord).map((rawComponent) => {
      const component = bindEntity(rawComponent, entityIndex.byPath, conflicts);
      const ports = asArray(component.ports).map((port) => bindPort(objectRecord(port), component.sourceEntityId, portIndex.byPath, conflicts));
      return deepFreeze({ ...component, ports: Object.freeze(ports) });
    });
    return deepFreeze({ ...branch, ports: Object.freeze(branchPorts), components: Object.freeze(components) });
  });
  const components = branches.flatMap((branch) => asArray(objectRecord(branch).components));
  return deepFreeze({
    ...source,
    branches: Object.freeze(branches),
    components: Object.freeze(components),
    entities: Object.freeze([...branches, ...components]),
    ports: Object.freeze([
      ...branches.flatMap((branch) => asArray(objectRecord(branch).ports)),
      ...components.flatMap((component) => asArray(objectRecord(component).ports)),
    ]),
    producerIdentity: deepFreeze(objectRecord(ledger.sourceIdentity)),
    identityConflicts: Object.freeze(conflicts),
    identityBindingStatus: conflicts.length ? 'CONFLICT' : 'BOUND',
  });
}

/**
 * Functionality: reads managed source JSON without constructing topology.
 * Input is parsed JSON. Output is an immutable source inventory with producer
 * identities preserved verbatim. Fallback: source paths become view keys only;
 * they never satisfy the stable source-identity validation rule.
 */

import {
  GEOMETRY_TOLERANCE_MM,
  ROUTE_COMPONENT_TYPES,
  asArray,
  cleanText,
  cloneJson,
  deepFreeze,
  objectRecord,
  strictPoint,
  uniqueText,
  componentCategory,
} from './topology-validator-values.js';

const COMPONENT_PORT_DEFINITIONS = Object.freeze([
  ['APOS', 'A', 'APORT_ID'], ['LPOS', 'L', 'LPORT_ID'], ['POS', 'P', 'PORT_ID'],
]);
const BRANCH_PORT_DEFINITIONS = Object.freeze([
  ['HPOS', 'H', 'HPORT_ID'], ['TPOS', 'T', 'TPORT_ID'],
]);

/** @param {string} type @param {Record<string, unknown>} positions @returns {string} */
function geometryClassification(type, positions) {
  const category = componentCategory(type);
  if (category === 'SUPPORT') return 'DEFERRED';
  if (category === 'TEE' || category === 'OLET') return 'JUNCTION';
  const start = strictPoint(positions.APOS), end = strictPoint(positions.LPOS);
  if (category === 'ELBO/BEND' && start && end) {
    const bend = strictPoint(positions.POS), length = bend
      ? Math.hypot(bend.x - start.x, bend.y - start.y, bend.z - start.z) + Math.hypot(end.x - bend.x, end.y - bend.y, end.z - bend.z)
      : Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    return length > GEOMETRY_TOLERANCE_MM ? 'FINITE' : 'POINT';
  }
  if (start && end) return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) > GEOMETRY_TOLERANCE_MM ? 'FINITE' : 'POINT';
  return strictPoint(positions.POS) ? 'POINT' : 'UNKNOWN';
}

/** @param {Record<string, unknown>} record @returns {string} */
function sourceEntityId(record) {
  const attributes = objectRecord(record.attributes);
  return cleanText(record.sourceEntityId ?? record.sourceId ?? attributes.SOURCE_ENTITY_ID ?? attributes.SOURCE_ID);
}

/** @param {Record<string, unknown>} record @returns {string} */
function recordType(record) {
  return cleanText(record.type ?? objectRecord(record.attributes).TYPE).toUpperCase();
}

/** @param {Record<string, unknown>} record @returns {string} */
function recordName(record) {
  return cleanText(record.name ?? objectRecord(record.attributes).NAME);
}

/** @param {Record<string, unknown>} record @returns {string} */
function recordRef(record) {
  return cleanText(record.ref ?? objectRecord(record.attributes).REF);
}

/** @param {Record<string, unknown>} attributes @param {string} prefix @param {string} sourcePath @param {string} sourceType @param {string} ownerId @param {readonly (readonly string[])[]} definitions @returns {ReadonlyArray<Record<string, unknown>>} */
function readPorts(attributes, prefix, sourcePath, sourceType, ownerId, definitions) {
  return Object.freeze(definitions.flatMap(([field, role, idField]) => {
    const position = strictPoint(attributes[field]);
    if (!position) return [];
    const sourcePortId = cleanText(attributes[idField]);
    return [deepFreeze({
      viewKey: `${prefix}:port:${role}`,
      sourcePortId,
      sourceEntityId: ownerId,
      sourcePath: `${sourcePath}.attributes.${field}`,
      sourceType,
      role,
      position,
    })];
  }));
}

/** @param {Record<string, unknown>} child @param {number} branchIndex @param {number} sourceIndex @param {string} branchName @param {string} rootPath @returns {Readonly<Record<string, unknown>>} */
function readComponent(child, branchIndex, sourceIndex, branchName, rootPath) {
  const attributes = objectRecord(child.attributes);
  const sourcePath = `${rootPath}[${branchIndex}].children[${sourceIndex}]`;
  const type = recordType(child), entityId = sourceEntityId(child);
  const positions = { APOS: strictPoint(attributes.APOS), LPOS: strictPoint(attributes.LPOS), POS: strictPoint(attributes.POS) };
  return deepFreeze({
    viewKey: `source:${sourcePath}`,
    sourceEntityId: entityId,
    sourcePath,
    sourceBranch: branchName,
    branchIndex,
    sourceIndex,
    type,
    componentCategory: componentCategory(type),
    geometryClassification: geometryClassification(type, positions),
    name: recordName(child),
    ref: recordRef(child),
    dispositionKind: type === 'SUPPORT' ? 'EMIT_SUPPORT_ATTACHMENT' : '',
    isRouteComponent: ROUTE_COMPONENT_TYPES.includes(type),
    positions: deepFreeze(positions),
    ports: readPorts(attributes, `source:${sourcePath}`, sourcePath, type, entityId, COMPONENT_PORT_DEFINITIONS),
    references: deepFreeze({
      CREF: cleanText(attributes.CREF),
      HREF: cleanText(attributes.HREF),
      TREF: cleanText(attributes.TREF),
    }),
    attributes: deepFreeze(cloneJson(attributes)),
    // Option B: carry enrichedAttributes set by the Workbench through the freeze so
    // the export path can use them without requiring the user to re-run enrichment.
    enrichedAttributes: deepFreeze(cloneJson(child.enrichedAttributes ?? {})),
  });
}

/** @param {Record<string, unknown>} branch @param {number} branchIndex @param {string} rootPath @returns {Readonly<Record<string, unknown>>} */
function readBranch(branch, branchIndex, rootPath) {
  const sourcePath = `${rootPath}[${branchIndex}]`;
  const attributes = objectRecord(branch.attributes);
  const name = recordName(branch);
  const components = asArray(branch.children).map((child, sourceIndex) => readComponent(
    objectRecord(child), branchIndex, sourceIndex, name, rootPath,
  ));
  return deepFreeze({
    viewKey: `source:${sourcePath}`,
    sourceEntityId: sourceEntityId(branch),
    sourcePath,
    branchIndex,
    name,
    type: recordType(branch) || 'BRANCH',
    ref: recordRef(branch),
    positions: deepFreeze({ HPOS: strictPoint(attributes.HPOS), TPOS: strictPoint(attributes.TPOS) }),
    references: deepFreeze({ HREF: cleanText(attributes.HREF), TREF: cleanText(attributes.TREF) }),
    attributes: deepFreeze(cloneJson(attributes)),
    ports: readPorts(attributes, `source:${sourcePath}`, sourcePath, 'BRANCH', sourceEntityId(branch), BRANCH_PORT_DEFINITIONS),
    components: Object.freeze(components),
  });
}

/** @param {ReadonlyArray<Record<string, unknown>>} branches @returns {Readonly<Record<string, unknown>>} */
function referenceInventory(branches) {
  const branchNames = new Set(branches.flatMap((branch) => [cleanText(branch.name), cleanText(objectRecord(branch.attributes).NAME)]).filter(Boolean));
  const componentRefs = new Set(branches.flatMap((branch) => asArray(branch.components).flatMap((component) => [
    cleanText(objectRecord(component).name),
    cleanText(objectRecord(component).ref),
  ])).filter(Boolean));
  const branchReferences = branches.flatMap((branch) => ['HREF', 'TREF'].flatMap((kind) => {
    const value = cleanText(objectRecord(branch.references)[kind]);
    if (!value) return [];
    return [{ kind, value, branchName: branch.name, sourcePath: `${branch.sourcePath}.attributes.${kind}`, resolved: branchNames.has(value) || componentRefs.has(value) }];
  }));
  const crefReferences = branches.flatMap((branch) => asArray(branch.components).flatMap((component) => {
    const value = cleanText(objectRecord(objectRecord(component).references).CREF);
    if (!value) return [];
    return [{ kind: 'CREF', value, branchName: branch.name, sourcePath: `${component.sourcePath}.attributes.CREF`, resolved: branchNames.has(value) || componentRefs.has(value) }];
  }));
  return deepFreeze({ branchReferences, crefReferences });
}

/** @param {unknown} input @returns {Readonly<Record<string, unknown>>} */
export function readManagedTopologySource(input) {
  const cloned = cloneJson(input);
  const rootRecord = objectRecord(cloned);
  const rawBranches = Array.isArray(cloned) ? cloned : asArray(rootRecord.hierarchy ?? rootRecord.branches ?? rootRecord.objects);
  if (!rawBranches.length) throw new TypeError('Managed source JSON must contain a non-empty branch array.');
  const rootPath = Array.isArray(cloned) ? '$' : (Array.isArray(rootRecord.hierarchy) ? '$.hierarchy' : (Array.isArray(rootRecord.objects) ? '$.objects' : '$.branches'));
  const branches = rawBranches.map((branch, index) => readBranch(objectRecord(branch), index, rootPath));
  const components = branches.flatMap((branch) => asArray(branch.components));
  const references = referenceInventory(branches);
  const typeCounts = Object.fromEntries(uniqueText(components.map((component) => objectRecord(component).type)).map((type) => [
    type,
    components.filter((component) => objectRecord(component).type === type).length,
  ]));
  const componentCategoryCounts = Object.fromEntries(uniqueText(components.map((component) => objectRecord(component).componentCategory)).map((category) => [
    category,
    components.filter((component) => objectRecord(component).componentCategory === category).length,
  ]));
  const routeTypeTotal = components.filter((component) => objectRecord(component).isRouteComponent === true).length;
  return deepFreeze({
    schema: 'ManagedTopologySourceInventory.v1',
    branches,
    components,
    entities: Object.freeze([...branches, ...components]),
    ports: Object.freeze([
      ...branches.flatMap((branch) => asArray(objectRecord(branch).ports)),
      ...components.flatMap((component) => asArray(objectRecord(component).ports)),
    ]),
    references,
    metrics: deepFreeze({
      branchCount: branches.length,
      sourceComponentCount: components.length,
      routeComponentCount: components.filter((component) => objectRecord(component).isRouteComponent === true).length,
      deferredSupportCount: components.filter((component) => objectRecord(component).type === 'SUPPORT').length,
      syntheticPipeCount: components.filter((component) => objectRecord(component).type === 'PIPE').length,
      routeTypeTotal,
      crefCount: asArray(objectRecord(references).crefReferences).length,
      resolvedCrefCount: asArray(objectRecord(references).crefReferences).filter((row) => objectRecord(row).resolved === true).length,
      hrefTrefCount: asArray(objectRecord(references).branchReferences).length,
      resolvedHrefTrefCount: asArray(objectRecord(references).branchReferences).filter((row) => objectRecord(row).resolved === true).length,
      externalReferenceCount: asArray(objectRecord(references).branchReferences).filter((row) => objectRecord(row).resolved !== true).length,
      typeCounts: deepFreeze(typeCounts),
      componentCategoryCounts: deepFreeze(componentCategoryCounts),
    }),
    raw: deepFreeze(cloned),
  });
}

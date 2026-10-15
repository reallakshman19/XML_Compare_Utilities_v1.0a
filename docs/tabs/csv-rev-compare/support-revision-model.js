import { graphChildren } from '../../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { parsePipeIdentity, parseSupportPosition } from './support-revision-normalization.js';

export const SUPPORT_REVISION_MODEL_SCHEMA = 'support-revision-xml-model/v2-composite-location-identity';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const normalizeIdentityPart = (value) => upper(value).replace(/\s+/g, ' ');

export function buildSupportRevisionModel(conversion) {
  if (!conversion?.graph) throw new Error('A categorized support-revision graph is required.');
  const graph = conversion.graph;
  const source = conversion.source || null;
  const locations = [];
  for (const secondary of graph.nodes.filter((node) => node.levelId === 'secondarySupport')) {
    const children = graphChildren(graph, secondary.id).filter((node) => node.levelId === 'supportLocation');
    for (const location of children) locations.push(buildLocation(graph, source, secondary, location));
  }
  return Object.freeze({
    schema: SUPPORT_REVISION_MODEL_SCHEMA,
    revision: String(conversion.revision || ''),
    profileId: graph.profileId,
    profileVersion: String(conversion.profile?.version || ''),
    sourceId: source?.sourceId || graph.sourceIds?.[0] || '',
    locations: Object.freeze(locations),
    locationByNodeId: new Map(locations.map((location) => [location.nodeId, location])),
    diagnostics: Object.freeze([...(graph.diagnostics || []), ...(conversion.validationResults || [])]),
  });
}

function buildLocation(graph, source, secondaryNode, locationNode) {
  const children = graphChildren(graph, locationNode.id);
  const pipeNode = children.find((node) => node.levelId === 'pipe');
  const positionNode = children.find((node) => node.levelId === 'position');
  const componentNodes = children.filter((node) => node.levelId === 'primarySupport');
  const loadNodes = children.filter((node) => node.levelId === 'load');
  const family = clean(locationNode.fields?.civilSecondarySupport || secondaryNode.fields?.civilSecondarySupport || secondaryNode.key);
  const rowId = locationNode.sourceRefs?.[0] || '';
  const components = Object.freeze(componentNodes.map((node) => componentFromNode(source, rowId, node)));
  const persistentReferences = Object.freeze([...new Set(components.map((item) => item.reference).filter(Boolean))].sort());
  const referenceMultiplicity = Object.freeze(referenceMultiplicityOf(components));
  const pipe = parsePipeIdentity(pipeNode?.fields?.raw || pipeNode?.key || '');
  const supportLocationIdentity = compositeSupportLocationIdentity(family, pipe.raw);
  return Object.freeze({
    nodeId: locationNode.id,
    secondaryNodeId: secondaryNode.id,
    sourceRowId: rowId,
    family,
    familyClass: familyClass(family),
    supportLocationIdentity,
    supportLocationIdentityRaw: clean(locationNode.fields?.supportLocationIdentity || `${family}||${pipe.raw}`),
    legacyIdentity: clean(locationNode.fields?.legacyIdentity || secondaryNode.fields?.legacyIdentity),
    scope: clean(locationNode.fields?.scope),
    size: clean(locationNode.fields?.size),
    pipe,
    position: parseSupportPosition(positionNode?.fields || {}),
    components,
    persistentReferences,
    referenceMultiplicity,
    referenceSetKey: persistentReferences.join('|'),
    referenceMultiplicityKey: referenceMultiplicityKey(referenceMultiplicity),
    loads: loadNodes.map((node) => Object.freeze({ nodeId: node.id, sourceRefs: node.sourceRefs, ...node.fields })),
    sourceFields: Object.freeze({ ...(locationNode.fields || {}) }),
    provenance: Object.freeze({ locationNodeId: locationNode.id, secondaryNodeId: secondaryNode.id, sourceRowId: rowId, cells: locationCellRefs(source, rowId) }),
  });
}

export function compositeSupportLocationIdentity(civilSecondarySupport, pipeRaw) {
  return `${normalizeIdentityPart(civilSecondarySupport)}||${normalizeIdentityPart(pipeRaw)}`;
}

function componentFromNode(source, rowId, node) {
  const memberId = clean(node.fields?.memberId || node.fields?.value);
  const supportType = clean(node.fields?.supportType);
  const reference = normalizeReference(node.fields?.reference);
  return Object.freeze({
    nodeId: node.id,
    sourceRowId: node.sourceRefs?.[0] || rowId,
    ordinal: Number(node.fields?.manyOrdinal || 0),
    memberId,
    memberFamily: memberFamily(memberId),
    supportType,
    supportTypeKey: upper(supportType),
    reference,
    provenance: Object.freeze({
      sourceRowId: node.sourceRefs?.[0] || rowId,
      memberCells: cellRefs(source, rowId, 'PIPING PRIMARY SUPPORT'),
      supportTypeCells: cellRefs(source, rowId, 'SUPPORT TYPE'),
      referenceCells: cellRefs(source, rowId, 'PIPING PRIMARY SUPPORT REFERENCE'),
      graphEvidence: Object.freeze([...(node.evidence || [])]),
    }),
  });
}

export function referenceIndex(model) {
  const index = new Map();
  for (const location of model?.locations || []) for (const component of location.components) {
    if (!component.reference) continue;
    if (!index.has(component.reference)) index.set(component.reference, []);
    index.get(component.reference).push(Object.freeze({ location, component }));
  }
  return index;
}

export function componentByReference(location) {
  const index = new Map();
  for (const component of location?.components || []) {
    if (!component.reference) continue;
    if (!index.has(component.reference)) index.set(component.reference, []);
    index.get(component.reference).push(component);
  }
  for (const [reference, components] of index) index.set(reference, Object.freeze([...components]));
  return index;
}

function referenceMultiplicityOf(components) {
  const counts = {};
  for (const component of components || []) if (component.reference) counts[component.reference] = (counts[component.reference] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
function referenceMultiplicityKey(counts) { return Object.entries(counts || {}).map(([reference, count]) => `${reference}#${count}`).join('|'); }
function normalizeReference(value) { return clean(value).replace(/\s+/g, ''); }
function memberFamily(memberId) { const value = clean(memberId).replace(/^\//, ''); const dot = value.lastIndexOf('.'); return dot > 0 ? value.slice(0, dot) : value; }
function familyClass(family) { const value = clean(family).replace(/^\//, ''); return value.replace(/[._-]?\d+$/i, '') || value; }
function locationCellRefs(source, rowId) {
  const headers = ['PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE','EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY','PRIMARY SUPPORT DESCRIPTION','PRIMARY SUPPORT ZONE','PRIMARY SUPPORT SITE','PIPE SCHEDULE','INSULATION','STRESS SYSTEM NUMBER','NODE NO','REVISION','REMARKS (IF ANY)'];
  return Object.freeze(Object.fromEntries(headers.map((header) => [header, cellRefs(source, rowId, header)])));
}
function cellRefs(source, rowId, header) {
  if (!source) return Object.freeze([]);
  return Object.freeze((source.headers || []).flatMap((candidate, index) => candidate === header ? [`${rowId}:${source.columnIds?.[index] || header}`] : []));
}

export const _test = Object.freeze({ normalizeReference, memberFamily, familyClass, cellRefs, normalizeIdentityPart, referenceMultiplicityOf, referenceMultiplicityKey });

/**
 * Functionality: projects normalized artifacts and validation findings into
 * immutable TopologySvgViewModel.v1. Input includes explicit view/filter state.
 * Search matches are kept separate from the displayed branch scope so typing
 * cannot replace the engineering view. Output contains no raw artifacts.
 */

import {
  TOPOLOGY_VIEW_MODEL_SCHEMA,
  asArray,
  cleanText,
  deepFreeze,
  objectRecord,
  uniqueText,
} from './topology-validator-values.js';
import { calculateTopologyBounds, projectTopologyPoint } from './topology-svg-projections.js';
import { buildTopologySelectionLookup } from './topology-selection-view-model.js';

/** @param {Record<string, unknown>} component @param {Record<string, unknown>} state @param {Map<string,string>} dispositions @returns {boolean} */
function componentPassesFacets(component, state, dispositions) {
  const types = asArray(state.types).map(cleanText);
  if (types.length && !types.includes(cleanText(component.componentCategory))) return false;
  const disposition = dispositions.get(cleanText(component.sourceEntityId) || cleanText(component.sourcePath)) ?? '';
  if (cleanText(state.disposition) && cleanText(state.disposition) !== disposition) return false;
  return true;
}

/** @param {Record<string, unknown>} component @param {Record<string, unknown>} state @param {Map<string,string>} dispositions @returns {boolean} */
function componentVisible(component, state, dispositions) {
  const branch = cleanText(state.branch);
  return componentPassesFacets(component, state, dispositions)
    && (!branch || cleanText(component.sourceBranch) === branch);
}

/** @param {Record<string, unknown>} component @param {Record<string, unknown>} state @returns {boolean} */
function componentViewMatchesSearch(component, state) {
  const types = asArray(state.types).map(cleanText);
  if (types.length && !types.includes(cleanText(component.componentCategory))) return false;
  if (cleanText(state.disposition) && cleanText(state.disposition) !== cleanText(component.disposition)) return false;
  const attributes = objectRecord(component.attributes);
  const searches = [
    [state.searchName, `${cleanText(component.name)} ${cleanText(attributes.NAME)}`],
    [state.searchRef, `${cleanText(component.ref)} ${cleanText(attributes.REF)}`],
    [state.searchPath, component.sourcePath],
  ];
  return searches.every(([needle, value]) => !cleanText(needle) || cleanText(value).toLowerCase().includes(cleanText(needle).toLowerCase()));
}

/** @param {Record<string, unknown>} state @returns {boolean} */
function hasActiveSearch(state) {
  return [state.searchName, state.searchRef, state.searchPath].some((value) => Boolean(cleanText(value)));
}

/** @param {Record<string, unknown>} object @param {Set<string>} sourceIds @returns {boolean} */
function hasVisibleLineage(object, sourceIds) {
  return asArray(object.sourceEntityIds).map(cleanText).some((id) => sourceIds.has(id));
}

/** @param {Record<string, unknown>} edge @returns {boolean} */
function isReferenceConnection(edge) {
  return cleanText(edge.segmentRole) === 'CREF_BRANCH_CONNECTION';
}

/** @param {Record<string, unknown>} component @param {Map<string,string>} dispositions @returns {Readonly<Record<string, unknown>>} */
function componentView(component, dispositions) {
  return deepFreeze({
    objectKey: cleanText(component.viewKey), sourceEntityId: cleanText(component.sourceEntityId), sourcePath: cleanText(component.sourcePath),
    branch: cleanText(component.sourceBranch), sourceIndex: component.sourceIndex, type: cleanText(component.type), componentCategory: cleanText(component.componentCategory),
    geometryClassification: cleanText(component.geometryClassification), name: cleanText(component.name), ref: cleanText(component.ref),
    positions: deepFreeze(objectRecord(component.positions)), references: deepFreeze(objectRecord(component.references)), attributes: deepFreeze(objectRecord(component.attributes)),
    disposition: dispositions.get(cleanText(component.sourceEntityId) || cleanText(component.sourcePath)) ?? '',
  });
}

/** @param {Record<string, unknown>} branch @param {Map<string,string>} dispositions @returns {Readonly<Record<string, unknown>>} */
function branchView(branch, dispositions) {
  return deepFreeze({
    objectKey: cleanText(branch.viewKey), sourceEntityId: cleanText(branch.sourceEntityId), sourcePath: cleanText(branch.sourcePath),
    branch: cleanText(branch.name), sourceIndex: branch.branchIndex, type: 'BRANCH', componentCategory: 'BRANCH', geometryClassification: 'BRANCH',
    name: cleanText(branch.name), ref: cleanText(branch.ref), positions: deepFreeze(objectRecord(branch.positions)), references: deepFreeze(objectRecord(branch.references)),
    disposition: dispositions.get(cleanText(branch.sourceEntityId) || cleanText(branch.sourcePath)) ?? '',
  });
}

/** @param {Record<string, unknown>} record @returns {Readonly<Record<string, unknown>>} */
function traceLinkView(record) {
  const list = (field) => Object.freeze(asArray(record[field]).map(cleanText));
  return deepFreeze({
    objectKey: cleanText(record.viewKey), recordId: cleanText(record.recordId), sourceEntityId: cleanText(record.sourceEntityId), sourcePath: cleanText(record.sourcePath),
    sourceType: cleanText(record.sourceType), sourceRef: cleanText(record.sourceRef), disposition: cleanText(record.disposition), primaryDisposition: cleanText(record.primaryDisposition),
    operation: cleanText(record.operation), status: cleanText(record.status), classification: cleanText(record.classification), projectionCardinality: cleanText(record.projectionCardinality),
    canonicalNodeIds: list('canonicalNodeIds'), canonicalEdgeIds: list('canonicalEdgeIds'), affectedEdgeIds: list('affectedEdgeIds'), branchEdgeIds: list('branchEdgeIds'),
    pointFeatureIds: list('pointFeatureIds'), junctionIds: list('junctionIds'), boundaryIds: list('boundaryIds'), affectedSourceEntityIds: list('affectedSourceEntityIds'),
    inputXmlElementIds: list('inputXmlElementIds'), inputXmlChildIds: list('inputXmlChildIds'), deferredProperties: list('deferredProperties'), evidence: deepFreeze(objectRecord(record.evidence)),
  });
}

/** @param {Record<string, unknown>} input @returns {Readonly<Record<string, unknown>>} */
export function buildTopologySvgViewModel(input) {
  const source = objectRecord(input.source), canonical = objectRecord(input.canonical), ledger = objectRecord(input.ledger);
  const validation = objectRecord(input.validation), state = objectRecord(input.state), inputXml = input.inputXml ? objectRecord(input.inputXml) : null;
  const dispositionMap = new Map(asArray(ledger.records).map((row) => {
    const record = objectRecord(row);
    return [cleanText(record.sourceEntityId) || cleanText(record.sourcePath), cleanText(record.disposition)];
  }));
  const allComponents = asArray(source.components).map(objectRecord), componentViews = allComponents.map((component) => componentView(component, dispositionMap));
  const sourceComponents = componentViews.filter((_view, index) => componentVisible(allComponents[index], state, dispositionMap));
  const branchViews = asArray(source.branches).map(objectRecord).map((branch) => branchView(branch, dispositionMap));
  const sourceEntities = [...branchViews, ...componentViews];
  const searchActive = hasActiveSearch(state);
  const matchingComponents = searchActive
    ? componentViews.filter((component) => componentViewMatchesSearch(component, state))
    : [];
  const visibleBranches = branchViews.filter((branch) => !cleanText(state.branch) || branch.branch === cleanText(state.branch));
  const traceSources = [...visibleBranches, ...sourceComponents];
  const visibleSourceKeys = new Set(traceSources.flatMap((component) => [component.sourceEntityId, component.sourcePath]).filter(Boolean));
  const visibleSourceIds = new Set(sourceComponents.map((component) => component.sourceEntityId).filter(Boolean));
  for (const branch of visibleBranches) visibleSourceIds.add(branch.sourceEntityId);
  const fullTraceLinks = asArray(ledger.records).map(objectRecord).map(traceLinkView);
  const traceLinksByEdgeId = new Map();
  for (const link of fullTraceLinks) for (const edgeId of asArray(link.canonicalEdgeIds).map(cleanText)) {
    traceLinksByEdgeId.set(edgeId, [...(traceLinksByEdgeId.get(edgeId) ?? []), link]);
  }
  const traceLinks = fullTraceLinks.filter((record) => visibleSourceKeys.has(cleanText(record.sourceEntityId)) || visibleSourceKeys.has(cleanText(record.sourcePath)));
  const projection = cleanText(state.projection);
  const projectCanonical = (row, kind) => {
    const record = objectRecord(row);
    return deepFreeze({
      ...record,
      objectKey: `canonical:${kind}:${cleanText(record.id) || cleanText(record.viewKey)}`,
      projectedPosition: projectTopologyPoint(record.position, projection),
    });
  };
  const fullNodes = asArray(canonical.nodes).map((row) => projectCanonical(row, 'node'));
  const nodeMap = new Map(fullNodes.map((node) => [cleanText(node.id), node]));
  const fullEdges = asArray(canonical.edges).map((row) => {
    const edge = objectRecord(row), from = nodeMap.get(cleanText(edge.fromNodeId)), to = nodeMap.get(cleanText(edge.toNodeId));
    const edgeLinks = traceLinksByEdgeId.get(cleanText(edge.id)) ?? [];
    const directInputIds = uniqueText(asArray(edge.inputXmlElementIds)), ledgerInputIds = uniqueText(edgeLinks.flatMap((link) => asArray(link.inputXmlElementIds)));
    return deepFreeze({
      ...edge,
      objectKey: `canonical:edge:${cleanText(edge.id) || cleanText(edge.viewKey)}`,
      sourceEntityIds: uniqueText([...asArray(edge.sourceEntityIds), ...edgeLinks.map((link) => link.sourceEntityId)]),
      sourceTypes: uniqueText([...asArray(edge.sourceTypes), ...edgeLinks.map((link) => link.sourceType)]),
      inputXmlElementIds: directInputIds.length ? directInputIds : ledgerInputIds.length === 1 ? ledgerInputIds : [],
      projectedStart: from?.projectedPosition ?? null,
      projectedEnd: to?.projectedPosition ?? null,
    });
  });
  const fullPointFeatures = asArray(canonical.pointFeatures).map((row) => projectCanonical(row, 'pointFeature'));
  const fullJunctions = asArray(canonical.junctions).map((row) => projectCanonical(row, 'junction'));
  const fullBoundaries = asArray(canonical.boundaries).map((row) => projectCanonical(row, 'boundary'));
  const showReferenceConnections = objectRecord(state.visibility).referenceConnections === true;
  const edges = fullEdges.filter((edge) => hasVisibleLineage(edge, visibleSourceIds) && (showReferenceConnections || !isReferenceConnection(edge)));
  const visibleNodeIds = new Set(edges.flatMap((edge) => [cleanText(edge.fromNodeId), cleanText(edge.toNodeId)]));
  const nodes = fullNodes.filter((node) => visibleNodeIds.has(cleanText(node.id)) || hasVisibleLineage(node, visibleSourceIds));
  const pointFeatures = fullPointFeatures.filter((object) => hasVisibleLineage(object, visibleSourceIds));
  const junctions = fullJunctions.filter((object) => hasVisibleLineage(object, visibleSourceIds));
  const boundaries = fullBoundaries.filter((object) => hasVisibleLineage(object, visibleSourceIds));
  const sourceGeometry = sourceComponents.map((component) => deepFreeze({
    ...component,
    projectedStart: projectTopologyPoint(objectRecord(component.positions).APOS, projection),
    projectedEnd: projectTopologyPoint(objectRecord(component.positions).LPOS, projection),
    projectedPoint: projectTopologyPoint(objectRecord(component.positions).POS, projection),
  }));
  const projectedPoints = [
    ...sourceGeometry.flatMap((row) => [row.projectedStart, row.projectedEnd, row.projectedPoint]),
    ...nodes.map((row) => row.projectedPosition),
    ...pointFeatures.map((row) => row.projectedPosition),
    ...junctions.map((row) => row.projectedPosition),
    ...boundaries.map((row) => row.projectedPosition),
  ];
  const inputXmlElements = inputXml ? asArray(inputXml.elements).map((row) => {
    const element = objectRecord(row);
    return deepFreeze({ objectKey: cleanText(element.viewKey), id: cleanText(element.id), fromNode: cleanText(element.fromNode), toNode: cleanText(element.toNode), sourceType: cleanText(element.sourceType), delta: deepFreeze(objectRecord(element.delta)), children: deepFreeze(asArray(element.children)) });
  }) : [];
  const visibleComponentKeys = new Set(sourceGeometry.map((component) => cleanText(component.objectKey)));
  const sourcePorts = asArray(source.ports).map(objectRecord).filter((port) => visibleComponentKeys.has(cleanText(port.viewKey).split(':port:')[0])).map((port) => deepFreeze({
    objectKey: cleanText(port.viewKey),
    sourcePortId: cleanText(port.sourcePortId),
    role: cleanText(port.role),
    projectedPosition: projectTopologyPoint(port.position, projection),
  }));
  const issues = asArray(validation.issues).map((row) => {
    const finding = objectRecord(row);
    const keys = uniqueText([
      ...asArray(finding.sourceEntityIds).flatMap((id) => sourceEntities.filter((item) => item.sourceEntityId === cleanText(id)).map((item) => item.objectKey)),
      ...asArray(finding.canonicalIds).flatMap((id) => [
        `canonical:node:${cleanText(id)}`, `canonical:edge:${cleanText(id)}`, `canonical:pointFeature:${cleanText(id)}`, `canonical:junction:${cleanText(id)}`, `canonical:boundary:${cleanText(id)}`,
      ]),
      ...asArray(finding.inputXmlElementIds).flatMap((id) => inputXmlElements.filter((item) => item.id === cleanText(id)).map((item) => item.objectKey)),
    ]);
    return deepFreeze({ ...finding, objectKeys: keys });
  });
  const byObjectKey = buildTopologySelectionLookup({
    sources: sourceEntities, nodes: fullNodes, edges: fullEdges, points: fullPointFeatures, junctions: fullJunctions, boundaries: fullBoundaries,
    links: fullTraceLinks, inputElements: inputXmlElements, issues,
  });
  const routeMatches = matchingComponents.filter((component) => component.componentCategory !== 'SUPPORT').length;
  const deferredMatches = matchingComponents.filter((component) => component.componentCategory === 'SUPPORT').length;
  const filterSummary = deepFreeze({
    searchActive, sourceMatchCount: matchingComponents.length, routeMatchCount: routeMatches,
    deferredMatchCount: deferredMatches, canonicalEdgeMatchCount: edges.length,
    canonicalObjectMatchCount: nodes.length + edges.length + pointFeatures.length + junctions.length + boundaries.length,
    displayedSourceCount: sourceComponents.length, displayedBranchCount: visibleBranches.length,
    displayScope: cleanText(state.branch) || 'ALL_BRANCHES',
  });
  return deepFreeze({
    schema: TOPOLOGY_VIEW_MODEL_SCHEMA,
    mode: cleanText(state.mode),
    projection,
    bounds: calculateTopologyBounds(projectedPoints),
    visibility: deepFreeze(objectRecord(state.visibility)),
    labels: state.labels === true,
    showComponentSymbols: state.showComponentSymbols === true,
    branches: Object.freeze(asArray(source.branches).map(objectRecord).filter((row) => !cleanText(state.branch) || cleanText(row.name) === cleanText(state.branch)).map((row) => ({ name: cleanText(row.name), sourcePath: cleanText(row.sourcePath), references: deepFreeze(objectRecord(row.references)) }))),
    branchReferences: filterBranchReferences(objectRecord(source.references), cleanText(state.branch)),
    sourceComponents: Object.freeze(sourceGeometry),
    searchResults: Object.freeze(matchingComponents.slice(0, 100)),
    filterSummary,
    sourceEntities: Object.freeze(sourceEntities),
    traceSources: Object.freeze(traceSources),
    sourcePorts: Object.freeze(sourcePorts),
    canonicalNodes: Object.freeze(nodes),
    canonicalEdges: Object.freeze(edges),
    pointFeatures: Object.freeze(pointFeatures),
    junctions: Object.freeze(junctions),
    boundaries: Object.freeze(boundaries),
    traceLinks: Object.freeze(traceLinks),
    fullTraceLinks: Object.freeze(fullTraceLinks),
    inputXmlElements: Object.freeze(inputXmlElements),
    issues: Object.freeze(issues),
    metrics: deepFreeze(objectRecord(validation.metrics)),
    gates: deepFreeze(objectRecord(validation.gates)),
    inputXmlStatus: cleanText(validation.inputXmlStatus),
    componentInputXmlStatus: cleanText(validation.componentInputXmlStatus),
    selectionLookup: deepFreeze({ byObjectKey }),
  });
}

/** @param {Record<string, unknown>} viewModel @param {Record<string, unknown>} state @returns {Readonly<Record<string, unknown>>} */
export function updateTopologySearchViewModel(viewModel, state) {
  const searchActive = hasActiveSearch(state);
  const components = asArray(viewModel.sourceEntities).map(objectRecord).filter((row) => cleanText(row.componentCategory) !== 'BRANCH');
  const matches = searchActive ? components.filter((component) => componentViewMatchesSearch(component, state)) : [];
  const routeMatches = matches.filter((component) => component.componentCategory !== 'SUPPORT').length;
  const deferredMatches = matches.filter((component) => component.componentCategory === 'SUPPORT').length;
  const filterSummary = deepFreeze({
    ...objectRecord(viewModel.filterSummary), searchActive, sourceMatchCount: matches.length,
    routeMatchCount: routeMatches, deferredMatchCount: deferredMatches,
  });
  return Object.freeze({ ...viewModel, searchResults: Object.freeze(matches.slice(0, 100)), filterSummary });
}

export const _test = Object.freeze({ componentVisible, componentViewMatchesSearch, componentView, branchView, traceLinkView, hasActiveSearch, hasVisibleLineage, isReferenceConnection });

/** @param {Record<string, unknown>} references @param {string} branch @returns {Readonly<Record<string, unknown>>} */
function filterBranchReferences(references, branch) {
  const filter = (rows) => Object.freeze(asArray(rows).map(objectRecord).filter((row) => !branch || cleanText(row.branchName) === branch));
  return deepFreeze({
    branchReferences: filter(references.branchReferences),
    crefReferences: filter(references.crefReferences),
  });
}

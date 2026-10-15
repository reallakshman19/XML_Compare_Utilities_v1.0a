/**
 * Real 1885_NC end-to-end validator acceptance.
 * Inputs: untouched managed JSON plus producer canonical/ledger/InputXML files.
 * Output: independent zero-issue lineage, component, connectivity, and vector gates.
 * Missing sibling artifacts skip so the static repository remains portable.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readManagedTopologySource } from '../tabs/topology-trace-validator/topology-source-reader.js';
import { bindProducerSourceIdentity } from '../tabs/topology-trace-validator/topology-source-identity.js';
import { readCanonicalTopology, readTopologyInputXml, readTopologyTraceLedger } from '../tabs/topology-trace-validator/topology-artifact-reader.js';
import { validateTopologyArtifacts } from '../tabs/topology-trace-validator/topology-independent-validator.js';
import { buildTopologySvgViewModel } from '../tabs/topology-trace-validator/topology-svg-view-model.js';

const baseUrl = new URL('../../3D_Converters/Benchmarks/1885_NC/', import.meta.url);
const paths = Object.fromEntries([
  ['source', '1885_NC.json'],
  ['canonical', '1885_NC.canonical-topology.json'],
  ['ledger', '1885_NC.topology-trace-ledger.json'],
  ['inputXml', '1885_NC.topology.input.xml'],
].map(([kind, name]) => [kind, fileURLToPath(new URL(name, baseUrl))]));

if (Object.values(paths).some((path) => !existsSync(path))) {
  console.log(`topology trace validator 1885_NC chain SKIPPED: artifacts are not complete at ${fileURLToPath(baseUrl)}`);
} else {
  const rawSource = JSON.parse(readFileSync(paths.source, 'utf8'));
  const ledger = readTopologyTraceLedger(JSON.parse(readFileSync(paths.ledger, 'utf8')));
  const source = bindProducerSourceIdentity(readManagedTopologySource(rawSource), ledger);
  const canonical = readCanonicalTopology(JSON.parse(readFileSync(paths.canonical, 'utf8')));
  const inputXml = readTopologyInputXml(readFileSync(paths.inputXml, 'utf8'));
  const validation = validateTopologyArtifacts({ source, canonical, ledger, inputXml }, 0.5);

  assert.equal(source.identityBindingStatus, 'BOUND');
  assert.equal(source.identityConflicts.length, 0);
  assert.equal(source.entities.filter((row) => row.sourceEntityId).length, 4598);
  assert.equal(source.ports.filter((row) => row.sourcePortId).length, 12634);
  assert.equal(validation.issues.length, 0);
  assert.equal(validation.metrics.issueCount, 0);
  assert.equal(validation.metrics.blockingIssueCount, 0);
  assert.deepEqual(validation.gates, {
    sourceDispositionCoverage: 100,
    canonicalNodeAncestry: 100,
    canonicalEdgeAncestry: 100,
    inputXmlElementAncestry: 100,
    silentDrops: 0,
    orphanCanonicalNodes: 0,
    orphanCanonicalEdges: 0,
    orphanInputXmlElements: 0,
    blockingTopologyIssues: 0,
    routeComponentDispositionCoverage: 100,
    silentComponentAbsorption: 0,
    silentComponentDrops: 0,
    conflictingComponentDispositions: 0,
    componentInputXmlProjection: 'EVALUATED',
  });
  assert.deepEqual({
    nodes: validation.metrics.canonicalNodeCount,
    edges: validation.metrics.canonicalEdgeCount,
    points: validation.metrics.pointFeatureCount,
    boundaries: validation.metrics.boundaryCount,
    inputElements: validation.metrics.mappedInputXmlElementCount,
  }, { nodes: 3409, edges: 3429, points: 63, boundaries: 28, inputElements: 3429 });
  assert.deepEqual({
    inline: validation.metrics.inlineInstrumentCount,
    point: validation.metrics.pointInstrumentCount,
    blocked: validation.metrics.blockedInstrumentCount,
  }, { inline: 44, point: 33, blocked: 0 });
  assert.equal(validation.metrics.invalidZeroLengthInputXmlElementCount, 0);
  assert.equal(validation.metrics.vectorMismatchCount, 0);
  assert.equal(validation.metrics.connectivityMismatchCount, 0);
  for (const card of Object.values(validation.metrics.componentCoverage)) assert.equal(card.result, 'PASS');

  const viewState = {
    mode: 'issues', projection: 'XY', branch: '', types: [], disposition: '',
    searchName: '', searchRef: '', searchPath: '', labels: false, showComponentSymbols: false,
    visibility: { source: true, canonical: true, referenceConnections: false, pointFeatures: true, junctions: true, boundaries: true },
  };
  const viewModel = buildTopologySvgViewModel({
    source, canonical, ledger, inputXml, validation,
    state: viewState,
  });
  assert.equal(viewModel.issues.length, validation.metrics.issueCount, 'summary, issue rows, and SVG issue objects must reconcile');
  assert(viewModel.canonicalEdges.every((edge) => edge.segmentRole !== 'CREF_BRANCH_CONNECTION'), 'reference spans stay out of default spatial auto-fit');
  const referenceView = buildTopologySvgViewModel({ source, canonical, ledger, inputXml, validation, state: { ...viewState, visibility: { ...viewState.visibility, referenceConnections: true } } });
  assert(referenceView.canonicalEdges.some((edge) => edge.segmentRole === 'CREF_BRANCH_CONNECTION'), 'reference spans remain available through explicit visibility');
  const firstBranch = source.branches[0].name;
  const firstBranchComponentCount = source.components.filter((component) => component.sourceBranch === firstBranch).length;
  const highCardinalitySearch = buildTopologySvgViewModel({
    source, canonical, ledger, inputXml, validation,
    state: { ...viewState, mode: 'spatial', branch: firstBranch, searchName: 'PS-12' },
  });
  assert.equal(highCardinalitySearch.filterSummary.sourceMatchCount, 1217, 'PS-12 real-data search count must remain independently visible');
  assert.equal(highCardinalitySearch.filterSummary.deferredMatchCount, 1209);
  assert.equal(highCardinalitySearch.filterSummary.routeMatchCount, 8);
  assert.equal(highCardinalitySearch.searchResults.length, 100, 'the result panel must cap large result sets');
  assert.equal(highCardinalitySearch.sourceComponents.length, firstBranchComponentCount, 'search must not expand the SVG to all matching branches');
  assert(highCardinalitySearch.sourceComponents.every((component) => component.branch === firstBranch));
  assert(canonical.edges.every((edge) => edge.id && edge.sourceEntityIds.length && edge.inputXmlElementIds.length));
  console.log(`topology trace validator 1885_NC chain passed\n${JSON.stringify({ metrics: validation.metrics, gates: validation.gates }, null, 2)}`);
}

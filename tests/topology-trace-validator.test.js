import assert from 'node:assert/strict';
import { readCanonicalTopology, readTopologyInputXml, readTopologyTraceLedger } from '../tabs/topology-trace-validator/topology-artifact-reader.js';
import { topologyCompanionBaseUrls, topologyCompanionFileNames } from '../tabs/topology-trace-validator/topology-companion-loader.js';
import { validateTopologyArtifacts } from '../tabs/topology-trace-validator/topology-independent-validator.js';
import { buildTopologyBottomPanelMarkup } from '../tabs/topology-trace-validator/topology-ledger-table.js';
import { readManagedTopologySource } from '../tabs/topology-trace-validator/topology-source-reader.js';
import { resolveTopologySelectionKeys } from '../tabs/topology-trace-validator/topology-svg-interactions.js';
import { _test as navigationTest } from '../tabs/topology-trace-validator/topology-svg-navigation.js';
import { buildTopologySvgMarkup } from '../tabs/topology-trace-validator/topology-svg-renderer.js';
import { buildTopologySvgViewModel, updateTopologySearchViewModel } from '../tabs/topology-trace-validator/topology-svg-view-model.js';
import { GEOMETRY_TOLERANCE_MM, semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';
import { canonicalTopologyFixture, topologyInputXmlFixture, topologySourceFixture, topologyTraceLedgerFixture } from './fixtures/topology-trace-validator-fixture.js';

function artifacts(inputXmlText) {
  return Object.freeze({
    source: readManagedTopologySource(topologySourceFixture),
    canonical: readCanonicalTopology(canonicalTopologyFixture),
    ledger: readTopologyTraceLedger(topologyTraceLedgerFixture),
    inputXml: readTopologyInputXml(inputXmlText),
  });
}

function state(mode) {
  return Object.freeze({
    mode, projection: 'XY', branch: '/B1', types: [], disposition: '',
    searchName: '', searchRef: '', searchPath: '', labels: true, showComponentSymbols: true,
    visibility: Object.freeze({ source: true, canonical: true, pointFeatures: true, junctions: true, boundaries: true }),
  });
}

const validArtifacts = artifacts(topologyInputXmlFixture);
assert.deepEqual(topologyCompanionFileNames('1885_NC.json'), {
  stem: '1885_NC', canonical: '1885_NC.canonical-topology.json',
  ledger: '1885_NC.topology-trace-ledger.json', inputXml: '1885_NC.topology.input.xml',
  scene: '1885_NC.topology-svg-scene.json', parsed: '1885_NC.parsed-inputxml-topology.json',
  report: '1885_NC.topology-parity-report.json',
});
const configuredBases = topologyCompanionBaseUrls('1885_NC.json', 'https://example.test/XML_Compare_Utilities/?topologyArtifactBase=/published/1885_NC');
assert.equal(configuredBases[0], 'https://example.test/published/1885_NC/');
const beforeHashes = Object.freeze({
  source: semanticHash(validArtifacts.source.raw),
  canonical: semanticHash(validArtifacts.canonical.raw),
  ledger: semanticHash(validArtifacts.ledger.raw),
});
const report = validateTopologyArtifacts(validArtifacts, GEOMETRY_TOLERANCE_MM);

assert.equal(report.gates.sourceDispositionCoverage, 100, 'TEST 1: every source entity must have one final disposition');
assert.equal(report.gates.canonicalNodeAncestry, 100);
assert.equal(report.gates.canonicalEdgeAncestry, 100);
assert.equal(report.gates.inputXmlElementAncestry, 100);
assert.equal(report.metrics.orphanInputXmlElementCount, 0, 'TEST 2: all InputXML references must resolve');
assert.equal(report.metrics.vectorMismatchCount, 0, 'TEST 6: exact canonical/InputXML vectors must pass');
assert.equal(report.issues.length, 0);

const spatialView = buildTopologySvgViewModel({ ...validArtifacts, validation: report, state: state('spatial') });
const spatialMarkup = buildTopologySvgMarkup(spatialView);
assert.match(spatialMarkup, /data-canonical-edge-id="E-VALVE"/);
assert.match(spatialMarkup, /data-source-entity-ids="SRC-VALVE"/);
assert.match(spatialMarkup, /data-inputxml-element-ids="PE-VALVE"/, 'TEST 3: rendered edge identity must include InputXML lineage');
for (const type of ['VALVE', 'FLANGE', 'GASK', 'INST', 'REDUCER', 'ELBO\/BEND', 'TEE', 'OLET', 'SUPPORT']) assert.match(spatialMarkup, new RegExp(`data-source-component-type="${type}"`));
assert.doesNotMatch(spatialMarkup, /ttv-source-route[^>]+SRC-SUPPORT/, 'deferred support must not participate in route continuity');
assert.match(spatialMarkup, /ttv-hit-path/, 'rendered routes and edges need a forgiving selection target');

const deferredSearch = buildTopologySvgViewModel({ ...validArtifacts, validation: report, state: { ...state('spatial'), searchName: 'S1' } });
assert.equal(deferredSearch.filterSummary.sourceMatchCount, 1);
assert.equal(deferredSearch.filterSummary.deferredMatchCount, 1);
assert.equal(deferredSearch.searchResults[0].componentCategory, 'SUPPORT');
assert(deferredSearch.canonicalEdges.length > 0, 'typing a search must preserve the selected branch SVG scope');
assert.match(buildTopologySvgMarkup(deferredSearch), /1 search matches listed/);
const crossBranchSearch = buildTopologySvgViewModel({ ...validArtifacts, validation: report, state: { ...state('spatial'), searchName: 'PT' } });
assert.equal(crossBranchSearch.searchResults[0].branch, '/B2', 'search results must operate across the branch tree');
assert(crossBranchSearch.sourceComponents.every((component) => component.branch === '/B1'), 'search must not replace the selected branch geometry');
assert(!crossBranchSearch.canonicalEdges.some((edge) => edge.id === 'E-TEE-BR'));
const searchOnlyUpdate = updateTopologySearchViewModel(spatialView, { ...state('spatial'), searchName: 'PT' });
assert.strictEqual(searchOnlyUpdate.sourceComponents, spatialView.sourceComponents, 'search-only updates must reuse immutable spatial geometry');
assert.strictEqual(searchOnlyUpdate.canonicalEdges, spatialView.canonicalEdges);
assert.equal(searchOnlyUpdate.searchResults[0].branch, '/B2');
const allBranchesView = buildTopologySvgViewModel({ ...validArtifacts, validation: report, state: { ...state('spatial'), branch: '', showComponentSymbols: false } });
assert.equal(allBranchesView.branches.length, 3, 'an empty branch scope must render the complete model');
assert.equal(allBranchesView.sourceComponents.length, validArtifacts.source.components.length);

const baseBox = { x: 0, y: 0, width: 1200, height: 720 };
assert.deepEqual(navigationTest.zoomedBox(baseBox, baseBox, 0.8, { x: 600, y: 360 }), { x: 120, y: 72, width: 960, height: 576 });

const sourceKey = spatialView.sourceComponents.find((component) => component.sourceEntityId === 'SRC-BEND').objectKey;
const selectionKeys = resolveTopologySelectionKeys(spatialView.selectionLookup.byObjectKey, sourceKey);
assert(selectionKeys.includes(sourceKey));
assert(selectionKeys.includes('canonical:edge:E-BEND-A'));
assert(selectionKeys.includes('canonical:edge:E-BEND-B'), 'one bend source must retain its one-to-many edge mapping');
assert(selectionKeys.some((key) => key.startsWith('inputxml:PIPINGELEMENT')), 'TEST 4: source click group must include projected InputXML objects');
assert(selectionKeys.some((key) => key.startsWith('ledger:')));

const clickSamples = {
  'SRC-PIPE-1': 'canonical:edge:E-P1A', 'SRC-VALVE': 'canonical:edge:E-VALVE', 'SRC-FLANGE': 'canonical:edge:E-FLANGE',
  'SRC-GASK': 'canonical:edge:E-GASK', 'SRC-INST-INLINE': 'canonical:edge:E-INST', 'SRC-BEND': 'canonical:edge:E-BEND-A',
  'SRC-TEE': 'canonical:junction:J-TEE', 'SRC-OLET': 'canonical:junction:J-OLET', 'SRC-REDUCER': 'canonical:edge:E-REDU',
  'SRC-B3': 'canonical:boundary:BND-EXT',
};
for (const [sourceId, expectedKey] of Object.entries(clickSamples)) {
  const source = spatialView.sourceEntities.find((row) => row.sourceEntityId === sourceId);
  assert(source, `click sample source ${sourceId} must exist`);
  assert(resolveTopologySelectionKeys(spatialView.selectionLookup.byObjectKey, source.objectKey).includes(expectedKey), `${sourceId} must trace to ${expectedKey}`);
}
const mergedInput = spatialView.inputXmlElements.find((row) => row.id === 'PE-ASSEMBLY');
const mergeKeys = resolveTopologySelectionKeys(spatialView.selectionLookup.byObjectKey, mergedInput.objectKey);
assert(mergeKeys.includes('canonical:edge:E-FLANGE') && mergeKeys.includes('canonical:edge:E-GASK'), 'explicit many-to-one projection must retain both canonical sources');

for (const mode of ['spatial', 'trace', 'junctions', 'issues']) {
  const view = buildTopologySvgViewModel({ ...validArtifacts, validation: report, state: state(mode) });
  buildTopologySvgMarkup(view);
  buildTopologyBottomPanelMarkup(view, mode === 'issues' ? 'issues' : 'summary');
}
assert.deepEqual({
  source: semanticHash(validArtifacts.source.raw),
  canonical: semanticHash(validArtifacts.canonical.raw),
  ledger: semanticHash(validArtifacts.ledger.raw),
}, beforeHashes, 'TEST 5: view operations must not mutate semantic artifacts');

const mismatchedXml = topologyInputXmlFixture.replace('ID="PE-VALVE" FROM_NODE="10" TO_NODE="12" DELTA_X="2"', 'ID="PE-VALVE" FROM_NODE="10" TO_NODE="12" DELTA_X="3"');
const mismatchArtifacts = artifacts(mismatchedXml);
const mismatchReport = validateTopologyArtifacts(mismatchArtifacts, GEOMETRY_TOLERANCE_MM);
assert.equal(mismatchReport.metrics.vectorMismatchCount, 1);
const issueView = buildTopologySvgViewModel({ ...mismatchArtifacts, validation: mismatchReport, state: state('issues') });
const issueSvg = buildTopologySvgMarkup(issueView);
const issueTable = buildTopologyBottomPanelMarkup(issueView, 'issues');
const svgIssueCount = [...issueSvg.matchAll(/data-issue-id=/g)].length;
const tableIssueCount = [...issueTable.matchAll(/data-issue-id=/g)].length;
assert.equal(mismatchReport.metrics.issueCount, mismatchReport.issues.length);
assert.equal(svgIssueCount, mismatchReport.issues.length);
assert.equal(tableIssueCount, mismatchReport.issues.length, 'TEST 7: summary, table, and SVG issue counts must reconcile');

const duplicateLedger = structuredClone(topologyTraceLedgerFixture);
const valveRecord = duplicateLedger.records.find((row) => row.id === 'L-VALVE');
duplicateLedger.records.push({ ...valveRecord, id: 'L-VALVE-DUPLICATE' });
const duplicateReport = validateTopologyArtifacts({ ...validArtifacts, ledger: readTopologyTraceLedger(duplicateLedger) }, GEOMETRY_TOLERANCE_MM);
assert(duplicateReport.issues.some((finding) => finding.code === 'SOURCE_DISPOSITION_CARDINALITY'));

const missingEdgeLedger = structuredClone(topologyTraceLedgerFixture);
missingEdgeLedger.records.find((row) => row.id === 'L-VALVE').canonicalEdgeIds = ['E-MISSING'];
const missingEdgeReport = validateTopologyArtifacts({ ...validArtifacts, ledger: readTopologyTraceLedger(missingEdgeLedger) }, GEOMETRY_TOLERANCE_MM);
assert(missingEdgeReport.issues.some((finding) => finding.code === 'LEDGER_CANONICAL_REFERENCE_MISSING'));

const noInputXml = validateTopologyArtifacts({ ...validArtifacts, inputXml: null }, GEOMETRY_TOLERANCE_MM);
assert.equal(noInputXml.inputXmlStatus, 'NOT_EVALUATED');
assert.equal(noInputXml.componentInputXmlStatus, 'NOT_EVALUATED');
assert.equal(noInputXml.gates.inputXmlElementAncestry, 'NOT_EVALUATED');
assert.equal(noInputXml.metrics.orphanInputXmlElementCount, 'NOT_EVALUATED');

const dispositionMarkup = buildTopologyBottomPanelMarkup(spatialView, 'disposition');
for (const heading of ['Finite/point classification', 'Primary disposition', 'Projection cardinality', 'Deferred properties', 'Focus in SVG']) assert.match(dispositionMarkup, new RegExp(heading));
const summaryMarkup = buildTopologyBottomPanelMarkup(spatialView, 'summary');
for (const category of ['PIPE', 'VALVE', 'FLANGE', 'GASK', 'ELBO/BEND', 'TEE', 'OLET', 'INST', 'REDUCER', 'SUPPORT']) assert.match(summaryMarkup, new RegExp(`data-component-coverage="${category.replace('/', '\\/')}"`));

const invalidCardinality = structuredClone(topologyTraceLedgerFixture);
invalidCardinality.records.find((row) => row.id === 'L-BEND').projectionCardinality = 'ONE_TO_ONE';
const cardinalityReport = validateTopologyArtifacts({ ...validArtifacts, ledger: readTopologyTraceLedger(invalidCardinality) }, GEOMETRY_TOLERANCE_MM);
assert(cardinalityReport.issues.some((finding) => finding.code === 'UNEXPLAINED_ONE_TO_MANY'));

const absorbedValve = structuredClone(topologyTraceLedgerFixture);
absorbedValve.records.find((row) => row.id === 'L-VALVE').primaryDisposition = 'EMIT_ROUTE_EDGE';
const absorbedReport = validateTopologyArtifacts({ ...validArtifacts, ledger: readTopologyTraceLedger(absorbedValve) }, GEOMETRY_TOLERANCE_MM);
assert(absorbedReport.issues.some((finding) => finding.code === 'INLINE_COMPONENT_DISPOSITION_INVALID'));

console.log('topology trace validator focused tests passed');

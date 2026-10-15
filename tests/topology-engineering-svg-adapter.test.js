import assert from 'node:assert/strict';
import { createEngineeringRevisionToken } from '../core/engineering-scene/index.js';
import { runEngineeringSvgAdapterConformance } from '../core/engineering-svg/engineering-svg-adapter-conformance.js';
import { readCanonicalTopology, readTopologyInputXml, readTopologyTraceLedger } from '../tabs/topology-trace-validator/topology-artifact-reader.js';
import { validateTopologyArtifacts } from '../tabs/topology-trace-validator/topology-independent-validator.js';
import { readManagedTopologySource } from '../tabs/topology-trace-validator/topology-source-reader.js';
import { createTopologyEngineeringSvgAdapter } from '../tabs/topology-trace-validator/topology-engineering-svg-adapter.js';
import { buildTopologyEngineeringSvgScene } from '../tabs/topology-trace-validator/topology-engineering-svg-scene.js';
import { prepareTopologyEngineeringSvgViewModel } from '../tabs/topology-trace-validator/topology-engineering-svg-view-model.js';
import { buildTopologySvgMarkup } from '../tabs/topology-trace-validator/topology-svg-renderer.js';
import { buildTopologySvgViewModel } from '../tabs/topology-trace-validator/topology-svg-view-model.js';
import { GEOMETRY_TOLERANCE_MM } from '../tabs/topology-trace-validator/topology-validator-values.js';
import {
  canonicalTopologyFixture,
  topologyInputXmlFixture,
  topologySourceFixture,
  topologyTraceLedgerFixture,
} from './fixtures/topology-trace-validator-fixture.js';

const source = readManagedTopologySource(topologySourceFixture);
const canonical = readCanonicalTopology(canonicalTopologyFixture);
const ledger = readTopologyTraceLedger(topologyTraceLedgerFixture);
const inputXml = readTopologyInputXml(topologyInputXmlFixture);
const validation = validateTopologyArtifacts({ source, canonical, ledger, inputXml }, GEOMETRY_TOLERANCE_MM);

function state(projection) {
  return Object.freeze({
    mode: 'spatial', projection, branch: '/B1', types: [], disposition: '',
    searchName: '', searchRef: '', searchPath: '', labels: true, showComponentSymbols: true,
    visibility: Object.freeze({ source: true, canonical: true, pointFeatures: true, junctions: true, boundaries: true }),
  });
}

function view(projection) {
  return buildTopologySvgViewModel({ source, canonical, ledger, inputXml, validation, state: state(projection) });
}

function geometryLedger(scene) {
  return scene.entities.map((entity) => ({ id: entity.id, geometry: entity.geometry }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function componentPoint(viewModel, sourceEntityId, field) {
  const component = viewModel.sourceComponents.find((value) => value.sourceEntityId === sourceEntityId);
  return component.positions[field];
}

function pointValue(point) {
  return { x: point.x, y: point.y, z: point.z };
}

const revision = createEngineeringRevisionToken({ topology: 'fixture-r1' });
const xyView = view('XY');
const prepared = prepareTopologyEngineeringSvgViewModel(xyView);
assert.equal(prepared.sourcePorts.length, xyView.sourcePorts.length);
assert(prepared.sourcePorts.every((port) => port.position && Number.isFinite(port.position.z)));
assert.equal(buildTopologySvgMarkup(prepared), buildTopologySvgMarkup(xyView));

const xyBuild = buildTopologyEngineeringSvgScene(xyView, { sceneId: 'ttv-fixture', revision });
assert.equal(xyBuild.parity.totals.omitted, 0);
assert.equal(xyBuild.parity.totals.mapped, xyBuild.parity.totals.eligible);
assert.equal(xyBuild.scene.entities.length, xyBuild.parity.totals.mapped);
assert.equal(xyBuild.scene.capabilities.editing, false);
assert(xyBuild.scene.entities.every((entity) => entity.id === entity.domainRef.objectKey));

const port = xyBuild.scene.entities.find((entity) => entity.id.endsWith(':port:A'));
assert(port && port.geometry.kind === 'point');
const ownerKey = port.id.slice(0, port.id.lastIndexOf(':port:'));
const portOwner = xyView.sourceComponents.find((component) => component.objectKey === ownerKey);
assert.deepEqual(pointValue(port.geometry.position), portOwner.positions.APOS);

const bend = xyBuild.scene.entities.find((entity) => entity.domainRef.sourceEntityId === 'SRC-BEND');
assert.equal(bend.geometry.kind, 'polyline');
assert.deepEqual(bend.geometry.points.map(pointValue), [
  componentPoint(xyView, 'SRC-BEND', 'APOS'),
  componentPoint(xyView, 'SRC-BEND', 'POS'),
  componentPoint(xyView, 'SRC-BEND', 'LPOS'),
]);

const edge = xyBuild.scene.entities.find((entity) => entity.id === 'canonical:edge:E-VALVE');
const fromNode = xyView.canonicalNodes.find((node) => node.id === 'N1');
const toNode = xyView.canonicalNodes.find((node) => node.id === 'N2');
assert.deepEqual(pointValue(edge.geometry.start), fromNode.position);
assert.deepEqual(pointValue(edge.geometry.end), toNode.position);
assert.deepEqual(edge.metadata.topologyTrace.inputXmlElementIds, ['PE-VALVE']);

const isoBuild = buildTopologyEngineeringSvgScene(view('ISO'), { sceneId: 'ttv-fixture', revision });
assert.deepEqual(geometryLedger(isoBuild.scene), geometryLedger(xyBuild.scene));
assert.deepEqual(isoBuild.scene.entities.map((entity) => entity.id), xyBuild.scene.entities.map((entity) => entity.id));
assert.throws(() => buildTopologyEngineeringSvgScene(xyView, { sceneId: 'ttv-fixture' }), /explicit revision token/);

let currentView = xyView;
let currentRevision = revision;
const listeners = new Set();
const topologyAdapter = createTopologyEngineeringSvgAdapter({
  adapterId: 'ttv-fixture-adapter',
  sceneId: 'ttv-fixture',
  getViewModel: () => currentView,
  getRevision: () => currentRevision,
  subscribeViewModel(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
});
assert.equal(topologyAdapter.adapter.descriptor.accessMode, 'read-only');
assert.equal(topologyAdapter.adapter.commandGateway, null);
const conformance = await runEngineeringSvgAdapterConformance(topologyAdapter.adapter);
assert.equal(conformance.passed, true);
assert.equal(listeners.size, 0);

const sharedScene = await topologyAdapter.adapter.getScene();
const selectedIds = sharedScene.entities.slice(0, 4).map((entity) => entity.id);
const propertySets = await topologyAdapter.adapter.propertyProvider.getPropertySets(selectedIds, sharedScene.revision);
assert.deepEqual(propertySets.map((set) => set.ownerIds[0]), selectedIds);
assert(propertySets.every((set) => set.fields.every((field) => field.editable === false)));

const subscriptionEvents = [];
const unsubscribe = topologyAdapter.adapter.subscribeScene((event) => subscriptionEvents.push(event));
currentView = view('XZ');
currentRevision = createEngineeringRevisionToken({ topology: 'fixture-r2' });
for (const listener of listeners) listener({ viewModel: currentView, revision: currentRevision, reason: 'projection-change' });
assert.equal(subscriptionEvents.length, 1);
assert.equal(subscriptionEvents[0].reason, 'projection-change');
assert.deepEqual(geometryLedger(subscriptionEvents[0].scene), geometryLedger(xyBuild.scene));
unsubscribe();
assert.equal(listeners.size, 0);

console.log('Topology Trace engineering SVG adapter parity: ok');

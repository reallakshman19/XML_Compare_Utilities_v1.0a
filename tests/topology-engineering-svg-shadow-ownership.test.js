import assert from 'node:assert/strict';
import { createEngineeringRevisionToken } from '../core/engineering-scene/index.js';
import { readCanonicalTopology, readTopologyInputXml, readTopologyTraceLedger } from '../tabs/topology-trace-validator/topology-artifact-reader.js';
import { createTopologyEngineeringSvgShadowWorkspace } from '../tabs/topology-trace-validator/topology-engineering-svg-shadow-workspace.js';
import { validateTopologyArtifacts } from '../tabs/topology-trace-validator/topology-independent-validator.js';
import { readManagedTopologySource } from '../tabs/topology-trace-validator/topology-source-reader.js';
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
const viewModel = buildTopologySvgViewModel({
  source,
  canonical,
  ledger,
  inputXml,
  validation,
  state: {
    mode: 'spatial', projection: 'XY', branch: '', types: [], disposition: '',
    searchName: '', searchRef: '', searchPath: '', labels: true, showComponentSymbols: true,
    visibility: { source: true, canonical: true, pointFeatures: true, junctions: true, boundaries: true },
  },
});
const revision = createEngineeringRevisionToken({ topologyShadow: 1 });
const host = { ownerDocument: { createElement() { throw new Error('DOM creation must not be reached.'); } } };
const valid = {
  host,
  adapterId: 'adapter',
  sceneId: 'scene',
  shellId: 'shell',
  getViewModel: () => viewModel,
  getRevision: () => revision,
  subscribeViewModel: () => () => true,
};

await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, host: null }), /requires a DOM host/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, adapterId: '' }), /requires adapterId/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, sceneId: '' }), /requires sceneId/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, shellId: '' }), /requires shellId/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, getViewModel: null }), /requires getViewModel/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, getRevision: null }), /requires getRevision/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({ ...valid, subscribeViewModel: null }), /requires subscribeViewModel/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({
  ...valid,
  getViewModel: () => null,
}), /getViewModel must return a view-model object/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({
  ...valid,
  getRevision: () => ({ schema: 'MalformedRevision.v1', value: 1 }),
}), /owner revision must use schema "EngineeringRevisionToken.v1"/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeViewModel(listener) {
    listener({ viewModel, revision });
    return () => true;
  },
}), /owner event requires reason/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeViewModel(listener) {
    listener({ viewModel, revision: { schema: 'MalformedRevision.v1', value: 2 }, reason: 'bad-revision' });
    return () => true;
  },
}), /owner event revision must use schema "EngineeringRevisionToken.v1"/);
await assert.rejects(() => createTopologyEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeViewModel: () => null,
}), /owner subscription must return an unsubscribe function/);

console.log('Topology engineering SVG shadow ownership contracts: ok');

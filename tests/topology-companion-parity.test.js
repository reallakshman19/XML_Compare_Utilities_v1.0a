import assert from 'node:assert/strict';
import {
  loadTopologyCompanionSet,
  loadTopologySourceFile,
  topologyCompanionFileNames,
} from '../tabs/topology-trace-validator/topology-companion-loader.js';

const names = topologyCompanionFileNames('1885_NC.json');
assert.deepEqual(names, {
  stem: '1885_NC',
  canonical: '1885_NC.canonical-topology.json',
  ledger: '1885_NC.topology-trace-ledger.json',
  inputXml: '1885_NC.topology.input.xml',
  scene: '1885_NC.topology-svg-scene.json',
  parsed: '1885_NC.parsed-inputxml-topology.json',
  report: '1885_NC.topology-parity-report.json',
});
assert.equal(names.ciiProjection, '1885_NC.inputxml-cii-projection-ledger.json');
assert.equal(Object.keys(names).includes('ciiProjection'), false, 'new optional filename must not alter legacy descriptor enumeration');

const payloads = {
  [names.canonical]: JSON.stringify({ schema: 'CanonicalTopology.v1' }),
  [names.ledger]: JSON.stringify({ schema: 'TopologyTraceLedger.v1' }),
  [names.inputXml]: '<CAESARII XML_TYPE="Input"><PIPINGMODEL/></CAESARII>',
  [names.scene]: JSON.stringify({ schema: 'TopologySvgScene.v1' }),
  [names.parsed]: JSON.stringify({ schema: 'ParsedInputXmlTopology.v1' }),
  [names.report]: JSON.stringify({ schema: 'TopologyParityReport.v1' }),
  [names.ciiProjection]: JSON.stringify({ schema: 'InputXmlCiiProjectionLedger.v1' }),
};
const requested = [];
const fetchImpl = async (url) => {
  requested.push(url);
  const name = url.split('/').at(-1), text = payloads[name];
  return text === undefined ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => text };
};
const pageUrl = 'https://example.test/index.html?topologyArtifactBase=https://cdn.test/1885_NC/';
const companions = await loadTopologyCompanionSet('1885_NC.json', pageUrl, fetchImpl);
assert.equal(companions.baseUrl, 'https://cdn.test/1885_NC/');
for (const kind of ['canonical', 'ledger', 'inputXml', 'scene', 'parsed', 'report', 'ciiProjection']) assert.equal(companions[kind], payloads[names[kind]], kind);
assert.equal(requested.length, 7);

const loaded = [];
const controller = {
  loadArtifact: async (kind, text, fileName) => loaded.push({ kind, text, fileName }),
  validate: () => ({ trace: { blockingCount: 0 }, parity: { status: 'PASS' } }),
};
const sourceFile = { name: '1885_NC.json', text: async () => '[]' };
const result = await loadTopologySourceFile(controller, sourceFile, pageUrl, fetchImpl);
assert.deepEqual(loaded.map((row) => row.kind), ['source', 'canonical', 'ledger', 'inputXml', 'scene', 'parsed', 'report', 'ciiProjection']);
assert.equal(result.validation.parity.status, 'PASS');

const optionalMissing = await loadTopologyCompanionSet('1885_NC.json', pageUrl, async (url) => {
  const name = url.split('/').at(-1);
  if (name === names.canonical || name === names.ledger) return { ok: true, status: 200, text: async () => payloads[name] };
  return { ok: false, status: 404, text: async () => '' };
});
for (const kind of ['inputXml', 'scene', 'parsed', 'report', 'ciiProjection']) assert.equal(optionalMissing[kind], null, kind);

console.log('topology parity companion discovery passed');

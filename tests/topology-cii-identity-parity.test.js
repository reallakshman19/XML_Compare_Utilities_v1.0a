import assert from 'node:assert/strict';
import { buildCiiSvgIdentityParity, readInputXmlCiiProjectionLedger } from '../tabs/topology-trace-validator/topology-cii-identity-parity.js';
import { buildTopologySceneViewModel } from '../tabs/topology-trace-validator/topology-scene-view-model.js';
import { topologyParityInspectorMarkup, topologyParitySummaryMarkup } from '../tabs/topology-trace-validator/topology-parity-panel.js';

const hash = (letter) => letter.repeat(64);
const ledgerFixture = {
  schema: 'InputXmlCiiProjectionLedger.v1',
  authority: { repository: 'reallaksh19/3D_Converters', writer: 'converters/scripts/inputxml_to_cii2019.py', wrapper: 'converters/scripts/inputxml_to_cii2019_assured.py', mode: 'ASSURED_STRICT', rule: 'actual writer output only' },
  status: 'PASS',
  chain: { canonicalHashSha256: hash('a'), assuranceHashSha256: hash('b'), fieldCatalogHashSha256: hash('c'), projectionContractHashSha256: hash('d'), ciiHashSha256: hash('e') },
  writerPolicy: {}, summary: {}, writerStats: {}, sections: [],
  elements: [
    { inputXmlElementId: 'PE-1', elementIndex: 1, fromNode: '10', toNode: '20', pointers: { BEND: 1, RIGID: 0 } },
    { inputXmlElementId: 'PE-2', elementIndex: 2, fromNode: '20', toNode: '30', pointers: { BEND: 0, RESTRANT: 1 } },
  ],
  records: [
    { projectionRecordId: 'IXPL-0000001', assuranceRecordId: 'IXAL-0000001', sourceEntityId: 'SRC-1', sourceType: 'ELBO', inputXmlElementIds: ['PE-1'], plannedSections: ['ELEMENTS', 'BEND'], catalogProjectionStatus: 'PROJECTED', effectiveSections: ['ELEMENTS', 'BEND'], targets: [{ section: 'ELEMENTS', index: 1, indexBasis: 'ELEMENT_ORDINAL', ownerElementId: 'PE-1' }, { section: 'BEND', index: 1, indexBasis: 'ELEMENT_AUX_POINTER', ownerElementId: 'PE-1' }], status: 'PASS', diagnostics: [] },
    { projectionRecordId: 'IXPL-0000002', assuranceRecordId: 'IXAL-0000002', sourceEntityId: 'SRC-2', sourceType: 'PIPE', inputXmlElementIds: ['PE-2'], plannedSections: ['ELEMENTS'], catalogProjectionStatus: 'PROJECTED', effectiveSections: ['ELEMENTS'], targets: [{ section: 'ELEMENTS', index: 2, indexBasis: 'ELEMENT_ORDINAL', ownerElementId: 'PE-2' }], status: 'PASS', diagnostics: [] },
  ],
  diagnostics: [], projectionHashSha256: hash('f'),
};

const parsed = {
  schema: 'ParsedInputXmlTopology.v1',
  elements: [
    { id: 'PE-1', canonicalEdgeId: 'CE-1', fromCanonicalNodeId: 'CN-10', toCanonicalNodeId: 'CN-20', fromPosition: { x: 0, y: 0, z: 0 }, toPosition: { x: 100, y: 0, z: 0 } },
    { id: 'PE-2', canonicalEdgeId: 'CE-2', fromCanonicalNodeId: 'CN-20', toCanonicalNodeId: 'CN-30', fromPosition: { x: 100, y: 0, z: 0 }, toPosition: { x: 200, y: 0, z: 0 } },
  ], restraints: [],
};
const scene = {
  schema: 'TopologySvgScene.v1', canonicalTopologyHash: hash('1'), svgSceneHash: hash('2'),
  nodes: [
    { id: 'N1', canonicalNodeId: 'CN-10', position: { x: 0, y: 0, z: 0 } },
    { id: 'N2', canonicalNodeId: 'CN-20', position: { x: 100, y: 0, z: 0 } },
    { id: 'N3', canonicalNodeId: 'CN-30', position: { x: 200, y: 0, z: 0 } },
  ],
  edges: [
    { id: 'SVG-1', canonicalEdgeId: 'CE-1', inputXmlElementId: 'PE-1', fromCanonicalNodeId: 'CN-10', toCanonicalNodeId: 'CN-20', fromPosition: { x: 0, y: 0, z: 0 }, toPosition: { x: 100, y: 0, z: 0 }, branchIds: ['/B1'] },
    { id: 'SVG-2', canonicalEdgeId: 'CE-2', inputXmlElementId: 'PE-2', fromCanonicalNodeId: 'CN-20', toCanonicalNodeId: 'CN-30', fromPosition: { x: 100, y: 0, z: 0 }, toPosition: { x: 200, y: 0, z: 0 }, branchIds: ['/B1'] },
  ], supports: [], deferredSupports: [], rigids: [], junctions: [], boundaries: [], pointFeatures: [],
};

const ledger = readInputXmlCiiProjectionLedger(ledgerFixture);
assert(Object.isFrozen(ledger));
const pass = buildCiiSvgIdentityParity({ projection: ledger, parsed, scene });
assert.equal(pass.schema, 'CiiSvgIdentityParity.v1');
assert.equal(pass.status, 'PASS');
assert.equal(pass.summary.ciiElementCount, 2);
assert.equal(pass.summary.projectionRecordCount, 2);
assert.equal(pass.summary.ciiIdentityMismatchCount, 0);

const view = buildTopologySceneViewModel({ scene, parsed, report: { mismatches: [], summary: {} }, ciiParity: pass, state: { projection: 'XY' } });
const sceneSelection = view.selectionLookup.byObjectKey['scene:edge:CE-1'];
assert(sceneSelection.linkedObjectKeys.includes('cii:ELEMENTS:1'));
const inputSelection = view.selectionLookup.byObjectKey['inputxml:edge:PE-1'];
assert(inputSelection.linkedObjectKeys.includes('cii:ELEMENTS:1'));
const ciiSelection = view.selectionLookup.byObjectKey['cii:ELEMENTS:1'];
assert(ciiSelection.linkedObjectKeys.includes('inputxml:edge:PE-1'));
assert(ciiSelection.linkedObjectKeys.includes('scene:edge:CE-1'));
const inspector = topologyParityInspectorMarkup(sceneSelection, { scene, parsed, ledger: { records: [] }, ciiProjection: ledger });
assert.match(inspector, /CII ELEMENTS projection/);
assert.match(inspector, /&quot;elementIndex&quot;: 1/);
const summary = topologyParitySummaryMarkup({ status: 'PASS', reasons: [] }, { summary: {} }, pass);
assert.match(summary, /CII Identity Status/);
assert.match(summary, />PASS</);

const missingProjection = structuredClone(ledgerFixture);
missingProjection.elements.pop();
missingProjection.records.pop();
const missing = buildCiiSvgIdentityParity({ projection: readInputXmlCiiProjectionLedger(missingProjection), parsed, scene });
assert.equal(missing.status, 'FAIL');
assert(missing.mismatches.some((row) => row.category === 'INPUTXML_ELEMENT_MISSING_CII_PROJECTION'));
assert(missing.mismatches.some((row) => row.category === 'SVG_EDGE_WITHOUT_CII_OWNER'));

const orphan = structuredClone(ledgerFixture);
orphan.elements[1].inputXmlElementId = 'PE-ORPHAN';
orphan.records[1].inputXmlElementIds = ['PE-ORPHAN'];
orphan.records[1].targets[0].ownerElementId = 'PE-UNKNOWN';
const orphanResult = buildCiiSvgIdentityParity({ projection: readInputXmlCiiProjectionLedger(orphan), parsed, scene });
assert.equal(orphanResult.status, 'FAIL');
assert(orphanResult.mismatches.some((row) => row.category === 'CII_PROJECTION_ORPHAN_INPUTXML_ELEMENT'));
assert(orphanResult.mismatches.some((row) => row.category === 'UNOWNED_CII_TARGET'));

const blocked = structuredClone(ledgerFixture); blocked.status = 'BLOCKED';
const blockedResult = buildCiiSvgIdentityParity({ projection: readInputXmlCiiProjectionLedger(blocked), parsed, scene });
assert(blockedResult.mismatches.some((row) => row.category === 'CII_PROJECTION_LEDGER_BLOCKED'));

const duplicate = structuredClone(ledgerFixture); duplicate.elements[1].elementIndex = 1;
assert.throws(() => readInputXmlCiiProjectionLedger(duplicate), /Duplicate CII ELEMENTS index/);
assert.equal(buildCiiSvgIdentityParity({ parsed, scene }).status, 'NOT_RUN');

console.log('CII to SVG identity parity checks passed');

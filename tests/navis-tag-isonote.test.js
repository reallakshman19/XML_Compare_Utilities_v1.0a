import assert from 'node:assert/strict';
import { parseSupportTableText, buildSupportTableRecords } from '../tabs/navis-tag-isonote/navis-tag-table-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';
import { buildResolutionSupportRecords } from '../tabs/navis-tag-isonote/navis-tag-resolution-source.js';
import { parseNavisTagXml } from '../tabs/navis-tag-isonote/navis-tag-xml-parser.js';
import { attachNavisResolutionToIdentityTrace, buildIdentityNodeTrace } from '../tabs/navis-tag-isonote/navis-tag-identity-trace.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';
import { buildNavisTagIsonoteReadiness } from '../tabs/navis-tag-isonote/navis-tag-readiness.js';

const tableText = `Name of the element\tPIPE\tISOMETRIC NOTES\tPOS
PS-14416.2\tASIM-1836-2"-A8010850-13421\tEXISTING NOTE\t151763.923 125051.844 101634.463`;
const parsedTable = parseSupportTableText(tableText);
assert.equal(parsedTable.rows.length, 1);
assert.deepEqual(parsedTable.headers, ['Name of the element', 'PIPE', 'ISOMETRIC NOTES', 'POS']);

const staged = {
  type: 'SITE', name: 'ASIM-1836', children: [{
    type: 'ZONE', name: 'OFFPLOT', children: [{
      type: 'PIPE', name: 'ASIM-1836-2"-A8010850-13421', children: [{
        type: 'BRANCH', name: 'ASIM-1836-2"-A8010850-13421/B1', attributes: { OWNER: 'ASIM-1836-2"-A8010850-13421/B1' },
        children: [{ type: 'SUPPORT', attributes: { CUSTOM_TAG: 'PS-14416.2', CUSTOM_POS: { x: 151763.923, y: 125051.844, z: 101634.463 }, OD: 114.3, BORE: 100 } }],
      }],
    }],
  }],
};
const config = {
  tableIdentityColumns: ['Name of the element'], tablePositionMode: 'single', tablePositionColumn: 'POS', tableUnits: 'mm', tablePipeColumns: ['PIPE'],
  jsonIdentityPaths: ['attributes.CUSTOM_TAG'], jsonPositionPaths: ['attributes.CUSTOM_POS'], jsonBranchPaths: ['attributes.OWNER'],
  jsonPipePaths: ['attributes.PIPE'], jsonZonePaths: ['attributes.ZONE'],
  jsonOdPaths: ['attributes.OD'], jsonBorePaths: ['attributes.BORE'], jsonUnits: 'mm', jsonOdUnits: 'mm', jsonBoreUnits: 'mm', navisUnits: 'm',
  supportCoordinateSource: 'prefer-table-fallback-json',
};
const tableBuild = buildSupportTableRecords(parsedTable, config);
assert.equal(tableBuild.records[0].identity, 'PS-14416.2');
assert.equal(tableBuild.records[0].supportRoot, 'PS-14416');
assert.equal(tableBuild.records[0].existingIsometricNotes, 'EXISTING NOTE');
assert.equal(tableBuild.records[0].inputPipeColumn, 'PIPE');

const tree = buildStagedJsonHierarchy([{ sourceFile: 'managed.json', data: staged }], config);
assert.ok(tree.summary.nodeCount >= 12, 'complete hierarchy must include arrays and attribute/coordinate objects');
assert.ok(tree.summary.arrayCount >= 4);
assert.ok(tree.pathCatalogue.some((item) => item.path === 'attributes.CUSTOM_TAG'));
assert.ok(tree.pathCatalogue.some((item) => item.path === 'attributes.CUSTOM_POS'));
assert.ok(tree.pathRecommendations.identity.some((item) => item.path === 'attributes.CUSTOM_TAG'));
assert.ok(tree.pathRecommendations.position.some((item) => item.path === 'attributes.CUSTOM_POS'));
const supportNode = tree.nodes.find((node) => node.derivedFacts?.canonicalIdentity === 'PS-14416.2');
assert.ok(supportNode);
assert.equal(supportNode.sourceFile, 'managed.json');
assert.ok(supportNode.jsonPath.includes('children'));
assert.ok(supportNode.ancestorIds.length >= 4);
assert.equal(supportNode.rawType, 'SUPPORT');
assert.equal(supportNode.attributes.CUSTOM_TAG, 'PS-14416.2');
assert.equal(supportNode.resolvedBranch, 'ASIM-1836-2"-A8010850-13421/B1');
assert.equal(supportNode.resolvedPipe, 'ASIM-1836-2"-A8010850-13421');
assert.equal(supportNode.resolvedZone, 'OFFPLOT');
assert.equal(supportNode.derivedFacts.positionPath, 'attributes.CUSTOM_POS');
assert.equal(supportNode.derivedFacts.odSource, 'DIRECT_JSON_OD_PATH');
assert.equal(supportNode.derivedFacts.boreNominalMm, 100);

const index = buildStagedSupportIndex(tree, config);
assert.equal(index.entries.length, 1);
assert.equal(index.entries[0].identity, 'PS-14416.2');
assert.equal(index.entries[0].positionPath, 'attributes.CUSTOM_POS');
assert.equal(index.entries[0].resolvedBranch, 'ASIM-1836-2"-A8010850-13421/B1');
assert.equal(index.entries[0].resolvedPipe, 'ASIM-1836-2"-A8010850-13421');
assert.equal(index.entries[0].resolvedZone, 'OFFPLOT');
assert.equal(index.entries[0].odMm, 114.3);
assert.equal(index.entries[0].boreNominalMm, 100);

const identityTrace = buildIdentityNodeTrace(tableBuild.records, index, config);
assert.equal(identityTrace.summary.resolvedCount, 1);
assert.equal(identityTrace.rows[0].status, 'RESOLVED_EXACT_PIPE');
assert.equal(identityTrace.rows[0].selectedIdentityPath, 'attributes.CUSTOM_TAG');
assert.equal(identityTrace.rows[0].positionSourcePath, 'attributes.CUSTOM_POS');
assert.equal(identityTrace.rows[0].resolvedPipe, 'ASIM-1836-2"-A8010850-13421');
assert.equal(identityTrace.rows[0].resolvedZone, 'OFFPLOT');
assert.equal(identityTrace.rows[0].navisResolutionStatus, 'PENDING_NAVIS_RESOLUTION');

const navisXml = `<?xml version="1.0"?><exchange units="m"><viewpoints><view name="Tag View 1" guid="view-1"><comments><comment id="1" status="new"><user>reviewer</user><body>Model monofl ball valve (typ)</body><createddate><date year="2023" month="10" day="2" hour="7" minute="11" second="52"/></createddate></comment></comments><redlines><rltag id="1" commentid="1"><pos3d><pos3f x="151.763923" y="125.051844" z="101.634463"/></pos3d></rltag></redlines></view></viewpoints></exchange>`;
const navis = parseNavisTagXml(navisXml, config);
assert.equal(navis.tags.length, 1);
assert.equal(navis.tags[0].commentBody, 'Model monofl ball valve (typ)');
assert.ok(Math.abs(navis.tags[0].position.x - 151763.923) < 0.01);

const readiness = buildNavisTagIsonoteReadiness({ config, tableBuild, resolutionBuild: tableBuild, tree, stagedIndex: index, identityTrace, navisParse: navis });
assert.equal(readiness.status, 'READY');
assert.equal(readiness.canResolve, true);

const audit = resolveNavisTagIsonotes(tableBuild, identityTrace, navis, config);
assert.equal(audit.summary.resolvedCount, 1);
assert.equal(audit.augmentedRows[0]['Support ISONOTE'], 'Model monofl ball valve (typ)');
assert.equal(audit.augmentedRows[0]['ISOMETRIC NOTES'], 'EXISTING NOTE');
assert.equal(audit.augmentedRows[0]['Resolved Pipe Name'], 'ASIM-1836-2"-A8010850-13421');
assert.equal(audit.augmentedRows[0]['Resolved Zone Name'], 'OFFPLOT');
assert.equal(audit.augmentedRows[0]['Bore Nominal mm'], 100);
assert.equal(audit.augmentedRows[0]['OD mm'], 114.3);
assert.equal(audit.augmentedRows[0]['OD Source'], 'DIRECT_JSON_OD_PATH');
assert.equal(audit.augmentedRows[0]['Navis View GUID'], 'view-1');

const finalTrace = attachNavisResolutionToIdentityTrace(identityTrace, audit);
assert.equal(finalTrace.rows.length, 1);
assert.equal(finalTrace.rows[0].navisResolutionStatus, 'RESOLVED');
assert.equal(finalTrace.rows[0].selectedNavisViewGuid, 'view-1');
assert.equal(finalTrace.rows[0].selectedNavisTagId, '1');
assert.equal(finalTrace.rows[0].selectedNavisCommentId, '1');
assert.equal(finalTrace.rows[0].selectedNavisCommentBody, 'Model monofl ball valve (typ)');
assert.equal(finalTrace.rows[0].supportIsonote, 'Model monofl ball valve (typ)');
assert.equal(finalTrace.summary.navisResolvedCount, 1);

const emptyTableBuild = {
  config,
  headers: [],
  records: [],
  diagnostics: [],
  summary: { rowCount: 0, identityCount: 0, referenceCount: 0, positionedRowCount: 0, pipeCount: 0 },
};
const stagedResolutionBuild = buildResolutionSupportRecords(emptyTableBuild, index, config);
assert.equal(stagedResolutionBuild.sourceKind, 'STAGED_JSON');
assert.equal(stagedResolutionBuild.records.length, 1);
assert.equal(stagedResolutionBuild.records[0].identity, 'PS-14416.2');
assert.equal(stagedResolutionBuild.records[0].position, null, 'synthetic rows must not masquerade as table coordinates');
const stagedIdentityTrace = buildIdentityNodeTrace(stagedResolutionBuild.records, index, config);
assert.equal(stagedIdentityTrace.summary.resolvedCount, 1);
assert.equal(stagedIdentityTrace.rows[0].positionSourcePath, 'attributes.CUSTOM_POS');
const stagedReadiness = buildNavisTagIsonoteReadiness({
  config,
  tableBuild: emptyTableBuild,
  resolutionBuild: stagedResolutionBuild,
  tree,
  stagedIndex: index,
  identityTrace: stagedIdentityTrace,
  navisParse: navis,
  hasSourceText: true,
});
assert.equal(stagedReadiness.canResolve, true);
assert.equal(stagedReadiness.status, 'READY');
assert.equal(stagedReadiness.summary.resolutionSource, 'STAGED_JSON');
assert.ok(!stagedReadiness.blockers.some((item) => item.code === 'TABLE_ROWS_MISSING'));
const stagedAudit = resolveNavisTagIsonotes(stagedResolutionBuild, stagedIdentityTrace, navis, config);
assert.equal(stagedAudit.summary.resolvedCount, 1);
assert.equal(stagedAudit.augmentedRows[0]['Support ISONOTE'], 'Model monofl ball valve (typ)');
assert.equal(stagedAudit.augmentedRows[0]['Match Source'], 'STAGED_JSON');

const anchorConfig = {
  ...config,
  navisAnchorTagId: '1',
  navisAnchorSupportIdentity: 'PS-14416.2',
  navisEastingDatumMm: 99999,
};
const anchoredNavis = parseNavisTagXml(navisXml, anchorConfig, stagedIdentityTrace);
assert.equal(anchoredNavis.anchor.active, true);
assert.equal(anchoredNavis.anchor.tagId, '1');
assert.equal(anchoredNavis.anchor.supportIdentity, 'PS-14416.2');
assert.match(anchoredNavis.tags[0].transformBasis, /ANCHOR_OVERRIDE/);

await import('./navis-tag-candidate-ranking.test.js');
await import('./navis-tag-isonote-coordinate-grouping.test.js');

console.log('navis-tag-isonote core tests passed');

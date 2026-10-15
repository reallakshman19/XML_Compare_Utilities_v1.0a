import assert from 'node:assert/strict';

import { buildIdentityNodeTrace } from '../tabs/navis-tag-isonote/navis-tag-identity-trace.js';
import { refineStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-index-refinement.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';
import { buildResolutionSupportRecords } from '../tabs/navis-tag-isonote/navis-tag-resolution-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';
import { parseNavisTagXml } from '../tabs/navis-tag-isonote/navis-tag-xml-parser.js';

const config = {
  supportCoordinateSource: 'json-only',
  jsonIdentityPaths: ['attributes.NAME'],
  jsonReferencePaths: ['attributes.REF'],
  jsonPositionPaths: ['attributes.POSI'],
  jsonBranchPaths: ['attributes.OWNER'],
  jsonBorePaths: ['attributes.ABORE'],
  jsonUnits: 'auto',
  navisUnits: 'auto',
  navisElevationDatumMm: -100000,
  eastingToleranceMm: 100,
  northingToleranceMm: 100,
  elevationToleranceMm: 100,
  useOdHalfAlternatives: false,
};

function support(name, reference) {
  return {
    type: 'SUPPORT',
    name: `SUPPORT ${name.replace(/^\//, '')}`,
    attributes: {
      NAME: name,
      REF: reference,
      OWNER: '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2',
      POSI: 'E 423170.971mm S 1141125mm U 1184.15mm',
      ABORE: '150mm',
    },
  };
}

const staged = {
  type: 'BRANCH',
  name: '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2',
  attributes: { OWNER: '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2' },
  children: [
    support('/PS-12244/DATUM', '=1006649732/51230'),
    support('/PS-12244/SREF', '=1006649732/51231'),
    support('/PS-12244.1', '=1006649732/51232'),
    support('/PS-12244.2', '=1006649732/165142'),
  ],
};

const tree = buildStagedJsonHierarchy([{ sourceFile: 'AML-ASIM-1885_managed_stage.json', data: staged }], config);
const rawIndex = buildStagedSupportIndex(tree, config);
const index = refineStagedSupportIndex(rawIndex, tree, config);
assert.equal(index.entries.length, 4);

const emptyTableBuild = {
  config,
  headers: [],
  records: [],
  diagnostics: [],
  summary: { rowCount: 0, identityCount: 0, referenceCount: 0, positionedRowCount: 0, pipeCount: 0 },
};
const resolutionBuild = buildResolutionSupportRecords(emptyTableBuild, index, config);
assert.equal(resolutionBuild.records.length, 1, 'identities with the same canonical coordinate must form one resolution row');
assert.equal(resolutionBuild.summary.coordinateGroupCount, 1);
assert.equal(resolutionBuild.summary.multiIdentityCoordinateGroupCount, 1);
assert.equal(resolutionBuild.records[0].groupMemberCount, 4);
assert.equal(
  resolutionBuild.records[0].identityRaw,
  '/PS-12244/DATUM|/PS-12244/SREF|/PS-12244.1|/PS-12244.2',
);
assert.deepEqual(resolutionBuild.records[0].groupedIdentities, [
  'PS-12244/DATUM',
  'PS-12244/SREF',
  'PS-12244.1',
  'PS-12244.2',
]);

const identityTrace = buildIdentityNodeTrace(resolutionBuild.records, index, config);
assert.equal(identityTrace.summary.rowCount, 1);
assert.equal(identityTrace.summary.resolvedCount, 1);
assert.equal(identityTrace.rows[0].tableIdentityRaw, '/PS-12244/DATUM|/PS-12244/SREF|/PS-12244.1|/PS-12244.2');

const navisXml = `<?xml version="1.0"?>
<exchange units="m">
  <viewpoints>
    <view name="Tag View 8" guid="view-8">
      <comments><comment id="8"><body>R+G</body></comment></comments>
      <redlines><rltag id="8" commentid="8"><pos3d><pos3f x="423.171000" y="-1141.125000" z="101.184150"/></pos3d></rltag></redlines>
    </view>
  </viewpoints>
</exchange>`;

const alignedNavis = parseNavisTagXml(navisXml, config);
const alignedAudit = resolveNavisTagIsonotes(resolutionBuild, identityTrace, alignedNavis, config);
assert.equal(alignedAudit.summary.resolvedCount, 1);
assert.equal(alignedAudit.decisions[0].selectedTagId, '8');
assert.equal(alignedAudit.decisions[0].supportIsonote, 'R+G');
assert.equal(alignedAudit.augmentedRows[0]['Name of the element'], '/PS-12244/DATUM|/PS-12244/SREF|/PS-12244.1|/PS-12244.2');

const zeroDatumConfig = { ...config, navisElevationDatumMm: 0 };
const zeroDatumNavis = parseNavisTagXml(navisXml, zeroDatumConfig);
const zeroDatumAudit = resolveNavisTagIsonotes(resolutionBuild, identityTrace, zeroDatumNavis, zeroDatumConfig);
assert.equal(zeroDatumAudit.summary.resolvedCount, 0);
assert.equal(zeroDatumAudit.summary.unresolvedCount, 1);
assert.equal(zeroDatumAudit.decisions[0].nearestRejectedTagId, '8');
assert.deepEqual(zeroDatumAudit.decisions[0].nearestRejectedAxes, ['EL']);
assert.match(zeroDatumAudit.decisions[0].ambiguity, /NEAREST_TAG_8_OUTSIDE_EL_TOLERANCE/);
assert.equal(zeroDatumAudit.candidateLedger.length, 1);
assert.equal(zeroDatumAudit.candidateLedger[0].ledgerKind, 'NEAREST_REJECTED');
assert.equal(zeroDatumAudit.candidateLedger[0].tagId, '8');
assert.equal(zeroDatumAudit.candidateLedger[0].accepted, false);
assert.ok(zeroDatumAudit.diagnostics.some((item) => item.code === 'NAVIS_NEAREST_TAG_OUTSIDE_TOLERANCE' && item.tagId === '8'));

console.log('navis-tag-isonote coordinate grouping and nearest-tag diagnostics tests passed');

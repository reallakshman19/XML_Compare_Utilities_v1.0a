import assert from 'node:assert/strict';

import { configuredAnchorSlots } from '../tabs/navis-tag-isonote/navis-tag-anchor-policy.js';
import { buildFinalOutputRows, UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE } from '../tabs/navis-tag-isonote/navis-tag-final-output.js';
import { buildIdentityNodeTrace } from '../tabs/navis-tag-isonote/navis-tag-identity-trace.js';
import { refineStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-index-refinement.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';
import { NAVIS_ANCHOR_LOOP_POLICY } from '../tabs/navis-tag-isonote/navis-tag-multi-anchor-ranking.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';
import { buildSupportTableRecords, parseSupportTableText } from '../tabs/navis-tag-isonote/navis-tag-table-source.js';
import { parseNavisTagXml } from '../tabs/navis-tag-isonote/navis-tag-xml-parser.js';
import { _test as tabTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-tab.js';
import { _test as workflowTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-workflow.js';

const baseConfig = {
  tableIdentityColumns: ['Name of the element'], tablePositionMode: 'single', tablePositionColumn: 'POS',
  tableUnits: 'mm', jsonIdentityPaths: ['attributes.NAME'], jsonPositionPaths: ['attributes.POSI'],
  jsonUnits: 'mm', navisUnits: 'mm', supportCoordinateSource: 'prefer-table-fallback-json',
  eastingToleranceMm: 100, northingToleranceMm: 100, elevationToleranceMm: 100,
  coordinateDisagreementToleranceMm: 100, ambiguityScoreGap: 15, useOdHalfAlternatives: false,
};
const tableText = [
  'Name of the element\tPOS',
  '/PS-11171.5\t999999 999999 999999',
  '/PS-11366/DATUM\t888888 888888 888888',
  '/PS-11181/DATUM\t777777 777777 777777',
].join('\n');
const staged = [
  { sourceFile: 'managed-a.json', data: { type: 'SUPPORT', name: 'SUPPORT PS-11171.5', attributes: { NAME: '/PS-11171.5', POSI: { x: 175057.718, y: 700947.6, z: 1144.64 } } } },
  { sourceFile: 'managed-b.json', data: { type: 'SUPPORT', name: 'SUPPORT PS-11366', attributes: { NAME: '/PS-11366/DATUM', POSI: { x: 188530, y: 729150, z: 1066.551 } } } },
  { sourceFile: 'managed-c.json', data: { type: 'SUPPORT', name: 'SUPPORT PS-11181', attributes: { NAME: '/PS-11181/DATUM', POSI: { x: 164730, y: 725942.3, z: 1544.64 } } } },
];
const navisXml = `<?xml version="1.0"?>
<exchange units="mm"><viewpoints>
  <view name="Tag View 1" guid="view-1"><comments><comment id="1"><body>R</body></comment></comments><redlines><rltag id="1" commentid="1"><pos3d><pos3f x="229991.78" y="-1121059.233" z="101315.133"/></pos3d></rltag></redlines></view>
  <view name="Tag View 23" guid="view-23"><comments><comment id="23"><body>R+G+LS</body></comment></comments><redlines><rltag id="23" commentid="23"><pos3d><pos3f x="220685.122" y="-1096070.826" z="101658.877"/></pos3d></rltag></redlines></view>
  <view name="Tag View 163" guid="view-163"><comments><comment id="163"><body>A</body></comment></comments><redlines><rltag id="163" commentid="163"><pos3d><pos3f x="244530.041" y="-1092841.494" z="101057.904"/></pos3d></rltag></redlines></view>
  <view name="Tag View 164" guid="view-164"><comments><comment id="164"><body>A1</body></comment></comments><redlines><rltag id="164" commentid="164"><pos3d><pos3f x="229995.438" y="-1121056.464" z="101317.094"/></pos3d></rltag></redlines></view>
  <view name="Tag View 165" guid="view-165"><comments><comment id="165"><body>A2</body></comment></comments><redlines><rltag id="165" commentid="165"><pos3d><pos3f x="244529.978" y="-1092843.749" z="101070.534"/></pos3d></rltag></redlines></view>
</viewpoints></exchange>`;

function build(config) {
  const table = buildSupportTableRecords(parseSupportTableText(tableText), config);
  const tree = buildStagedJsonHierarchy(staged, config);
  const index = refineStagedSupportIndex(buildStagedSupportIndex(tree, config), tree, config);
  const trace = buildIdentityNodeTrace(table.records, index, config);
  const navis = parseNavisTagXml(navisXml, config, trace);
  const audit = resolveNavisTagIsonotes(table, trace, navis, config);
  audit.finalRows = buildFinalOutputRows(audit, config, navis);
  return { table, trace, navis, audit };
}

const singleConfig = { ...baseConfig, navisAnchorTagId: '164', navisAnchorSupportIdentity: '/PS-11171.5' };
const single = build(singleConfig);
assert.equal(single.navis.anchor.active, true);
assert.equal(single.navis.anchor.policy, 'EQUAL_AUTHORITY');
assert.equal(single.navis.anchor.validCount, 1);
assert.equal(single.navis.anchor.globalTransformApplied, true);
assert.equal(single.navis.anchor.attempts[0].status, 'VALID_HYPOTHESIS');
const single11171 = single.audit.decisions.find((row) => row.canonicalIdentity === 'PS-11171.5');
assert.equal(single11171.status, 'RESOLVED');
assert.equal(single11171.selectedTagId, '164');
assert.equal(single11171.selectedAnchorBasis, 'Tag 164 ↔ /PS-11171.5');
assert.equal(single11171.decisionPolicy, NAVIS_ANCHOR_LOOP_POLICY);
assert.equal(single11171.supportPositionSource, 'STAGED_JSON');
assert.equal(single.audit.config.supportCoordinateSource, 'prefer-json-fallback-table');

const multiConfig = {
  ...baseConfig,
  navisAnchorTagId: '165', navisAnchorSupportIdentity: '/PS-11366/DATUM',
  navisAnchorTagId2: '164', navisAnchorSupportIdentity2: '/PS-11171.5',
  navisAnchorTagId3: '23', navisAnchorSupportIdentity3: '/PS-11181/DATUM',
  navisAnchorTagId4: '999', navisAnchorSupportIdentity4: '/PS-11366/DATUM',
};
const multi = build(multiConfig);
assert.equal(multi.navis.anchor.policy, 'EQUAL_AUTHORITY');
assert.equal(multi.navis.anchor.validCount, 3);
assert.equal(multi.navis.anchor.globalTransformApplied, false);
assert.equal(multi.navis.anchor.attempts[0].status, 'VALID_HYPOTHESIS');
assert.equal(multi.navis.anchor.attempts[1].status, 'VALID_HYPOTHESIS');
assert.equal(multi.navis.anchor.attempts[2].status, 'VALID_HYPOTHESIS');
assert.equal(multi.navis.anchor.attempts[3].status, 'TAG_NOT_FOUND');

const decision11171 = multi.audit.decisions.find((row) => row.canonicalIdentity === 'PS-11171.5');
const decision11366 = multi.audit.decisions.find((row) => row.canonicalIdentity === 'PS-11366/DATUM');
const decision11181 = multi.audit.decisions.find((row) => row.canonicalIdentity === 'PS-11181/DATUM');
assert.equal(decision11171.status, 'RESOLVED');
assert.equal(decision11171.selectedTagId, '164');
assert.equal(decision11171.selectedAnchorBasis, 'Tag 164 ↔ /PS-11171.5');
assert.equal(decision11171.supportIsonote, 'A1');
assert.equal(decision11171.decisionReason, 'SINGLE_ANCHOR_LOOP_WINNER');
assert.equal(decision11366.status, 'RESOLVED');
assert.equal(decision11366.selectedTagId, '165');
assert.equal(decision11366.selectedAnchorBasis, 'Tag 165 ↔ /PS-11366/DATUM');
assert.equal(decision11366.supportIsonote, 'A2', 'A/A1/A2 must not receive special filtering');
assert.equal(decision11181.status, 'RESOLVED');
assert.equal(decision11181.selectedTagId, '23');
assert.equal(decision11181.selectedAnchorBasis, 'Tag 23 ↔ /PS-11181/DATUM');

const loop164 = multi.audit.anchorLoopLedger.filter((row) => row.canonicalIdentity === 'PS-11171.5' && row.anchorBasisTagId === '164');
assert.deepEqual(loop164.map((row) => [row.tagId, row.anchorLoopRank, row.anchorLoopWinner]), [
  ['164', 1, true],
  ['1', 2, false],
]);
const loop165 = multi.audit.anchorLoopLedger.filter((row) => row.canonicalIdentity === 'PS-11366/DATUM' && row.anchorBasisTagId === '165');
assert.deepEqual(loop165.map((row) => [row.tagId, row.anchorLoopRank, row.anchorLoopWinner]), [
  ['165', 1, true],
  ['163', 2, false],
]);

const final11171Candidates = multi.audit.candidateLedger.filter((row) => row.canonicalIdentity === 'PS-11171.5');
const final11366Candidates = multi.audit.candidateLedger.filter((row) => row.canonicalIdentity === 'PS-11366/DATUM');
assert.deepEqual(final11171Candidates.map((row) => row.tagId), ['164'], 'only the Anchor 164 loop winner may enter final selection');
assert.deepEqual(final11366Candidates.map((row) => row.tagId), ['165'], 'only the Anchor 165 loop winner may enter final selection');
assert.ok(!final11171Candidates.some((row) => row.tagId === '1'));
assert.ok(!final11366Candidates.some((row) => row.tagId === '163'));

const row11171 = multi.audit.finalRows.find((row) => row['Name of the element'] === '/PS-11171.5');
const row11366 = multi.audit.finalRows.find((row) => row['Name of the element'] === '/PS-11366/DATUM');
assert.equal(row11171['Navis Tag ID'], '164');
assert.equal(row11171['Support ISONOTE'], ':/PS-11171.5 A1 (C=H)');
assert.equal(row11171['Anchor pair basis'], 'Tag 164 ↔ /PS-11171.5');
assert.equal(row11366['Navis Tag ID'], '165');
assert.equal(row11366['Support ISONOTE'], ':/PS-11366/DATUM A2 (C=H)');
assert.equal(row11366['Anchor pair basis'], 'Tag 165 ↔ /PS-11366/DATUM');
assert.ok(!multi.audit.finalRows.some((row) => row['Name of the element'] === '/PS-11171.5' && row['Navis Tag ID'] === '1'));
assert.ok(!multi.audit.finalRows.some((row) => row['Name of the element'] === '/PS-11366/DATUM' && row['Navis Tag ID'] === '163'));
assert.ok(!multi.audit.finalRows.some((row) => row['Name of the element'] === UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE && ['1', '163'].includes(row['Navis Tag ID'])), 'loop runners are accounted evidence, not NO_PS_MATCH');

const swappedConfig = {
  ...baseConfig,
  navisAnchorTagId: '23', navisAnchorSupportIdentity: '/PS-11181/DATUM',
  navisAnchorTagId2: '165', navisAnchorSupportIdentity2: '/PS-11366/DATUM',
  navisAnchorTagId3: '164', navisAnchorSupportIdentity3: '/PS-11171.5',
};
const swapped = build(swappedConfig);
function decisionSnapshot(audit) {
  return audit.decisions.map((row) => ({
    identity: row.canonicalIdentity,
    tagId: row.selectedTagId,
    anchor: row.selectedAnchorBasis,
    score: row.confidenceScore,
    status: row.status,
    reason: row.decisionReason,
  })).sort((a, b) => a.identity.localeCompare(b.identity));
}
assert.deepEqual(decisionSnapshot(swapped.audit), decisionSnapshot(multi.audit), 'anchor slot order must not change engineering decisions');

const slots = configuredAnchorSlots(multiConfig, true);
assert.equal(slots.length, 5);
assert.equal(slots[0].role, 'EQUAL_AUTHORITY');
assert.equal(slots[1].role, 'EQUAL_AUTHORITY');
const home = workflowTest.renderHome({
  config: multiConfig, navisParse: multi.navis, identityTrace: multi.trace, audit: multi.audit,
  sourceNames: {}, sourceTypes: {}, stagedDocuments: [], tableText: '', navisText: navisXml,
  inputsDirty: false, status: '', sessionMeta: {},
});
assert.match(home, /Equal-authority rule/);
assert.match(home, /no primary anchor, no fallback order/i);
assert.match(home, /Anchor entry order does not affect matching/i);
assert.match(home, /data-nti-config="navisAnchorTagId2"/);
assert.match(home, /data-nti-config="navisAnchorSupportIdentity5"/);
assert.doesNotMatch(home, /P1 → P2/);
assert.doesNotMatch(home, /SELECTED_FALLBACK/);
assert.match(workflowTest.renderFinal({ audit: { finalRows: multi.audit.finalRows } }), /Anchor pair basis/);

const originalStorage = globalThis.localStorage;
const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
try {
  const largeText = 'x'.repeat(1_500_000);
  const state = {
    tableText: '', tableImport: null, navisText: '',
    stagedDocuments: [{ sourceFile: 'large-managed.json', data: { payload: largeText } }],
    stagedStorageDirty: true, stagedStorageMeta: {},
    sourceNames: { table: '', navis: '', staged: 'large-managed.json' },
    sourceTypes: { table: '', navis: '', staged: 'JSON · 1 document(s)' }, sessionMeta: {},
  };
  tabTest.saveSession(state);
  assert.ok(values.get('navisTagIsonote.staged.v1')?.length > 1_400_000);
  assert.equal(JSON.parse(values.get('navisTagIsonote.session.v1')).stagedDocuments, undefined);
  values.set('navisTagIsonote.config.v4', JSON.stringify(multiConfig));
  const restored = tabTest.createState();
  assert.equal(restored.config.navisAnchorTagId, '165');
  assert.equal(restored.config.navisAnchorSupportIdentity, '/PS-11366/DATUM');
  assert.equal(restored.config.navisAnchorTagId2, '164');
  assert.equal(restored.config.navisAnchorSupportIdentity2, '/PS-11171.5');
  assert.equal(restored.stagedDocuments.length, 1);
  assert.equal(restored.stagedStorageMeta.restoredFrom, 'DEDICATED_STORE');
} finally {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}

console.log('navis-tag independent anchor-loop and browser persistence tests passed');

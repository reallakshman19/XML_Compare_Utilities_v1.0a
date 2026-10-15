import assert from 'node:assert/strict';
import {
  coordinateProfileOptions,
  normalizeConfig,
  parseCoordinate,
} from '../tabs/navis-tag-isonote/navis-tag-isonote-contracts.js';
import { parseSupportTableText, buildSupportTableRecords } from '../tabs/navis-tag-isonote/navis-tag-table-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';
import { buildIdentityNodeTrace, attachNavisResolutionToIdentityTrace } from '../tabs/navis-tag-isonote/navis-tag-identity-trace.js';
import { parseNavisTagXml } from '../tabs/navis-tag-isonote/navis-tag-xml-parser.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';

const config = normalizeConfig({
  tableIdentityColumns: ['Name'],
  tableReferenceColumns: ['Reference'],
  tablePipeColumns: ['Pipe'],
  tablePositionColumn: 'Position',
  tableUnits: 'auto',
  tableCoordinateProfileName: 'PROJECT_LOCAL_MM_PLUS_100M_EL',
  tableElevationDatumMm: 100000,
  jsonIdentityPaths: ['attributes.NAME'],
  jsonReferencePaths: ['attributes.REF'],
  jsonPositionPaths: ['attributes.POSI', 'attributes.POS'],
  jsonBranchPaths: ['attributes.OWNER'],
  jsonBorePaths: ['attributes.ABORE'],
  jsonUnits: 'auto',
  jsonCoordinateProfileName: 'PROJECT_LOCAL_MM_PLUS_100M_EL',
  jsonElevationDatumMm: 100000,
  navisUnits: 'm',
  navisCoordinateProfileName: 'NAVIS_ABSOLUTE_METRES',
  navisElevationDatumMm: 0,
  supportCoordinateSource: 'json-only',
  eastingToleranceMm: 100,
  northingToleranceMm: 100,
  elevationToleranceMm: 100,
  useOdHalfAlternatives: true,
});

const rawDirectional = 'E 614860.813mm S 1114939.912mm U 1238.148mm';
const direct = parseCoordinate(rawDirectional, 'auto', coordinateProfileOptions(config, 'json'));
assert.equal(direct.x, 614860.813);
assert.equal(direct.y, -1114939.912);
assert.equal(direct.z, 101238.148);
assert.equal(direct.sourceUnit, 'mm');
assert.equal(direct.axisBasis, 'DIRECTIONAL_ENU');
assert.deepEqual(direct.datumOffsetMm, { x: 0, y: 0, z: 100000 });

const westDown = parseCoordinate('W 10mm N 20mm D 30mm', 'auto', { profileName: 'SIGNED', elevationDatumMm: 100 });
assert.deepEqual({ x: westDown.x, y: westDown.y, z: westDown.z }, { x: -10, y: 20, z: 70 });

const tableText = [
  ['Name', 'Reference', 'Pipe', 'Position'].join('\t'),
  ['/PS-12123.13', '=1006649732/52074', '/ASIM-1885-4"-W8810126-31441C4-01/B4', rawDirectional].join('\t'),
].join('\n');
const tableBuild = buildSupportTableRecords(parseSupportTableText(tableText), config);
assert.equal(tableBuild.records.length, 1);
assert.ok(Math.abs((tableBuild.records[0].position.y) - (-1114939.912)) < 1e-6, 'tableBuild.records[0].position.y should match within 1e-6 mm');
assert.ok(Math.abs((tableBuild.records[0].position.z) - (101238.148)) < 1e-6, 'tableBuild.records[0].position.z should match within 1e-6 mm');
assert.equal(tableBuild.records[0].position.profileName, 'PROJECT_LOCAL_MM_PLUS_100M_EL');

const stagedDocuments = [{
  sourceFile: 'AML-ASIM-1885_managed_stage.json',
  data: {
    attributes: {
      NAME: '/PS-12123.13',
      TYPE: 'ATTA',
      OWNER: '/ASIM-1885-4"-W8810126-31441C4-01/B4',
      REF: '=1006649732/52074',
      POS: { x: 614860.813, y: -1114939.912, z: 1238.148 },
      POSI: rawDirectional,
      ABORE: '100mm',
      CMPSUPTYPE: 'REST',
      DTXR: 'Pipe Rest XRT01',
    },
  },
}];
const tree = buildStagedJsonHierarchy(stagedDocuments, config);
const stagedIndex = buildStagedSupportIndex(tree, config);
assert.equal(stagedIndex.entries.length, 1);
const entry = stagedIndex.entries[0];
assert.ok(Math.abs((entry.position.x) - (614860.813)) < 1e-6, 'entry.position.x should match within 1e-6 mm');
assert.ok(Math.abs((entry.position.y) - (-1114939.912)) < 1e-6, 'entry.position.y should match within 1e-6 mm');
assert.ok(Math.abs((entry.position.z) - (101238.148)) < 1e-6, 'entry.position.z should match within 1e-6 mm');
assert.equal(entry.positionPath, 'attributes.POSI');
assert.equal(entry.positionProfileName, 'PROJECT_LOCAL_MM_PLUS_100M_EL');
assert.deepEqual(entry.positionDatumOffsetMm, { x: 0, y: 0, z: 100000 });
assert.equal(entry.boreNominalMm, 100);
assert.equal(entry.odMm, null, 'Nominal bore must not be used as physical OD without explicit lookup');

const identityTrace = buildIdentityNodeTrace(tableBuild.records, stagedIndex, config);
assert.equal(identityTrace.rows.length, 1);
const identityRow = identityTrace.rows[0];
assert.equal(identityRow.status, 'RESOLVED_EXACT_REFERENCE');
assert.equal(identityRow.identitySelectionEvidence.selectedNodeId, entry.nodeId);
assert.equal(identityRow.identitySelectionEvidence.referenceMatch, true);
assert.equal(identityRow.traceOnlyEvidence.sourceFile, 'AML-ASIM-1885_managed_stage.json');
assert.equal(identityRow.navisProximityEvidence.positionSourcePath, 'attributes.POSI');
assert.equal(identityRow.navisProximityEvidence.canonicalPosition.y, -1114939.912);
assert.equal(identityRow.navisProximityEvidence.canonicalPosition.z, 101238.148);
assert.equal(identityRow.navisProximityEvidence.physicalOdMm, null);

const navisXml = `
<exchange units="m">
  <view name="Tag View 7" guid="7abae612-4e2a-46c6-86ff-ab1334bd4da9">
    <comments>
      <comment id="7" status="new"><user>MUCM220</user><body>R</body></comment>
      <comment id="8" status="new"><user>MUCM220</user><body>R+G+LS</body></comment>
    </comments>
    <redlines>
      <rltag id="7" commentid="7"><pos3d><pos3f x="614.8379062619" y="-1117.5008295021" z="101.2858021503"/></pos3d></rltag>
      <rltag id="8" commentid="8"><pos3d><pos3f x="614.7972929701" y="-1114.9397502294" z="101.2103381057"/></pos3d></rltag>
    </redlines>
  </view>
</exchange>`;
const navisParse = parseNavisTagXml(navisXml, config);
assert.equal(navisParse.tags.length, 2);
const tag8 = navisParse.tags.find((tag) => tag.tagId === '8');
assert.ok(Math.abs((tag8.position.x) - (614797.2929701)) < 1e-6, 'tag8.position.x should match within 1e-6 mm');
assert.ok(Math.abs((tag8.position.y) - (-1114939.7502294)) < 1e-6, 'tag8.position.y should match within 1e-6 mm');
assert.ok(Math.abs((tag8.position.z) - (101210.3381057)) < 1e-6, 'tag8.position.z should match within 1e-6 mm');
assert.equal(tag8.position.profileName, 'NAVIS_ABSOLUTE_METRES');
assert.deepEqual(tag8.position.datumOffsetMm, { x: 0, y: 0, z: 0 });

const audit = resolveNavisTagIsonotes(tableBuild, identityTrace, navisParse, config);
assert.equal(audit.decisions.length, 1);
const decision = audit.decisions[0];
assert.equal(decision.status, 'RESOLVED');
assert.equal(decision.selectedTagId, '8');
assert.equal(decision.selectedCommentId, '8');
assert.equal(decision.supportIsonote, 'R+G+LS');
assert.equal(decision.candidateCount, 1, 'Tag 7 must be rejected by the Northing gate');
assert.ok(Math.abs(decision.selectedCandidate.deltaEMm + 63.5200299) < 0.001);
assert.ok(Math.abs(decision.selectedCandidate.deltaNMm - 0.1617706) < 0.001);
assert.ok(Math.abs(decision.selectedCandidate.deltaElMm + 27.8098943) < 0.001);

const completedTrace = attachNavisResolutionToIdentityTrace(identityTrace, audit);
const completed = completedTrace.rows[0];
assert.equal(completed.navisProximityEvidence.navisStatus, 'RESOLVED');
assert.equal(completed.navisProximityEvidence.selectedTagId, '8');
assert.equal(completed.navisProximityEvidence.selectedCommentId, '8');
assert.equal(completed.navisProximityEvidence.selectedCommentBody, 'R+G+LS');

console.log('navis-tag-isonote coordinate profile tests passed');

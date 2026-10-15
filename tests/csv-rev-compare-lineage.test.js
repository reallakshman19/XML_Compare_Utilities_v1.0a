import assert from 'node:assert/strict';

import { convertSupportRevisionPair } from '../tabs/csv-rev-compare/support-revision-pipeline.js';
import { buildSupportRevisionModel } from '../tabs/csv-rev-compare/support-revision-model.js';
import { buildSupportRevisionLineage } from '../tabs/csv-rev-compare/support-revision-lineage.js';
import { coordinateDelta, parseEngineeringCoordinate, parsePipeIdentity, solveRevisionCoordinateFrame } from '../tabs/csv-rev-compare/support-revision-normalization.js';

const H = ['PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE','PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE','EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY','REMARKS (IF ANY)','PRIMARY SUPPORT DESCRIPTION','PRIMARY SUPPORT ZONE','PRIMARY SUPPORT SITE','PIPE SCHEDULE','INSULATION','STRESS SYSTEM NUMBER','NODE NO','REVISION','Fx','Fy','Fz','Fx','Fy','Fz'];

function row(overrides = {}) {
  const base = {
    'PREV NAME':'PS02012', SCOPE:'PL', CIVILSECONDARYSUPPORT:'SL-212', PIPE:'ASIM-1885-PL-4"-M8810130-02', SIZE:'4',
    'PIPING PRIMARY SUPPORT':'/SL-212.3, /SL-212.1', 'SUPPORT TYPE':'SHOE-250, REST-250',
    'PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641, =1006657947/896',
    'EAST/WEST':'E 1000', 'NORTH/SOUTH':'N 2000', 'BOP ELEVATION':'U 3000', 'TOTAL SUPPORT POINTS ON SECONDARY':'2',
    'REMARKS (IF ANY)':'', 'PRIMARY SUPPORT DESCRIPTION':'', 'PRIMARY SUPPORT ZONE':'', 'PRIMARY SUPPORT SITE':'',
    'PIPE SCHEDULE':'SCH40', INSULATION:'NONE', 'STRESS SYSTEM NUMBER':'SYS-1', 'NODE NO':'10', REVISION:'1',
    'Fx#1':'100','Fy#1':'-13623','Fz#1':'50','Fx#2':'5','Fy#2':'-11594','Fz#2':'8',
  };
  const values = { ...base, ...overrides }, ordinals = new Map();
  return H.map((header) => {
    const ordinal = (ordinals.get(header) || 0) + 1; ordinals.set(header, ordinal);
    return values[`${header}#${ordinal}`] ?? values[header] ?? '';
  });
}
function csv(rows) { return [H, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n'); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }
function lineage(rows1, rows2) {
  const pair = convertSupportRevisionPair(csv(rows1), csv(rows2));
  assert.equal(pair.ok, true, JSON.stringify(pair.diagnostics, null, 2));
  const source = buildSupportRevisionModel(pair.rev1), target = buildSupportRevisionModel(pair.rev2);
  return { source, target, result: buildSupportRevisionLineage(source, target) };
}

// PIPE metadata remains tokenized: qualifier/sequence changes need not destroy the normalized lineage core.
{
  const a = parsePipeIdentity('ASIM-1885-PL-4"-M8810130-02');
  const b = parsePipeIdentity('ASIM-1885-PL-4"-M8810130-PP-01');
  assert.equal(a.normalizedCore, b.normalizedCore);
  assert.equal(b.qualifier, 'PP');
  assert.equal(b.sequence, '01');
}

// Direction is authoritative over redundant numeric sign; raw formatting change alone is not relocation.
{
  assert.equal(parseEngineeringCoordinate('N 1124807','Y').directedMm, parseEngineeringCoordinate('N -1124807','Y').directedMm);
  const source = { position: { x: parseEngineeringCoordinate('E 100','X'), y: parseEngineeringCoordinate('N 1124807','Y'), z: parseEngineeringCoordinate('3000','Z') } };
  const target = { position: { x: parseEngineeringCoordinate('E 100','X'), y: parseEngineeringCoordinate('N -1124807','Y'), z: parseEngineeringCoordinate('3000','Z') } };
  const frame = solveRevisionCoordinateFrame([{ source, target }]);
  assert.notEqual(coordinateDelta(source.position, target.position, frame).classification, 'ACTUAL_POSITION_CHANGED');
}

// Composite Civil+PIPE is the location authority when unchanged; persistent
// reference still proves the component survived a member suffix renumbering.
{
  const before = row({ 'PIPING PRIMARY SUPPORT':'/SL-212.3', 'SUPPORT TYPE':'SHOE-250', 'PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641' });
  const after = row({ REVISION:'2', 'PIPING PRIMARY SUPPORT':'/SL-212.2', 'SUPPORT TYPE':'SHOE-250', 'PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641' });
  const { source, target, result } = lineage([before], [after]);
  assert.equal(source.locations[0].components[0].memberId, '/SL-212.3');
  assert.equal(target.locations[0].components[0].memberId, '/SL-212.2');
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].outcome, 'DETERMINISTIC');
  assert.equal(result.edges[0].matchingMethod, 'civil-pipe-location-identity');
  assert.ok(result.edges[0].reasonCodes.includes('SUPPORT_LOCATION_IDENTITY_EXACT'));
  assert.deepEqual(result.edges[0].persistentReferences, ['=1006649755/3641']);
}

// Row ordinal is presentation only; reordering unchanged locations produces the same two continuations.
{
  const a = row({ 'PREV NAME':'PS-A', CIVILSECONDARYSUPPORT:'SL-A', 'PIPING PRIMARY SUPPORT':'/SL-A.1', 'PIPING PRIMARY SUPPORT REFERENCE':'=A/1' });
  const b = row({ 'PREV NAME':'PS-B', CIVILSECONDARYSUPPORT:'SL-B', PIPE:'ASIM-1885-PL-6"-M8810131-01', 'PIPING PRIMARY SUPPORT':'/SL-B.1', 'PIPING PRIMARY SUPPORT REFERENCE':'=B/1' });
  const { result } = lineage([a,b], [b,a]);
  assert.equal(result.edges.filter((edge) => edge.cardinality === '1->1').length, 2);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.added, []);
}

// Common support requires structural evidence: distinct families, reference sets and positions drive 1->N.
{
  const source = row({ 'PREV NAME':'PS02382', CIVILSECONDARYSUPPORT:'SL-161', 'PIPING PRIMARY SUPPORT':'/SL-161.1', 'PIPING PRIMARY SUPPORT REFERENCE':'=CS/1', 'EAST/WEST':'E 1000', 'NORTH/SOUTH':'N 2000' });
  const targetA = row({ 'PREV NAME':'PS02382', CIVILSECONDARYSUPPORT:'SL-161', REVISION:'2', 'PIPING PRIMARY SUPPORT':'/SL-161.1', 'PIPING PRIMARY SUPPORT REFERENCE':'=CS/1', 'EAST/WEST':'E 1000', 'NORTH/SOUTH':'N 2000' });
  const targetB = row({ 'PREV NAME':'PS02382', CIVILSECONDARYSUPPORT:'SL-162', REVISION:'2', 'PIPING PRIMARY SUPPORT':'/SL-162.1', 'PIPING PRIMARY SUPPORT REFERENCE':'=CS/2', 'EAST/WEST':'E 1500', 'NORTH/SOUTH':'N 2500' });
  const { result } = lineage([source], [targetA,targetB]);
  assert.equal(result.targetClusters.length, 1);
  assert.equal(result.targetClusters[0].classification, 'CROSS_FAMILY_COMMON_SUPPORT');
  const edge = result.edges.find((item) => item.cardinality === '1->N');
  assert.equal(edge?.matchingMethod, 'common-support-graph');
  assert.ok(edge?.reasonCodes.includes('STRUCTURAL_COMMON_SUPPORT_EVIDENCE'));
}

// Negative control: duplicated legacy text without distinct structural ownership is not common support.
{
  const source = row({ 'PREV NAME':'PS-DUP', CIVILSECONDARYSUPPORT:'SL-D', 'PIPING PRIMARY SUPPORT REFERENCE':'=D/1' });
  const targetA = row({ 'PREV NAME':'PS-DUP', CIVILSECONDARYSUPPORT:'SL-D', REVISION:'2', 'PIPING PRIMARY SUPPORT REFERENCE':'=D/1' });
  const targetB = row({ 'PREV NAME':'PS-DUP', CIVILSECONDARYSUPPORT:'SL-D', REVISION:'2', 'PIPING PRIMARY SUPPORT REFERENCE':'=D/1' });
  const { result } = lineage([source], [targetA,targetB]);
  assert.equal(result.targetClusters.length, 0);
  assert.ok(!result.edges.some((edge) => edge.cardinality === '1->N'));
}

// PREV NAME is corroborating evidence only. Duplicate PREV NAME without enough
// independent evidence must not create a lineage edge or a review ambiguity.
{
  const source = row({ 'PREV NAME':'PS-AMB', CIVILSECONDARYSUPPORT:'', 'PIPING PRIMARY SUPPORT':'', 'PIPING PRIMARY SUPPORT REFERENCE':'', 'EAST/WEST':'', 'NORTH/SOUTH':'', 'BOP ELEVATION':'' });
  const targetA = row({ 'PREV NAME':'PS-AMB', CIVILSECONDARYSUPPORT:'SL-X', REVISION:'2', 'PIPING PRIMARY SUPPORT':'', 'PIPING PRIMARY SUPPORT REFERENCE':'', 'EAST/WEST':'', 'NORTH/SOUTH':'', 'BOP ELEVATION':'' });
  const targetB = row({ 'PREV NAME':'PS-AMB', CIVILSECONDARYSUPPORT:'SL-Y', REVISION:'2', 'PIPING PRIMARY SUPPORT':'', 'PIPING PRIMARY SUPPORT REFERENCE':'', 'EAST/WEST':'', 'NORTH/SOUTH':'', 'BOP ELEVATION':'' });
  const { result } = lineage([source], [targetA,targetB]);
  assert.equal(result.ambiguous.length, 0);
  assert.equal(result.edges.length, 0);
  assert.ok(result.candidates.every((candidate) => candidate.outcome === 'NO_MATCH'));
  assert.ok(result.candidates.every((candidate) => candidate.reviewRequired === false));
}

console.log('csv-rev-compare lineage tests passed');
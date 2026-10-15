import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { normalizeConfig } from '../tabs/navis-tag-isonote/navis-tag-isonote-contracts.js';
import { parseSupportTableText, buildSupportTableRecords, rowsToCsv } from '../tabs/navis-tag-isonote/navis-tag-table-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';
import { refineStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-index-refinement.js';
import { parseNavisTagXml } from '../tabs/navis-tag-isonote/navis-tag-xml-parser.js';
import { attachNavisResolutionToIdentityTrace, buildIdentityNodeTrace } from '../tabs/navis-tag-isonote/navis-tag-identity-trace.js';
import { buildNavisTagIsonoteReadiness } from '../tabs/navis-tag-isonote/navis-tag-readiness.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';

function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}
function required(value, name) { if (!value) throw new Error(`Missing --${name}`); return value; }
async function walkJson(root) {
  const files = [];
  async function visit(current) {
    const info = await stat(current);
    if (info.isDirectory()) {
      const entries = await readdir(current);
      for (const entry of entries.sort()) await visit(path.join(current, entry));
    } else if (/\.json$/i.test(current)) files.push(current);
  }
  await visit(root);
  return files;
}
async function sha256(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }
function asim1836Profile() {
  return normalizeConfig({
    profileId: 'asim1836-managed-stage-2/v1',
    tableIdentityColumns: ['Name of the element'],
    tableIdentityMode: 'first-non-empty',
    tableReferenceColumns: ['Reference of the element'],
    tablePipeColumns: ['PIPE'],
    tablePositionMode: 'single',
    tablePositionColumn: 'POS',
    tableUnits: 'mm',
    jsonIdentityPaths: ['attributes.STEX', 'attributes.NAME'],
    jsonReferencePaths: ['attributes.REF'],
    jsonPositionPaths: ['attributes.APOS', 'attributes.POS', 'attributes.POSI', 'attributes.LPOS'],
    jsonBranchPaths: ['attributes.OWNER'],
    jsonPipePaths: [],
    jsonZonePaths: [],
    jsonOdPaths: [],
    jsonBorePaths: ['attributes.LBORE', 'attributes.ABORE', 'attributes.bore'],
    jsonUnits: 'auto',
    jsonOdUnits: 'mm',
    jsonBoreUnits: 'mm',
    navisUnits: 'auto',
    supportCoordinateSource: 'json-only',
    eastingToleranceMm: 100,
    northingToleranceMm: 100,
    elevationToleranceMm: 100,
    coordinateDisagreementToleranceMm: 100,
    useOdHalfAlternatives: true,
    ambiguityScoreGap: 15,
    boreToOdLookupEnabled: false,
  });
}
function simplifyTree(tree) { return { schema: tree.schema, summary: tree.summary, pathCatalogue: tree.pathCatalogue, pathRecommendations: tree.pathRecommendations }; }
function simplifyAudit(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (['raw', 'node', 'selectedEntry', 'tableRecord', 'byId', 'byIdentity', 'byRoot'].includes(key)) return undefined;
    if (item instanceof Map) return [...item.entries()];
    return item;
  }));
}
function decisionReasonCounts(decisions) {
  const counts = {};
  for (const row of decisions || []) {
    const key = row.ambiguity || row.status || 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
function bounds(points) {
  if (!points.length) return null;
  const result = {};
  for (const axis of ['x', 'y', 'z']) {
    const values = points.map((point) => Number(point?.[axis])).filter(Number.isFinite);
    result[axis] = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  }
  return result;
}
function axisGap(a, b) {
  if (!a || !b) return null;
  if (a.max < b.min) return b.min - a.max;
  if (b.max < a.min) return a.min - b.max;
  return 0;
}
function coordinateFrameAudit(stagedEntries, navisTags, config) {
  const stagedPoints = stagedEntries.map((entry) => entry.position).filter(Boolean);
  const navisPoints = navisTags.map((tag) => tag.position).filter(Boolean);
  const stagedBounds = bounds(stagedPoints);
  const navisBounds = bounds(navisPoints);
  const axisGapsMm = stagedBounds && navisBounds ? { easting: axisGap(stagedBounds.x, navisBounds.x), northing: axisGap(stagedBounds.y, navisBounds.y), elevation: axisGap(stagedBounds.z, navisBounds.z) } : null;
  let minimumHorizontalDistanceMm = null;
  let minimum3dDistanceMm = null;
  let nearestPair = null;
  for (const entry of stagedEntries) {
    if (!entry.position) continue;
    for (const tag of navisTags) {
      if (!tag.position) continue;
      const dx = entry.position.x - tag.position.x;
      const dy = entry.position.y - tag.position.y;
      const dz = entry.position.z - tag.position.z;
      const horizontal = Math.hypot(dx, dy);
      const distance3d = Math.hypot(dx, dy, dz);
      if (minimum3dDistanceMm == null || distance3d < minimum3dDistanceMm) {
        minimum3dDistanceMm = distance3d;
        minimumHorizontalDistanceMm = horizontal;
        nearestPair = { stagedIdentity: entry.identity, stagedJsonPath: entry.jsonPath, navisEvidenceId: tag.evidenceId, deltaE: dx, deltaN: dy, deltaEl: dz };
      }
    }
  }
  const compatible = Boolean(axisGapsMm && axisGapsMm.easting <= config.eastingToleranceMm && axisGapsMm.northing <= config.northingToleranceMm && axisGapsMm.elevation <= config.elevationToleranceMm);
  return {
    status: stagedPoints.length && navisPoints.length ? compatible ? 'EXTENTS_OVERLAP_WITHIN_TOLERANCE' : 'DISJOINT_COORDINATE_EXTENTS' : 'INSUFFICIENT_COORDINATE_EVIDENCE',
    compatible,
    stagedPointCount: stagedPoints.length,
    navisPointCount: navisPoints.length,
    stagedBounds,
    navisBounds,
    axisGapsMm,
    minimumHorizontalDistanceMm,
    minimum3dDistanceMm,
    nearestPair,
    configuredTolerancesMm: { easting: config.eastingToleranceMm, northing: config.northingToleranceMm, elevation: config.elevationToleranceMm },
  };
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`Frozen benchmark mismatch at ${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
}
function assertSubset(actual, expected, prefix = '') {
  for (const [key, expectedValue] of Object.entries(expected || {})) {
    const label = prefix ? `${prefix}.${key}` : key;
    const actualValue = actual?.[key];
    if (expectedValue && typeof expectedValue === 'object' && !Array.isArray(expectedValue)) assertSubset(actualValue, expectedValue, label);
    else assertEqual(actualValue, expectedValue, label);
  }
}
function verifyExpectations(coverage, expected) {
  assertEqual(coverage.profile.id, expected.profileId, 'profile.id');
  assertSubset(coverage.sources, expected.sources, 'sources');
  assertSubset(coverage.sourceCounts, expected.sourceCounts, 'sourceCounts');
  assertSubset(coverage.hierarchy, expected.hierarchy, 'hierarchy');
  assertSubset(coverage.stagedIndex, expected.stagedIndex, 'stagedIndex');
  assertSubset(coverage.identityTrace, expected.identityTrace, 'identityTrace');
  assertSubset(coverage.navis, expected.navis, 'navis');
  assertEqual(coverage.coordinateFrame.status, expected.coordinateFrame.status, 'coordinateFrame.status');
  assertEqual(coverage.coordinateFrame.compatible, expected.coordinateFrame.compatible, 'coordinateFrame.compatible');
  if (coverage.coordinateFrame.minimumHorizontalDistanceMm < expected.coordinateFrame.minimumHorizontalDistanceMmAtLeast) throw new Error('Frozen benchmark mismatch: horizontal source separation fell below the accepted floor.');
  if (coverage.coordinateFrame.minimum3dDistanceMm < expected.coordinateFrame.minimum3dDistanceMmAtLeast) throw new Error('Frozen benchmark mismatch: 3D source separation fell below the accepted floor.');
  assertSubset(coverage.resolution, expected.resolution, 'resolution');
  return { schema: expected.schema, verified: true, profileId: expected.profileId };
}

const options = args(process.argv);
const tablePath = required(options.table, 'table');
const navisPath = required(options.navis, 'navis');
const stagedDir = required(options['staged-dir'], 'staged-dir');
const stagedZip = options['staged-zip'] || '';
const expectedPath = options.expected || '';
const outDir = options.out || 'artifacts/navis-tag-isonote/asim1836';
await mkdir(outDir, { recursive: true });

const tableText = await readFile(tablePath, 'utf8');
const navisText = await readFile(navisPath, 'utf8');
const jsonFiles = await walkJson(stagedDir);
const documents = [];
const parseFailures = [];
for (const file of jsonFiles) {
  try { documents.push({ sourceFile: path.relative(stagedDir, file).replaceAll(path.sep, '/'), data: JSON.parse(await readFile(file, 'utf8')) }); }
  catch (error) { parseFailures.push({ file, message: error.message }); }
}
if (!jsonFiles.length) throw new Error('No JSON files found in staged benchmark directory.');
if (parseFailures.length) throw new Error(`Failed to parse ${parseFailures.length}/${jsonFiles.length} staged JSON files.`);

const parsedTable = parseSupportTableText(tableText);
const config = asim1836Profile();
const tableBuild = buildSupportTableRecords(parsedTable, config);
const tree = buildStagedJsonHierarchy(documents, config);
const rawStagedIndex = buildStagedSupportIndex(tree, config);
const stagedIndex = refineStagedSupportIndex(rawStagedIndex, tree, config);
const initialTrace = buildIdentityNodeTrace(tableBuild.records, stagedIndex, config);
const navisParse = parseNavisTagXml(navisText, config);
const frameAudit = coordinateFrameAudit(stagedIndex.entries, navisParse.tags, config);
const readiness = buildNavisTagIsonoteReadiness({ config, tableBuild, tree, stagedIndex, identityTrace: initialTrace, navisParse, hasSourceText: true });
if (!frameAudit.compatible) readiness.warnings.push({ severity: 'WARN', code: 'COORDINATE_FRAME_EXTENTS_DISJOINT', message: 'Staged support and Navis tag coordinate extents do not overlap within configured tolerances.', context: frameAudit });
if (!readiness.blockers.length && readiness.warnings.length) readiness.status = 'READY_WITH_WARNINGS';
const audit = resolveNavisTagIsonotes(tableBuild, initialTrace, navisParse, config);
const finalTrace = attachNavisResolutionToIdentityTrace(initialTrace, audit);

if (parsedTable.rows.length !== 163) throw new Error(`Expected 163 support rows, received ${parsedTable.rows.length}.`);
if (documents.length !== jsonFiles.length) throw new Error('Some JSON files were silently lost.');
if (!tree.summary.nodeCount) throw new Error('Canonical staged hierarchy is empty.');
if (!navisParse.summary.tagCount) throw new Error('Navis benchmark contains no parsed tags.');
if (finalTrace.rows.length !== 163) throw new Error(`Expected 163 end-to-end trace rows, received ${finalTrace.rows.length}.`);
if (config.boreToOdLookupEnabled) throw new Error('Benchmark must not enable implicit or explicit bore-to-OD lookup.');
for (let i = 0; i < tableBuild.records.length; i += 1) {
  const source = tableBuild.records[i].rawRow['ISOMETRIC NOTES'] || '';
  const output = audit.augmentedRows[i]?.['ISOMETRIC NOTES'] || '';
  if (source !== output) throw new Error(`ISOMETRIC NOTES changed at table row ${tableBuild.records[i].rowIndex}.`);
}

const sourceHashes = { supportTableSha256: await sha256(tablePath), navisXmlSha256: await sha256(navisPath), stagedZipSha256: stagedZip ? await sha256(stagedZip) : '' };
const coverage = {
  schema: 'navis-tag-isonote-full-benchmark/v2',
  generatedAt: new Date().toISOString(),
  sources: { tablePath, navisPath, stagedDir, stagedZip, ...sourceHashes },
  sourceCounts: { tableRows: parsedTable.rows.length, stagedJsonFiles: jsonFiles.length, parsedStagedDocuments: documents.length, stagedParseFailures: parseFailures.length },
  profile: { id: config.profileId, boreToOdLookupEnabled: config.boreToOdLookupEnabled },
  config,
  hierarchy: tree.summary,
  rawStagedIndex: rawStagedIndex.summary,
  stagedIndex: stagedIndex.summary,
  identityTrace: finalTrace.summary,
  navis: navisParse.summary,
  coordinateFrame: frameAudit,
  readiness: { status: readiness.status, blockers: readiness.blockers, warnings: readiness.warnings, summary: readiness.summary },
  resolution: { ...audit.summary, reasonCounts: decisionReasonCounts(audit.decisions) },
  calibratedPaths: { identity: config.jsonIdentityPaths, reference: config.jsonReferencePaths, position: config.jsonPositionPaths, branch: config.jsonBranchPaths, pipe: config.jsonPipePaths, zone: config.jsonZonePaths, od: config.jsonOdPaths, bore: config.jsonBorePaths },
  expectations: null,
};
if (expectedPath) coverage.expectations = verifyExpectations(coverage, JSON.parse(await readFile(expectedPath, 'utf8')));

await writeFile(path.join(outDir, '01-coverage-and-calibration.json'), JSON.stringify(coverage, null, 2));
await writeFile(path.join(outDir, '02-path-catalogue.json'), JSON.stringify(simplifyTree(tree), null, 2));
await writeFile(path.join(outDir, '03-navis-tag-index.csv'), rowsToCsv(navisParse.tags));
await writeFile(path.join(outDir, '04-end-to-end-identity-trace.csv'), rowsToCsv(finalTrace.rows));
await writeFile(path.join(outDir, '05-candidate-evidence-ledger.csv'), rowsToCsv(audit.candidateLedger));
await writeFile(path.join(outDir, '06-matched-decisions.csv'), rowsToCsv(audit.matchedRows));
await writeFile(path.join(outDir, '07-ambiguous-decisions.csv'), rowsToCsv(audit.ambiguousRows));
await writeFile(path.join(outDir, '08-rejected-decisions.csv'), rowsToCsv(audit.rejectedRows));
await writeFile(path.join(outDir, '09-augmented-support-table.csv'), rowsToCsv(audit.augmentedRows));
await writeFile(path.join(outDir, '10-full-audit.json'), JSON.stringify(simplifyAudit({ coverage, readiness, tree: simplifyTree(tree), identityTrace: finalTrace, navisParse, audit }), null, 2));
console.log(JSON.stringify(coverage, null, 2));

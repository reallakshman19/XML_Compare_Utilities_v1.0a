import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const ROOT_BRANCH = '/ASIM-1885-6"-S8811951-91261M7-HC-01/B3';
const EXPECTED_HEAD_REFERENCE = '=1006649732/51233';
const EXPECTED_TAIL_REFERENCE = '=1006649732/51239';
const MAX_REFERENCE_DEPTH = 2;
const MAX_BRANCHES = 40;
const REPORT_PATH = 'artifacts/sequential-sketcher/1885-nc-b3-probe.json';

function text(value) { return String(value ?? '').trim(); }
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }
function componentAliases(child) {
  return [...new Set([
    child?.attributes?.NAME,
    child?.attributes?.REF,
    child?.name,
  ].map(text).filter(Boolean))];
}
function references(record) {
  const values = [record?.attributes?.HREF, record?.attributes?.TREF];
  for (const child of Array.isArray(record?.children) ? record.children : []) values.push(child?.attributes?.CREF);
  return [...new Set(values.map(text).filter(Boolean))];
}

function buildRawReferenceIndexes(records) {
  const branches = new Map();
  const componentOwners = new Map();
  for (const record of records) {
    const ownerId = branchId(record);
    if (!ownerId) continue;
    branches.set(ownerId, record);
    for (const child of Array.isArray(record?.children) ? record.children : []) {
      for (const alias of componentAliases(child)) {
        const owners = componentOwners.get(alias) || new Set();
        owners.add(ownerId);
        componentOwners.set(alias, owners);
      }
    }
  }
  return { branches, componentOwners };
}

function resolveRawReference(reference, rawIndexes) {
  if (rawIndexes.branches.has(reference)) return { status: 'BRANCH', branchIds: [reference] };
  const owners = [...(rawIndexes.componentOwners.get(reference) || [])].sort();
  if (owners.length === 1) return { status: 'COMPONENT_OWNER', branchIds: owners };
  if (owners.length > 1) return { status: 'AMBIGUOUS_COMPONENT_OWNER', branchIds: owners };
  return { status: 'MISSING', branchIds: [] };
}

function collectReferenceClosure(records, rootId) {
  const rawIndexes = buildRawReferenceIndexes(records);
  const queue = [{ id: rootId, depth: 0 }];
  const selected = [];
  const seen = new Set();
  const referenceResolution = [];
  const missingReferences = [];

  while (queue.length && selected.length < MAX_BRANCHES) {
    const current = queue.shift();
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    const record = rawIndexes.branches.get(current.id);
    if (!record) {
      missingReferences.push({ source: current.source || null, target: current.id, depth: current.depth });
      continue;
    }
    selected.push(record);
    if (current.depth >= MAX_REFERENCE_DEPTH) continue;
    for (const reference of references(record)) {
      const resolution = resolveRawReference(reference, rawIndexes);
      referenceResolution.push({ source: current.id, reference, depth: current.depth + 1, ...resolution });
      if (resolution.status === 'MISSING') {
        missingReferences.push({ source: current.id, target: reference, depth: current.depth + 1 });
        continue;
      }
      for (const ownerBranchId of resolution.branchIds) {
        queue.push({ id: ownerBranchId, depth: current.depth + 1, source: current.id });
      }
    }
  }

  return { selected, missingReferences, referenceResolution };
}

function countTypes(branches) {
  const counts = new Map();
  for (const branch of branches) {
    for (const child of Array.isArray(branch?.children) ? branch.children : []) {
      const type = String(child?.type || child?.attributes?.TYPE || 'UNKNOWN').toUpperCase();
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function summarizeMissingPorts(evidence) {
  return evidence.components
    .filter((component) => !component.ports.length || component.ports.some((port) => !port.sourcePosition))
    .map((component) => ({
      branchId: component.branchId,
      sourceComponentId: component.sourceComponentId,
      canonicalType: component.canonicalType,
      portRoles: component.ports.map((port) => port.role),
      positionedPortCount: component.ports.filter((port) => port.sourcePosition).length,
    }));
}

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-regression' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
assert.ok(Array.isArray(records), '1885_NC fixture must be a JSON array');

const root = records.find((record) => branchId(record) === ROOT_BRANCH);
assert.ok(root, `Pinned fixture must contain ${ROOT_BRANCH}`);
assert.equal(text(root.attributes?.HREF), EXPECTED_HEAD_REFERENCE);
assert.equal(text(root.attributes?.TREF), EXPECTED_TAIL_REFERENCE);

const { selected, missingReferences, referenceResolution } = collectReferenceClosure(records, ROOT_BRANCH);
assert.ok(selected.length > 1, 'component references must include their owner branches in the fixture closure');
const immutableSnapshot = JSON.stringify(selected);
const evidence = buildSequentialEvidenceModel(selected);
const indexes = indexSequentialEvidence(evidence);
const session = createSequentialConstructionSession(ROOT_BRANCH);
const result = runConstructionUntilBlocked(session, evidence, indexes, {
  exactToleranceMm: 1,
  autoRepairToleranceMm: 25,
  candidateSearchRadiusMm: 250,
});

assert.equal(JSON.stringify(selected), immutableSnapshot, 'construction must not mutate pinned source evidence');
assert.equal(result.session.state, 'ROUTE_COMPLETE', 'B3 must complete through both explicit OLET boundaries');
assert.equal(result.session.confirmedComponentIds.length, 21);
assert.equal(result.session.committedConnections.length, 22);
assert.equal(result.session.repairLedger.length, 0, 'derived explicit junction ports are not small-gap repairs');
assert.equal(result.session.strokeLedger.some((command) => command.op === 'DISCONNECTED_FRAGMENT'), false);
assert.equal(result.outcomes[0], 'HEAD_BOUNDARY_COMMITTED');
assert.equal(result.outcomes[1], 'COMPONENT_COMMITTED');

const confirmedForeignComponents = result.session.confirmedComponentIds
  .map((id) => indexes.components.get(id))
  .filter((component) => component?.branchId !== ROOT_BRANCH);
assert.deepEqual(confirmedForeignComponents, [], 'referenced host branch components must not be drawn');

const headConnections = result.session.committedConnections.filter((connection) => connection.connectionType === 'HEAD_BOUNDARY_TO_JUNCTION');
const tailConnections = result.session.committedConnections.filter((connection) => connection.connectionType === 'BOUNDARY_TO_JUNCTION');
assert.equal(headConnections.length, 1);
assert.equal(tailConnections.length, 1);
assert.equal(headConnections[0].targetSourceComponentId, EXPECTED_HEAD_REFERENCE);
assert.equal(tailConnections[0].targetSourceComponentId, EXPECTED_TAIL_REFERENCE);
assert.equal(headConnections[0].gapMm, 0);
assert.equal(tailConnections[0].gapMm, 0);
assert.equal(headConnections[0].fromPositionBasis, 'DERIVED_FROM_BRANCH_BOUNDARY');
assert.equal(tailConnections[0].toPositionBasis, 'DERIVED_FROM_ACTIVE_BOUNDARY_PORT');
assert.equal(headConnections[0].coordinateDerivationStatus, 'ONE_PORT_DERIVED');
assert.equal(tailConnections[0].coordinateDerivationStatus, 'ONE_PORT_DERIVED');
assert.ok(headConnections[0].derivedBranchLegLengthMm > 0);
assert.ok(tailConnections[0].derivedBranchLegLengthMm > 0);
assert.ok(result.session.strokeLedger.some((command) => command.op === 'CONFIRM_HEAD_JUNCTION_BOUNDARY'));
assert.ok(result.session.strokeLedger.some((command) => command.op === 'CONFIRM_JUNCTION_BOUNDARY'));

const confirmedConstruction = createConfirmedSequentialConstruction(result.session, indexes);
const confirmedSnapshot = JSON.stringify(confirmedConstruction);
const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {
  projectionToleranceMm: 50,
  onCenterlineToleranceMm: 0.001,
  ambiguityToleranceMm: 1,
});
assert.equal(JSON.stringify(confirmedConstruction), confirmedSnapshot, 'real support projection must not mutate accepted construction');
assert.equal(supportProjection.schema, 'SequentialConfirmedSupportProjection.v1');
assert.equal(supportProjection.constructionFingerprint, confirmedConstruction.constructionFingerprint);
assert.equal(supportProjection.branchBundles.length, 1);

const rootEvidence = indexes.branches.get(ROOT_BRANCH);
const report = {
  schema: 'Sequential1885NcProbe.v1',
  sourceCommit: SOURCE_COMMIT,
  rootBranchId: ROOT_BRANCH,
  selectedBranchIds: evidence.branches.map((branch) => branch.branchId),
  referenceResolution,
  missingReferences,
  rawChildTypeCounts: countTypes(selected),
  rootSourceChildCount: Array.isArray(root.children) ? root.children.length : 0,
  rootRecognizedComponentCount: rootEvidence?.components.length || 0,
  rootRecognizedTypes: Object.fromEntries(
    [...new Set((rootEvidence?.components || []).map((component) => component.canonicalType))]
      .sort()
      .map((type) => [type, rootEvidence.components.filter((component) => component.canonicalType === type).length]),
  ),
  missingOrPartialPorts: summarizeMissingPorts(evidence),
  finalState: result.session.state,
  outcomes: result.outcomes,
  confirmedConstructionFingerprint: confirmedConstruction.constructionFingerprint,
  confirmedComponentCount: result.session.confirmedComponentIds.length,
  committedConnectionCount: result.session.committedConnections.length,
  connectionTypes: Object.fromEntries(
    [...new Set(result.session.committedConnections.map((connection) => connection.connectionType))]
      .sort()
      .map((type) => [type, result.session.committedConnections.filter((connection) => connection.connectionType === type).length]),
  ),
  headBoundaryConnections: headConnections,
  tailBoundaryConnections: tailConnections,
  repairCount: result.session.repairLedger.length,
  pendingJunctionCount: result.session.pendingBranchJunctions.length,
  blockedReason: result.session.currentDecisionRequest?.reason || null,
  candidateCount: result.session.currentDecisionRequest?.candidates?.length || 0,
  committedOperations: result.session.strokeLedger.map((command) => command.op),
  supportProjection: {
    branchBundleCount: supportProjection.branchBundles.length,
    supportGlyphCount: supportProjection.supportGlyphs.length,
    unresolvedSupportFamilyCount: supportProjection.unresolvedSupportFamilies.length,
    diagnosticCount: supportProjection.diagnostics.length,
    diagnosticCodes: Object.fromEntries(
      [...new Set(supportProjection.diagnostics.map((row) => row.code))]
        .sort()
        .map((code) => [code, supportProjection.diagnostics.filter((row) => row.code === code).length]),
    ),
    glyphs: supportProjection.supportGlyphs,
    unresolvedFamilies: supportProjection.unresolvedSupportFamilies.map((family) => ({
      familyId: family.familyId,
      bindingStatus: family.carrierBinding.bindingStatus,
      positionStatus: family.position.positionStatus,
      candidateCarrierIds: family.carrierBinding.candidateCarrierIds,
    })),
  },
};

mkdirSync('artifacts/sequential-sketcher', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));

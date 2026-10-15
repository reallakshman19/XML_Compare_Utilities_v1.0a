import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('../tabs/sequential-sketcher/', import.meta.url));
const schemaPath = fileURLToPath(new URL('../contracts/pipe-support-projection/v1/PipeSupportProjectionBundle.schema.json', import.meta.url));

function relativeFiles(root, prefix = '') {
  return readdirSync(root).flatMap((name) => {
    const full = path.join(root, name);
    const relative = path.join(prefix, name).replaceAll('\\', '/');
    return statSync(full).isDirectory() ? relativeFiles(full, relative) : [relative];
  });
}

const files = relativeFiles(directory);
for (const required of [
  'sequential-sketcher-contract.js', 'sequential-sketcher-source.js',
  'sequential-sketcher-projection.js', 'sequential-sketcher-markup.js',
  'sequential-sketcher-workspace.js', 'sequential-sketcher-tab.js', 'sequential-sketcher.css',
  'source/sequential-evidence-model.js',
  'source/sequential-reference-resolver.js',
  'construction/sequential-construction-contract.js',
  'construction/sequential-boundary-resolver.js',
  'construction/sequential-connection-resolver.js',
  'construction/sequential-terminal-classifier.js',
  'construction/sequential-construction-engine.js',
  'construction/sequential-gated-construction-engine.js',
  'construction/sequential-connection-audit.js',
  'construction/sequential-construction-runtime.js',
  'construction/sequential-construction-acceptance.js',
  'stroke/sequential-component-stroke-compiler.js',
  'canvas/sequential-construction-svg.js',
  'support/sequential-confirmed-support-projection.js',
  'support/sj-pipe-support-projection.js', 'support/sj-pipe-support-family.js',
  'support/sj-pipe-support-geometry.js', 'support/sj-pipe-support-utils.js',
]) assert(files.includes(required), `${required} is required`);

const read = (name) => readFileSync(path.join(directory, name), 'utf8');
for (const name of files.filter((file) => file.endsWith('.js'))) {
  const text = read(name);
  assert.doesNotMatch(text, /from\s+['"]three['"]|WebGLRenderer|PerspectiveCamera|OrbitControls/, `${name} must not use a 3D render engine`);
  assert.doesNotMatch(text, /from\s+['"][^'"]*(?:topology-trace-validator|pipeline-3d-model|component-topology)[^'"]*['"]/, `${name} must not import old topology/render modules`);
  assert.doesNotMatch(text, /from\s+['"][^'"]*(?:3D_Converters|stagedjson-to-enrichxml)[^'"]*['"]/, `${name} must own its implementation rather than link to the source repository`);
  assert.doesNotMatch(text, /sj-point-resolver|sj-restraint-resolver/, `${name} must not depend on unrelated converter helpers`);
}

const markup = read('sequential-sketcher-markup.js');
for (const label of [
  'Sequential Sketcher', 'Authoritative start branch', 'Exact tolerance',
  'Automatic repair limit', 'Candidate search radius', 'Advance one',
  'Run until blocked', 'Solid = confirmed', 'dotted = candidate',
]) assert.match(markup, new RegExp(label));
assert.doesNotMatch(markup, /Compile branch|Coordinate tolerance/, 'graph-first compile controls must be retired');

const workspace = read('sequential-sketcher-workspace.js');
assert.match(workspace, /sequential-construction-runtime\.js/);
assert.match(workspace, /buildSequentialEvidenceModel/);
assert.match(workspace, /runConstructionUntilBlocked/);
assert.match(workspace, /applyConstructionDecision/);
assert.doesNotMatch(workspace, /buildBranchTopology|planSequentialTraversal|sequential-sketcher-renderer|buildSequentialSketcherSupportProjection/,
  'runtime must not construct and walk a complete graph or project supports before confirmation');

const evidence = read('source/sequential-evidence-model.js');
assert.match(evidence, /sourcePosition/);
assert.match(evidence, /resolvedPosition:\s*null/);
assert.match(evidence, /RUN_IN/);
assert.match(evidence, /RUN_OUT/);
assert.match(evidence, /BRANCH_OUT/);
assert.match(evidence, /boreStatus/);
assert.match(evidence, /collapseSyntheticCarrierShadows/);
assert.match(evidence, /shadowCarrierEvidence/);
assert.match(evidence, /PIPE\\s\+AUTO/);
assert.match(evidence, /identicalSpan/);
assert.match(evidence, /shadowCarrierCount/);
assert.doesNotMatch(evidence, /samePoint|toleranceMm/, 'source evidence must not merge coordinates');

const referenceResolver = read('source/sequential-reference-resolver.js');
assert.match(referenceResolver, /JUNCTION_COMPONENT/);
assert.match(referenceResolver, /INLINE_COMPONENT/);
assert.match(referenceResolver, /AMBIGUOUS/);
assert.match(referenceResolver, /componentReferences/);

const engine = read('construction/sequential-construction-engine.js');
assert.match(engine, /USER_DECISION_REQUIRED/);
assert.match(engine, /RETURN_TO_JUNCTION/);
assert.match(engine, /ENTER_BRANCH/);
assert.match(engine, /REFERENCE_TARGET_MISSING/);
assert.match(engine, /REFERENCE_TARGET_AMBIGUOUS/);
assert.doesNotMatch(engine, /DISCONNECTED_FRAGMENT|unvisited|options\[0\]/,
  'construction authority must not continue through arbitrary or disconnected graph sections');

const gatedEngine = read('construction/sequential-gated-construction-engine.js');
assert.match(gatedEngine, /HEAD_BOUNDARY_TO_JUNCTION/);
assert.match(gatedEngine, /CONFIRM_HEAD_JUNCTION_BOUNDARY/);
assert.match(gatedEngine, /headBoundaryValidated/);
assert.match(gatedEngine, /resolveBoundaryReference/);

const runtime = read('construction/sequential-construction-runtime.js');
assert.match(runtime, /enrichCommittedConnectionEvidence/);
assert.match(runtime, /advanceGatedConstruction/);
assert.match(runtime, /applyGatedConstructionDecision/);
assert.match(runtime, /CREF_TARGET_HPOS/);

const connectionAudit = read('construction/sequential-connection-audit.js');
assert.match(connectionAudit, /coordinateDerivationStatus/);
assert.match(connectionAudit, /sourceGapMm/);
assert.match(connectionAudit, /resolvedGapMm/);
assert.match(connectionAudit, /derivedBranchLegLengthMm/);

const acceptance = read('construction/sequential-construction-acceptance.js');
assert.match(acceptance, /ConfirmedSequentialConstruction\.v1/);
assert.match(acceptance, /ROUTE_COMPLETE/);
assert.match(acceptance, /supportProjection:\s*true/);
assert.match(acceptance, /Connection audit evidence is incomplete/);
assert.match(acceptance, /shadowCarrierEvidence/);
assert.match(acceptance, /shadowCarrierCount/);

const confirmedSupport = read('support/sequential-confirmed-support-projection.js');
assert.match(confirmedSupport, /ConfirmedSequentialConstruction\.v1/);
assert.match(confirmedSupport, /buildPipeSupportProjectionBundle/);
assert.match(confirmedSupport, /constructionFingerprint/);
assert.match(confirmedSupport, /carrierReferences/);
assert.match(confirmedSupport, /shadowCarrierEvidence/);
assert.doesNotMatch(confirmedSupport, /advanceConstruction|resolveNextConnection/,
  'support projection must consume accepted construction and never resolve piping continuity');

const supportProjection = read('support/sj-pipe-support-projection.js');
assert.match(supportProjection, /carrier\.references/);
assert.match(supportProjection, /explicitCarrierReferences/);
assert.match(supportProjection, /deriveSupportFamilyIdentity/);
assert.match(supportProjection, /SUPPORT_FAMILY_EXCLUDED_FROM_BRANCH_BUNDLE/);
assert.match(supportProjection, /millimetres only/);
assert.match(supportProjection, /traversal:\s*cloneJson\(binding\.carrier\.traversal\)/);
assert.match(supportProjection, /localFrame:\s*normalizedFrame/);

const supportGeometry = read('support/sj-pipe-support-geometry.js');
for (const contract of [
  'POSITION_STATUS', 'FITTING_LOCATION_TYPE', 'locateSupportOnCarrier',
  'projectPointToStraightCarrier', 'projectPointToFittingCarrier', 'buildLocalFrame',
]) assert.match(supportGeometry, new RegExp(`export (?:const|function) ${contract}`));
assert.match(supportGeometry, /distanceToCarrierMm/);
assert.match(supportGeometry, /OUTSIDE_PROJECTION_TOLERANCE/);
assert.match(supportGeometry, /projectionToleranceMm/);

const supportUtils = read('support/sj-pipe-support-utils.js');
assert.match(supportUtils, /export function pointDistance/);
assert.match(supportUtils, /export function parsePoint/);
assert.match(supportUtils, /export function classifySupportKind/);

const boundaryResolver = read('construction/sequential-boundary-resolver.js');
assert.match(boundaryResolver, /BOUNDARY_TO_FIRST_COMPONENT_GAP/);
assert.match(boundaryResolver, /MULTIPLE_BOUNDARY_REFERENCE_PORTS/);
assert.match(boundaryResolver, /DERIVED_FROM_BRANCH_BOUNDARY/);

const resolver = read('construction/sequential-connection-resolver.js');
assert.match(resolver, /autoRepairToleranceMm/);
assert.match(resolver, /MULTIPLE_REPAIR_CANDIDATES/);
assert.match(resolver, /CONTINUITY_NOT_PROVEN/);
assert.match(resolver, /sourceAdjacent/);
assert.match(resolver, /referenceMatch/);
assert.match(resolver, /derivedBranchLegLengthMm/);
assert.match(resolver, /SOURCE_ADJACENT_ATTACHMENT_EVENT/);
assert.match(resolver, /SOURCE_ADJACENT_ZERO_LENGTH_ENTRY_ROLE/);
assert.match(resolver, /ZERO_LENGTH_INLINE_PORT_EVIDENCE_INCOMPLETE/);
assert.match(resolver, /ZERO_LENGTH_INLINE_ENTRY_ROLE_UNRESOLVED/);

const terminalClassifier = read('construction/sequential-terminal-classifier.js');
assert.match(terminalClassifier, /CONFIRMED_TERMINAL/);
assert.match(terminalClassifier, /EXPECTED_CONTINUATION/);
assert.match(terminalClassifier, /UNEXPLAINED_TERMINAL/);
assert.match(terminalClassifier, /NO_CLOSURE_OR_DECLARED_BOUNDARY/);

const strokes = read('stroke/sequential-component-stroke-compiler.js');
for (const operation of [
  'DRAW_PIPE', 'DRAW_ELBOW', 'DRAW_REDUCER', 'DRAW_TEE_RUN',
  'REGISTER_TEE_BRANCH', 'DRAW_OLET', 'DRAW_VALVE', 'DRAW_INSTRUMENT',
  'DRAW_FLANGE', 'DRAW_CAP', 'DRAW_VIRTUAL_REPAIR',
]) assert.match(strokes, new RegExp(operation));
assert.match(strokes, /shadowCarrierEvidence/);

const canvas = read('canvas/sequential-construction-svg.js');
assert.match(canvas, /<svg/);
assert.doesNotMatch(canvas, /<canvas|canvas\.getContext/);
for (const layer of ['confirmed-geometry', 'candidate-connections', 'active-port']) assert.match(canvas, new RegExp(layer));
assert.match(canvas, /data-ssk-candidate-id/);
assert.match(canvas, /ssk-confirmed-repair/);
assert.match(canvas, /ssk-candidate/);
assert.match(canvas, /ssk-confirmed-instrument/);
assert.match(canvas, /data-ssk-shadow-carrier/);

const support = read('sequential-sketcher-support.js');
assert.match(support, /\.\/support\/sj-pipe-support-projection\.js/);
const constructionFiles = [
  'source/sequential-evidence-model.js',
  'source/sequential-reference-resolver.js',
  'construction/sequential-construction-contract.js',
  'construction/sequential-boundary-resolver.js',
  'construction/sequential-connection-resolver.js',
  'construction/sequential-terminal-classifier.js',
  'construction/sequential-construction-engine.js',
  'construction/sequential-gated-construction-engine.js',
  'construction/sequential-connection-audit.js',
  'construction/sequential-construction-runtime.js',
  'construction/sequential-construction-acceptance.js',
  'stroke/sequential-component-stroke-compiler.js',
  'canvas/sequential-construction-svg.js',
  'sequential-sketcher-workspace.js',
];
for (const name of constructionFiles) {
  assert.doesNotMatch(read(name), /sj-pipe-support|buildPipeSupportProjectionBundle/,
    `${name} must remain independent of support projection`);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
assert.equal(schema.properties.schema.const, 'PipeSupportProjectionBundle.v1');
assert.equal(schema.$defs.coordinateSystem.properties.units.const, 'mm');

const utilityTab = readFileSync(new URL('../tabs/psnm-utility-tab.js', import.meta.url), 'utf8');
assert.match(utilityTab, /installSequentialSketcherTile/);
console.log('sequential sketcher UI static tests passed');

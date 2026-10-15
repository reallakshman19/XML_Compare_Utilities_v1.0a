/** Repository conformance for the read-only Topology/shared-runtime shadow composition. */
import { immutableJson } from '../../contracts/contract-values.js';
import { semanticHash, semanticStringify } from './topology-validator-values.js';
import {
  assertTopologyShadowPositiveParity,
  topologyShadowSideEffectsAreZero,
} from './topology-scoped-edit-shadow-comparison.js';
import {
  _test as shadowRuntimeTest,
  captureTopologyShadowOperation,
  captureTopologyShadowRuntimeOperation,
  compareTopologyShadowRejectedOperations,
  createTopologyScopedEditShadowRuntime,
  createTopologyShadowDragRequest,
  createTopologyShadowValidRay,
  runTopologyShadowLifecycleParity,
  runTopologyShadowPositiveParity,
} from './topology-scoped-edit-shadow-runtime.js';
export const CERTIFIED_REPOSITORY_TOPOLOGY_SHADOW_RUNTIME =
  'CERTIFIED_REPOSITORY_TOPOLOGY_SHADOW_RUNTIME';
export const TOPOLOGY_SCOPED_EDIT_SHADOW_CONFORMANCE_V1 =
  'TopologyScopedEditShadowConformance.v1';
export const TOPOLOGY_SHADOW_MINIMUM_SCALE = Object.freeze({
  scene: 1000, selectionScope: 500, structuralScope: 500, geometry: 1000,
  authorizedProjection: 1000, boundary: 1000, excluded: 1000,
  staleAuthority: 500, commandMismatch: 500, corruptedProjection: 250,
  lifecycle: 100,
});
function requireFixture(input) {
  const fixture = input.fixture;
  if (!fixture?.readModel || !fixture.scopeRequest || !fixture.positive) {
    throw new TypeError('Topology shadow conformance requires the repository fixture contract.');
  }
  return fixture;
}
function variantCollector() {
  const values = new Set();
  return Object.freeze({ add: (value) => values.add(semanticStringify(value)),
    count: () => values.size });
}
function keyedVariantCollector() {
  const values = new Map();
  return Object.freeze({ add(key, value) {
    if (!values.has(key)) values.set(key, new Set());
    values.get(key).add(semanticStringify(value));
  }, count() {
    const counts = [...values.values()].map((entries) => entries.size);
    return counts.length && counts.every((value) => value === 1) ? 1 : Math.max(0, ...counts);
  } });
}
function exactScene(composition, count) {
  const variants = variantCollector();
  for (let index = 0; index < count; index += 1) {
    const direct = composition.directHost.scene(), runtime = composition.context.scene;
    assertTopologyShadowPositiveParity(direct, runtime); variants.add(direct);
  }
  return variants.count();
}
function exactScopes(composition, requests, count) {
  const variants = keyedVariantCollector();
  for (let index = 0; index < count; index += 1) {
    const request = requests[index % requests.length];
    const direct = composition.directHost.resolveScope(request);
    const runtime = composition.createRuntime(composition.projection, request).getState().scope;
    assertTopologyShadowPositiveParity(direct, runtime);
    variants.add(semanticHash(request), direct);
  }
  return variants.count();
}
function exactGeometry(composition, ids, count) {
  const variants = keyedVariantCollector();
  for (let index = 0; index < count; index += 1) {
    const entityId = ids[index % ids.length];
    const direct = composition.directHost.entityGeometry(entityId);
    const runtime = composition.readRuntimeGeometry(entityId);
    assertTopologyShadowPositiveParity(direct, runtime);
    variants.add(entityId, direct);
  }
  return variants.count();
}
function exactPositive(composition, fixture, count) {
  const variants = variantCollector();
  for (let index = 0; index < count; index += 1) {
    const result = runTopologyShadowPositiveParity(composition, fixture.positive);
    variants.add(result.direct.evidence);
  }
  return variants.count();
}
function runtimeAttempt(composition, input, projection = composition.projection) {
  const runtime = composition.createRuntime(projection, input.scopeRequest ?? composition.scopeRequest);
  const geometry = composition.readRuntimeGeometry(input.dragEntityId);
  runtime.beginDrag({ entityId: input.dragEntityId,
    dragRequest: input.dragRequest ?? createTopologyShadowDragRequest(geometry) });
  runtime.solveDrag(input.ray ?? createTopologyShadowValidRay(geometry));
  const proposal = runtime.prepareCommit({ commandName: input.commandName ?? input.envelope.commandType,
    targetIds: input.targetIds, envelope: input.envelope });
  return proposal.status === 'REJECTED' ? proposal : runtime.commitPrepared();
}
function semanticTarget(composition, input) {
  const direct = captureTopologyShadowOperation(() => composition.directHost.dryRun(
    input.currentProjection ?? composition.projection, input.envelope));
  const runtime = captureTopologyShadowRuntimeOperation(() => runtimeAttempt(composition, input,
    input.currentProjection ?? composition.projection), input.runtimeFallbackCode);
  return compareTopologyShadowRejectedOperations(composition, { direct, runtime,
    targetClassification: input.targetClassification });
}
function semanticRepeated(composition, input, count) {
  const variants = variantCollector();
  for (let index = 0; index < count; index += 1) {
    variants.add(semanticTarget(composition, input).compatibility.parity);
  }
  return variants.count();
}
function staleOnce(composition, fixture) {
  const runtime = composition.createRuntime();
  const geometry = composition.readRuntimeGeometry(fixture.positive.dragEntityId);
  runtime.beginDrag({ entityId: fixture.positive.dragEntityId,
    dragRequest: createTopologyShadowDragRequest(geometry) });
  runtime.solveDrag(createTopologyShadowValidRay(geometry));
  runtime.prepareCommit({ commandName: fixture.positive.envelope.commandType,
    targetIds: fixture.positive.targetIds, envelope: fixture.positive.envelope });
  fixture.authoritySet(fixture.staleAuthorityId);
  const direct = captureTopologyShadowOperation(() => composition.directHost.dryRun(
    composition.projection, fixture.positive.envelope));
  const runtimeResult = captureTopologyShadowRuntimeOperation(() => runtime.commitPrepared());
  fixture.authoritySet(composition.authorityId);
  return compareTopologyShadowRejectedOperations(composition, { direct, runtime: runtimeResult,
    targetClassification: 'AUTHORITY' });
}
function staleRepeated(composition, fixture, count) {
  const variants = variantCollector();
  for (let index = 0; index < count; index += 1) variants.add(staleOnce(composition, fixture).compatibility.parity);
  return variants.count();
}
function corruptedRepeated(composition, fixture, count) {
  const variants = variantCollector(), inputs = fixture.corruptedProjections;
  for (let index = 0; index < count; index += 1) {
    const currentProjection = inputs[index % inputs.length];
    const result = semanticTarget(composition, { ...fixture.positive, currentProjection,
      targetClassification: 'PROJECTION', runtimeFallbackCode: 'SCOPED_EDIT_RUNTIME_PROJECTION_INVALID' });
    variants.add(result.compatibility.parity);
  }
  return variants.count();
}
function semanticScope(composition, request) {
  const direct = captureTopologyShadowOperation(() => composition.directHost.resolveScope(request));
  const runtime = captureTopologyShadowOperation(() => composition.createRuntime(composition.projection, request));
  return compareTopologyShadowRejectedOperations(composition, { direct, runtime,
    targetClassification: 'SCOPE' });
}
function semanticUnknown(composition, fixture) {
  const direct = captureTopologyShadowOperation(() => composition.directHost.entityGeometry(fixture.unknownEntityId));
  const runtime = captureTopologyShadowOperation(() => {
    const candidate = composition.createRuntime();
    return candidate.beginDrag({ entityId: fixture.unknownEntityId,
      dragRequest: fixture.unknownDragRequest });
  });
  return compareTopologyShadowRejectedOperations(composition, { direct, runtime,
    targetClassification: 'ENTITY' });
}
async function semanticDestroyed(createComposition, fixture) {
  const composition = await createComposition();
  composition.directHost.destroy(); composition.runtime.destroy();
  const direct = captureTopologyShadowOperation(() => composition.directHost.scene());
  const runtime = captureTopologyShadowOperation(() => composition.runtime.beginDrag({
    entityId: fixture.positive.dragEntityId, dragRequest: fixture.positive.dragRequest }));
  return compareTopologyShadowRejectedOperations(composition, { direct, runtime,
    targetClassification: 'LIFECYCLE' });
}
async function lifecycleRepeated(createComposition, count) {
  const variants = variantCollector();
  for (let index = 0; index < count; index += 1) {
    const result = await runTopologyShadowLifecycleParity(await createComposition());
    variants.add(result.direct.normalized);
  }
  return variants.count();
}
function scenarioReport(variants, sideEffects) {
  const expected = Object.fromEntries(Object.keys(variants).map((key) => [key, 1]));
  const variantsValid = Object.entries(variants).every(([key, value]) => value === expected[key]);
  return { variants, expectedVariants: expected, variantsValid,
    sideEffects, sideEffectsValid: topologyShadowSideEffectsAreZero(sideEffects) };
}
function scaledScenarios(composition, fixture) {
  return {
    scene: exactScene(composition, TOPOLOGY_SHADOW_MINIMUM_SCALE.scene),
    selectionScope: exactScopes(composition, fixture.selectionRequests,
      TOPOLOGY_SHADOW_MINIMUM_SCALE.selectionScope),
    structuralScope: exactScopes(composition, fixture.structuralRequests,
      TOPOLOGY_SHADOW_MINIMUM_SCALE.structuralScope),
    geometry: exactGeometry(composition, fixture.geometryIds, TOPOLOGY_SHADOW_MINIMUM_SCALE.geometry),
    authorizedProjection: exactPositive(composition, fixture, TOPOLOGY_SHADOW_MINIMUM_SCALE.authorizedProjection),
    boundary: semanticRepeated(composition, fixture.boundary, TOPOLOGY_SHADOW_MINIMUM_SCALE.boundary),
    excluded: semanticRepeated(composition, fixture.excluded, TOPOLOGY_SHADOW_MINIMUM_SCALE.excluded),
    staleAuthority: staleRepeated(composition, fixture, TOPOLOGY_SHADOW_MINIMUM_SCALE.staleAuthority),
    commandMismatch: semanticRepeated(composition, fixture.mismatch,
      TOPOLOGY_SHADOW_MINIMUM_SCALE.commandMismatch),
    corruptedProjection: corruptedRepeated(composition, fixture,
      TOPOLOGY_SHADOW_MINIMUM_SCALE.corruptedProjection),
  };
}
async function singleScenarios(composition, fixture, createComposition) {
  return Object.freeze({ unsupported: semanticTarget(composition, fixture.unsupported),
    sectional: semanticScope(composition, fixture.sectionalRequest),
    propagate: semanticScope(composition, fixture.propagateRequest),
    unknown: semanticUnknown(composition, fixture),
    destroyed: await semanticDestroyed(createComposition, fixture) });
}
function rejectionReport(fixture, scenarios) {
  return {
    directHostRejections: { boundary: fixture.expectedCodes.boundary,
      excluded: fixture.expectedCodes.excluded,
      unsupported: scenarios.unsupported.direct.rejectionCode, mismatch: fixture.expectedCodes.mismatch,
      stale: fixture.expectedCodes.stale, corrupted: fixture.expectedCodes.projectionCorruption,
      sectional: scenarios.sectional.direct.rejectionCode,
      propagate: scenarios.propagate.direct.rejectionCode,
      unknown: scenarios.unknown.direct.rejectionCode,
      destroyed: scenarios.destroyed.direct.rejectionCode },
    runtimeRejections: { boundary: fixture.boundary.runtimeExpectedCodes,
      excluded: fixture.excluded.runtimeExpectedCodes,
      unsupported: scenarios.unsupported.runtime.rejectionCode,
      mismatch: fixture.mismatch.runtimeExpectedCodes, stale: fixture.staleRuntimeExpectedCodes,
      corrupted: fixture.corruptedRuntimeExpectedCodes,
      sectional: scenarios.sectional.runtime.rejectionCode,
      propagate: scenarios.propagate.runtime.rejectionCode,
      unknown: scenarios.unknown.runtime.rejectionCode,
      destroyed: scenarios.destroyed.runtime.rejectionCode },
  };
}
function semanticMappings(fixture, scenarios) {
  return { boundary: fixture.boundary.semanticClass, excluded: fixture.excluded.semanticClass,
    unsupported: scenarios.unsupported.compatibility.parity.semanticClass,
    mismatch: fixture.mismatch.semanticClass, stale: 'STALE_AUTHORITY',
    corrupted: 'CORRUPTED_PROJECTION',
    sectional: scenarios.sectional.compatibility.parity.semanticClass,
    propagate: scenarios.propagate.compatibility.parity.semanticClass,
    unknown: scenarios.unknown.compatibility.parity.semanticClass,
    destroyed: scenarios.destroyed.compatibility.parity.semanticClass };
}
function conformanceRecord(composition, fixture, report, scenarios) {
  const rejections = rejectionReport(fixture, scenarios);
  return { schema: TOPOLOGY_SCOPED_EDIT_SHADOW_CONFORMANCE_V1,
    subject: CERTIFIED_REPOSITORY_TOPOLOGY_SHADOW_RUNTIME, authorityId: composition.authorityId,
    passed: true, scale: TOPOLOGY_SHADOW_MINIMUM_SCALE,
    parityScenarios: { exact: ['scene observation', 'selection scope', 'structural scope',
      'supported geometry', 'authorized command projection', 'candidate replay', 'destroy/remount'],
    semanticSafety: ['boundary target', 'excluded target', 'unsupported command',
      'command/payload mismatch', 'stale authority', 'corrupted projection',
      'unsupported sectional scope', 'unsupported propagate policy', 'unknown entity',
      'post-destroy operation'] }, variants: report.variants,
    expectedVariants: report.expectedVariants, ...rejections,
    semanticMappings: semanticMappings(fixture, scenarios), sideEffects: report.sideEffects,
    evidenceHash: semanticHash({ variants: report.variants, sideEffects: report.sideEffects }) };
}
async function runWithFactory(input, factory) {
  const fixture = requireFixture(input);
  const createComposition = () => factory({ readModel: fixture.readModel,
    scopeRequest: fixture.scopeRequest, authorityProvider: fixture.authorityGet });
  const composition = await createComposition();
  const variants = scaledScenarios(composition, fixture);
  variants.lifecycle = await lifecycleRepeated(createComposition, TOPOLOGY_SHADOW_MINIMUM_SCALE.lifecycle);
  const scenarios = await singleScenarios(composition, fixture, createComposition);
  const report = scenarioReport(variants, composition.sideEffects());
  if (!report.variantsValid || !report.sideEffectsValid) {
    throw new Error('Topology shadow conformance variants or side-effect totals are invalid.');
  }
  return immutableJson(conformanceRecord(composition, fixture, report, scenarios),
    'Topology shadow conformance report');
}
export async function runTopologyScopedEditShadowConformance(input = {}, dependencies = {}) {
  return runWithFactory(input, (value) => createTopologyScopedEditShadowRuntime(value, dependencies));
}
async function runWithCore(input, core, dependencies = {}) {
  return runWithFactory(input, (value) => shadowRuntimeTest.createWithCore(value, core, dependencies));
}
export const _test = Object.freeze({ runWithCore, exactScene, exactScopes, exactGeometry,
  semanticTarget, staleOnce, semanticScope });

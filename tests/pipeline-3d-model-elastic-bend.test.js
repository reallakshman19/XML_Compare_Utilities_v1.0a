import assert from 'node:assert/strict';
import { b314NormalColdFieldRadiusD, resolveColdFieldBendPolicy } from '../tabs/pipeline-3d-model/pipeline-3d-model-bend-policy.js';
import { buildElasticBendLedgerText, calculateElasticBendScreening,
  resolvePipelineElasticBends } from '../tabs/pipeline-3d-model/pipeline-3d-model-elastic-bend.js';
import { normalizeElasticBendSettings } from '../tabs/pipeline-3d-model/pipeline-3d-model-elastic-bend-settings.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
const point = (x, y, z, source = 'vertex', label = '') => ({ x, y, z, source, sources: [source], label });
const rows = (points) => points.map((item, index) => ({ branchName: 'PL-BEND', lineNo: 'PL-BEND',
  nodeNumber: 100 + index * 10, x: item.x * 1000, y: item.y * 1000,
  z: item.z * 1000, nodeName: item.label || `${item.source}-${index + 1}` }));
function settings(overrides = {}) {
  return normalizeElasticBendSettings({
    enabled: true, emitToInputXml: true, screeningOnlyAcknowledged: true,
    designBasis: 'asme-b31.4', requestedDesignBasis: 'asme-b31.4',
    classificationMode: 'legacy-global', bendClass: 'elastic',
    diameterSource: 'explicit-od', diameterBasisConfirmed: true, explicitOutsideDiameterMm: 100,
    useFormulaMinimum: false, usePracticalMinimum: true, practicalRadiusMultiplierD: 1.5,
    detectHorizontal: true, detectVertical: true, detectCompound: true,
    minimumPlanTurnAngleDeg: 0.1, minimumProfileTurnAngleDeg: 0.1,
    maximumTurnAngleDeg: 179, shortElementAnglePolicy: 'include-all',
    minimumAngleElementLengthMm: 0, retainedStraightAllowanceMm: 0,
    preferredStraightTangentMm: 0, emitNearPointNode: true,
    emitMidpointNode: true, bendTypeCode: 0, ...overrides,
  });
}
const fresh = normalizeElasticBendSettings();
assert.deepEqual([fresh.designBasis, fresh.bendClass, fresh.standardRadiusMultiplierD], ['', '', null]);
assert.equal(fresh.youngsModulusMpa, null); assert.equal(fresh.practicalRadiusMultiplierD, null);
const formula = calculateElasticBendScreening(settings({ useFormulaMinimum: true,
  youngsModulusMpa: 207000, allowableBendingStressMpa: 207,
  practicalRadiusMultiplierD: 400 }), {});
assert.equal(formula.formulaRadiusMm, 50000); assert.equal(formula.practicalRadiusMm, 40000);
assert.equal(formula.governingRadiusMm, 50000); assert.equal(formula.stressMpa, 207);
for (const [nps, expectedD] of [[6, 18], [12, 18], [14, 21], [16, 24], [18, 27], [20, 30], [36, 30]]) {
  assert.equal(b314NormalColdFieldRadiusD(nps), expectedD, `NPS ${nps}`);
}
assert.equal(b314NormalColdFieldRadiusD(15), null);
const coldPolicy = resolveColdFieldBendPolicy({ outsideDiameterMm: 500,
  nominalPipeSizeNps: 16, projectMinimumRadiusD: 40, procedureMinimumRadiusD: 35 });
assert.equal(coldPolicy.normalCodeRadiusD, 24); assert.equal(coldPolicy.governingRadiusD, 40);
const markerRoute = [point(0, 0, 0, 'vertex', 'A'), point(50, 0, 0, 'marker', 'PMS-001'),
  point(100, 0, 0, 'vertex', 'IP-1'), point(100, 100, 0, 'vertex', 'B')];
const horizontal = resolvePipelineElasticBends({ points: markerRoute,
  coordinateRows: rows(markerRoute), settings: settings() });
assert.equal(horizontal.schema, 'PipelineBendResolution.v3');
assert.equal(horizontal.geometryRows.length, 3); assert.equal(horizontal.diagnostics.excludedMarkerCount, 1);
assert.equal(horizontal.diagnostics.candidateCount, 1); assert.equal(horizontal.candidates[0].classification, 'HORIZONTAL');
assert.equal(horizontal.candidates[0].status, 'EMITTED');
assert.deepEqual(horizontal.candidates[0].curvatureNodes, [
  { angleDeg: 0, nodeNumber: 130, role: 'NEAR_POINT' },
  { angleDeg: 45, nodeNumber: 140, role: 'MIDPOINT' },
]);
const verticalPoints = [point(0, 0, 0, 'table2'), point(100, 0, 0, 'table2'), point(200, 0, 10, 'table2')];
assert.equal(resolvePipelineElasticBends({ points: verticalPoints,
  coordinateRows: rows(verticalPoints), settings: settings() }).candidates[0].classification, 'VERTICAL');
const compoundPoints = [point(0, 0, 0), point(100, 0, 0, 'table2'), point(200, 100, 10)];
assert.equal(resolvePipelineElasticBends({ points: compoundPoints,
  coordinateRows: rows(compoundPoints), settings: settings() }).candidates[0].classification, 'COMPOUND');
const infeasiblePoints = [point(0, 0, 0), point(10, 0, 0), point(10, 10, 0)];
const infeasible = resolvePipelineElasticBends({ points: infeasiblePoints,
  coordinateRows: rows(infeasiblePoints), settings: settings({ practicalRadiusMultiplierD: 100,
    retainedStraightAllowanceMm: 2000 }) });
assert.equal(infeasible.candidates[0].status, 'INFEASIBLE');
assert.equal(infeasible.errors[0].code, 'BEND_GEOMETRY_INFEASIBLE');
const standard = resolvePipelineElasticBends({ points: [point(0, 0, 0), point(100, 0, 0), point(100, 100, 0)],
  coordinateRows: rows([point(0, 0, 0), point(100, 0, 0), point(100, 100, 0)]),
  settings: settings({ designBasis: 'default-metallic', requestedDesignBasis: 'default-metallic',
    bendClass: 'standard', standardRadiusMultiplierD: 2 }) });
assert.deepEqual([standard.candidates[0].bendClass, standard.candidates[0].radiusD], ['standard', 2]);
const branchInfo = { branchName: 'PL-BEND', lineNo: 'PL-BEND', boreMm: '100', wallThickness: '6' };
const xml = buildInputXmlPipingModelXml(branchInfo, horizontal.geometryRows, horizontal);
assert.equal((xml.match(/<BEND\b/g) || []).length, 1); assert.match(xml, /BEND RADIUS="150" TYPE="0"/);
assert.equal(buildElasticBendLedgerText(horizontal).split('\n').length, 2);
const disabled = resolvePipelineElasticBends({ points: markerRoute,
  coordinateRows: rows(markerRoute), settings: settings({ enabled: false, emitToInputXml: false }) });
assert.equal(disabled.candidates[0].status, 'DISABLED'); assert.equal(disabled.diagnostics.emittedCount, 0);
console.log('Pipeline explicit bend core tests passed.');
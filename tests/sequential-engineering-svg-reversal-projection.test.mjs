import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { freezeConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { classifySequentialEngineeringSvgAuthority } from '../tabs/sequential-sketcher/sequential-engineering-svg-authority.js';
import { buildSequentialEngineeringSvgScene } from '../tabs/sequential-sketcher/sequential-engineering-svg-scene.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialScopedEditVisualModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-visual-model.js';

const BRANCH_ID = '/REVERSAL/PROJECTION';
const REASONS = Object.freeze([
  'AMBIGUOUS_BRANCH_START',
  'TEE_ENTERED_FROM_BRANCH',
  'ENTRY_PORT_NOT_FOUND',
  'EXIT_PORT_NOT_FOUND',
]);

function fixture() {
  const records = [{
    type: 'BRANCH', name: BRANCH_ID,
    attributes: { NAME: BRANCH_ID, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: {
        NAME: 'P1', APOS: { x: -100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
      },
    }],
  }];
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const component = [...indexes.components.values()][0];
  return Object.freeze({ records, evidenceModel, indexes, component });
}

function decisionSession(component, reason) {
  const base = createSequentialConstructionSession(BRANCH_ID);
  return freezeConstructionSession({
    ...base,
    state: 'USER_DECISION_REQUIRED',
    currentDecisionRequest: Object.freeze({
      schema: 'SequentialConnectionDecision.v1',
      decisionId: `DECISION-${reason}`,
      state: 'OPEN',
      reason,
      candidates: Object.freeze([]),
      resolution: null,
      branchId: BRANCH_ID,
      decisionScope: 'COMPONENT_TRAVERSAL',
      componentId: component.componentId,
      startComponentId: component.componentId,
      entryPortId: null,
    }),
  });
}

function branchFallbackSession(component, reason) {
  const session = decisionSession(component, reason);
  const { componentId, startComponentId, ...request } = session.currentDecisionRequest;
  return freezeConstructionSession({
    ...session,
    currentDecisionRequest: Object.freeze(request),
  });
}

const base = fixture();
for (const reason of REASONS) {
  const session = decisionSession(base.component, reason);
  const authority = classifySequentialEngineeringSvgAuthority({
    session, evidenceModel: base.evidenceModel, indexes: base.indexes,
  });
  assert.equal(authority.reversalCandidates.length, 2, reason);
  assert(authority.reversalCandidates.every((row) => row.componentId === base.component.componentId));
  assert.deepEqual(
    authority.reversalCandidates.map((row) => row.entryPortId).sort(),
    base.component.ports.map((row) => row.portId).sort(),
  );
  const built = buildSequentialEngineeringSvgScene(authority, { sceneId: `scene-${reason}` });
  const reversal = built.scene.entities.filter((row) => row.domainRef.category === 'reversalCandidate');
  assert.equal(reversal.length, 2, reason);
  assert(reversal.every((row) => row.domainType === 'SEQUENTIAL_REVERSAL_CANDIDATE'));
  assert(reversal.every((row) => row.geometry.kind === 'point'));
  assert(reversal.every((row) => row.editCapabilities.length === 0));
  assert(reversal.every((row) => row.contributesToFit === false));
  assert(reversal.every((row) => (
    row.domainRef.sourcePosition.x === row.geometry.position.x
      && row.domainRef.sourcePosition.y === row.geometry.position.y
      && row.domainRef.sourcePosition.z === row.geometry.position.z
  )));
  assert.equal(built.parity.reversalCandidateCount, 2);
  assert.equal(built.parity.mappedCountByCategory.reversalCandidate, 2);
  assert.equal(built.parity.propertySetCoverage.eligible, built.parity.propertySetCoverage.mapped);
}

{
  const session = branchFallbackSession(base.component, 'AMBIGUOUS_BRANCH_START');
  const authority = classifySequentialEngineeringSvgAuthority({
    session, evidenceModel: base.evidenceModel, indexes: base.indexes,
  });
  const selectedCandidateId = authority.reversalCandidates[0].candidateId;
  const bridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      session, evidenceModel: base.evidenceModel, indexes: base.indexes,
      visibleProjection: 'ISO', engineeringSceneSelection: selectedCandidateId,
    }),
  });
  const readModel = createSequentialScopedEditReadModel(bridge.getSnapshot());
  const selectedEntityId = `ssk:reversal:${selectedCandidateId}`;
  assert(readModel.selectionSnapshot.entityIds.includes(selectedEntityId),
    'certified owner-snapshot regeneration must retain exact reversal selection identity');
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const visual = createSequentialScopedEditVisualModel({ readModel, scene });
  assert.equal(visual.markers.filter((row) => row.label === 'REVERSE ENTRY').length, 2);
  assert.deepEqual(visual.bounds, { min: [0, 0, 0], max: [1, 1, 1] },
    'read-only reversal markers must not expand visual fit bounds');
  bridge.destroy();
}

{
  const session = decisionSession(base.component, 'AMBIGUOUS_BRANCH_START');
  const authority = classifySequentialEngineeringSvgAuthority({
    session, evidenceModel: base.evidenceModel, indexes: base.indexes,
  });
  const missing = Object.freeze({
    ...authority,
    reversalCandidates: Object.freeze([
      Object.freeze({ ...authority.reversalCandidates[0], sourcePosition: null }),
    ]),
  });
  const built = buildSequentialEngineeringSvgScene(missing, { sceneId: 'scene-missing-reversal-position' });
  assert.equal(built.parity.reversalCandidateCount, 1);
  assert.equal(built.parity.mappedCountByCategory.reversalCandidate, 0);
  assert(built.parity.omissions.some((row) => (
    row.category === 'reversalCandidate' && row.reason === 'REVERSAL_ENTRY_PORT_POSITION_MISSING'
  )));
}

{
  const session = freezeConstructionSession({
    ...decisionSession(base.component, 'AMBIGUOUS_BRANCH_START'),
    confirmedComponentIds: [base.component.componentId],
  });
  const authority = classifySequentialEngineeringSvgAuthority({
    session, evidenceModel: base.evidenceModel, indexes: base.indexes,
  });
  assert.equal(authority.reversalCandidates.length, 0,
    'confirmed components must not produce reversal candidates');
}

console.log('Sequential SSK-TS-3F reversal candidate scene projection: ok');

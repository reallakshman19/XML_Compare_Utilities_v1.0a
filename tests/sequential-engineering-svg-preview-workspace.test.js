import assert from 'node:assert/strict';
import { createSequentialEngineeringSvgPreviewWorkspace } from '../tabs/sequential-sketcher/sequential-engineering-svg-preview-workspace.js';

function parity() {
  return {
    schema: 'SequentialEngineeringSvgParityReport.v1', omissions: [
      { category: 'network', reason: 'DERIVED_NETWORK_NOT_TRACEABLE_TO_CONFIRMED_CONSTRUCTION' },
      { category: 'restraint', reason: 'NO_STABLE_SEQUENTIAL_RESTRAINT_DIRECTION_OWNER' },
      { category: 'analyticalSupportAttachment', reason: 'NO_SEQUENTIAL_CONSTRUCTION_FINGERPRINT_BRIDGE' },
    ], mappedCountByCategory: { confirmed: 0, repair: 0, candidate: 0, activePort: 0, support: 0, rejectedCandidate: 0 },
    repairCount: 0, candidateCount: 0, activePortCount: 0, supportCount: 0, rejectedCandidateCount: 0,
    confirmedGeometryCount: 0, duplicateIds: [], invalidGeometry: [], supportAttachmentsMissingCarrierEvidence: [],
    propertySetCoverage: { eligible: 0, mapped: 0 }, revisionConsistency: { supportMatchesConfirmed: true },
    unresolvedPorts: [], disconnectedConfirmedGeometry: [], candidatesMissingContinuityEvidence: [],
  };
}
const scene = { entities: [{ id: 'scene-candidate', domainRef: { candidateId: 'candidate-1' } }] };
const snapshot = { schema: 'SequentialEngineeringSvgOwnerSnapshot.v1', session: { schema: 'SequentialConstructionSession.v1' }, visibleProjection: 'ISO' };
const host = { ownerDocument: { createElement() {} }, children: [] };
let fanoutListener;
let bridgeDisposed = 0;
let shellDestroyed = 0;
const selection = [];
const workspace = await createSequentialEngineeringSvgPreviewWorkspace({
  adapterId: 'adapter', sceneId: 'scene', shellId: 'shell', host,
  getSnapshot: () => snapshot,
  subscribeSnapshot(listener) { fanoutListener = listener; return () => { fanoutListener = null; }; },
  selectedCandidateId: 'candidate-1',
  factories: {
    createAdapter(options) {
      const adapter = {
        getScene: async () => scene,
        subscribeScene(listener) {
          return options.subscribeState((event) => listener({ scene, reason: event.reason }));
        },
      };
      return {
        adapter,
        buildSnapshot: () => ({ parity: parity() }),
        getParityReport: () => parity(),
        options,
      };
    },
    async createBridge(adapter) {
      let sceneListener;
      const unsubscribeAdapter = adapter.subscribeScene(() => {});
      return {
        adapter,
        getDependencies: () => ({
          schema: 'EngineeringSvgAdapterDependencies.v1', commandGateway: null,
          sceneSource: { subscribe(listener) { sceneListener = listener; return () => { sceneListener = null; }; } },
        }),
        getLastRejectedEvent: () => null,
        dispose() { unsubscribeAdapter(); bridgeDisposed += 1; return true; },
      };
    },
    createShell() {
      return {
        accessMode: 'read-only', getSelection: () => [...selection],
        setSelection(ids) { selection.splice(0, selection.length, ...ids); return [...selection]; },
        workspace: { getProjection: () => 'ISO', setProjection: (value) => value },
        apply: async () => null, destroy() { shellDestroyed += 1; return true; },
      };
    },
  },
});
assert.equal(workspace.accessMode, 'read-only');
assert.equal(workspace.commandGateway, null);
assert.deepEqual(workspace.getSelection(), ['scene-candidate'], 'mapping must use domainRef.candidateId');
assert.equal(await workspace.apply(), null);
assert.equal(typeof fanoutListener, 'function');
assert.equal(workspace.destroy(), true);
assert.equal(fanoutListener, null, 'destroy must unsubscribe the internal owner fanout');
assert.equal(workspace.destroy(), false);
assert.equal(shellDestroyed, 1);
assert.equal(bridgeDisposed, 1);
console.log('Sequential Engineering SVG preview workspace: ok');

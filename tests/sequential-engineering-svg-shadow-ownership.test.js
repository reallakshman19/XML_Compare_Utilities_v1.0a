import assert from 'node:assert/strict';
import {
  createSequentialEngineeringSvgShadowWorkspace,
  validateSequentialEngineeringSvgShadowParity,
} from '../tabs/sequential-sketcher/sequential-engineering-svg-shadow-workspace.js';
import {
  adapterState,
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  repairedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';
import { buildSequentialEngineeringSvgScene } from '../tabs/sequential-sketcher/sequential-engineering-svg-scene.js';

const blocked = blockedSequentialFixture();
const repaired = repairedSequentialFixture();
const supported = confirmedSupportSequentialFixture();
const state = adapterState(blocked);
const listeners = new Set();
const host = {
  children: [],
  ownerDocument: {
    createElement() {
      throw new Error('DOM creation must not be reached.');
    },
  },
};
const valid = {
  host,
  adapterId: 'ssk-shadow-adapter',
  sceneId: 'ssk-shadow-scene',
  shellId: 'ssk-shadow-shell',
  getState: () => state,
  subscribeState(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const parity = buildSequentialEngineeringSvgScene(state, { sceneId: 'parity' }).parity;
const evidence = validateSequentialEngineeringSvgShadowParity(parity);
assert.deepEqual(
  evidence.approvedOmissions.map((row) => row.category).sort(),
  ['analyticalSupportAttachment', 'network', 'restraint'],
);
assert.equal(evidence.unexplainedOmissions.length, 0);

await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({ ...valid, host: null }), /requires a DOM host/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({ ...valid, adapterId: '' }), /requires adapterId/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({ ...valid, sceneId: '' }), /requires sceneId/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({ ...valid, shellId: '' }), /requires shellId/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({ ...valid, getState: null }), /requires getState/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({ ...valid, subscribeState: null }), /requires subscribeState/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  getState: () => null,
}), /owner state must be an object/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  getState: () => ({ ...state, session: { ...state.session, schema: 'MalformedSession.v1' } }),
}), /Sequential session must use SequentialConstructionSession.v1/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  getState: () => ({ ...state, indexes: null }),
}), /requires indexed components and ports/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  getState: () => ({
    ...adapterState(repaired),
    confirmedConstruction: {
      ...repaired.confirmedConstruction,
      rootBranchId: '/STALE/BRANCH',
    },
  }),
}), /Confirmed construction does not match/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  getState: () => ({
    ...adapterState(supported),
    supportProjection: {
      ...supported.supportProjection,
      constructionFingerprint: 'stale-support-fingerprint',
    },
  }),
}), /not fingerprint-matched/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeState(listener) {
    listener({ state });
    return () => true;
  },
}), /owner event requires reason/);
await assert.rejects(() => createSequentialEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeState: () => null,
}), /owner subscription must return an unsubscribe function/);

await assert.rejects(
  () => createSequentialEngineeringSvgShadowWorkspace(valid),
  /DOM creation must not be reached/,
);
assert.equal(listeners.size, 0, 'failed shell mounting must dispose the bridge owner subscription');

console.log('Sequential engineering SVG shadow ownership contracts: ok');

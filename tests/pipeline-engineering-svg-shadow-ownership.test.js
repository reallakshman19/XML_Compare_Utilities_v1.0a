import assert from 'node:assert/strict';
import {
  SAMPLE_TABLE_1,
  SAMPLE_TABLE_2,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';
import { buildPipelineProjectOutputs } from '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js';
import { createPipelineEngineeringSvgShadowWorkspace } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-shadow-workspace.js';
import { createPipelineEngineeringRevisionToken } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js';

function fixtureSnapshot() {
  const branchInfo = Object.freeze({
    branchName: 'PL-SHADOW-OWNERSHIP', lineNo: 'PL-SHADOW-OWNERSHIP',
    boreMm: '914.4', wallThickness: '12.7', p1: '55', t1: '80',
  });
  const output = buildPipelineProjectOutputs({
    table1Text: SAMPLE_TABLE_1,
    table2Text: SAMPLE_TABLE_2,
    table3Text: '',
    branchInfo,
  });
  const revision = createPipelineEngineeringRevisionToken({
    projectRevision: 'shadow-ownership-project-r1',
    geometryRevision: 'shadow-ownership-geometry-r1',
    processConfigRevision: 'shadow-ownership-process-r1',
  });
  return Object.freeze({ output, branchInfo, revision });
}

const snapshot = fixtureSnapshot();
const unreachableHost = {
  ownerDocument: {
    createElement() { throw new Error('DOM creation must not be reached.'); },
  },
};
const valid = {
  host: unreachableHost,
  adapterId: 'pipeline-shadow-adapter',
  sceneId: 'pipeline-shadow-scene',
  shellId: 'pipeline-shadow-shell',
  getSnapshot: () => snapshot,
  subscribeSnapshot: () => () => true,
};

await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({ ...valid, host: null }), /requires a DOM host/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({ ...valid, adapterId: '' }), /requires adapterId/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({ ...valid, sceneId: '' }), /requires sceneId/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({ ...valid, shellId: '' }), /requires shellId/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({ ...valid, getSnapshot: null }), /requires getSnapshot/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({ ...valid, subscribeSnapshot: null }), /requires subscribeSnapshot/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  getSnapshot: () => null,
}), /owner snapshot must be an object/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  getSnapshot: () => [],
}), /owner snapshot must be an object/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  getSnapshot: () => ({ output: snapshot.output, branchInfo: snapshot.branchInfo }),
}), /owner snapshot requires revision/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  getSnapshot: () => ({ ...snapshot, revision: { schema: 'MalformedRevision.v1', value: 1 } }),
}), /owner snapshot revision must use schema "EngineeringRevisionToken.v1"/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeSnapshot(listener) {
    listener(null);
    return () => true;
  },
}), /owner event must be an object/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeSnapshot(listener) {
    listener({ reason: 'missing-snapshot' });
    return () => true;
  },
}), /owner event requires snapshot/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeSnapshot(listener) {
    listener({ snapshot });
    return () => true;
  },
}), /owner event requires reason/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeSnapshot(listener) {
    listener({ snapshot: { ...snapshot, revision: null }, reason: 'bad-revision' });
    return () => true;
  },
}), /owner event snapshot revision must use schema "EngineeringRevisionToken.v1"/);
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  subscribeSnapshot: () => null,
}), /owner subscription must return an unsubscribe function/);

let subscriptions = 0;
let unsubscriptions = 0;
const failingHost = {
  ownerDocument: {
    createElement() { throw new Error('shadow-shell-mount-failure'); },
  },
};
await assert.rejects(() => createPipelineEngineeringSvgShadowWorkspace({
  ...valid,
  host: failingHost,
  subscribeSnapshot() {
    subscriptions += 1;
    return () => {
      subscriptions -= 1;
      unsubscriptions += 1;
    };
  },
}), /shadow-shell-mount-failure/);
assert.equal(subscriptions, 0, 'shell mount failure must dispose the adapter bridge subscription');
assert.equal(unsubscriptions, 1, 'shell mount failure must unsubscribe exactly once');

console.log('Pipeline engineering SVG shadow ownership contracts: ok');

import assert from 'node:assert/strict';
import { createSequentialEngineeringSvgAdapter } from '../tabs/sequential-sketcher/sequential-engineering-svg-adapter.js';
import { validateSequentialEngineeringSvgParity } from '../tabs/sequential-sketcher/sequential-engineering-svg-parity-validation.js';
import {
  adapterState,
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  repairedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

for (const [name, fixture] of [
  ['blocked', blockedSequentialFixture()],
  ['repaired', repairedSequentialFixture()],
  ['supported', confirmedSupportSequentialFixture()],
]) {
  const state = adapterState(fixture);
  const sequential = createSequentialEngineeringSvgAdapter({
    adapterId: `preview-${name}`,
    sceneId: `preview-${name}-scene`,
    getState: () => state,
    subscribeState: () => () => true,
  });
  const build = sequential.buildSnapshot(state);
  const evidence = validateSequentialEngineeringSvgParity(build.parity);
  assert.equal(evidence.approvedOmissions.length, 3);
  assert.ok(Object.isFrozen(evidence));
}
assert.throws(() => validateSequentialEngineeringSvgParity({ schema: 'wrong' }), /ParityReport/);
console.log('Sequential Engineering SVG preview parity: ok');

import assert from 'node:assert/strict';
import { createSequentialEngineeringSvgAdapter } from '../tabs/sequential-sketcher/sequential-engineering-svg-adapter.js';
import { validateSequentialEngineeringSvgShadowParity } from '../tabs/sequential-sketcher/sequential-engineering-svg-shadow-workspace.js';
import {
  adapterState,
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  rejectedSequentialFixture,
  repairedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function geometryLedger(scene) {
  return scene.entities.map((entity) => ({
    id: entity.id,
    geometry: entity.geometry,
    contributesToFit: entity.contributesToFit,
  })).sort((left, right) => left.id.localeCompare(right.id));
}

const scenarios = Object.freeze({
  BLOCKED: blockedSequentialFixture(),
  REPAIRED: repairedSequentialFixture(),
  SUPPORTED: confirmedSupportSequentialFixture(),
  REJECTED: rejectedSequentialFixture(),
});

for (const [name, fixture] of Object.entries(scenarios)) {
  const before = JSON.stringify({
    session: fixture.session,
    confirmedConstruction: fixture.confirmedConstruction || null,
    supportProjection: fixture.supportProjection || null,
  });
  let state = adapterState(fixture, 'ISO');
  const adapter = createSequentialEngineeringSvgAdapter({
    adapterId: `shadow-parity-${name.toLowerCase()}`,
    sceneId: `shadow-parity-scene-${name.toLowerCase()}`,
    getState: () => state,
    subscribeState: () => () => true,
  });
  const ledgers = {};
  for (const projection of ['ISO', 'XY', 'XZ', 'YZ']) {
    state = adapterState(fixture, projection);
    const build = adapter.buildSnapshot(state, { visibleProjection: projection });
    validateSequentialEngineeringSvgShadowParity(build.parity);
    ledgers[projection] = geometryLedger(build.scene);
    assert.deepEqual(
      build.parity.omissions.filter((row) => ['network', 'restraint', 'analyticalSupportAttachment'].includes(row.category))
        .map((row) => row.category).sort(),
      ['analyticalSupportAttachment', 'network', 'restraint'],
    );
  }
  for (const projection of ['XY', 'XZ', 'YZ']) {
    assert.deepEqual(ledgers[projection], ledgers.ISO, `${name} ${projection} changed domain geometry or identity`);
  }
  assert.equal(
    JSON.stringify({
      session: fixture.session,
      confirmedConstruction: fixture.confirmedConstruction || null,
      supportProjection: fixture.supportProjection || null,
    }),
    before,
    `${name} shadow parity proof mutated construction evidence`,
  );
}

console.log('Sequential engineering SVG shadow parity and immutability: ok');

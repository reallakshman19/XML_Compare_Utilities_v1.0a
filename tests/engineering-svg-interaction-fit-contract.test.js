import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  validateEngineeringScene,
} from '../core/engineering-scene/index.js';

const scene = createEngineeringScene({
  sceneId: 'fit-contract',
  revision: createEngineeringRevisionToken('fit-r1'),
  entities: [
    createEngineeringSceneEntity({
      id: 'authoritative',
      kind: 'point',
      geometry: createPointGeometry({ x: 0, y: 0, z: 0 }),
      domainRef: { owner: 'synthetic', id: 'authoritative' },
    }),
    createEngineeringSceneEntity({
      id: 'feedback',
      kind: 'point',
      geometry: createPointGeometry({ x: 1000, y: 1000, z: 1000 }),
      domainRef: { owner: 'engineering-svg-core', id: 'feedback' },
      contributesToFit: false,
    }),
  ],
});
assert.equal(scene.entities[0].contributesToFit, true);
assert.equal(scene.entities[1].contributesToFit, false);
assert.equal(validateEngineeringScene(scene), scene);

const malformed = JSON.parse(JSON.stringify(scene));
malformed.entities[1].contributesToFit = 'false';
assert.throws(() => validateEngineeringScene(malformed), /contributesToFit must be boolean/);

console.log('engineering SVG interaction fit contract: ok');

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const production = [
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection-contracts.js',
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection-authentication.js',
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection.js',
];
for (const path of production) {
  const source = read(path);
  assert.ok(source.split(/\r?\n/).length <= 300, `${path} exceeds 300 lines`);
  assert.doesNotMatch(source, /\bDate\b|Math\.random|performance\.now|localeCompare/);
}
const engine = read(production[2]);
assert.doesNotMatch(engine, /inputxml-document|xml-builder|core-runtime|canvas|coordinateRows/);
assert.match(engine, /elementKind !== 'GRE_BEND'/);
assert.match(engine, /incomingOwnerProjectionElementId/);
const contracts = read(production[0]);
assert.match(contracts, /projectionStatus: state\.ready \? 'READY' : 'BLOCKED'/);
assert.match(contracts, /writerAdmission: state\.ready \? 'NOT_ADOPTED' : 'BLOCKED'/);
assert.doesNotMatch(contracts, /writerAdmission: state\.ready \? 'READY'/);
const gate = read('./pipeline-3d-model-profile-propagation-static.test.js');
assert.match(gate, /pipeline-3d-model-inputxml-gre-projection\.test\.js/);
assert.match(gate, /pipeline-3d-model-inputxml-gre-projection-contracts\.test\.js/);
assert.match(gate, /pipeline-3d-model-inputxml-gre-projection-adversarial\.test\.js/);
assert.match(gate, /pipeline-3d-model-inputxml-gre-projection-static\.test\.js/);

console.log('pipeline-3d-model InputXML GRE projection static: PASS');

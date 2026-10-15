import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const gitBlobSha = (source) => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
const production = [
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption-contracts.js',
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-conservation.js',
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption.js',
];
for (const path of production) {
  const source = read(path);
  assert.ok(source.split(/\r?\n/).length <= 300, `${path} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default|\bDate\b|Math\.random|performance\.now|localeCompare/);
  assert.doesNotMatch(source, /pipeline-3d-model-xml-builder|core-runtime|HTMLCanvasElement|getContext\(|canvas-|\/canvas|cad-|buildInputXmlPipingModelXml/);
}
const contracts = read(production[0]);
assert.match(contracts, /PipelineInputXmlGreDocumentAdoptionPlan\.v1/);
assert.match(contracts, /writerAdmission: ready \? 'NOT_ADOPTED' : 'BLOCKED'/);
assert.doesNotMatch(contracts, /writerAdmission: ready \? 'READY'/);
const adoption = read(production[2]);
assert.match(adoption, /incomingOwnerProjectedElementId/);
assert.match(adoption, /semanticGreBendElementId/);
assert.match(adoption, /adoptedProfileAuthorityPlan/);
assert.match(adoption, /adoptedElements/);
assert.match(adoption, /greBendAuthorities/);
assert.match(adoption, /removedSourceBlockerCodes/);
assert.doesNotMatch(adoption, /<BEND|PIPINGELEMENT|pipeline-3d-model\.xml/);

const documentSource = read('../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js');
const writerSource = read('../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js');
assert.equal(gitBlobSha(documentSource), 'c55b0d34bba9bcca26cd412262d3573acc60f2a6');
assert.equal(gitBlobSha(writerSource), '93ef9c5b10e16ab26c6f95db1043b7f5f423bf9b');
assert.doesNotMatch(writerSource, /GreDocumentAdoption|documentAuthorityAdopted|writerAdmission\s*=\s*'NOT_ADOPTED'/);

const gate = read('./pipeline-3d-model-profile-propagation-static.test.js');
for (const name of [
  'pipeline-3d-model-inputxml-gre-document-adoption-contracts.test.js',
  'pipeline-3d-model-inputxml-gre-document-adoption.test.js',
  'pipeline-3d-model-inputxml-gre-document-adoption-mixed.test.js',
  'pipeline-3d-model-inputxml-gre-document-adoption-adversarial.test.js',
  'pipeline-3d-model-inputxml-gre-document-adoption-static.test.js',
]) assert.match(gate, new RegExp(name.replaceAll('.', '\\.')));

console.log('pipeline-3d-model InputXML GRE document adoption static: PASS');
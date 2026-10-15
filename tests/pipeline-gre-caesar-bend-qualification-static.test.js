import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root));
const gitBlobSha1 = (path) => {
  const bytes = read(path); const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
};
const newFiles = [
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-qualification-contracts.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-fixture-evidence.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-field-mapping.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-topology-mapping.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-qualification.js',
];
const sources = Object.fromEntries(newFiles.map((path) => [path, read(path).toString('utf8')]));
for (const [path, source] of Object.entries(sources)) {
  assert.ok(source.split(/\r?\n/).length < 300, `${path} must stay below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|localeCompare|\bDate\b|Math\.random|performance\.now/);
  assert.doesNotMatch(source, /pipeline-3d-model-xml-builder|pipeline-3d-model-core-runtime|canvas|cad-/i);
  assert.doesNotMatch(source, /bendTypeValue\s*\?\?|numMiterValue\s*\?\?|\[0\].*fixture|firstFixture|firstCode/i);
}
const protectedBlobs = {
  'tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js': '93ef9c5b10e16ab26c6f95db1043b7f5f423bf9b',
  'tabs/pipeline-3d-model/pipeline-3d-model-core-runtime.js': 'c44849bfeda1bc5587714b18a64206438614e3bb',
  'tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js': 'c55b0d34bba9bcca26cd412262d3573acc60f2a6',
  'tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js': 'ab16b1c3953623fc566106004e2d5f565f1b2818',
  'tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js': '156f5708e8b3323f3f76f43d5e4cb656470de52a',
  'tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption-contracts.js': 'b09c500b6d76030787eece44b3f55e69a79f3f18',
  'tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption.js': 'b11ff9d9d51e9072514f9fc92dc3f48330213d13',
  'tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-conservation.js': '9e83b528aced4ca0b5e1c15ea1c975b8bb0f6f07',
  'tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection-contracts.js': '3ef3e5b5499479b3d7309881a8776c5dc88a97d1',
  'tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection.js': '115b47d15bda5d6794eac521e369d787416d9de9',
};
for (const [path, expected] of Object.entries(protectedBlobs)) assert.equal(gitBlobSha1(path), expected, path);
const allSource = Object.values(sources).join('\n');
assert.doesNotMatch(allSource, /turnAngleDeg\s*(?:\?\?|\|\||=).*ANGLE1|inactiveCorner.*curvatureNode|outgoingTangency.*curvatureNode/i);
const fixtureSource = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-fixture-evidence.js'];
for (const token of ['caesarBuild', 'unitFileSha256', 'nativeJobSha256', 'operatorLogSha256',
  'sourceCommitSha', 'cleanImport', 'comparisonFields']) assert.match(fixtureSource, new RegExp(token));
const qualificationSource = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-qualification.js'];
for (const token of ['PIPELINE_GRE_CAESAR_FIXTURE_MATRIX_INCOMPLETE', 'F6_ACCEPTED_DIRECT',
  'F6_REJECTED_F7_ACCEPTED', 'PIPELINE_GRE_CAESAR_F6_F7_DECISION_UNRESOLVED']) {
  assert.match(qualificationSource, new RegExp(token));
}
const fieldSource = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-field-mapping.js'];
assert.match(fieldSource, /bendTypeLexicalValue/); assert.match(fieldSource, /curvatureNodeRoles/);
const topologySource = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-topology-mapping.js'];
assert.match(topologySource, /roleProfiles/); assert.match(topologySource, /bendOwnerElementId/);
const request = read('docs/pipeline-gre-caesar/pipeline-gre-caesar-fixture-request.md').toString('utf8');
assert.match(request, /F6/); assert.match(request, /warning-free/); assert.match(request, /repository commit/);
console.log('pipeline GRE CAESAR bend qualification static guards: PASS');
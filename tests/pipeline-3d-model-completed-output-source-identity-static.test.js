import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-completed-output-session.js', import.meta.url), 'utf8');
assert.match(source, /inputIdentityParts/);
assert.match(source, /sameSourceTexts/);
assert.match(source, /metadataSignature\(identity\.metadata\)/);
assert.doesNotMatch(source, /JSON\.stringify\(canonicalValue\(input/);
assert.match(source, /PROFILE_TEXT_KEYS/);
console.log('completed output source identity static: PASS');

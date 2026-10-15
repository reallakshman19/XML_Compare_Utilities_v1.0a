import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-completed-output-session.js', import.meta.url), 'utf8');
const resolveBody = source.slice(source.indexOf('function resolve(input)'), source.indexOf('function reset()'));
assert.match(source, /resolvePipelineMetadataIdentity/);
assert.match(resolveBody, /resolvePipelineMetadataIdentity\(identity\.metadata, metadata\)/);
assert.doesNotMatch(resolveBody, /metadataSignature|JSON\.stringify/);
assert.match(source, /metadata === nextMetadata/);
console.log('metadata identity static: PASS');

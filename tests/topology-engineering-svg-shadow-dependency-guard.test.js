import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'tabs/topology-trace-validator/topology-engineering-svg-shadow-workspace.js';
const source = readFileSync(join(root, name), 'utf8');
const lines = source.split(/\r?\n/).length;

assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
assert.doesNotMatch(source, /topology-(svg-renderer|svg-controller|svg-editor|svg-view-model|engineering-svg-scene|engineering-svg-properties)/);
assert.doesNotMatch(source, /readManagedTopologySource|readCanonicalTopology|readTopologyTraceLedger|readTopologyInputXml|validateTopologyArtifacts/);
assert.doesNotMatch(source, /createEngineeringSvgCommandGateway|commandGateway\s*:|draftStore\s*:|innerHTML|localStorage|sessionStorage/);
assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/);
assert.match(source, /createTopologyEngineeringSvgAdapter/);
assert.match(source, /createEngineeringSvgAdapterBridge/);
assert.match(source, /createEngineeringSvgWorkspaceShellFromAdapterBridge/);
assert.match(source, /assertEngineeringRevisionToken/);
assert.match(source, /if \(destroyed\) return false/);

console.log('Topology engineering SVG shadow dependency guards: ok');

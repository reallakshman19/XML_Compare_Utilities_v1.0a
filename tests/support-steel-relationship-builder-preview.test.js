import assert from 'node:assert/strict';

import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js';
import { SUPPORT_STEEL_DEFAULT_CONFIG } from '../tabs/support-steel-relationship-builder/support-steel-relationship-contracts.js';
import {
  buildSupportSteelProjectMigration,
  supportSteelProjectArtifacts,
} from '../tabs/support-steel-relationship-builder/support-steel-project-adapter.js';
import { supportSteelSampleText } from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';
import { parseSupportSteelJson } from '../tabs/support-steel-relationship-builder/support-steel-source-utils.js';

const combinedSourceText = supportSteelSampleText();
const combinedInput = parseSupportSteelJson(combinedSourceText, 'Combined staged model source');
const bundle = buildSupportSteelRelationshipBundle({
  combinedInput,
  config: SUPPORT_STEEL_DEFAULT_CONFIG,
});
const artifacts = supportSteelProjectArtifacts(bundle);

assert.equal(artifacts.length, 8);
for (const artifact of artifacts) {
  assert.equal(typeof artifact.text, 'string');
  assert.ok(artifact.text.length > 0, `${artifact.name} must have preview text`);
}

const migration = await buildSupportSteelProjectMigration({
  bundle,
  combinedSourceText,
  sourceName: 'support-steel-sources.json',
  createdAt: '2026-07-17T13:38:53.000Z',
  cryptoRef: globalThis.crypto,
});
assert.equal(migration.exportPlan.gate.status, 'READY');
assert.deepEqual(migration.outputs.map((row) => row.text), artifacts.map((row) => row.text));

console.log('support-steel preview export flow tests passed');
